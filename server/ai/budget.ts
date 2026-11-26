import { and, eq, gte, sql } from 'drizzle-orm';
import type { HouseholdSettings } from '../../shared/settings.js';
import type { LocalDate } from '../../shared/time.js';
import { aiUsage } from '../db/schema.js';
import type { Tx } from '../db/types.js';
import { costMillicents, type Price } from './pricing.js';

/**
 * Keeping a household's spending inside the limits its grown-ups set.
 *
 * Before a request, the dearest it could possibly be is worked out (every character a token's worth of a third
 * — tokens are usually nearer four characters — plus the whole output allowance) and set beside what has been
 * spent today and this month. Only if both limits still have room is the request made. Afterwards, what it
 * actually cost is written down, whatever happened. A limit of 0 means "spend nothing".
 */

/** A safe over-estimate of the tokens in some text. */
export function estimateTokens(...texts: string[]): number {
  const characters = texts.reduce((sum, text) => sum + text.length, 0);
  // A little for the request's own wrapping and the schema the reply must follow.
  return Math.ceil(characters / 3) + 200;
}

export function worstCaseMillicents(price: Price, inputTokens: number, maxOutputTokens: number): number {
  return costMillicents(price, inputTokens, maxOutputTokens);
}

export interface Spent {
  todayMillicents: number;
  monthMillicents: number;
}

export function monthStart(today: LocalDate): LocalDate {
  return `${today.slice(0, 7)}-01`;
}

export async function spentSoFar(tx: Tx, householdId: string, today: LocalDate): Promise<Spent> {
  const rows = await tx
    .select({
      today: sql<number>`coalesce(sum(${aiUsage.costMillicents}) filter (where ${aiUsage.localDate} = ${today}), 0)::int`,
      month: sql<number>`coalesce(sum(${aiUsage.costMillicents}), 0)::int`,
    })
    .from(aiUsage)
    .where(and(eq(aiUsage.householdId, householdId), gte(aiUsage.localDate, monthStart(today))));
  return { todayMillicents: Number(rows[0]?.today ?? 0), monthMillicents: Number(rows[0]?.month ?? 0) };
}

export type CapProblem = 'cap_daily' | 'cap_monthly';

/** Which limit, if any, a request costing up to `worst` would go past. */
export function capProblem(
  ai: Pick<HouseholdSettings['ai'], 'dailyCapCents' | 'monthlyCapCents'>,
  spent: Spent,
  worst: number,
): CapProblem | null {
  if (ai.dailyCapCents <= 0 || spent.todayMillicents + worst > ai.dailyCapCents * 1000) return 'cap_daily';
  if (ai.monthlyCapCents <= 0 || spent.monthMillicents + worst > ai.monthlyCapCents * 1000)
    return 'cap_monthly';
  return null;
}

/** Thousandths of a cent, as whole cents for a person, rounded up. */
export function centsOf(millicents: number): number {
  return Math.ceil(millicents / 1000);
}
