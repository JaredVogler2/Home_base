/**
 * Takes the review screenshots from a running HOMEBASE (the demo family), one browser, many pictures.
 *
 *   npm run screens                     every screen, into docs/review/screens
 *   npm run screens -- wall-quest       only the ones whose name starts with that
 *   OUT=/some/dir npm run screens       somewhere else
 *
 * It needs a server started with HOMEBASE_DEMO=1 (npm run dev does that for a fresh checkout).
 */
import { mkdirSync } from 'node:fs';
import { chromium, type BrowserContext, type Page } from 'playwright';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:5173';
const out = process.env.OUT ?? 'docs/review/screens';
const only = process.argv.slice(2);
mkdirSync(out, { recursive: true });

interface Shot {
  name: string;
  as: 'wall' | 'guardian' | 'caregiver' | null;
  path: string;
  size?: [number, number, number];
  /** Things to tap, in order, before the picture. */
  taps?: string[];
  fullPage?: boolean;
  wait?: number;
}

const WIDE: [number, number, number] = [1920, 1080, 2];
const SMALL: [number, number, number] = [1280, 720, 1];
const PHONE: [number, number, number] = [390, 844, 3];
const t = (id: string) => `[data-testid="${id}"]`;
const june = `${t('who')} button >> nth=0`;

const SHOTS: Shot[] = [
  { name: 'wall-home-day', as: 'wall', path: '/wall?at=10:30', size: WIDE },
  { name: 'wall-home-evening', as: 'wall', path: '/wall?at=17:10', size: WIDE },
  { name: 'wall-home-night', as: 'wall', path: '/wall?at=21:30', size: WIDE },
  { name: 'wall-home-rain', as: 'wall', path: '/wall?at=14:00&sky=rain', size: WIDE },
  { name: 'wall-home-snow', as: 'wall', path: '/wall?at=11:00&sky=snow', size: WIDE },
  { name: 'wall-home-who', as: 'wall', path: '/wall?at=16:30', size: WIDE, taps: [t('face-June')] },
  { name: 'wall-quest', as: 'wall', path: '/wall?at=16:30', size: WIDE, taps: [t('room-quest'), june] },
  {
    name: 'wall-quest-mission',
    as: 'wall',
    path: '/wall?at=16:30',
    size: WIDE,
    taps: [t('room-quest'), june, t('mission-Shoes in the basket')],
  },
  { name: 'wall-bank', as: 'wall', path: '/wall?at=16:30', size: WIDE, taps: [t('room-bank'), june] },
  {
    name: 'wall-bank-reward',
    as: 'wall',
    path: '/wall?at=16:30',
    size: WIDE,
    taps: [t('room-bank'), june, t('reward-Family game')],
  },
  { name: 'wall-routines', as: 'wall', path: '/wall?at=07:10', size: WIDE, taps: [t('room-routines'), june] },
  {
    name: 'wall-routine-step',
    as: 'wall',
    path: '/wall?at=07:10',
    size: WIDE,
    taps: [t('room-routines'), june, t('routine-Morning'), t('step-done')],
  },
  { name: 'wall-pantry', as: 'wall', path: '/wall?at=16:30', size: WIDE, taps: [t('room-pantry')] },
  {
    name: 'wall-pantry-ask',
    as: 'wall',
    path: '/wall?at=16:30',
    size: WIDE,
    taps: [t('room-pantry'), t('ask-item'), june],
  },
  { name: 'wall-calendar', as: 'wall', path: '/wall?at=16:30', size: WIDE, taps: [t('room-calendar')] },
  { name: 'wall-academy', as: 'wall', path: '/wall?at=16:30', size: WIDE, taps: [t('room-academy')] },
  { name: 'wall-memories', as: 'wall', path: '/wall?at=16:30', size: WIDE, taps: [t('room-memories')] },
  {
    name: 'wall-grownups-pin',
    as: 'wall',
    path: '/wall?at=16:30',
    size: WIDE,
    taps: [t('room-grownups'), t('member-Sam')],
  },
  { name: 'wall-pair', as: null, path: '/wall', size: SMALL },
  { name: 'wall-home-small', as: 'wall', path: '/wall?at=10:30', size: SMALL },
  { name: 'wall-home-phone', as: 'wall', path: '/wall?at=10:30', size: PHONE },
  { name: 'wall-home-phone-who', as: 'wall', path: '/wall?at=16:40', size: PHONE, taps: [t('face-June')] },
  { name: 'wall-home-golden', as: 'wall', path: '/wall?at=16:40', size: WIDE },
  { name: 'wall-home-dawn', as: 'wall', path: '/wall?at=06:50', size: WIDE },
  { name: 'front-door', as: null, path: '/', size: PHONE },
  { name: 'parent-signin', as: null, path: '/parent', size: PHONE },
  { name: 'parent-today', as: 'guardian', path: '/parent', size: PHONE, fullPage: true },
  { name: 'parent-lists', as: 'guardian', path: '/parent/lists', size: PHONE, fullPage: true },
  {
    name: 'parent-list-edit',
    as: 'guardian',
    path: '/parent/lists',
    size: PHONE,
    taps: ['[aria-label="Edit Milk"]'],
  },
  { name: 'parent-plan', as: 'guardian', path: '/parent/plan', size: PHONE, fullPage: true },
  {
    name: 'parent-mission-editor',
    as: 'guardian',
    path: '/parent/plan',
    size: PHONE,
    taps: [t('template-Shoes in the basket')],
  },
  {
    name: 'parent-mission-ideas',
    as: 'guardian',
    path: '/parent/plan',
    size: PHONE,
    taps: [t('new-mission')],
  },
  { name: 'parent-routines', as: 'guardian', path: '/parent/plan/routines', size: PHONE, fullPage: true },
  {
    name: 'parent-routine-editor',
    as: 'guardian',
    path: '/parent/plan/routines',
    size: PHONE,
    taps: [t('routine-Morning')],
  },
  { name: 'parent-rewards', as: 'guardian', path: '/parent/plan/rewards', size: PHONE, fullPage: true },
  {
    name: 'parent-reward-editor',
    as: 'guardian',
    path: '/parent/plan/rewards',
    size: PHONE,
    taps: [t('reward-Movie night')],
  },
  {
    name: 'parent-history',
    as: 'guardian',
    path: '/parent/history',
    size: PHONE,
    fullPage: true,
    wait: 1200,
  },
  { name: 'parent-family', as: 'guardian', path: '/parent/more', size: PHONE, fullPage: true },
  { name: 'parent-children', as: 'guardian', path: '/parent/more/children', size: PHONE },
  { name: 'parent-grownups', as: 'guardian', path: '/parent/more/grownups', size: PHONE, fullPage: true },
  { name: 'parent-screens', as: 'guardian', path: '/parent/more/screens', size: PHONE, fullPage: true },
  { name: 'parent-wall-settings', as: 'guardian', path: '/parent/more/wall', size: PHONE, fullPage: true },
  { name: 'parent-rules', as: 'guardian', path: '/parent/more/rules', size: PHONE, fullPage: true },
  { name: 'parent-sky', as: 'guardian', path: '/parent/more/sky', size: PHONE, fullPage: true },
  { name: 'parent-calendar', as: 'guardian', path: '/parent/more/calendar', size: PHONE },
  { name: 'parent-photos', as: 'guardian', path: '/parent/more/photos', size: PHONE, fullPage: true },
  { name: 'parent-academy', as: 'guardian', path: '/parent/more/academy', size: PHONE, fullPage: true },
  { name: 'parent-shortcuts', as: 'guardian', path: '/parent/more/shortcuts', size: PHONE, fullPage: true },
  {
    name: 'parent-records',
    as: 'guardian',
    path: '/parent/more/records',
    size: PHONE,
    fullPage: true,
    wait: 900,
  },
  { name: 'parent-today-wide', as: 'guardian', path: '/parent', size: SMALL },
  {
    name: 'wall-quest-phone',
    as: 'wall',
    path: '/wall?at=16:30',
    size: PHONE,
    taps: [t('room-quest'), june],
  },
];

async function enter(context: BrowserContext, as: Shot['as']): Promise<void> {
  if (!as) return;
  const reply = await context.request.post(`${base}/api/demo/enter`, {
    data: { as },
    headers: { origin: base },
  });
  if (!reply.ok())
    throw new Error(`could not enter the demo as ${as}: ${reply.status()} ${await reply.text()}`);
}

async function take(page: Page, shot: Shot): Promise<string[]> {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });
  page.on('pageerror', (error) => problems.push(String(error)));
  await page.goto(base + shot.path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(shot.wait ?? 500);
  for (const selector of shot.taps ?? []) {
    await page.locator(selector).first().click({ timeout: 5000 });
    await page.waitForTimeout(650);
  }
  await page.screenshot({ path: `${out}/${shot.name}.png`, fullPage: shot.fullPage ?? false });
  return problems;
}

const browser = await chromium.launch();
// Start from the demo as it begins, so the pictures are the same every time.
{
  const context = await browser.newContext();
  await enter(context, 'guardian');
  await context.request.post(`${base}/api/demo/reset`, {
    headers: { origin: base, 'content-type': 'application/json' },
    data: {},
  });
  await context.close();
}
let failed = 0;
for (const shot of SHOTS) {
  if (only.length > 0 && !only.some((prefix) => shot.name.startsWith(prefix))) continue;
  const [width, height, scale] = shot.size ?? WIDE;
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    reducedMotion: 'reduce',
    hasTouch: true,
  });
  try {
    await enter(context, shot.as);
    const problems = await take(await context.newPage(), shot);
    console.log(
      `${problems.length === 0 ? 'ok  ' : 'WARN'} ${shot.name}${problems.length ? `\n     ${problems.join('\n     ')}` : ''}`,
    );
  } catch (error) {
    failed += 1;
    console.log(`FAIL ${shot.name}: ${error instanceof Error ? error.message.split('\n')[0] : error}`);
  }
  await context.close();
}
await browser.close();
if (failed > 0) process.exitCode = 1;
