import { and, desc, eq, gte, inArray, ne, or, sql } from 'drizzle-orm';
import type { DeclineReason, Goal, Redemption, RedemptionStatus, Reward } from '../../shared/model.js';
import type { OpInput } from '../../shared/ops.js';
import type { RewardPictureId } from '../../shared/pictures.js';
import { goals, profiles, redemptions, rewards } from '../db/schema.js';
import { Reject, record, type Ctx } from './context.js';
import { post, walletOf } from './ledger.js';

/**
 * The reward shop.
 *
 * A reward is something a grown-up has agreed to — a game, a story, an outing — with a price in stars. When a
 * child asks for one, the stars are set aside at once (so they cannot be spent twice) and nothing else happens
 * until a grown-up answers:
 *
 *     requested ─ yes → approved ─ it happened → fulfilled
 *         │                 └────── changed our minds → refunded   (stars come back)
 *         ├─ not this time → declined                              (stars come back)
 *         └─ the child changed their mind → cancelled              (stars come back)
 *
 * The price a child agreed to is the price they saw: if the offer changed in between, the request is turned
 * down and shown again. Lifetime stars never move here — spending is not un-earning.
 */

type RewardRow = typeof rewards.$inferSelect;
type RedemptionRow = typeof redemptions.$inferSelect;

function toReward(row: RewardRow): Reward {
  return {
    id: row.id,
    version: row.version,
    status: row.status as Reward['status'],
    title: row.title,
    picture: row.picture as RewardPictureId,
    say: row.say,
    price: row.price,
    stock: row.stock,
    profiles: row.profiles,
    sort: row.sort,
  };
}

function toRedemption(row: RedemptionRow): Redemption {
  return {
    id: row.id,
    profileId: row.profileId,
    rewardId: row.rewardId,
    title: row.title,
    picture: row.picture as RewardPictureId,
    price: row.price,
    status: row.status as RedemptionStatus,
    requestedAt: row.requestedAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    fulfilledAt: row.fulfilledAt?.toISOString() ?? null,
    declineReason: row.declineReason as DeclineReason | null,
  };
}

async function assertProfiles(ctx: Ctx, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const found = await ctx.tx
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.householdId, ctx.household.id), inArray(profiles.id, [...ids])));
  if (found.length !== new Set(ids).size)
    throw new Reject('invalid', 'One of those children is not in this family.');
}

// ---------------------------------------------------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------------------------------------------------

export async function createReward(ctx: Ctx, input: OpInput<'reward.create'>): Promise<void> {
  await assertProfiles(ctx, input.profiles);
  const existing = await ctx.tx
    .select({ id: rewards.id })
    .from(rewards)
    .where(eq(rewards.id, input.rewardId));
  if (existing[0]) throw new Reject('conflict', 'That reward already exists.');
  const last = await ctx.tx
    .select({ sort: sql<number>`coalesce(max(${rewards.sort}), 0)::int` })
    .from(rewards)
    .where(eq(rewards.householdId, ctx.household.id));
  await ctx.tx.insert(rewards).values({
    id: input.rewardId,
    householdId: ctx.household.id,
    title: input.title,
    picture: input.picture,
    say: input.say,
    price: input.price,
    stock: input.stock,
    profiles: [...new Set(input.profiles)],
    sort: Number(last[0]?.sort ?? 0) + 1,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  });
}

export async function updateReward(ctx: Ctx, input: OpInput<'reward.update'>): Promise<{ version: number }> {
  await assertProfiles(ctx, input.profiles);
  const rows = await ctx.tx
    .select()
    .from(rewards)
    .where(and(eq(rewards.id, input.rewardId), eq(rewards.householdId, ctx.household.id)))
    .limit(1);
  const reward = rows[0];
  if (!reward) throw new Reject('not_found', 'That reward is not here any more.');
  if (reward.version !== input.baseVersion) {
    throw new Reject('conflict', 'Someone else changed this reward while you were editing it.');
  }
  const version = reward.version + 1;
  await ctx.tx
    .update(rewards)
    .set({
      title: input.title,
      picture: input.picture,
      say: input.say,
      price: input.price,
      stock: input.stock,
      profiles: [...new Set(input.profiles)],
      version,
      updatedAt: ctx.now,
    })
    .where(eq(rewards.id, reward.id));
  return { version };
}

export async function setRewardStatus(ctx: Ctx, input: OpInput<'reward.status'>): Promise<void> {
  const rows = await ctx.tx
    .update(rewards)
    .set({ status: input.status, version: sql`${rewards.version} + 1`, updatedAt: ctx.now })
    .where(and(eq(rewards.id, input.rewardId), eq(rewards.householdId, ctx.household.id)))
    .returning({ id: rewards.id });
  if (!rows[0]) throw new Reject('not_found', 'That reward is not here any more.');
  if (input.status !== 'active') {
    // Nobody is left saving for something that is no longer offered.
    await ctx.tx.delete(goals).where(eq(goals.rewardId, input.rewardId));
  }
}

export async function listRewards(ctx: Ctx, includePaused: boolean): Promise<Reward[]> {
  const rows = await ctx.tx
    .select()
    .from(rewards)
    .where(
      and(
        eq(rewards.householdId, ctx.household.id),
        includePaused ? ne(rewards.status, 'archived') : eq(rewards.status, 'active'),
      ),
    )
    .orderBy(rewards.sort);
  return rows.map(toReward);
}

// ---------------------------------------------------------------------------------------------------------------------
// Asking, and being answered
// ---------------------------------------------------------------------------------------------------------------------

async function loadRedemption(ctx: Ctx, redemptionId: string): Promise<RedemptionRow> {
  const rows = await ctx.tx
    .select()
    .from(redemptions)
    .where(and(eq(redemptions.id, redemptionId), eq(redemptions.householdId, ctx.household.id)))
    .limit(1)
    .for('update');
  if (!rows[0]) throw new Reject('not_found', 'That request is not here any more.');
  return rows[0];
}

async function setStatus(
  ctx: Ctx,
  row: RedemptionRow,
  status: RedemptionStatus,
  extra: Partial<RedemptionRow> = {},
): Promise<void> {
  await ctx.tx
    .update(redemptions)
    .set({ status, updatedAt: ctx.now, ...extra })
    .where(eq(redemptions.id, row.id));
}

async function putBack(ctx: Ctx, rewardId: string): Promise<void> {
  await ctx.tx
    .update(rewards)
    .set({ stock: sql`${rewards.stock} + 1` })
    .where(and(eq(rewards.id, rewardId), sql`${rewards.stock} is not null`));
}

export async function requestRedemption(
  ctx: Ctx,
  input: OpInput<'redemption.request'>,
): Promise<{ status: RedemptionStatus; available: number }> {
  const before = await ctx.tx
    .select()
    .from(redemptions)
    .where(eq(redemptions.id, input.redemptionId))
    .limit(1);
  if (before[0]) {
    const wallet = await walletOf(ctx, before[0].profileId);
    return { status: before[0].status as RedemptionStatus, available: wallet.available };
  }

  const child = await ctx.tx
    .select({ id: profiles.id, independent: profiles.independent, archivedAt: profiles.archivedAt })
    .from(profiles)
    .where(and(eq(profiles.id, input.profileId), eq(profiles.householdId, ctx.household.id)))
    .limit(1);
  if (!child[0] || child[0].archivedAt) throw new Reject('not_found', 'That child is not here.');
  if (!child[0].independent)
    throw new Reject('not_offered', 'The bank is not switched on for this child yet.');

  const found = await ctx.tx
    .select()
    .from(rewards)
    .where(and(eq(rewards.id, input.rewardId), eq(rewards.householdId, ctx.household.id)))
    .limit(1)
    .for('update');
  const reward = found[0];
  if (!reward || reward.status !== 'active')
    throw new Reject('not_offered', 'That one is not in the shop just now.');
  if (reward.profiles.length > 0 && !reward.profiles.includes(input.profileId)) {
    throw new Reject('not_offered', 'That one is not in the shop for this child.');
  }
  // The child said yes to what they were looking at. If it has changed since, show it again instead.
  if (reward.version !== input.rewardVersion || reward.price !== input.price) {
    throw new Reject('price_changed', 'That one has changed. Have another look.');
  }
  if (reward.stock !== null && reward.stock <= 0)
    throw new Reject('out_of_stock', 'There are none of those left just now.');

  const posted = await post(ctx, {
    profileId: input.profileId,
    kind: 'reserve',
    available: -reward.price,
    reserved: reward.price,
    source: 'redemption',
    sourceId: input.redemptionId,
    key: `redemption:${input.redemptionId}:reserve`,
    note: reward.title,
  });
  if (reward.stock !== null) {
    await ctx.tx
      .update(rewards)
      .set({ stock: reward.stock - 1 })
      .where(eq(rewards.id, reward.id));
  }
  await ctx.tx.insert(redemptions).values({
    id: input.redemptionId,
    householdId: ctx.household.id,
    profileId: input.profileId,
    rewardId: reward.id,
    rewardVersion: reward.version,
    title: reward.title,
    picture: reward.picture,
    price: reward.price,
    status: 'requested',
    requestedAt: ctx.now,
    updatedAt: ctx.now,
  });
  // Asking for the thing you were saving for means you have saved for it.
  await ctx.tx.delete(goals).where(and(eq(goals.profileId, input.profileId), eq(goals.rewardId, reward.id)));
  await record(ctx, {
    kind: 'reward.asked',
    profileId: input.profileId,
    subjectId: reward.id,
    data: { price: reward.price },
  });
  return { status: 'requested', available: posted.wallet.available };
}

async function release(
  ctx: Ctx,
  row: RedemptionRow,
  status: 'declined' | 'cancelled',
  reason: DeclineReason | null,
): Promise<void> {
  await post(ctx, {
    profileId: row.profileId,
    kind: 'release',
    available: row.price,
    reserved: -row.price,
    source: 'redemption',
    sourceId: row.id,
    key: `redemption:${row.id}:release`,
    note: row.title,
  });
  await putBack(ctx, row.rewardId);
  await setStatus(ctx, row, status, { decidedAt: ctx.now, decidedBy: ctx.actor.name, declineReason: reason });
  await record(ctx, {
    kind: `reward.${status}`,
    profileId: row.profileId,
    subjectId: row.rewardId,
    data: { price: row.price },
  });
}

/** The child changed their mind before anyone answered. */
export async function cancelRedemption(
  ctx: Ctx,
  input: OpInput<'redemption.cancel'>,
): Promise<{ changed: boolean }> {
  const row = await loadRedemption(ctx, input.redemptionId);
  if (row.status === 'cancelled') return { changed: false };
  if (row.status !== 'requested')
    throw new Reject('not_allowed_now', 'A grown-up has already answered that one.');
  await release(ctx, row, 'cancelled', null);
  return { changed: true };
}

export async function decideRedemption(
  ctx: Ctx,
  input: OpInput<'redemption.decide'>,
): Promise<{ changed: boolean; status: RedemptionStatus }> {
  const row = await loadRedemption(ctx, input.redemptionId);
  const wanted: RedemptionStatus = input.approve ? 'approved' : 'declined';
  // The same answer twice — from two phones, or a retry — is one answer.
  if (row.status === wanted) return { changed: false, status: wanted };
  if (row.status !== 'requested') {
    throw new Reject('not_allowed_now', 'That request has already been answered.');
  }
  if (!input.approve) {
    await release(ctx, row, 'declined', input.reason ?? 'later');
    return { changed: true, status: 'declined' };
  }
  await post(ctx, {
    profileId: row.profileId,
    kind: 'spend',
    reserved: -row.price,
    source: 'redemption',
    sourceId: row.id,
    key: `redemption:${row.id}:spend`,
    note: row.title,
  });
  await setStatus(ctx, row, 'approved', { decidedAt: ctx.now, decidedBy: ctx.actor.name });
  await record(ctx, {
    kind: 'reward.approved',
    profileId: row.profileId,
    subjectId: row.rewardId,
    data: { price: row.price },
  });
  return { changed: true, status: 'approved' };
}

/** It happened: the game was played, the story was read. */
export async function fulfillRedemption(
  ctx: Ctx,
  input: OpInput<'redemption.fulfill'>,
): Promise<{ changed: boolean }> {
  const row = await loadRedemption(ctx, input.redemptionId);
  if (row.status === 'fulfilled') return { changed: false };
  if (row.status !== 'approved') throw new Reject('not_allowed_now', 'Say yes to it first.');
  await setStatus(ctx, row, 'fulfilled', { fulfilledAt: ctx.now });
  await record(ctx, {
    kind: 'reward.fulfilled',
    profileId: row.profileId,
    subjectId: row.rewardId,
    data: { price: row.price },
  });
  return { changed: true };
}

/** It is not going to happen after all: the stars come back. */
export async function refundRedemption(
  ctx: Ctx,
  input: OpInput<'redemption.refund'>,
): Promise<{ changed: boolean }> {
  const row = await loadRedemption(ctx, input.redemptionId);
  if (row.status === 'refunded') return { changed: false };
  if (row.status !== 'approved' && row.status !== 'fulfilled') {
    throw new Reject('not_allowed_now', 'Only a reward that was said yes to can be refunded.');
  }
  await post(ctx, {
    profileId: row.profileId,
    kind: 'refund',
    available: row.price,
    source: 'redemption',
    sourceId: row.id,
    key: `redemption:${row.id}:refund`,
    note: input.note ?? row.title,
  });
  if (row.status === 'approved') await putBack(ctx, row.rewardId);
  await setStatus(ctx, row, 'refunded', { decidedAt: ctx.now, decidedBy: ctx.actor.name });
  await record(ctx, {
    kind: 'reward.refunded',
    profileId: row.profileId,
    subjectId: row.rewardId,
    data: { price: row.price },
  });
  return { changed: true };
}

/** Requests still open, and what was answered in the last fortnight. */
export async function listRedemptions(ctx: Ctx): Promise<Redemption[]> {
  const since = new Date(ctx.now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const rows = await ctx.tx
    .select()
    .from(redemptions)
    .where(
      and(
        eq(redemptions.householdId, ctx.household.id),
        or(inArray(redemptions.status, ['requested', 'approved']), gte(redemptions.updatedAt, since)),
      ),
    )
    .orderBy(desc(redemptions.requestedAt));
  return rows.map(toRedemption);
}

// ---------------------------------------------------------------------------------------------------------------------
// Saving up
// ---------------------------------------------------------------------------------------------------------------------

export async function setGoal(ctx: Ctx, input: OpInput<'goal.set'>): Promise<void> {
  const child = await ctx.tx
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.id, input.profileId), eq(profiles.householdId, ctx.household.id)))
    .limit(1);
  if (!child[0]) throw new Reject('not_found', 'That child is not here.');
  if (input.rewardId === null) {
    await ctx.tx.delete(goals).where(eq(goals.profileId, input.profileId));
    return;
  }
  const found = await ctx.tx
    .select()
    .from(rewards)
    .where(and(eq(rewards.id, input.rewardId), eq(rewards.householdId, ctx.household.id)))
    .limit(1);
  const reward = found[0];
  if (!reward || reward.status !== 'active')
    throw new Reject('not_offered', 'That one is not in the shop just now.');
  if (reward.profiles.length > 0 && !reward.profiles.includes(input.profileId)) {
    throw new Reject('not_offered', 'That one is not in the shop for this child.');
  }
  await ctx.tx
    .insert(goals)
    .values({
      profileId: input.profileId,
      householdId: ctx.household.id,
      rewardId: reward.id,
      createdAt: ctx.now,
    })
    .onConflictDoUpdate({ target: goals.profileId, set: { rewardId: reward.id, createdAt: ctx.now } });
}

export async function listGoals(ctx: Ctx): Promise<Goal[]> {
  const rows = await ctx.tx.select().from(goals).where(eq(goals.householdId, ctx.household.id));
  return rows.map((row) => ({ profileId: row.profileId, rewardId: row.rewardId }));
}

// ---------------------------------------------------------------------------------------------------------------------
// Gifts and putting things right
// ---------------------------------------------------------------------------------------------------------------------

export async function giveBonus(ctx: Ctx, input: OpInput<'ledger.bonus'>): Promise<{ available: number }> {
  const posted = await post(ctx, {
    id: input.entryId,
    profileId: input.profileId,
    kind: 'grant',
    available: input.stars,
    lifetime: input.stars,
    source: 'bonus',
    key: `bonus:${input.entryId}`,
    note: input.note,
  });
  if (posted.written) {
    await record(ctx, { kind: 'stars.bonus', profileId: input.profileId, data: { stars: input.stars } });
  }
  return { available: posted.wallet.available };
}

export async function correctLedger(
  ctx: Ctx,
  input: OpInput<'ledger.correct'>,
): Promise<{ available: number }> {
  if (input.available === 0 && input.lifetime === 0)
    throw new Reject('invalid', 'A correction has to change something.');
  const posted = await post(ctx, {
    id: input.entryId,
    profileId: input.profileId,
    kind: 'correction',
    available: input.available,
    lifetime: input.lifetime,
    source: 'correction',
    key: `correction:${input.entryId}`,
    note: input.note,
  });
  if (posted.written) {
    await record(ctx, {
      kind: 'stars.corrected',
      profileId: input.profileId,
      data: { available: input.available, lifetime: input.lifetime },
    });
  }
  return { available: posted.wallet.available };
}
