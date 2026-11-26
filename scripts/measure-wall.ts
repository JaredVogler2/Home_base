/**
 * Measures the wall in a headless browser: how much is downloaded, how soon the house is drawn, how heavy the
 * page is, and how evenly frames arrive while the house idles, a room opens and a mission is finished.
 *
 *   npm run build
 *   HOMEBASE_DEMO=1 HOMEBASE_DATA_DIR=memory:// PORT=4173 npm start        (in another terminal)
 *   BASE_URL=http://127.0.0.1:4173 npm run measure                         (add `-- --json` for JSON)
 *
 * Measure a production build: the dev server sends unminified modules one by one, so its download and start-up
 * figures mean nothing. The numbers are from a desktop browser with the processor slowed down (CPU_SLOWDOWN,
 * default 4×) and, in a container, drawn without a graphics card. They show whether a change made things worse;
 * they are NOT the real display's figures. Those come from /studio/device on the display itself
 * (docs/DEVICE-CHECKLIST.md).
 */
import { chromium, type Page } from 'playwright';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:5173';
const slowdown = Number(process.env.CPU_SLOWDOWN ?? '4');
const asJson = process.argv.includes('--json');
const t = (id: string) => `[data-testid="${id}"]`;

interface Frames {
  seconds: number;
  frames: number;
  fps: number;
  p95: number;
  worst: number;
  /** Frames that took longer than two refreshes of a 60 Hz display. */
  slow: number;
}

/** Count frames for a while, optionally doing something as the count starts. */
async function frames(page: Page, ms: number, during?: () => Promise<void>): Promise<Frames> {
  // Sent as text: a function handed over by the TypeScript runner carries helpers the page does not have.
  const collecting = page.evaluate<number[]>(`new Promise((resolve) => {
    const deltas = [];
    const start = performance.now();
    let last = start;
    function tick(now) {
      deltas.push(now - last);
      last = now;
      if (now - start < ${ms}) requestAnimationFrame(tick);
      else resolve(deltas);
    }
    requestAnimationFrame(tick);
  })`);
  if (during) await during();
  const deltas = (await collecting).slice(1).sort((a, b) => a - b);
  const total = deltas.reduce((sum, delta) => sum + delta, 0);
  const round = (value: number) => Math.round(value * 10) / 10;
  return {
    seconds: round(total / 1000),
    frames: deltas.length,
    fps: round((deltas.length / total) * 1000),
    p95: round(deltas[Math.floor(deltas.length * 0.95)] ?? 0),
    worst: round(deltas[deltas.length - 1] ?? 0),
    slow: deltas.filter((delta) => delta > 34).length,
  };
}

interface Result {
  screen: string;
  downloadedKb: number;
  requests: number;
  houseDrawnMs: number;
  domNodes: number;
  heapMb: number | null;
  idle: Frames;
  /** What the wall chose for itself after watching its own frames: `full` or `light`. */
  motion: string;
  tuned: Frames;
  roomOpens: Frames;
  missionDone: Frames;
  still: Frames;
}

async function measure(width: number, height: number, label: string): Promise<Result> {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    hasTouch: true,
  });
  await context.addInitScript(`try { window.localStorage.setItem('homebase.tour-seen', '1'); } catch {}`);
  const entered = await context.request.post(`${base}/api/demo/enter`, {
    data: { as: 'wall' },
    headers: { origin: base },
  });
  if (!entered.ok())
    throw new Error(`could not enter the demo: ${entered.status()} — is HOMEBASE_DEMO=1 set?`);
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  if (slowdown > 1) await client.send('Emulation.setCPUThrottlingRate', { rate: slowdown });

  let bytes = 0;
  let requests = 0;
  client.on('Network.loadingFinished', (event) => {
    bytes += event.encodedDataLength;
    requests += 1;
  });
  await client.send('Network.enable');

  const started = Date.now();
  await page.goto(`${base}/wall?at=10:30`, { waitUntil: 'domcontentloaded' });
  await page.locator(t('scene-home')).waitFor({ state: 'visible' });
  await page.locator(t('face-June')).waitFor({ state: 'visible' });
  const houseDrawnMs = Date.now() - started;
  await page.waitForLoadState('networkidle');
  const downloadedKb = Math.round(bytes / 1024);
  const requestCount = requests;

  const idle = await frames(page, 5000);
  // The wall judges its own frame rate a few seconds in and drops the ambient movement if it cannot keep up.
  await page.waitForTimeout(5000);
  const motion = await page.evaluate<string>(`document.documentElement.dataset.motion ?? 'unset'`);
  const tuned = await frames(page, 3000);
  const domNodes = await page.evaluate<number>(`document.querySelectorAll('*').length`);
  const heapMb = await page.evaluate<number | null>(
    `performance.memory ? Math.round((performance.memory.usedJSHeapSize / 1024 / 1024) * 10) / 10 : null`,
  );

  const roomOpens = await frames(page, 2500, async () => {
    await page.locator(t('room-quest')).click();
  });
  await page.locator(`${t('who')} button >> nth=0`).click();
  await page.locator('[data-testid^="mission-"]').first().click();
  await page.locator(t('did-it')).waitFor({ state: 'visible' });
  const missionDone = await frames(page, 2500, async () => {
    await page.locator(t('did-it')).click();
  });
  await context.close();

  // The same house for a device that asks for less motion: nothing should be animating at all.
  const calm = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    storageState: undefined,
  });
  await calm.request.post(`${base}/api/demo/enter`, { data: { as: 'wall' }, headers: { origin: base } });
  const quiet = await calm.newPage();
  const quietClient = await calm.newCDPSession(quiet);
  if (slowdown > 1) await quietClient.send('Emulation.setCPUThrottlingRate', { rate: slowdown });
  await quiet.goto(`${base}/wall?at=10:30`, { waitUntil: 'networkidle' });
  await quiet.locator(t('scene-home')).waitFor({ state: 'visible' });
  const still = await frames(quiet, 3000);
  await browser.close();

  return {
    screen: label,
    downloadedKb,
    requests: requestCount,
    houseDrawnMs,
    domNodes,
    heapMb,
    idle,
    motion,
    tuned,
    roomOpens,
    missionDone,
    still,
  };
}

const results = [await measure(1920, 1080, '1920×1080'), await measure(3840, 2160, '3840×2160')];

if (asJson) {
  console.log(JSON.stringify({ base, slowdown, results }, null, 2));
} else {
  const row = (name: string, pick: (result: Result) => string | number) =>
    `| ${name} | ${results.map((result) => pick(result)).join(' | ')} |`;
  const of = (f: Frames) => `${f.fps} fps · p95 ${f.p95} ms · worst ${f.worst} ms · ${f.slow} slow`;
  console.log(
    [
      `Measured at ${base}, processor slowed ${slowdown}×, headless Chromium.`,
      '',
      `| | ${results.map((result) => result.screen).join(' | ')} |`,
      `| --- | ${results.map(() => '---').join(' | ')} |`,
      row('Downloaded to draw the wall', (r) => `${r.downloadedKb} KB in ${r.requests} requests`),
      row('House drawn after', (r) => `${r.houseDrawnMs} ms`),
      row('Elements in the page (home)', (r) => r.domNodes),
      row('Script memory in use', (r) => (r.heapMb === null ? 'not reported' : `${r.heapMb} MB`)),
      row('Frames, house idling, first 5 s', (r) => of(r.idle)),
      row('Motion the wall then chose for itself', (r) => r.motion),
      row('Frames, house idling, after that (3 s)', (r) => of(r.tuned)),
      row('Frames, a room opening (2.5 s)', (r) => of(r.roomOpens)),
      row('Frames, a mission finished (2.5 s)', (r) => of(r.missionDone)),
      row('Frames, less-motion device (3 s)', (r) => of(r.still)),
    ].join('\n'),
  );
}
