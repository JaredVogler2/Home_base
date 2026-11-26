import { sql } from 'drizzle-orm';
import type { Executor } from '../db/types.js';

/**
 * Slowing down guessing. A serverless function has no memory between calls, so the counting is done in the
 * database: one row for each thing being limited in each window of time.
 */

export interface Limit {
  /** How many attempts in a window. */
  max: number;
  windowSeconds: number;
}

export const LIMITS = {
  /** Wrong passwords for one e-mail address. */
  signIn: { max: 8, windowSeconds: 15 * 60 },
  /** Sign-in attempts from one network address, whatever the e-mail. */
  signInAddress: { max: 40, windowSeconds: 15 * 60 },
  /** Wrong PINs on one wall for one grown-up. Ten thousand PINs at five per quarter hour is three weeks of trying. */
  pin: { max: 5, windowSeconds: 15 * 60 },
  /** Guesses at a pairing or invitation code from one address. */
  code: { max: 12, windowSeconds: 10 * 60 },
  /** New pairing codes from one address. */
  pairStart: { max: 30, windowSeconds: 10 * 60 },
  signUp: { max: 6, windowSeconds: 60 * 60 },
  /** Calls with one shortcut key. */
  shortcut: { max: 60, windowSeconds: 10 * 60 },
  /** Calls with a shortcut key that does not exist, from one address. */
  shortcutUnknown: { max: 10, windowSeconds: 10 * 60 },
  ai: { max: 20, windowSeconds: 10 * 60 },
  upload: { max: 60, windowSeconds: 10 * 60 },
} as const satisfies Record<string, Limit>;

export interface LimitState {
  allowed: boolean;
  /** Seconds until the window ends. */
  retryAfter: number;
  remaining: number;
}

function windowStart(now: Date, windowSeconds: number): Date {
  const ms = windowSeconds * 1000;
  return new Date(Math.floor(now.getTime() / ms) * ms);
}

/** Count one attempt and say whether it is within the limit. */
export async function attempt(db: Executor, key: string, limit: Limit, now: Date): Promise<LimitState> {
  const start = windowStart(now, limit.windowSeconds);
  const result = await db.execute(sql`
    insert into "homebase"."rate_limits" ("key", "window_start", "count")
    values (${key}, ${start.toISOString()}::timestamptz, 1)
    on conflict ("key", "window_start") do update set "count" = "homebase"."rate_limits"."count" + 1
    returning "count"`);
  const count = Number((result.rows[0] as { count: number | string }).count);
  const retryAfter = Math.max(
    1,
    Math.ceil((start.getTime() + limit.windowSeconds * 1000 - now.getTime()) / 1000),
  );
  return { allowed: count <= limit.max, retryAfter, remaining: Math.max(0, limit.max - count) };
}

/** Look without counting: is this key already over its limit? */
export async function check(db: Executor, key: string, limit: Limit, now: Date): Promise<LimitState> {
  const start = windowStart(now, limit.windowSeconds);
  const result = await db.execute(sql`
    select "count" from "homebase"."rate_limits"
    where "key" = ${key} and "window_start" = ${start.toISOString()}::timestamptz`);
  const count = Number((result.rows[0] as { count: number | string } | undefined)?.count ?? 0);
  const retryAfter = Math.max(
    1,
    Math.ceil((start.getTime() + limit.windowSeconds * 1000 - now.getTime()) / 1000),
  );
  return { allowed: count < limit.max, retryAfter, remaining: Math.max(0, limit.max - count) };
}

/** A success wipes the slate for that key (a right password forgives the wrong ones before it). */
export async function forgive(db: Executor, key: string): Promise<void> {
  await db.execute(sql`delete from "homebase"."rate_limits" where "key" = ${key}`);
}

/** Old windows are of no use to anyone. */
export async function sweepRateLimits(db: Executor, now: Date): Promise<void> {
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  await db.execute(
    sql`delete from "homebase"."rate_limits" where "window_start" < ${cutoff.toISOString()}::timestamptz`,
  );
}
