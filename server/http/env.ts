import { createHash } from 'node:crypto';
import type { Context } from 'hono';
import { hasAccess, type AccessLevel } from '../../shared/model.js';
import { accessOf, type Session } from '../auth/sessions.js';
import { inHousehold, type Database } from '../db/client.js';
import type { Tx } from '../db/types.js';
import { lockHousehold, makeCtx, readHousehold, type Actor, type Ctx } from '../domain/context.js';
import type { Deps } from '../deps.js';
import { forbidden, HttpError, unauthenticated } from './errors.js';

/** What every request handler can reach. */
export interface AppEnv {
  Variables: {
    deps: Deps;
    database: Database;
    now: Date;
    session: Session | null;
    /** Whether the request arrived over https (decides the cookie's name and its Secure flag). */
    secure: boolean;
  };
}

export type C = Context<AppEnv>;

export function requireSession(c: C): Session {
  const session = c.get('session');
  if (!session) throw unauthenticated();
  return session;
}

export function requireGuardianSession(c: C): Session & { userId: string } {
  const session = requireSession(c);
  if (session.kind !== 'guardian' || !session.userId)
    throw forbidden('Sign in on your own phone to do that.');
  return session as Session & { userId: string };
}

export function actorOf(session: Session, level: AccessLevel): Actor {
  return { level, name: session.actor, userId: session.actingUserId, deviceId: session.deviceId };
}

/**
 * Run household work for the signed-in session, having checked that the session may do it. `lock` holds the
 * household for the length of the work: use it for anything that changes something.
 */
export async function withHousehold<T>(
  c: C,
  need: AccessLevel,
  work: (ctx: Ctx) => Promise<T>,
  options: { lock?: boolean } = {},
): Promise<T> {
  const session = requireSession(c);
  const database = c.get('database');
  const deps = c.get('deps');
  return inHousehold(database, session.householdId, async (tx: Tx) => {
    const household = options.lock
      ? await lockHousehold(tx, session.householdId)
      : await readHousehold(tx, session.householdId);
    if (!household) throw unauthenticated('That household is not here any more.');
    const level = accessOf(session, household.settings.wall.holdGate);
    if (!hasAccess(level, need)) throw forbidden();
    return work(
      makeCtx(tx, household, actorOf(session, level), c.get('now'), {
        academyHosts: deps.config.academyHosts,
      }),
    );
  });
}

/** Where a request came from, as a short hash: enough to count attempts by, and not an address in a table. */
export function clientKey(c: C): string {
  const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  const address = forwarded || c.req.header('x-real-ip') || 'local';
  return createHash('sha256').update(`addr:${address}`).digest('hex').slice(0, 20);
}

/** Read a JSON body of a sensible size, or say plainly that it was not one. */
export async function readJson(c: C, maxBytes = 256 * 1024): Promise<unknown> {
  const type = c.req.header('content-type') ?? '';
  if (!type.toLowerCase().startsWith('application/json')) {
    throw new HttpError('bad_request', 'Send JSON (Content-Type: application/json).');
  }
  const length = Number(c.req.header('content-length') ?? '0');
  if (length > maxBytes) throw new HttpError('payload_too_large', 'That is too much to send at once.');
  const text = await c.req.text();
  if (text.length > maxBytes) throw new HttpError('payload_too_large', 'That is too much to send at once.');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError('bad_request', 'That was not valid JSON.');
  }
}
