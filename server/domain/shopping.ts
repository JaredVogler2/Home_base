import { and, asc, desc, eq, gte, isNull, ne, or, sql } from 'drizzle-orm';
import type { ItemStatus, ShoppingItem, ShoppingList } from '../../shared/model.js';
import type { OpInput } from '../../shared/ops.js';
import { SHOPPING_PICTURES, type ShoppingCategory, type ShoppingPictureId } from '../../shared/pictures.js';
import { classifyItem, normalizeItem, parseLines } from '../../shared/shopping.js';
import { profiles, shoppingItemHistory, shoppingItems, shoppingLists } from '../db/schema.js';
import { Reject, record, type Ctx } from './context.js';

/**
 * The shopping list.
 *
 * Two phones and a wall all write to it, sometimes with no signal. It stays one list because:
 *   - a thing added has an id made where it was added, so adding it twice (a retry, a queue replayed) adds it once;
 *   - the same thing added by two people ("milk", "Milk") is one line with a note that it was asked for again;
 *   - an edit says which fields it changes, so one phone fixing the quantity and another the note both win;
 *   - nothing is ever really deleted from under anybody: removing is undoable, and every change is in the item's
 *     history with who made it.
 * Nothing here buys anything, opens a link or talks to a shop.
 */

type ItemRow = typeof shoppingItems.$inferSelect;

/** How many things a child can have waiting for a grown-up's answer at once. */
export const MAX_OPEN_REQUESTS = 5;

function toItem(row: ItemRow): ShoppingItem {
  return {
    id: row.id,
    listId: row.listId,
    text: row.text,
    picture: row.picture as ShoppingPictureId,
    category: row.category as ShoppingCategory,
    quantity: row.quantity,
    unit: row.unit,
    note: row.note,
    url: row.url,
    store: row.store,
    priority: row.priority,
    status: row.status as ItemStatus,
    requestedBy: row.requestedBy,
    addedBy: row.addedBy,
    alsoAsked: row.alsoAsked,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    checkedAt: row.checkedAt?.toISOString() ?? null,
  };
}

/** A short name for whoever is asking, as it reads on the list: "Sam", "the wall", "Siri (Sam)". */
function byline(ctx: Ctx): string {
  const name = ctx.actor.name;
  if (name.startsWith('guardian:')) return name.slice('guardian:'.length).replace(/ \(at .*\)$/, '');
  if (name.startsWith('wall:')) return 'the wall';
  if (name.startsWith('shortcut:')) {
    const who = name.slice('shortcut:'.length);
    return who ? `Siri (${who})` : 'Siri';
  }
  return name;
}

async function history(
  ctx: Ctx,
  itemId: string,
  change: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
) {
  await ctx.tx.insert(shoppingItemHistory).values({
    id: crypto.randomUUID(),
    householdId: ctx.household.id,
    itemId,
    at: ctx.now,
    actor: ctx.actor.name,
    change,
    before,
    after,
  });
}

async function loadItem(ctx: Ctx, itemId: string): Promise<ItemRow> {
  const rows = await ctx.tx
    .select()
    .from(shoppingItems)
    .where(and(eq(shoppingItems.id, itemId), eq(shoppingItems.householdId, ctx.household.id)))
    .limit(1);
  if (!rows[0]) throw new Reject('not_found', 'That is not on the list any more.');
  return rows[0];
}

async function assertList(ctx: Ctx, listId: string): Promise<void> {
  const rows = await ctx.tx
    .select({ id: shoppingLists.id, archivedAt: shoppingLists.archivedAt })
    .from(shoppingLists)
    .where(and(eq(shoppingLists.id, listId), eq(shoppingLists.householdId, ctx.household.id)))
    .limit(1);
  if (!rows[0] || rows[0].archivedAt) throw new Reject('not_found', 'That list is not here any more.');
}

/** The list things go on when nobody says which: the first groceries list, made if there is none. */
export async function defaultList(ctx: Ctx): Promise<string> {
  const rows = await ctx.tx
    .select({ id: shoppingLists.id })
    .from(shoppingLists)
    .where(and(eq(shoppingLists.householdId, ctx.household.id), isNull(shoppingLists.archivedAt)))
    .orderBy(sql`case when ${shoppingLists.kind} = 'groceries' then 0 else 1 end`, asc(shoppingLists.sort))
    .limit(1);
  if (rows[0]) return rows[0].id;
  const id = crypto.randomUUID();
  await ctx.tx
    .insert(shoppingLists)
    .values({ id, householdId: ctx.household.id, name: 'Groceries', kind: 'groceries', sort: 1 });
  return id;
}

/** An item on this list that is the same thing to buy and is not gone. */
async function sameThing(ctx: Ctx, listId: string, normalized: string): Promise<ItemRow | null> {
  const rows = await ctx.tx
    .select()
    .from(shoppingItems)
    .where(
      and(
        eq(shoppingItems.householdId, ctx.household.id),
        eq(shoppingItems.listId, listId),
        eq(shoppingItems.normalized, normalized),
        isNull(shoppingItems.deletedAt),
        isNull(shoppingItems.archivedAt),
        ne(shoppingItems.status, 'declined'),
      ),
    )
    .orderBy(desc(shoppingItems.updatedAt))
    .limit(1);
  return rows[0] ?? null;
}

export type AddResult =
  | { outcome: 'added'; itemId: string }
  /** It was already on the list; that line now says it was asked for again. */
  | { outcome: 'already'; itemId: string }
  /** It had been ticked off; it is wanted again. */
  | { outcome: 'again'; itemId: string };

export async function addItem(ctx: Ctx, input: OpInput<'shopping.add'>): Promise<AddResult> {
  await assertList(ctx, input.listId);
  const existingById = await ctx.tx
    .select({ id: shoppingItems.id })
    .from(shoppingItems)
    .where(eq(shoppingItems.id, input.itemId));
  if (existingById[0]) return { outcome: 'already', itemId: input.itemId };

  const normalized = normalizeItem(input.text);
  if (normalized === '') throw new Reject('invalid', 'That needs a word or two.');
  const same = await sameThing(ctx, input.listId, normalized);
  if (same && (same.status === 'needed' || same.status === 'requested')) {
    // "2 milk" when milk is already wanted: the line stays one line, and the amount just said is the amount.
    // Said with no amount, the amount already there is kept.
    const amount =
      input.quantity !== null && (input.quantity !== same.quantity || input.unit !== same.unit)
        ? { quantity: input.quantity, unit: input.unit }
        : null;
    await ctx.tx
      .update(shoppingItems)
      .set({
        alsoAsked: same.alsoAsked + 1,
        // A grown-up adding what a child asked for is the grown-up saying yes.
        status: 'needed',
        priority: same.priority || input.priority,
        ...(amount
          ? {
              ...amount,
              fieldVersions: {
                ...same.fieldVersions,
                quantity: (same.fieldVersions.quantity ?? 0) + 1,
                unit: (same.fieldVersions.unit ?? 0) + 1,
              },
            }
          : {}),
        updatedAt: ctx.now,
      })
      .where(eq(shoppingItems.id, same.id));
    await history(ctx, same.id, 'asked-again', amount ? { quantity: same.quantity, unit: same.unit } : null, {
      by: byline(ctx),
      text: input.text,
      ...(amount ?? {}),
    });
    return { outcome: 'already', itemId: same.id };
  }
  if (same && same.status === 'checked') {
    await ctx.tx
      .update(shoppingItems)
      .set({
        status: 'needed',
        checkedAt: null,
        checkedBy: null,
        quantity: input.quantity,
        unit: input.unit,
        priority: input.priority,
        updatedAt: ctx.now,
      })
      .where(eq(shoppingItems.id, same.id));
    await history(ctx, same.id, 'wanted-again', { status: 'checked' }, { status: 'needed', by: byline(ctx) });
    return { outcome: 'again', itemId: same.id };
  }

  await ctx.tx.insert(shoppingItems).values({
    id: input.itemId,
    householdId: ctx.household.id,
    listId: input.listId,
    text: input.text,
    normalized,
    picture: input.picture,
    category: input.category,
    quantity: input.quantity,
    unit: input.unit,
    note: input.note,
    url: input.url,
    store: input.store,
    priority: input.priority,
    status: 'needed',
    addedBy: byline(ctx),
    createdAt: ctx.now,
    updatedAt: ctx.now,
  });
  await history(ctx, input.itemId, 'added', null, { text: input.text, via: input.via ?? 'typed' });
  return { outcome: 'added', itemId: input.itemId };
}

/** Add several lines of plain text at once: a pasted note, a dictated sentence, a shortcut. */
export async function addText(
  ctx: Ctx,
  text: string,
  listId?: string,
): Promise<{ added: string[]; already: string[] }> {
  const list = listId ?? (await defaultList(ctx));
  const added: string[] = [];
  const already: string[] = [];
  for (const line of parseLines(text)) {
    const guess = classifyItem(line.text);
    const result = await addItem(ctx, {
      itemId: crypto.randomUUID(),
      listId: list,
      text: line.text,
      quantity: line.quantity,
      unit: line.unit,
      note: null,
      url: null,
      store: null,
      priority: false,
      category: guess.category,
      picture: guess.picture,
      via: 'voice',
    });
    (result.outcome === 'already' ? already : added).push(line.text);
  }
  return { added, already };
}

export async function checkItem(ctx: Ctx, input: OpInput<'shopping.check'>): Promise<{ changed: boolean }> {
  const item = await loadItem(ctx, input.itemId);
  if (item.deletedAt) throw new Reject('not_found', 'That is not on the list any more.');
  if (item.status === 'requested' || item.status === 'declined') {
    throw new Reject('not_allowed_now', 'A grown-up has to say yes to that one first.');
  }
  const wanted: ItemStatus = input.checked ? 'checked' : 'needed';
  if (item.status === wanted) return { changed: false };
  await ctx.tx
    .update(shoppingItems)
    .set({
      status: wanted,
      checkedAt: input.checked ? ctx.now : null,
      checkedBy: input.checked ? byline(ctx) : null,
      archivedAt: null,
      updatedAt: ctx.now,
    })
    .where(eq(shoppingItems.id, item.id));
  await history(
    ctx,
    item.id,
    input.checked ? 'checked' : 'unchecked',
    { status: item.status },
    { status: wanted },
  );
  if (input.checked) {
    // What was bought and when, so that the list can later say "you usually buy this about now".
    await record(ctx, {
      kind: 'shopping.bought',
      subjectId: item.id,
      data: { item: item.normalized, text: item.text, category: item.category, picture: item.picture },
    });
  }
  return { changed: true };
}

const EDITABLE = [
  'text',
  'quantity',
  'unit',
  'note',
  'url',
  'store',
  'priority',
  'category',
  'picture',
  'listId',
] as const;

export async function editItem(ctx: Ctx, input: OpInput<'shopping.edit'>): Promise<{ changed: string[] }> {
  const item = await loadItem(ctx, input.itemId);
  if (item.deletedAt) throw new Reject('not_found', 'That is not on the list any more.');
  const patch = input.patch;
  if (patch.listId !== undefined) await assertList(ctx, patch.listId);
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  const versions = { ...item.fieldVersions };
  for (const field of EDITABLE) {
    const value = patch[field];
    if (value === undefined) continue;
    const current = item[field];
    if (current === value) continue;
    before[field] = current;
    after[field] = value;
    versions[field] = (versions[field] ?? 0) + 1;
  }
  const changed = Object.keys(after);
  if (changed.length === 0) return { changed };
  const set: Partial<typeof shoppingItems.$inferInsert> = {
    ...after,
    fieldVersions: versions,
    updatedAt: ctx.now,
  };
  if (typeof after.text === 'string') {
    set.normalized = normalizeItem(after.text);
    if (set.normalized === '') throw new Reject('invalid', 'That needs a word or two.');
    // New words usually mean a new aisle — unless the same edit chose one.
    if (patch.category === undefined && patch.picture === undefined) {
      const guess = classifyItem(after.text);
      set.category = guess.category;
      set.picture = guess.picture;
    }
  }
  await ctx.tx.update(shoppingItems).set(set).where(eq(shoppingItems.id, item.id));
  await history(ctx, item.id, 'edited', before, after);
  return { changed };
}

export async function removeItem(ctx: Ctx, input: OpInput<'shopping.remove'>): Promise<{ changed: boolean }> {
  const item = await loadItem(ctx, input.itemId);
  if (item.deletedAt) return { changed: false };
  await ctx.tx
    .update(shoppingItems)
    .set({ deletedAt: ctx.now, updatedAt: ctx.now })
    .where(eq(shoppingItems.id, item.id));
  await history(ctx, item.id, 'removed', { text: item.text }, null);
  return { changed: true };
}

export async function restoreItem(
  ctx: Ctx,
  input: OpInput<'shopping.restore'>,
): Promise<{ changed: boolean }> {
  const item = await loadItem(ctx, input.itemId);
  if (!item.deletedAt && !item.archivedAt) return { changed: false };
  await ctx.tx
    .update(shoppingItems)
    .set({ deletedAt: null, archivedAt: null, updatedAt: ctx.now })
    .where(eq(shoppingItems.id, item.id));
  await history(ctx, item.id, 'restored', null, { text: item.text });
  return { changed: true };
}

/** Clear away what has been bought. It leaves the list and stays in the history. */
export async function clearChecked(
  ctx: Ctx,
  input: OpInput<'shopping.clearChecked'>,
): Promise<{ cleared: number }> {
  const rows = await ctx.tx
    .update(shoppingItems)
    .set({ archivedAt: ctx.now, updatedAt: ctx.now })
    .where(
      and(
        eq(shoppingItems.householdId, ctx.household.id),
        eq(shoppingItems.listId, input.listId),
        eq(shoppingItems.status, 'checked'),
        isNull(shoppingItems.archivedAt),
        isNull(shoppingItems.deletedAt),
      ),
    )
    .returning({ id: shoppingItems.id });
  return { cleared: rows.length };
}

/** A child taps a picture: "can we get this?" It waits for a grown-up. Nothing is bought. */
export async function requestItem(ctx: Ctx, input: OpInput<'shopping.request'>): Promise<AddResult> {
  const child = await ctx.tx
    .select({ id: profiles.id, archivedAt: profiles.archivedAt })
    .from(profiles)
    .where(and(eq(profiles.id, input.profileId), eq(profiles.householdId, ctx.household.id)))
    .limit(1);
  if (!child[0] || child[0].archivedAt) throw new Reject('not_found', 'That child is not here.');
  const existingById = await ctx.tx
    .select({ id: shoppingItems.id })
    .from(shoppingItems)
    .where(eq(shoppingItems.id, input.itemId));
  if (existingById[0]) return { outcome: 'already', itemId: input.itemId };

  const listId = await defaultList(ctx);
  const label = SHOPPING_PICTURES[input.picture].label;
  const normalized = normalizeItem(label);
  const same = await sameThing(ctx, listId, normalized);
  if (same && (same.status === 'needed' || same.status === 'requested')) {
    await ctx.tx
      .update(shoppingItems)
      .set({ alsoAsked: same.alsoAsked + 1, updatedAt: ctx.now })
      .where(eq(shoppingItems.id, same.id));
    await history(ctx, same.id, 'asked-again', null, { by: 'a child', picture: input.picture });
    return { outcome: 'already', itemId: same.id };
  }
  const open = await ctx.tx
    .select({ count: sql<number>`count(*)::int` })
    .from(shoppingItems)
    .where(
      and(
        eq(shoppingItems.householdId, ctx.household.id),
        eq(shoppingItems.requestedBy, input.profileId),
        eq(shoppingItems.status, 'requested'),
        isNull(shoppingItems.deletedAt),
      ),
    );
  if (Number(open[0]?.count ?? 0) >= MAX_OPEN_REQUESTS) {
    throw new Reject('limit_reached', 'That is lots to ask for. Let a grown-up look first.');
  }
  const guess = classifyItem(label);
  await ctx.tx.insert(shoppingItems).values({
    id: input.itemId,
    householdId: ctx.household.id,
    listId,
    text: label,
    normalized,
    picture: input.picture,
    category: guess.category === 'other' ? 'other' : guess.category,
    status: 'requested',
    requestedBy: input.profileId,
    addedBy: 'a child',
    createdAt: ctx.now,
    updatedAt: ctx.now,
  });
  await history(ctx, input.itemId, 'requested', null, { picture: input.picture });
  return { outcome: 'added', itemId: input.itemId };
}

export async function decideRequest(
  ctx: Ctx,
  input: OpInput<'shopping.decide'>,
): Promise<{ changed: boolean }> {
  const item = await loadItem(ctx, input.itemId);
  const wanted: ItemStatus = input.accept ? 'needed' : 'declined';
  if (item.status === wanted) return { changed: false };
  if (item.status !== 'requested') throw new Reject('not_allowed_now', 'That one has already been answered.');
  await ctx.tx
    .update(shoppingItems)
    .set({ status: wanted, updatedAt: ctx.now })
    .where(eq(shoppingItems.id, item.id));
  await history(
    ctx,
    item.id,
    input.accept ? 'accepted' : 'declined',
    { status: 'requested' },
    { status: wanted },
  );
  return { changed: true };
}

export async function createList(ctx: Ctx, input: OpInput<'list.create'>): Promise<void> {
  const existing = await ctx.tx
    .select({ id: shoppingLists.id })
    .from(shoppingLists)
    .where(eq(shoppingLists.id, input.listId));
  if (existing[0]) return;
  const last = await ctx.tx
    .select({ sort: sql<number>`coalesce(max(${shoppingLists.sort}), 0)::int` })
    .from(shoppingLists)
    .where(eq(shoppingLists.householdId, ctx.household.id));
  await ctx.tx.insert(shoppingLists).values({
    id: input.listId,
    householdId: ctx.household.id,
    name: input.name,
    kind: input.kind,
    sort: Number(last[0]?.sort ?? 0) + 1,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  });
}

export async function updateList(ctx: Ctx, input: OpInput<'list.update'>): Promise<void> {
  const rows = await ctx.tx
    .update(shoppingLists)
    .set({ name: input.name, archivedAt: input.archived ? ctx.now : null, updatedAt: ctx.now })
    .where(and(eq(shoppingLists.id, input.listId), eq(shoppingLists.householdId, ctx.household.id)))
    .returning({ id: shoppingLists.id });
  if (!rows[0]) throw new Reject('not_found', 'That list is not here any more.');
}

export async function listLists(ctx: Ctx): Promise<ShoppingList[]> {
  const rows = await ctx.tx
    .select()
    .from(shoppingLists)
    .where(and(eq(shoppingLists.householdId, ctx.household.id), isNull(shoppingLists.archivedAt)))
    .orderBy(shoppingLists.sort);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind as ShoppingList['kind'],
    sort: row.sort,
    archived: false,
  }));
}

/** What is on the lists now: wanted, asked for, ticked off but not yet cleared, and lately turned down. */
export async function listItems(ctx: Ctx): Promise<ShoppingItem[]> {
  const recently = new Date(ctx.now.getTime() - 24 * 60 * 60 * 1000);
  const rows = await ctx.tx
    .select()
    .from(shoppingItems)
    .where(
      and(
        eq(shoppingItems.householdId, ctx.household.id),
        isNull(shoppingItems.deletedAt),
        isNull(shoppingItems.archivedAt),
        or(ne(shoppingItems.status, 'declined'), gte(shoppingItems.updatedAt, recently)),
      ),
    )
    .orderBy(asc(shoppingItems.createdAt), asc(shoppingItems.id));
  return rows.map(toItem);
}

export interface ItemChange {
  at: string;
  actor: string;
  change: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export async function itemHistory(ctx: Ctx, itemId: string): Promise<ItemChange[]> {
  await loadItem(ctx, itemId);
  const rows = await ctx.tx
    .select()
    .from(shoppingItemHistory)
    .where(and(eq(shoppingItemHistory.householdId, ctx.household.id), eq(shoppingItemHistory.itemId, itemId)))
    .orderBy(asc(shoppingItemHistory.at));
  return rows.map((row) => ({
    at: row.at.toISOString(),
    actor: row.actor,
    change: row.change,
    before: row.before,
    after: row.after,
  }));
}

/** Things removed or cleared in the last week, for "undo" and "recently bought". */
export async function recentItems(ctx: Ctx): Promise<ShoppingItem[]> {
  const since = new Date(ctx.now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const rows = await ctx.tx
    .select()
    .from(shoppingItems)
    .where(
      and(
        eq(shoppingItems.householdId, ctx.household.id),
        gte(shoppingItems.updatedAt, since),
        sql`(${shoppingItems.deletedAt} is not null or ${shoppingItems.archivedAt} is not null)`,
      ),
    )
    .orderBy(desc(shoppingItems.updatedAt))
    .limit(60);
  return rows.map(toItem);
}
