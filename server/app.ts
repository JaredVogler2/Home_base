import { Hono } from 'hono';
import { cookieName, findSession, readCookie, sessionCookie, touchSession } from './auth/sessions.js';
import { asSystem } from './db/client.js';
import { LATEST_MIGRATION } from './db/migrate.js';
import type { Deps } from './deps.js';
import type { AppEnv } from './http/env.js';
import { HttpError } from './http/errors.js';
import { authRoutes } from './http/routes/auth.js';
import { demoRoutes } from './http/routes/demo.js';
import { pairRoutes, wallRoutes } from './http/routes/pair.js';
import { syncRoutes } from './http/routes/sync.js';

/**
 * The API, as one function from a request to a response. It runs the same way inside Vite on a laptop, behind
 * a plain Node server, in a test (which calls it directly, with no network at all) and as a Vercel function.
 */

export const API_VERSION = 1;

/** Requests that change something must come from our own pages, not from somewhere else on the web. */
function sameOrigin(request: Request, forwardedProto: string | undefined): boolean {
  const origin = request.headers.get('origin');
  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host;
  const proto = forwardedProto ?? url.protocol.replace(':', '');
  if (origin) return origin === `${proto}://${host}`;
  // No Origin header: a browser sends one with every cross-site request that could do harm. Fall back to the
  // browser's own verdict where it gives one.
  const site = request.headers.get('sec-fetch-site');
  return site === null || site === 'same-origin' || site === 'none';
}

export function createApp(deps: Deps): Hono<AppEnv> {
  const app = new Hono<AppEnv>().basePath('/api');

  app.onError((error, c) => {
    if (error instanceof HttpError) {
      if (typeof error.extra.retryAfter === 'number') c.header('Retry-After', String(error.extra.retryAfter));
      return c.json(
        { error: { code: error.code, message: error.message, ...error.extra } },
        error.status as 400,
      );
    }
    // Whatever went wrong inside stays inside: the log has it, the reply does not.
    console.error('[api] unexpected error:', error);
    return c.json(
      { error: { code: 'internal', message: 'Something went wrong on our side. Nothing was changed.' } },
      500,
    );
  });

  app.notFound((c) =>
    c.json({ error: { code: 'not_found', message: 'There is nothing at that address.' } }, 404),
  );

  app.use('*', async (c, next) => {
    c.set('deps', deps);
    c.set('now', deps.now());
    const forwardedProto = c.req.header('x-forwarded-proto')?.split(',')[0]?.trim();
    const secure = (forwardedProto ?? new URL(c.req.url).protocol.replace(':', '')) === 'https';
    c.set('secure', secure);
    c.set('session', null);

    // Nothing the API says is ever to be kept by a browser or a cache, or read by another site.
    c.header('Cache-Control', 'no-store');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'no-referrer');
    c.header('Cross-Origin-Resource-Policy', 'same-origin');

    const method = c.req.method;
    const changes = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
    const token = readCookie(c.req.header('cookie'), cookieName(secure));
    if (changes && token && !sameOrigin(c.req.raw, forwardedProto)) {
      throw new HttpError('forbidden', 'That request did not come from HOMEBASE itself.');
    }
    return next();
  });

  // Is it up? Says nothing about anybody.
  app.get('/health', async (c) => {
    let database: 'ok' | 'down' = 'down';
    let engine: string | null = null;
    let rls: boolean | null = null;
    try {
      const db = await deps.database();
      engine = db.engine;
      rls = db.rls;
      database = 'ok';
    } catch (error) {
      console.error('[health] database:', error instanceof Error ? error.message : error);
    }
    return c.json(
      {
        ok: database === 'ok',
        api: API_VERSION,
        schema: LATEST_MIGRATION,
        database,
        engine,
        isolation: rls === null ? null : rls ? 'database' : 'application',
        mode: deps.config.demo ? 'demo' : 'family',
        commit: deps.config.commit,
        time: c.get('now').toISOString(),
      },
      database === 'ok' ? 200 : 503,
    );
  });

  app.use('*', async (c, next) => {
    let database;
    try {
      database = await deps.database();
    } catch (error) {
      console.error('[api] database unavailable:', error instanceof Error ? error.message : error);
      throw new HttpError(
        'unavailable',
        'HOMEBASE cannot reach its database just now. Try again in a moment.',
      );
    }
    c.set('database', database);

    const secure = c.get('secure');
    const token = readCookie(c.req.header('cookie'), cookieName(secure));
    if (token) {
      const now = c.get('now');
      const session = await asSystem(database, async (tx) => {
        const found = await findSession(tx, token, now);
        if (!found) return null;
        const renewed = await touchSession(tx, found, now);
        return { found, renewed };
      });
      if (session) {
        c.set('session', session.found);
        // Used again: the cookie is sent afresh so that it does not run out on a wall that is in use.
        if (session.renewed) c.header('Set-Cookie', sessionCookie(token, session.renewed, secure));
      }
    }
    return next();
  });

  app.route('/auth', authRoutes);
  app.route('/pair', pairRoutes);
  app.route('/wall', wallRoutes);
  app.route('/sync', syncRoutes);
  app.route('/demo', demoRoutes);

  return app;
}
