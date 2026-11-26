import { and, eq, gte, inArray, isNotNull, lte, sql } from 'drizzle-orm';
import {
  ACADEMY_PROBLEM_TEXT,
  ACADEMY_SUMMARY_WEEKS,
  checkAcademyExport,
  summariseAcademy,
  type AcademyProblem,
  type AcademySessionSummary,
  type AcademySummary,
  type AcademyWorldSummary,
} from '../../shared/academy.js';
import { hasAccess } from '../../shared/model.js';
import { addDays, daysBetween, type LocalDate } from '../../shared/time.js';
import { academyLinks, academySessions, ledger, profiles } from '../db/schema.js';
import { auditLog, bumpRevision, Reject, type Ctx } from './context.js';
import { post, spendable } from './ledger.js';

/**
 * Bringing a child's Training Academy progress into HOMEBASE, from a file a grown-up saved in the Academy.
 *
 * Nothing reaches HOMEBASE from the Academy by itself: the two never talk. A grown-up saves an export file there,
 * chooses the child here, says yes, and sends it. The file is checked from scratch on the server (see
 * shared/academy.ts) and boiled down to one small total per sitting. The player's made-up id links the file to the
 * child; the nickname typed in the Academy is never read.
 *
 * Stars, where a family has switched them on, are for taking part: a set number for each finished sitting, up to a
 * daily limit. Never for being right, being quick, or doing the same thing over and over. The rules:
 *
 *   - Whether a sitting earns is decided once, at the import where it is first seen finished, by the settings of
 *     that moment. A sitting brought in while stars were off does not earn later when they are switched on.
 *   - The daily limit counts every star already given for sittings on that day, in earlier imports too.
 *   - A sitting dated in the future, or more than 60 days ago, is kept but does not earn.
 *   - Each sitting's stars carry the key `academy:<sitting id>`, so nothing is paid twice — not by sending the same
 *     file again, not after unlinking and linking again.
 *
 * The stars are written in the star ledger and nowhere else; the Academy totals are a separate record, and
 * unlinking deletes those totals without touching a star.
 */

/** Sittings further back than this are kept, for the parent's picture of practice, but earn nothing. */
export const ACADEMY_EARNING_DAYS = 60;

/** A file turned away, with the reason for the program and words for the grown-up. */
export class AcademyFileRejected extends Reject {
  constructor(readonly problem: AcademyProblem) {
    super('invalid', ACADEMY_PROBLEM_TEXT[problem]);
    this.name = 'AcademyFileRejected';
  }
}

export interface AcademyImportInput {
  profileId: string;
  /** The export, as sent: checked here whatever the phone said about it. */
  file: unknown;
  /** The grown-up said yes on the screen. Nothing is read without it. */
  consent: unknown;
}

export interface AcademyImportResult {
  sessions: {
    /** Sittings HOMEBASE had not seen. */
    new: number;
    /** Sittings that were unfinished last time and have moved on since. */
    updated: number;
    /** Sittings already here, as they are. */
    alreadyHad: number;
  };
  stars: { granted: number; heldBackByCap: number };
}

const INSERT_CHUNK = 500;

async function loadChild(ctx: Ctx, profileId: string): Promise<void> {
  const rows = await ctx.tx
    .select({ archivedAt: profiles.archivedAt })
    .from(profiles)
    .where(and(eq(profiles.id, profileId), eq(profiles.householdId, ctx.household.id)))
    .limit(1);
  const child = rows[0];
  if (!child) throw new Reject('not_found', 'That child is not here.');
  if (child.archivedAt)
    throw new Reject('not_allowed_now', 'That child’s profile is put away. Bring it back first.');
}

/** Link the child to the player on the first import, or check it is the same pairing as before. */
async function ensureLink(ctx: Ctx, profileId: string, playerId: string): Promise<'made' | 'kept'> {
  const links = await ctx.tx
    .select()
    .from(academyLinks)
    .where(eq(academyLinks.householdId, ctx.household.id));
  const mine = links.find((link) => link.profileId === profileId);
  if (mine) {
    if (mine.playerId === playerId) return 'kept';
    throw new Reject(
      'conflict',
      'This child is linked to a different Academy player. To change it, unlink the Academy for this child first, then import again.',
    );
  }
  if (links.some((link) => link.playerId === playerId)) {
    throw new Reject(
      'conflict',
      'That Academy player is linked to another child in this family. Unlink it from that child first, then import again.',
    );
  }
  await ctx.tx.insert(academyLinks).values({
    profileId,
    householdId: ctx.household.id,
    playerId,
    consentBy: ctx.actor.userId,
    consentAt: ctx.now,
  });
  return 'made';
}

/** Stars already given for this child's sittings on each of these days. */
async function grantedByDay(
  ctx: Ctx,
  profileId: string,
  dates: LocalDate[],
): Promise<Map<LocalDate, number>> {
  const byDay = new Map<LocalDate, number>();
  if (dates.length === 0) return byDay;
  const rows = await ctx.tx
    .select({
      localDate: academySessions.localDate,
      stars: sql<number>`coalesce(sum(${ledger.lifetime}), 0)::int`,
    })
    .from(academySessions)
    .innerJoin(ledger, eq(ledger.id, academySessions.creditTx))
    .where(
      and(
        eq(academySessions.householdId, ctx.household.id),
        eq(academySessions.profileId, profileId),
        isNotNull(academySessions.creditTx),
        inArray(academySessions.localDate, dates),
      ),
    )
    .groupBy(academySessions.localDate);
  for (const row of rows) byDay.set(row.localDate, Number(row.stars));
  return byDay;
}

function canEarnOn(ctx: Ctx, date: LocalDate): boolean {
  const age = daysBetween(date, ctx.today);
  return age >= 0 && age <= ACADEMY_EARNING_DAYS;
}

export async function importAcademy(ctx: Ctx, input: AcademyImportInput): Promise<AcademyImportResult> {
  if (!hasAccess(ctx.actor.level, 'guardian')) throw new Reject('forbidden', 'That is for a parent to do.');
  if (input.consent !== true) {
    throw new Reject(
      'invalid',
      'A parent needs to say yes to bringing in this child’s Academy progress first.',
    );
  }
  await loadChild(ctx, input.profileId);
  const checked = checkAcademyExport(input.file);
  if (!checked.ok) throw new AcademyFileRejected(checked.reason);
  const { file } = checked;
  const profileId = input.profileId;
  const link = await ensureLink(ctx, profileId, file.profile.id);

  const incoming = summariseAcademy(file, ctx.household.timeZone);
  const stored = await ctx.tx
    .select({
      sessionId: academySessions.sessionId,
      completed: academySessions.completed,
      attempts: academySessions.attempts,
      supported: academySessions.supported,
    })
    .from(academySessions)
    .where(and(eq(academySessions.householdId, ctx.household.id), eq(academySessions.profileId, profileId)));
  const known = new Map(stored.map((row) => [row.sessionId, row]));

  // New sittings: added once. A sitting id already in the household (under anyone) is left alone.
  const fresh = incoming.filter((session) => !known.has(session.sessionId));
  const added = new Set<string>();
  for (let start = 0; start < fresh.length; start += INSERT_CHUNK) {
    const rows = await ctx.tx
      .insert(academySessions)
      .values(
        fresh.slice(start, start + INSERT_CHUNK).map((session) => ({
          householdId: ctx.household.id,
          sessionId: session.sessionId,
          profileId,
          world: session.world,
          lessonId: session.lessonId,
          localDate: session.localDate,
          completed: session.completed,
          attempts: session.attempts,
          independent: session.independent,
          supported: session.supported,
          importedAt: ctx.now,
        })),
      )
      .onConflictDoNothing()
      .returning({ sessionId: academySessions.sessionId });
    for (const row of rows) added.add(row.sessionId);
  }

  // A sitting that was unfinished when it was last brought in is brought up to date; a finished one never changes.
  const moved: AcademySessionSummary[] = [];
  for (const session of incoming) {
    const before = known.get(session.sessionId);
    if (!before || before.completed) continue;
    if (
      before.attempts === session.attempts &&
      before.supported === session.supported &&
      before.completed === session.completed
    ) {
      continue;
    }
    const rows = await ctx.tx
      .update(academySessions)
      .set({
        completed: session.completed,
        attempts: session.attempts,
        independent: session.independent,
        supported: session.supported,
        importedAt: ctx.now,
      })
      .where(
        and(
          eq(academySessions.householdId, ctx.household.id),
          eq(academySessions.sessionId, session.sessionId),
          eq(academySessions.completed, false),
        ),
      )
      .returning({ sessionId: academySessions.sessionId });
    if (rows[0]) moved.push(session);
  }

  // Stars: for each sitting finished for the first time in this import, where the family has switched them on.
  const finishedNow = [...incoming.filter((s) => added.has(s.sessionId)), ...moved].filter(
    (s) => s.completed,
  );
  const rules = ctx.household.settings.academy.participation;
  let granted = 0;
  let heldBackByCap = 0;
  if (rules.enabled && rules.starsPerSession > 0) {
    const eligible = finishedNow
      .filter((session) => canEarnOn(ctx, session.localDate))
      .sort((a, b) => (a.localDate < b.localDate ? -1 : a.localDate > b.localDate ? 1 : 0));
    const used = await grantedByDay(ctx, profileId, [...new Set(eligible.map((s) => s.localDate))]);
    for (const session of eligible) {
      const already = used.get(session.localDate) ?? 0;
      const stars = Math.min(rules.starsPerSession, Math.max(0, rules.dailyCap - already));
      heldBackByCap += rules.starsPerSession - stars;
      if (stars <= 0) continue;
      const posted = await post(ctx, {
        profileId,
        kind: 'grant',
        available: spendable(stars, ctx.household.settings.bank.spendRatePercent),
        lifetime: stars,
        source: 'academy',
        key: `academy:${session.sessionId}`,
        note: 'Training Academy',
      });
      used.set(session.localDate, already + stars);
      if (posted.written) granted += stars;
      await ctx.tx
        .update(academySessions)
        .set({ creditTx: posted.entryId })
        .where(
          and(
            eq(academySessions.householdId, ctx.household.id),
            eq(academySessions.sessionId, session.sessionId),
          ),
        );
    }
  }

  await ctx.tx
    .update(academyLinks)
    .set({ lastImportAt: ctx.now })
    .where(and(eq(academyLinks.profileId, profileId), eq(academyLinks.householdId, ctx.household.id)));
  const result: AcademyImportResult = {
    sessions: {
      new: added.size,
      updated: moved.length,
      alreadyHad: incoming.length - added.size - moved.length,
    },
    stars: { granted, heldBackByCap },
  };
  await auditLog(ctx, 'academy.imported', { profileId, linked: link === 'made', ...result });
  await bumpRevision(ctx);
  return result;
}

/**
 * What a parent or carer sees: each island's practice over the last few weeks — sittings, how many were finished,
 * answers, and how many of those were given alone or with help. Every number comes with what it is out of. Only
 * this child, never next to anyone else, and nothing at all where no file has been brought in.
 */
export async function academySummary(
  ctx: Ctx,
  profileId: string,
  weeks: number = ACADEMY_SUMMARY_WEEKS.default,
): Promise<AcademySummary> {
  if (!hasAccess(ctx.actor.level, 'caregiver'))
    throw new Reject('forbidden', 'That is for a grown-up to see.');
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > ACADEMY_SUMMARY_WEEKS.max) {
    throw new Reject('invalid', `Choose between 1 and ${ACADEMY_SUMMARY_WEEKS.max} weeks.`);
  }
  const child = await ctx.tx
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.id, profileId), eq(profiles.householdId, ctx.household.id)))
    .limit(1);
  if (!child[0]) throw new Reject('not_found', 'That child is not here.');

  const links = await ctx.tx
    .select({ lastImportAt: academyLinks.lastImportAt })
    .from(academyLinks)
    .where(and(eq(academyLinks.profileId, profileId), eq(academyLinks.householdId, ctx.household.id)))
    .limit(1);
  const to = ctx.today;
  const from = addDays(to, -(weeks * 7 - 1));
  const rows = links[0]
    ? await ctx.tx
        .select({
          world: academySessions.world,
          sessions: sql<number>`count(*)::int`,
          completed: sql<number>`count(*) filter (where ${academySessions.completed})::int`,
          attempts: sql<number>`coalesce(sum(${academySessions.attempts}), 0)::int`,
          independent: sql<number>`coalesce(sum(${academySessions.independent}), 0)::int`,
          supported: sql<number>`coalesce(sum(${academySessions.supported}), 0)::int`,
        })
        .from(academySessions)
        .where(
          and(
            eq(academySessions.householdId, ctx.household.id),
            eq(academySessions.profileId, profileId),
            gte(academySessions.localDate, from),
            lte(academySessions.localDate, to),
          ),
        )
        .groupBy(academySessions.world)
    : [];
  const worlds: AcademyWorldSummary[] = rows
    .map((row) => ({
      world: row.world,
      sessions: Number(row.sessions),
      completed: Number(row.completed),
      attempts: Number(row.attempts),
      independent: Number(row.independent),
      supported: Number(row.supported),
    }))
    .sort((a, b) => a.world.localeCompare(b.world));
  return {
    profileId,
    linked: Boolean(links[0]),
    lastImportAt: links[0]?.lastImportAt?.toISOString() ?? null,
    weeks,
    from,
    to,
    worlds,
  };
}
