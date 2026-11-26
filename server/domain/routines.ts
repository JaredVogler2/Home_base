import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import type { Routine, RoutineRun, RoutineStep, StepState } from '../../shared/model.js';
import type { OpInput } from '../../shared/ops.js';
import type { ActionPictureId } from '../../shared/pictures.js';
import { coarse, isLocalTime, weekdayOf, type LocalDate, type LocalTime } from '../../shared/time.js';
import {
  profiles,
  routineRuns,
  routineStepEvents,
  routineVersions,
  routines,
  taskTemplates,
} from '../db/schema.js';
import { Reject, record, type Ctx } from './context.js';
import { post, spendable } from './ledger.js';
import { findTodaysOccurrence, submitOccurrence } from './quest.js';

/**
 * Routines: the morning, bedtime, getting out of the door.
 *
 * A routine is a short row of pictures in order. A child taps through it at their own speed — there is no clock
 * on it and nothing is lost by being slow, skipping a step or stopping half-way and coming back. What is kept is
 * which steps were done, which were done with a grown-up, which were left, and when (to the minute), so that a
 * family can see which part of the morning is the hard part. That is an observation about a morning, never a
 * verdict on a child.
 *
 * A step can be the same thing as a mission ("brush teeth"). Doing the step then does the mission — the one
 * mission, with its one set of stars — so nothing is ever rewarded twice.
 */

type VersionRow = typeof routineVersions.$inferSelect;
type RunRow = typeof routineRuns.$inferSelect;
type RoutineFields = Omit<OpInput<'routine.create'>, 'routineId'>;

async function assertFields(ctx: Ctx, fields: RoutineFields): Promise<void> {
  const ids = new Set(fields.steps.map((step) => step.id));
  if (ids.size !== fields.steps.length) throw new Reject('invalid', 'Two steps have the same id.');
  if ((fields.start === null) !== (fields.end === null)) {
    throw new Reject('invalid', 'A routine has both a start and an end time, or neither.');
  }
  if (fields.assignees.length > 0) {
    const found = await ctx.tx
      .select({ id: profiles.id })
      .from(profiles)
      .where(and(eq(profiles.householdId, ctx.household.id), inArray(profiles.id, fields.assignees)));
    if (found.length !== new Set(fields.assignees).size) {
      throw new Reject('invalid', 'One of those children is not in this family.');
    }
  }
  const taskIds = [
    ...new Set(fields.steps.map((step) => step.taskId).filter((id): id is string => id !== null)),
  ];
  if (taskIds.length > 0) {
    const found = await ctx.tx
      .select({ id: taskTemplates.id })
      .from(taskTemplates)
      .where(and(eq(taskTemplates.householdId, ctx.household.id), inArray(taskTemplates.id, taskIds)));
    if (found.length !== taskIds.length)
      throw new Reject('invalid', 'A step points at a mission that is not here.');
  }
}

function versionValues(ctx: Ctx, routineId: string, version: number, fields: RoutineFields) {
  return {
    routineId,
    householdId: ctx.household.id,
    version,
    kind: fields.kind,
    title: fields.title,
    picture: fields.picture,
    steps: fields.steps as RoutineStep[],
    assignees: [...new Set(fields.assignees)],
    days: [...new Set(fields.days)].sort((a, b) => a - b),
    startTime: fields.start,
    endTime: fields.end,
    skip: fields.skip,
    createdBy: ctx.actor.name,
    createdAt: ctx.now,
  };
}

export async function createRoutine(
  ctx: Ctx,
  input: OpInput<'routine.create'>,
): Promise<{ version: number }> {
  const { routineId, ...fields } = input;
  await assertFields(ctx, fields);
  const existing = await ctx.tx.select({ id: routines.id }).from(routines).where(eq(routines.id, routineId));
  if (existing[0]) throw new Reject('conflict', 'That routine already exists.');
  const last = await ctx.tx
    .select({ sort: sql<number>`coalesce(max(${routines.sort}), 0)::int` })
    .from(routines)
    .where(eq(routines.householdId, ctx.household.id));
  await ctx.tx.insert(routines).values({
    id: routineId,
    householdId: ctx.household.id,
    status: 'active',
    version: 1,
    sort: Number(last[0]?.sort ?? 0) + 1,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  });
  await ctx.tx.insert(routineVersions).values(versionValues(ctx, routineId, 1, fields));
  return { version: 1 };
}

export async function updateRoutine(
  ctx: Ctx,
  input: OpInput<'routine.update'>,
): Promise<{ version: number }> {
  const { routineId, baseVersion, ...fields } = input;
  await assertFields(ctx, fields);
  const rows = await ctx.tx
    .select()
    .from(routines)
    .where(and(eq(routines.id, routineId), eq(routines.householdId, ctx.household.id)))
    .limit(1);
  const routine = rows[0];
  if (!routine) throw new Reject('not_found', 'That routine is not here any more.');
  if (routine.version !== baseVersion) {
    throw new Reject('conflict', 'Someone else changed this routine while you were editing it.');
  }
  const version = routine.version + 1;
  // A new version beside the old one. A morning already under way carries on with the steps it began with.
  await ctx.tx.insert(routineVersions).values(versionValues(ctx, routineId, version, fields));
  await ctx.tx.update(routines).set({ version, updatedAt: ctx.now }).where(eq(routines.id, routineId));
  return { version };
}

export async function setRoutineStatus(ctx: Ctx, input: OpInput<'routine.status'>): Promise<void> {
  const rows = await ctx.tx
    .update(routines)
    .set({ status: input.status, updatedAt: ctx.now })
    .where(and(eq(routines.id, input.routineId), eq(routines.householdId, ctx.household.id)))
    .returning({ id: routines.id });
  if (!rows[0]) throw new Reject('not_found', 'That routine is not here any more.');
}

export async function cloneRoutine(ctx: Ctx, input: OpInput<'routine.clone'>): Promise<void> {
  const rows = await ctx.tx
    .select({ routine: routines, version: routineVersions })
    .from(routines)
    .innerJoin(
      routineVersions,
      and(eq(routineVersions.routineId, routines.id), eq(routineVersions.version, routines.version)),
    )
    .where(and(eq(routines.id, input.routineId), eq(routines.householdId, ctx.household.id)))
    .limit(1);
  const source = rows[0];
  if (!source) throw new Reject('not_found', 'That routine is not here any more.');
  await createRoutine(ctx, {
    routineId: input.newRoutineId,
    kind: source.version.kind as RoutineFields['kind'],
    title: input.title,
    picture: source.version.picture as ActionPictureId,
    // The copy's steps are its own: new ids, so the two routines never share a record.
    steps: source.version.steps.map((step) => ({ ...step, id: crypto.randomUUID() })),
    assignees: source.version.assignees,
    days: source.version.days,
    start: source.version.startTime as LocalTime | null,
    end: source.version.endTime as LocalTime | null,
    skip: source.version.skip as RoutineFields['skip'],
  });
}

function toRoutine(routine: typeof routines.$inferSelect, version: VersionRow): Routine {
  return {
    id: routine.id,
    version: routine.version,
    status: routine.status as Routine['status'],
    kind: version.kind as Routine['kind'],
    title: version.title,
    picture: version.picture as ActionPictureId,
    steps: version.steps,
    assignees: version.assignees,
    days: version.days,
    start: isLocalTime(version.startTime) ? version.startTime : null,
    end: isLocalTime(version.endTime) ? version.endTime : null,
    skip: version.skip as Routine['skip'],
    sort: routine.sort,
    updatedAt: routine.updatedAt.toISOString(),
  };
}

export async function listRoutines(ctx: Ctx, includePaused: boolean): Promise<Routine[]> {
  const rows = await ctx.tx
    .select({ routine: routines, version: routineVersions })
    .from(routines)
    .innerJoin(
      routineVersions,
      and(eq(routineVersions.routineId, routines.id), eq(routineVersions.version, routines.version)),
    )
    .where(
      and(
        eq(routines.householdId, ctx.household.id),
        includePaused ? ne(routines.status, 'archived') : eq(routines.status, 'active'),
      ),
    )
    .orderBy(routines.sort);
  return rows.map(({ routine, version }) => toRoutine(routine, version));
}

/** The steps of a routine that belong to a given day. */
export function stepsFor(steps: readonly RoutineStep[], date: LocalDate): RoutineStep[] {
  const weekday = weekdayOf(date);
  return steps.filter((step) => step.days === null || step.days.includes(weekday));
}

// ---------------------------------------------------------------------------------------------------------------------
// A run
// ---------------------------------------------------------------------------------------------------------------------

interface LoadedRun {
  run: RunRow;
  version: VersionRow;
  steps: RoutineStep[];
}

async function loadRun(ctx: Ctx, runId: string): Promise<LoadedRun> {
  const rows = await ctx.tx
    .select({ run: routineRuns, version: routineVersions })
    .from(routineRuns)
    .innerJoin(
      routineVersions,
      and(
        eq(routineVersions.routineId, routineRuns.routineId),
        eq(routineVersions.version, routineRuns.routineVersion),
      ),
    )
    .where(and(eq(routineRuns.id, runId), eq(routineRuns.householdId, ctx.household.id)))
    .limit(1);
  const found = rows[0];
  if (!found) throw new Reject('not_found', 'That routine is not running any more.');
  return { ...found, steps: stepsFor(found.version.steps, found.run.localDate) };
}

async function statesOf(
  ctx: Ctx,
  runId: string,
): Promise<{ done: Record<string, StepState>; help: string[] }> {
  const rows = await ctx.tx.select().from(routineStepEvents).where(eq(routineStepEvents.runId, runId));
  const done: Record<string, StepState> = {};
  const help: string[] = [];
  for (const row of rows) {
    if (row.kind === 'help') help.push(row.stepId);
    // "Together" says more than "done", and "done" more than "skipped".
    else if (
      row.kind === 'together' ||
      (row.kind === 'done' && done[row.stepId] !== 'together') ||
      !done[row.stepId]
    ) {
      done[row.stepId] = row.kind as StepState;
    }
  }
  return { done, help };
}

export async function startRun(
  ctx: Ctx,
  input: OpInput<'run.start'>,
): Promise<{ runId: string; started: boolean }> {
  const child = await ctx.tx
    .select({ id: profiles.id, archivedAt: profiles.archivedAt })
    .from(profiles)
    .where(and(eq(profiles.id, input.profileId), eq(profiles.householdId, ctx.household.id)))
    .limit(1);
  if (!child[0] || child[0].archivedAt) throw new Reject('not_found', 'That child is not here.');

  const rows = await ctx.tx
    .select({ routine: routines, version: routineVersions })
    .from(routines)
    .innerJoin(
      routineVersions,
      and(eq(routineVersions.routineId, routines.id), eq(routineVersions.version, routines.version)),
    )
    .where(and(eq(routines.id, input.routineId), eq(routines.householdId, ctx.household.id)))
    .limit(1);
  const found = rows[0];
  if (!found || found.routine.status !== 'active')
    throw new Reject('not_offered', 'That routine is resting just now.');
  if (found.version.assignees.length > 0 && !found.version.assignees.includes(input.profileId)) {
    throw new Reject('not_offered', 'That routine is not for this child.');
  }

  // One go at a routine for each child each day. Opening it again — on this screen or another — is the same go.
  const made = await ctx.tx
    .insert(routineRuns)
    .values({
      id: input.runId,
      householdId: ctx.household.id,
      routineId: input.routineId,
      routineVersion: found.version.version,
      profileId: input.profileId,
      localDate: ctx.today,
      status: 'active',
      startedAt: coarse(ctx.now),
      updatedAt: ctx.now,
    })
    .onConflictDoNothing()
    .returning({ id: routineRuns.id });
  if (made[0]) {
    await record(ctx, { kind: 'routine.started', profileId: input.profileId, subjectId: input.routineId });
    return { runId: input.runId, started: true };
  }
  const existing = await ctx.tx
    .select()
    .from(routineRuns)
    .where(
      and(
        eq(routineRuns.routineId, input.routineId),
        eq(routineRuns.profileId, input.profileId),
        eq(routineRuns.localDate, ctx.today),
      ),
    )
    .limit(1);
  const run = existing[0];
  if (!run) throw new Reject('conflict', 'That routine could not be started. Try again.');
  if (run.status === 'suspended') {
    await ctx.tx
      .update(routineRuns)
      .set({ status: 'active', updatedAt: ctx.now })
      .where(eq(routineRuns.id, run.id));
    return { runId: run.id, started: true };
  }
  return { runId: run.id, started: false };
}

async function finishIfDone(ctx: Ctx, loaded: LoadedRun): Promise<boolean> {
  const { done, help } = await statesOf(ctx, loaded.run.id);
  const remaining = loaded.steps.filter((step) => !done[step.id] && !step.optional);
  if (remaining.length > 0) return false;
  if (loaded.run.status === 'completed') return true;
  const completedAt = coarse(ctx.now);
  await ctx.tx
    .update(routineRuns)
    .set({ status: 'completed', completedAt, updatedAt: ctx.now })
    .where(eq(routineRuns.id, loaded.run.id));
  const counts = { done: 0, together: 0, skipped: 0 };
  for (const step of loaded.steps) {
    const state = done[step.id];
    if (state) counts[state]++;
  }
  await record(ctx, {
    kind: 'routine.completed',
    profileId: loaded.run.profileId,
    subjectId: loaded.run.routineId,
    date: loaded.run.localDate,
    data: {
      steps: loaded.steps.length,
      alone: counts.done,
      together: counts.together,
      skipped: counts.skipped,
      helpAsked: help.length,
      minutes: Math.max(0, Math.round((completedAt.getTime() - loaded.run.startedAt.getTime()) / 60_000)),
      kind: loaded.version.kind,
    },
  });
  const rules = ctx.household.settings.routines;
  if (rules.awardStars && rules.stars > 0) {
    await post(ctx, {
      profileId: loaded.run.profileId,
      kind: 'grant',
      available: spendable(rules.stars, ctx.household.settings.bank.spendRatePercent),
      lifetime: rules.stars,
      source: 'routine',
      sourceId: loaded.run.id,
      key: `routine:${loaded.run.id}:credit`,
      note: loaded.version.title,
      actor: 'auto',
    });
  }
  return true;
}

async function writeStep(
  ctx: Ctx,
  loaded: LoadedRun,
  stepId: string,
  kind: 'done' | 'together' | 'skipped' | 'help',
): Promise<boolean> {
  if (kind !== 'help') {
    // A step has one answer: the new one replaces the old.
    await ctx.tx
      .delete(routineStepEvents)
      .where(
        and(
          eq(routineStepEvents.runId, loaded.run.id),
          eq(routineStepEvents.stepId, stepId),
          ne(routineStepEvents.kind, 'help'),
          ne(routineStepEvents.kind, kind),
        ),
      );
  }
  const made = await ctx.tx
    .insert(routineStepEvents)
    .values({
      runId: loaded.run.id,
      householdId: ctx.household.id,
      stepId,
      kind,
      at: coarse(ctx.now),
      actor: ctx.actor.name,
    })
    .onConflictDoNothing()
    .returning({ stepId: routineStepEvents.stepId });
  return made.length > 0;
}

function findStep(loaded: LoadedRun, stepId: string): RoutineStep {
  const step = loaded.steps.find((candidate) => candidate.id === stepId);
  if (!step) throw new Reject('not_found', 'That step is not part of this routine today.');
  return step;
}

async function wake(ctx: Ctx, loaded: LoadedRun): Promise<void> {
  if (loaded.run.status === 'suspended') {
    await ctx.tx
      .update(routineRuns)
      .set({ status: 'active', updatedAt: ctx.now })
      .where(eq(routineRuns.id, loaded.run.id));
    loaded.run.status = 'active';
  }
}

export interface StepResult {
  changed: boolean;
  completed: boolean;
  /** Stars given because the step was also a mission. */
  starsGiven: number;
}

export async function stepRun(ctx: Ctx, input: OpInput<'run.step'>): Promise<StepResult> {
  const loaded = await loadRun(ctx, input.runId);
  const step = findStep(loaded, input.stepId);
  const grownUp = ctx.actor.level !== 'child' && ctx.actor.level !== 'household';

  if (input.state === 'undo') {
    const removed = await ctx.tx
      .delete(routineStepEvents)
      .where(
        and(
          eq(routineStepEvents.runId, loaded.run.id),
          eq(routineStepEvents.stepId, step.id),
          ne(routineStepEvents.kind, 'help'),
        ),
      )
      .returning({ stepId: routineStepEvents.stepId });
    if (removed.length > 0 && loaded.run.status === 'completed') {
      await ctx.tx
        .update(routineRuns)
        .set({ status: 'active', completedAt: null, updatedAt: ctx.now })
        .where(eq(routineRuns.id, loaded.run.id));
    }
    return { changed: removed.length > 0, completed: false, starsGiven: 0 };
  }

  if (loaded.run.status === 'completed' && input.state !== 'help') {
    return { changed: false, completed: true, starsGiven: 0 };
  }
  await wake(ctx, loaded);

  if (input.state === 'help') {
    const changed = await writeStep(ctx, loaded, step.id, 'help');
    if (changed)
      await record(ctx, {
        kind: 'routine.help',
        profileId: loaded.run.profileId,
        subjectId: loaded.run.routineId,
        data: { step: step.title },
      });
    return { changed, completed: false, starsGiven: 0 };
  }

  if (input.state === 'skipped' && !grownUp && !step.optional && loaded.version.skip !== 'child') {
    throw new Reject('forbidden', 'A grown-up can leave that step out.');
  }

  const changed = await writeStep(ctx, loaded, step.id, input.state);
  let starsGiven = 0;
  if (changed && input.state === 'done' && step.taskId) {
    // The step is a mission: do the mission, by the mission's own rules. One mission, one set of stars.
    const occurrenceId = await findTodaysOccurrence(ctx, step.taskId, loaded.run.profileId);
    if (occurrenceId) {
      try {
        const result = await submitOccurrence(ctx, { occurrenceId, profileId: loaded.run.profileId });
        starsGiven = result.starsGiven;
      } catch (error) {
        // The mission could not be done from here (it was set aside, say). The step itself still counts.
        if (!(error instanceof Reject)) throw error;
      }
    }
  }
  const completed = await finishIfDone(ctx, loaded);
  return { changed, completed, starsGiven };
}

/** "We did that one together" — a grown-up, at the wall, with a two-second press. */
export async function togetherStep(ctx: Ctx, input: OpInput<'run.together'>): Promise<StepResult> {
  const loaded = await loadRun(ctx, input.runId);
  const step = findStep(loaded, input.stepId);
  if (loaded.run.status === 'completed') return { changed: false, completed: true, starsGiven: 0 };
  await wake(ctx, loaded);
  const changed = await writeStep(ctx, loaded, step.id, 'together');
  const completed = await finishIfDone(ctx, loaded);
  return { changed, completed, starsGiven: 0 };
}

export async function pauseRun(ctx: Ctx, input: OpInput<'run.pause'>): Promise<{ changed: boolean }> {
  const loaded = await loadRun(ctx, input.runId);
  if (loaded.run.status !== 'active') return { changed: false };
  await ctx.tx
    .update(routineRuns)
    .set({ status: 'suspended', updatedAt: ctx.now })
    .where(eq(routineRuns.id, loaded.run.id));
  return { changed: true };
}

export async function resumeRun(ctx: Ctx, input: OpInput<'run.resume'>): Promise<{ changed: boolean }> {
  const loaded = await loadRun(ctx, input.runId);
  if (loaded.run.status !== 'suspended') return { changed: false };
  await ctx.tx
    .update(routineRuns)
    .set({ status: 'active', updatedAt: ctx.now })
    .where(eq(routineRuns.id, loaded.run.id));
  return { changed: true };
}

/** A grown-up calls it done: what was not tapped is simply left as it is. */
export async function finishRun(ctx: Ctx, input: OpInput<'run.finish'>): Promise<{ changed: boolean }> {
  const loaded = await loadRun(ctx, input.runId);
  if (loaded.run.status === 'completed') return { changed: false };
  await ctx.tx
    .update(routineRuns)
    .set({ status: 'completed', completedAt: coarse(ctx.now), updatedAt: ctx.now })
    .where(eq(routineRuns.id, loaded.run.id));
  await record(ctx, {
    kind: 'routine.closed',
    profileId: loaded.run.profileId,
    subjectId: loaded.run.routineId,
    date: loaded.run.localDate,
  });
  return { changed: true };
}

/** Today's goes at each routine. */
export async function listRuns(ctx: Ctx): Promise<RoutineRun[]> {
  const rows = await ctx.tx
    .select({ run: routineRuns, version: routineVersions })
    .from(routineRuns)
    .innerJoin(
      routineVersions,
      and(
        eq(routineVersions.routineId, routineRuns.routineId),
        eq(routineVersions.version, routineRuns.routineVersion),
      ),
    )
    .where(and(eq(routineRuns.householdId, ctx.household.id), eq(routineRuns.localDate, ctx.today)));
  if (rows.length === 0) return [];
  const eventRows = await ctx.tx
    .select()
    .from(routineStepEvents)
    .where(
      inArray(
        routineStepEvents.runId,
        rows.map(({ run }) => run.id),
      ),
    );
  return rows.map(({ run, version }) => {
    const done: Record<string, StepState> = {};
    const help: string[] = [];
    for (const event of eventRows) {
      if (event.runId !== run.id) continue;
      if (event.kind === 'help') help.push(event.stepId);
      else done[event.stepId] = event.kind as StepState;
    }
    return {
      id: run.id,
      routineId: run.routineId,
      routineVersion: run.routineVersion,
      profileId: run.profileId,
      date: run.localDate,
      status: run.status as RoutineRun['status'],
      steps: stepsFor(version.steps, run.localDate),
      done,
      help,
      startedAt: run.startedAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
    };
  });
}
