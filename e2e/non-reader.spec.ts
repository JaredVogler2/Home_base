import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  enter,
  openWall,
  press,
  resetDemo,
  settle,
  snapshot,
  starPicturesOnTrays,
  walletOf,
} from './support/demo';

/**
 * THE acceptance test: a child who cannot read can choose themselves, find their missions, see their stars, go
 * to the Academy, come home and ask for a reward — with pictures and taps alone.
 *
 * Everything is found the way a child finds it: a picture (by its test id) or a button. Nothing on the screen
 * is read to decide what to do, nothing is typed, nothing is hovered or dragged. What the test knows about the
 * household it asks the server for, and only to check what the screen claims.
 */

const MIN_TARGET = 64;

test.describe('a non-reader on the wall', { tag: ['@w1080', '@w720'] }, () => {
  test.beforeAll(async () => {
    await resetDemo();
  });

  test.beforeEach(async ({ context }) => {
    await enter(context, 'wall');
  });

  /** Tap a control as a child would, checking it is named, big enough and needs nothing but a tap. */
  async function tapControl(page: Page, control: Locator, what: string, big: boolean): Promise<void> {
    await expect(control, `${what} is on the screen`).toBeVisible();
    await expect(control, `${what} has an accessible name`).toHaveAccessibleName(/\S/);
    if (big) {
      await settle(page);
      const box = await control.boundingBox();
      expect(box, `${what} has a size`).not.toBeNull();
      expect(box!.width, `${what} is at least ${MIN_TARGET}px wide`).toBeGreaterThanOrEqual(MIN_TARGET);
      expect(box!.height, `${what} is at least ${MIN_TARGET}px tall`).toBeGreaterThanOrEqual(MIN_TARGET);
    }
    await press(control);
    await noTextEntry(page, what);
  }

  async function noTextEntry(page: Page, where: string): Promise<void> {
    const fields = page.locator(
      'input:visible, textarea:visible, select:visible, [contenteditable="true"]:visible',
    );
    expect(await fields.count(), `nothing to type after ${where}`).toBe(0);
  }

  async function homeIsThere(page: Page, scene: string, big: boolean): Promise<Locator> {
    const home = page.getByTestId(scene).getByTestId('go-home');
    await expect(home, `a way home in ${scene}`).toBeVisible();
    await expect(home).toHaveAccessibleName(/\S/);
    if (big) {
      await settle(page);
      const box = await home.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(MIN_TARGET);
      expect(box!.height).toBeGreaterThanOrEqual(MIN_TARGET);
    }
    return home;
  }

  async function goHome(page: Page, scene: string, big: boolean): Promise<void> {
    const home = await homeIsThere(page, scene, big);
    await tapControl(page, home, `the home button in ${scene}`, big);
    await expect(page.getByTestId(scene)).toHaveCount(0);
    await expect(page.getByTestId('scene-home')).toBeVisible();
  }

  test('select a profile, find chores, see the balance, enter the Academy, return home and request a reward using pictures alone', async ({
    page,
    context,
  }, testInfo) => {
    const big = testInfo.project.name === 'wall-1080';
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(String(error)));

    await openWall(page, '16:30');
    await noTextEntry(page, 'opening the house');

    // 1. Who is playing? The first face on the path.
    const face = page.locator('[data-testid^="face-"]').first();
    await tapControl(page, face, 'a face on the path', big);
    await expect(face).toHaveAttribute('aria-pressed', 'true');
    const faceId = (await face.getAttribute('data-testid'))!;
    const before = await snapshot(context);
    const child = before.profiles.find((profile) => `face-${profile.nickname}` === faceId)!;
    expect(child, 'the face belongs to a child of the family').toBeTruthy();

    // 2. The mission board.
    await tapControl(page, page.getByTestId('room-quest'), 'the missions room', big);
    const quest = page.getByTestId('scene-quest');
    await expect(quest).toBeVisible();
    await homeIsThere(page, 'scene-quest', big);
    const card = quest.locator('[data-testid^="mission-"][data-state="todo"]').first();
    await expect(card, 'a mission still to do is pinned to the board').toBeVisible();
    const cardId = (await card.getAttribute('data-testid'))!;
    const mission = before.occurrences.find(
      (occurrence) =>
        `mission-${occurrence.title}` === cardId &&
        occurrence.date === before.today &&
        (occurrence.profileId === child.id || occurrence.profileId === null),
    )!;
    expect(mission, 'the card is one of the child’s missions today').toBeTruthy();

    // 3. A tap on the picture shows the doing, and there is one big "done".
    await tapControl(page, card, 'a mission picture', big);
    const sheet = page.getByTestId('mission-sheet');
    await expect(sheet).toBeVisible();
    await expect(
      sheet.locator('svg.pic[data-play="true"]').first(),
      'the picture shows the doing',
    ).toBeVisible();
    await expect(sheet.getByTestId('did-it'), 'one "done" control').toHaveCount(1);
    // Let the "started" note reach the server before holding the next request back.
    await expect(page.getByTestId('status')).toHaveCount(0, { timeout: 10_000 });

    // 4. "I did it", while the server is slow to answer: the screen may say "sent", never "paid".
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => (release = resolve));
    const passed: Promise<void>[] = [];
    await page.route('**/api/sync/ops', (route) => {
      const done = held.then(() => route.continue());
      passed.push(done);
      return done;
    });
    await tapControl(page, sheet.getByTestId('did-it'), 'the "I did it" button', big);
    await expect(sheet.getByTestId('mission-sent'), 'shown as sent at once').toBeVisible();
    await expect(sheet.getByTestId('mission-done')).toHaveCount(0);
    expect(
      await sheet.locator('svg[data-on="true"]').count(),
      'no stars are shown as given before the server gives them',
    ).toBe(0);
    release();
    await Promise.all(passed);
    await page.unroute('**/api/sync/ops');

    if (mission.verification === 'auto') {
      await expect(sheet.getByTestId('mission-done'), 'done once the server has said so').toBeVisible({
        timeout: 10_000,
      });
      const after = await snapshot(context);
      const server = after.occurrences.find((occurrence) => occurrence.id === mission.id)!;
      expect(server.status).toBe('approved');
      expect(server.credited).toBe(true);
      expect(await sheet.locator('svg[data-on="true"]').count()).toBe(mission.stars);
    } else {
      await expect(page.getByTestId('status')).toHaveCount(0, { timeout: 10_000 });
      await expect(sheet.getByTestId('mission-sent'), 'still waiting for a grown-up').toBeVisible();
      expect(await sheet.locator('svg[data-on="true"]').count()).toBe(0);
    }
    await tapControl(page, sheet.getByTestId('sheet-close'), 'the sheet’s back button', big);
    await expect(sheet).toHaveCount(0);
    // On the board it shows as done or sent — unless finishing it pushed it off a board that holds only a few
    // cards (done ones go last). That is noted rather than failed: the sheet above already said so plainly.
    const onBoard = quest.getByTestId(cardId);
    if ((await onBoard.count()) > 0) {
      await expect(onBoard).toHaveAttribute('data-state', mission.verification === 'auto' ? 'done' : 'sent');
    } else {
      testInfo.annotations.push({
        type: 'rough edge',
        description: `"${mission.title}" left the board once finished: more missions to do than the board shows`,
      });
    }

    // 5. Home, then the bank: stars as things to count.
    await goHome(page, 'scene-quest', big);
    await tapControl(page, page.getByTestId('room-bank'), 'the stars room', big);
    await expect(page.getByTestId('scene-bank')).toBeVisible();
    await homeIsThere(page, 'scene-bank', big);
    const wallet = walletOf(await snapshot(context), child.id);
    await expect(page.getByTestId('star-trays')).toHaveAttribute('data-stars', String(wallet.available));
    expect(await starPicturesOnTrays(page), 'one star picture for each star').toBe(
      Math.min(wallet.available, 50),
    );

    // 6. The Academy: one tap sails, and the boat goes nowhere real in this test.
    await goHome(page, 'scene-bank', big);
    await tapControl(page, page.getByTestId('room-academy'), 'the Academy boat', big);
    const jetty = page.getByTestId('scene-academy');
    await expect(jetty).toBeVisible();
    await homeIsThere(page, 'scene-academy', big);
    const academyUrl = before.household.settings.academy.url!;
    expect(academyUrl).toMatch(/^https:\/\//);
    const sailedTo: string[] = [];
    await context.route(`${new URL(academyUrl).origin}/**`, async (route) => {
      sailedTo.push(route.request().url());
      // "No content": the browser stays where it is, and nothing leaves this machine.
      await route.fulfill({ status: 204, body: '' });
    });
    const sail = jetty.getByTestId('sail-button');
    await tapControl(page, sail, 'the sail button', big);
    await expect.poll(() => sailedTo.length, { timeout: 5_000 }).toBe(1);
    expect(sailedTo[0], 'the boat goes to the Academy and takes nothing about the child with it').toBe(
      academyUrl,
    );
    await context.unroute(`${new URL(academyUrl).origin}/**`);
    await expect(jetty).toBeVisible();

    // 7. Home again, and ask for a reward the child can afford.
    await goHome(page, 'scene-academy', big);
    await tapControl(page, page.getByTestId('room-bank'), 'the stars room', big);
    const bank = page.getByTestId('scene-bank');
    const reward = bank.locator('[data-testid^="reward-"][data-can="true"]').first();
    await expect(reward, 'a reward the child has enough stars for').toBeVisible();
    const rewardId = (await reward.getAttribute('data-testid'))!;
    const title = rewardId.replace(/^reward-/, '');
    await tapControl(page, reward, 'a reward picture', big);
    const rewardSheet = page.getByTestId('reward-sheet');
    await expect(rewardSheet).toBeVisible();
    await tapControl(page, rewardSheet.getByTestId('ask-for-it'), 'the "ask for it" button', big);
    await expect(rewardSheet).toHaveCount(0);
    const asked = bank.getByTestId(`asked-${title}`);
    await expect(asked, 'the reward shows as waiting').toBeVisible();
    await expect(asked).toHaveAttribute('data-status', 'requested');
    await expect
      .poll(async () =>
        (await snapshot(context)).redemptions.some(
          (redemption) =>
            redemption.profileId === child.id &&
            redemption.title === title &&
            redemption.status === 'requested',
        ),
      )
      .toBe(true);

    // 8. And home.
    await goHome(page, 'scene-bank', big);
    expect(problems, 'no errors on the page').toEqual([]);
  });

  test('every room has the same way home, and the photos go home at a touch', async ({ page }, testInfo) => {
    const big = testInfo.project.name === 'wall-1080';
    await openWall(page, '16:30');
    await press(page.getByTestId(`face-June`));
    for (const room of ['quest', 'bank', 'routines', 'pantry', 'calendar', 'academy', 'grownups']) {
      await tapControl(page, page.getByTestId(`room-${room}`), `the ${room} room`, big);
      await expect(page.getByTestId(`scene-${room}`)).toBeVisible();
      await goHome(page, `scene-${room}`, big);
    }
    await tapControl(page, page.getByTestId('room-memories'), 'the photos room', big);
    const photos = page.getByTestId('scene-memories');
    await expect(photos).toBeVisible();
    await expect(photos).toHaveAccessibleName(/\S/);
    await press(photos);
    await expect(photos).toHaveCount(0);
    await expect(page.getByTestId('scene-home')).toBeVisible();
  });
});
