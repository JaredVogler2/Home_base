import type { SkyState } from '../../shared/model';
import { skyAt, skyByClock, type SkyNow } from '../../shared/sun';
import { zonedParts } from '../../shared/time';
import { mix, mix3 } from '../art/colour';

/**
 * What the sky over the house looks like right now: its colours, where the sun or the moon is, how many clouds.
 *
 * Everything is worked out from three facts — how light it is (from the sun's real height where the family
 * lives), what the weather is (when the family has switched that on), and the season — and handed to the
 * picture as plain values. Nothing here draws.
 */

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface SkyLook {
  now: SkyNow;
  weather: SkyState;
  season: Season;
  /** CSS custom properties for the scene. */
  vars: Record<string, string>;
  /** Sun or moon: where it is across the sky (0 left … 1 right) and how high (0 horizon … 1 top). */
  body: { kind: 'sun' | 'moon'; x: number; y: number } | null;
  /** 0 no cloud … 1 covered. */
  cloud: number;
  /** How strongly the lamps inside the house show (0 by day … 1 at night). */
  lamps: number;
}

const DAY = {
  top: '#a9daf5',
  low: '#f1faff',
  far: '#cfe9c6',
  near: '#a9dc98',
  lawnTop: '#9fd98a',
  lawnLow: '#6fbf68',
  pondA: '#9fe0e2',
  pondB: '#4fb3c2',
};
const NIGHT = {
  top: '#232a5c',
  low: '#4b4f8e',
  far: '#3a5670',
  near: '#2f5a5a',
  lawnTop: '#2f6b57',
  lawnLow: '#234f4a',
  pondA: '#4a6fa8',
  pondB: '#2c4780',
};
/** The colour low in the sky when the sun is on the horizon. */
const GLOW = '#ffc9a3';
const GREY = { top: '#b6c4d4', low: '#e3e9ee' };

export function seasonOf(month: number, latitude: number | null): Season {
  // Months are 1–12. South of the equator the seasons are the other way round.
  const northern: Season =
    month >= 3 && month <= 5
      ? 'spring'
      : month >= 6 && month <= 8
        ? 'summer'
        : month >= 9 && month <= 11
          ? 'autumn'
          : 'winter';
  if (latitude === null || latitude >= 0) return northern;
  return ({ spring: 'autumn', summer: 'winter', autumn: 'spring', winter: 'summer' } as const)[northern];
}

const CLOUD: Record<SkyState, number> = {
  clear: 0.12,
  partly: 0.4,
  cloudy: 0.85,
  fog: 0.7,
  drizzle: 0.8,
  rain: 0.95,
  storm: 1,
  snow: 0.9,
  wind: 0.35,
};

export interface SkyInput {
  /** The moment, by the server's clock. */
  ms: number;
  timeZone: string;
  location: { lat: number; lon: number } | null;
  /** False when the family has asked for a plain daytime sky. */
  daylight: boolean;
  weather: SkyState | null;
  decor: 'auto' | 'none' | Season;
}

export function lookOfSky(input: SkyInput): SkyLook {
  const parts = zonedParts(new Date(input.ms), input.timeZone);
  const now: SkyNow = !input.daylight
    ? { phase: 'day', light: 1, sunPath: 0.35, nightPath: null, moon: 0.5 }
    : input.location
      ? skyAt(input.ms, input.location.lat, input.location.lon)
      : skyByClock(parts.minutes, input.ms);
  const weather = input.weather ?? 'clear';
  const cloud = CLOUD[weather];
  const month = Number(parts.date.slice(5, 7));
  const season =
    input.decor === 'auto' || input.decor === 'none'
      ? seasonOf(month, input.location?.lat ?? null)
      : input.decor;

  const light = now.light;
  // Near sunrise and sunset the low sky warms; under cloud everything greys a little.
  const warm = now.phase === 'dawn' || now.phase === 'dusk' ? 1 - Math.abs(light - 0.5) * 2 : 0;
  const grey = cloud > 0.6 ? (cloud - 0.6) / 0.4 : 0;
  const top = mix(mix(NIGHT.top, DAY.top, light), GREY.top, grey * light * 0.75);
  const low = mix(mix3(NIGHT.low, mix(NIGHT.low, GLOW, 0.8), DAY.low, light), GREY.low, grey * light * 0.7);
  const lowWarm = mix(low, GLOW, warm * 0.55 * (1 - grey));

  const vars: Record<string, string> = {
    '--sky-top': top,
    '--sky-low': lowWarm,
    '--hill-far': mix(NIGHT.far, DAY.far, light),
    '--hill-near': mix(NIGHT.near, DAY.near, light),
    '--lawn-top': mix(NIGHT.lawnTop, DAY.lawnTop, light),
    '--lawn-low': mix(NIGHT.lawnLow, DAY.lawnLow, light),
    '--pond-a': mix(NIGHT.pondA, DAY.pondA, light),
    '--pond-b': mix(NIGHT.pondB, DAY.pondB, light),
    '--cloud': mix('#8f93c9', grey > 0.3 ? '#e6eaf0' : '#ffffff', light),
    '--window': mix('#39407a', '#cdeeff', light),
    '--lamps': String(Math.round((1 - light) * 100) / 100),
    '--stars': String(Math.round(Math.max(0, 1 - light * 1.6) * (1 - cloud * 0.8) * 100) / 100),
    '--dim': String(Math.round((1 - (1 - light) * 0.26) * 100) / 100),
  };

  let body: SkyLook['body'] = null;
  if (now.sunPath !== null) {
    body = { kind: 'sun', x: now.sunPath, y: Math.sin(now.sunPath * Math.PI) };
  } else if (now.nightPath !== null) {
    body = { kind: 'moon', x: now.nightPath, y: Math.sin(now.nightPath * Math.PI) };
  }
  return { now, weather, season, vars, body, cloud, lamps: 1 - light };
}
