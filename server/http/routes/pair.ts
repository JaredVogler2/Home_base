import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import * as v from 'valibot';
import { isUuid } from '../../../shared/ids.js';
import { readSettings } from '../../../shared/settings.js';
import { codeFingerprint, fingerprint, formatCode, newCode, newToken, verifyPin } from '../../auth/crypto.js';
import { attempt, check, forgive, LIMITS } from '../../auth/rate-limit.js';
import {
  clearedCookie,
  createDeviceSession,
  lockWall,
  revokeSession,
  sessionCookie,
  unlockWall,
} from '../../auth/sessions.js';
import { asSystem } from '../../db/client.js';
import { audit, devices, households, memberships, pairCodes, users } from '../../db/schema.js';
import { clientKey, readJson, requireGuardianSession, requireSession, type AppEnv } from '../env.js';
import { badRequest, forbidden, notFound, tooMany } from '../errors.js';

/**
 * Putting a screen on the wall, and letting a grown-up into its locked part.
 *
 * Pairing. A new screen knows nothing and may do nothing. It asks for a code and shows it (as letters and as a
 * QR). A grown-up who is signed in on their own phone types or scans the code and names the screen. Only then
 * does the screen — proving it is the one that showed the code — collect its own session. The code works once
 * and for ten minutes; the screen never sees a password, and the phone never sees the screen's session.
 *
 * Unlocking. The wall's grown-ups' area opens with a grown-up's own PIN, for a few minutes, and the server —
 * not the screen — decides when it shuts again. Five wrong PINs for one grown-up on one wall in a quarter of an
 * hour, and that door stays shut until the quarter hour is up.
 */

const PAIR_MINUTES = 10;

export const pairRoutes = new Hono<AppEnv>();

pairRoutes.post('/start', async (c) => {
  const now = c.get('now');
  const database = c.get('database');
  const limited = await asSystem(database, (tx) =>
    attempt(tx, `pair-start:${clientKey(c)}`, LIMITS.pairStart, now),
  );
  if (!limited.allowed) throw tooMany(limited.retryAfter);
  const code = newCode(8);
  const secret = newToken();
  const expiresAt = new Date(now.getTime() + PAIR_MINUTES * 60_000);
  await asSystem(database, (tx) =>
    tx.insert(pairCodes).values({
      id: crypto.randomUUID(),
      codeHash: codeFingerprint(code),
      secretHash: fingerprint(secret),
      expiresAt,
      createdAt: now,
    }),
  );
  return c.json({ code: formatCode(code), secret, expiresAt: expiresAt.toISOString() }, 201);
});

/** A signed-in grown-up says "that screen is ours". */
pairRoutes.post('/claim', async (c) => {
  const session = requireGuardianSession(c);
  if (session.role !== 'owner' && session.role !== 'guardian') throw forbidden();
  const now = c.get('now');
  const database = c.get('database');
  const parsed = v.safeParse(
    v.object({
      code: v.pipe(v.string(), v.maxLength(20)),
      name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(40)),
      kind: v.optional(v.picklist(['wall', 'tablet']), 'wall'),
    }),
    await readJson(c),
  );
  if (!parsed.success) throw badRequest('Give the screen a name and type its code.');
  const limited = await asSystem(database, (tx) => attempt(tx, `code:${clientKey(c)}`, LIMITS.code, now));
  if (!limited.allowed) throw tooMany(limited.retryAfter);
  const claimed = await asSystem(database, async (tx) => {
    const rows = await tx
      .update(pairCodes)
      .set({
        claimedBy: session.userId,
        claimedHousehold: session.householdId,
        deviceName: parsed.output.name,
        kind: parsed.output.kind,
        claimedAt: now,
      })
      .where(
        and(
          eq(pairCodes.codeHash, codeFingerprint(parsed.output.code)),
          isNull(pairCodes.claimedAt),
          gt(pairCodes.expiresAt, now),
        ),
      )
      .returning({ id: pairCodes.id });
    return rows.length > 0;
  });
  if (!claimed)
    throw notFound(
      'That code is not on any screen right now. Codes last ten minutes — check the screen for a new one.',
    );
  return c.json({ ok: true });
});

/** The screen asks: "has anyone claimed me yet?" When someone has, it is given its session — once. */
pairRoutes.post('/collect', async (c) => {
  const now = c.get('now');
  const database = c.get('database');
  const parsed = v.safeParse(
    v.object({
      code: v.pipe(v.string(), v.maxLength(20)),
      secret: v.pipe(v.string(), v.minLength(20), v.maxLength(100)),
    }),
    await readJson(c),
  );
  if (!parsed.success) throw badRequest('Not a pairing request.');
  const { code, secret } = parsed.output;

  const result = await asSystem(database, async (tx) => {
    const rows = await tx
      .select()
      .from(pairCodes)
      .where(
        and(eq(pairCodes.codeHash, codeFingerprint(code)), eq(pairCodes.secretHash, fingerprint(secret))),
      )
      .limit(1)
      .for('update');
    const pair = rows[0];
    if (!pair) return { status: 'unknown' as const };
    if (pair.collectedAt) return { status: 'used' as const };
    if (pair.expiresAt.getTime() <= now.getTime()) return { status: 'expired' as const };
    if (!pair.claimedAt || !pair.claimedHousehold || !pair.claimedBy) return { status: 'waiting' as const };
    const deviceId = crypto.randomUUID();
    await tx.insert(devices).values({
      id: deviceId,
      householdId: pair.claimedHousehold,
      name: pair.deviceName ?? 'Wall',
      kind: pair.kind,
      createdBy: pair.claimedBy,
      createdAt: now,
      lastSeenAt: now,
    });
    await tx.update(pairCodes).set({ collectedAt: now }).where(eq(pairCodes.id, pair.id));
    // The grown-ups' phones should see the new screen in their list.
    await tx
      .update(households)
      .set({ revision: sql`${households.revision} + 1` })
      .where(eq(households.id, pair.claimedHousehold));
    await tx.insert(audit).values({
      id: crypto.randomUUID(),
      householdId: pair.claimedHousehold,
      at: now,
      action: 'device.paired',
      actor: `guardian:${pair.claimedBy}`,
      detail: { deviceId, name: pair.deviceName },
    });
    const session = await createDeviceSession(tx, { deviceId, householdId: pair.claimedHousehold }, now);
    return { status: 'paired' as const, session };
  });

  if (result.status === 'unknown') {
    const limited = await asSystem(database, (tx) => attempt(tx, `code:${clientKey(c)}`, LIMITS.code, now));
    if (!limited.allowed) throw tooMany(limited.retryAfter);
    throw notFound('That pairing has run out. Start again.');
  }
  if (result.status === 'paired') {
    c.header('Set-Cookie', sessionCookie(result.session.token, result.session.maxAgeMs, c.get('secure')));
  }
  return c.json({ status: result.status });
});

/** A screen unpairs itself (from its own grown-ups' area). */
pairRoutes.post('/forget', async (c) => {
  const session = requireSession(c);
  if (session.kind !== 'device' || !session.deviceId) throw forbidden();
  if (!session.actingUserId) throw forbidden('A grown-up needs to unlock the wall first.');
  const now = c.get('now');
  await asSystem(c.get('database'), async (tx) => {
    await tx
      .update(devices)
      .set({ revokedAt: now })
      .where(eq(devices.id, session.deviceId as string));
    await revokeSession(tx, session.id, now);
    await tx.insert(audit).values({
      id: crypto.randomUUID(),
      householdId: session.householdId,
      at: now,
      action: 'device.revoked',
      actor: session.actor,
      detail: { deviceId: session.deviceId, by: 'the screen itself' },
    });
  });
  c.header('Set-Cookie', clearedCookie(c.get('secure')));
  return c.json({ ok: true });
});

export const wallRoutes = new Hono<AppEnv>();

wallRoutes.post('/unlock', async (c) => {
  const deps = c.get('deps');
  const now = c.get('now');
  const database = c.get('database');
  const session = requireSession(c);
  if (session.kind !== 'device' || !session.deviceId)
    throw forbidden('Only a wall screen is unlocked with a PIN.');
  const parsed = v.safeParse(
    v.object({
      userId: v.pipe(
        v.string(),
        v.check((value: string) => isUuid(value), 'an id'),
      ),
      pin: v.pipe(v.string(), v.maxLength(12)),
    }),
    await readJson(c),
  );
  if (!parsed.success) throw badRequest('Choose a grown-up and enter their PIN.');
  const { userId, pin } = parsed.output;
  const key = `pin:${session.deviceId}:${userId}`;

  const gate = await asSystem(database, (tx) => check(tx, key, LIMITS.pin, now));
  if (!gate.allowed) throw tooMany(gate.retryAfter);

  const member = await asSystem(database, (tx) =>
    tx
      .select({
        pinHash: memberships.pinHash,
        role: memberships.role,
        displayName: users.displayName,
        settings: households.settings,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .innerJoin(households, eq(households.id, memberships.householdId))
      .where(and(eq(memberships.householdId, session.householdId), eq(memberships.userId, userId)))
      .limit(1),
  );
  const row = member[0];
  const ok = row?.pinHash ? await verifyPin(pin, row.pinHash, deps.config.secretKey) : false;
  if (!row || !ok) {
    const counted = await asSystem(database, async (tx) => {
      const state = await attempt(tx, key, LIMITS.pin, now);
      if (!state.allowed || state.remaining === 0) {
        await tx.insert(audit).values({
          id: crypto.randomUUID(),
          householdId: session.householdId,
          at: now,
          action: 'wall.pin_locked_out',
          actor: session.actor,
          detail: { deviceId: session.deviceId },
        });
      }
      return state;
    });
    if (!counted.allowed) throw tooMany(counted.retryAfter);
    throw forbidden(
      row && !row.pinHash
        ? 'That grown-up has not set a wall PIN yet. Set one on your phone, in Settings.'
        : 'That PIN is not right.',
    );
  }

  const relock = readSettings(row.settings).wall.relockSeconds;
  const until = await asSystem(database, async (tx) => {
    await forgive(tx, key);
    await tx.insert(audit).values({
      id: crypto.randomUUID(),
      householdId: session.householdId,
      at: now,
      action: 'wall.unlocked',
      actor: `guardian:${row.displayName}`,
      detail: { deviceId: session.deviceId },
    });
    return unlockWall(tx, session.id, userId, relock, now);
  });
  return c.json({ ok: true, unlockedUntil: until.toISOString(), role: row.role });
});

wallRoutes.post('/lock', async (c) => {
  const session = requireSession(c);
  if (session.kind === 'device') await asSystem(c.get('database'), (tx) => lockWall(tx, session.id));
  return c.json({ ok: true });
});
