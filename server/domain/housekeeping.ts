import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import { addDays, startOfWeek, weekdayOf, type LocalDate } from '../../shared/time.js';
import { events, households, profiles, shoppingItems, weeklyTotals } from '../db/schema.js';
import type { Ctx } from './context.js';
import { post, spendable } from './ledger.js';
import { ensureOccurrences } from './quest.js';

/**
 * The once-a-day chores of the house itself, done the first time anybody opens a screen on a new day.
 *
 * Nothing here depends on a scheduler waking up at midnight: a serverless host's timers are not to be relied on,
 * and a wall that was asleep overnight should find its morning ready whenever it wakes. Each chore is safe to
 * run again; the household's `housekept_on` says whether today's have been done.
 */

/** Weekly totals of the events that are about to be forgotten, so trends outlive the day-by-day record. */
const TOTALLED = [
  'mission.done',
  'mission.skipped',
  'mission.returned',
  'routine.completed',
  'routine.help',
  'reward.approved',
];

async function thinHistory(ctx: Ctx): Promise<void> {
  const { detailDays, trendMonths } = ctx.household.settings.history;
  const weekStart = ctx.household.settings.weekStart;
  // Only whole weeks are folded up, so a week is never half in one place and half in the other.
  const cutoff: LocalDate = startOfWeek(addDays(ctx.today, -detailDays), weekStart);
  const old = await ctx.tx
    .select({
      localDate: events.localDate,
      profileId: events.profileId,
      kind: events.kind,
      count: sql<number>`count(*)::int`,
    })
    .from(events)
    .where(and(eq(events.householdId, ctx.household.id), lt(events.localDate, cutoff)))
    .groupBy(events.localDate, events.profileId, events.kind);
  const totals = new Map<
    string,
    { weekStart: LocalDate; profileId: string; metric: string; value: number }
  >();
  for (const row of old) {
    if (!row.profileId || !TOTALLED.includes(row.kind)) continue;
    const week = startOfWeek(row.localDate, weekStart);
    const key = `${week}:${row.profileId}:${row.kind}`;
    const total = totals.get(key) ?? {
      weekStart: week,
      profileId: row.profileId,
      metric: row.kind,
      value: 0,
    };
    total.value += Number(row.count);
    totals.set(key, total);
  }
  for (const total of totals.values()) {
    await ctx.tx
      .insert(weeklyTotals)
      .values({ householdId: ctx.household.id, ...total })
      .onConflictDoUpdate({
        target: [
          weeklyTotals.householdId,
          weeklyTotals.weekStart,
          weeklyTotals.profileId,
          weeklyTotals.metric,
        ],
        set: { value: sql`${weeklyTotals.value} + ${total.value}` },
      });
  }
  if (old.length > 0) {
    await ctx.tx
      .delete(events)
      .where(and(eq(events.householdId, ctx.household.id), lt(events.localDate, cutoff)));
  }
  const oldest = addDays(ctx.today, -trendMonths * 31);
  await ctx.tx
    .delete(weeklyTotals)
    .where(and(eq(weeklyTotals.householdId, ctx.household.id), lt(weeklyTotals.weekStart, oldest)));
}

async function giveAllowance(ctx: Ctx): Promise<void> {
  const allowance = ctx.household.settings.bank.allowance;
  if (!allowance.enabled || allowance.stars <= 0 || weekdayOf(ctx.today) !== allowance.weekday) return;
  const children = await ctx.tx
    .select({ id: profiles.id })
    .from(profiles)
    .where(
      and(
        eq(profiles.householdId, ctx.household.id),
        eq(profiles.independent, true),
        isNull(profiles.archivedAt),
      ),
    );
  for (const child of children) {
    await post(ctx, {
      profileId: child.id,
      kind: 'grant',
      available: spendable(allowance.stars, ctx.household.settings.bank.spendRatePercent),
      lifetime: allowance.stars,
      source: 'allowance',
      // One for each child for each day it falls due — however many times this runs.
      key: `allowance:${child.id}:${ctx.today}`,
      note: 'Weekly stars',
      actor: 'auto',
    });
  }
}

async function tidyShopping(ctx: Ctx): Promise<void> {
  const boughtBefore = new Date(ctx.now.getTime() - 3 * 24 * 60 * 60 * 1000);
  await ctx.tx
    .update(shoppingItems)
    .set({ archivedAt: ctx.now })
    .where(
      and(
        eq(shoppingItems.householdId, ctx.household.id),
        isNull(shoppingItems.archivedAt),
        isNull(shoppingItems.deletedAt),
        sql`((${shoppingItems.status} = 'checked' and ${shoppingItems.checkedAt} < ${boughtBefore.toISOString()}::timestamptz)
          or (${shoppingItems.status} = 'declined' and ${shoppingItems.updatedAt} < ${boughtBefore.toISOString()}::timestamptz))`,
      ),
    );
}

/** Do today's chores if they have not been done. Returns whether anything was done. */
export async function keepHouse(ctx: Ctx): Promise<boolean> {
  if (ctx.household.housekeptOn === ctx.today) return false;
  await ensureOccurrences(ctx, ctx.today);
  await giveAllowance(ctx);
  await tidyShopping(ctx);
  await thinHistory(ctx);
  await ctx.tx.update(households).set({ housekeptOn: ctx.today }).where(eq(households.id, ctx.household.id));
  ctx.household.housekeptOn = ctx.today;
  return true;
}
