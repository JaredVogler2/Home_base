import { and, eq } from 'drizzle-orm';
import { SKY_STATES, type SkyState, type Weather } from '../../shared/model.js';
import type { HouseholdSettings } from '../../shared/settings.js';
import { inHousehold } from '../db/client.js';
import { weatherCache } from '../db/schema.js';
import type { Tx } from '../db/types.js';
import type { Deps } from '../deps.js';
import { noteConnection, WEATHER_WORTH_NOTING } from '../domain/health.js';
import {
  AUTO_ACTOR_NAME,
  SYSTEM_ACTOR,
  bumpRevision,
  makeCtx,
  readHousehold,
  type Ctx,
} from '../domain/context.js';
import { REQUEST_TIMEOUT_MS, WeatherError, providerFor, type Reading } from './providers.js';

/**
 * The weather a household's screens show, and keeping it up to date.
 *
 * Screens never ask a weather service themselves, and building a snapshot never waits for one: the snapshot
 * carries whatever the cache row says (`readWeather`), and after a screen has had its answer the server checks,
 * in the background, whether it is time to ask again (`refreshWeatherIfDue`). However many screens a family has,
 * the service is asked about once every twenty minutes, and only while somebody's screen is on.
 *
 * Every screen downloads the whole snapshot again when the household's revision moves, so the revision is moved
 * only when what a screen would draw has changed: a different sky, a reading that has gone out of date, or a
 * temperature that has moved by a few degrees. A forecast that drifts by one degree changes nothing on the wall.
 */

const MINUTE = 60 * 1000;
/** How often a working service is asked. */
export const REFRESH_EVERY_MS = 20 * MINUTE;
/** A reading older than this is shown as "the last thing it said". */
export const STALE_AFTER_MS = 90 * MINUTE;
/** A reading older than this is not shown at all. */
export const FORGET_AFTER_MS = 6 * 60 * MINUTE;
/** The temperature has to move this far, in the household's units, for the screens to be told. */
export const NOTICEABLE_DEGREES = 3;

type CacheRow = typeof weatherCache.$inferSelect;
type Location = NonNullable<HouseholdSettings['location']>;
export type RefreshOutcome = 'fresh' | 'refreshed' | 'failed' | 'off';

/** A placeholder's reading time: so long ago that it is never shown. */
const NEVER = new Date(0);

/** Which place a cached reading is for: the rounded position, and nothing that names it. */
export function placeOf(location: Location): string {
  return `${location.lat.toFixed(2)},${location.lon.toFixed(2)}`;
}

/** After a failure, wait 5, 10, 20, 40… minutes before asking again, but never more than two hours. */
export function retryAfterMs(failures: number): number {
  if (failures <= 0) return REFRESH_EVERY_MS;
  return Math.min(5 * 2 ** Math.min(failures - 1, 10), 120) * MINUTE;
}

const isSkyState = (state: string): state is SkyState => (SKY_STATES as readonly string[]).includes(state);

function inUnits(celsius: number | null, units: 'us' | 'metric'): number | null {
  if (celsius === null) return null;
  return Math.round(units === 'us' ? (celsius * 9) / 5 + 32 : celsius);
}

/** What a screen would show from this row, at this moment. */
function viewOf(row: CacheRow | null, settings: HouseholdSettings, now: Date): Weather | null {
  if (!row || !settings.sky.weather || !settings.location) return null;
  if (row.place !== placeOf(settings.location) || !isSkyState(row.state)) return null;
  const age = now.getTime() - row.observedAt.getTime();
  if (age > FORGET_AFTER_MS) return null;
  return {
    state: row.state,
    temperature: inUnits(row.temperatureC, settings.sky.units),
    units: settings.sky.units,
    at: row.observedAt.toISOString(),
    stale: age > STALE_AFTER_MS,
  };
}

/** Whether a screen showing `before` would look different showing `after`. */
function looksDifferent(before: Weather | null, after: Weather | null): boolean {
  if (before === null || after === null) return before !== after;
  if (before.state !== after.state || before.stale !== after.stale || before.units !== after.units)
    return true;
  if (before.temperature === null || after.temperature === null)
    return before.temperature !== after.temperature;
  return Math.abs(before.temperature - after.temperature) >= NOTICEABLE_DEGREES;
}

async function cacheRow(tx: Tx, householdId: string): Promise<CacheRow | null> {
  const rows = await tx.select().from(weatherCache).where(eq(weatherCache.householdId, householdId)).limit(1);
  return rows[0] ?? null;
}

/** The weather for a snapshot, from the cache alone. Never reaches a weather service. */
export async function readWeather(ctx: Ctx): Promise<Weather | null> {
  const settings = ctx.household.settings;
  if (!settings.sky.weather || !settings.location) return null;
  return viewOf(await cacheRow(ctx.tx, ctx.household.id), settings, ctx.now);
}

/** Whether the household has asked for the weather at all: the cheap check made before anything else. */
export function wantsWeather(settings: HouseholdSettings): boolean {
  return settings.sky.weather && settings.location !== null;
}

function isDue(row: CacheRow, place: string, settings: HouseholdSettings, now: Date): boolean {
  if (row.place !== place) return true;
  if (now.getTime() - row.fetchedAt.getTime() >= retryAfterMs(row.failures)) return true;
  // The reading has crossed "out of date" or "too old to show" since it was last looked at: look again now,
  // so that the screens are told, rather than at the next regular time.
  return looksDifferent(viewOf(row, settings, row.fetchedAt), viewOf(row, settings, now));
}

type Claim =
  { kind: 'off' | 'fresh' } | { kind: 'claimed'; location: Location; place: string; before: Weather | null };

/**
 * Take the right to ask, so that two screens polling at the same moment cause one request. A new row is taken by
 * inserting it; an existing row by moving its `fetched_at` on, but only if nobody else has since we looked.
 */
async function claim(tx: Tx, householdId: string, now: Date): Promise<Claim> {
  const household = await readHousehold(tx, householdId);
  if (!household || !wantsWeather(household.settings)) return { kind: 'off' };
  const settings = household.settings;
  const location = settings.location!;
  const place = placeOf(location);
  const row = await cacheRow(tx, householdId);

  if (!row) {
    const inserted = await tx
      .insert(weatherCache)
      .values({
        householdId,
        place,
        state: 'partly',
        temperatureC: null,
        observedAt: NEVER,
        fetchedAt: now,
        failures: 0,
      })
      .onConflictDoNothing()
      .returning({ householdId: weatherCache.householdId });
    return inserted.length > 0 ? { kind: 'claimed', location, place, before: null } : { kind: 'fresh' };
  }

  if (!isDue(row, place, settings, now)) return { kind: 'fresh' };
  const moved = row.place !== place;
  const taken = await tx
    .update(weatherCache)
    .set(
      moved
        ? { place, state: 'partly', temperatureC: null, observedAt: NEVER, fetchedAt: now, failures: 0 }
        : { fetchedAt: now },
    )
    .where(
      and(
        eq(weatherCache.householdId, householdId),
        eq(weatherCache.place, row.place),
        eq(weatherCache.fetchedAt, row.fetchedAt),
      ),
    )
    .returning({ householdId: weatherCache.householdId });
  if (taken.length === 0) return { kind: 'fresh' };
  // What the screens were last shown: the row as it was, as of the last time anyone looked.
  return { kind: 'claimed', location, place, before: viewOf(row, settings, row.fetchedAt) };
}

function describe(error: unknown): string {
  if (error instanceof WeatherError) return error.message;
  if (error instanceof Error) return error.name;
  return 'unknown error';
}

/**
 * Ask the weather service, if it is time to — the only thing in HOMEBASE that does. Never throws: a service that
 * is down, slow or talking nonsense is noted (and asked again later, less often), and the screens carry on with
 * the last reading until it is too old to show.
 */
export async function refreshWeatherIfDue(deps: Deps, householdId: string): Promise<RefreshOutcome> {
  try {
    if (deps.config.offline || deps.config.weather === 'off') return 'off';
    const database = await deps.database();
    const claimed = await inHousehold(database, householdId, (tx) => claim(tx, householdId, deps.now()));
    if (claimed.kind !== 'claimed') return claimed.kind;

    const { location, place, before } = claimed;
    const provider = providerFor(deps.config.weather, location.lat, location.lon);
    if (!provider) return 'off';
    let reading: Reading | null = null;
    try {
      // Only the rounded position goes out. The label a grown-up typed never leaves this function.
      // Each request has its own limit; this one covers the two or three a fallback can take.
      const signal = AbortSignal.timeout(3 * REQUEST_TIMEOUT_MS);
      reading = await provider.current(location.lat, location.lon, deps.fetch, signal);
    } catch (error) {
      console.warn(`[weather] ${provider.name} could not be used: ${describe(error)}`);
    }

    return await inHousehold(database, householdId, async (tx) => {
      const household = await readHousehold(tx, householdId);
      const row = await cacheRow(tx, householdId);
      // Switched off, or moved, while we were asking: what came back is for nobody.
      if (!household || !row || row.place !== place) return 'fresh';
      const now = deps.now();
      let next: Partial<CacheRow> = { failures: row.failures + 1 };
      if (reading) {
        next = {
          state: reading.state,
          temperatureC: reading.temperatureC === null ? null : Math.round(reading.temperatureC),
          // A forecast hour can begin a little ahead; a reading is never newer than now.
          observedAt: new Date(Math.min(reading.observedAt.getTime(), now.getTime())),
          failures: 0,
        };
        // A degree or two of drift is not worth telling the screens about. Keep the temperature they are
        // showing, so that small drifts cannot add up unnoticed: the next comparison is with what they show.
        if (before && !looksDifferent(before, viewOf({ ...row, ...next }, household.settings, now))) {
          next.temperatureC = row.temperatureC;
        }
      }
      const [stored] = await tx
        .update(weatherCache)
        .set(next)
        .where(and(eq(weatherCache.householdId, householdId), eq(weatherCache.place, place)))
        .returning();
      // One line when a service has gone quiet for a while, and one when it comes back — not one for every try.
      if (!reading && row.failures + 1 === WEATHER_WORTH_NOTING) {
        await noteConnection(tx, householdId, now, 'weather.failed', AUTO_ACTOR_NAME, {
          service: provider.name,
        });
      } else if (reading && row.failures >= WEATHER_WORTH_NOTING) {
        await noteConnection(tx, householdId, now, 'weather.recovered', AUTO_ACTOR_NAME, {
          after: row.failures,
        });
      }
      const after = viewOf(stored ?? null, household.settings, now);
      if (looksDifferent(before, after)) {
        await bumpRevision(makeCtx(tx, household, { ...SYSTEM_ACTOR, name: AUTO_ACTOR_NAME }, now));
      }
      return reading ? 'refreshed' : 'failed';
    });
  } catch (error) {
    console.error(`[weather] refresh failed: ${describe(error)}`);
    return 'failed';
  }
}
