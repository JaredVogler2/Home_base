/**
 * The sun and the moon, worked out from where and when — no service asked, no signal needed.
 *
 * The house on the wall stands under the family's own sky: it gets light when it gets light outside the real
 * window, and the moon in it is tonight's moon. These are the standard low-precision formulas (the ones
 * almanacs publish for this purpose); they are good to a minute or two for the sun, which is far finer than a
 * picture needs.
 */

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const J1970 = 2440588;
const J2000 = 2451545;
const OBLIQUITY = RAD * 23.4397;

const toJulian = (ms: number): number => ms / DAY_MS - 0.5 + J1970;
const fromJulian = (j: number): number => (j + 0.5 - J1970) * DAY_MS;
const toDays = (ms: number): number => toJulian(ms) - J2000;

const solarMeanAnomaly = (d: number): number => RAD * (357.5291 + 0.98560028 * d);

function eclipticLongitude(M: number): number {
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const P = RAD * 102.9372;
  return M + C + P + Math.PI;
}

const declination = (L: number): number => Math.asin(Math.sin(L) * Math.sin(OBLIQUITY));

const J0 = 0.0009;
const julianCycle = (d: number, lw: number): number => Math.round(d - J0 - lw / (2 * Math.PI));
const approxTransit = (Ht: number, lw: number, n: number): number => J0 + (Ht + lw) / (2 * Math.PI) + n;
const solarTransitJ = (ds: number, M: number, L: number): number =>
  J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);

function hourAngle(h: number, phi: number, dec: number): number {
  return Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
}

export interface SunTimes {
  /** First light: the sun six degrees below the horizon, on its way up. */
  dawn: number | null;
  sunrise: number | null;
  noon: number;
  sunset: number | null;
  /** Last light. */
  dusk: number | null;
}

/**
 * The sun's day around `ms`, at a place. Times are epoch milliseconds. Near the poles the sun may not rise or
 * set on a given day: those times are then null.
 */
export function sunTimes(ms: number, lat: number, lon: number): SunTimes {
  const lw = RAD * -lon;
  const phi = RAD * lat;
  const d = toDays(ms);
  const n = julianCycle(d, lw);
  const ds = approxTransit(0, lw, n);
  const M = solarMeanAnomaly(ds);
  const L = eclipticLongitude(M);
  const dec = declination(L);
  const Jnoon = solarTransitJ(ds, M, L);

  const at = (altitudeDegrees: number): [number, number] | null => {
    const w = hourAngle(altitudeDegrees * RAD, phi, dec);
    if (Number.isNaN(w)) return null;
    const a = approxTransit(w, lw, n);
    const Jset = solarTransitJ(a, M, L);
    const Jrise = Jnoon - (Jset - Jnoon);
    return [fromJulian(Jrise), fromJulian(Jset)];
  };

  const horizon = at(-0.833);
  const civil = at(-6);
  return {
    dawn: civil ? civil[0] : null,
    sunrise: horizon ? horizon[0] : null,
    noon: fromJulian(Jnoon),
    sunset: horizon ? horizon[1] : null,
    dusk: civil ? civil[1] : null,
  };
}

/** How high the sun is, in degrees above the horizon (negative below it). */
export function sunAltitude(ms: number, lat: number, lon: number): number {
  const lw = RAD * -lon;
  const phi = RAD * lat;
  const d = toDays(ms);
  const M = solarMeanAnomaly(d);
  const L = eclipticLongitude(M);
  const dec = declination(L);
  const ra = Math.atan2(Math.sin(L) * Math.cos(OBLIQUITY), Math.cos(L));
  const sidereal = RAD * (280.16 + 360.9856235 * d) - lw;
  const H = sidereal - ra;
  return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)) / RAD;
}

/** A new moon that is well recorded, and the length of a month of the moon. */
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
const SYNODIC_DAYS = 29.530588853;

/** Where the moon is in its month: 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter. */
export function moonPhase(ms: number): number {
  const months = (ms - NEW_MOON) / (SYNODIC_DAYS * DAY_MS);
  return months - Math.floor(months);
}

export const SKY_PHASES = ['night', 'dawn', 'day', 'dusk'] as const;
export type SkyPhase = (typeof SKY_PHASES)[number];

export interface SkyNow {
  phase: SkyPhase;
  /**
   * How light it is, from 0 (deep night) to 1 (full day), changing smoothly through dawn and dusk so that the
   * picture never jumps.
   */
  light: number;
  /** Where the sun is on its way across: 0 at sunrise, 0.5 at its highest, 1 at sunset. Null at night. */
  sunPath: number | null;
  /** The same for the night: 0 at sunset, 1 at sunrise. Null by day. */
  nightPath: number | null;
  moon: number;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** The sky at a moment, at a place. */
export function skyAt(ms: number, lat: number, lon: number): SkyNow {
  const altitude = sunAltitude(ms, lat, lon);
  // Light follows the sun through twilight: none below −9°, full from +6°.
  const light = clamp01((altitude + 9) / 15);
  const today = sunTimes(ms, lat, lon);
  const moon = moonPhase(ms);
  const rising = ms < today.noon;

  if (today.sunrise !== null && today.sunset !== null && ms >= today.sunrise && ms <= today.sunset) {
    const sunPath = (ms - today.sunrise) / (today.sunset - today.sunrise);
    const phase: SkyPhase = altitude > 6 ? 'day' : rising ? 'dawn' : 'dusk';
    return { phase, light, sunPath, nightPath: null, moon };
  }
  // Night (or twilight): find the sunset before and the sunrise after.
  const other = sunTimes(ms + (rising ? -DAY_MS : DAY_MS), lat, lon);
  const sunset = rising ? other.sunset : today.sunset;
  const sunrise = rising ? today.sunrise : other.sunrise;
  const nightPath =
    sunset !== null && sunrise !== null && sunrise > sunset
      ? clamp01((ms - sunset) / (sunrise - sunset))
      : 0.5;
  const phase: SkyPhase = altitude > -6 ? (rising ? 'dawn' : 'dusk') : 'night';
  return { phase, light, sunPath: null, nightPath, moon };
}

/**
 * The sky for a household that has not said where it is: an ordinary day by the clock on the wall — light from
 * about half past six to half past seven in the evening.
 */
export function skyByClock(minutesOfDay: number, ms: number): SkyNow {
  const sunrise = 6.5 * 60;
  const sunset = 19.5 * 60;
  const twilight = 40;
  const moon = moonPhase(ms);
  if (minutesOfDay >= sunrise && minutesOfDay <= sunset) {
    const sunPath = (minutesOfDay - sunrise) / (sunset - sunrise);
    const fromEdge = Math.min(minutesOfDay - sunrise, sunset - minutesOfDay);
    const light = clamp01(0.6 + (0.4 * fromEdge) / twilight);
    const phase: SkyPhase = fromEdge >= twilight ? 'day' : minutesOfDay < 12 * 60 ? 'dawn' : 'dusk';
    return { phase, light, sunPath, nightPath: null, moon };
  }
  const sinceSunset = minutesOfDay > sunset ? minutesOfDay - sunset : minutesOfDay + 24 * 60 - sunset;
  const night = 24 * 60 - (sunset - sunrise);
  const toEdge = Math.min(sinceSunset, night - sinceSunset);
  const light = clamp01(0.6 - (0.6 * toEdge) / twilight);
  const phase: SkyPhase = toEdge >= twilight ? 'night' : sinceSunset < night / 2 ? 'dusk' : 'dawn';
  return { phase, light, sunPath: null, nightPath: sinceSunset / night, moon };
}
