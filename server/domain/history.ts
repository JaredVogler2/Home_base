import { and, asc, desc, eq, gte, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import { addDays, daysBetween, startOfWeek, zonedParts, type LocalDate } from '../../shared/time.js';
import {
  events,
  redemptions,
  routineRuns,
  routineStepEvents,
  routines,
  routineVersions,
  taskOccurrences,
  taskTemplates,
  taskTemplateVersions,
  weeklyTotals,
} from '../db/schema.js';
import type { Ctx } from './context.js';

/**
 * Looking back, for the grown-ups: what was handed out and what was done, week by week.
 *
 * Every number here comes with what it is out of, and with where it came from: the day-by-day record (kept for
 * a few months), the weekly totals kept after that, or nothing at all. Children are only ever set beside their
 * own earlier weeks, never beside each other. There are no scores and no judgements in it — only counts of
 * things a family already knew had happened. The one place minutes appear is a routine's own: where the morning
 * tends to wait, for whoever is planning it. Those are about the routine, all its goes together, never about a
 * child.
 */

export interface WeekCell {
  /** Missions handed out to this child that week. */
  offered: number;
  done: number;
  skipped: number;
  returned: number;
  /** Missions the child asked for a hand with. */
  helped: number;
  routinesStarted: number;
  routinesCompleted: number;
  /** Times a hand was asked for during a routine. */
  routineHelp: number;
  /** Stars to spend that came in, and went out on rewards. */
  earned: number;
  spent: number;
  /** Where the counts came from: day-by-day records, weekly totals only, or nothing kept for that week. */
  basis: 'detail' | 'totals' | 'none';
}

export interface HistorySummary {
  weeks: { start: LocalDate; end: LocalDate; current: boolean }[];
  /** One row for each child, cells in the same order as `weeks`. `profileId` null is the family's shared missions. */
  children: { profileId: string | null; cells: WeekCell[] }[];
  /** When in the day missions were finished, over the last four weeks. */
  timeOfDay: { profileId: string; morning: number; afternoon: number; evening: number }[];
  /** Missions a hand was asked for most, over the last four weeks, with how often they were handed out. */
  help: { templateId: string; title: string; picture: string; asked: number; offered: number }[];
  /** Each routine over the last four weeks. */
  routines: {
    routineId: string;
    title: string;
    picture: string;
    started: number;
    completed: number;
    stepsAlone: number;
    stepsTogether: number;
    stepsSkipped: number;
    helpAsked: number;
    /** When in the day its last step was ticked, for the goes that were finished. */
    morning: number;
    afternoon: number;
    evening: number;
    timing: RoutineTiming;
  }[];
  rewards: { asked: number; approved: number; fulfilled: number; declined: number; refunded: number };
  shopping: {
    bought: number;
    staples: { text: string; times: number; lastBought: LocalDate; daysSince: number }[];
  };
  /** History is switched off: nothing new is being recorded. */
  paused: boolean;
  detailDays: number;
  trendMonths: number;
}

export const HISTORY_WEEKS = { default: 8, max: 26 } as const;

/** Fewest goes before anything is said about how long a routine takes: two mornings are not a habit. */
export const MIN_TIMED_RUNS = 3;
/** A go that took longer than this was set aside and come back to; its minutes say nothing about the routine. */
export const ONE_SITTING_MINUTES = 120;
/** A gap shorter than this is not worth pointing at. */
const WORTH_SAYING_MINUTES = 2;

/** One finished go at a routine, as far as timing it needs. */
export interface TimedRun {
  startedAt: Date;
  /** The steps as they were for this go, in their order. */
  steps: { id: string; title: string; picture: string }[];
  /** Every answer a step was given, to the minute. A step left out moves the clock on but is not timed itself. */
  ticks: { stepId: string; at: Date; leftOut: boolean }[];
}

export interface RoutineTiming {
  /** Whole minutes from the first tap to the last, in the middle go. Null when too few goes can be timed. */
  usualMinutes: number | null;
  /** How many goes that was worked out from. */
  timed: number;
  /** Goes left out because they were set aside and finished much later. */
  setAside: number;
  /** The step that usually has the longest wait before its tick, when one stands out. */
  longest: { title: string; picture: string; usualMinutes: number; of: number } | null;
}

const middle = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const half = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[half]! : (sorted[half - 1]! + sorted[half]!) / 2;
};

/**
 * Where a routine tends to wait: the usual minutes from first tap to last, and the step with the longest usual
 * gap before its tick.
 *
 * These are minutes between taps on a screen, to the nearest minute — a child who does everything and then ticks
 * it all at once looks instant. So it is offered as something noticed, with how many goes it is out of, and with
 * the middle value rather than the average, so that one slow Tuesday does not colour a month.
 */
export function routineTiming(runs: readonly TimedRun[]): RoutineTiming {
  const lengths: number[] = [];
  const gaps = new Map<string, { title: string; picture: string; order: number; minutes: number[] }>();
  let setAside = 0;
  for (const run of runs) {
    if (run.ticks.length === 0) continue;
    const place = new Map(run.steps.map((step, index) => [step.id, index]));
    // Times are kept to the minute, so several ticks often share one: the routine's own order settles it.
    const ticks = [...run.ticks].sort(
      (a, b) => a.at.getTime() - b.at.getTime() || (place.get(a.stepId) ?? 0) - (place.get(b.stepId) ?? 0),
    );
    const started = run.startedAt.getTime();
    const whole = Math.round((ticks[ticks.length - 1]!.at.getTime() - started) / 60_000);
    if (whole > ONE_SITTING_MINUTES) {
      setAside += 1;
      continue;
    }
    lengths.push(Math.max(0, whole));
    let previous = started;
    for (const tick of ticks) {
      const at = tick.at.getTime();
      const index = place.get(tick.stepId);
      const step = index === undefined ? undefined : run.steps[index];
      if (step && index !== undefined && !tick.leftOut) {
        const entry = gaps.get(step.id) ?? {
          title: step.title,
          picture: step.picture,
          order: index,
          minutes: [],
        };
        // The step's words as they were on the latest go that had it.
        entry.title = step.title;
        entry.picture = step.picture;
        entry.order = index;
        entry.minutes.push(Math.max(0, Math.round((at - previous) / 60_000)));
        gaps.set(step.id, entry);
      }
      previous = Math.max(previous, at);
    }
  }
  if (lengths.length < MIN_TIMED_RUNS) {
    return { usualMinutes: null, timed: lengths.length, setAside, longest: null };
  }
  let longest: RoutineTiming['longest'] = null;
  let longestOrder = Infinity;
  for (const entry of gaps.values()) {
    if (entry.minutes.length < MIN_TIMED_RUNS) continue;
    const usual = Math.round(middle(entry.minutes));
    if (usual < WORTH_SAYING_MINUTES) continue;
    if (
      !longest ||
      usual > longest.usualMinutes ||
      (usual === longest.usualMinutes && entry.order < longestOrder)
    ) {
      longest = { title: entry.title, picture: entry.picture, usualMinutes: usual, of: entry.minutes.length };
      longestOrder = entry.order;
    }
  }
  return { usualMinutes: Math.round(middle(lengths)), timed: lengths.length, setAside, longest };
}

const emptyCell = (): WeekCell => ({
  offered: 0,
  done: 0,
  skipped: 0,
  returned: 0,
  helped: 0,
  routinesStarted: 0,
  routinesCompleted: 0,
  routineHelp: 0,
  earned: 0,
  spent: 0,
  basis: 'none',
});

export async function historySummary(ctx: Ctx, weekCount: number): Promise<HistorySummary> {
  const { weekStart, history } = ctx.household.settings;
  const count = Math.min(HISTORY_WEEKS.max, Math.max(1, Math.floor(weekCount)));
  const thisWeek = startOfWeek(ctx.today, weekStart);
  const first = addDays(thisWeek, -7 * (count - 1));
  const weeks = Array.from({ length: count }, (_, index) => {
    const start = addDays(first, index * 7);
    return { start, end: addDays(start, 6), current: start === thisWeek };
  });
  const indexOf = (date: LocalDate): number => Math.floor(daysBetween(first, date) / 7);
  // Day-by-day records older than this have been folded into weekly totals (see housekeeping).
  const detailFrom = startOfWeek(addDays(ctx.today, -history.detailDays), weekStart);
  const recentFrom = addDays(ctx.today, -27);

  const rows = new Map<string, WeekCell[]>();
  const cellsOf = (profileId: string | null): WeekCell[] => {
    const key = profileId ?? '';
    let cells = rows.get(key);
    if (!cells) {
      cells = weeks.map(emptyCell);
      rows.set(key, cells);
    }
    return cells;
  };
  const cell = (profileId: string | null, date: LocalDate): WeekCell | null => {
    const index = indexOf(date);
    return index >= 0 && index < count ? (cellsOf(profileId)[index] ?? null) : null;
  };

  // --- missions, from the missions themselves -----------------------------------------------------------------------
  const occurrences = await ctx.tx
    .select({
      profileId: taskOccurrences.profileId,
      localDate: taskOccurrences.localDate,
      status: taskOccurrences.status,
      total: sql<number>`count(*)::int`,
      helped: sql<number>`count(*) filter (where ${taskOccurrences.helpAsked})::int`,
    })
    .from(taskOccurrences)
    .where(and(eq(taskOccurrences.householdId, ctx.household.id), gte(taskOccurrences.localDate, first)))
    .groupBy(taskOccurrences.profileId, taskOccurrences.localDate, taskOccurrences.status);
  for (const row of occurrences) {
    const target = cell(row.profileId, row.localDate);
    if (!target) continue;
    target.basis = 'detail';
    target.offered += Number(row.total);
    target.helped += Number(row.helped);
    if (row.status === 'approved') target.done += Number(row.total);
    else if (row.status === 'skipped') target.skipped += Number(row.total);
    else if (row.status === 'returned') target.returned += Number(row.total);
  }

  // --- routines -----------------------------------------------------------------------------------------------------
  const runs = await ctx.tx
    .select({
      profileId: routineRuns.profileId,
      localDate: routineRuns.localDate,
      status: routineRuns.status,
      total: sql<number>`count(*)::int`,
    })
    .from(routineRuns)
    .where(and(eq(routineRuns.householdId, ctx.household.id), gte(routineRuns.localDate, first)))
    .groupBy(routineRuns.profileId, routineRuns.localDate, routineRuns.status);
  for (const row of runs) {
    const target = cell(row.profileId, row.localDate);
    if (!target) continue;
    target.basis = 'detail';
    target.routinesStarted += Number(row.total);
    if (row.status === 'completed') target.routinesCompleted += Number(row.total);
  }
  const helpEvents = await ctx.tx
    .select({
      profileId: events.profileId,
      localDate: events.localDate,
      total: sql<number>`count(*)::int`,
    })
    .from(events)
    .where(
      and(
        eq(events.householdId, ctx.household.id),
        eq(events.kind, 'routine.help'),
        gte(events.localDate, first),
      ),
    )
    .groupBy(events.profileId, events.localDate);
  for (const row of helpEvents) {
    const target = row.profileId ? cell(row.profileId, row.localDate) : null;
    if (target) target.routineHelp += Number(row.total);
  }

  // --- older weeks, from the weekly totals ---------------------------------------------------------------------------
  const totals = await ctx.tx
    .select()
    .from(weeklyTotals)
    .where(and(eq(weeklyTotals.householdId, ctx.household.id), gte(weeklyTotals.weekStart, first)));
  for (const row of totals) {
    const index = indexOf(row.weekStart);
    if (index < 0 || index >= count || row.weekStart >= detailFrom) continue;
    const target = cellsOf(row.profileId)[index];
    if (!target || target.basis === 'detail') continue;
    target.basis = 'totals';
    if (row.metric === 'mission.offered') target.offered += row.value;
    else if (row.metric === 'mission.done') target.done += row.value;
    else if (row.metric === 'mission.skipped') target.skipped += row.value;
    else if (row.metric === 'mission.returned') target.returned += row.value;
    else if (row.metric === 'mission.help') target.helped += row.value;
    else if (row.metric === 'routine.started') target.routinesStarted += row.value;
    else if (row.metric === 'routine.completed') target.routinesCompleted += row.value;
    else if (row.metric === 'routine.help') target.routineHelp += row.value;
  }

  // --- stars in and out: the ledger is kept whole, so this is exact for every week --------------------------------------
  const zone = ctx.household.timeZone;
  // The day is worked out once, inside, so that the grouping and the answer are plainly the same thing.
  const starResult = await ctx.tx.execute(sql`
    select "profile_id" as "profileId",
           to_char("day", 'YYYY-MM-DD') as "localDate",
           coalesce(sum("available") filter (where "kind" in ('grant', 'correction')), 0)::int as "earned",
           coalesce(sum(-"reserved") filter (where "kind" = 'spend'), 0)::int as "spent",
           coalesce(sum("available") filter (where "kind" = 'refund'), 0)::int as "refunded"
      from (select "profile_id", "kind", "available", "reserved",
                   ("at" at time zone ${zone})::date as "day"
              from "homebase"."ledger"
             where "household_id" = ${ctx.household.id}) as "lines"
     where "day" >= ${first}::date
     group by "profile_id", "day"`);
  const stars = (
    starResult as unknown as {
      rows: { profileId: string; localDate: string; earned: number; spent: number; refunded: number }[];
    }
  ).rows;
  for (const row of stars) {
    const target = cell(row.profileId, row.localDate);
    if (!target) continue;
    target.earned += Number(row.earned);
    target.spent += Number(row.spent) - Number(row.refunded);
    if (target.basis === 'none') target.basis = 'totals';
  }

  // --- the last four weeks, in a little more detail -------------------------------------------------------------------
  const doneEvents = await ctx.tx
    .select({ profileId: events.profileId, at: events.at })
    .from(events)
    .where(
      and(
        eq(events.householdId, ctx.household.id),
        eq(events.kind, 'mission.done'),
        gte(events.localDate, recentFrom),
        isNotNull(events.profileId),
      ),
    )
    .limit(5000);
  const times = new Map<string, { morning: number; afternoon: number; evening: number }>();
  for (const row of doneEvents) {
    if (!row.profileId) continue;
    const minutes = zonedParts(row.at, zone).minutes;
    const bucket = times.get(row.profileId) ?? { morning: 0, afternoon: 0, evening: 0 };
    if (minutes < 12 * 60) bucket.morning += 1;
    else if (minutes < 17 * 60) bucket.afternoon += 1;
    else bucket.evening += 1;
    times.set(row.profileId, bucket);
  }

  const helpByTemplate = await ctx.tx
    .select({
      templateId: taskOccurrences.templateId,
      offered: sql<number>`count(*)::int`,
      asked: sql<number>`count(*) filter (where ${taskOccurrences.helpAsked})::int`,
    })
    .from(taskOccurrences)
    .where(and(eq(taskOccurrences.householdId, ctx.household.id), gte(taskOccurrences.localDate, recentFrom)))
    .groupBy(taskOccurrences.templateId)
    .having(sql`count(*) filter (where ${taskOccurrences.helpAsked}) > 0`)
    .orderBy(desc(sql`count(*) filter (where ${taskOccurrences.helpAsked})`))
    .limit(5);
  const helpIds = helpByTemplate.map((row) => row.templateId);
  const titles =
    helpIds.length === 0
      ? []
      : await ctx.tx
          .select({
            id: taskTemplates.id,
            title: taskTemplateVersions.title,
            picture: taskTemplateVersions.picture,
          })
          .from(taskTemplates)
          .innerJoin(
            taskTemplateVersions,
            and(
              eq(taskTemplateVersions.templateId, taskTemplates.id),
              eq(taskTemplateVersions.version, taskTemplates.version),
            ),
          )
          .where(and(eq(taskTemplates.householdId, ctx.household.id), inArray(taskTemplates.id, helpIds)));

  const routineRows = await ctx.tx
    .select({
      routineId: routineRuns.routineId,
      started: sql<number>`count(distinct ${routineRuns.id})::int`,
      completed: sql<number>`count(distinct ${routineRuns.id}) filter (where ${routineRuns.status} = 'completed')::int`,
      alone: sql<number>`count(${routineStepEvents.stepId}) filter (where ${routineStepEvents.kind} = 'done')::int`,
      together: sql<number>`count(${routineStepEvents.stepId}) filter (where ${routineStepEvents.kind} = 'together')::int`,
      skipped: sql<number>`count(${routineStepEvents.stepId}) filter (where ${routineStepEvents.kind} = 'skipped')::int`,
      help: sql<number>`count(${routineStepEvents.stepId}) filter (where ${routineStepEvents.kind} = 'help')::int`,
    })
    .from(routineRuns)
    .leftJoin(routineStepEvents, eq(routineStepEvents.runId, routineRuns.id))
    .where(and(eq(routineRuns.householdId, ctx.household.id), gte(routineRuns.localDate, recentFrom)))
    .groupBy(routineRuns.routineId);
  const routineIds = routineRows.map((row) => row.routineId);
  const routineNames =
    routineIds.length === 0
      ? []
      : await ctx.tx
          .select({ id: routines.id, title: routineVersions.title, picture: routineVersions.picture })
          .from(routines)
          .innerJoin(
            routineVersions,
            and(eq(routineVersions.routineId, routines.id), eq(routineVersions.version, routines.version)),
          )
          .where(and(eq(routines.householdId, ctx.household.id), inArray(routines.id, routineIds)))
          .orderBy(asc(routines.sort));

  // When each routine was finished, and where it tends to wait: from the goes that were finished, tick by tick.
  const finishedRuns = await ctx.tx
    .select({
      id: routineRuns.id,
      routineId: routineRuns.routineId,
      startedAt: routineRuns.startedAt,
      steps: routineVersions.steps,
    })
    .from(routineRuns)
    .innerJoin(
      routineVersions,
      and(
        eq(routineVersions.routineId, routineRuns.routineId),
        eq(routineVersions.version, routineRuns.routineVersion),
      ),
    )
    .where(
      and(
        eq(routineRuns.householdId, ctx.household.id),
        gte(routineRuns.localDate, recentFrom),
        eq(routineRuns.status, 'completed'),
      ),
    )
    .limit(1000);
  const tickRows =
    finishedRuns.length === 0
      ? []
      : await ctx.tx
          .select({
            runId: routineStepEvents.runId,
            stepId: routineStepEvents.stepId,
            kind: routineStepEvents.kind,
            at: routineStepEvents.at,
          })
          .from(routineStepEvents)
          .innerJoin(routineRuns, eq(routineRuns.id, routineStepEvents.runId))
          .where(
            and(
              eq(routineStepEvents.householdId, ctx.household.id),
              gte(routineRuns.localDate, recentFrom),
              eq(routineRuns.status, 'completed'),
              ne(routineStepEvents.kind, 'help'),
            ),
          )
          .limit(20_000);
  const ticksOf = new Map<string, TimedRun['ticks']>();
  for (const row of tickRows) {
    const list = ticksOf.get(row.runId) ?? [];
    list.push({ stepId: row.stepId, at: row.at, leftOut: row.kind === 'skipped' });
    ticksOf.set(row.runId, list);
  }
  const timedOf = new Map<string, TimedRun[]>();
  const finishedWhen = new Map<string, { morning: number; afternoon: number; evening: number }>();
  for (const run of finishedRuns) {
    const ticks = ticksOf.get(run.id) ?? [];
    const list = timedOf.get(run.routineId) ?? [];
    list.push({
      startedAt: run.startedAt,
      steps: run.steps.map((step) => ({ id: step.id, title: step.title, picture: step.picture })),
      ticks,
    });
    timedOf.set(run.routineId, list);
    // A go a grown-up closed with nothing ticked was not finished at any time of day worth counting.
    if (ticks.length === 0) continue;
    const last = ticks.reduce((latest, tick) => (tick.at > latest ? tick.at : latest), ticks[0]!.at);
    const minutes = zonedParts(last, zone).minutes;
    const bucket = finishedWhen.get(run.routineId) ?? { morning: 0, afternoon: 0, evening: 0 };
    if (minutes < 12 * 60) bucket.morning += 1;
    else if (minutes < 17 * 60) bucket.afternoon += 1;
    else bucket.evening += 1;
    finishedWhen.set(run.routineId, bucket);
  }

  const rewardRows = await ctx.tx
    .select({ status: redemptions.status, total: sql<number>`count(*)::int` })
    .from(redemptions)
    .where(
      and(
        eq(redemptions.householdId, ctx.household.id),
        sql`(${redemptions.requestedAt} at time zone ${zone})::date >= ${first}::date`,
      ),
    )
    .groupBy(redemptions.status);
  const rewardCount = (status: string) => Number(rewardRows.find((row) => row.status === status)?.total ?? 0);
  const asked = rewardRows.reduce((sum, row) => sum + Number(row.total), 0);

  const bought = await ctx.tx
    .select({ localDate: events.localDate, data: events.data })
    .from(events)
    .where(
      and(
        eq(events.householdId, ctx.household.id),
        eq(events.kind, 'shopping.bought'),
        gte(events.localDate, first),
      ),
    )
    .orderBy(desc(events.localDate))
    .limit(2000);
  const staples = new Map<string, { text: string; times: number; lastBought: LocalDate }>();
  for (const row of bought) {
    const key = typeof row.data.item === 'string' ? row.data.item : null;
    const text = typeof row.data.text === 'string' ? row.data.text : null;
    if (!key || !text) continue;
    const entry = staples.get(key);
    if (entry) entry.times += 1;
    else staples.set(key, { text, times: 1, lastBought: row.localDate });
  }

  return {
    weeks,
    children: [...rows.entries()].map(([key, cells]) => ({ profileId: key === '' ? null : key, cells })),
    timeOfDay: [...times.entries()].map(([profileId, bucket]) => ({ profileId, ...bucket })),
    help: helpByTemplate.map((row) => {
      const named = titles.find((title) => title.id === row.templateId);
      return {
        templateId: row.templateId,
        title: named?.title ?? 'A mission',
        picture: named?.picture ?? 'tidy',
        asked: Number(row.asked),
        offered: Number(row.offered),
      };
    }),
    routines: routineNames.map((named) => {
      const row = routineRows.find((candidate) => candidate.routineId === named.id);
      return {
        routineId: named.id,
        title: named.title,
        picture: named.picture,
        started: Number(row?.started ?? 0),
        completed: Number(row?.completed ?? 0),
        stepsAlone: Number(row?.alone ?? 0),
        stepsTogether: Number(row?.together ?? 0),
        stepsSkipped: Number(row?.skipped ?? 0),
        helpAsked: Number(row?.help ?? 0),
        ...(finishedWhen.get(named.id) ?? { morning: 0, afternoon: 0, evening: 0 }),
        timing: routineTiming(timedOf.get(named.id) ?? []),
      };
    }),
    rewards: {
      asked,
      approved: rewardCount('approved') + rewardCount('fulfilled'),
      fulfilled: rewardCount('fulfilled'),
      declined: rewardCount('declined'),
      refunded: rewardCount('refunded'),
    },
    shopping: {
      bought: bought.length,
      staples: [...staples.values()]
        .filter((entry) => entry.times >= 2)
        .sort((a, b) => b.times - a.times)
        .slice(0, 10)
        .map((entry) => ({ ...entry, daysSince: daysBetween(entry.lastBought, ctx.today) })),
    },
    paused: history.paused,
    detailDays: history.detailDays,
    trendMonths: history.trendMonths,
  };
}

export interface HistoryEvent {
  id: string;
  at: string;
  date: LocalDate;
  kind: string;
  profileId: string | null;
  /** What it was about: a mission, a routine or a reward, by its id. */
  subjectId: string | null;
  actor: string;
  data: Record<string, unknown>;
}

/** The day-by-day record itself, newest first: for a parent who wants to see, or to remove, a line. */
export async function recentEvents(
  ctx: Ctx,
  options: { days: number; profileId: string | null; limit: number },
): Promise<HistoryEvent[]> {
  const from = addDays(ctx.today, -Math.min(366, Math.max(1, options.days)));
  const found = await ctx.tx
    .select()
    .from(events)
    .where(
      and(
        eq(events.householdId, ctx.household.id),
        gte(events.localDate, from),
        options.profileId ? eq(events.profileId, options.profileId) : undefined,
      ),
    )
    .orderBy(desc(events.at), desc(events.id))
    .limit(Math.min(300, Math.max(1, options.limit)));
  return found.map((row) => ({
    id: row.id,
    at: row.at.toISOString(),
    date: row.localDate,
    kind: row.kind,
    profileId: row.profileId,
    subjectId: row.subjectId,
    actor: row.actor,
    data: row.data,
  }));
}
