import { and, eq, isNotNull, isNull, lt, ne, sql } from 'drizzle-orm';
import { addDays, startOfWeek, weekdayOf, type LocalDate } from '../../shared/time.js';
import {
  events,
  households,
  media,
  profiles,
  routineRuns,
  shoppingItems,
  taskOccurrences,
  weeklyTotals,
} from '../db/schema.js';
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

  // The missions and routine runs themselves go the same way: counted into the week they belonged to (so that
  // "how many of how many" still has its "of how many"), and then forgotten. A mission still waiting for a
  // grown-up's answer is kept however old it is.
  const settled = and(
    eq(taskOccurrences.householdId, ctx.household.id),
    lt(taskOccurrences.localDate, cutoff),
    ne(taskOccurrences.status, 'submitted'),
  );
  const oldMissions = await ctx.tx
    .select({
      localDate: taskOccurrences.localDate,
      profileId: taskOccurrences.profileId,
      offered: sql<number>`count(*)::int`,
      helped: sql<number>`count(*) filter (where ${taskOccurrences.helpAsked})::int`,
    })
    .from(taskOccurrences)
    .where(and(settled, isNotNull(taskOccurrences.profileId)))
    .groupBy(taskOccurrences.localDate, taskOccurrences.profileId);
  const oldRuns = await ctx.tx
    .select({
      localDate: routineRuns.localDate,
      profileId: routineRuns.profileId,
      started: sql<number>`count(*)::int`,
    })
    .from(routineRuns)
    .where(and(eq(routineRuns.householdId, ctx.household.id), lt(routineRuns.localDate, cutoff)))
    .groupBy(routineRuns.localDate, routineRuns.profileId);
  const counted = new Map<
    string,
    { weekStart: LocalDate; profileId: string; metric: string; value: number }
  >();
  const count = (date: LocalDate, profileId: string, metric: string, value: number) => {
    if (value <= 0) return;
    const week = startOfWeek(date, weekStart);
    const key = `${week}:${profileId}:${metric}`;
    const total = counted.get(key) ?? { weekStart: week, profileId, metric, value: 0 };
    total.value += value;
    counted.set(key, total);
  };
  for (const row of oldMissions) {
    if (!row.profileId) continue;
    count(row.localDate, row.profileId, 'mission.offered', Number(row.offered));
    count(row.localDate, row.profileId, 'mission.help', Number(row.helped));
  }
  for (const row of oldRuns) count(row.localDate, row.profileId, 'routine.started', Number(row.started));
  for (const total of counted.values()) {
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
  await ctx.tx.delete(taskOccurrences).where(settled);
  await ctx.tx
    .delete(routineRuns)
    .where(and(eq(routineRuns.householdId, ctx.household.id), lt(routineRuns.localDate, cutoff)));
  // Things bought or taken off the list long ago leave it for good.
  const longAgo = new Date(ctx.now.getTime() - detailDays * 24 * 60 * 60 * 1000);
  await ctx.tx
    .delete(shoppingItems)
    .where(
      and(
        eq(shoppingItems.householdId, ctx.household.id),
        sql`coalesce(${shoppingItems.archivedAt}, ${shoppingItems.deletedAt}) < ${longAgo.toISOString()}::timestamptz`,
      ),
    );

  // A photo that was begun and never arrived (a phone went out of signal half-way) is cleared away.
  const yesterday = new Date(ctx.now.getTime() - 24 * 60 * 60 * 1000);
  await ctx.tx
    .delete(media)
    .where(
      and(
        eq(media.householdId, ctx.household.id),
        sql`cardinality(${media.widths}) = 0`,
        lt(media.createdAt, yesterday),
      ),
    );

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
