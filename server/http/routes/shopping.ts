import { and, desc, eq, gte, sql, type AnyColumn } from 'drizzle-orm';
import { Hono } from 'hono';
import { isUuid } from '../../../shared/ids.js';
import type { ShoppingCategory, ShoppingPictureId } from '../../../shared/pictures.js';
import { shoppingItemHistory, shoppingItems, shoppingLists } from '../../db/schema.js';
import { withHousehold, type AppEnv } from '../env.js';
import { badRequest, notFound } from '../errors.js';

/**
 * "You often buy…": things this family has bought again and again on a list and that are not on it now, for a
 * grown-up to add back with one tap.
 *
 * What counts as bought is the "checked" line in each item's history. That history is only ever added to, so it
 * is still there after the nightly tidy has cleared ticked items off the list (it archives them, and never
 * deletes them), and it does not depend on the family's look-back record, which they may pause or thin out. A
 * thing ticked, unticked and ticked again on one day counts as one shop.
 *
 *   GET /shopping/suggestions?listId=…   up to 12, the most often bought first
 */

const DAYS = 120;
const AT_LEAST = 2;
const MOST = 12;

export interface Suggestion {
  text: string;
  picture: ShoppingPictureId;
  category: ShoppingCategory;
  times: number;
}

export const shoppingRoutes = new Hono<AppEnv>();

shoppingRoutes.get('/suggestions', async (c) => {
  const listId = c.req.query('listId') ?? '';
  if (!isUuid(listId)) throw badRequest('Say which list (listId).');
  const suggestions = await withHousehold(c, 'caregiver', async (ctx) => {
    const list = await ctx.tx
      .select({ id: shoppingLists.id })
      .from(shoppingLists)
      .where(and(eq(shoppingLists.id, listId), eq(shoppingLists.householdId, ctx.household.id)))
      .limit(1);
    if (!list[0]) throw notFound('That list is not here.');

    const since = new Date(ctx.now.getTime() - DAYS * 24 * 60 * 60 * 1000);
    const times = sql<number>`count(distinct date_trunc('day', ${shoppingItemHistory.at}))::int`;
    const latest = sql`max(${shoppingItemHistory.at})`;
    // The newest wording, picture and aisle among the things that are one thing to buy.
    const newest = (column: AnyColumn) =>
      sql<string>`(array_agg(${column} order by ${shoppingItemHistory.at} desc))[1]`;
    const rows = await ctx.tx
      .select({
        text: newest(shoppingItems.text),
        picture: newest(shoppingItems.picture),
        category: newest(shoppingItems.category),
        times,
      })
      .from(shoppingItemHistory)
      .innerJoin(shoppingItems, eq(shoppingItems.id, shoppingItemHistory.itemId))
      .where(
        and(
          eq(shoppingItemHistory.householdId, ctx.household.id),
          eq(shoppingItemHistory.change, 'checked'),
          gte(shoppingItemHistory.at, since),
          eq(shoppingItems.householdId, ctx.household.id),
          eq(shoppingItems.listId, listId),
          // Not already wanted, or asked for, on this list.
          sql`not exists (
            select 1 from ${shoppingItems} as on_list
            where on_list.household_id = ${ctx.household.id} and on_list.list_id = ${listId}
              and on_list.normalized = ${shoppingItems.normalized}
              and on_list.status in ('needed', 'requested')
              and on_list.deleted_at is null and on_list.archived_at is null)`,
        ),
      )
      .groupBy(shoppingItems.normalized)
      .having(sql`${times} >= ${AT_LEAST}`)
      .orderBy(desc(times), desc(latest))
      .limit(MOST);
    return rows.map((row): Suggestion => ({
      text: row.text,
      picture: row.picture as ShoppingPictureId,
      category: row.category as ShoppingCategory,
      times: Number(row.times),
    }));
  });
  return c.json({ suggestions });
});
