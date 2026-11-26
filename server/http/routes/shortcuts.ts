import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import * as v from 'valibot';
import { isUuid } from '../../../shared/ids.js';
import { hasAccess, type AccessLevel } from '../../../shared/model.js';
import { classifyItem, normalizeItem, parseLines } from '../../../shared/shopping.js';
import { fingerprint, newToken } from '../../auth/crypto.js';
import { attempt, LIMITS } from '../../auth/rate-limit.js';
import { asSystem, inHousehold } from '../../db/client.js';
import { memberships, shoppingLists, shortcutTokens, users } from '../../db/schema.js';
import { auditLog, bumpRevision, lockHousehold, makeCtx, Reject, type Actor } from '../../domain/context.js';
import { addItem } from '../../domain/shopping.js';
import { clientKey, readJson, requireGuardianSession, withHousehold, type AppEnv, type C } from '../env.js';
import { badRequest, conflict, forbidden, HttpError, notFound, tooMany, unauthenticated } from '../errors.js';

/**
 * "Hey Siri, add milk to the shopping list." An Apple Shortcut on a grown-up's phone sends what was said here,
 * with a key of its own.
 *
 * The key is narrow on purpose. It is not a session: no cookie, nothing else in the API accepts it, and all it
 * can do is add things to the household's lists — as its owner, so the list says "Siri (Sam)". Each grown-up
 * makes their own keys (at most five), sees them by name, and can take any one back; a guardian can take back
 * anybody's. Only the key's SHA-256 is kept, it is shown once, and it is never written to a log. A key stops
 * working the moment its owner leaves the household.
 *
 *   GET    /shortcuts/tokens       my keys, by name
 *   POST   /shortcuts/tokens       make a key (shown this once)
 *   DELETE /shortcuts/tokens/:id   take a key back
 *   POST   /shortcuts/add          what the Shortcut calls: Authorization: Bearer hbs_…
 */

export const TOKEN_PREFIX = 'hbs_';
/** The most live keys one grown-up has in one household. */
export const MAX_TOKENS = 5;
/** The most things one sentence adds. */
const MAX_THINGS = 20;
const MAX_TEXT = 400;

/** One sentence for every key that does not work, so a guesser learns nothing from which it was. */
const NOT_A_KEY = 'That shortcut key does not work any more. Make a new one in HOMEBASE, in Settings.';

function levelOf(role: string): AccessLevel {
  return role === 'owner' ? 'owner' : role === 'guardian' ? 'guardian' : 'caregiver';
}

export const shortcutRoutes = new Hono<AppEnv>();

shortcutRoutes.get('/tokens', async (c) => {
  const session = requireGuardianSession(c);
  const rows = await withHousehold(c, 'caregiver', (ctx) =>
    ctx.tx
      .select({
        id: shortcutTokens.id,
        name: shortcutTokens.name,
        createdAt: shortcutTokens.createdAt,
        lastUsedAt: shortcutTokens.lastUsedAt,
      })
      .from(shortcutTokens)
      .where(
        and(
          eq(shortcutTokens.householdId, ctx.household.id),
          eq(shortcutTokens.userId, session.userId),
          isNull(shortcutTokens.revokedAt),
        ),
      )
      .orderBy(asc(shortcutTokens.createdAt)),
  );
  return c.json({
    tokens: rows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    })),
  });
});

shortcutRoutes.post('/tokens', async (c) => {
  const session = requireGuardianSession(c);
  const parsed = v.safeParse(
    v.object({ name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(40)) }),
    await readJson(c, 4 * 1024),
  );
  if (!parsed.success) throw badRequest('Give the shortcut a name of up to 40 letters, like “Sam’s iPhone”.');
  const { name } = parsed.output;
  const token = `${TOKEN_PREFIX}${newToken()}`;
  const id = crypto.randomUUID();
  await withHousehold(
    c,
    'caregiver',
    async (ctx) => {
      const live = await ctx.tx
        .select({ count: sql<number>`count(*)::int` })
        .from(shortcutTokens)
        .where(
          and(
            eq(shortcutTokens.householdId, ctx.household.id),
            eq(shortcutTokens.userId, session.userId),
            isNull(shortcutTokens.revokedAt),
          ),
        );
      if (Number(live[0]?.count ?? 0) >= MAX_TOKENS) {
        throw conflict(
          `You already have ${MAX_TOKENS} shortcut keys. Remove one you no longer use, then make a new one.`,
        );
      }
      await ctx.tx.insert(shortcutTokens).values({
        id,
        householdId: ctx.household.id,
        userId: session.userId,
        name,
        tokenHash: fingerprint(token),
        createdAt: ctx.now,
      });
      await auditLog(ctx, 'shortcut.created', { tokenId: id, name });
    },
    { lock: true },
  );
  // Shown once. Only its hash is kept.
  return c.json({ id, name, token }, 201);
});

shortcutRoutes.delete('/tokens/:id', async (c) => {
  const session = requireGuardianSession(c);
  const tokenId = c.req.param('id');
  if (!isUuid(tokenId)) throw notFound('That shortcut key is not here.');
  await withHousehold(
    c,
    'caregiver',
    async (ctx) => {
      const rows = await ctx.tx
        .select({ userId: shortcutTokens.userId, revokedAt: shortcutTokens.revokedAt })
        .from(shortcutTokens)
        .where(and(eq(shortcutTokens.id, tokenId), eq(shortcutTokens.householdId, ctx.household.id)))
        .limit(1);
      const found = rows[0];
      if (!found) throw notFound('That shortcut key is not here.');
      if (found.userId !== session.userId && !hasAccess(ctx.actor.level, 'guardian')) {
        throw forbidden('Only its owner or a parent can remove that shortcut key.');
      }
      if (found.revokedAt) return;
      await ctx.tx.update(shortcutTokens).set({ revokedAt: ctx.now }).where(eq(shortcutTokens.id, tokenId));
      await auditLog(ctx, 'shortcut.revoked', { tokenId });
    },
    { lock: true },
  );
  return c.json({ ok: true });
});

interface Holder {
  tokenId: string;
  householdId: string;
  userId: string;
  role: string;
  displayName: string;
}

/** Whose key this is — or nobody's, for a key that is unknown, taken back, or belongs to someone who left. */
async function holderOf(c: C, token: string): Promise<Holder | null> {
  const rows = await asSystem(c.get('database'), (tx) =>
    tx
      .select({
        tokenId: shortcutTokens.id,
        householdId: shortcutTokens.householdId,
        userId: shortcutTokens.userId,
        role: memberships.role,
        displayName: users.displayName,
      })
      .from(shortcutTokens)
      .innerJoin(
        memberships,
        and(
          eq(memberships.householdId, shortcutTokens.householdId),
          eq(memberships.userId, shortcutTokens.userId),
        ),
      )
      .innerJoin(users, eq(users.id, shortcutTokens.userId))
      .where(
        and(
          eq(shortcutTokens.tokenHash, fingerprint(token)),
          isNull(shortcutTokens.revokedAt),
          isNull(users.disabledAt),
        ),
      )
      .limit(1),
  );
  return rows[0] ?? null;
}

/** What was said, from a JSON body (`{ text, list? }`) or plain text. */
async function readSaid(c: C): Promise<{ text: string; list: string | null }> {
  const type = (c.req.header('content-type') ?? '').toLowerCase();
  if (type.startsWith('text/plain')) {
    const length = Number(c.req.header('content-length') ?? '0');
    if (length > 4 * 1024) throw new HttpError('payload_too_large', 'That is too much to add at once.');
    const text = (await c.req.text()).trim();
    if (text === '' || text.length > MAX_TEXT) throw badRequest('Say up to a few things to add.');
    return { text, list: null };
  }
  const parsed = v.safeParse(
    v.object({
      text: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(MAX_TEXT)),
      list: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(60)))),
    }),
    await readJson(c, 4 * 1024),
  );
  if (!parsed.success) throw badRequest('Say up to a few things to add.');
  return { text: parsed.output.text, list: parsed.output.list || null };
}

/** "milk", "milk and eggs", "milk, eggs and bread". */
function joinAnd(words: readonly string[]): string {
  if (words.length <= 1) return words[0] ?? '';
  return `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
}

/** A thing as Siri would say it: "2 bread", "3 lbs apples", "milk". */
function aloud(line: { text: string; quantity: number | null; unit: string | null }): string {
  if (line.quantity === null) return line.text;
  return line.unit ? `${line.quantity} ${line.unit} ${line.text}` : `${line.quantity} ${line.text}`;
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** One sentence for Siri to say. */
export function sentenceFor(list: string, added: readonly string[], already: readonly string[]): string {
  if (added.length === 0) {
    return `${capital(joinAnd(already))} ${already.length === 1 ? 'was' : 'were'} already on ${list}.`;
  }
  const done = `Added ${joinAnd(added)} to ${list}`;
  if (already.length === 0) return `${done}.`;
  return `${done}; ${joinAnd(already)} ${already.length === 1 ? 'was' : 'were'} already there.`;
}

shortcutRoutes.post('/add', async (c) => {
  const now = c.get('now');
  const database = c.get('database');
  const deps = c.get('deps');

  // The key is the only thing that counts here; a cookie, if one came along, is not looked at.
  const header = c.req.header('authorization') ?? '';
  const match = /^Bearer\s+(hbs_[A-Za-z0-9_-]{32,100})\s*$/.exec(header);
  const holder = match?.[1] ? await holderOf(c, match[1]) : null;
  if (!holder) {
    const limited = await asSystem(database, (tx) =>
      attempt(tx, `shortcut-unknown:${clientKey(c)}`, LIMITS.shortcutUnknown, now),
    );
    if (!limited.allowed) throw tooMany(limited.retryAfter);
    throw unauthenticated(NOT_A_KEY);
  }
  const limited = await asSystem(database, (tx) =>
    attempt(tx, `shortcut:${holder.tokenId}`, LIMITS.shortcut, now),
  );
  if (!limited.allowed) throw tooMany(limited.retryAfter);

  const said = await readSaid(c);
  const lines = parseLines(said.text, MAX_THINGS).filter((line) => normalizeItem(line.text) !== '');
  if (lines.length === 0) throw badRequest('Say what to add, like “milk and eggs”.');

  const actor: Actor = {
    level: levelOf(holder.role),
    name: `shortcut:${holder.displayName}`,
    userId: holder.userId,
    deviceId: null,
  };
  const result = await inHousehold(database, holder.householdId, async (tx) => {
    const household = await lockHousehold(tx, holder.householdId);
    if (!household) throw unauthenticated(NOT_A_KEY);
    const ctx = makeCtx(tx, household, actor, now, { academyHosts: deps.config.academyHosts });

    // The list asked for by name; else the first groceries list; else the first list of any kind.
    const lists = await tx
      .select({ id: shoppingLists.id, name: shoppingLists.name, kind: shoppingLists.kind })
      .from(shoppingLists)
      .where(and(eq(shoppingLists.householdId, household.id), isNull(shoppingLists.archivedAt)))
      .orderBy(asc(shoppingLists.sort), desc(shoppingLists.createdAt))
      .limit(100);
    const wanted = said.list?.toLowerCase();
    const list =
      (wanted ? lists.find((one) => one.name.trim().toLowerCase() === wanted) : undefined) ??
      lists.find((one) => one.kind === 'groceries') ??
      lists[0];
    if (!list) throw conflict('There is no shopping list yet. Make one in HOMEBASE first.');

    // Each thing goes on exactly as if it had been typed: the same rule, the same merging, the same history.
    const added: string[] = [];
    const spoken = { added: [] as string[], already: [] as string[] };
    for (const line of lines) {
      const guess = classifyItem(line.text);
      const done = await addItem(ctx, {
        itemId: crypto.randomUUID(),
        listId: list.id,
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
      if (done.outcome === 'already') spoken.already.push(aloud(line));
      else {
        added.push(line.text);
        spoken.added.push(aloud(line));
      }
    }
    await bumpRevision(ctx);
    await tx.update(shortcutTokens).set({ lastUsedAt: now }).where(eq(shortcutTokens.id, holder.tokenId));
    return { list: list.name, added, message: sentenceFor(list.name, spoken.added, spoken.already) };
  }).catch((error: unknown) => {
    // A "no" from the list's own rules: nothing was added, and the reason is said plainly.
    if (error instanceof Reject) throw badRequest(error.message);
    throw error;
  });

  return c.json({
    ok: true,
    list: result.list,
    added: result.added,
    message: result.message,
  });
});
