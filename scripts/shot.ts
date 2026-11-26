/**
 * Take a picture of a page of the running app. A working tool for whoever is drawing:
 *   npx tsx scripts/shot.ts /studio/actions out.png [width] [height] [scale]
 * With AS=wall|guardian|caregiver it first steps into the demo family as that kind of screen.
 * With FULL=1 it takes the whole page; with TAP="css selector, css selector" it taps those first, in order.
 */
import { chromium } from 'playwright';

const [path = '/', out = 'shot.png', width = '1280', height = '900', scale = '1'] = process.argv.slice(2);
const base = process.env.BASE_URL ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: Number(width), height: Number(height) },
  deviceScaleFactor: Number(scale),
  reducedMotion: process.env.MOTION === '1' ? 'no-preference' : 'reduce',
  hasTouch: true,
});
const page = await context.newPage();
const problems: string[] = [];
page.on('console', (message) => {
  if (message.type() === 'error') problems.push(message.text());
});
page.on('pageerror', (error) => problems.push(String(error)));
if (process.env.AS) {
  const reply = await context.request.post(`${base}/api/demo/enter`, {
    data: { as: process.env.AS },
    headers: { origin: base },
  });
  if (!reply.ok()) console.log('could not enter the demo:', reply.status(), await reply.text());
}
await page.goto(base + path, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
for (const selector of (process.env.TAP ?? '')
  .split(',')
  .map((part) => part.trim())
  .filter(Boolean)) {
  await page.locator(selector).first().click();
  await page.waitForTimeout(Number(process.env.WAIT ?? 700));
}
await page.screenshot({ path: out, fullPage: process.env.FULL === '1' });
if (problems.length > 0) console.log('console problems:\n' + problems.join('\n'));
await browser.close();
console.log(`wrote ${out}`);
