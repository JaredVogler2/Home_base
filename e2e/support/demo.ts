import {
  expect,
  request as playwrightRequest,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Locator,
  type Page,
} from '@playwright/test';
import type { LedgerEntry, Occurrence, Snapshot } from '../../shared/model';
import { BASE, PHONE, WALL_1080 } from './env';

/**
 * Small helpers for driving the demo household: entering it as the wall or a grown-up, putting it back to its
 * start, and asking the server what it really holds (so a test never trusts what a screen merely shows).
 */

/** The made-up Maple Street family's fixed ids and sign-in details (see server/domain/seed.ts). */
export const DEMO = {
  june: 'd0d0d0d0-0000-4000-8000-0000000000c1',
  milo: 'd0d0d0d0-0000-4000-8000-0000000000c2',
  bea: 'd0d0d0d0-0000-4000-8000-0000000000c3',
  groceries: 'd0d0d0d0-0000-4000-8000-0000000000e1',
  toBuy: 'd0d0d0d0-0000-4000-8000-0000000000e2',
  rileyEmail: 'riley@maple-street.example',
  password: 'maple-street-demo',
} as const;

export type As = 'wall' | 'guardian' | 'caregiver';

type Target = BrowserContext | APIRequestContext;
const requestOf = (target: Target): APIRequestContext =>
  'request' in target ? (target as BrowserContext).request : (target as APIRequestContext);

/**
 * A wall in a fresh browser shows Tock's first-visit tour on the house. Tests that are not about the tour mark
 * it as seen, the way scripts/capture-screens.ts does, so that Tock's words and the house are the ordinary ones.
 */
export async function skipTour(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem('homebase.tour-seen', '1');
    } catch {
      // No storage: the tour simply shows, and ends at the first tap.
    }
  });
}

/**
 * Enter the demo as the wall or a grown-up. The session cookie lands in the context's jar. A wall context also
 * has the first-visit tour marked as seen (pass `{ tour: true }` to keep it).
 */
export async function enter(target: Target, as: As, options: { tour?: boolean } = {}): Promise<void> {
  if (as === 'wall' && 'request' in target && !options.tour) await skipTour(target as BrowserContext);
  const reply = await requestOf(target).post(`${BASE}/api/demo/enter`, {
    data: { as },
    headers: { origin: BASE },
  });
  expect(reply.ok(), `entering the demo as ${as}: ${reply.status()} ${await reply.text()}`).toBe(true);
}

/** Sign in with an e-mail and password (for the demo's second guardian, Riley). */
export async function signIn(target: Target, email: string, password: string): Promise<void> {
  const reply = await requestOf(target).post(`${BASE}/api/auth/login`, {
    data: { email, password },
    headers: { origin: BASE },
  });
  expect(reply.ok(), `signing in as ${email}: ${reply.status()} ${await reply.text()}`).toBe(true);
}

/** A request context signed in as the demo's owner, for checking what the server holds. */
export async function guardianApi(): Promise<APIRequestContext> {
  const api = await playwrightRequest.newContext({ baseURL: BASE });
  await enter(api, 'guardian');
  return api;
}

/** Put the demo back to how it began. Every device and session of the old demo stops working. */
export async function resetDemo(): Promise<void> {
  const api = await guardianApi();
  const reply = await api.post(`${BASE}/api/demo/reset`, { data: {}, headers: { origin: BASE } });
  expect(reply.ok(), `resetting the demo: ${reply.status()} ${await reply.text()}`).toBe(true);
  await api.dispose();
}

/** What the server says the household is, as seen by whoever the context is signed in as. */
export async function snapshot(target: Target): Promise<Snapshot> {
  const reply = await requestOf(target).get(`${BASE}/api/sync`, { headers: { 'cache-control': 'no-store' } });
  expect(reply.ok(), `reading /api/sync: ${reply.status()}`).toBe(true);
  return (await reply.json()) as Snapshot;
}

export async function ledger(target: Target, profileId: string): Promise<LedgerEntry[]> {
  const reply = await requestOf(target).get(`${BASE}/api/history/ledger?profileId=${profileId}&limit=200`);
  expect(reply.ok(), `reading the ledger: ${reply.status()}`).toBe(true);
  return ((await reply.json()) as { entries: LedgerEntry[] }).entries;
}

export function walletOf(snap: Snapshot, profileId: string) {
  const wallet = snap.wallets.find((candidate) => candidate.profileId === profileId);
  if (!wallet) throw new Error(`no wallet for ${profileId}`);
  return wallet;
}

const ORDER: Record<Occurrence['status'], number> = {
  returned: 0,
  in_progress: 1,
  available: 2,
  submitted: 3,
  approved: 4,
  skipped: 5,
};

/** The missions a child sees pinned to the board, in the wall's own order (see src/wall/derive.ts and Quest). */
export function boardFor(snap: Snapshot, profileId: string): Occurrence[] {
  const missions = snap.occurrences
    .filter((occurrence) => occurrence.date === snap.today)
    .filter((occurrence) => occurrence.profileId === profileId || occurrence.profileId === null)
    .filter((occurrence) => occurrence.status !== 'skipped')
    .filter(
      (occurrence) => !occurrence.snoozedUntil || new Date(occurrence.snoozedUntil).getTime() <= Date.now(),
    )
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.sort - b.sort || a.id.localeCompare(b.id));
  const limit = Math.max(snap.household.settings.quest.showAtOnce, 3);
  return [
    ...missions.filter((mission) => mission.status !== 'approved'),
    ...missions.filter((mission) => mission.status === 'approved'),
  ].slice(0, limit);
}

const open = (occurrence: Occurrence) =>
  occurrence.status === 'available' ||
  occurrence.status === 'in_progress' ||
  occurrence.status === 'returned';

/**
 * A mission on a child's board that a grown-up must say yes to, with a title no other mission of that child
 * shares (so the test can find it on the board and in the parent's inbox).
 */
export function guardianMission(snap: Snapshot): { profileId: string; mission: Occurrence } | null {
  for (const profileId of [DEMO.milo, DEMO.june]) {
    const board = boardFor(snap, profileId);
    const mission = board.find(
      (candidate) =>
        candidate.verification === 'guardian' &&
        candidate.profileId === profileId &&
        open(candidate) &&
        !snap.occurrences.some(
          (other) =>
            other.id !== candidate.id && other.title === candidate.title && other.status === 'submitted',
        ),
    );
    if (mission) return { profileId, mission };
  }
  return null;
}

/** A new browser context dressed as a wall or a phone. */
export async function newScreen(browser: Browser, kind: 'wall' | 'phone', extra: BrowserContextOptions = {}) {
  const context = await browser.newContext({
    baseURL: BASE,
    timezoneId: 'America/Chicago',
    locale: 'en-US',
    ...(kind === 'wall' ? WALL_1080 : PHONE),
    ...extra,
  });
  if (kind === 'wall') await skipTour(context);
  return context;
}

/** Open the wall at a pinned time of day and wait for the house. */
export async function openWall(page: Page, at = '16:30'): Promise<void> {
  await page.goto(`/wall?at=${at}`);
  await expect(page.getByTestId('scene-home')).toBeVisible({ timeout: 15_000 });
}

/** One tap, the way a finger does it — or a click, on a screen that has no touch. */
export async function press(locator: Locator): Promise<void> {
  try {
    await locator.tap();
  } catch (error) {
    if (error instanceof Error && /hasTouch/i.test(error.message)) await locator.click();
    else throw error;
  }
}

/** The number of star pictures drawn on the bank's trays. */
export async function starPicturesOnTrays(page: Page): Promise<number> {
  return page.getByTestId('star-trays').locator('path[d^="M0 -10"]').count();
}

/** Wait for every animation that ends (a room growing open, a sheet sliding up) to end. Endless ones are left. */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const ending = document
      .getAnimations()
      .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime ?? Infinity));
    await Promise.all(ending.map((animation) => animation.finished.catch(() => undefined)));
  });
}
