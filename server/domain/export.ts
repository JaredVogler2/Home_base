import { asc, eq } from 'drizzle-orm';
import {
  academySessions,
  audit,
  badges,
  calendarDays,
  calendarRules,
  events,
  ledger,
  profiles,
  routineRuns,
  routineStepEvents,
  shoppingItemHistory,
  shoppingItems,
  taskOccurrences,
  wallets,
  weeklyTotals,
} from '../db/schema.js';
import { listGoals, listRedemptions, listRewards } from './bank.js';
import { auditLog, bumpRevision, Reject, type Ctx } from './context.js';
import {
  listAcademyLinks,
  listDevices,
  listMedia,
  listMembers,
  listMilestones,
  listProfiles,
} from './family.js';
import { listTemplates } from './quest.js';
import { listRoutines } from './routines.js';
import { listLists } from './shopping.js';

/**
 * Taking the family's records away with them, and taking them away for good.
 *
 * An export is everything HOMEBASE keeps about the household, as one file a person can read: the children's
 * nicknames and stars, every mission and routine, the lists, the look-back. It leaves out what is not the
 * family's to carry anywhere — password and PIN hashes, session and shortcut tokens — and the photographs
 * themselves, which the parent already has. Deleting a child removes that child's every record; the star ledger,
 * which nothing else may ever change, goes with the child it belongs to.
 */

export const EXPORT_FORMAT = 'homebase.household-export';
export const EXPORT_VERSION = 1;

const iso = (value: Date | null | undefined): string | null => (value ? value.toISOString() : null);

export async function exportHousehold(ctx: Ctx): Promise<Record<string, unknown>> {
  const household = eq;
  const id = ctx.household.id;
  const [
    occurrenceRows,
    ledgerRows,
    walletRows,
    runRows,
    stepRows,
    itemRows,
    itemHistoryRows,
    dayRows,
    ruleRows,
    eventRows,
    totalRows,
    sessionRows,
    badgeRows,
    auditRows,
  ] = [
    await ctx.tx
      .select()
      .from(taskOccurrences)
      .where(household(taskOccurrences.householdId, id))
      .orderBy(asc(taskOccurrences.localDate)),
    await ctx.tx.select().from(ledger).where(household(ledger.householdId, id)).orderBy(asc(ledger.at)),
    await ctx.tx.select().from(wallets).where(household(wallets.householdId, id)),
    await ctx.tx
      .select()
      .from(routineRuns)
      .where(household(routineRuns.householdId, id))
      .orderBy(asc(routineRuns.localDate)),
    await ctx.tx
      .select()
      .from(routineStepEvents)
      .where(household(routineStepEvents.householdId, id))
      .orderBy(asc(routineStepEvents.at)),
    await ctx.tx
      .select()
      .from(shoppingItems)
      .where(household(shoppingItems.householdId, id))
      .orderBy(asc(shoppingItems.createdAt)),
    await ctx.tx
      .select()
      .from(shoppingItemHistory)
      .where(household(shoppingItemHistory.householdId, id))
      .orderBy(asc(shoppingItemHistory.at)),
    await ctx.tx
      .select()
      .from(calendarDays)
      .where(household(calendarDays.householdId, id))
      .orderBy(asc(calendarDays.localDate)),
    await ctx.tx.select().from(calendarRules).where(household(calendarRules.householdId, id)),
    await ctx.tx.select().from(events).where(household(events.householdId, id)).orderBy(asc(events.at)),
    await ctx.tx
      .select()
      .from(weeklyTotals)
      .where(household(weeklyTotals.householdId, id))
      .orderBy(asc(weeklyTotals.weekStart)),
    await ctx.tx
      .select()
      .from(academySessions)
      .where(household(academySessions.householdId, id))
      .orderBy(asc(academySessions.localDate)),
    await ctx.tx.select().from(badges).where(household(badges.householdId, id)),
    await ctx.tx.select().from(audit).where(household(audit.householdId, id)).orderBy(asc(audit.at)),
  ];

  await auditLog(ctx, 'export.made', { format: 'json' });
  return {
    format: EXPORT_FORMAT,
    formatVersion: EXPORT_VERSION,
    exportedAt: ctx.now.toISOString(),
    notIncluded: [
      'passwords, wall PINs and recovery codes (only their one-way hashes are kept, and those stay here)',
      'sign-in sessions, screen pairings and Siri shortcut tokens',
      'the photographs themselves (their list is included)',
      'keys for any outside service',
    ],
    household: {
      name: ctx.household.name,
      timeZone: ctx.household.timeZone,
      settings: ctx.household.settings,
    },
    grownUps: (await listMembers(ctx)).map((member) => ({
      displayName: member.displayName,
      role: member.role,
      avatar: member.avatar,
    })),
    children: await listProfiles(ctx, true),
    screens: await listDevices(ctx),
    missions: await listTemplates(ctx),
    missionDays: occurrenceRows.map((row) => ({
      id: row.id,
      templateId: row.templateId,
      templateVersion: row.templateVersion,
      profileId: row.profileId,
      date: row.localDate,
      status: row.status,
      stars: row.stars,
      doneBy: row.doneBy,
      submittedAt: iso(row.submittedAt),
      decidedAt: iso(row.decidedAt),
      decidedBy: row.decidedBy,
      returnReason: row.returnReason,
      helpAsked: row.helpAsked,
      creditLine: row.creditTx,
    })),
    stars: {
      totals: walletRows.map((row) => ({
        profileId: row.profileId,
        available: row.available,
        reserved: row.reserved,
        lifetime: row.lifetime,
      })),
      ledger: ledgerRows.map((row) => ({
        id: row.id,
        profileId: row.profileId,
        at: iso(row.at),
        kind: row.kind,
        available: row.available,
        reserved: row.reserved,
        lifetime: row.lifetime,
        source: row.source,
        sourceId: row.sourceId,
        key: row.idempotencyKey,
        reverses: row.reverses,
        note: row.note,
        actor: row.actor,
      })),
    },
    rewards: await listRewards(ctx, true),
    rewardRequests: await listRedemptions(ctx),
    savingFor: await listGoals(ctx),
    routines: await listRoutines(ctx, true),
    routineRuns: runRows.map((row) => ({
      id: row.id,
      routineId: row.routineId,
      routineVersion: row.routineVersion,
      profileId: row.profileId,
      date: row.localDate,
      status: row.status,
      startedAt: iso(row.startedAt),
      completedAt: iso(row.completedAt),
    })),
    routineSteps: stepRows.map((row) => ({
      runId: row.runId,
      stepId: row.stepId,
      kind: row.kind,
      at: iso(row.at),
      actor: row.actor,
    })),
    lists: await listLists(ctx),
    listItems: itemRows.map((row) => ({
      id: row.id,
      listId: row.listId,
      text: row.text,
      picture: row.picture,
      category: row.category,
      quantity: row.quantity,
      unit: row.unit,
      note: row.note,
      url: row.url,
      store: row.store,
      priority: row.priority,
      status: row.status,
      requestedBy: row.requestedBy,
      addedBy: row.addedBy,
      createdAt: iso(row.createdAt),
      checkedAt: iso(row.checkedAt),
      removedAt: iso(row.deletedAt ?? row.archivedAt),
    })),
    listItemHistory: itemHistoryRows.map((row) => ({
      itemId: row.itemId,
      at: iso(row.at),
      actor: row.actor,
      change: row.change,
      before: row.before,
      after: row.after,
    })),
    kindsOfDay: dayRows.map((row) => ({ date: row.localDate, label: row.label, source: row.source })),
    calendarRules: ruleRows.map((row) => ({ match: row.match, label: row.label })),
    milestones: await listMilestones(ctx),
    photographs: await listMedia(ctx, false),
    academy: {
      links: await listAcademyLinks(ctx),
      sessions: sessionRows.map((row) => ({
        sessionId: row.sessionId,
        profileId: row.profileId,
        world: row.world,
        lessonId: row.lessonId,
        date: row.localDate,
        completed: row.completed,
        attempts: row.attempts,
        independent: row.independent,
        supported: row.supported,
      })),
    },
    lookBack: {
      events: eventRows.map((row) => ({
        id: row.id,
        at: iso(row.at),
        date: row.localDate,
        kind: row.kind,
        profileId: row.profileId,
        subjectId: row.subjectId,
        data: row.data,
        actor: row.actor,
      })),
      weeklyTotals: totalRows.map((row) => ({
        weekStart: row.weekStart,
        profileId: row.profileId,
        metric: row.metric,
        value: row.value,
      })),
      badges: badgeRows.map((row) => ({
        profileId: row.profileId,
        badge: row.badge,
        earnedOn: row.earnedOn,
      })),
    },
    setUpChanges: auditRows.map((row) => ({
      at: iso(row.at),
      action: row.action,
      actor: row.actor,
      detail: row.detail,
    })),
  };
}

/** One cell of a spreadsheet file. A cell that a spreadsheet would run as a formula is made plain text. */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  // A cell that begins like a formula is made plain text, so a spreadsheet never runs it. A plain number is left
  // a number — "-3" stars is a figure, not a formula.
  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** The star ledger as a spreadsheet: one line for each line, oldest first. */
export async function ledgerCsv(ctx: Ctx): Promise<string> {
  const names = new Map((await listProfiles(ctx, true)).map((profile) => [profile.id, profile.nickname]));
  const rows = await ctx.tx
    .select()
    .from(ledger)
    .where(eq(ledger.householdId, ctx.household.id))
    .orderBy(asc(ledger.at));
  await auditLog(ctx, 'export.made', { format: 'csv', what: 'ledger' });
  return toCsv(
    ['when', 'child', 'kind', 'to spend', 'set aside', 'earned in all', 'from', 'note', 'by'],
    rows.map((row) => [
      row.at.toISOString(),
      names.get(row.profileId) ?? row.profileId,
      row.kind,
      row.available,
      row.reserved,
      row.lifetime,
      row.source,
      row.note,
      row.actor,
    ]),
  );
}

/** The day-by-day look-back as a spreadsheet. */
export async function eventsCsv(ctx: Ctx): Promise<string> {
  const names = new Map((await listProfiles(ctx, true)).map((profile) => [profile.id, profile.nickname]));
  const rows = await ctx.tx
    .select()
    .from(events)
    .where(eq(events.householdId, ctx.household.id))
    .orderBy(asc(events.at));
  await auditLog(ctx, 'export.made', { format: 'csv', what: 'history' });
  return toCsv(
    ['when', 'day', 'what', 'child', 'by', 'details'],
    rows.map((row) => [
      row.at.toISOString(),
      row.localDate,
      row.kind,
      row.profileId ? (names.get(row.profileId) ?? row.profileId) : '',
      row.actor,
      JSON.stringify(row.data),
    ]),
  );
}

/**
 * Delete a child and everything kept about them: missions, routine runs, stars and their ledger, reward
 * requests, Academy link, look-back. It cannot be undone. The nickname must be typed to match, so that a slip
 * of the thumb on the wrong row does nothing.
 */
export async function deleteProfile(ctx: Ctx, profileId: string, typedNickname: string): Promise<void> {
  const rows = await ctx.tx
    .select({ id: profiles.id, nickname: profiles.nickname })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Reject('not_found', 'That child is not here.');
  if (row.nickname.trim().toLowerCase() !== typedNickname.trim().toLowerCase()) {
    throw new Reject('invalid', 'Type the child’s nickname exactly, to be sure.');
  }
  await ctx.tx.delete(profiles).where(eq(profiles.id, profileId));
  // The note says that a child was deleted, and by whom — not who the child was.
  await auditLog(ctx, 'profile.deleted', {});
  await bumpRevision(ctx);
}
