/**
 * Records a short film of a child's journey on the wall, with the made-up family: choose who you are, open the
 * missions, finish one, look at the stars, ask for a reward, go home.
 *
 *   npm run record                      into docs/review/recordings/wall-journey.webm
 *
 * It needs a server started with HOMEBASE_DEMO=1 (BASE_URL, default http://127.0.0.1:5173). The film is a
 * 1280×720 WebM with no sound; the pauses are for a person watching it, not something the wall needs.
 */
import { mkdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:5173';
const out = process.env.OUT ?? 'docs/review/recordings';
const t = (id: string) => `[data-testid="${id}"]`;
mkdirSync(out, { recursive: true });
const scratch = join(out, '.tmp');

const browser = await chromium.launch();
{
  const context = await browser.newContext();
  await context.request.post(`${base}/api/demo/enter`, {
    data: { as: 'guardian' },
    headers: { origin: base },
  });
  await context.request.post(`${base}/api/demo/reset`, {
    headers: { origin: base, 'content-type': 'application/json' },
    data: {},
  });
  await context.close();
}
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  hasTouch: true,
  recordVideo: { dir: scratch, size: { width: 1280, height: 720 } },
});
const entered = await context.request.post(`${base}/api/demo/enter`, {
  data: { as: 'wall' },
  headers: { origin: base },
});
if (!entered.ok()) throw new Error(`could not enter the demo: ${entered.status()}`);
const page = await context.newPage();
const pause = (ms: number) => page.waitForTimeout(ms);
const tap = async (selector: string, after = 1400) => {
  await page.locator(selector).first().click();
  await pause(after);
};

// A screen that has never been used: Tock shows a newcomer round, and the first tap ends it.
await page.goto(`${base}/wall?at=16:30`, { waitUntil: 'networkidle' });
await pause(5200);
await tap(t('face-June'), 1600);
await tap(t('room-quest'), 1800);
await tap(t('mission-Shoes in the basket'), 2200);
await tap(t('did-it'), 2600);
await tap(t('sheet-close'), 1400);
await tap(t('go-home'), 1400);
await tap(t('room-bank'), 2200);
await tap(t('reward-Family game'), 2200);
await tap(t('sheet-close'), 1000);
await tap(t('go-home'), 1600);

const video = page.video();
await context.close();
await browser.close();
if (!video) throw new Error('no film was made');
const target = join(out, 'wall-journey.webm');
renameSync(await video.path(), target);
rmSync(scratch, { recursive: true, force: true });
console.log(`Saved ${target}`);
