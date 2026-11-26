import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import {
  enter,
  guardianMission,
  newScreen,
  openWall,
  press,
  resetDemo,
  snapshot,
  walletOf,
} from './support/demo';

/**
 * A mission that needs a grown-up's yes: finished on the wall, answered on a parent's phone, and the stars
 * given exactly once however the answer arrives.
 */

interface Setup {
  wall: BrowserContext;
  phone: BrowserContext;
  wallPage: Page;
  phonePage: Page;
  profileId: string;
  missionId: string;
  title: string;
  stars: number;
  nickname: string;
}

async function setUp(browser: Browser): Promise<Setup> {
  await resetDemo();
  const wall = await newScreen(browser, 'wall');
  const phone = await newScreen(browser, 'phone');
  await enter(wall, 'wall');
  await enter(phone, 'guardian');
  const snap = await snapshot(phone);
  const picked = guardianMission(snap);
  test.skip(
    !picked,
    'No mission needing a grown-up is on a child’s board today (the seed’s schedule decides).',
  );
  const { profileId, mission } = picked!;
  const nickname = snap.profiles.find((profile) => profile.id === profileId)!.nickname;
  const wallPage = await wall.newPage();
  const phonePage = await phone.newPage();
  return {
    wall,
    phone,
    wallPage,
    phonePage,
    profileId,
    missionId: mission.id,
    title: mission.title,
    stars: mission.stars,
    nickname,
  };
}

/** On the wall: choose the child, open the board, finish the mission. */
async function finishOnWall(s: Setup): Promise<void> {
  const page = s.wallPage;
  await openWall(page, '16:30');
  await press(page.getByTestId(`face-${s.nickname}`));
  await press(page.getByTestId('room-quest'));
  const card = page.getByTestId('scene-quest').getByTestId(`mission-${s.title}`);
  await press(card);
  const sheet = page.getByTestId('mission-sheet');
  await press(sheet.getByTestId('did-it'));
  await expect(sheet.getByTestId('mission-sent')).toBeVisible();
  await press(sheet.getByTestId('sheet-close'));
  await expect(card).toHaveAttribute('data-state', 'sent');
}

async function starsOnWall(page: Page): Promise<number> {
  return Number(await page.getByTestId('star-trays').getAttribute('data-stars'));
}

test.describe('a grown-up says yes from their phone', { tag: '@w1080' }, () => {
  let s: Setup;

  test.beforeEach(async ({ browser }) => {
    s = await setUp(browser);
  });

  test.afterEach(async () => {
    await s?.wall.close();
    await s?.phone.close();
  });

  test('Yes: the wall shows it done and the stars go up by exactly the mission’s stars, once', async () => {
    const before = walletOf(await snapshot(s.phone), s.profileId);
    await finishOnWall(s);

    await s.phonePage.goto('/parent');
    const waiting = s.phonePage.getByTestId('inbox').getByTestId(`waiting-${s.title}`);
    await expect(waiting, 'in "Waiting for you" within a few seconds').toBeVisible({ timeout: 6_000 });

    // Two quick taps on Yes, as an eager thumb does.
    const yes = s.phonePage.getByTestId(`approve-${s.title}`);
    await expect(yes).toBeVisible();
    await yes.evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
    await expect(waiting).toHaveCount(0);

    // The wall: done, within a few seconds, without being touched.
    const card = s.wallPage.getByTestId('scene-quest').getByTestId(`mission-${s.title}`);
    await expect
      .poll(
        async () => ((await card.count()) === 0 ? 'off the board' : await card.getAttribute('data-state')),
        {
          timeout: 8_000,
        },
      )
      .toMatch(/done|off the board/);
    await press(s.wallPage.getByTestId('scene-quest').getByTestId('go-home'));
    await press(s.wallPage.getByTestId('room-bank'));
    await expect.poll(() => starsOnWall(s.wallPage), { timeout: 8_000 }).toBe(before.available + s.stars);

    // The server, now and after a reload of both screens: once, not twice.
    const after = await snapshot(s.phone);
    const mission = after.occurrences.find((occurrence) => occurrence.id === s.missionId)!;
    expect(mission.status).toBe('approved');
    expect(mission.credited).toBe(true);
    expect(walletOf(after, s.profileId).available).toBe(before.available + s.stars);
    expect(walletOf(after, s.profileId).lifetime).toBe(before.lifetime + s.stars);

    await s.phonePage.reload();
    await expect(s.phonePage.getByTestId('inbox')).toBeVisible();
    await expect(s.phonePage.getByTestId(`waiting-${s.title}`)).toHaveCount(0);
    await s.wallPage.reload();
    await expect(s.wallPage.getByTestId('scene-home')).toBeVisible();
    await press(s.wallPage.getByTestId(`face-${s.nickname}`));
    await press(s.wallPage.getByTestId('room-bank'));
    await expect.poll(() => starsOnWall(s.wallPage)).toBe(before.available + s.stars);
    expect(walletOf(await snapshot(s.phone), s.profileId).available).toBe(before.available + s.stars);
  });

  test('Not yet, with kind words: back on the board, no stars lost', async () => {
    const before = walletOf(await snapshot(s.phone), s.profileId);
    await finishOnWall(s);

    await s.phonePage.goto('/parent');
    const waiting = s.phonePage.getByTestId('inbox').getByTestId(`waiting-${s.title}`);
    await expect(waiting).toBeVisible({ timeout: 6_000 });
    await s.phonePage.getByRole('button', { name: `Not yet: ${s.title}` }).click();
    const reasons = s.phonePage.getByRole('dialog', { name: 'Not yet' });
    await expect(reasons).toBeVisible();
    const firstReason = reasons.locator('[class*="sheetBody"] button').first();
    const reasonWords = (await firstReason.textContent())!.trim();
    expect(reasonWords.length, 'the reason is a kind sentence').toBeGreaterThan(5);
    await firstReason.click();
    await expect(reasons).toHaveCount(0);
    await expect(waiting).toHaveCount(0);

    const card = s.wallPage.getByTestId('scene-quest').getByTestId(`mission-${s.title}`);
    await expect(card, 'back on the board for another go').toHaveAttribute('data-state', 'again', {
      timeout: 8_000,
    });
    await press(card);
    const sheet = s.wallPage.getByTestId('mission-sheet');
    await expect(sheet.getByText(reasonWords), 'the kind words are on the wall too').toBeVisible();
    await expect(sheet.getByTestId('did-it'), 'and it can be finished again').toBeVisible();

    const after = await snapshot(s.phone);
    expect(after.occurrences.find((occurrence) => occurrence.id === s.missionId)!.status).toBe('returned');
    expect(walletOf(after, s.profileId)).toEqual(before);
  });
});
