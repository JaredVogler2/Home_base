import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '../../shared/ids.js';
import type { Snapshot } from '../../shared/model.js';
import type { OpEnvelope, OpInput, OpType } from '../../shared/ops.js';
import { applyLocal } from '../../src/sync/optimistic.js';
import {
  addChild,
  addReward,
  addTask,
  newFamily,
  occurrenceOf,
  pairWall,
  startServer,
  walletOf,
  type Browser,
  type TestServer,
} from './harness.js';

/**
 * What a screen shows the instant something is tapped is a guess, made before the server has answered. The
 * guess must be the truth — the same as what the server then says — or, where the server decides something
 * (stars), more cautious than the truth and never ahead of it. Each test makes the screen's guess for one kind
 * of request, sends the same request to the real server, and compares the two.
 */

let server: TestServer;
beforeAll(async () => {
  server = await startServer({}, '2026-03-03T21:00:00Z');
});
afterAll(async () => {
  await server.close();
});

/** Guess, then ask, then compare what was picked out of each. */
async function guessAndAsk<T extends OpType>(
  screen: Browser,
  type: T,
  input: OpInput<T>,
  pick: (snapshot: Snapshot) => unknown,
): Promise<{ guessed: Snapshot; told: Snapshot }> {
  const before = await screen.pull();
  const op = { id: newId(), type, at: server.clock.now().toISOString(), input } as OpEnvelope;
  const guessed = applyLocal(before, op);
  const outcome = await screen.op(type, input, op.id);
  expect(outcome.status, `${type} was ${outcome.status}`).toBe('applied');
  const told = screen.snapshot!;
  expect(pick(guessed), `the guess for ${type}`).toEqual(pick(told));
  return { guessed, told };
}

async function household() {
  const family = await newFamily(server);
  const kit = await addChild(family, 'Kit');
  const wall = await pairWall(family);
  return { family, kit, wall };
}

describe('the screen’s guess agrees with the server', () => {
  it('starting a mission, and saying "not today"', async () => {
    const { family, kit, wall } = await household();
    const first = await addTask(family, { title: 'Shoes' });
    const second = await addTask(family, { title: 'Books' });
    const snapshot = await wall.pull();
    const state = (id: string) => (s: Snapshot) => s.occurrences.find((o) => o.id === id)?.status;
    const shoes = occurrenceOf(snapshot, first, kit);
    await guessAndAsk(wall, 'occurrence.start', { occurrenceId: shoes.id, profileId: kit }, state(shoes.id));
    const books = occurrenceOf(snapshot, second, kit);
    await guessAndAsk(wall, 'occurrence.skip', { occurrenceId: books.id, profileId: kit }, state(books.id));
  });

  it('a mission a grown-up must see: sent, and taken back with "oops"', async () => {
    const { family, kit, wall } = await household();
    const task = await addTask(family, { stars: 3, verification: 'guardian' });
    const mission = occurrenceOf(await wall.pull(), task, kit);
    const seen = (s: Snapshot) => {
      const o = s.occurrences.find((entry) => entry.id === mission.id)!;
      return [o.status, o.doneBy, o.credited, walletOf(s, kit).available];
    };
    await guessAndAsk(wall, 'occurrence.submit', { occurrenceId: mission.id, profileId: kit }, seen);
    await guessAndAsk(wall, 'occurrence.undo', { occurrenceId: mission.id }, seen);
  });

  it('never runs ahead of the server about stars: a mission that needs no grown-up is shown as sent, not done', async () => {
    const { family, kit, wall } = await household();
    const task = await addTask(family, { stars: 2, verification: 'auto' });
    const before = await wall.pull();
    const mission = occurrenceOf(before, task, kit);
    const op = {
      id: newId(),
      type: 'occurrence.submit',
      at: server.clock.now().toISOString(),
      input: { occurrenceId: mission.id, profileId: kit },
    } as OpEnvelope;
    const guessed = applyLocal(before, op);
    const guess = guessed.occurrences.find((o) => o.id === mission.id)!;
    // The guess: sent, no stars yet.
    expect([guess.status, guess.credited, walletOf(guessed, kit).available]).toEqual(['submitted', false, 0]);
    // The truth, a moment later: done, with its stars. The screen was behind, never ahead.
    await wall.op('occurrence.submit', { occurrenceId: mission.id, profileId: kit }, op.id);
    const truth = wall.snapshot!.occurrences.find((o) => o.id === mission.id)!;
    expect([truth.status, truth.credited, walletOf(wall.snapshot!, kit).available]).toEqual([
      'approved',
      true,
      2,
    ]);
  });

  it('asking for a reward and changing your mind: the stars set aside and given back', async () => {
    const { family, kit, wall } = await household();
    await family.parent.do('ledger.bonus', { entryId: newId(), profileId: kit, stars: 9, note: null });
    const rewardId = await addReward(family, 5);
    const offered = (await wall.pull()).rewards.find((reward) => reward.id === rewardId)!;
    const redemptionId = newId();
    const seen = (s: Snapshot) => {
      const wallet = walletOf(s, kit);
      return [
        wallet.available,
        wallet.reserved,
        s.redemptions.filter((r) => r.id === redemptionId).map((r) => [r.status, r.title, r.price]),
      ];
    };
    const asked = await guessAndAsk(
      wall,
      'redemption.request',
      { redemptionId, rewardId, profileId: kit, rewardVersion: offered.version, price: offered.price },
      seen,
    );
    expect(walletOf(asked.told, kit)).toMatchObject({ available: 4, reserved: 5 });
    const back = await guessAndAsk(wall, 'redemption.cancel', { redemptionId }, (s) => {
      const wallet = walletOf(s, kit);
      return [wallet.available, wallet.reserved];
    });
    expect(walletOf(back.told, kit)).toMatchObject({ available: 9, reserved: 0 });
  });

  it('the shopping list: ticking, unticking, and a child asking by picture', async () => {
    const { family, kit, wall } = await household();
    const list = (await family.parent.pull()).lists.find((entry) => entry.kind === 'groceries')!;
    const itemId = newId();
    await family.parent.do('shopping.add', {
      itemId,
      listId: list.id,
      text: 'Milk',
      quantity: null,
      unit: null,
      note: null,
      url: null,
      store: null,
      priority: false,
      category: 'dairy',
      picture: 'milk',
    });
    const status = (id: string) => (s: Snapshot) =>
      s.items.filter((item) => item.id === id).map((item) => item.status);
    await guessAndAsk(family.parent, 'shopping.check', { itemId, checked: true }, status(itemId));
    await guessAndAsk(family.parent, 'shopping.check', { itemId, checked: false }, status(itemId));
    const asked = newId();
    await guessAndAsk(wall, 'shopping.request', { itemId: asked, profileId: kit, picture: 'apple' }, (s) =>
      s.items.filter((item) => item.id === asked).map((item) => [item.status, item.picture]),
    );
  });

  it('settings: only what was changed changes, on the screen as on the server', async () => {
    const { family } = await household();
    const settings = (s: Snapshot) => s.household.settings;
    await guessAndAsk(family.parent, 'household.settings', { patch: { calm: true } }, settings);
    await guessAndAsk(
      family.parent,
      'household.settings',
      { patch: { quietHours: { start: '20:15' }, voice: { rate: 0.8 } } },
      settings,
    );
    // Something that is not a setting is left out by both.
    await guessAndAsk(
      family.parent,
      'household.settings',
      { patch: { wall: { idleHomeSeconds: 120 } } },
      settings,
    );
  });

  it('the plan: resting a mission, putting missions in order, and a kind of day', async () => {
    const { family } = await household();
    const shoes = await addTask(family, { title: 'Shoes' });
    const books = await addTask(family, { title: 'Books' });
    await guessAndAsk(family.parent, 'task.status', { templateId: shoes, status: 'paused' }, (s) =>
      s.templates?.map((template) => [template.title, template.status]),
    );
    await guessAndAsk(family.parent, 'task.reorder', { templateIds: [books, shoes] }, (s) =>
      [...(s.templates ?? [])].sort((a, b) => a.sort - b.sort).map((template) => template.title),
    );
    await guessAndAsk(
      family.parent,
      'calendar.setDay',
      { date: '2026-03-05', labels: ['school', 'visitor'] },
      (s) => s.calendar.filter((day) => day.date === '2026-03-05'),
    );
  });
});
