import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { badgesFor, isBadgeId, type BadgeCounts, type BadgeId } from '../../shared/badges.js';
import type { LocalDate } from '../../shared/time.js';
import { badges, profiles } from '../db/schema.js';
import type { Ctx } from './context.js';

/**
 * Giving out badges. After something that could have earned one, each child's sums are worked out from the
 * household's own records and any badge newly reached is written down — once, for good. Nothing is ever taken
 * back: a badge is a keepsake, not a score.
 */

export interface EarnedBadge {
  profileId: string;
  badge: BadgeId;
  earnedOn: LocalDate;
}

export async function listBadges(ctx: Ctx): Promise<EarnedBadge[]> {
  const rows = await ctx.tx
    .select()
    .from(badges)
    .where(eq(badges.householdId, ctx.household.id))
    .orderBy(asc(badges.earnedOn), asc(badges.badge));
  return rows
    .filter((row) => isBadgeId(row.badge))
    .map((row) => ({ profileId: row.profileId, badge: row.badge as BadgeId, earnedOn: row.earnedOn }));
}

async function countsFor(ctx: Ctx, profileId: string): Promise<BadgeCounts> {
  const household = ctx.household.id;
  const result = await ctx.tx.execute(sql`
    select
      (select coalesce(max("lifetime"), 0) from "homebase"."wallets"
        where "profile_id" = ${profileId}::uuid)::int as "lifetime",
      (select count(*) from "homebase"."task_occurrences" o
         join "homebase"."task_template_versions" v
           on v."template_id" = o."template_id" and v."version" = o."template_version"
        where o."household_id" = ${household}::uuid and o."status" = 'approved'
          and o."done_by" = ${profileId}::uuid and v."picture" = 'kind')::int as "kind",
      (select count(*) from "homebase"."task_occurrences" o
        where o."household_id" = ${household}::uuid and o."status" = 'approved'
          and o."profile_id" is null and o."done_by" = ${profileId}::uuid)::int as "shared",
      (select count(*) from "homebase"."routine_runs" r
         join "homebase"."routine_versions" v
           on v."routine_id" = r."routine_id" and v."version" = r."routine_version"
        where r."household_id" = ${household}::uuid and r."profile_id" = ${profileId}::uuid
          and r."status" = 'completed' and v."kind" = 'morning')::int as "mornings",
      (select count(*) from "homebase"."routine_runs" r
         join "homebase"."routine_versions" v
           on v."routine_id" = r."routine_id" and v."version" = r."routine_version"
        where r."household_id" = ${household}::uuid and r."profile_id" = ${profileId}::uuid
          and r."status" = 'completed' and v."kind" = 'bedtime')::int as "bedtimes",
      (select count(*) from "homebase"."routine_runs" r
        where r."household_id" = ${household}::uuid and r."profile_id" = ${profileId}::uuid
          and r."status" = 'completed')::int as "routines",
      (select count(*) from "homebase"."redemptions" d
        where d."household_id" = ${household}::uuid and d."profile_id" = ${profileId}::uuid
          and d."status" = 'fulfilled' and d."price" >= 20)::int as "bigRewards",
      ((select count(*) from "homebase"."task_occurrences" o
         where o."household_id" = ${household}::uuid and o."help_asked"
           and (o."profile_id" = ${profileId}::uuid or o."done_by" = ${profileId}::uuid))
       + (select count(*) from "homebase"."routine_step_events" e
            join "homebase"."routine_runs" r on r."id" = e."run_id"
           where e."household_id" = ${household}::uuid and e."kind" = 'help'
             and r."profile_id" = ${profileId}::uuid))::int as "helpAsked"`);
  const row = (result as unknown as { rows: Record<keyof BadgeCounts, number | string>[] }).rows[0];
  return {
    lifetime: Number(row?.lifetime ?? 0),
    kind: Number(row?.kind ?? 0),
    shared: Number(row?.shared ?? 0),
    mornings: Number(row?.mornings ?? 0),
    bedtimes: Number(row?.bedtimes ?? 0),
    routines: Number(row?.routines ?? 0),
    bigRewards: Number(row?.bigRewards ?? 0),
    helpAsked: Number(row?.helpAsked ?? 0),
  };
}

/** Write down any badge a child has newly reached. Returns the new ones. Safe to call as often as you like. */
export async function awardBadges(ctx: Ctx): Promise<EarnedBadge[]> {
  const children = await ctx.tx
    .select({ id: profiles.id })
    .from(profiles)
    .where(
      and(
        eq(profiles.householdId, ctx.household.id),
        eq(profiles.independent, true),
        isNull(profiles.archivedAt),
      ),
    );
  const fresh: EarnedBadge[] = [];
  for (const child of children) {
    const earned = badgesFor(await countsFor(ctx, child.id));
    if (earned.length === 0) continue;
    const written = await ctx.tx
      .insert(badges)
      .values(
        earned.map((badge) => ({
          householdId: ctx.household.id,
          profileId: child.id,
          badge,
          earnedOn: ctx.today,
        })),
      )
      .onConflictDoNothing()
      .returning({ badge: badges.badge });
    for (const row of written) {
      if (isBadgeId(row.badge)) fresh.push({ profileId: child.id, badge: row.badge, earnedOn: ctx.today });
    }
  }
  return fresh;
}

/** The kinds of request after which a badge may have been reached. */
export const BADGE_OPS: ReadonlySet<string> = new Set([
  'occurrence.submit',
  'occurrence.approve',
  'occurrence.markDone',
  'occurrence.help',
  'run.step',
  'run.together',
  'run.finish',
  'redemption.fulfill',
  'ledger.bonus',
]);
