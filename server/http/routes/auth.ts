import { and, asc, eq, gt, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import * as v from 'valibot';
import { isUuid } from '../../../shared/ids.js';
import { hasAccess, type GuardianRole } from '../../../shared/model.js';
import { AVATAR_IDS } from '../../../shared/pictures.js';
import { isValidTimeZone } from '../../../shared/time.js';
import {
  codeFingerprint,
  formatCode,
  hashPassword,
  hashPin,
  isValidPin,
  newCode,
  verifyPassword,
} from '../../auth/crypto.js';
import { attempt, check, forgive, LIMITS } from '../../auth/rate-limit.js';
import {
  accessOf,
  clearedCookie,
  createGuardianSession,
  revokeSession,
  revokeUserSessions,
  sessionCookie,
} from '../../auth/sessions.js';
import { asSystem } from '../../db/client.js';
import {
  audit,
  households,
  invites,
  memberships,
  recoveryCodes,
  shoppingLists,
  users,
} from '../../db/schema.js';
import type { Tx } from '../../db/types.js';
import { readSettings } from '../../../shared/settings.js';
import { clientKey, readJson, requireGuardianSession, requireSession, type AppEnv, type C } from '../env.js';
import { badRequest, conflict, forbidden, HttpError, notFound, tooMany, unauthenticated } from '../errors.js';

/**
 * Grown-ups' accounts: signing up, signing in, inviting the other parent, getting back in.
 *
 * There is no e-mail in any of it. An address is only a name to sign in with; HOMEBASE never sends a message,
 * so there is no mail service to pay for or to leak through. Getting back in after a forgotten password is by a
 * recovery code written down at sign-up, or by the household's owner making a one-use reset link.
 */

const email = v.pipe(
  v.string(),
  v.trim(),
  v.toLowerCase(),
  v.maxLength(200),
  v.regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'an e-mail address'),
);
const password = v.pipe(v.string(), v.minLength(10, 'at least ten characters'), v.maxLength(200));
const name = (max: number) => v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(max));
const avatar = v.optional(v.picklist(AVATAR_IDS), 'owl');
const timeZone = v.pipe(
  v.string(),
  v.check((value: string) => isValidTimeZone(value), 'a time zone'),
);

function parse<T extends v.GenericSchema>(schema: T, body: unknown): v.InferOutput<T> {
  const result = v.safeParse(schema, body);
  if (!result.success) {
    const issue = result.issues[0];
    const field = issue?.path?.map((part) => String(part.key)).join('.') ?? '';
    throw badRequest(
      field ? `Please check “${field}”: ${issue?.message ?? 'not valid'}.` : 'Please check what was entered.',
      { field },
    );
  }
  return result.output;
}

const RECOVERY_CODES = 8;
const INVITE_HOURS = 48;
const RESET_HOURS = 24;

async function makeRecoveryCodes(tx: Tx, userId: string): Promise<string[]> {
  await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId));
  const codes = Array.from({ length: RECOVERY_CODES }, () => newCode(10));
  await tx
    .insert(recoveryCodes)
    .values(codes.map((code) => ({ id: crypto.randomUUID(), userId, codeHash: codeFingerprint(code) })));
  return codes.map((code) => `${code.slice(0, 5)}-${code.slice(5)}`);
}

async function note(
  tx: Tx,
  householdId: string,
  action: string,
  actor: string,
  at: Date,
  detail: Record<string, unknown> = {},
) {
  await tx.insert(audit).values({ id: crypto.randomUUID(), householdId, at, action, actor, detail });
}

function setSession(c: C, token: string, maxAgeMs: number): void {
  c.header('Set-Cookie', sessionCookie(token, maxAgeMs, c.get('secure')));
}

/** A hash to check against when there is no such account, so that a wrong e-mail takes as long as a wrong password. */
let decoy: Promise<string> | null = null;

export const authRoutes = new Hono<AppEnv>();

authRoutes.post('/signup', async (c) => {
  const deps = c.get('deps');
  const now = c.get('now');
  const body = parse(
    v.object({ email, password, displayName: name(30), avatar, householdName: name(40), timeZone }),
    await readJson(c),
  );
  const database = c.get('database');
  const limited = await asSystem(database, (tx) => attempt(tx, `signup:${clientKey(c)}`, LIMITS.signUp, now));
  if (!limited.allowed) throw tooMany(limited.retryAfter);
  const passwordHash = await hashPassword(body.password, deps.hashCost);

  const created = await asSystem(database, async (tx) => {
    // One family owns a deployment unless it has been opened to more. Checked under a lock, so two sign-ups
    // racing for an empty deployment cannot both win.
    await tx.execute(sql`select pg_advisory_xact_lock(4846252)`);
    if (!deps.config.openSignup) {
      const real = await tx
        .select({ id: households.id })
        .from(households)
        .where(eq(households.demo, false))
        .limit(1);
      if (real[0]) {
        throw forbidden('This HOMEBASE already belongs to a family. Ask them for an invitation.');
      }
    }
    const taken = await tx
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${body.email}`)
      .limit(1);
    if (taken[0]) throw conflict('There is already an account with that e-mail address. Sign in instead.');
    const userId = crypto.randomUUID();
    const householdId = crypto.randomUUID();
    await tx.insert(users).values({
      id: userId,
      email: body.email,
      displayName: body.displayName,
      avatar: body.avatar,
      passwordHash,
      createdAt: now,
    });
    await tx
      .insert(households)
      .values({ id: householdId, name: body.householdName, timeZone: body.timeZone, createdAt: now });
    await tx
      .insert(memberships)
      .values({ id: crypto.randomUUID(), householdId, userId, role: 'owner', createdAt: now });
    await tx.insert(shoppingLists).values([
      { id: crypto.randomUUID(), householdId, name: 'Groceries', kind: 'groceries', sort: 1 },
      { id: crypto.randomUUID(), householdId, name: 'To buy', kind: 'general', sort: 2 },
    ]);
    const codes = await makeRecoveryCodes(tx, userId);
    await note(tx, householdId, 'household.created', `guardian:${body.displayName}`, now);
    const session = await createGuardianSession(tx, { userId, householdId }, now);
    return { session, codes, householdId, userId };
  });
  setSession(c, created.session.token, created.session.maxAgeMs);
  return c.json({ ok: true, householdId: created.householdId, recoveryCodes: created.codes }, 201);
});

authRoutes.post('/login', async (c) => {
  const deps = c.get('deps');
  const now = c.get('now');
  const database = c.get('database');
  const body = parse(v.object({ email, password: v.pipe(v.string(), v.maxLength(200)) }), await readJson(c));
  const emailKey = `signin:${codeFingerprint(body.email).slice(0, 24)}`;
  const addressKey = `signin-addr:${clientKey(c)}`;

  const gate = await asSystem(database, async (tx) => {
    const byEmail = await check(tx, emailKey, LIMITS.signIn, now);
    const byAddress = await attempt(tx, addressKey, LIMITS.signInAddress, now);
    return !byEmail.allowed ? byEmail : byAddress;
  });
  if (!gate.allowed) throw tooMany(gate.retryAfter);

  const found = await asSystem(database, (tx) =>
    tx
      .select({
        id: users.id,
        passwordHash: users.passwordHash,
        disabledAt: users.disabledAt,
        displayName: users.displayName,
      })
      .from(users)
      .where(sql`lower(${users.email}) = ${body.email}`)
      .limit(1),
  );
  const user = found[0];
  decoy ??= hashPassword('not-a-real-password', deps.hashCost);
  const ok = await verifyPassword(body.password, user?.passwordHash ?? (await decoy));
  if (!user || !ok || user.disabledAt) {
    await asSystem(database, (tx) => attempt(tx, emailKey, LIMITS.signIn, now));
    throw unauthenticated('That e-mail address and password do not match.');
  }

  const result = await asSystem(database, async (tx) => {
    const member = await tx
      .select({ householdId: memberships.householdId })
      .from(memberships)
      .where(eq(memberships.userId, user.id))
      .orderBy(asc(memberships.createdAt))
      .limit(1);
    if (!member[0]) return null;
    await forgive(tx, emailKey);
    await note(tx, member[0].householdId, 'guardian.signed_in', `guardian:${user.displayName}`, now);
    return createGuardianSession(tx, { userId: user.id, householdId: member[0].householdId }, now);
  });
  if (!result) throw forbidden('That account is not part of a household any more. Ask for a new invitation.');
  setSession(c, result.token, result.maxAgeMs);
  return c.json({ ok: true });
});

authRoutes.post('/logout', async (c) => {
  const session = c.get('session');
  if (session) await asSystem(c.get('database'), (tx) => revokeSession(tx, session.id, c.get('now')));
  c.header('Set-Cookie', clearedCookie(c.get('secure')));
  return c.json({ ok: true });
});

authRoutes.get('/me', async (c) => {
  const session = c.get('session');
  if (!session) return c.json({ signedIn: false });
  const database = c.get('database');
  const info = await asSystem(database, async (tx) => {
    const household = await tx
      .select()
      .from(households)
      .where(eq(households.id, session.householdId))
      .limit(1);
    const row = household[0];
    if (!row) return null;
    let me: { id: string; displayName: string; email: string; avatar: string; hasPin: boolean } | null = null;
    if (session.kind === 'guardian' && session.userId) {
      const found = await tx
        .select({
          id: users.id,
          displayName: users.displayName,
          email: users.email,
          avatar: users.avatar,
          pinHash: memberships.pinHash,
        })
        .from(users)
        .innerJoin(
          memberships,
          and(eq(memberships.userId, users.id), eq(memberships.householdId, session.householdId)),
        )
        .where(eq(users.id, session.userId))
        .limit(1);
      if (found[0])
        me = {
          id: found[0].id,
          displayName: found[0].displayName,
          email: found[0].email,
          avatar: found[0].avatar,
          hasPin: found[0].pinHash !== null,
        };
    }
    return { row, me };
  });
  if (!info) return c.json({ signedIn: false });
  return c.json({
    signedIn: true,
    kind: session.kind,
    role: session.role,
    access: accessOf(session, readSettings(info.row.settings).wall.holdGate),
    household: { id: info.row.id, name: info.row.name, demo: info.row.demo },
    me: info.me,
    deviceId: session.deviceId,
    unlockedUntil: session.unlockedUntil?.toISOString() ?? null,
  });
});

authRoutes.post('/profile', async (c) => {
  const session = requireGuardianSession(c);
  const body = parse(v.object({ displayName: name(30), avatar: v.picklist(AVATAR_IDS) }), await readJson(c));
  await asSystem(c.get('database'), async (tx) => {
    await tx
      .update(users)
      .set({ displayName: body.displayName, avatar: body.avatar })
      .where(eq(users.id, session.userId));
    // Every screen shows grown-ups' names and pictures: tell them there is news.
    await tx
      .update(households)
      .set({ revision: sql`${households.revision} + 1` })
      .where(eq(households.id, session.householdId));
  });
  return c.json({ ok: true });
});

authRoutes.post('/password', async (c) => {
  const deps = c.get('deps');
  const now = c.get('now');
  const session = requireGuardianSession(c);
  const body = parse(
    v.object({ current: v.pipe(v.string(), v.maxLength(200)), next: password }),
    await readJson(c),
  );
  const database = c.get('database');
  const found = await asSystem(database, (tx) =>
    tx.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, session.userId)).limit(1),
  );
  if (!found[0] || !(await verifyPassword(body.current, found[0].passwordHash))) {
    throw forbidden('That is not your current password.');
  }
  const passwordHash = await hashPassword(body.next, deps.hashCost);
  const fresh = await asSystem(database, async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, session.userId));
    // Everywhere else is signed out; this phone gets a new session.
    await revokeUserSessions(tx, session.userId, session.householdId, now);
    await note(tx, session.householdId, 'guardian.password_changed', session.actor, now);
    return createGuardianSession(tx, { userId: session.userId, householdId: session.householdId }, now);
  });
  setSession(c, fresh.token, fresh.maxAgeMs);
  return c.json({ ok: true });
});

authRoutes.post('/recovery-codes', async (c) => {
  const session = requireGuardianSession(c);
  const body = parse(v.object({ password: v.pipe(v.string(), v.maxLength(200)) }), await readJson(c));
  const database = c.get('database');
  const found = await asSystem(database, (tx) =>
    tx.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, session.userId)).limit(1),
  );
  if (!found[0] || !(await verifyPassword(body.password, found[0].passwordHash)))
    throw forbidden('That is not your password.');
  const codes = await asSystem(database, (tx) => makeRecoveryCodes(tx, session.userId));
  return c.json({ recoveryCodes: codes });
});

/** Get back in with a recovery code written down at sign-up. Each works once. */
authRoutes.post('/recover', async (c) => {
  const deps = c.get('deps');
  const now = c.get('now');
  const database = c.get('database');
  const body = parse(
    v.object({ email, recoveryCode: v.pipe(v.string(), v.maxLength(40)), password }),
    await readJson(c),
  );
  const key = `recover:${codeFingerprint(body.email).slice(0, 24)}`;
  const limited = await asSystem(database, (tx) => attempt(tx, key, LIMITS.signIn, now));
  if (!limited.allowed) throw tooMany(limited.retryAfter);
  const passwordHash = await hashPassword(body.password, deps.hashCost);
  const session = await asSystem(database, async (tx) => {
    const found = await tx
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(sql`lower(${users.email}) = ${body.email}`)
      .limit(1);
    const user = found[0];
    if (!user) return null;
    const used = await tx
      .update(recoveryCodes)
      .set({ usedAt: now })
      .where(
        and(
          eq(recoveryCodes.userId, user.id),
          eq(recoveryCodes.codeHash, codeFingerprint(body.recoveryCode)),
          isNull(recoveryCodes.usedAt),
        ),
      )
      .returning({ id: recoveryCodes.id });
    if (!used[0]) return null;
    await tx.update(users).set({ passwordHash }).where(eq(users.id, user.id));
    const member = await tx
      .select({ householdId: memberships.householdId })
      .from(memberships)
      .where(eq(memberships.userId, user.id))
      .orderBy(asc(memberships.createdAt))
      .limit(1);
    if (!member[0]) return null;
    await revokeUserSessions(tx, user.id, member[0].householdId, now);
    await note(tx, member[0].householdId, 'guardian.recovered', `guardian:${user.displayName}`, now);
    return createGuardianSession(tx, { userId: user.id, householdId: member[0].householdId }, now);
  });
  if (!session)
    throw forbidden('That e-mail address and recovery code do not match, or the code has been used.');
  setSession(c, session.token, session.maxAgeMs);
  return c.json({ ok: true });
});

// --- the wall PIN -------------------------------------------------------------------------------------------------

authRoutes.post('/pin', async (c) => {
  const deps = c.get('deps');
  const session = requireGuardianSession(c);
  const body = parse(v.object({ pin: v.string() }), await readJson(c));
  if (!isValidPin(body.pin)) {
    throw badRequest('A PIN is four to eight digits, and not one everybody tries first (1234, 0000).', {
      field: 'pin',
    });
  }
  const pinHash = await hashPin(body.pin, deps.config.secretKey, deps.hashCost);
  await asSystem(c.get('database'), async (tx) => {
    await tx
      .update(memberships)
      .set({ pinHash })
      .where(and(eq(memberships.userId, session.userId), eq(memberships.householdId, session.householdId)));
    await tx
      .update(households)
      .set({ revision: sql`${households.revision} + 1` })
      .where(eq(households.id, session.householdId));
    await note(tx, session.householdId, 'guardian.pin_set', session.actor, c.get('now'));
  });
  return c.json({ ok: true });
});

authRoutes.delete('/pin', async (c) => {
  const session = requireGuardianSession(c);
  await asSystem(c.get('database'), async (tx) => {
    await tx
      .update(memberships)
      .set({ pinHash: null })
      .where(and(eq(memberships.userId, session.userId), eq(memberships.householdId, session.householdId)));
    await tx
      .update(households)
      .set({ revision: sql`${households.revision} + 1` })
      .where(eq(households.id, session.householdId));
  });
  return c.json({ ok: true });
});

// --- invitations and reset links -------------------------------------------------------------------------------------

function requireRole(c: C, need: 'guardian' | 'owner') {
  const session = requireGuardianSession(c);
  const level = session.role === 'owner' ? 'owner' : session.role === 'guardian' ? 'guardian' : 'caregiver';
  if (!hasAccess(level, need)) throw forbidden();
  return session;
}

authRoutes.get('/invites', async (c) => {
  const session = requireRole(c, 'guardian');
  const now = c.get('now');
  const rows = await asSystem(c.get('database'), (tx) =>
    tx
      .select({
        id: invites.id,
        kind: invites.kind,
        role: invites.role,
        expiresAt: invites.expiresAt,
        createdAt: invites.createdAt,
      })
      .from(invites)
      .where(
        and(
          eq(invites.householdId, session.householdId),
          isNull(invites.usedAt),
          isNull(invites.revokedAt),
          gt(invites.expiresAt, now),
        ),
      )
      .orderBy(asc(invites.createdAt)),
  );
  return c.json({
    invites: rows.map((row) => ({
      ...row,
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    })),
  });
});

authRoutes.post('/invites', async (c) => {
  const session = requireRole(c, 'guardian');
  const now = c.get('now');
  const body = parse(v.object({ role: v.picklist(['guardian', 'caregiver']) }), await readJson(c));
  const code = newCode(10);
  const expiresAt = new Date(now.getTime() + INVITE_HOURS * 3_600_000);
  const inviteId = crypto.randomUUID();
  await asSystem(c.get('database'), async (tx) => {
    await tx.insert(invites).values({
      id: inviteId,
      householdId: session.householdId,
      kind: 'join',
      codeHash: codeFingerprint(code),
      role: body.role,
      createdBy: session.userId,
      expiresAt,
      createdAt: now,
    });
    await note(tx, session.householdId, 'invite.created', session.actor, now, { role: body.role });
  });
  // Shown once. Only its hash is kept.
  return c.json(
    {
      id: inviteId,
      code: `${code.slice(0, 5)}-${code.slice(5)}`,
      role: body.role,
      expiresAt: expiresAt.toISOString(),
    },
    201,
  );
});

authRoutes.delete('/invites/:id', async (c) => {
  const session = requireRole(c, 'guardian');
  const inviteId = c.req.param('id');
  if (!isUuid(inviteId)) throw notFound();
  await asSystem(c.get('database'), (tx) =>
    tx
      .update(invites)
      .set({ revokedAt: c.get('now') })
      .where(and(eq(invites.id, inviteId), eq(invites.householdId, session.householdId))),
  );
  return c.json({ ok: true });
});

/** What an invitation is for, before anything is typed: "join the Maple Street household as a guardian". */
authRoutes.post('/invites/peek', async (c) => {
  const now = c.get('now');
  const database = c.get('database');
  const body = parse(v.object({ code: v.pipe(v.string(), v.maxLength(40)) }), await readJson(c));
  const limited = await asSystem(database, (tx) => attempt(tx, `code:${clientKey(c)}`, LIMITS.code, now));
  if (!limited.allowed) throw tooMany(limited.retryAfter);
  const rows = await asSystem(database, (tx) =>
    tx
      .select({ kind: invites.kind, role: invites.role, householdName: households.name })
      .from(invites)
      .innerJoin(households, eq(households.id, invites.householdId))
      .where(
        and(
          eq(invites.codeHash, codeFingerprint(body.code)),
          isNull(invites.usedAt),
          isNull(invites.revokedAt),
          gt(invites.expiresAt, now),
        ),
      )
      .limit(1),
  );
  if (!rows[0]) throw notFound('That code is not valid, or it has run out. Ask for a new one.');
  return c.json(rows[0]);
});

authRoutes.post('/join', async (c) => {
  const deps = c.get('deps');
  const now = c.get('now');
  const database = c.get('database');
  const body = parse(
    v.object({ code: v.pipe(v.string(), v.maxLength(40)), email, password, displayName: name(30), avatar }),
    await readJson(c),
  );
  const limited = await asSystem(database, (tx) => attempt(tx, `code:${clientKey(c)}`, LIMITS.code, now));
  if (!limited.allowed) throw tooMany(limited.retryAfter);
  const passwordHash = await hashPassword(body.password, deps.hashCost);

  const existing = await asSystem(database, (tx) =>
    tx
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(sql`lower(${users.email}) = ${body.email}`)
      .limit(1),
  );
  if (existing[0] && !(await verifyPassword(body.password, existing[0].passwordHash))) {
    throw conflict('There is already an account with that e-mail address. Use its password to join with it.');
  }

  const session = await asSystem(database, async (tx) => {
    // Taking the invitation and using it are one step: it cannot be used twice, even by two phones at once.
    const taken = await tx
      .update(invites)
      .set({ usedAt: now })
      .where(
        and(
          eq(invites.codeHash, codeFingerprint(body.code)),
          eq(invites.kind, 'join'),
          isNull(invites.usedAt),
          isNull(invites.revokedAt),
          gt(invites.expiresAt, now),
        ),
      )
      .returning({ householdId: invites.householdId, role: invites.role });
    const invite = taken[0];
    if (!invite) return null;
    let userId = existing[0]?.id;
    if (!userId) {
      userId = crypto.randomUUID();
      await tx.insert(users).values({
        id: userId,
        email: body.email,
        displayName: body.displayName,
        avatar: body.avatar,
        passwordHash,
        createdAt: now,
      });
      await makeRecoveryCodes(tx, userId);
    }
    await tx
      .insert(memberships)
      .values({
        id: crypto.randomUUID(),
        householdId: invite.householdId,
        userId,
        role: invite.role as GuardianRole,
        createdAt: now,
      })
      .onConflictDoNothing();
    await tx
      .update(households)
      .set({ revision: sql`${households.revision} + 1` })
      .where(eq(households.id, invite.householdId));
    await note(tx, invite.householdId, 'member.joined', `guardian:${body.displayName}`, now, {
      role: invite.role,
    });
    return createGuardianSession(tx, { userId, householdId: invite.householdId }, now);
  });
  if (!session) throw notFound('That code is not valid, or it has run out. Ask for a new one.');
  setSession(c, session.token, session.maxAgeMs);
  return c.json({ ok: true }, 201);
});

/** The owner makes a one-use link for another grown-up of the household who has forgotten their password. */
authRoutes.post('/reset-link', async (c) => {
  const session = requireRole(c, 'owner');
  const now = c.get('now');
  const body = parse(
    v.object({
      userId: v.pipe(
        v.string(),
        v.check((value: string) => isUuid(value), 'an id'),
      ),
    }),
    await readJson(c),
  );
  const code = newCode(10);
  const expiresAt = new Date(now.getTime() + RESET_HOURS * 3_600_000);
  const made = await asSystem(c.get('database'), async (tx) => {
    const member = await tx
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(and(eq(memberships.householdId, session.householdId), eq(memberships.userId, body.userId)))
      .limit(1);
    if (!member[0]) return false;
    await tx.insert(invites).values({
      id: crypto.randomUUID(),
      householdId: session.householdId,
      kind: 'reset',
      codeHash: codeFingerprint(code),
      userId: body.userId,
      createdBy: session.userId,
      expiresAt,
      createdAt: now,
    });
    await note(tx, session.householdId, 'reset.created', session.actor, now, { userId: body.userId });
    return true;
  });
  if (!made) throw notFound('That grown-up is not in this household.');
  return c.json({ code: `${code.slice(0, 5)}-${code.slice(5)}`, expiresAt: expiresAt.toISOString() }, 201);
});

authRoutes.post('/reset', async (c) => {
  const deps = c.get('deps');
  const now = c.get('now');
  const database = c.get('database');
  const body = parse(v.object({ code: v.pipe(v.string(), v.maxLength(40)), password }), await readJson(c));
  const limited = await asSystem(database, (tx) => attempt(tx, `code:${clientKey(c)}`, LIMITS.code, now));
  if (!limited.allowed) throw tooMany(limited.retryAfter);
  const passwordHash = await hashPassword(body.password, deps.hashCost);
  const done = await asSystem(database, async (tx) => {
    const taken = await tx
      .update(invites)
      .set({ usedAt: now })
      .where(
        and(
          eq(invites.codeHash, codeFingerprint(body.code)),
          eq(invites.kind, 'reset'),
          isNull(invites.usedAt),
          isNull(invites.revokedAt),
          gt(invites.expiresAt, now),
        ),
      )
      .returning({ householdId: invites.householdId, userId: invites.userId });
    const reset = taken[0];
    if (!reset?.userId) return false;
    await tx.update(users).set({ passwordHash }).where(eq(users.id, reset.userId));
    await revokeUserSessions(tx, reset.userId, reset.householdId, now);
    await note(tx, reset.householdId, 'guardian.password_reset', 'reset-link', now, { userId: reset.userId });
    return true;
  });
  if (!done) throw notFound('That code is not valid, or it has run out. Ask for a new one.');
  return c.json({ ok: true });
});

/** Leave this household of one's own accord. The owner cannot: a household always has its owner. */
authRoutes.post('/leave', async (c) => {
  const session = requireGuardianSession(c);
  if (session.role === 'owner')
    throw new HttpError('conflict', 'The owner cannot leave. Delete the household instead, in Settings.');
  await asSystem(c.get('database'), async (tx) => {
    await tx
      .delete(memberships)
      .where(and(eq(memberships.userId, session.userId), eq(memberships.householdId, session.householdId)));
    await revokeUserSessions(tx, session.userId, session.householdId, c.get('now'));
    await tx
      .update(households)
      .set({ revision: sql`${households.revision} + 1` })
      .where(eq(households.id, session.householdId));
    await note(tx, session.householdId, 'member.left', session.actor, c.get('now'));
  });
  c.header('Set-Cookie', clearedCookie(c.get('secure')));
  return c.json({ ok: true });
});

export { formatCode, requireSession };
