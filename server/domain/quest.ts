import { and, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm';
import type {
  ChecklistStep,
  Occurrence,
  OccurrenceStatus,
  ReturnReason,
  TaskTemplate,
} from '../../shared/model.js';
import type { OpInput } from '../../shared/ops.js';
import type { ActionPictureId } from '../../shared/pictures.js';
import { isOfferedOn, type Schedule } from '../../shared/schedule.js';
import { addDays, startOfWeek, type LocalDate } from '../../shared/time.js';
import { ledger, profiles, taskOccurrences, taskTemplateVersions, taskTemplates } from '../db/schema.js';
import { AUTO_ACTOR_NAME, Reject, record, type Ctx } from './context.js';
import { post, spendable } from './ledger.js';

/**
 * Missions.
 *
 * A grown-up writes a mission once (a template). Each day it is offered, each child it is for gets one of their
 * own for that day (an occurrence) — exactly one, however many screens are open, because the database refuses a
 * second. A mission moves along one road:
 *
 *     available → in_progress → submitted → approved        (stars given, once)
 *                                   ↘ returned ("have another go") → …
 *     available → skipped                                    (costs nothing)
 *
 * Where a family trusts a mission to a child's word, "submitted" and "approved" happen together. Nothing here
 * ever takes a star away for a mission not done, and yesterday's untouched missions simply are not shown today.
 */

type VersionRow = typeof taskTemplateVersions.$inferSelect;
type OccurrenceRow = typeof taskOccurrences.$inferSelect;

// ---------------------------------------------------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------------------------------------------------

type TaskFields = Omit<OpInput<'task.create'>, 'templateId'>;

async function assertProfiles(ctx: Ctx, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const found = await ctx.tx
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.householdId, ctx.household.id), inArray(profiles.id, [...ids])));
  if (found.length !== new Set(ids).size)
    throw new Reject('invalid', 'One of those children is not in this family.');
}

function versionValues(ctx: Ctx, templateId: string, version: number, fields: TaskFields) {
  return {
    templateId,
    householdId: ctx.household.id,
    version,
    kind: fields.kind,
    title: fields.title,
    picture: fields.picture,
    say: fields.say,
    steps: fields.steps as ChecklistStep[],
    schedule: fields.schedule as Schedule,
    assignees: [...new Set(fields.assignees)],
    // A mission for the whole family is one mission; it cannot also be one each.
    shared: fields.shared,
    stars: fields.stars,
    effort: fields.effort,
    verification: fields.verification,
    skip: fields.skip,
    needsAdult: fields.needsAdult,
    timerSeconds: fields.timerSeconds,
    createdBy: ctx.actor.name,
    createdAt: ctx.now,
  };
}

export async function createTask(ctx: Ctx, input: OpInput<'task.create'>): Promise<{ version: number }> {
  const { templateId, ...fields } = input;
  await assertProfiles(ctx, fields.assignees);
  const existing = await ctx.tx
    .select({ id: taskTemplates.id })
    .from(taskTemplates)
    .where(eq(taskTemplates.id, templateId));
  if (existing[0]) throw new Reject('conflict', 'That mission already exists.');
  const last = await ctx.tx
    .select({ sort: sql<number>`coalesce(max(${taskTemplates.sort}), 0)::int` })
    .from(taskTemplates)
    .where(eq(taskTemplates.householdId, ctx.household.id));
  await ctx.tx.insert(taskTemplates).values({
    id: templateId,
    householdId: ctx.household.id,
    status: 'active',
    version: 1,
    sort: Number(last[0]?.sort ?? 0) + 1,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  });
  await ctx.tx.insert(taskTemplateVersions).values(versionValues(ctx, templateId, 1, fields));
  await ensureOccurrences(ctx, ctx.today, [templateId]);
  return { version: 1 };
}

export async function updateTask(ctx: Ctx, input: OpInput<'task.update'>): Promise<{ version: number }> {
  const { templateId, baseVersion, ...fields } = input;
  await assertProfiles(ctx, fields.assignees);
  const rows = await ctx.tx
    .select()
    .from(taskTemplates)
    .where(and(eq(taskTemplates.id, templateId), eq(taskTemplates.householdId, ctx.household.id)))
    .limit(1);
  const template = rows[0];
  if (!template) throw new Reject('not_found', 'That mission is not here any more.');
  if (template.version !== baseVersion) {
    throw new Reject(
      'conflict',
      'Someone else changed this mission while you were editing it. Have a look at their change first.',
    );
  }
  const version = template.version + 1;
  await ctx.tx.insert(taskTemplateVersions).values(versionValues(ctx, templateId, version, fields));
  await ctx.tx
    .update(taskTemplates)
    .set({ version, updatedAt: ctx.now })
    .where(eq(taskTemplates.id, templateId));
  // Today's copies that nobody has touched take the new words. Anything begun, sent or done keeps the mission
  // it was — an edit never rewrites what already happened.
  await ctx.tx
    .delete(taskOccurrences)
    .where(
      and(
        eq(taskOccurrences.templateId, templateId),
        gte(taskOccurrences.localDate, ctx.today),
        eq(taskOccurrences.status, 'available'),
      ),
    );
  await ensureOccurrences(ctx, ctx.today, [templateId]);
  return { version };
}

export async function setTaskStatus(ctx: Ctx, input: OpInput<'task.status'>): Promise<void> {
  const rows = await ctx.tx
    .update(taskTemplates)
    .set({ status: input.status, updatedAt: ctx.now })
    .where(and(eq(taskTemplates.id, input.templateId), eq(taskTemplates.householdId, ctx.household.id)))
    .returning({ id: taskTemplates.id });
  if (!rows[0]) throw new Reject('not_found', 'That mission is not here any more.');
  if (input.status === 'active') {
    await ensureOccurrences(ctx, ctx.today, [input.templateId]);
  } else {
    await ctx.tx
      .delete(taskOccurrences)
      .where(
        and(
          eq(taskOccurrences.templateId, input.templateId),
          gte(taskOccurrences.localDate, ctx.today),
          eq(taskOccurrences.status, 'available'),
        ),
      );
  }
}

export async function reorderTasks(ctx: Ctx, input: OpInput<'task.reorder'>): Promise<void> {
  let sort = 1;
  for (const templateId of input.templateIds) {
    // A mission's place on the board is read from its template, so today's board follows at once.
    await ctx.tx
      .update(taskTemplates)
      .set({ sort })
      .where(and(eq(taskTemplates.id, templateId), eq(taskTemplates.householdId, ctx.household.id)));
    sort += 1;
  }
}

export async function listTemplates(ctx: Ctx): Promise<TaskTemplate[]> {
  const rows = await ctx.tx
    .select({ template: taskTemplates, version: taskTemplateVersions })
    .from(taskTemplates)
    .innerJoin(
      taskTemplateVersions,
      and(
        eq(taskTemplateVersions.templateId, taskTemplates.id),
        eq(taskTemplateVersions.version, taskTemplates.version),
      ),
    )
    .where(and(eq(taskTemplates.householdId, ctx.household.id), ne(taskTemplates.status, 'archived')))
    .orderBy(taskTemplates.sort);
  return rows.map(({ template, version }) => ({
    id: template.id,
    version: template.version,
    status: template.status as TaskTemplate['status'],
    kind: version.kind as TaskTemplate['kind'],
    title: version.title,
    picture: version.picture as ActionPictureId,
    say: version.say,
    steps: version.steps,
    schedule: version.schedule,
    assignees: version.assignees,
    shared: version.shared,
    stars: version.stars,
    effort: version.effort as 1 | 2 | 3,
    verification: version.verification as TaskTemplate['verification'],
    skip: version.skip as TaskTemplate['skip'],
    needsAdult: version.needsAdult,
    timerSeconds: version.timerSeconds,
    sort: template.sort,
    updatedAt: template.updatedAt.toISOString(),
  }));
}

// ---------------------------------------------------------------------------------------------------------------------
// Handing out a day's missions
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Make sure every mission offered on `date` exists, once. Safe to call any number of times, from any number of
 * screens: what is there is left alone and nothing is ever made for a day that has gone.
 */
export async function ensureOccurrences(
  ctx: Ctx,
  date: LocalDate,
  onlyTemplates?: readonly string[],
): Promise<number> {
  if (date < ctx.today) return 0;
  const templates = await ctx.tx
    .select({ template: taskTemplates, version: taskTemplateVersions })
    .from(taskTemplates)
    .innerJoin(
      taskTemplateVersions,
      and(
        eq(taskTemplateVersions.templateId, taskTemplates.id),
        eq(taskTemplateVersions.version, taskTemplates.version),
      ),
    )
    .where(
      and(
        eq(taskTemplates.householdId, ctx.household.id),
        eq(taskTemplates.status, 'active'),
        onlyTemplates ? inArray(taskTemplates.id, [...onlyTemplates]) : undefined,
      ),
    );
  if (templates.length === 0) return 0;

  const children = await ctx.tx
    .select({ id: profiles.id, independent: profiles.independent, archivedAt: profiles.archivedAt })
    .from(profiles)
    .where(eq(profiles.householdId, ctx.household.id));
  const able = children.filter((child) => child.independent && !child.archivedAt).map((child) => child.id);
  if (able.length === 0) return 0;

  const weekStart = ctx.household.settings.weekStart;
  const weekFrom = startOfWeek(date, weekStart);
  const flexible = templates
    .filter(({ version }) => version.schedule.kind === 'flexible')
    .map(({ template }) => template.id);
  const doneThisWeek = new Map<string, number>();
  if (flexible.length > 0) {
    const counts = await ctx.tx
      .select({
        templateId: taskOccurrences.templateId,
        profileId: taskOccurrences.profileId,
        count: sql<number>`count(*)::int`,
      })
      .from(taskOccurrences)
      .where(
        and(
          inArray(taskOccurrences.templateId, flexible),
          gte(taskOccurrences.localDate, weekFrom),
          lte(taskOccurrences.localDate, addDays(weekFrom, 6)),
          inArray(taskOccurrences.status, ['submitted', 'approved']),
          ne(taskOccurrences.localDate, date),
        ),
      )
      .groupBy(taskOccurrences.templateId, taskOccurrences.profileId);
    for (const row of counts) doneThisWeek.set(`${row.templateId}:${row.profileId ?? ''}`, Number(row.count));
  }

  const rows: (typeof taskOccurrences.$inferInsert)[] = [];
  for (const { template, version } of templates) {
    const who: (string | null)[] = version.shared
      ? [null]
      : version.assignees.length > 0
        ? version.assignees.filter((id) => able.includes(id))
        : able;
    for (const profileId of who) {
      const offered = isOfferedOn(version.schedule, date, {
        weekStart,
        vacation: ctx.household.settings.vacation,
        doneThisWeek: doneThisWeek.get(`${template.id}:${profileId ?? ''}`) ?? 0,
      });
      if (!offered) continue;
      rows.push({
        id: crypto.randomUUID(),
        householdId: ctx.household.id,
        templateId: template.id,
        templateVersion: version.version,
        profileId,
        localDate: date,
        status: 'available',
        stars: version.stars,
        createdAt: ctx.now,
        updatedAt: ctx.now,
      });
    }
  }
  if (rows.length === 0) return 0;
  const made = await ctx.tx
    .insert(taskOccurrences)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: taskOccurrences.id });
  return made.length;
}

// ---------------------------------------------------------------------------------------------------------------------
// One mission's road
// ---------------------------------------------------------------------------------------------------------------------

interface Loaded {
  row: OccurrenceRow;
  version: VersionRow;
}

async function load(ctx: Ctx, occurrenceId: string): Promise<Loaded> {
  const rows = await ctx.tx
    .select({ row: taskOccurrences, version: taskTemplateVersions })
    .from(taskOccurrences)
    .innerJoin(
      taskTemplateVersions,
      and(
        eq(taskTemplateVersions.templateId, taskOccurrences.templateId),
        eq(taskTemplateVersions.version, taskOccurrences.templateVersion),
      ),
    )
    .where(and(eq(taskOccurrences.id, occurrenceId), eq(taskOccurrences.householdId, ctx.household.id)))
    .limit(1);
  const found = rows[0];
  if (!found) throw new Reject('not_found', 'That mission is not here any more.');
  return found;
}

/** May this child do this mission? Theirs, or the family's and they are one of the family it is for. */
async function assertDoer(ctx: Ctx, loaded: Loaded, profileId: string): Promise<void> {
  const rows = await ctx.tx
    .select({ id: profiles.id, independent: profiles.independent, archivedAt: profiles.archivedAt })
    .from(profiles)
    .where(and(eq(profiles.id, profileId), eq(profiles.householdId, ctx.household.id)))
    .limit(1);
  const child = rows[0];
  if (!child || child.archivedAt) throw new Reject('not_found', 'That child is not here.');
  if (!child.independent) throw new Reject('not_offered', 'Missions are not switched on for this child yet.');
  if (loaded.row.profileId) {
    if (loaded.row.profileId !== profileId)
      throw new Reject('forbidden', 'That mission belongs to someone else.');
    return;
  }
  if (loaded.version.assignees.length > 0 && !loaded.version.assignees.includes(profileId)) {
    throw new Reject('not_offered', 'That mission is not for this child.');
  }
}

/** How many times this mission's stars have been taken back. The next giving is numbered after it. */
async function reversalsOf(ctx: Ctx, occurrenceId: string): Promise<number> {
  const rows = await ctx.tx
    .select({ count: sql<number>`count(*)::int` })
    .from(ledger)
    .where(
      and(
        eq(ledger.householdId, ctx.household.id),
        eq(ledger.sourceId, occurrenceId),
        eq(ledger.source, 'task'),
        eq(ledger.kind, 'correction'),
      ),
    );
  return Number(rows[0]?.count ?? 0);
}

/** Give a mission's stars. Written so that it cannot happen twice for one doing of one mission. */
async function credit(ctx: Ctx, loaded: Loaded, profileId: string, actor: string): Promise<string | null> {
  if (loaded.row.stars <= 0) return null;
  const turn = (await reversalsOf(ctx, loaded.row.id)) + 1;
  const posted = await post(ctx, {
    profileId,
    kind: 'grant',
    available: spendable(loaded.row.stars, ctx.household.settings.bank.spendRatePercent),
    lifetime: loaded.row.stars,
    source: 'task',
    sourceId: loaded.row.id,
    key: `task:${loaded.row.id}:credit:${turn}`,
    note: loaded.version.title,
    actor,
  });
  return posted.entryId;
}

/** Stars already given to this child today without a grown-up looking. */
async function autoCreditedToday(ctx: Ctx, profileId: string): Promise<number> {
  const rows = await ctx.tx
    .select({ stars: sql<number>`coalesce(sum(${taskOccurrences.stars}), 0)::int` })
    .from(taskOccurrences)
    .where(
      and(
        eq(taskOccurrences.householdId, ctx.household.id),
        eq(taskOccurrences.doneBy, profileId),
        eq(taskOccurrences.localDate, ctx.today),
        eq(taskOccurrences.status, 'approved'),
        eq(taskOccurrences.decidedBy, AUTO_ACTOR_NAME),
      ),
    );
  return Number(rows[0]?.stars ?? 0);
}

export interface Transition {
  changed: boolean;
  status: OccurrenceStatus;
  /** Stars given by this very request. */
  starsGiven: number;
}

const unchanged = (status: string): Transition => ({
  changed: false,
  status: status as OccurrenceStatus,
  starsGiven: 0,
});

export async function startOccurrence(ctx: Ctx, input: OpInput<'occurrence.start'>): Promise<Transition> {
  const loaded = await load(ctx, input.occurrenceId);
  await assertDoer(ctx, loaded, input.profileId);
  if (loaded.row.status === 'in_progress') return unchanged('in_progress');
  if (loaded.row.status !== 'available' && loaded.row.status !== 'returned')
    return unchanged(loaded.row.status);
  await ctx.tx
    .update(taskOccurrences)
    .set({ status: 'in_progress', startedAt: ctx.now, updatedAt: ctx.now })
    .where(eq(taskOccurrences.id, loaded.row.id));
  return { changed: true, status: 'in_progress', starsGiven: 0 };
}

async function approve(ctx: Ctx, loaded: Loaded, profileId: string, decidedBy: string): Promise<Transition> {
  const creditTx = await credit(ctx, loaded, profileId, decidedBy);
  await ctx.tx
    .update(taskOccurrences)
    .set({
      status: 'approved',
      doneBy: profileId,
      submittedAt: loaded.row.submittedAt ?? ctx.now,
      decidedAt: ctx.now,
      decidedBy,
      creditTx,
      returnReason: null,
      helpAsked: false,
      updatedAt: ctx.now,
    })
    .where(eq(taskOccurrences.id, loaded.row.id));
  await record(ctx, {
    kind: 'mission.done',
    profileId,
    subjectId: loaded.row.templateId,
    date: loaded.row.localDate,
    data: {
      stars: loaded.row.stars,
      effort: loaded.version.effort,
      by: decidedBy === AUTO_ACTOR_NAME ? 'auto' : 'grownup',
    },
  });
  return { changed: true, status: 'approved', starsGiven: loaded.row.stars };
}

/** "I did it." */
export async function submitOccurrence(ctx: Ctx, input: OpInput<'occurrence.submit'>): Promise<Transition> {
  const loaded = await load(ctx, input.occurrenceId);
  await assertDoer(ctx, loaded, input.profileId);
  const { row, version } = loaded;
  // Tapping again changes nothing: sent is sent, done is done.
  if (row.status === 'submitted' || row.status === 'approved') return unchanged(row.status);
  if (row.status === 'skipped') throw new Reject('not_allowed_now', 'That mission was set aside for today.');
  if (row.localDate < addDays(ctx.today, -1))
    throw new Reject('not_allowed_now', 'That mission was for another day.');

  const undoUntil = new Date(ctx.now.getTime() + ctx.household.settings.quest.undoSeconds * 1000);
  let trusted = version.verification === 'auto';
  if (trusted) {
    const cap = ctx.household.settings.quest.dailyAutoCreditCap;
    if (cap !== null && (await autoCreditedToday(ctx, input.profileId)) + row.stars > cap) trusted = false;
  }
  if (trusted) {
    const result = await approve(
      ctx,
      { row: { ...row, submittedAt: ctx.now }, version },
      input.profileId,
      AUTO_ACTOR_NAME,
    );
    await ctx.tx.update(taskOccurrences).set({ undoUntil }).where(eq(taskOccurrences.id, row.id));
    return result;
  }
  await ctx.tx
    .update(taskOccurrences)
    .set({
      status: 'submitted',
      doneBy: input.profileId,
      submittedAt: ctx.now,
      undoUntil,
      returnReason: null,
      updatedAt: ctx.now,
    })
    .where(eq(taskOccurrences.id, row.id));
  await record(ctx, {
    kind: 'mission.sent',
    profileId: input.profileId,
    subjectId: row.templateId,
    date: row.localDate,
  });
  return { changed: true, status: 'submitted', starsGiven: 0 };
}

/** Take a mission's stars back, in the open: a new line that undoes the old one. */
async function reverseCredit(ctx: Ctx, loaded: Loaded, note: string | null): Promise<void> {
  const { row } = loaded;
  if (!row.creditTx || !row.doneBy || row.stars <= 0) return;
  const turn = await reversalsOf(ctx, row.id);
  const given = await ctx.tx.select().from(ledger).where(eq(ledger.id, row.creditTx)).limit(1);
  const line = given[0];
  if (!line) return;
  await post(ctx, {
    profileId: row.doneBy,
    kind: 'correction',
    available: -line.available,
    lifetime: -line.lifetime,
    source: 'task',
    sourceId: row.id,
    key: `task:${row.id}:reverse:${turn + 1}`,
    reverses: line.id,
    note: note ?? `Taken back: ${loaded.version.title}`,
  });
}

/** "Oops, not yet." Offered for a short while after "I did it", from the same wall. */
export async function undoOccurrence(ctx: Ctx, input: OpInput<'occurrence.undo'>): Promise<Transition> {
  const loaded = await load(ctx, input.occurrenceId);
  const { row } = loaded;
  if (row.status !== 'submitted' && row.status !== 'approved') return unchanged(row.status);
  const grownUp = ctx.actor.level !== 'child' && ctx.actor.level !== 'household';
  if (!grownUp) {
    if (!row.undoUntil || row.undoUntil.getTime() < ctx.now.getTime()) {
      throw new Reject('not_allowed_now', 'That one is finished now. A grown-up can change it.');
    }
    if (row.status === 'approved' && row.decidedBy !== AUTO_ACTOR_NAME) {
      throw new Reject('not_allowed_now', 'A grown-up said yes to that one. A grown-up can change it.');
    }
  }
  if (row.status === 'approved') await reverseCredit(ctx, loaded, 'Oops, not yet');
  await ctx.tx
    .update(taskOccurrences)
    .set({
      status: 'available',
      doneBy: null,
      submittedAt: null,
      decidedAt: null,
      decidedBy: null,
      creditTx: null,
      undoUntil: null,
      updatedAt: ctx.now,
    })
    .where(eq(taskOccurrences.id, row.id));
  if (row.doneBy) {
    await record(ctx, {
      kind: 'mission.undone',
      profileId: row.doneBy,
      subjectId: row.templateId,
      date: row.localDate,
    });
  }
  return { changed: true, status: 'available', starsGiven: 0 };
}

export async function askForHelp(ctx: Ctx, input: OpInput<'occurrence.help'>): Promise<Transition> {
  const loaded = await load(ctx, input.occurrenceId);
  await assertDoer(ctx, loaded, input.profileId);
  if (loaded.row.helpAsked || loaded.row.status === 'approved') return unchanged(loaded.row.status);
  await ctx.tx
    .update(taskOccurrences)
    .set({ helpAsked: true, updatedAt: ctx.now })
    .where(eq(taskOccurrences.id, loaded.row.id));
  await record(ctx, {
    kind: 'mission.help',
    profileId: input.profileId,
    subjectId: loaded.row.templateId,
    date: loaded.row.localDate,
  });
  return { changed: true, status: loaded.row.status as OccurrenceStatus, starsGiven: 0 };
}

/** "Not today." Costs nothing and is not counted against anyone. */
export async function skipOccurrence(
  ctx: Ctx,
  input: { occurrenceId: string; profileId?: string },
): Promise<Transition> {
  const loaded = await load(ctx, input.occurrenceId);
  const { row, version } = loaded;
  const grownUp = ctx.actor.level !== 'child' && ctx.actor.level !== 'household';
  if (!grownUp) {
    if (version.skip !== 'child') throw new Reject('forbidden', 'A grown-up can set that one aside.');
    if (input.profileId) await assertDoer(ctx, loaded, input.profileId);
  }
  if (row.status === 'skipped') return unchanged('skipped');
  if (row.status === 'approved' || row.status === 'submitted') {
    throw new Reject('not_allowed_now', 'That mission has already been done.');
  }
  await ctx.tx
    .update(taskOccurrences)
    .set({ status: 'skipped', decidedAt: ctx.now, decidedBy: ctx.actor.name, updatedAt: ctx.now })
    .where(eq(taskOccurrences.id, row.id));
  await record(ctx, {
    kind: 'mission.skipped',
    profileId: row.profileId ?? input.profileId ?? null,
    subjectId: row.templateId,
    date: row.localDate,
  });
  return { changed: true, status: 'skipped', starsGiven: 0 };
}

/** A grown-up says yes to missions a child has sent. Saying yes twice — or on two phones at once — is one yes. */
export async function approveOccurrences(
  ctx: Ctx,
  input: OpInput<'occurrence.approve'>,
): Promise<{ approved: string[]; already: string[]; starsGiven: number }> {
  const approved: string[] = [];
  const already: string[] = [];
  let starsGiven = 0;
  for (const occurrenceId of input.occurrenceIds) {
    const loaded = await load(ctx, occurrenceId);
    if (loaded.row.status === 'approved') {
      already.push(occurrenceId);
      continue;
    }
    if (loaded.row.status !== 'submitted' || !loaded.row.doneBy) {
      throw new Reject('not_allowed_now', 'That mission has not been sent in. Mark it done instead.');
    }
    const result = await approve(ctx, loaded, loaded.row.doneBy, ctx.actor.name);
    starsGiven += result.starsGiven;
    approved.push(occurrenceId);
  }
  return { approved, already, starsGiven };
}

/** "Have another go", with kind words. Nothing is taken away. */
export async function returnOccurrence(ctx: Ctx, input: OpInput<'occurrence.return'>): Promise<Transition> {
  const loaded = await load(ctx, input.occurrenceId);
  if (loaded.row.status === 'returned') return unchanged('returned');
  if (loaded.row.status !== 'submitted') {
    throw new Reject('not_allowed_now', 'Only a mission that has been sent in can be sent back.');
  }
  await ctx.tx
    .update(taskOccurrences)
    .set({
      status: 'returned',
      returnReason: input.reason satisfies ReturnReason,
      decidedAt: ctx.now,
      decidedBy: ctx.actor.name,
      undoUntil: null,
      updatedAt: ctx.now,
    })
    .where(eq(taskOccurrences.id, loaded.row.id));
  await record(ctx, {
    kind: 'mission.returned',
    profileId: loaded.row.doneBy,
    subjectId: loaded.row.templateId,
    date: loaded.row.localDate,
    data: { reason: input.reason },
  });
  return { changed: true, status: 'returned', starsGiven: 0 };
}

/** A grown-up marks a mission done for a child — they saw it happen. */
export async function markDone(ctx: Ctx, input: OpInput<'occurrence.markDone'>): Promise<Transition> {
  const loaded = await load(ctx, input.occurrenceId);
  await assertDoer(ctx, loaded, input.profileId);
  if (loaded.row.status === 'approved') return unchanged('approved');
  return approve(ctx, loaded, input.profileId, ctx.actor.name);
}

export async function snoozeOccurrence(ctx: Ctx, input: OpInput<'occurrence.snooze'>): Promise<Transition> {
  const loaded = await load(ctx, input.occurrenceId);
  if (
    loaded.row.status !== 'available' &&
    loaded.row.status !== 'in_progress' &&
    loaded.row.status !== 'returned'
  ) {
    return unchanged(loaded.row.status);
  }
  await ctx.tx
    .update(taskOccurrences)
    .set({ snoozedUntil: new Date(ctx.now.getTime() + input.hours * 3_600_000), updatedAt: ctx.now })
    .where(eq(taskOccurrences.id, loaded.row.id));
  return { changed: true, status: loaded.row.status as OccurrenceStatus, starsGiven: 0 };
}

/** A grown-up takes back the stars of a mission that turned out not to be done. Recorded, never hidden. */
export async function reverseOccurrence(ctx: Ctx, input: OpInput<'occurrence.reverse'>): Promise<Transition> {
  const loaded = await load(ctx, input.occurrenceId);
  if (loaded.row.status !== 'approved') return unchanged(loaded.row.status);
  await reverseCredit(ctx, loaded, input.note);
  const status: OccurrenceStatus = loaded.row.localDate === ctx.today ? 'available' : 'skipped';
  await ctx.tx
    .update(taskOccurrences)
    .set({
      status,
      doneBy: status === 'available' ? null : loaded.row.doneBy,
      submittedAt: null,
      decidedAt: ctx.now,
      decidedBy: ctx.actor.name,
      creditTx: null,
      undoUntil: null,
      updatedAt: ctx.now,
    })
    .where(eq(taskOccurrences.id, loaded.row.id));
  await record(ctx, {
    kind: 'mission.reversed',
    profileId: loaded.row.doneBy,
    subjectId: loaded.row.templateId,
    date: loaded.row.localDate,
    data: { stars: loaded.row.stars },
  });
  return { changed: true, status, starsGiven: 0 };
}

// ---------------------------------------------------------------------------------------------------------------------
// For the screens
// ---------------------------------------------------------------------------------------------------------------------

/** Today's missions, and yesterday's that are still waiting for a grown-up's answer. */
export async function listOccurrences(ctx: Ctx): Promise<Occurrence[]> {
  const rows = await ctx.tx
    .select({ row: taskOccurrences, version: taskTemplateVersions, sort: taskTemplates.sort })
    .from(taskOccurrences)
    .innerJoin(taskTemplates, eq(taskTemplates.id, taskOccurrences.templateId))
    .innerJoin(
      taskTemplateVersions,
      and(
        eq(taskTemplateVersions.templateId, taskOccurrences.templateId),
        eq(taskTemplateVersions.version, taskOccurrences.templateVersion),
      ),
    )
    .where(
      and(
        eq(taskOccurrences.householdId, ctx.household.id),
        sql`(${taskOccurrences.localDate} = ${ctx.today} or (${taskOccurrences.localDate} >= ${addDays(ctx.today, -2)} and ${taskOccurrences.status} = 'submitted'))`,
      ),
    )
    .orderBy(taskTemplates.sort, taskOccurrences.id);
  return rows.map(({ row, version, sort }) => ({
    id: row.id,
    templateId: row.templateId,
    templateVersion: row.templateVersion,
    profileId: row.profileId,
    date: row.localDate,
    status: row.status as OccurrenceStatus,
    kind: version.kind as Occurrence['kind'],
    title: version.title,
    picture: version.picture as ActionPictureId,
    say: version.say,
    steps: version.steps,
    stars: row.stars,
    needsAdult: version.needsAdult,
    timerSeconds: version.timerSeconds,
    skip: version.skip as Occurrence['skip'],
    verification: version.verification as Occurrence['verification'],
    sort,
    doneBy: row.doneBy,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    credited: row.status === 'approved',
    returnReason: row.returnReason as ReturnReason | null,
    helpAsked: row.helpAsked,
    undoUntil:
      row.undoUntil && row.undoUntil.getTime() > ctx.now.getTime() ? row.undoUntil.toISOString() : null,
    snoozedUntil:
      row.snoozedUntil && row.snoozedUntil.getTime() > ctx.now.getTime()
        ? row.snoozedUntil.toISOString()
        : null,
  }));
}

/** The occurrence of a mission for a child today, where there is one (for a routine step that does a mission). */
export async function findTodaysOccurrence(
  ctx: Ctx,
  templateId: string,
  profileId: string,
): Promise<string | null> {
  const rows = await ctx.tx
    .select({ id: taskOccurrences.id })
    .from(taskOccurrences)
    .where(
      and(
        eq(taskOccurrences.householdId, ctx.household.id),
        eq(taskOccurrences.templateId, templateId),
        eq(taskOccurrences.localDate, ctx.today),
        sql`(${taskOccurrences.profileId} = ${profileId} or ${taskOccurrences.profileId} is null)`,
      ),
    )
    .limit(1);
  return rows[0]?.id ?? null;
}
