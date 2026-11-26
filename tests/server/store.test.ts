import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '../../shared/ids.js';
import { memoryCache, type Cache } from '../../src/sync/cache.js';
import { SyncStore } from '../../src/sync/store.js';
import {
  addChild,
  addReward,
  addTask,
  Browser,
  newFamily,
  occurrenceOf,
  pairWall,
  startServer,
  walletOf,
  type TestServer,
} from './harness.js';

/**
 * The browser's half of keeping in step — the store every screen draws from — run against the real server.
 *
 * The store's requests are handed to the server through a test "browser" that keeps the cookie, so everything
 * in between is the code that ships: the outbox, the optimistic layer, idempotent operations, the scoped
 * snapshot. The network can be switched off, or made to lose answers, to show what a screen does then.
 */

let server: TestServer;
const realFetch = globalThis.fetch;
const stores: SyncStore[] = [];

beforeAll(async () => {
  server = await startServer({}, '2026-03-03T21:00:00Z');
});
afterAll(async () => {
  globalThis.fetch = realFetch;
  await server.close();
});
afterEach(() => {
  for (const store of stores.splice(0)) store.stop();
});

interface Network {
  up: boolean;
  /** The request reaches the server and is done there; the answer never comes back. */
  loseAnswers: boolean;
  sent: { method: string; path: string }[];
}

/** Point the store's requests at this browser's session on the test server. */
function connect(browser: Browser): Network {
  const network: Network = { up: true, loseAnswers: false, sent: [] };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input).replace(/^\/api/, '');
    const method = init?.method ?? 'GET';
    network.sent.push({ method, path: path.split('?')[0] ?? path });
    if (!network.up) throw new TypeError('Failed to fetch');
    const reply = await browser.request(
      method,
      path,
      typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
    );
    if (network.loseAnswers) throw new TypeError('Failed to fetch');
    return new Response(reply.status === 204 ? null : JSON.stringify(reply.body), { status: reply.status });
  }) as typeof fetch;
  return network;
}

function storeWith(cache: Cache = memoryCache()): SyncStore {
  const store = new SyncStore({ cache, now: () => server.clock.now().getTime() });
  stores.push(store);
  return store;
}

async function household() {
  const family = await newFamily(server);
  const kit = await addChild(family, 'Kit');
  const task = await addTask(family, { stars: 2 });
  const wall = await pairWall(family);
  return { family, kit, task, wall };
}

describe('the screen’s store', () => {
  it('shows a tap at once, sends it once, and ends up agreeing with the server', async () => {
    const { kit, task, wall } = await household();
    connect(wall);
    const store = storeWith();
    await store.start();
    expect(store.getState().phase).toBe('ready');
    const mission = occurrenceOf(store.getState().view!, task, kit);
    expect(mission.status).toBe('available');

    // Hold the server's answer back for a moment, to look at what the screen shows in between.
    let letThrough: () => void = () => {};
    const held = new Promise<void>((resolve) => (letThrough = resolve));
    const passing = globalThis.fetch;
    globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
      if (args[1]?.method === 'POST') await held;
      return passing(...args);
    }) as typeof fetch;

    store.dispatch('occurrence.submit', { occurrenceId: mission.id, profileId: kit });
    // Nothing is shown until the device has written the request down…
    expect(store.getState().pending).toBe(0);
    await store.settled();
    // …then at once the screen shows it sent — and does not claim the stars before the server has given them.
    const shown = occurrenceOf(store.getState().view!, task, kit);
    expect(shown.status).toBe('submitted');
    expect(shown.credited).toBe(false);
    expect(walletOf(store.getState().view!, kit).available).toBe(0);
    expect(store.getState().pending).toBe(1);
    expect(store.getState().pendingIds.has(mission.id)).toBe(true);

    letThrough();
    await store.sync();
    const settled = store.getState();
    expect(settled.pending).toBe(0);
    expect(occurrenceOf(settled.view!, task, kit)).toMatchObject({ status: 'approved', credited: true });
    expect(walletOf(settled.view!, kit).available).toBe(2);
  });

  it('keeps what was asked while there is no signal — through a reload — and sends it exactly once', async () => {
    const { kit, task, wall } = await household();
    const network = connect(wall);
    const cache = memoryCache();
    const store = storeWith(cache);
    await store.start();
    const mission = occurrenceOf(store.getState().view!, task, kit);

    network.up = false;
    store.dispatch('occurrence.submit', { occurrenceId: mission.id, profileId: kit });
    await store.settled();
    // Written to the device before it is shown as sent: a reload a moment later would still have it.
    expect((await cache.loadOutbox()).map((op) => op.type)).toEqual(['occurrence.submit']);
    await store.sync();
    expect(store.getState().online).toBe(false);
    expect(store.getState().pending).toBe(1);
    // Still drawn as sent; nothing has been lost and nothing has been claimed.
    expect(occurrenceOf(store.getState().view!, task, kit).status).toBe('submitted');
    store.stop();

    // The screen is switched off and on again with still no signal: the house and the tap are both still there.
    const again = storeWith(cache);
    await again.start();
    expect(again.getState().phase).toBe('ready');
    expect(again.getState().pending).toBe(1);
    expect(occurrenceOf(again.getState().view!, task, kit).status).toBe('submitted');

    // The answer to the first sending is lost on the way back: the server did it, the screen cannot know.
    network.up = true;
    network.loseAnswers = true;
    await again.sync();
    expect(again.getState().pending).toBe(1);
    // Sent again when the signal is good; the server does it once.
    network.loseAnswers = false;
    await again.sync();
    expect(again.getState().pending).toBe(0);
    expect(again.getState().online).toBe(true);
    expect(walletOf(again.getState().view!, kit)).toMatchObject({ available: 2, lifetime: 2 });
    expect(await cache.loadOutbox()).toEqual([]);
  });

  it('says a refusal gently, forgets the request, and shows things as they really are', async () => {
    const { family, kit, wall } = await household();
    const reward = await addReward(family, 5);
    connect(wall);
    const store = storeWith();
    await store.start();

    // No stars yet: asking for a five-star reward cannot be agreed to.
    const offered = store.getState().view!.rewards.find((entry) => entry.id === reward)!;
    const outcome = await store.request('redemption.request', {
      redemptionId: newId(),
      rewardId: reward,
      profileId: kit,
      rewardVersion: offered.version,
      price: offered.price,
    });
    expect(outcome.status).toBe('rejected');
    const state = store.getState();
    expect(state.pending).toBe(0);
    expect(state.notices).toHaveLength(1);
    expect(state.notices[0]?.type).toBe('redemption.request');
    expect(state.view!.redemptions).toEqual([]);
    expect(walletOf(state.view!, kit).available).toBe(0);
    store.dismissNotice(state.notices[0]!.id);
    expect(store.getState().notices).toEqual([]);
  });

  it('forgets everything the moment the server says this screen is a stranger', async () => {
    const { family, kit, task, wall } = await household();
    connect(wall);
    const cache = memoryCache();
    const store = storeWith(cache);
    await store.start();
    expect(await cache.loadSnapshot()).not.toBeNull();
    const mission = occurrenceOf(store.getState().view!, task, kit);

    // A parent switches the wall off from their phone.
    const device = (await family.parent.pull()).devices!.find((entry) => entry.kind === 'wall')!;
    await family.parent.do('device.revoke', { deviceId: device.id });

    store.dispatch('occurrence.submit', { occurrenceId: mission.id, profileId: kit });
    await store.settled();
    await store.sync();
    const state = store.getState();
    expect(state.phase).toBe('stranger');
    expect(state.view).toBeNull();
    expect(state.pending).toBe(0);
    // Nothing of the family is left on the device.
    expect(await cache.loadSnapshot()).toBeNull();
    expect(await cache.loadOutbox()).toEqual([]);
    // And the tap it was holding did not count.
    expect(walletOf(await family.parent.pull(), kit).available).toBe(0);
  });

  it('asks "anything new?" with what it has, and hears about a change made elsewhere', async () => {
    const { family, kit, task, wall } = await household();
    const network = connect(wall);
    const store = storeWith();
    await store.start();
    const before = store.getState().snapshot!;
    network.sent.length = 0;
    await store.sync();
    // Nothing new: the same snapshot object is kept (a 204 has no body to replace it with).
    expect(store.getState().snapshot).toBe(before);
    expect(network.sent).toEqual([{ method: 'GET', path: '/sync' }]);

    await family.parent.do('occurrence.markDone', {
      occurrenceId: occurrenceOf(before, task, kit).id,
      profileId: kit,
    });
    await store.sync();
    expect(store.getState().snapshot!.rev).toBeGreaterThan(before.rev);
    expect(walletOf(store.getState().view!, kit).available).toBe(2);
  });
});

describe('the demo on a server that keeps nothing', () => {
  it('walks back in when the server has been replaced by a fresh one', async () => {
    const first = await startServer({ demo: true }, '2026-03-03T21:00:00Z');
    const second = await startServer({ demo: true }, '2026-03-03T21:00:00Z');
    try {
      const visitor = new Browser(first);
      expect((await visitor.post('/demo/enter', { as: 'wall' })).status).toBe(200);
      const network = connect(visitor);
      const store = new SyncStore({ cache: memoryCache(), now: () => first.clock.now().getTime() });
      stores.push(store);
      await store.start();
      expect(store.getState().view?.household.demo).toBe(true);
      const children = store.getState().view!.profiles.length;
      expect(children).toBeGreaterThan(0);

      // The hosted server is replaced: same made-up family, no memory of this browser's session.
      const moved = new Browser(second);
      moved.cookie = visitor.cookie;
      const rerouted = connect(moved);
      await store.sync();
      expect(rerouted.sent.map((request) => request.path)).toContain('/demo/enter');
      const state = store.getState();
      expect(state.phase).toBe('ready');
      expect(state.view?.household.demo).toBe(true);
      expect(state.view!.profiles).toHaveLength(children);
      expect(state.view!.viewer.kind).toBe('device');
      expect(network.sent.length).toBeGreaterThan(0);
    } finally {
      await first.close();
      await second.close();
    }
  });

  it('stays out when a parent switches a demo wall off: only a server that has forgotten it lets it back', async () => {
    const demo = await startServer({ demo: true }, '2026-03-03T21:00:00Z');
    try {
      const wall = new Browser(demo);
      await wall.post('/demo/enter', { as: 'wall' });
      const parent = new Browser(demo);
      await parent.post('/demo/enter', { as: 'guardian' });
      connect(wall);
      const store = new SyncStore({ cache: memoryCache(), now: () => demo.clock.now().getTime() });
      stores.push(store);
      await store.start();
      expect(store.getState().phase).toBe('ready');

      const mine = store.getState().snapshot!.viewer.deviceId!;
      await parent.do('device.revoke', { deviceId: mine });
      const network = connect(wall);
      await store.sync();
      expect(store.getState().phase).toBe('stranger');
      expect(network.sent.map((request) => request.path)).not.toContain('/demo/enter');
    } finally {
      await demo.close();
    }
  });

  it('does not walk a real household back in: signed out means signed out', async () => {
    const { family, wall } = await household();
    connect(wall);
    const store = storeWith();
    await store.start();
    const device = (await family.parent.pull()).devices!.find((entry) => entry.kind === 'wall')!;
    await family.parent.do('device.revoke', { deviceId: device.id });
    const network = connect(wall);
    await store.sync();
    expect(store.getState().phase).toBe('stranger');
    expect(network.sent.map((request) => request.path)).not.toContain('/demo/enter');
  });
});
