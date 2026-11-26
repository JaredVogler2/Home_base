import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '../../shared/ids.js';
import type { OpInput } from '../../shared/ops.js';
import { classifyItem } from '../../shared/shopping.js';
import {
  addChild,
  Browser,
  newFamily,
  pairWall,
  startServer,
  type Family,
  type TestServer,
} from './harness.js';

let server: TestServer;
beforeAll(async () => {
  server = await startServer({}, '2026-03-03T21:00:00Z');
});
afterAll(async () => {
  await server.close();
});

function item(
  listId: string,
  text: string,
  extra: Partial<OpInput<'shopping.add'>> = {},
): OpInput<'shopping.add'> {
  const guess = classifyItem(text);
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
    ...guess,
    ...extra,
  };
}

async function groceries(family: Family): Promise<string> {
  return (await family.parent.pull()).lists.find((list) => list.kind === 'groceries')!.id;
}

async function secondParent(family: Family): Promise<Browser> {
  const invite = await family.parent.post<{ code: string }>('/auth/invites', { role: 'guardian' });
  const other = new Browser(server);
  await other.post('/auth/join', {
    code: invite.body.code,
    email: `other-${newId()}@example.test`,
    password: 'another long password',
    displayName: 'Robin',
  });
  return other;
}

describe('two phones and a wall, one list', () => {
  it('shows a thing added on one phone on the other and on the wall', async () => {
    const family = await newFamily(server);
    const other = await secondParent(family);
    const wall = await pairWall(family);
    const list = await groceries(family);
    await other.pull();
    await wall.pull();
    await family.parent.do('shopping.add', item(list, 'Milk'));
    expect(await other.poll()).toBe(200);
    expect(await wall.poll()).toBe(200);
    expect(other.snapshot!.items.map((i) => i.text)).toEqual(['Milk']);
    expect(wall.snapshot!.items[0]).toMatchObject({
      text: 'Milk',
      picture: 'milk',
      category: 'dairy',
      addedBy: 'Alex',
    });
    // And when nothing has changed, a screen is told so in one small answer.
    expect(await wall.poll()).toBe(204);
  });

  it('keeps one line when two people add the same thing, and says it was asked for again', async () => {
    const family = await newFamily(server);
    const other = await secondParent(family);
    const list = await groceries(family);
    const [a, b] = await Promise.all([
      family.parent.op('shopping.add', item(list, 'Tomatoes')),
      other.op('shopping.add', item(list, ' tomato! ')),
    ]);
    expect([a.status, b.status]).toEqual(['applied', 'applied']);
    const items = (await family.parent.pull()).items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ alsoAsked: 1, status: 'needed' });
    // The words that were typed first are the words that are kept.
    expect(['Tomatoes', 'tomato!']).toContain(items[0]?.text);
  });

  it('takes the amount just said when something already wanted is added again, and keeps it otherwise', async () => {
    const family = await newFamily(server);
    const list = await groceries(family);
    await family.parent.do('shopping.add', item(list, 'Milk'));
    // "2 milk": still one line, now for two.
    await family.parent.do('shopping.add', item(list, 'milk', { quantity: 2 }));
    let items = (await family.parent.pull()).items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ text: 'Milk', quantity: 2, alsoAsked: 1, status: 'needed' });
    // Asked for again with no amount: the two stay two.
    await family.parent.do('shopping.add', item(list, 'Milk'));
    items = (await family.parent.pull()).items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ quantity: 2, alsoAsked: 2 });
  });

  it('adds a queued item once when a phone that was offline sends its queue twice', async () => {
    const family = await newFamily(server);
    const list = await groceries(family);
    const queued = [
      { id: newId(), type: 'shopping.add', input: item(list, 'Eggs', { quantity: 12 }) },
      { id: newId(), type: 'shopping.add', input: item(list, 'Butter') },
    ];
    const first = await family.parent.ops(queued);
    const again = await family.parent.ops(queued);
    expect(again).toEqual(first);
    expect((await family.parent.pull()).items.map((i) => i.text).sort()).toEqual(['Butter', 'Eggs']);
  });

  it('keeps both changes when two phones edit different things about one item', async () => {
    const family = await newFamily(server);
    const other = await secondParent(family);
    const list = await groceries(family);
    const milk = item(list, 'Milk');
    await family.parent.do('shopping.add', milk);
    await Promise.all([
      family.parent.op('shopping.edit', { itemId: milk.itemId, patch: { quantity: 2 } }),
      other.op('shopping.edit', { itemId: milk.itemId, patch: { note: 'the green top' } }),
    ]);
    expect((await family.parent.pull()).items[0]).toMatchObject({
      quantity: 2,
      note: 'the green top',
      text: 'Milk',
    });
    const history = await server.database.db.execute(
      `select change, actor from homebase.shopping_item_history where item_id = '${milk.itemId}' order by at`,
    );
    expect((history.rows as { change: string }[]).map((row) => row.change)).toEqual([
      'added',
      'edited',
      'edited',
    ]);
  });

  it('ticks off, unticks, removes and brings back — every step undoable and on the record', async () => {
    const family = await newFamily(server);
    const wall = await pairWall(family);
    const list = await groceries(family);
    const bread = item(list, 'Bread');
    await family.parent.do('shopping.add', bread);
    await wall.do('shopping.check', { itemId: bread.itemId, checked: true });
    expect(wall.snapshot!.items[0]).toMatchObject({ status: 'checked' });
    expect((await wall.op('shopping.check', { itemId: bread.itemId, checked: true })).status).toBe('noop');
    await wall.do('shopping.check', { itemId: bread.itemId, checked: false });
    await family.parent.do('shopping.remove', { itemId: bread.itemId });
    expect((await family.parent.pull()).items).toHaveLength(0);
    await family.parent.do('shopping.restore', { itemId: bread.itemId });
    expect((await family.parent.pull()).items[0]).toMatchObject({ text: 'Bread', status: 'needed' });
  });

  it('wants a thing again when it is added after being ticked off', async () => {
    const family = await newFamily(server);
    const list = await groceries(family);
    const milk = item(list, 'Milk');
    await family.parent.do('shopping.add', milk);
    await family.parent.do('shopping.check', { itemId: milk.itemId, checked: true });
    const again = await family.parent.do('shopping.add', item(list, 'milk', { quantity: 2 }));
    expect(again).toMatchObject({ outcome: 'again', itemId: milk.itemId });
    const items = (await family.parent.pull()).items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ status: 'needed', quantity: 2 });
  });
});

describe('the favourites shelf', () => {
  const shelfOf = async (screen: Browser) =>
    (await screen.pull()).household.settings.shopping.favourites.map((entry) => entry.text);

  it('keeps what the family always buys, once however it is spelled, and puts it back with one tap', async () => {
    const family = await newFamily(server);
    const other = await secondParent(family);
    const listId = await groceries(family);
    await family.parent.do('shopping.favourite', {
      text: 'Milk',
      picture: 'milk',
      category: 'dairy',
      on: true,
    });
    await other.do('shopping.favourite', {
      text: 'Bananas',
      picture: 'banana',
      category: 'produce',
      on: true,
    });
    // Both phones see one shelf, in the order things were put on it.
    expect(await shelfOf(family.parent)).toEqual(['Milk', 'Bananas']);
    expect(await shelfOf(other)).toEqual(['Milk', 'Bananas']);

    // "MILK!" is milk: nothing is added, and saying it again with another picture keeps its place.
    const again = await family.parent.op('shopping.favourite', {
      text: 'MILK!',
      picture: 'milk',
      category: 'dairy',
      on: true,
    });
    expect(again.status).toBe('applied');
    expect(await shelfOf(family.parent)).toEqual(['MILK!', 'Bananas']);
    const same = await family.parent.op('shopping.favourite', {
      text: 'MILK!',
      picture: 'milk',
      category: 'dairy',
      on: true,
    });
    expect(same.status).toBe('noop');

    // The shelf adds nothing by itself: the list is still empty until somebody taps.
    expect((await family.parent.pull()).items).toEqual([]);
    await family.parent.do(
      'shopping.add',
      item(listId, 'MILK!', { picture: 'milk', category: 'dairy', via: 'favourite' }),
    );
    expect((await other.pull()).items.map((entry) => entry.text)).toEqual(['MILK!']);

    // Taking it off the shelf leaves the list alone.
    await other.do('shopping.favourite', { text: 'milk', picture: 'milk', category: 'dairy', on: false });
    expect(await shelfOf(family.parent)).toEqual(['Bananas']);
    expect((await family.parent.pull()).items).toHaveLength(1);
    const gone = await other.op('shopping.favourite', {
      text: 'milk',
      picture: 'milk',
      category: 'dairy',
      on: false,
    });
    expect(gone.status).toBe('noop');
  });

  it('is a shelf and not a second list: it stops at forty', async () => {
    const family = await newFamily(server);
    for (let index = 0; index < 40; index++) {
      await family.parent.do('shopping.favourite', {
        text: `Thing number ${index}`,
        picture: 'other',
        category: 'other',
        on: true,
      });
    }
    const full = await family.parent.op('shopping.favourite', {
      text: 'One more',
      picture: 'other',
      category: 'other',
      on: true,
    });
    expect(full).toMatchObject({ status: 'rejected', reason: 'limit_reached' });
    expect(await shelfOf(family.parent)).toHaveLength(40);
    // One already on the shelf can still be changed when it is full.
    const changed = await family.parent.op('shopping.favourite', {
      text: 'Thing number 3',
      picture: 'milk',
      category: 'dairy',
      on: true,
    });
    expect(changed.status).toBe('applied');
  });

  it('is for grown-ups: a child’s screen is not sent the shelf and cannot change it', async () => {
    const family = await newFamily(server);
    const wall = await pairWall(family);
    await family.parent.do('shopping.favourite', {
      text: 'Eggs',
      picture: 'eggs',
      category: 'dairy',
      on: true,
    });
    // A wall is a child's screen: it has no use for the shelf, so it is not sent it.
    expect(await shelfOf(wall)).toEqual([]);
    expect(await shelfOf(family.parent)).toEqual(['Eggs']);
    const refused = await wall.op('shopping.favourite', {
      text: 'Sweets',
      picture: 'other',
      category: 'other',
      on: true,
    });
    expect(refused).toMatchObject({ status: 'rejected', reason: 'forbidden' });
    const empty = await family.parent.op('shopping.favourite', {
      text: '!!!',
      picture: 'other',
      category: 'other',
      on: true,
    });
    expect(empty.status).toBe('rejected');
    const picture = await family.parent.op('shopping.favourite', {
      text: 'Bread',
      picture: 'not-a-picture' as 'bread',
      category: 'bakery',
      on: true,
    });
    expect(picture.status).toBe('rejected');
    expect(await shelfOf(family.parent)).toEqual(['Eggs']);
  });

  it('goes with the household when it is exported, and a damaged shelf never unseats the other settings', async () => {
    const family = await newFamily(server);
    await family.parent.do('shopping.favourite', {
      text: 'Oats',
      picture: 'other',
      category: 'pantry',
      on: true,
    });
    const exported = await family.parent.get<{
      household: { settings: { shopping: { favourites: { text: string }[] } } };
    }>('/export/household.json');
    expect(exported.body.household.settings.shopping.favourites.map((entry) => entry.text)).toEqual(['Oats']);
    // A parent's own switch cannot be used to push nonsense onto the shelf.
    const nonsense = await family.parent.op('household.settings', {
      patch: { labels: false, shopping: { favourites: [{ text: '', picture: 5, category: null }] } },
    });
    expect(nonsense.status).toBe('applied');
    const after = (await family.parent.pull()).household.settings;
    // The shelf fell back to empty rather than the whole change being lost or the settings being reset.
    expect(after.labels).toBe(false);
    expect(after.shopping.favourites).toEqual([]);
  });
});

describe('a child asking for something', () => {
  it('puts a picture on the list for a grown-up to answer, and buys nothing', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const wall = await pairWall(family);
    const itemId = newId();
    await wall.do('shopping.request', { itemId, profileId: kit, picture: 'berries' });
    expect(wall.snapshot!.items[0]).toMatchObject({
      status: 'requested',
      requestedBy: kit,
      picture: 'berries',
      text: 'Berries',
    });
    // It cannot be ticked off until a grown-up has said yes.
    expect(await wall.op('shopping.check', { itemId, checked: true })).toMatchObject({
      reason: 'not_allowed_now',
    });
    // A wall in child mode cannot say yes for the grown-up.
    expect(await wall.op('shopping.decide', { itemId, accept: true })).toMatchObject({ reason: 'forbidden' });
    await family.parent.do('shopping.decide', { itemId, accept: true });
    expect((await wall.pull()).items[0]).toMatchObject({ status: 'needed' });
    expect(server.outbound).toHaveLength(0);
  });

  it('stops at a handful of asks, and asking for the same thing twice is one ask', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const wall = await pairWall(family);
    for (const picture of ['milk', 'bread', 'eggs', 'apple', 'banana'] as const) {
      await wall.do('shopping.request', { itemId: newId(), profileId: kit, picture });
    }
    await wall.do('shopping.request', { itemId: newId(), profileId: kit, picture: 'milk' });
    expect(wall.snapshot!.items).toHaveLength(5);
    expect(
      await wall.op('shopping.request', { itemId: newId(), profileId: kit, picture: 'cheese' }),
    ).toMatchObject({ reason: 'limit_reached' });
  });

  it('cannot type: a child’s request is a picture from the list of pictures and nothing else', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const wall = await pairWall(family);
    const odd = await wall.ops([
      {
        id: newId(),
        type: 'shopping.request',
        input: { itemId: newId(), profileId: kit, picture: 'a pony', text: 'A PONY' },
      },
    ]);
    expect(odd[0]).toMatchObject({ status: 'rejected', reason: 'invalid' });
  });
});

describe('what people type', () => {
  it('stores hostile text as plain text and never as anything else', async () => {
    const family = await newFamily(server);
    const list = await groceries(family);
    const nasty = "<img src=x onerror=alert(1)> '; drop table homebase.ledger; --";
    await family.parent.do('shopping.add', item(list, nasty, { note: '<script>alert(2)</script>' }));
    const stored = (await family.parent.pull()).items[0];
    expect(stored?.text).toBe(nasty);
    expect(stored?.note).toBe('<script>alert(2)</script>');
    const ledger = await server.database.db.execute(`select count(*)::int as c from homebase.ledger`);
    expect((ledger.rows[0] as { c: number }).c).toBeGreaterThanOrEqual(0);
  });

  it('keeps a link only if it is an ordinary web address with nothing hidden in it', async () => {
    const family = await newFamily(server);
    const list = await groceries(family);
    await family.parent.do('shopping.add', item(list, 'Boots', { url: 'https://shop.example/boots?size=9' }));
    for (const url of [
      'javascript:alert(1)',
      'data:text/html,<script>1</script>',
      'https://user:pass@shop.example/',
      'file:///etc/passwd',
    ]) {
      expect(
        await family.parent.op('shopping.add', item(list, `Thing ${url.length}`, { url })),
        url,
      ).toMatchObject({ reason: 'invalid' });
    }
    // The server never fetched anything, link or no link.
    expect(server.outbound).toHaveLength(0);
  });

  it('strips control characters and refuses what is empty or enormous', async () => {
    const family = await newFamily(server);
    const list = await groceries(family);
    await family.parent.do('shopping.add', item(list, 'Mi\u0000lk\u0007   two'));
    expect((await family.parent.pull()).items[0]?.text).toBe('Milk two');
    expect(await family.parent.op('shopping.add', item(list, '   '))).toMatchObject({ reason: 'invalid' });
    expect(await family.parent.op('shopping.add', item(list, 'x'.repeat(500)))).toMatchObject({
      reason: 'invalid',
    });
  });
});
