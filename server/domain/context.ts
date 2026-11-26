import { eq, sql } from 'drizzle-orm';
import type { AccessLevel } from '../../shared/model.js';
import type { Rejection } from '../../shared/ops.js';
import { readSettings, type HouseholdSettings } from '../../shared/settings.js';
import { coarse, localDateOf, type LocalDate } from '../../shared/time.js';
import { audit, events, households } from '../db/schema.js';
import type { Tx } from '../db/types.js';

/**
 * What every piece of household work is done with: the transaction (already confined to the household), the
 * household as it stands, who is asking, and what the time is. The time comes from here and nowhere else, so
 * that a test can make it any day it likes — the night the clocks change, say.
 */

export interface Actor {
  level: AccessLevel;
  /** For the record: "guardian:Sam", "wall:Kitchen", "auto", "shortcut:Sam's phone". */
  name: string;
  userId: string | null;
  deviceId: string | null;
}

export interface HouseholdState {
  id: string;
  name: string;
  timeZone: string;
  settings: HouseholdSettings;
  revision: number;
  demo: boolean;
  housekeptOn: LocalDate | null;
}

/** What the deployment allows, as far as household work needs to know. */
export interface Deploy {
  /** Hosts the Academy may be opened at, beyond its own public address. */
  academyHosts: readonly string[];
}

export interface Ctx {
  tx: Tx;
  household: HouseholdState;
  actor: Actor;
  now: Date;
  today: LocalDate;
  deploy: Deploy;
}

/** "No" as an answer rather than a fault: the request made sense and is turned down, with words for the screen. */
export class Reject extends Error {
  constructor(
    readonly reason: Rejection,
    message: string,
  ) {
    super(message);
    this.name = 'Reject';
  }
}

export const SYSTEM_ACTOR: Actor = { level: 'owner', name: 'system', userId: null, deviceId: null };
export const AUTO_ACTOR_NAME = 'auto';

function toState(row: typeof households.$inferSelect): HouseholdState {
  return {
    id: row.id,
    name: row.name,
    timeZone: row.timeZone,
    settings: readSettings(row.settings),
    revision: row.revision,
    demo: row.demo,
    housekeptOn: row.housekeptOn,
  };
}

/** Read the household without holding anything: for looking. */
export async function readHousehold(tx: Tx, householdId: string): Promise<HouseholdState | null> {
  const rows = await tx.select().from(households).where(eq(households.id, householdId)).limit(1);
  return rows[0] ? toState(rows[0]) : null;
}

/**
 * Read the household and hold its row until the transaction ends. Everything that changes a household does this
 * first, so two changes to one family never interleave: the second waits for the first, then sees what it did.
 * That is what makes "approve" tapped on two phones at once give the stars once.
 */
export async function lockHousehold(tx: Tx, householdId: string): Promise<HouseholdState | null> {
  const rows = await tx
    .select()
    .from(households)
    .where(eq(households.id, householdId))
    .limit(1)
    .for('update');
  return rows[0] ? toState(rows[0]) : null;
}

export function makeCtx(
  tx: Tx,
  household: HouseholdState,
  actor: Actor,
  now: Date,
  deploy: Deploy = { academyHosts: [] },
): Ctx {
  return { tx, household, actor, now, today: localDateOf(now, household.timeZone), deploy };
}

/** Tell every screen there is something new. */
export async function bumpRevision(ctx: Ctx): Promise<number> {
  const rows = await ctx.tx
    .update(households)
    .set({ revision: sql`${households.revision} + 1` })
    .where(eq(households.id, ctx.household.id))
    .returning({ revision: households.revision });
  const revision = rows[0]?.revision ?? ctx.household.revision + 1;
  ctx.household.revision = revision;
  return revision;
}

export interface EventInput {
  kind: string;
  profileId?: string | null;
  subjectId?: string | null;
  data?: Record<string, unknown>;
  /** The day it belongs to, when that is not today (a mission from yesterday approved this morning). */
  date?: LocalDate;
}

/**
 * Note that something happened, for the family's own look back — unless they have paused that. Times are kept
 * to the minute: enough to say "mornings", never enough to time a child.
 */
export async function record(ctx: Ctx, event: EventInput): Promise<void> {
  if (ctx.household.settings.history.paused) return;
  await ctx.tx.insert(events).values({
    id: crypto.randomUUID(),
    householdId: ctx.household.id,
    at: coarse(ctx.now),
    localDate: event.date ?? ctx.today,
    kind: event.kind,
    profileId: event.profileId ?? null,
    subjectId: event.subjectId ?? null,
    data: event.data ?? {},
    actor: ctx.actor.name,
  });
}

/** Note a change to the household's set-up or its security. Always kept; never paused. */
export async function auditLog(
  ctx: Ctx,
  action: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  await ctx.tx.insert(audit).values({
    id: crypto.randomUUID(),
    householdId: ctx.household.id,
    at: ctx.now,
    action,
    actor: ctx.actor.name,
    detail,
  });
}
