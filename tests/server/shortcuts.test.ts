import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '../../shared/ids.js';
import { LIMITS } from '../../server/auth/rate-limit.js';
import { asSystem } from '../../server/db/client.js';
import { audit, shoppingItemHistory, shortcutTokens } from '../../server/db/schema.js';
import { Browser, newFamily, ORIGIN, startServer, type Family, type TestServer } from './harness.js';

/**
 * "Hey Siri, add milk to the shopping list." A narrow key, made by a grown-up, that adds to the lists and does
 * nothing else — and stops working when it is taken back or its owner leaves.
 */

let server: TestServer;
beforeAll(async () => {
  server = await startServer({}, '2026-03-03T21:00:00Z');
});
afterAll(async () => {
  await server.close();
});

interface Added {
  ok: boolean;
  list: string;
  added: string[];
  message: string;
}

/** What a Shortcut sends: no cookie, no Origin, only the key. */
async function shortcut(token: string, body: unknown, type = 'application/json', cookie?: string) {
  const headers: Record<string, string> = { authorization: `Bearer ${token}`, 'content-type': type };
  if (cookie) headers.cookie = cookie;
  const response = await server.app.request(`${ORIGIN}/api/shortcuts/add`, {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, headers: response.headers, body: JSON.parse(text) as Added & Problem };
}

interface Problem {
  error: { code: string; message: string };
}

async function makeToken(browser: Browser, name = 'My iPhone') {
  const reply = await browser.post<{ id: string; name: string; token: string }>('/shortcuts/tokens', {
    name,
  });
  expect(reply.status).toBe(201);
  return reply.body;
}

async function needed(family: Family, listName = 'Groceries') {
  const snapshot = await family.parent.pull();
  const list = snapshot.lists.find((one) => one.name === listName)!;
  return snapshot.items.filter((item) => item.listId === list.id && item.status === 'needed');
}

async function joinAs(family: Family, role: 'guardian' | 'caregiver', displayName: string) {
  const invite = await family.parent.post<{ code: string }>('/auth/invites', { role });
  const browser = new Browser(server);
  const joined = await browser.post('/auth/join', {
    code: invite.body.code,
    email: `${displayName.toLowerCase()}-${newId()}@example.test`,
    password: 'another long password',
    displayName,
  });
  expect(joined.status).toBeLessThan(300);
  const me = await browser.get<{ me: { id: string } }>('/auth/me');
  return { browser, userId: me.body.me.id };
}

describe('shortcut keys', () => {
  it('are made, listed by name (never the key), and taken back', async () => {
    const family = await newFamily(server);
    const made = await makeToken(family.parent, 'Sam’s iPhone');
    expect(made.token).toMatch(/^hbs_[A-Za-z0-9_-]{32,}$/);
    expect(made.name).toBe('Sam’s iPhone');

    const listed = await family.parent.get<{ tokens: Record<string, unknown>[] }>('/shortcuts/tokens');
    expect(listed.body.tokens).toEqual([
      { id: made.id, name: 'Sam’s iPhone', createdAt: expect.any(String), lastUsedAt: null },
    ]);
    expect(JSON.stringify(listed.body)).not.toContain(made.token.slice(4, 20));

    // Only the hash is kept, and the record says one was made without saying what it was.
    const stored = await asSystem(server.database, (tx) =>
      tx.select().from(shortcutTokens).where(eq(shortcutTokens.id, made.id)),
    );
    expect(stored[0]?.tokenHash).not.toContain(made.token);
    const notes = await asSystem(server.database, (tx) =>
      tx.select().from(audit).where(eq(audit.householdId, family.householdId)),
    );
    expect(notes.some((note) => note.action === 'shortcut.created')).toBe(true);
    expect(JSON.stringify(notes)).not.toContain(made.token);

    expect((await family.parent.request('DELETE', `/shortcuts/tokens/${made.id}`)).status).toBe(200);
    expect((await family.parent.request('DELETE', `/shortcuts/tokens/${made.id}`)).status).toBe(200);
    expect((await family.parent.get<{ tokens: unknown[] }>('/shortcuts/tokens')).body.tokens).toEqual([]);
  });

  it('are each person’s own: a helper sees only theirs, a parent can take back anyone’s', async () => {
    const family = await newFamily(server);
    const gran = await joinAs(family, 'caregiver', 'Gran');
    const theirs = await makeToken(gran.browser, 'Gran’s phone');
    const mine = await makeToken(family.parent);
    const seen = await gran.browser.get<{ tokens: { id: string }[] }>('/shortcuts/tokens');
    expect(seen.body.tokens.map((token) => token.id)).toEqual([theirs.id]);
    expect((await gran.browser.request('DELETE', `/shortcuts/tokens/${mine.id}`)).status).toBe(403);
    expect((await family.parent.request('DELETE', `/shortcuts/tokens/${theirs.id}`)).status).toBe(200);
    expect((await shortcut(theirs.token, { text: 'milk' })).status).toBe(401);
  });

  it('are at most five for one person', async () => {
    const family = await newFamily(server);
    for (let index = 0; index < 5; index++) await makeToken(family.parent, `Phone ${index}`);
    const sixth = await family.parent.post<Problem>('/shortcuts/tokens', { name: 'One too many' });
    expect(sixth.status).toBe(409);
    expect(sixth.body.error.message).toMatch(/5 shortcut keys/);
  });

  it('cannot be made without signing in', async () => {
    expect((await new Browser(server).post('/shortcuts/tokens', { name: 'x' })).status).toBe(401);
  });
});

describe('adding by shortcut', () => {
  it('adds what was said, as Siri on behalf of its owner, exactly as if typed', async () => {
    const family = await newFamily(server, { name: 'Sam' });
    const { token } = await makeToken(family.parent);
    const reply = await shortcut(token, { text: 'milk, eggs and 2 bread' });
    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({
      ok: true,
      list: 'Groceries',
      added: ['milk', 'eggs', 'bread'],
      message: 'Added milk, eggs and 2 bread to Groceries.',
    });
    const items = await needed(family);
    const bread = items.find((item) => item.text === 'bread');
    expect(bread?.quantity).toBe(2);
    expect(items.find((item) => item.text === 'milk')?.addedBy).toBe('Siri (Sam)');

    const history = await asSystem(server.database, (tx) =>
      tx
        .select()
        .from(shoppingItemHistory)
        .where(
          and(
            eq(shoppingItemHistory.householdId, family.householdId),
            eq(shoppingItemHistory.itemId, bread!.id),
          ),
        ),
    );
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ actor: 'shortcut:Sam', change: 'added', after: { via: 'voice' } });

    const listed = await family.parent.get<{ tokens: { lastUsedAt: string | null }[] }>('/shortcuts/tokens');
    expect(listed.body.tokens[0]?.lastUsedAt).toBe(server.clock.now().toISOString());
  });

  it('takes plain text too, and tells every screen once', async () => {
    const family = await newFamily(server);
    const { token } = await makeToken(family.parent);
    const before = (await family.parent.pull()).rev;
    const reply = await shortcut(token, 'apples\nbananas', 'text/plain');
    expect(reply.status).toBe(200);
    expect(reply.body.added).toEqual(['apples', 'bananas']);
    expect((await family.parent.pull()).rev).toBe(before + 1);
  });

  it('merges what is already on the list, and says so', async () => {
    const family = await newFamily(server);
    const { token } = await makeToken(family.parent);
    await shortcut(token, { text: 'milk' });
    const again = await shortcut(token, { text: 'Milk' });
    expect(again.body).toMatchObject({ added: [], message: 'Milk was already on Groceries.' });
    const mixed = await shortcut(token, { text: 'milk and cheese' });
    expect(mixed.body.message).toBe('Added cheese to Groceries; milk was already there.');
    const items = await needed(family);
    const milk = items.filter((item) => item.text.toLowerCase() === 'milk');
    expect(milk).toHaveLength(1);
    expect(milk[0]?.alsoAsked).toBe(2);
  });

  it('puts things on a list asked for by name, whatever its capitals', async () => {
    const family = await newFamily(server);
    const listId = newId();
    await family.parent.do('list.create', { listId, name: 'Hardware', kind: 'general' });
    const { token } = await makeToken(family.parent);
    const reply = await shortcut(token, { text: 'nails', list: 'hardware' });
    expect(reply.body).toMatchObject({ list: 'Hardware', message: 'Added nails to Hardware.' });
    expect((await needed(family, 'Hardware')).map((item) => item.text)).toEqual(['nails']);
    // A list that is not there: the groceries list.
    const fallback = await shortcut(token, { text: 'soap', list: 'Nowhere' });
    expect(fallback.body.list).toBe('Groceries');
  });

  it('refuses a key that was taken back, or never was, in the same words', async () => {
    const family = await newFamily(server);
    const made = await makeToken(family.parent);
    await family.parent.request('DELETE', `/shortcuts/tokens/${made.id}`);
    const revoked = await shortcut(made.token, { text: 'milk' });
    expect(revoked.status).toBe(401);
    const garbage = await shortcut(`hbs_${'x'.repeat(43)}`, { text: 'milk' });
    expect(garbage.status).toBe(401);
    expect(garbage.body.error.message).toBe(revoked.body.error.message);
    const malformed = await shortcut('not-even-a-key', { text: 'milk' });
    expect(malformed.status).toBe(401);
    expect(await needed(family)).toEqual([]);
  });

  it('stops working when its owner is removed from the household', async () => {
    const family = await newFamily(server);
    const robin = await joinAs(family, 'guardian', 'Robin');
    const { token } = await makeToken(robin.browser);
    expect((await shortcut(token, { text: 'milk' })).status).toBe(200);
    await family.parent.do('member.remove', { userId: robin.userId });
    const after = await shortcut(token, { text: 'eggs' });
    expect(after.status).toBe(401);
  });

  it('is slowed down when used too often', async () => {
    const family = await newFamily(server);
    const { token } = await makeToken(family.parent);
    // Start a fresh window, so the count is not split across two.
    server.clock.set('2026-03-04T10:00:00Z');
    for (let index = 0; index < LIMITS.shortcut.max; index++) {
      expect((await shortcut(token, { text: `thing ${index}` })).status).toBe(200);
    }
    const slowed = await shortcut(token, { text: 'one more' });
    expect(slowed.status).toBe(429);
    expect(Number(slowed.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('cannot be used with a cookie in place of the key', async () => {
    const family = await newFamily(server);
    const response = await server.app.request(`${ORIGIN}/api/shortcuts/add`, {
      method: 'POST',
      headers: { cookie: family.parent.cookie!, origin: ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'milk' }),
    });
    expect(response.status).toBe(401);
  });

  it('is not a session: nothing else in the API accepts the key', async () => {
    const family = await newFamily(server);
    const { token } = await makeToken(family.parent);
    const bearer = { authorization: `Bearer ${token}` };
    for (const path of ['/api/sync', '/api/auth/me', '/api/shortcuts/tokens']) {
      const response = await server.app.request(`${ORIGIN}${path}`, { headers: bearer });
      const body = (await response.json()) as { signedIn?: boolean };
      if (path === '/api/auth/me') expect(body.signedIn).toBe(false);
      else expect(response.status).toBe(401);
    }
    const ops = await server.app.request(`${ORIGIN}/api/sync/ops`, {
      method: 'POST',
      headers: { ...bearer, 'content-type': 'application/json' },
      body: JSON.stringify({ ops: [] }),
    });
    expect(ops.status).toBe(401);
  });

  it('touches only its own household', async () => {
    const ours = await newFamily(server);
    const theirs = await newFamily(server);
    const listId = newId();
    await ours.parent.do('list.create', { listId, name: 'Party', kind: 'general' });
    const { token } = await makeToken(theirs.parent);
    const reply = await shortcut(token, { text: 'balloons', list: 'Party' });
    expect(reply.body.list).toBe('Groceries');
    expect(await needed(ours, 'Party')).toEqual([]);
    expect(await needed(ours)).toEqual([]);
    expect((await needed(theirs)).map((item) => item.text)).toEqual(['balloons']);
  });
});
