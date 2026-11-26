import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import {
  academyLinks,
  aiUsage,
  audit,
  devices,
  operations,
  shortcutTokens,
  weatherCache,
} from '../db/schema.js';
import type { Tx } from '../db/types.js';
import type { Ctx } from './context.js';

/**
 * How the household's connections are, and how they have been: the weather service, the planning helper, the
 * Training Academy, the Siri keys, the screens, and the requests screens send.
 *
 * Almost all of it is read from what is already kept for another reason — the answers given to requests (a
 * month), the helper's own account of what it spent, the record of set-up changes (thirteen months). Two things
 * are noted specially, because nothing else would remember them: a weather service that stopped answering (and
 * when it came back), and a request the server itself could not carry out.
 *
 * Nothing here holds a word a family typed: no list item, no name of a mission, no address. It names a screen
 * (as the family named it), a part of the house ("the shopping list"), and a kind of problem.
 */

export const HEALTH_DAYS = 30;

/** A weather service that has not answered this many times in a row (about a quarter of an hour) is worth a line. */
export const WEATHER_WORTH_NOTING = 3;

/** Set-up records that are about a connection or a screen. */
export const CONNECTION_ACTIONS = [
  'weather.failed',
  'weather.recovered',
  'sync.failed',
  'device.paired',
  'device.revoked',
  'academy.imported',
  'academy.unlinked',
  'shortcut.created',
  'shortcut.revoked',
  'wall.pin_locked_out',
] as const;

/**
 * The helper's lines that are book-keeping (money set aside before a request, and given back after), not
 * attempts. The same two words as in server/ai/run.ts; a test holds them together.
 */
export const HELPER_BOOKKEEPING: readonly string[] = ['reserved', 'released'];

/** Which part of the house a request was about, in a grown-up's words. Never the request's own contents. */
export function areaOf(type: string): string {
  const head = type.split('.')[0] ?? '';
  const areas: Record<string, string> = {
    occurrence: 'missions',
    task: 'missions',
    run: 'routines',
    routine: 'routines',
    redemption: 'rewards',
    reward: 'rewards',
    goal: 'rewards',
    ledger: 'stars',
    shopping: 'the shopping list',
    list: 'the shopping list',
    profile: 'children',
    household: 'settings',
    member: 'grown-ups',
    device: 'screens',
    calendar: 'kinds of day',
    milestone: 'moments',
    media: 'photos',
    academy: 'the Academy',
    history: 'the look-back',
  };
  return areas[head] ?? 'something else';
}

export interface HealthLine {
  at: string;
  /** What kind of thing happened: one of a fixed set of words the phone knows how to say. */
  what: string;
  /** The grown-up or the screen, as the family named them; "auto" for HOMEBASE itself. */
  who: string;
  /** A short fixed word or number that goes with it: a part of the house, a count. Never anything typed. */
  about: string | null;
}

export interface HealthReport {
  days: number;
  weather: { on: boolean; observedAt: string | null; failures: number };
  helper: { on: boolean; ok: number; failed: number; lastOkAt: string | null; lastFailedAt: string | null };
  academy: { on: boolean; linked: number; lastImportAt: string | null };
  shortcuts: { active: number; lastUsedAt: string | null };
  screens: { name: string; kind: string; addedAt: string; lastSeenAt: string | null; switchedOff: boolean }[];
  /** Requests from screens over these days: done, answered with an ordinary "no", refused, or failed here. */
  requests: { done: number; ordinaryNo: number; refused: number; failed: number };
  lines: HealthLine[];
}

const iso = (value: Date | null | undefined): string | null => (value ? value.toISOString() : null);

export async function healthReport(ctx: Ctx): Promise<HealthReport> {
  const settings = ctx.household.settings;
  const since = new Date(ctx.now.getTime() - HEALTH_DAYS * 24 * 60 * 60 * 1000);
  const mine = ctx.household.id;

  const weatherRows = await ctx.tx
    .select({ observedAt: weatherCache.observedAt, failures: weatherCache.failures })
    .from(weatherCache)
    .where(eq(weatherCache.householdId, mine))
    .limit(1);
  const weatherOn = settings.sky.weather && settings.location !== null;
  const observed = weatherRows[0]?.observedAt;

  const helperRows = await ctx.tx
    .select({
      ok: sql<number>`count(*) filter (where ${aiUsage.outcome} = 'ok')::int`,
      failed: sql<number>`count(*) filter (where ${aiUsage.outcome} <> 'ok')::int`,
      lastOkAt: sql<string | null>`max(${aiUsage.at}) filter (where ${aiUsage.outcome} = 'ok')`,
      lastFailedAt: sql<string | null>`max(${aiUsage.at}) filter (where ${aiUsage.outcome} <> 'ok')`,
    })
    .from(aiUsage)
    .where(
      and(
        eq(aiUsage.householdId, mine),
        gte(aiUsage.at, since),
        sql`${aiUsage.outcome} not in (${sql.join(
          HELPER_BOOKKEEPING.map((word) => sql`${word}`),
          sql`, `,
        )})`,
      ),
    );
  const helper = helperRows[0];

  const links = await ctx.tx
    .select({ lastImportAt: academyLinks.lastImportAt })
    .from(academyLinks)
    .where(eq(academyLinks.householdId, mine));
  const lastImport = links.reduce<Date | null>(
    (latest, row) => (row.lastImportAt && (!latest || row.lastImportAt > latest) ? row.lastImportAt : latest),
    null,
  );

  const tokens = await ctx.tx
    .select({ lastUsedAt: shortcutTokens.lastUsedAt })
    .from(shortcutTokens)
    .where(and(eq(shortcutTokens.householdId, mine), isNull(shortcutTokens.revokedAt)));
  const lastUsed = tokens.reduce<Date | null>(
    (latest, row) => (row.lastUsedAt && (!latest || row.lastUsedAt > latest) ? row.lastUsedAt : latest),
    null,
  );

  const screens = await ctx.tx
    .select({
      name: devices.name,
      kind: devices.kind,
      createdAt: devices.createdAt,
      lastSeenAt: devices.lastSeenAt,
      revokedAt: devices.revokedAt,
    })
    .from(devices)
    .where(eq(devices.householdId, mine))
    .orderBy(desc(devices.createdAt))
    .limit(40);

  const counted = await ctx.tx
    .select({
      done: sql<number>`count(*) filter (where ${operations.status} in ('applied', 'noop'))::int`,
      refused: sql<number>`count(*) filter (where ${operations.status} = 'rejected' and ${operations.result}->>'reason' in ('invalid', 'forbidden'))::int`,
      ordinaryNo: sql<number>`count(*) filter (where ${operations.status} = 'rejected' and ${operations.result}->>'reason' not in ('invalid', 'forbidden'))::int`,
    })
    .from(operations)
    .where(and(eq(operations.householdId, mine), gte(operations.createdAt, since)));

  // The lines themselves: refused requests, the helper's troubles, and the set-up records about connections.
  const refusedOps = await ctx.tx
    .select({
      at: operations.createdAt,
      type: operations.type,
      actor: operations.actor,
      reason: sql<string>`${operations.result}->>'reason'`,
    })
    .from(operations)
    .where(
      and(
        eq(operations.householdId, mine),
        gte(operations.createdAt, since),
        eq(operations.status, 'rejected'),
        sql`${operations.result}->>'reason' in ('invalid', 'forbidden')`,
      ),
    )
    .orderBy(desc(operations.createdAt))
    .limit(40);
  const helperTroubles = await ctx.tx
    .select({ at: aiUsage.at, outcome: aiUsage.outcome })
    .from(aiUsage)
    .where(
      and(
        eq(aiUsage.householdId, mine),
        gte(aiUsage.at, since),
        sql`${aiUsage.outcome} not in ('ok', ${sql.join(
          HELPER_BOOKKEEPING.map((word) => sql`${word}`),
          sql`, `,
        )})`,
      ),
    )
    .orderBy(desc(aiUsage.at))
    .limit(20);
  const noted = await ctx.tx
    .select({ at: audit.at, action: audit.action, actor: audit.actor, detail: audit.detail })
    .from(audit)
    .where(
      and(eq(audit.householdId, mine), gte(audit.at, since), inArray(audit.action, [...CONNECTION_ACTIONS])),
    )
    .orderBy(desc(audit.at))
    .limit(60);

  const failed = noted.filter((row) => row.action === 'sync.failed').length;
  const lines: HealthLine[] = [
    ...refusedOps.map((row) => ({
      at: row.at.toISOString(),
      what: row.reason === 'forbidden' ? 'request.not_allowed' : 'request.made_no_sense',
      who: row.actor,
      about: areaOf(row.type),
    })),
    ...helperTroubles.map((row) => ({
      at: row.at.toISOString(),
      what: 'helper.failed',
      who: 'auto',
      // One of the helper's own fixed words for what went wrong.
      about: /^[a-z_]{1,30}$/.test(row.outcome) ? row.outcome : null,
    })),
    ...noted.map((row) => {
      const detail = row.detail;
      let about: string | null = null;
      if (row.action === 'weather.recovered' && typeof detail.after === 'number')
        about = String(detail.after);
      else if (row.action === 'sync.failed' && typeof detail.type === 'string') about = areaOf(detail.type);
      return { at: row.at.toISOString(), what: row.action, who: row.actor, about };
    }),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 60);

  return {
    days: HEALTH_DAYS,
    weather: {
      on: weatherOn,
      // The cache's "never" is the year dot: nothing has been heard yet.
      observedAt: weatherOn && observed && observed.getTime() > 0 ? observed.toISOString() : null,
      failures: weatherOn ? (weatherRows[0]?.failures ?? 0) : 0,
    },
    helper: {
      on: settings.ai.enabled && settings.ai.provider !== null,
      ok: Number(helper?.ok ?? 0),
      failed: Number(helper?.failed ?? 0),
      lastOkAt: helper?.lastOkAt ? new Date(helper.lastOkAt).toISOString() : null,
      lastFailedAt: helper?.lastFailedAt ? new Date(helper.lastFailedAt).toISOString() : null,
    },
    academy: { on: settings.academy.enabled, linked: links.length, lastImportAt: iso(lastImport) },
    shortcuts: { active: tokens.length, lastUsedAt: iso(lastUsed) },
    screens: screens.map((row) => ({
      name: row.name,
      kind: row.kind,
      addedAt: row.createdAt.toISOString(),
      lastSeenAt: iso(row.lastSeenAt),
      switchedOff: row.revokedAt !== null,
    })),
    requests: {
      done: Number(counted[0]?.done ?? 0),
      ordinaryNo: Number(counted[0]?.ordinaryNo ?? 0),
      refused: Number(counted[0]?.refused ?? 0),
      failed,
    },
    lines,
  };
}

/** Write one line into the household's set-up record on HOMEBASE's own behalf. */
export async function noteConnection(
  tx: Tx,
  householdId: string,
  at: Date,
  action: (typeof CONNECTION_ACTIONS)[number],
  actor: string,
  detail: Record<string, string | number>,
): Promise<void> {
  await tx.insert(audit).values({ id: crypto.randomUUID(), householdId, at, action, actor, detail });
}
