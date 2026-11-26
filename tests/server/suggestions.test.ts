import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '../../shared/ids.js';
import type { OpInput } from '../../shared/ops.js';
import { classifyItem } from '../../shared/shopping.js';
import { Browser, newFamily, pairWall, startServer, type Family, type TestServer } from './harness.js';

/**
 * "You often buy…": what was bought on a list at least twice lately and is not on it now. Bought means ticked
 * off; the record of it has to outlast the nightly tidy that clears ticked things away.
 */

let server: TestServer;
const DAY = 24 * 60 * 60 * 1000;
beforeAll(async () => {
  server = await startServer({}, '2026-03-03T18:00:00Z');
});
afterAll(async () => {
  await server.close();
});

interface Suggestions {
  suggestions: { text: string; picture: string; category: string; times: number }[];
}

function item(listId: string, text: string): OpInput<'shopping.add'> {
  return {
    itemId: newId(),
    listId,
    text,
    quantity: null,
    unit: null,
    note: null,
    url: null,
    store: null,
    priority: false,
    ...classifyItem(text),
  };
}

async function groceries(family: Family): Promise<string> {
  return (await family.parent.pull()).lists.find((list) => list.kind === 'groceries')!.id;
}

/** Put it on the list and tick it off, as on a shopping trip. */
async function buy(family: Family, listId: string, text: string): Promise<void> {
  const added = await family.parent.do('shopping.add', item(listId, text));
  await family.parent.do('shopping.check', { itemId: added.itemId as string, checked: true });
}

/** A new day: the first screen to check in runs the nightly tidy. */
async function nextDay(family: Family, days = 1): Promise<void> {
  server.clock.advance(days * DAY);
  await family.parent.pull();
}

async function suggest(browser: Browser, listId: string) {
  return browser.get<Suggestions>(`/shopping/suggestions?listId=${listId}`);
}

describe('you often buy…', () => {
  it('suggests what was bought at least twice, most often first, and survives the tidy', async () => {
    const family = await newFamily(server);
    const listId = await groceries(family);
    await buy(family, listId, 'Milk');
    await buy(family, listId, 'Bananas');
    await buy(family, listId, 'Bread');
    await nextDay(family, 4);
    await buy(family, listId, 'milk');
    await buy(family, listId, 'bananas');
    await nextDay(family, 4);
    await buy(family, listId, 'Milk!');
    await nextDay(family, 4);

    // Everything ticked has been tidied away by now, and is still remembered.
    const snapshot = await family.parent.pull();
    expect(snapshot.items.filter((one) => one.listId === listId)).toEqual([]);

    const reply = await suggest(family.parent, listId);
    expect(reply.status).toBe(200);
    expect(reply.body.suggestions).toEqual([
      { text: 'Milk!', ...classifyItem('Milk!'), times: 3 },
      { text: 'bananas', ...classifyItem('bananas'), times: 2 },
    ]);
  });

  it('leaves out what is on the list now, and counts a day once', async () => {
    const family = await newFamily(server);
    const listId = await groceries(family);
    await buy(family, listId, 'Eggs');
    await buy(family, listId, 'Cheese');
    // Ticked, unticked, ticked again in one trip: one shop, not two.
    const tea = await family.parent.do('shopping.add', item(listId, 'Tea'));
    await family.parent.do('shopping.check', { itemId: tea.itemId as string, checked: true });
    await family.parent.do('shopping.check', { itemId: tea.itemId as string, checked: false });
    await family.parent.do('shopping.check', { itemId: tea.itemId as string, checked: true });
    await nextDay(family, 4);
    await buy(family, listId, 'Eggs');
    await buy(family, listId, 'Cheese');
    await family.parent.do('shopping.add', item(listId, 'eggs'));

    const reply = await suggest(family.parent, listId);
    expect(reply.body.suggestions.map((one) => one.text)).toEqual(['Cheese']);
  });

  it('forgets what was bought more than 120 days ago', async () => {
    const family = await newFamily(server);
    await family.parent.do('household.settings', { patch: { history: { detailDays: 365 } } });
    const listId = await groceries(family);
    await buy(family, listId, 'Rice');
    await nextDay(family, 2);
    await buy(family, listId, 'Rice');
    await nextDay(family, 3);
    expect((await suggest(family.parent, listId)).body.suggestions.map((one) => one.text)).toEqual(['Rice']);
    // A few weeks at a time, so the phone stays signed in (a session lasts a month from its last use).
    for (let step = 0; step < 6; step++) await nextDay(family, 20);
    expect((await suggest(family.parent, listId)).body.suggestions).toEqual([]);
  });

  it('is for one list only, and for grown-ups only', async () => {
    const family = await newFamily(server);
    const listId = await groceries(family);
    const other = newId();
    await family.parent.do('list.create', { listId: other, name: 'Hardware', kind: 'general' });
    await buy(family, listId, 'Apples');
    await nextDay(family, 4);
    await buy(family, listId, 'Apples');
    expect((await suggest(family.parent, other)).body.suggestions).toEqual([]);
    expect((await suggest(family.parent, listId)).body.suggestions).toHaveLength(1);

    const wall = await pairWall(family);
    expect((await suggest(wall, listId)).status).toBe(403);

    const stranger = await newFamily(server);
    expect((await suggest(stranger.parent, listId)).status).toBe(404);
    expect((await suggest(new Browser(server), listId)).status).toBe(401);
    expect((await stranger.parent.get('/shopping/suggestions?listId=nope')).status).toBe(400);
  });

  it('gives at most twelve', async () => {
    const family = await newFamily(server);
    const listId = await groceries(family);
    const things = Array.from({ length: 15 }, (_, index) => `Thing ${index + 1}`);
    for (const thing of things) await buy(family, listId, thing);
    await nextDay(family, 4);
    for (const thing of things) await buy(family, listId, thing);
    expect((await suggest(family.parent, listId)).body.suggestions).toHaveLength(12);
  });
});
