import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { RELEASED, RESERVED } from '../../server/ai/run.js';
import { areaOf, HEALTH_DAYS, HELPER_BOOKKEEPING, WEATHER_WORTH_NOTING } from '../../server/domain/health.js';
import { HANDLERS } from '../../server/ops/handlers.js';
import { refreshWeatherIfDue } from '../../server/weather/service.js';
import { newId } from '../../shared/ids.js';
import { OPS } from '../../shared/ops.js';
import { classifyItem } from '../../shared/shopping.js';
import {
  addChild,
  addReward,
  addTask,
  Browser,
  newFamily,
  pairWall,
  startServer,
  type Family,
  type TestServer,
} from './harness.js';

/**
 * How the connections are, and have been (the brief's history (f): "integration health, sync errors and device
 * changes"). A parent can see whether the weather service has been answering, whether the helper has been
 * failing, which screens came and went, and whether any screen's request was refused or could not be done —
 * without a single word a family typed being in the account.
 */

interface Line {
  at: string;
  what: string;
  who: string;
  about: string | null;
}
interface Report {
  days: number;
  weather: { on: boolean; observedAt: string | null; failures: number };
  helper: { on: boolean; ok: number; failed: number; lastOkAt: string | null; lastFailedAt: string | null };
  academy: { on: boolean; linked: number; lastImportAt: string | null };
  shortcuts: { active: number; lastUsedAt: string | null };
  screens: { name: string; kind: string; lastSeenAt: string | null; switchedOff: boolean }[];
  requests: { done: number; ordinaryNo: number; refused: number; failed: number };
  lines: Line[];
}

const MINUTE = 60_000;

let server: TestServer;
beforeAll(async () => {
  server = await startServer({}, '2026-03-03T15:00:00Z');
});
afterAll(async () => {
  await server.close();
});

const report = async (family: Family): Promise<Report> => {
  const reply = await family.parent.get<Report>('/history/health');
  expect(reply.status).toBe(200);
  return reply.body;
};

describe('how the connections have been', () => {
  it('starts out saying what is switched off, and shows a screen being added and switched off', async () => {
    const family = await newFamily(server);
    const first = await report(family);
    expect(first.days).toBe(HEALTH_DAYS);
    expect(first.weather).toEqual({ on: false, observedAt: null, failures: 0 });
    expect(first.helper).toMatchObject({ on: false, ok: 0, failed: 0 });
    expect(first.academy).toMatchObject({ on: false, linked: 0, lastImportAt: null });
    expect(first.shortcuts).toEqual({ active: 0, lastUsedAt: null });
    expect(first.screens).toEqual([]);

    const wall = await pairWall(family, 'Kitchen');
    await wall.pull();
    const paired = await report(family);
    expect(paired.screens).toHaveLength(1);
    expect(paired.screens[0]).toMatchObject({ name: 'Kitchen', kind: 'wall', switchedOff: false });
    expect(paired.screens[0]?.lastSeenAt).not.toBeNull();
    expect(paired.lines.map((line) => line.what)).toContain('device.paired');

    const deviceId = (await family.parent.pull()).devices![0]!.id;
    await family.parent.do('device.revoke', { deviceId });
    const after = await report(family);
    expect(after.screens[0]).toMatchObject({ name: 'Kitchen', switchedOff: true });
    expect(after.lines.map((line) => line.what)).toEqual(
      expect.arrayContaining(['device.paired', 'device.revoked']),
    );
  });

  it('lists a request that was refused, by screen and part of the house, and only counts an ordinary "no"', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const wall = await pairWall(family, 'Hall');
    const listId = (await family.parent.pull()).lists[0]!.id;
    await family.parent.do('shopping.add', {
      itemId: newId(),
      listId,
      text: 'A surprise for Grandma',
      quantity: null,
      unit: null,
      note: null,
      url: null,
      store: null,
      priority: false,
      ...classifyItem('A surprise for Grandma'),
    });
    // The wall tries something only a parent may do, and sends something that makes no sense.
    const notAllowed = await wall.op('task.create', { templateId: newId() } as never);
    expect(notAllowed).toMatchObject({ status: 'rejected', reason: 'forbidden' });
    const nonsense = await wall.op('shopping.request', { itemId: 'not-an-id' } as never);
    expect(nonsense).toMatchObject({ status: 'rejected', reason: 'invalid' });
    // An ordinary "no": a reward the child cannot afford. That is the house working, not a fault.
    const rewardId = await addReward(family, 50);
    const reward = (await wall.pull()).rewards.find((entry) => entry.id === rewardId)!;
    const tooDear = await wall.op('redemption.request', {
      redemptionId: newId(),
      profileId: kit,
      rewardId,
      rewardVersion: reward.version,
      price: reward.price,
    });
    expect(tooDear).toMatchObject({ status: 'rejected', reason: 'not_enough_stars' });

    const seen = await report(family);
    expect(seen.requests).toMatchObject({ refused: 2, ordinaryNo: 1, failed: 0 });
    expect(seen.requests.done).toBeGreaterThan(0);
    const refused = seen.lines.filter((line) => line.what.startsWith('request.'));
    expect(refused.map((line) => [line.what, line.about]).sort()).toEqual([
      ['request.made_no_sense', 'the shopping list'],
      ['request.not_allowed', 'missions'],
    ]);
    // It names the screen as the family named it.
    expect(refused.every((line) => line.who.includes('Hall'))).toBe(true);
    // And nothing anybody typed is anywhere in the account.
    expect(JSON.stringify(seen)).not.toMatch(/surprise|Grandma|Kit\b/);
  });

  it('notes a request the server itself could not carry out — once a day, however often it is retried', async () => {
    const family = await newFamily(server);
    const wall = await pairWall(family, 'Kitchen');
    await addChild(family, 'Kit');
    await addTask(family);
    const broken = vi.spyOn(HANDLERS, 'shopping.check').mockRejectedValue(new Error('disk on fire'));
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      // The same request, retried as a screen would, and then a different request of the same kind.
      const opId = newId();
      for (let attempt = 0; attempt < 3; attempt++) {
        const outcome = await wall.op('shopping.check', { itemId: newId(), checked: true }, opId);
        expect(outcome.status).toBe('retry');
      }
      await wall.op('shopping.check', { itemId: newId(), checked: true });
    } finally {
      broken.mockRestore();
      quiet.mockRestore();
    }
    const seen = await report(family);
    const failed = seen.lines.filter((line) => line.what === 'sync.failed');
    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({ about: 'the shopping list' });
    expect(failed[0]?.who).toContain('Kitchen');
    expect(seen.requests.failed).toBe(1);

    // The next day it is worth saying again.
    server.clock.advance(25 * 60 * MINUTE);
    const again = vi.spyOn(HANDLERS, 'shopping.check').mockRejectedValue(new Error('still on fire'));
    const hush = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await wall.op('shopping.check', { itemId: newId(), checked: true });
    } finally {
      again.mockRestore();
      hush.mockRestore();
      server.clock.advance(-25 * 60 * MINUTE);
    }
    expect((await report(family)).lines.filter((line) => line.what === 'sync.failed')).toHaveLength(2);
  });

  it('notes a weather service going quiet once, and coming back once — not every failed try', async () => {
    const family = await newFamily(server);
    await family.parent.do('household.settings', {
      patch: { location: { lat: 39.1, lon: -94.58, label: 'Pretend Lane' }, sky: { weather: true } },
    });
    const quiet = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const started = server.clock.now().getTime();
    try {
      // Nothing answers (the tests' network reaches nothing). Each try waits longer than the one before.
      for (let attempt = 1; attempt <= WEATHER_WORTH_NOTING + 2; attempt++) {
        expect(await refreshWeatherIfDue(server.deps, family.householdId)).toBe('failed');
        server.clock.advance(3 * 60 * MINUTE);
      }
      const during = await report(family);
      expect(during.weather).toMatchObject({
        on: true,
        observedAt: null,
        failures: WEATHER_WORTH_NOTING + 2,
      });
      expect(during.lines.filter((line) => line.what === 'weather.failed')).toHaveLength(1);
      expect(during.lines.filter((line) => line.what === 'weather.recovered')).toHaveLength(0);

      // It comes back.
      server.respond((url) => {
        const parsed = new URL(url);
        if (parsed.hostname === 'api.weather.gov' && parsed.pathname.startsWith('/points/'))
          return Response.json({
            properties: { forecastHourly: 'https://api.weather.gov/gridpoints/TST/1,1/forecast/hourly' },
          });
        if (parsed.hostname === 'api.weather.gov')
          return Response.json({
            properties: {
              periods: [
                {
                  startTime: server.clock.now().toISOString(),
                  temperature: 61,
                  temperatureUnit: 'F',
                  icon: 'https://api.weather.gov/icons/land/day/few?size=medium',
                },
              ],
            },
          });
        throw new TypeError('fetch failed');
      });
      expect(await refreshWeatherIfDue(server.deps, family.householdId)).toBe('refreshed');
      const after = await report(family);
      expect(after.weather.failures).toBe(0);
      expect(after.weather.observedAt).not.toBeNull();
      const back = after.lines.filter((line) => line.what === 'weather.recovered');
      expect(back).toHaveLength(1);
      expect(back[0]?.about).toBe(String(WEATHER_WORTH_NOTING + 2));
      // Where the family lives is in none of it.
      expect(JSON.stringify(after)).not.toMatch(/Pretend|39\.1|94\.58/);
    } finally {
      quiet.mockRestore();
      server.respond(() => {
        throw new TypeError('fetch failed (tests have no network)');
      });
      server.clock.advance(started - server.clock.now().getTime());
    }
  });

  it('is for parents only, and one household never sees another’s', async () => {
    const family = await newFamily(server);
    const others = await newFamily(server);
    const wall = await pairWall(family, 'Kitchen');
    await pairWall(others, 'Their wall');
    expect((await wall.get('/history/health')).status).toBe(403);
    expect((await new Browser(server).get('/history/health')).status).toBe(401);
    const mine = await report(family);
    expect(mine.screens.map((screen) => screen.name)).toEqual(['Kitchen']);
    expect(JSON.stringify(mine)).not.toContain('Their wall');
  });
});

describe('the words the account is made of', () => {
  it('puts every kind of request in a part of the house a parent would recognise', () => {
    const areas = new Set(Object.keys(OPS).map(areaOf));
    expect(areas.has('something else')).toBe(false);
    expect(areaOf('shopping.favourite')).toBe('the shopping list');
    expect(areaOf('occurrence.submit')).toBe('missions');
    expect(areaOf('nonsense')).toBe('something else');
  });

  it('agrees with the helper about which of its lines are book-keeping', () => {
    expect([...HELPER_BOOKKEEPING].sort()).toEqual([RELEASED, RESERVED].sort());
  });
});
