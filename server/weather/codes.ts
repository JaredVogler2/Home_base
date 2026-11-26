import type { SkyState } from '../../shared/model.js';

/**
 * Turning what a weather service says into one of the wall's nine skies.
 *
 * The wall does not need to know that it is "rain showers, 40 per cent, high cloud": it needs to know whether to
 * draw rain. So each service's codes are folded onto clear, partly, cloudy, fog, drizzle, rain, storm, snow and
 * wind, choosing for each the picture a child looking out of the window would agree with.
 *
 * When a code is one we do not know, the answer is "partly": a sky with some sun and some cloud. "Clear" would
 * promise sunshine we cannot vouch for, and anything wetter would draw weather that may not be there. A few
 * clouds is the calmest picture that is still not a lie.
 */

const UNKNOWN: SkyState = 'partly';

/**
 * Every icon code api.weather.gov lists at https://api.weather.gov/icons (34 of them, checked November 2026),
 * with the sky we draw for it.
 */
const NWS: Readonly<Record<string, SkyState>> = {
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
  // Anything with snow in it looks like snow from the window; sleet is small ice and is drawn the same way.
  snow: 'snow',
  rain_snow: 'snow',
  snow_sleet: 'snow',
  snow_fzra: 'snow',
  sleet: 'snow',
  blizzard: 'snow',
  // Freezing rain falls as rain and freezes when it lands.
  fzra: 'rain',
  rain_fzra: 'rain',
  rain_sleet: 'rain',
  rain: 'rain',
  rain_showers: 'rain',
  rain_showers_hi: 'rain',
  tsra: 'storm',
  tsra_sct: 'storm',
  tsra_hi: 'storm',
  tornado: 'storm',
  hurricane: 'storm',
  tropical_storm: 'storm',
  // Whatever hides the far side of the street.
  fog: 'fog',
  haze: 'fog',
  smoke: 'fog',
  dust: 'fog',
  // These two speak of the temperature, not the sky, so the sky is as unknown as an unknown code.
  hot: UNKNOWN,
  cold: UNKNOWN,
};

/**
 * The sky for an api.weather.gov forecast icon, such as
 * `https://api.weather.gov/icons/land/day/rain_showers,40/sct?size=medium`.
 *
 * After "day" or "night" come one or two codes, each perhaps with a chance of rain after a comma. When there are
 * two, the first is the nearer in time, and that is the one used.
 */
export function skyFromNwsIcon(icon: string): SkyState {
  const path = icon.split(/[?#]/)[0] ?? '';
  const parts = path.split('/').filter((part) => part !== '');
  const timeOfDay = parts.findIndex((part) => part === 'day' || part === 'night');
  const first = timeOfDay >= 0 ? parts[timeOfDay + 1] : parts[parts.length - 1];
  const code = (first ?? '').split(',')[0]?.toLowerCase() ?? '';
  return Object.hasOwn(NWS, code) ? (NWS[code] as SkyState) : UNKNOWN;
}

/** Wind at or above this, under a dry sky, is drawn as wind: roughly "branches moving, umbrellas hard to hold". */
export const WINDY_KPH = 40;

/**
 * The sky for a WMO weather interpretation code, as Open-Meteo returns it in `weather_code`, with the wind speed
 * at ten metres in km/h where it is known.
 */
export function skyFromWmo(code: number, windKph: number | null): SkyState {
  const sky = wmo(code);
  const dry = sky === 'clear' || sky === 'partly' || sky === 'cloudy';
  return dry && windKph !== null && Number.isFinite(windKph) && windKph >= WINDY_KPH ? 'wind' : sky;
}

function wmo(code: number): SkyState {
  if (!Number.isInteger(code)) return UNKNOWN;
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95 && code <= 99) return 'storm';
  return UNKNOWN;
}
