import { and, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { DEFAULT_ACADEMY_HOSTS } from '../../../shared/settings.js';
import { createDeviceSession, createGuardianSession, sessionCookie } from '../../auth/sessions.js';
import { asSystem } from '../../db/client.js';
import { devices, households } from '../../db/schema.js';
import { DEMO, removeDemo, seedDemo } from '../../domain/seed.js';
import { readJson, requireSession, type AppEnv } from '../env.js';
import { badRequest, forbidden, notFound } from '../errors.js';
import { sql } from 'drizzle-orm';

/**
 * The demo's front door. It exists only where the deployment has been told it is a demo; everywhere else these
 * addresses answer "nothing here". It can only ever open the made-up Maple Street household — the id is fixed
 * in the code, so no setting or request can point it at a real family.
 */

export const demoRoutes = new Hono<AppEnv>();

demoRoutes.use('*', async (c, next) => {
  if (!c.get('deps').config.demo) throw notFound('There is nothing at that address.');
  return next();
});

export function demoAcademyUrl(): string {
  return `https://${DEFAULT_ACADEMY_HOSTS[0]}/`;
}

demoRoutes.post('/enter', async (c) => {
  const deps = c.get('deps');
  const now = c.get('now');
  const database = c.get('database');
  const body = (await readJson(c)) as { as?: unknown };
  const as = body.as;
  if (as !== 'guardian' && as !== 'caregiver' && as !== 'wall')
    throw badRequest('Enter the demo as a guardian, a caregiver or the wall.');
  await seedDemo(database, {
    now,
    hashCost: deps.hashCost,
    secretKey: deps.config.secretKey,
    academyUrl: demoAcademyUrl(),
  });

  const session = await asSystem(database, async (tx) => {
    if (as === 'wall') {
      const existing = await tx
        .select({ id: devices.id })
        .from(devices)
        .where(
          and(
            eq(devices.householdId, DEMO.householdId),
            eq(devices.name, 'Kitchen wall'),
            isNull(devices.revokedAt),
          ),
        )
        .limit(1);
      let deviceId = existing[0]?.id;
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        await tx.insert(devices).values({
          id: deviceId,
          householdId: DEMO.householdId,
          name: 'Kitchen wall',
          kind: 'wall',
          createdBy: DEMO.sam,
          createdAt: now,
          lastSeenAt: now,
        });
        await tx
          .update(households)
          .set({ revision: sql`${households.revision} + 1` })
          .where(eq(households.id, DEMO.householdId));
      }
      return createDeviceSession(tx, { deviceId, householdId: DEMO.householdId }, now);
    }
    return createGuardianSession(
      tx,
      { userId: as === 'guardian' ? DEMO.sam : DEMO.jo, householdId: DEMO.householdId },
      now,
    );
  });
  c.header('Set-Cookie', sessionCookie(session.token, session.maxAgeMs, c.get('secure')));
  return c.json({ ok: true, as });
});

/** Put the demo back to how it began. Only from inside the demo household, and only a grown-up. */
demoRoutes.post('/reset', async (c) => {
  const deps = c.get('deps');
  const session = requireSession(c);
  if (session.householdId !== DEMO.householdId || !session.role || session.role === 'caregiver')
    throw forbidden();
  const database = c.get('database');
  await removeDemo(database);
  await seedDemo(database, {
    now: c.get('now'),
    hashCost: deps.hashCost,
    secretKey: deps.config.secretKey,
    academyUrl: demoAcademyUrl(),
  });
  return c.json({ ok: true });
});
