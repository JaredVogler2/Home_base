import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { getRequestListener } from '@hono/node-server';
import { cacheControlFor, PAGE_HEADERS, TRANSPORT_HEADER } from './http/security.js';
import { runtimeApp, runtimeDeps } from './runtime.js';
import { describeError } from './log.js';

/**
 * HOMEBASE as one ordinary Node server: the built app from ./dist and the API, on one port.
 *
 *   npm run build && npm start
 *
 * This is what "preview" runs, and it is a complete way to host HOMEBASE yourself (a home server, a small VPS,
 * a container) instead of on Vercel. Put it behind something that speaks https — a reverse proxy or a tunnel —
 * and tell it so with the usual X-Forwarded-Proto header: sign-in cookies are only "Secure" over https.
 */

const root = resolve(process.env.HOMEBASE_DIST ?? 'dist');
const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? '127.0.0.1';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.bin': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
};

const api = getRequestListener(runtimeApp().fetch);

/** The file for an address, or null when there is none (or the address tries to climb out of ./dist). */
async function fileFor(pathname: string): Promise<string | null> {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const candidate = normalize(join(root, decoded));
  if (candidate !== root && !candidate.startsWith(root + sep)) return null;
  try {
    const info = await stat(candidate);
    return info.isFile() ? candidate : null;
  } catch {
    return null;
  }
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://local');
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    void api(request, response);
    return;
  }
  void (async () => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    // A real file is itself; any other address is a page of the app, which draws it.
    const exact = url.pathname === '/' ? null : await fileFor(url.pathname);
    const looksLikeFile = /\.[a-z0-9]+$/i.test(url.pathname);
    const file = exact ?? (looksLikeFile ? null : await fileFor('/index.html'));
    if (!file) {
      response
        .writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...PAGE_HEADERS })
        .end('Not found');
      return;
    }
    const body = await readFile(file);
    const headers: Record<string, string> = {
      'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': String(body.byteLength),
      'Cache-Control': cacheControlFor(exact ? url.pathname : '/index.html'),
      ...PAGE_HEADERS,
    };
    if (request.headers['x-forwarded-proto'] === 'https') headers[TRANSPORT_HEADER[0]] = TRANSPORT_HEADER[1];
    response.writeHead(200, headers).end(request.method === 'HEAD' ? undefined : body);
  })().catch((error: unknown) => {
    console.error(`[site] ${describeError(error)}`);
    if (!response.headersSent) response.writeHead(500).end();
    else response.end();
  });
});

const config = runtimeDeps().config;
server.listen(port, host, () => {
  console.info(
    `HOMEBASE is at http://${host}:${port}  (${config.demo ? 'demo, made-up family' : 'your family'}; database: ${
      config.databaseUrl ? 'PostgreSQL' : `kept in ${config.localData}`
    })`,
  );
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    // Open connections are not waited for for ever.
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
