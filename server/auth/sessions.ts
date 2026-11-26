import { and, eq, isNull, sql } from 'drizzle-orm';
import type { AccessLevel, GuardianRole, Viewer } from '../../shared/model.js';
import { devices, households, memberships, sessions, users } from '../db/schema.js';
import type { Executor } from '../db/types.js';
import { fingerprint, newToken } from './crypto.js';

/**
 * Signed-in browsers. A session is a long random token in a cookie that scripts cannot read; the database keeps
 * only its hash. There are two kinds: a grown-up on their own phone, and a screen on the wall that a grown-up
 * paired. A wall can be unlocked for a few minutes by a grown-up's PIN, and locks itself again.
 */

const DAY = 24 * 60 * 60 * 1000;
/** A grown-up's phone stays signed in for a month after it was last used. */
export const GUARDIAN_SESSION_MS = 30 * DAY;
/** The wall stays paired for a year after it was last used — until somebody unpairs it. */
export const DEVICE_SESSION_MS = 365 * DAY;
/** However busy a grown-up is at the wall, it locks again after this long. */
export const UNLOCK_MAX_MS = 15 * 60 * 1000;

export interface Session {
  id: string;
  kind: 'guardian' | 'device';
  householdId: string;
  userId: string | null;
  deviceId: string | null;
  /** The grown-up signed in, or the one who unlocked the wall; and their role. */
  actingUserId: string | null;
  role: GuardianRole | null;
  unlockedUntil: Date | null;
  expiresAt: Date;
  lastSeenAt: Date;
  /** A short name for the record: who did this. Never an e-mail address. */
  actor: string;
}

export function cookieName(secure: boolean): string {
  // The __Host- prefix makes the browser refuse the cookie unless it is Secure, for this host only, on path /.
  return secure ? '__Host-hb' : 'hb';
}

export function sessionCookie(token: string, maxAgeMs: number, secure: boolean): string {
  const parts = [
    `${cookieName(secure)}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearedCookie(secure: boolean): string {
  const parts = [`${cookieName(secure)}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function readCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) return part.slice(index + 1).trim() || null;
  }
  return null;
}

export async function createGuardianSession(
  db: Executor,
  input: { userId: string; householdId: string },
  now: Date,
): Promise<{ token: string; maxAgeMs: number }> {
  const token = newToken();
  await db.insert(sessions).values({
    id: crypto.randomUUID(),
    tokenHash: fingerprint(token),
    kind: 'guardian',
    householdId: input.householdId,
    userId: input.userId,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + GUARDIAN_SESSION_MS),
  });
  return { token, maxAgeMs: GUARDIAN_SESSION_MS };
}

export async function createDeviceSession(
  db: Executor,
  input: { deviceId: string; householdId: string },
  now: Date,
): Promise<{ token: string; maxAgeMs: number }> {
  const token = newToken();
  await db.insert(sessions).values({
    id: crypto.randomUUID(),
    tokenHash: fingerprint(token),
    kind: 'device',
    householdId: input.householdId,
    deviceId: input.deviceId,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + DEVICE_SESSION_MS),
  });
  return { token, maxAgeMs: DEVICE_SESSION_MS };
}

/**
 * Who is this? Returns nothing for a token that is unknown, expired or revoked, for a grown-up who is no longer
 * a member, and for a screen that has been unpaired. Must be called as the system: it reads the sessions table.
 */
/**
 * Has this server ever given out this token? A session that was signed out, switched off or has run out is
 * still known; a token from a server that has since been replaced (the demo with no database lives in memory)
 * is not. The demo uses the difference to tell "you were signed out" from "I am a fresh server".
 */
export async function knowsToken(db: Executor, token: string): Promise<boolean> {
  if (token.length < 20 || token.length > 100) return false;
  const rows = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.tokenHash, fingerprint(token)))
    .limit(1);
  return rows.length > 0;
}

export async function findSession(db: Executor, token: string, now: Date): Promise<Session | null> {
  if (token.length < 20 || token.length > 100) return null;
  const rows = await db
    .select({
      id: sessions.id,
      kind: sessions.kind,
      householdId: sessions.householdId,
      userId: sessions.userId,
      deviceId: sessions.deviceId,
      unlockedBy: sessions.unlockedBy,
      unlockedUntil: sessions.unlockedUntil,
      expiresAt: sessions.expiresAt,
      lastSeenAt: sessions.lastSeenAt,
      revokedAt: sessions.revokedAt,
    })
    .from(sessions)
    .where(eq(sessions.tokenHash, fingerprint(token)))
    .limit(1);
  const row = rows[0];
  if (!row || row.revokedAt || row.expiresAt.getTime() <= now.getTime()) return null;

  if (row.kind === 'guardian') {
    if (!row.userId) return null;
    const member = await memberOf(db, row.householdId, row.userId);
    if (!member) return null;
    return {
      id: row.id,
      kind: 'guardian',
      householdId: row.householdId,
      userId: row.userId,
      deviceId: null,
      actingUserId: row.userId,
      role: member.role,
      unlockedUntil: null,
      expiresAt: row.expiresAt,
      lastSeenAt: row.lastSeenAt,
      actor: `guardian:${member.displayName}`,
    };
  }

  if (!row.deviceId) return null;
  const found = await db
    .select({ name: devices.name, revokedAt: devices.revokedAt })
    .from(devices)
    .where(and(eq(devices.id, row.deviceId), eq(devices.householdId, row.householdId)))
    .limit(1);
  const device = found[0];
  if (!device || device.revokedAt) return null;

  let actingUserId: string | null = null;
  let role: GuardianRole | null = null;
  let unlockedUntil: Date | null = null;
  let actor = `wall:${device.name}`;
  if (row.unlockedBy && row.unlockedUntil && row.unlockedUntil.getTime() > now.getTime()) {
    const member = await memberOf(db, row.householdId, row.unlockedBy);
    if (member) {
      actingUserId = row.unlockedBy;
      role = member.role;
      unlockedUntil = row.unlockedUntil;
      actor = `guardian:${member.displayName} (at ${device.name})`;
    }
  }
  return {
    id: row.id,
    kind: 'device',
    householdId: row.householdId,
    userId: null,
    deviceId: row.deviceId,
    actingUserId,
    role,
    unlockedUntil,
    expiresAt: row.expiresAt,
    lastSeenAt: row.lastSeenAt,
    actor,
  };
}

async function memberOf(
  db: Executor,
  householdId: string,
  userId: string,
): Promise<{ role: GuardianRole; displayName: string } | null> {
  const rows = await db
    .select({ role: memberships.role, displayName: users.displayName, disabledAt: users.disabledAt })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.householdId, householdId), eq(memberships.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row || row.disabledAt) return null;
  return { role: row.role as GuardianRole, displayName: row.displayName };
}

/**
 * Note that a session was used, at most once an hour, and push its end further away. Returns the new lifetime
 * when the cookie should be sent again.
 */
export async function touchSession(db: Executor, session: Session, now: Date): Promise<number | null> {
  if (now.getTime() - session.lastSeenAt.getTime() < 60 * 60 * 1000) return null;
  const lifetime = session.kind === 'guardian' ? GUARDIAN_SESSION_MS : DEVICE_SESSION_MS;
  await db
    .update(sessions)
    .set({ lastSeenAt: now, expiresAt: new Date(now.getTime() + lifetime) })
    .where(eq(sessions.id, session.id));
  if (session.deviceId)
    await db.update(devices).set({ lastSeenAt: now }).where(eq(devices.id, session.deviceId));
  return lifetime;
}

export async function revokeSession(db: Executor, sessionId: string, now: Date): Promise<void> {
  await db.update(sessions).set({ revokedAt: now }).where(eq(sessions.id, sessionId));
}

/** Unpairing a screen ends every session it has. */
export async function revokeDeviceSessions(db: Executor, deviceId: string, now: Date): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: now })
    .where(and(eq(sessions.deviceId, deviceId), isNull(sessions.revokedAt)));
}

export async function revokeUserSessions(
  db: Executor,
  userId: string,
  householdId: string,
  now: Date,
): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: now })
    .where(
      and(eq(sessions.userId, userId), eq(sessions.householdId, householdId), isNull(sessions.revokedAt)),
    );
  // …and lock any wall that grown-up had unlocked.
  await db
    .update(sessions)
    .set({ unlockedBy: null, unlockedUntil: null, unlockedAt: null })
    .where(and(eq(sessions.unlockedBy, userId), eq(sessions.householdId, householdId)));
}

export async function unlockWall(
  db: Executor,
  sessionId: string,
  userId: string,
  relockSeconds: number,
  now: Date,
): Promise<Date> {
  const until = new Date(now.getTime() + relockSeconds * 1000);
  await db
    .update(sessions)
    .set({ unlockedBy: userId, unlockedAt: now, unlockedUntil: until })
    .where(eq(sessions.id, sessionId));
  return until;
}

/** A grown-up doing something at the wall keeps it open a little longer, up to the hard limit. */
export async function extendUnlock(
  db: Executor,
  sessionId: string,
  relockSeconds: number,
  now: Date,
): Promise<void> {
  await db.execute(sql`
    update "homebase"."sessions"
    set "unlocked_until" = least(
      ${new Date(now.getTime() + relockSeconds * 1000).toISOString()}::timestamptz,
      "unlocked_at" + make_interval(secs => ${UNLOCK_MAX_MS / 1000})
    )
    where "id" = ${sessionId} and "unlocked_by" is not null and "unlocked_until" > ${now.toISOString()}::timestamptz`);
}

export async function lockWall(db: Executor, sessionId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ unlockedBy: null, unlockedUntil: null, unlockedAt: null })
    .where(eq(sessions.id, sessionId));
}

/** What this session may do. A wall acts as the grown-up who unlocked it, and otherwise as a child. */
export function accessOf(session: Session, holdGate: boolean): AccessLevel {
  if (session.role === 'owner') return 'owner';
  if (session.role === 'guardian') return 'guardian';
  if (session.role === 'caregiver') return 'caregiver';
  return holdGate ? 'household' : 'child';
}

export function viewerOf(session: Session, holdGate: boolean): Viewer {
  return {
    kind: session.kind,
    access: accessOf(session, holdGate),
    userId: session.actingUserId,
    deviceId: session.deviceId,
    unlockedUntil: session.unlockedUntil ? session.unlockedUntil.toISOString() : null,
  };
}

export async function householdExists(db: Executor, householdId: string): Promise<boolean> {
  const rows = await db
    .select({ id: households.id })
    .from(households)
    .where(eq(households.id, householdId))
    .limit(1);
  return rows.length > 0;
}
