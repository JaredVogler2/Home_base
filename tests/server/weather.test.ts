import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SkyState } from '../../shared/model.js';
import { inHousehold } from '../../server/db/client.js';
import { weatherCache } from '../../server/db/schema.js';
import { settled } from '../../server/weather/background.js';
import { USER_AGENT } from '../../server/weather/providers.js';
import { refreshWeatherIfDue } from '../../server/weather/service.js';
import { newFamily, pairWall, startServer, type Browser, type Family, type TestServer } from './harness.js';

/**
 * The Living Sky's weather, from the outside: what screens are sent, and what leaves the server to get it.
 *
 * Nothing here reaches a real weather service. The test server's network is a pretend one that answers as
 * api.weather.gov and api.open-meteo.com do (their real answers, captured once, are in fixtures/weather and are
 * read in weather-codes.test.ts). The weather is fetched after a screen has had its answer, so each test waits
 * for that with `settled()` rather than by sleeping.
 */

const MINUTE = 60 * 1000;
const HOME = { lat: 39.1, lon: -94.58 };
const LABEL = 'Pretend Lane 00000';

interface Sky {
  /** What the pretend services say. */
  nws: 'ok' | '404' | 'down';
  openMeteo: 'ok' | 'down';
  icon: string;
  fahrenheit: number;
  wmo: number;
  celsius: number;
  /** Per place, when a test needs two places to differ. */
  byPlace?: Record<string, { icon: string; wmo: number }>;
  /** Hold every answer until this resolves. */
  gate?: Promise<void>;
}

function pretendWorld(server: TestServer, sky: Sky): void {
  server.respond(async (url) => {
    if (sky.gate) await sky.gate;
    const parsed = new URL(url);
    if (parsed.hostname === 'api.weather.gov') {
      if (sky.nws === 'down') throw new TypeError('fetch failed');
      if (parsed.pathname.startsWith('/points/')) {
        if (sky.nws === '404')
          return Response.json({ title: 'Data Unavailable For Requested Point' }, { status: 404 });
        const place = parsed.pathname.slice('/points/'.length);
        return Response.json({
          properties: {
            forecastHourly: `https://api.weather.gov/gridpoints/TST/1,1/forecast/hourly?p=${place}`,
          },
        });
      }
      const place = parsed.searchParams.get('p') ?? '';
      return Response.json({
        properties: {
          periods: [
            {
              startTime: server.clock.now().toISOString(),
              temperature: sky.fahrenheit,
              temperatureUnit: 'F',
              icon: `https://api.weather.gov/icons/land/day/${sky.byPlace?.[place]?.icon ?? sky.icon}?size=medium`,
            },
          ],
        },
      });
    }
    if (parsed.hostname === 'api.open-meteo.com') {
      if (sky.openMeteo === 'down') throw new TypeError('fetch failed');
      const place = `${parsed.searchParams.get('latitude')},${parsed.searchParams.get('longitude')}`;
      return Response.json({
        utc_offset_seconds: 0,
        current_units: { temperature_2m: '°C', wind_speed_10m: 'km/h' },
        current: {
          time: server.clock.now().toISOString().slice(0, 16),
          temperature_2m: sky.celsius,
          weather_code: sky.byPlace?.[place]?.wmo ?? sky.wmo,
          wind_speed_10m: 5,
        },
      });
    }
    throw new TypeError(`no such place in the pretend world: ${parsed.hostname}`);
  });
}

function fineDay(overrides: Partial<Sky> = {}): Sky {
  return { nws: 'ok', openMeteo: 'ok', icon: 'skc', fahrenheit: 50, wmo: 0, celsius: 10, ...overrides };
}

async function switchOn(
  family: Family,
  options: { units?: 'us' | 'metric'; lat?: number; lon?: number; weather?: boolean } = {},
): Promise<void> {
  await family.parent.do('household.settings', {
    patch: {
      location: { lat: options.lat ?? HOME.lat, lon: options.lon ?? HOME.lon, label: LABEL },
      sky: { daylight: true, weather: options.weather ?? true, units: options.units ?? 'us' },
    },
  });
}

/** What a screen does while it waits, then what it does next time, once the background work is done. */
async function pollAndWait(...screens: Browser[]): Promise<void> {
  for (const screen of screens) await screen.poll();
  await settled();
  for (const screen of screens) await screen.poll();
  await settled();
}

async function cacheOf(server: TestServer, householdId: string) {
  return inHousehold(server.database, householdId, async (tx) => {
    const rows = await tx.select().from(weatherCache).where(eq(weatherCache.householdId, householdId));
    return rows[0] ?? null;
  });
}

let server: TestServer;
beforeAll(async () => {
  server = await startServer({}, '2026-03-03T15:00:00Z');
});
afterAll(async () => {
  await settled();
  await server.close();
});

describe('weather that is off', () => {
  it('is never asked for, however often the screens look, without both the switch and a place', async () => {
    pretendWorld(server, fineDay());
    const family = await newFamily(server);
    const wall = await pairWall(family);
    const before = server.outbound.length;

    // A place, but the switch off.
    await switchOn(family, { weather: false });
    await wall.pull();
    for (let i = 0; i < 5; i++) {
      await pollAndWait(wall, family.parent);
      server.clock.advance(30 * MINUTE);
    }
    expect(wall.snapshot!.weather).toBeNull();

    // The switch on, but no place.
    await family.parent.do('household.settings', {
      patch: { location: null, sky: { daylight: true, weather: true, units: 'us' } },
    });
    for (let i = 0; i < 5; i++) {
      await pollAndWait(wall, family.parent);
      server.clock.advance(30 * MINUTE);
    }
    expect(wall.snapshot!.weather).toBeNull();
    expect(family.parent.snapshot!.weather).toBeNull();
    expect(server.outbound.length).toBe(before);
    expect(await refreshWeatherIfDue(server.deps, family.householdId)).toBe('off');
    expect(server.outbound.length).toBe(before);
  });

  it('is never asked for when the deployment says off', async () => {
    const quiet = await startServer({ weather: 'off' });
    try {
      pretendWorld(quiet, fineDay());
      const family = await newFamily(quiet);
      const wall = await pairWall(family);
      await switchOn(family);
      await wall.pull();
      for (let i = 0; i < 3; i++) {
        await pollAndWait(wall);
        quiet.clock.advance(30 * MINUTE);
      }
      expect(await refreshWeatherIfDue(quiet.deps, family.householdId)).toBe('off');
      expect(quiet.outbound).toEqual([]);
      expect(wall.snapshot!.weather).toBeNull();
    } finally {
      await settled();
      await quiet.close();
    }
  });
});

describe('weather that is on', () => {
  it('asks once per twenty minutes however many screens look, and every screen gets the reading', async () => {
    const sky = fineDay({ icon: 'rain_showers,40/sct', fahrenheit: 50 });
    pretendWorld(server, sky);
    const family = await newFamily(server);
    const kitchen = await pairWall(family, 'Kitchen');
    const hall = await pairWall(family, 'Hall');
    await switchOn(family);
    const start = server.outbound.length;

    await Promise.all([kitchen.pull(), hall.pull(), family.parent.pull()]);
    expect(kitchen.snapshot!.weather).toBeNull(); // not asked yet: the first look starts the asking
    // Many screens asking at the same moment.
    await Promise.all([kitchen.poll(), hall.poll(), kitchen.poll(), family.parent.poll(), hall.poll()]);
    await settled();
    expect(server.outbound.length - start).toBe(2); // the point, then its hourly forecast: one asking

    await Promise.all([kitchen.poll(), hall.poll(), family.parent.poll()]);
    await settled();
    for (const screen of [kitchen, hall, family.parent]) {
      expect(screen.snapshot!.weather).toEqual({
        state: 'rain',
        temperature: 50,
        units: 'us',
        at: server.clock.now().toISOString(),
        stale: false,
      });
    }

    for (let i = 0; i < 6; i++) {
      server.clock.advance(3 * MINUTE);
      await pollAndWait(kitchen, hall, family.parent);
    }
    expect(server.outbound.length - start).toBe(2); // 18 minutes on: still the one asking

    server.clock.advance(3 * MINUTE);
    await Promise.all([kitchen.poll(), hall.poll(), family.parent.poll()]);
    await settled();
    expect(server.outbound.length - start).toBe(4);
  });

  it('shows the temperature in the household’s units', async () => {
    pretendWorld(server, fineDay({ fahrenheit: 68 }));
    const family = await newFamily(server);
    const wall = await pairWall(family);
    await switchOn(family, { units: 'metric' });
    await wall.pull();
    await pollAndWait(wall);
    expect(wall.snapshot!.weather).toMatchObject({ state: 'clear', temperature: 20, units: 'metric' });

    await family.parent.do('household.settings', {
      patch: { sky: { daylight: true, weather: true, units: 'us' } },
    });
    await wall.poll();
    expect(wall.snapshot!.weather).toMatchObject({ temperature: 68, units: 'us' });
  });

  it('does not keep the screen waiting for the weather service', async () => {
    let release!: () => void;
    const sky = fineDay({ gate: new Promise<void>((resolve) => (release = resolve)) });
    pretendWorld(server, sky);
    const family = await newFamily(server);
    const wall = await pairWall(family);
    await switchOn(family);
    await wall.pull();
    // The service is not answering at all, and the screen still has its answer straight away.
    expect([200, 204]).toContain(await wall.poll());
    release();
    await settled();
    await wall.poll();
    expect(wall.snapshot!.weather?.state).toBe('clear');
  });
});

describe('a weather service that fails', () => {
  it('throws nothing, asks less and less often, and lets the reading go stale and then go', async () => {
    const sky = fineDay({ icon: 'snow', fahrenheit: 23 });
    pretendWorld(server, sky);
    const family = await newFamily(server);
    const wall = await pairWall(family);
    await switchOn(family);
    await wall.pull();
    const observed = server.clock.now().getTime();
    await pollAndWait(wall);
    expect(wall.snapshot!.weather).toMatchObject({ state: 'snow', stale: false });

    sky.nws = 'down';
    sky.openMeteo = 'down';
    const asked: number[] = [];
    let last = server.outbound.length;
    // Look every minute for a while, noting each minute the service was asked.
    for (let minute = 1; minute <= 100; minute++) {
      server.clock.set(new Date(observed + minute * MINUTE).toISOString());
      await pollAndWait(wall);
      if (server.outbound.length > last) asked.push(minute);
      last = server.outbound.length;
      if (minute === 89) expect(wall.snapshot!.weather).toMatchObject({ state: 'snow', stale: false });
    }
    // 20 minutes as usual; then 5, 10 and 20 after each failure; then, before the 40 were up, once more at
    // the moment the reading went out of date, so that the screens were told.
    expect(asked).toEqual([20, 25, 35, 55, 91]);
    expect(wall.snapshot!.weather).toMatchObject({ state: 'snow', temperature: 23, stale: true });
    expect((await cacheOf(server, family.householdId))!.failures).toBe(5);

    // Still the last thing it said, asked after 80 minutes and then every two hours, until six hours are up.
    asked.length = 0;
    for (let minute = 100; minute <= 6 * 60; minute += 10) {
      server.clock.set(new Date(observed + minute * MINUTE).toISOString());
      await pollAndWait(wall);
      if (server.outbound.length > last) asked.push(minute);
      last = server.outbound.length;
      expect(wall.snapshot!.weather?.stale).toBe(true);
    }
    expect(asked).toEqual([180, 300]);
    server.clock.set(new Date(observed + (6 * 60 + 1) * MINUTE).toISOString());
    await pollAndWait(wall);
    expect(wall.snapshot!.weather).toBeNull();
    expect((await cacheOf(server, family.householdId))!.failures).toBe(8);
    expect(await refreshWeatherIfDue(server.deps, family.householdId)).toBe('fresh');

    // Back again: a fresh reading on the next asking.
    sky.nws = 'ok';
    server.clock.advance(2 * 60 * MINUTE);
    await pollAndWait(wall);
    expect(wall.snapshot!.weather).toMatchObject({ state: 'snow', stale: false });
    expect((await cacheOf(server, family.householdId))!.failures).toBe(0);
  });

  it('copes with a service that talks nonsense', async () => {
    server.respond(() => new Response('<html>Service Unavailable</html>', { status: 200 }));
    const family = await newFamily(server);
    await switchOn(family);
    expect(await refreshWeatherIfDue(server.deps, family.householdId)).toBe('failed');
    expect((await family.parent.pull()).weather).toBeNull();
  });
});

describe('moving house', () => {
  it('forgets the old place’s weather at once, and asks about the new place', async () => {
    const sky = fineDay({
      byPlace: { '39.1,-94.58': { icon: 'tsra', wmo: 95 }, '39.11,-94.57': { icon: 'fog', wmo: 45 } },
    });
    pretendWorld(server, sky);
    const family = await newFamily(server);
    const wall = await pairWall(family);
    await switchOn(family);
    await wall.pull();
    await pollAndWait(wall);
    expect(wall.snapshot!.weather?.state).toBe('storm');
    const before = server.outbound.length;

    await switchOn(family, { lat: 39.11, lon: -94.57 });
    expect(family.parent.snapshot!.weather).toBeNull();
    await wall.poll();
    expect(wall.snapshot!.weather).toBeNull();
    await settled();
    expect(server.outbound.length - before).toBe(2);
    await wall.poll();
    expect(wall.snapshot!.weather?.state).toBe('fog');
  });
});

describe('telling the screens', () => {
  it('moves the revision only when what a screen shows has changed', async () => {
    const sky = fineDay({ icon: 'bkn', fahrenheit: 50 });
    pretendWorld(server, sky);
    const family = await newFamily(server);
    const wall = await pairWall(family);
    await switchOn(family);
    await wall.pull();
    await pollAndWait(wall);
    expect(wall.snapshot!.weather).toMatchObject({ state: 'cloudy', temperature: 50 });

    const step = async (change: Partial<Sky>): Promise<{ moved: boolean; status: number }> => {
      await settled();
      Object.assign(sky, change);
      const rev = wall.snapshot!.rev;
      server.clock.advance(21 * MINUTE);
      await wall.poll();
      await settled();
      const status = await wall.poll();
      return { moved: wall.snapshot!.rev !== rev, status };
    };

    expect(await step({})).toEqual({ moved: false, status: 204 }); // the same again
    expect(await step({ fahrenheit: 52 })).toEqual({ moved: false, status: 204 }); // two degrees: noise
    expect(wall.snapshot!.weather?.temperature).toBe(50);
    expect(await step({ fahrenheit: 54 })).toEqual({ moved: true, status: 200 }); // four degrees from what is shown
    expect(wall.snapshot!.weather?.temperature).toBe(54);
    expect(await step({ icon: 'ovc' })).toEqual({ moved: false, status: 204 }); // still a cloudy sky
    expect(await step({ icon: 'rain' })).toEqual({ moved: true, status: 200 });
    expect(wall.snapshot!.weather?.state).toBe('rain');
  });
});

describe('choosing a service', () => {
  it('asks Open-Meteo when the National Weather Service says the place is not its', async () => {
    pretendWorld(server, fineDay({ nws: '404', wmo: 71, celsius: -1 }));
    const family = await newFamily(server);
    await switchOn(family);
    const before = server.outbound.length;
    expect(await refreshWeatherIfDue(server.deps, family.householdId)).toBe('refreshed');
    const hosts = server.outbound.slice(before).map((call) => new URL(call.url).hostname);
    expect(hosts).toEqual(['api.weather.gov', 'api.open-meteo.com']);
    expect((await family.parent.pull()).weather).toMatchObject({ state: 'snow', temperature: 30 });
  });
});

describe('what leaves the server', () => {
  it('is the rounded position and nothing else: no label, no name, no person in the User-Agent', async () => {
    const sky = fineDay({ nws: '404' });
    pretendWorld(server, sky);
    const family = await newFamily(server, { name: 'Robin Example' });
    await family.parent.do('household.settings', {
      patch: {
        location: { lat: 39.104999, lon: -94.583333, label: LABEL },
        sky: { daylight: true, weather: true, units: 'us' },
      },
    });
    const before = server.outbound.length;
    expect(await refreshWeatherIfDue(server.deps, family.householdId)).toBe('refreshed');
    sky.nws = 'ok';
    server.clock.advance(21 * MINUTE);
    expect(await refreshWeatherIfDue(server.deps, family.householdId)).toBe('refreshed');

    const calls = server.outbound.slice(before);
    expect(calls.length).toBe(4);
    for (const call of calls) {
      const url = new URL(call.url);
      expect(url.protocol).toBe('https:');
      expect(['api.weather.gov', 'api.open-meteo.com']).toContain(url.hostname);
      expect(call.init?.method ?? 'GET').toBe('GET');
      expect(call.init?.body).toBeUndefined();
      const numbers = call.url.match(/-?\d+\.\d+/g) ?? [];
      for (const n of numbers) expect(n).toMatch(/^-?\d+\.\d{1,2}$/);
      const everything = `${call.url} ${JSON.stringify(call.init?.headers ?? {})}`;
      for (const secret of [LABEL, 'Pretend', 'Robin', 'Example', family.email, family.householdId]) {
        expect(everything).not.toContain(secret);
      }
      const headers = (call.init?.headers ?? {}) as Record<string, string>;
      const agent = headers['User-Agent'];
      if (url.hostname === 'api.weather.gov') expect(agent).toBe(USER_AGENT);
      if (agent !== undefined) expect(agent).not.toMatch(/@|https?:|\.com|\.org/);
    }
    expect(calls.some((call) => call.url.includes('/points/39.1,-94.58'))).toBe(true);
    expect(calls.some((call) => call.url.includes('latitude=39.1&longitude=-94.58'))).toBe(true);
  });
});

describe('two families', () => {
  it('never see each other’s weather', async () => {
    const sky = fineDay({
      nws: '404',
      byPlace: { '39.1,-94.58': { icon: 'skc', wmo: 61 }, '39.2,-94.5': { icon: 'skc', wmo: 73 } },
    });
    pretendWorld(server, sky);
    const ours = await newFamily(server);
    const theirs = await newFamily(server);
    const nobody = await newFamily(server);
    await switchOn(ours);
    await switchOn(theirs, { lat: 39.2, lon: -94.5 });
    await switchOn(nobody, { weather: false });
    const ourWall = await pairWall(ours);
    const theirWall = await pairWall(theirs);
    const nobodysWall = await pairWall(nobody);
    await Promise.all([ourWall.pull(), theirWall.pull(), nobodysWall.pull()]);
    await pollAndWait(ourWall, theirWall, nobodysWall);

    expect(ourWall.snapshot!.weather?.state).toBe('rain');
    expect(theirWall.snapshot!.weather?.state).toBe('snow');
    expect(nobodysWall.snapshot!.weather).toBeNull();
    expect(await cacheOf(server, nobody.householdId)).toBeNull();

    // Each household's row is invisible from inside another household.
    const seen = await inHousehold(server.database, theirs.householdId, (tx) =>
      tx.select().from(weatherCache),
    );
    expect(seen.map((row) => row.householdId)).toEqual([theirs.householdId]);
    const states: SkyState[] = [ourWall, theirWall].map((wall) => wall.snapshot!.weather!.state);
    expect(new Set(states).size).toBe(2);
  });
});
