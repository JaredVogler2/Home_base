/**
 * Look at a running HOMEBASE from the outside and say what is and is not as it should be.
 *
 *   npm run verify:deployment -- https://your-homebase.example
 *   npm run verify:deployment -- http://127.0.0.1:4173          (after: npm run build && npm start)
 *
 * It signs in to nothing and changes nothing on a family's deployment. It checks that the site is up, that the
 * pages carry their security headers, that the API refuses a stranger, that the app installs its offline shell,
 * and that no page complains in the browser's console. Where the deployment is the demo (a made-up family) it
 * goes further: it opens the wall, goes offline, and checks the house still draws.
 */
import { chromium } from 'playwright';

const base = (process.argv[2] ?? '').replace(/\/$/, '');
if (!/^https?:\/\//.test(base)) {
  console.error(
    'Give the address to check, for example: npm run verify:deployment -- https://example.vercel.app',
  );
  process.exit(2);
}

let failed = 0;
const say = (ok: boolean, what: string, detail = '') => {
  if (!ok) failed += 1;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${what}${detail ? ` — ${detail}` : ''}`);
};

// --- from the outside, with no browser ---------------------------------------------------------------------------
const health = await fetch(`${base}/api/health`)
  .then(async (reply) => ({ status: reply.status, body: (await reply.json()) as Record<string, unknown> }))
  .catch(() => null);
say(
  health?.status === 200 && health.body.database === 'ok',
  'the server is up and can reach its database',
  JSON.stringify(health?.body ?? {}),
);
const demo = health?.body.mode === 'demo';
say(
  true,
  demo ? 'this is the DEMO (made-up family)' : 'this is a family deployment (nothing will be signed in to)',
);
if (health && !demo) {
  say(
    health.body.isolation === 'database',
    'household isolation is enforced by the database (row-level security)',
    String(health.body.isolation),
  );
}

const page = await fetch(`${base}/wall`).catch(() => null);
const header = (name: string) => page?.headers.get(name) ?? '';
say(page?.status === 200, 'a page address answers with the app');
say(header('content-security-policy').includes("script-src 'self'"), 'Content-Security-Policy is set');
say(
  header('content-security-policy').includes("frame-ancestors 'none'") ||
    header('x-frame-options') === 'DENY',
  'the site cannot be framed by another',
);
say(header('x-content-type-options') === 'nosniff', 'X-Content-Type-Options: nosniff');
say(header('referrer-policy') === 'no-referrer', 'Referrer-Policy: no-referrer');
say(/noindex/.test(header('x-robots-tag')), 'search engines are told not to index it');
if (base.startsWith('https://'))
  say(header('strict-transport-security') !== '', 'Strict-Transport-Security is set');

const sync = await fetch(`${base}/api/sync`).catch(() => null);
say(sync?.status === 401, 'the API refuses a stranger', `GET /api/sync → ${sync?.status}`);
say((sync?.headers.get('cache-control') ?? '').includes('no-store'), 'API answers are never cached');
const worker = await fetch(`${base}/sw.js`).catch(() => null);
say(
  worker?.status === 200 && /javascript/.test(worker.headers.get('content-type') ?? ''),
  'the service worker is served',
);
const manifest = await fetch(`${base}/manifest.webmanifest`).catch(() => null);
say(manifest?.status === 200, 'the web app manifest is served');
const cron = await fetch(`${base}/api/cron/daily`).catch(() => null);
say(cron?.status === 401, 'the daily nudge refuses anyone without the host’s secret', `→ ${cron?.status}`);
const demoDoor = await fetch(`${base}/api/demo/enter`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: base },
  body: JSON.stringify({ as: 'guardian' }),
}).catch(() => null);
if (!demo)
  say(demoDoor?.status === 404, 'there is no demo door on a family deployment', `→ ${demoDoor?.status}`);

// --- in a browser ----------------------------------------------------------------------------------------------
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, hasTouch: true });
  const view = await context.newPage();
  const complaints: string[] = [];
  let offline = false;
  view.on('console', (message) => {
    // A stranger is told 401 by the API, and a screen with no signal cannot reach it at all: both are the
    // right thing to happen, not faults.
    if (message.type() !== 'error' || offline || /401/.test(message.text())) return;
    complaints.push(message.text());
  });
  view.on('pageerror', (error) => complaints.push(String(error)));

  await view.goto(`${base}/`, { waitUntil: 'networkidle' });
  say((await view.title()) === 'HOMEBASE', 'the front door opens');
  await view.goto(`${base}/parent`, { waitUntil: 'networkidle' });
  say(
    (await view.locator('[data-testid="auth-submit"]').count()) === 1,
    'the grown-ups’ side shows its sign-in',
  );
  await view.goto(`${base}/wall`, { waitUntil: 'networkidle' });
  say(
    (await view.locator('[data-testid="pair-code"]').count()) === 1,
    'an unpaired screen shows a pairing code',
  );

  const shell = await view.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return null;
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
    ]);
    if (!registration) return null;
    const names = (await caches.keys()).filter((name) => name.startsWith('homebase-shell-'));
    const files = names[0] ? (await (await caches.open(names[0])).keys()).length : 0;
    return { names, files };
  });
  say(
    Boolean(shell && shell.files > 5),
    'the offline shell is installed',
    shell ? `${shell.files} files kept` : 'no service worker (plain http on a remote host?)',
  );

  if (demo) {
    await context.request.post(`${base}/api/demo/enter`, { data: { as: 'wall' }, headers: { origin: base } });
    await view.goto(`${base}/wall?at=10:30`, { waitUntil: 'networkidle' });
    await view.waitForSelector('[data-testid="scene-home"]', { timeout: 15_000 });
    say(true, 'the demo wall draws the house');
    offline = true;
    await context.setOffline(true);
    await view.reload({ waitUntil: 'domcontentloaded' });
    const drew = await view
      .waitForSelector('[data-testid="scene-home"]', { timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    say(drew, 'with no signal, a reload still draws the house from what was kept');
    if (drew) {
      await view.locator('[data-testid="room-quest"]').click();
      const room = await view
        .waitForSelector('[data-testid="scene-quest"]', { timeout: 8000 })
        .then(() => true)
        .catch(() => false);
      say(room, 'with no signal, a room that had not been opened still opens');
      say((await view.locator('[data-testid="status"]').count()) === 1, 'the wall says it is out of touch');
    }
    await context.setOffline(false);
    await view.waitForTimeout(500);
    offline = false;
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const parent = await phone.newPage();
    parent.on('console', (message) => {
      if (message.type() === 'error') complaints.push(`parent: ${message.text()}`);
    });
    await phone.request.post(`${base}/api/demo/enter`, {
      data: { as: 'guardian' },
      headers: { origin: base },
    });
    for (const path of [
      '/parent',
      '/parent/lists',
      '/parent/plan',
      '/parent/history',
      '/parent/more',
      '/parent/more/records',
    ]) {
      await parent.goto(base + path, { waitUntil: 'networkidle' });
    }
    say((await parent.locator('h1').count()) > 0, 'the demo’s grown-ups’ pages open');
  }
  say(
    complaints.length === 0,
    'no page complained in the console (which is where a broken security policy shows)',
    complaints.slice(0, 3).join(' | '),
  );
} finally {
  await browser.close();
}

console.log(failed === 0 ? '\nAll as it should be.' : `\n${failed} thing(s) need a look.`);
process.exit(failed === 0 ? 0 : 1);
