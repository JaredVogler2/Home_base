import * as v from 'valibot';
import type { SkyState } from '../../shared/model.js';
import type { WeatherMode } from '../config.js';
import { skyFromNwsIcon, skyFromWmo } from './codes.js';

/**
 * The weather services HOMEBASE can ask, and how to ask them.
 *
 *   nws         the US National Weather Service (api.weather.gov). Free, no key, US places only.
 *   open-meteo  Open-Meteo (api.open-meteo.com). Free for non-commercial use, no key, anywhere.
 *
 * All either is ever sent is a position rounded to two decimal places (about a kilometre) — never the place's
 * name, never the family's, never anything else. Nothing a service says back is trusted: each answer must be
 * small, must be JSON, and must have the shape we expect, or it is thrown away.
 */

export interface Reading {
  state: SkyState;
  temperatureC: number | null;
  /** When the service made this reading, or when the forecast hour it describes began. */
  observedAt: Date;
}

export interface WeatherProvider {
  name: string;
  current(lat: number, lon: number, fetch: typeof globalThis.fetch, signal: AbortSignal): Promise<Reading>;
}

/** NWS asks every caller to say which application it is. This says only that, and nothing about anybody. */
export const USER_AGENT = 'HOMEBASE family wall display';

/** No single request may take longer than this. */
export const REQUEST_TIMEOUT_MS = 4_000;

/** An hourly forecast for a week is about 160 KB; anything much larger than that is not what we asked for. */
export const MAX_RESPONSE_BYTES = 1_000_000;

/** The service did not answer as it should; the reason is for the log, and never contains a coordinate. */
export class WeatherError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = 'WeatherError';
  }
}

/** A coordinate as it is sent: at most two decimal places, whatever it was given. */
export function coordinate(value: number): string {
  if (!Number.isFinite(value)) throw new WeatherError('not a coordinate');
  return String(Math.round(value * 100) / 100);
}

async function getJson(
  url: string,
  fetch: typeof globalThis.fetch,
  signal: AbortSignal,
  headers: Record<string, string>,
): Promise<unknown> {
  const response = await fetch(url, {
    method: 'GET',
    headers,
    // A redirect would be a request to somewhere we did not choose.
    redirect: 'error',
    signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
  });
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new WeatherError(`answered ${response.status}`, response.status);
  }
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    throw new WeatherError('answer too large');
  }
  const text = await readCapped(response, MAX_RESPONSE_BYTES);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new WeatherError('answer was not JSON');
  }
}

/** Read a body, giving up as soon as it is larger than it has any reason to be. */
async function readCapped(response: Response, max: number): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => undefined);
      throw new WeatherError('answer too large');
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(all);
}

function parse<S extends v.GenericSchema>(schema: S, data: unknown, what: string): v.InferOutput<S> {
  const result = v.safeParse(schema, data);
  if (!result.success) throw new WeatherError(`${what} was not in the expected shape`);
  return result.output;
}

function instant(text: string, what: string): Date {
  const at = new Date(text);
  if (Number.isNaN(at.getTime())) throw new WeatherError(`${what} had no usable time`);
  return at;
}

const plausibleC = (c: number): number | null => (Number.isFinite(c) && c > -90 && c < 60 ? c : null);

// --- National Weather Service -------------------------------------------------------------------------------

const NWS_ORIGIN = 'https://api.weather.gov';
const NWS_HEADERS = { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' };

const NwsPoint = v.object({
  properties: v.object({
    // The forecast is fetched from the address the service gives, so that address must be the service's own.
    forecastHourly: v.pipe(v.string(), v.startsWith(`${NWS_ORIGIN}/gridpoints/`), v.maxLength(200)),
  }),
});

const NwsHourly = v.object({
  properties: v.object({
    periods: v.pipe(
      v.array(
        v.object({
          startTime: v.pipe(v.string(), v.maxLength(40)),
          temperature: v.nullish(v.unknown()),
          temperatureUnit: v.nullish(v.string()),
          icon: v.pipe(v.string(), v.maxLength(300)),
        }),
      ),
      v.minLength(1),
    ),
  }),
});

/** "This place is not one we forecast for" — the NWS answer for anywhere outside the US. */
export class NotCovered extends WeatherError {
  constructor() {
    super('not covered by this service', 404);
    this.name = 'NotCovered';
  }
}

export const nws: WeatherProvider = {
  name: 'nws',
  async current(lat, lon, fetch, signal) {
    let point: v.InferOutput<typeof NwsPoint>;
    try {
      point = parse(
        NwsPoint,
        await getJson(
          `${NWS_ORIGIN}/points/${coordinate(lat)},${coordinate(lon)}`,
          fetch,
          signal,
          NWS_HEADERS,
        ),
        'the NWS point',
      );
    } catch (error) {
      if (error instanceof WeatherError && error.status === 404) throw new NotCovered();
      throw error;
    }
    const hourly = parse(
      NwsHourly,
      await getJson(point.properties.forecastHourly, fetch, signal, NWS_HEADERS),
      'the NWS hourly forecast',
    );
    const period = hourly.properties.periods[0]!;
    let temperatureC: number | null = null;
    if (typeof period.temperature === 'number') {
      const unit = (period.temperatureUnit ?? 'F').toUpperCase();
      if (unit === 'F') temperatureC = plausibleC(((period.temperature - 32) * 5) / 9);
      else if (unit === 'C') temperatureC = plausibleC(period.temperature);
    }
    return {
      state: skyFromNwsIcon(period.icon),
      temperatureC,
      observedAt: instant(period.startTime, 'the NWS forecast'),
    };
  },
};

// --- Open-Meteo ---------------------------------------------------------------------------------------------

const OpenMeteoCurrent = v.object({
  utc_offset_seconds: v.optional(v.number(), 0),
  current: v.object({
    time: v.pipe(v.string(), v.maxLength(40)),
    temperature_2m: v.nullish(v.number()),
    weather_code: v.number(),
    wind_speed_10m: v.nullish(v.number()),
  }),
  current_units: v.optional(
    v.object({
      temperature_2m: v.optional(v.string()),
      wind_speed_10m: v.optional(v.string()),
    }),
  ),
});

export const openMeteo: WeatherProvider = {
  name: 'open-meteo',
  async current(lat, lon, fetch, signal) {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${coordinate(lat)}&longitude=${coordinate(lon)}` +
      '&current=temperature_2m,weather_code,wind_speed_10m';
    const data = parse(OpenMeteoCurrent, await getJson(url, fetch, signal, {}), 'the Open-Meteo answer');
    const units = data.current_units;
    // Asked with no units chosen, the answer is in °C and km/h; anything else is not what we asked for.
    if (units?.temperature_2m !== undefined && units.temperature_2m !== '°C')
      throw new WeatherError('Open-Meteo answered in other units');
    const windKph =
      units?.wind_speed_10m === undefined || units.wind_speed_10m === 'km/h'
        ? (data.current.wind_speed_10m ?? null)
        : null;
    // The time is local to the zone asked for (none: GMT) and written without an offset.
    const local = /^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d)?$/.test(data.current.time)
      ? instant(`${data.current.time}Z`, 'the Open-Meteo answer')
      : instant(data.current.time, 'the Open-Meteo answer');
    return {
      state: skyFromWmo(data.current.weather_code, windKph),
      temperatureC:
        data.current.temperature_2m === null || data.current.temperature_2m === undefined
          ? null
          : plausibleC(data.current.temperature_2m),
      observedAt: new Date(local.getTime() - data.utc_offset_seconds * 1000),
    };
  },
};

// --- Choosing ----------------------------------------------------------------------------------------------

/**
 * Roughly where the National Weather Service forecasts: the lower 48, Alaska (including the Aleutians across
 * the date line), Hawaii, Puerto Rico and the US Virgin Islands. Rough on purpose — a place just outside is
 * answered "not ours" and asked of Open-Meteo instead.
 */
export function inUsArea(lat: number, lon: number): boolean {
  const box = (south: number, north: number, west: number, east: number) =>
    lat >= south && lat <= north && lon >= west && lon <= east;
  return (
    box(24, 50, -125, -66) || // the lower 48
    box(51, 72, -180, -129) || // Alaska
    box(51, 55, 172, 180) || // the far Aleutians
    box(18.5, 22.5, -161, -154) || // Hawaii
    box(17.5, 18.7, -68, -64.5) // Puerto Rico and the Virgin Islands
  );
}

/** Ask the first; if it cannot help (not our place, or not answering), ask the second. */
function firstThen(first: WeatherProvider, second: WeatherProvider): WeatherProvider {
  return {
    name: `${first.name}+${second.name}`,
    async current(lat, lon, fetch, signal) {
      try {
        return await first.current(lat, lon, fetch, signal);
      } catch (error) {
        if (signal.aborted) throw error;
        return second.current(lat, lon, fetch, signal);
      }
    },
  };
}

/** Which service to ask for this place, or null when the deployment has the weather off. */
export function providerFor(mode: WeatherMode, lat: number, lon: number): WeatherProvider | null {
  switch (mode) {
    case 'off':
      return null;
    case 'nws':
      return nws;
    case 'open-meteo':
      return openMeteo;
    case 'auto':
      return inUsArea(lat, lon) ? firstThen(nws, openMeteo) : openMeteo;
  }
}
