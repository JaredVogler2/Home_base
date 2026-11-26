import { expect, test, type Page } from '@playwright/test';
import { enter, ledger, openWall, press, resetDemo, snapshot, walletOf, guardianApi } from './support/demo';

/**
 * Out of touch: a tap made with no signal is kept, said to be kept, survives a reload, and reaches the server
 * exactly once when the signal comes back.
 */

const BLOCK = '**/api/**';

async function openBoard(page: Page): Promise<void> {
  await press(page.getByTestId('face-June'));
  await press(page.getByTestId('room-quest'));
  await expect(page.getByTestId('scene-quest')).toBeVisible();
}

test.describe('the wall with no signal', { tag: '@w1080' }, () => {
  test.beforeEach(async ({ context }) => {
    await resetDemo();
    await enter(context, 'wall');
  });

  test('a mission finished offline is kept, survives a reload, and is sent exactly once', async ({
    page,
    context,
  }) => {
    await openWall(page, '16:30');
    await openBoard(page);
    await expect(page.getByTestId('status')).toHaveCount(0, { timeout: 10_000 });
    const before = await snapshot(context);
    const card = page
      .getByTestId('scene-quest')
      .locator('[data-testid^="mission-"][data-state="todo"]')
      .first();
    const cardId = (await card.getAttribute('data-testid'))!;
    const mission = before.occurrences.find(
      (occurrence) =>
        `mission-${occurrence.title}` === cardId &&
        occurrence.date === before.today &&
        occurrence.profileId === before.profiles.find((p) => p.nickname === 'June')!.id,
    )!;
    const wallet = walletOf(before, mission.profileId!);

    // No signal. Finish the mission.
    await context.setOffline(true);
    await press(page.getByTestId('scene-quest').getByTestId(cardId));
    const sheet = page.getByTestId('mission-sheet');
    await press(sheet.getByTestId('did-it'));
    await expect(sheet.getByTestId('mission-sent')).toBeVisible();
    const cloud = page.getByTestId('status');
    await expect(cloud).toHaveAttribute('data-state', 'offline', { timeout: 10_000 });
    await expect(cloud, 'says it is out of touch and the tap is kept').toContainText(/out of touch/i);
    await expect(cloud).toContainText(/kept/i);
    await press(sheet.getByTestId('sheet-close'));

    // Reload with the server out of reach. (The page itself comes from the dev server here; the true offline
    // reload, which needs the service worker of a production build, is the next test.)
    await page.route(BLOCK, (route) => route.abort('internetdisconnected'));
    await context.setOffline(false);
    await page.reload();
    await expect(page.getByTestId('scene-home'), 'the house draws from what it kept').toBeVisible({
      timeout: 10_000,
    });
    await expect(cloud).toHaveAttribute('data-state', 'offline', { timeout: 10_000 });
    await expect(cloud).toContainText(/kept/i);
    await openBoard(page);
    await expect(page.getByTestId('scene-quest').getByTestId(cardId), 'still shown as sent').toHaveAttribute(
      'data-state',
      'sent',
    );
    expect((await snapshot(context)).occurrences.find((o) => o.id === mission.id)!.status).toBe(
      before.occurrences.find((o) => o.id === mission.id)!.status,
    );

    // Signal again.
    await context.setOffline(true);
    await page.unroute(BLOCK);
    await context.setOffline(false);
    await expect(cloud, 'the cloud goes within a few seconds').toHaveCount(0, { timeout: 8_000 });

    const after = await snapshot(context);
    const server = after.occurrences.find((occurrence) => occurrence.id === mission.id)!;
    expect(server.status).toBe(mission.verification === 'auto' ? 'approved' : 'submitted');
    const gained = mission.verification === 'auto' ? mission.stars : 0;
    expect(walletOf(after, mission.profileId!).available, 'the stars, once').toBe(wallet.available + gained);
    const api = await guardianApi();
    const lines = (await ledger(api, mission.profileId!)).filter((entry) => entry.sourceId === mission.id);
    expect(lines.length, 'one line in the record of stars, not two').toBe(gained > 0 ? 1 : 0);
    await api.dispose();
    // A further reload sends nothing again.
    await page.reload();
    await expect(page.getByTestId('scene-home')).toBeVisible();
    await expect(cloud).toHaveCount(0, { timeout: 8_000 });
    expect(walletOf(await snapshot(context), mission.profileId!).available).toBe(wallet.available + gained);
  });

  test('a reload with no signal at all still draws the house, with the mission still sent', async ({
    page,
    context,
  }) => {
    await openWall(page, '16:30');
    const worker = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const ready = await Promise.race([
        navigator.serviceWorker.ready.then(() => true),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3_000)),
      ]);
      return ready;
    });
    test.skip(
      !worker,
      'No service worker under the Vite dev server (src/app/register-sw.ts registers it only in a production build). Run with E2E_SERVER=production.',
    );
    // The worker controls the page from its next load.
    await page.reload();
    await expect(page.getByTestId('scene-home')).toBeVisible();
    await openBoard(page);
    await expect(page.getByTestId('status')).toHaveCount(0, { timeout: 10_000 });
    const card = page
      .getByTestId('scene-quest')
      .locator('[data-testid^="mission-"][data-state="todo"]')
      .first();
    const cardId = (await card.getAttribute('data-testid'))!;

    await context.setOffline(true);
    await press(card);
    await press(page.getByTestId('mission-sheet').getByTestId('did-it'));
    await expect(page.getByTestId('mission-sheet').getByTestId('mission-sent')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('scene-home'), 'the house draws with no signal').toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId('status')).toContainText(/kept/i);
    await openBoard(page);
    await expect(page.getByTestId('scene-quest').getByTestId(cardId)).toHaveAttribute('data-state', 'sent');
    await context.setOffline(false);
    await expect(page.getByTestId('status')).toHaveCount(0, { timeout: 8_000 });
  });
});
