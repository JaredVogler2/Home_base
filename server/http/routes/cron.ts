import { Hono } from 'hono';
import { safeEqual } from '../../auth/crypto.js';
import { asSystem, inHousehold } from '../../db/client.js';
import { households } from '../../db/schema.js';
import { bumpRevision, lockHousehold, makeCtx } from '../../domain/context.js';
import { keepHouse } from '../../domain/housekeeping.js';
import type { AppEnv } from '../env.js';
import { unauthenticated } from '../errors.js';
import { sweepSystem } from './sync.js';

/**
 * The once-a-day nudge, for a host that offers one (Vercel's free plan runs it once a day).
 *
 * HOMEBASE does not depend on it: each household's daily chores are done the first time any of its screens
 * asks for news on a new day. This only means the morning's missions are already there when the first screen
 * wakes, and that old codes and sessions are swept even in a week when nobody opened anything. It answers only
 * to the host's own secret, and it says nothing about any family.
 */

export const cronRoutes = new Hono<AppEnv>();

cronRoutes.all('/daily', async (c) => {
  const deps = c.get('deps');
  const secret = deps.config.cronSecret;
  const given = c.req.header('authorization') ?? '';
  if (!secret || !safeEqual(given, `Bearer ${secret}`)) throw unauthenticated('Not for you.');

  const database = c.get('database');
  const now = c.get('now');
  const rows = await asSystem(database, (tx) =>
    tx.select({ id: households.id }).from(households).limit(1000),
  );
  let kept = 0;
  for (const row of rows) {
    try {
      const did = await inHousehold(database, row.id, async (tx) => {
        const household = await lockHousehold(tx, row.id);
        if (!household) return false;
        const ctx = makeCtx(
          tx,
          household,
          { level: 'owner', name: 'auto', userId: null, deviceId: null },
          now,
          {
            academyHosts: deps.config.academyHosts,
          },
        );
        if (!(await keepHouse(ctx))) return false;
        await bumpRevision(ctx);
        return true;
      });
      if (did) kept += 1;
    } catch (error) {
      // One household's trouble must not stop the others' mornings.
      console.error('[cron] a household could not be kept:', error instanceof Error ? error.message : error);
    }
  }
  await sweepSystem(c);
  return c.json({ ok: true, households: rows.length, kept });
});
