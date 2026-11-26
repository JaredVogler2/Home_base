import { and, desc, eq, sql } from 'drizzle-orm';
import type { LedgerEntry, LedgerKind, LedgerSource, Wallet } from '../../shared/model.js';
import { ledger, profiles, wallets } from '../db/schema.js';
import { Reject, type Ctx } from './context.js';

/**
 * The star ledger: the one place stars are made, set aside, spent or given back.
 *
 * Three totals are kept for each child:
 *   available  what can be spent now
 *   reserved   set aside for a reward that has been asked for and not yet answered
 *   lifetime   everything ever earned; spending never lowers it
 *
 * Every change is a line that says how each total moved, what for, and who did it. A line carries a key naming
 * what it is for ("the stars for this mission, first time"); a second line with the same key is not written, so
 * nothing can be paid twice — not by a double tap, not by a retry, not by two phones. The totals in `wallets`
 * are updated in the same transaction as the line and can always be worked out again from the lines alone.
 */

export interface Posting {
  /** A fixed id where the screen chose one (a bonus, a correction); otherwise one is made. */
  id?: string;
  profileId: string;
  kind: LedgerKind;
  available?: number;
  reserved?: number;
  lifetime?: number;
  source: LedgerSource;
  sourceId?: string | null;
  /** Names what this line is for. Unique in the household, for ever. */
  key: string;
  note?: string | null;
  reverses?: string | null;
  /** Who it is recorded as, when not the person asking (the "auto" credit of a mission). */
  actor?: string;
}

export interface Posted {
  entryId: string;
  /** False when a line with this key was already there: nothing was changed. */
  written: boolean;
  wallet: Wallet;
}

async function lockWallet(ctx: Ctx, profileId: string): Promise<Wallet> {
  await ctx.tx
    .insert(wallets)
    .values({ profileId, householdId: ctx.household.id })
    .onConflictDoNothing({ target: wallets.profileId });
  const rows = await ctx.tx
    .select()
    .from(wallets)
    .where(eq(wallets.profileId, profileId))
    .limit(1)
    .for('update');
  const row = rows[0];
  if (!row) throw new Reject('not_found', 'That child is not here.');
  return { profileId, available: row.available, reserved: row.reserved, lifetime: row.lifetime };
}

export async function post(ctx: Ctx, posting: Posting): Promise<Posted> {
  const available = posting.available ?? 0;
  const reserved = posting.reserved ?? 0;
  const lifetime = posting.lifetime ?? 0;

  const child = await ctx.tx
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.id, posting.profileId), eq(profiles.householdId, ctx.household.id)))
    .limit(1);
  if (!child[0]) throw new Reject('not_found', 'That child is not here.');

  const wallet = await lockWallet(ctx, posting.profileId);

  const before = await ctx.tx
    .select({ id: ledger.id })
    .from(ledger)
    .where(and(eq(ledger.householdId, ctx.household.id), eq(ledger.idempotencyKey, posting.key)))
    .limit(1);
  if (before[0]) return { entryId: before[0].id, written: false, wallet };

  const next: Wallet = {
    profileId: posting.profileId,
    available: wallet.available + available,
    reserved: wallet.reserved + reserved,
    lifetime: wallet.lifetime + lifetime,
  };
  if (next.available < 0) throw new Reject('not_enough_stars', 'There are not enough stars for that yet.');
  if (next.reserved < 0 || next.lifetime < 0) {
    throw new Reject('invalid', 'That would take away more stars than were ever there.');
  }

  const entryId = posting.id ?? crypto.randomUUID();
  const inserted = await ctx.tx
    .insert(ledger)
    .values({
      id: entryId,
      householdId: ctx.household.id,
      profileId: posting.profileId,
      kind: posting.kind,
      available,
      reserved,
      lifetime,
      source: posting.source,
      sourceId: posting.sourceId ?? null,
      idempotencyKey: posting.key,
      reverses: posting.reverses ?? null,
      note: posting.note ?? null,
      actor: posting.actor ?? ctx.actor.name,
      at: ctx.now,
    })
    .onConflictDoNothing()
    .returning({ id: ledger.id });
  if (!inserted[0]) {
    // The id was used before (a replayed bonus with a new key cannot happen; this is the same request again).
    return { entryId, written: false, wallet };
  }

  await ctx.tx
    .update(wallets)
    .set({ available: next.available, reserved: next.reserved, lifetime: next.lifetime, updatedAt: ctx.now })
    .where(eq(wallets.profileId, posting.profileId));
  return { entryId, written: true, wallet: next };
}

/** How many stars to spend an earned star becomes, by the household's rate. Lifetime stars are never scaled. */
export function spendable(stars: number, ratePercent: number): number {
  return Math.floor((stars * ratePercent) / 100);
}

export async function walletOf(ctx: Ctx, profileId: string): Promise<Wallet> {
  const rows = await ctx.tx.select().from(wallets).where(eq(wallets.profileId, profileId)).limit(1);
  const row = rows[0];
  return {
    profileId,
    available: row?.available ?? 0,
    reserved: row?.reserved ?? 0,
    lifetime: row?.lifetime ?? 0,
  };
}

export async function listLedger(
  ctx: Ctx,
  profileId: string,
  limit: number,
  before?: Date,
): Promise<LedgerEntry[]> {
  const rows = await ctx.tx
    .select()
    .from(ledger)
    .where(
      and(
        eq(ledger.householdId, ctx.household.id),
        eq(ledger.profileId, profileId),
        before ? sql`${ledger.at} < ${before.toISOString()}::timestamptz` : undefined,
      ),
    )
    .orderBy(desc(ledger.at), desc(ledger.id))
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    profileId: row.profileId,
    at: row.at.toISOString(),
    kind: row.kind as LedgerKind,
    available: row.available,
    reserved: row.reserved,
    lifetime: row.lifetime,
    source: row.source as LedgerSource,
    sourceId: row.sourceId,
    note: row.note,
    actor: row.actor,
  }));
}

export interface Reconciliation {
  profileId: string;
  wallet: Wallet;
  fromLedger: Wallet;
  matches: boolean;
}

/** Work the totals out again from the lines, and say whether the kept totals agree. They always should. */
export async function reconcile(ctx: Ctx): Promise<Reconciliation[]> {
  const sums = await ctx.tx
    .select({
      profileId: ledger.profileId,
      available: sql<number>`coalesce(sum(${ledger.available}), 0)::int`,
      reserved: sql<number>`coalesce(sum(${ledger.reserved}), 0)::int`,
      lifetime: sql<number>`coalesce(sum(${ledger.lifetime}), 0)::int`,
    })
    .from(ledger)
    .where(eq(ledger.householdId, ctx.household.id))
    .groupBy(ledger.profileId);
  const kept = await ctx.tx.select().from(wallets).where(eq(wallets.householdId, ctx.household.id));
  const byProfile = new Map(sums.map((row) => [row.profileId, row]));
  const ids = new Set([...kept.map((row) => row.profileId), ...byProfile.keys()]);
  return [...ids].map((profileId) => {
    const row = kept.find((wallet) => wallet.profileId === profileId);
    const wallet: Wallet = {
      profileId,
      available: row?.available ?? 0,
      reserved: row?.reserved ?? 0,
      lifetime: row?.lifetime ?? 0,
    };
    const sum = byProfile.get(profileId);
    const fromLedger: Wallet = {
      profileId,
      available: Number(sum?.available ?? 0),
      reserved: Number(sum?.reserved ?? 0),
      lifetime: Number(sum?.lifetime ?? 0),
    };
    return {
      profileId,
      wallet,
      fromLedger,
      matches:
        wallet.available === fromLedger.available &&
        wallet.reserved === fromLedger.reserved &&
        wallet.lifetime === fromLedger.lifetime,
    };
  });
}
