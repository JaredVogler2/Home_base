import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import { weeklyCeilingFor, weeksToSave, type Economist } from '../../shared/ai.js';
import { addDays } from '../../shared/time.js';
import { ledger, wallets } from '../db/schema.js';
import { listRewards } from '../domain/bank.js';
import type { Ctx } from '../domain/context.js';
import { listProfiles } from '../domain/family.js';
import { listTemplates } from '../domain/quest.js';

/**
 * "How long until…?" for each child and each reward they can choose, worked out here with no model at all.
 *
 * Two rates, always named: the ceiling (the most the child's present missions could give in a week, at the
 * household's spend rate, with any weekly allowance) and the recent rate (what the ledger shows was actually
 * earned to spend over the last four weeks, divided by four). Children are never set beside each other.
 */
export async function rewardSimulation(ctx: Ctx): Promise<Economist> {
  const children = (await listProfiles(ctx, false)).filter((profile) => profile.independent);
  const templates = await listTemplates(ctx);
  const rewards = (await listRewards(ctx, false)).filter((reward) => reward.status === 'active');
  const from = addDays(ctx.today, -27);
  const since = new Date(ctx.now.getTime() - 28 * 24 * 60 * 60 * 1000);

  const ids = children.map((child) => child.id);
  const walletRows =
    ids.length === 0
      ? []
      : await ctx.tx
          .select({ profileId: wallets.profileId, available: wallets.available })
          .from(wallets)
          .where(and(eq(wallets.householdId, ctx.household.id), inArray(wallets.profileId, ids)));
  const earnedRows =
    ids.length === 0
      ? []
      : await ctx.tx
          .select({
            profileId: ledger.profileId,
            earned: sql<number>`coalesce(sum(${ledger.available}), 0)::int`,
          })
          .from(ledger)
          .where(
            and(
              eq(ledger.householdId, ctx.household.id),
              inArray(ledger.profileId, ids),
              inArray(ledger.kind, ['grant', 'correction']),
              gte(ledger.at, since),
            ),
          )
          .groupBy(ledger.profileId);

  return {
    today: ctx.today,
    recent: { from, to: ctx.today, weeks: 4 },
    children: children.map((child) => {
      const available = walletRows.find((row) => row.profileId === child.id)?.available ?? 0;
      const recentTotal = Math.max(
        0,
        Number(earnedRows.find((row) => row.profileId === child.id)?.earned ?? 0),
      );
      const recentPerWeek = Math.round((recentTotal / 4) * 10) / 10;
      const ceilingPerWeek = weeklyCeilingFor(templates, child.id, ctx.household.settings.bank);
      return {
        profileId: child.id,
        nickname: child.nickname,
        available,
        ceilingPerWeek,
        recentPerWeek,
        recentTotal,
        rewards: rewards
          .filter((reward) => reward.profiles.length === 0 || reward.profiles.includes(child.id))
          .map((reward) => {
            const need = Math.max(0, reward.price - available);
            return {
              rewardId: reward.id,
              title: reward.title,
              picture: reward.picture,
              price: reward.price,
              need,
              weeksAtCeiling: weeksToSave(need, ceilingPerWeek),
              weeksAtRecent: weeksToSave(need, recentTotal / 4),
            };
          }),
      };
    }),
  };
}
