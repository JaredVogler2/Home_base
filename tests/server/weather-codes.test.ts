import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SKY_STATES } from '../../shared/model.js';
import { readConfig } from '../../server/config.js';
import { skyFromNwsIcon, skyFromWmo } from '../../server/weather/codes.js';
import {
  MAX_RESPONSE_BYTES,
  NotCovered,
  USER_AGENT,
  coordinate,
  inUsArea,
  nws,
  openMeteo,
  providerFor,
} from '../../server/weather/providers.js';

/**
 * The pure parts of the weather: turning each service's codes into a sky, reading each service's answer, and
 * choosing which service to ask. The answers used here were captured once from the real services for the made-up
 * test position 39.10,-94.58 and trimmed (tests/server/fixtures/weather).
 */

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./fixtures/weather/${name}`, import.meta.url), 'utf8'));

const icon = (path: string) => `https://api.weather.gov/icons/land/${path}?size=medium`;

describe('NWS icons', () => {
  it('maps every icon code the service lists onto one of our skies', () => {
    const expected: Record<string, string> = {
      skc: 'clear',
      few: 'partly',
      sct: 'partly',
      bkn: 'cloudy',
      ovc: 'cloudy',
      wind_skc: 'wind',
      wind_few: 'wind',
      wind_sct: 'wind',
      wind_bkn: 'wind',
      wind_ovc: 'wind',
      snow: 'snow',
      rain_snow: 'snow',
      rain_sleet: 'rain',
      snow_sleet: 'snow',
      fzra: 'rain',
      rain_fzra: 'rain',
      snow_fzra: 'snow',
      sleet: 'snow',
      rain: 'rain',
      rain_showers: 'rain',
      rain_showers_hi: 'rain',
      tsra: 'storm',
      tsra_sct: 'storm',
      tsra_hi: 'storm',
      tornado: 'storm',
      hurricane: 'storm',
      tropical_storm: 'storm',
      dust: 'fog',
      smoke: 'fog',
      haze: 'fog',
      hot: 'partly',
      cold: 'partly',
      blizzard: 'snow',
      fog: 'fog',
    };
    for (const [code, sky] of Object.entries(expected)) {
      expect(skyFromNwsIcon(icon(`day/${code}`)), code).toBe(sky);
      expect(skyFromNwsIcon(icon(`night/${code}`)), code).toBe(sky);
    }
  });

  it('reads the chance after a comma, and uses the first of two codes', () => {
    expect(skyFromNwsIcon(icon('day/rain_showers,40'))).toBe('rain');
    expect(skyFromNwsIcon(icon('day/rain_showers,40/sct'))).toBe('rain');
    expect(skyFromNwsIcon(icon('night/sct/tsra_hi,60'))).toBe('partly');
    expect(skyFromNwsIcon(icon('day/tsra,80/rain,20'))).toBe('storm');
    expect(skyFromNwsIcon('https://api.weather.gov/icons/land/night/sct?size=small')).toBe('partly');
  });

  it('falls back to a partly cloudy sky for anything it does not know', () => {
    expect(skyFromNwsIcon(icon('day/volcano'))).toBe('partly');
    expect(skyFromNwsIcon('')).toBe('partly');
    expect(skyFromNwsIcon('not a url at all')).toBe('partly');
    expect(skyFromNwsIcon(icon('day/constructor'))).toBe('partly');
    expect(skyFromNwsIcon(icon('day/__proto__'))).toBe('partly');
  });
});

describe('WMO codes', () => {
  it('maps the codes Open-Meteo documents', () => {
    const cases: [number, string][] = [
      [0, 'clear'],
      [1, 'partly'],
      [2, 'partly'],
      [3, 'cloudy'],
      [45, 'fog'],
      [48, 'fog'],
      [51, 'drizzle'],
      [53, 'drizzle'],
      [55, 'drizzle'],
      [56, 'drizzle'],
      [57, 'drizzle'],
      [61, 'rain'],
      [63, 'rain'],
      [65, 'rain'],
      [66, 'rain'],
      [67, 'rain'],
      [80, 'rain'],
      [81, 'rain'],
      [82, 'rain'],
      [71, 'snow'],
      [73, 'snow'],
      [75, 'snow'],
      [77, 'snow'],
      [85, 'snow'],
      [86, 'snow'],
      [95, 'storm'],
      [96, 'storm'],
      [99, 'storm'],
    ];
    for (const [code, sky] of cases) expect(skyFromWmo(code, null), String(code)).toBe(sky);
  });

  it('draws a dry, windy sky as wind, and never wind over rain or snow', () => {
    expect(skyFromWmo(0, 39.9)).toBe('clear');
    expect(skyFromWmo(0, 40)).toBe('wind');
    expect(skyFromWmo(2, 55)).toBe('wind');
    expect(skyFromWmo(3, 70)).toBe('wind');
    expect(skyFromWmo(63, 70)).toBe('rain');
    expect(skyFromWmo(75, 70)).toBe('snow');
    expect(skyFromWmo(95, 90)).toBe('storm');
    expect(skyFromWmo(45, 50)).toBe('fog');
    expect(skyFromWmo(0, Number.NaN)).toBe('clear');
  });

  it('falls back to partly cloudy for codes it does not know', () => {
    for (const code of [4, 30, 60, 100, -1, 1.5, Number.NaN]) expect(skyFromWmo(code, null)).toBe('partly');
  });

  it('only ever answers with one of the nine skies', () => {
    for (let code = -5; code < 120; code++) {
      expect(SKY_STATES).toContain(skyFromWmo(code, code));
    }
  });
});

type Call = { url: string; init?: RequestInit };

function fakeFetch(answer: (url: string) => Response): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    fetch: (async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      calls.push({ url, init });
      return answer(url);
    }) as typeof fetch,
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const signal = () => new AbortController().signal;

describe('the National Weather Service', () => {
  it('reads the first hour of the hourly forecast the point leads to', async () => {
    const { fetch, calls } = fakeFetch((url) =>
      url.includes('/points/') ? json(fixture('nws-points.json')) : json(fixture('nws-hourly.json')),
    );
    const reading = await nws.current(39.1, -94.58, fetch, signal());
    expect(calls.map((call) => call.url)).toEqual([
      'https://api.weather.gov/points/39.1,-94.58',
      'https://api.weather.gov/gridpoints/EAX/44,51/forecast/hourly',
    ]);
    expect(reading.state).toBe('partly');
    expect(reading.temperatureC).toBeCloseTo(((29 - 32) * 5) / 9);
    expect(reading.observedAt.toISOString()).toBe('2026-11-26T04:00:00.000Z');
    for (const call of calls) {
      const headers = call.init?.headers as Record<string, string>;
      expect(headers['User-Agent']).toBe(USER_AGENT);
      expect(call.init?.redirect).toBe('error');
    }
  });

  it('says "not ours" when the point is outside its area', async () => {
    const { fetch } = fakeFetch(() => json({ title: 'Data Unavailable For Requested Point' }, 404));
    await expect(nws.current(39.1, -94.58, fetch, signal())).rejects.toBeInstanceOf(NotCovered);
  });

  it('will not follow a forecast address that is not the service’s own', async () => {
    const { fetch, calls } = fakeFetch(() =>
      json({ properties: { forecastHourly: 'https://example.test/gridpoints/X/1,1/forecast/hourly' } }),
    );
    await expect(nws.current(39.1, -94.58, fetch, signal())).rejects.toThrow(/expected shape/);
    expect(calls).toHaveLength(1);
  });

  it('rejects answers of the wrong shape, not JSON, or too large', async () => {
    const shapes = [
      json({ properties: { periods: [] } }),
      json({ properties: { periods: [{ startTime: 'soon', icon: 'x' }] } }),
      new Response('<html>busy</html>', { status: 200 }),
      new Response('x'.repeat(MAX_RESPONSE_BYTES + 10), { status: 200 }),
    ];
    for (const answer of shapes) {
      const { fetch } = fakeFetch((url) =>
        url.includes('/points/') ? json(fixture('nws-points.json')) : answer,
      );
      await expect(nws.current(39.1, -94.58, fetch, signal())).rejects.toThrow();
    }
  });
});

describe('Open-Meteo', () => {
  it('reads the current conditions, in °C and km/h, at GMT', async () => {
    const { fetch, calls } = fakeFetch(() => json(fixture('open-meteo-current.json')));
    const reading = await openMeteo.current(39.1, -94.58, fetch, signal());
    expect(calls[0]!.url).toBe(
      'https://api.open-meteo.com/v1/forecast?latitude=39.1&longitude=-94.58&current=temperature_2m,weather_code,wind_speed_10m',
    );
    expect(reading).toEqual({
      state: 'clear',
      temperatureC: -3,
      observedAt: new Date('2026-11-26T05:00:00Z'),
    });
  });

  it('turns a windy dry hour into wind, and refuses other units', async () => {
    const windy = fixture('open-meteo-current.json') as { current: Record<string, unknown> };
    windy.current.wind_speed_10m = 52;
    const { fetch } = fakeFetch(() => json(windy));
    expect((await openMeteo.current(39.1, -94.58, fetch, signal())).state).toBe('wind');

    const fahrenheit = fixture('open-meteo-current.json') as { current_units: Record<string, unknown> };
    fahrenheit.current_units.temperature_2m = '°F';
    const second = fakeFetch(() => json(fahrenheit));
    await expect(openMeteo.current(39.1, -94.58, second.fetch, signal())).rejects.toThrow(/units/);
  });

  it('treats an error answer as a failure', async () => {
    const { fetch } = fakeFetch(() => json({ error: true, reason: 'bad' }, 400));
    await expect(openMeteo.current(39.1, -94.58, fetch, signal())).rejects.toThrow(/400/);
  });
});

describe('choosing a service', () => {
  it('sends at most two decimal places', () => {
    expect(coordinate(39.1)).toBe('39.1');
    expect(coordinate(39.123456)).toBe('39.12');
    expect(coordinate(-94.5849)).toBe('-94.58');
    expect(() => coordinate(Number.NaN)).toThrow();
  });

  it('knows roughly where the US is', () => {
    expect(inUsArea(39.1, -94.58)).toBe(true); // the test position
    expect(inUsArea(40.75, -73.99)).toBe(true); // ZIP 10001
    expect(inUsArea(21.3, -157.86)).toBe(true); // ZIP 96813
    expect(inUsArea(61.2, -149.9)).toBe(true); // Alaska
    expect(inUsArea(18.4, -66.1)).toBe(true); // Puerto Rico
    expect(inUsArea(0, 0)).toBe(false);
    expect(inUsArea(-33.9, 151.2)).toBe(false);
  });

  it('follows the switch', () => {
    expect(providerFor('off', 39.1, -94.58)).toBeNull();
    expect(providerFor('nws', 0, 0)?.name).toBe('nws');
    expect(providerFor('open-meteo', 39.1, -94.58)?.name).toBe('open-meteo');
    expect(providerFor('auto', 39.1, -94.58)?.name).toBe('nws+open-meteo');
    expect(providerFor('auto', 0, 0)?.name).toBe('open-meteo');
  });

  it('reads HOMEBASE_WEATHER, and treats anything it does not recognise as off', () => {
    expect(readConfig({}).weather).toBe('auto');
    expect(readConfig({ HOMEBASE_WEATHER: 'NWS' }).weather).toBe('nws');
    expect(readConfig({ HOMEBASE_WEATHER: 'open-meteo' }).weather).toBe('open-meteo');
    expect(readConfig({ HOMEBASE_WEATHER: 'off' }).weather).toBe('off');
    expect(readConfig({ HOMEBASE_WEATHER: 'of' }).weather).toBe('off');
  });
});
