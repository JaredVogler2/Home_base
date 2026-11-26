import { defineConfig } from '@playwright/test';
import { BASE, PHONE, PORT, WALL_1080 } from './e2e/support/env';

/**
 * The browser tests. They start their own HOMEBASE on its own port, with a database that lives only in memory
 * and the made-up demo family — never the developer's server on 5173 or its `.data/` folder.
 *
 * Every spec says which screens it belongs on with a tag (`@w1080`, `@w720`, `@tall`, `@phone`), and each
 * project runs only the tests carrying its tag. The demo is one shared household, so the tests run one at a time.
 * The projects are Chromium (what the wall display and Android run); with `E2E_WEBKIT=1` the phone's tests also
 * run in WebKit, which is the nearest thing to an iPhone's Safari that runs without an iPhone.
 */

/**
 * How the app is started for the tests, kept in one place. By default the Vite dev server (the API runs inside
 * it). `E2E_SERVER=production` instead serves an already-built app with server/standalone.ts — needed for the
 * service worker, which only a production build registers. Build it first, e.g.
 * `npx vite build --outDir /tmp/homebase-e2e-dist` and pass `E2E_DIST=/tmp/homebase-e2e-dist` (default `dist`).
 */
const PRODUCTION = process.env.E2E_SERVER === 'production';
const SERVER_COMMAND = PRODUCTION
  ? 'npx tsx server/standalone.ts'
  : `npx vite --host 127.0.0.1 --port ${PORT} --strictPort`;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  expect: { timeout: 8_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    timezoneId: 'America/Chicago',
    locale: 'en-US',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    {
      name: 'wall-1080',
      grep: /@w1080\b/,
      use: { ...WALL_1080 },
    },
    {
      name: 'wall-720',
      grep: /@w720\b/,
      use: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
    },
    {
      name: 'tablet-tall',
      grep: /@tall\b/,
      use: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, hasTouch: true },
    },
    {
      name: 'phone',
      grep: /@phone\b/,
      use: { ...PHONE },
    },
    // The grown-ups' side again in WebKit, the engine under Safari on an iPhone. Only when asked for
    // (E2E_WEBKIT=1), because it needs `npx playwright install webkit`; CI does both.
    ...(process.env.E2E_WEBKIT
      ? [{ name: 'phone-webkit', grep: /@phone\b/, use: { ...PHONE, browserName: 'webkit' as const } }]
      : []),
  ],
  webServer: {
    command: SERVER_COMMAND,
    url: `${BASE}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      HOMEBASE_DEMO: '1',
      HOMEBASE_DATA_DIR: 'memory://',
      HOMEBASE_SECRET_KEY: 'e2e-only-secret-key-e2e-only-secret-key',
      HOMEBASE_WEATHER: 'off',
      ...(PRODUCTION
        ? { PORT: String(PORT), HOST: '127.0.0.1', HOMEBASE_DIST: process.env.E2E_DIST ?? 'dist' }
        : {}),
    },
  },
});
