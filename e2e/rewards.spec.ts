import { expect, test, type Page } from '@playwright/test';
import type { Snapshot } from '../shared/model';
import { DEMO, enter, newScreen, openWall, press, resetDemo, snapshot, walletOf } from './support/demo';

/**
 * Rewards: a child asks on the wall and the stars are set aside; a grown-up says yes and later "we did it"; a
 * second request is declined and the stars come straight back. The totals are checked with the server and on
 * the parent's record of the child's stars.
 */

/** The cheapest reward June can afford that nobody is already waiting for (so its rows are unambiguous). */
function affordable(snap: Snapshot): { title: string; price: number } {
  const stars = walletOf(snap, DEMO.june).available;
  const waiting = new Set(
    snap.redemptions.filter((r) => r.status === 'requested' || r.status === 'approved').map((r) => r.title),
  );
  const reward = [...snap.rewards]
    .filter((candidate) => candidate.status === 'active' && (candidate.stock === null || candidate.stock > 0))
    .filter((candidate) => candidate.profiles.length === 0 || candidate.profiles.includes(DEMO.june))
    .sort((a, b) => a.price - b.price)
    .find((candidate) => candidate.price <= stars && !waiting.has(candidate.title));
  if (!reward) throw new Error(`June cannot afford anything with ${stars} stars`);
  return { title: reward.title, price: reward.price };
}

async function askOnWall(page: Page, title: string): Promise<void> {
  const bank = page.getByTestId('scene-bank');
  await press(bank.getByTestId(`reward-${title}`));
  await press(page.getByTestId('reward-sheet').getByTestId('ask-for-it'));
  // The same reward can be on the shelf twice for a moment: one just agreed to ("Yes!", until the wall next hears
  // from the server that it was handed over) and the one asked for now. It is the new one that is looked for.
  await expect(bank.locator(`[data-testid="asked-${title}"][data-status="requested"]`)).toBeVisible();
}

test.describe('rewards between the wall and a phone', { tag: '@w1080' }, () => {
  test.beforeAll(async () => {
    await resetDemo();
  });

  test('asked for, said yes to, done — and a second one declined gives the stars straight back', async ({
    browser,
  }) => {
    const wall = await newScreen(browser, 'wall');
    const phone = await newScreen(browser, 'phone');
    await enter(wall, 'wall');
    await enter(phone, 'guardian');
    const wallPage = await wall.newPage();
    const phonePage = await phone.newPage();

    const start = await snapshot(phone);
    const startWallet = walletOf(start, DEMO.june);
    const first = affordable(start);

    // The child asks: the stars are set aside, not spent.
    await openWall(wallPage, '16:30');
    await press(wallPage.getByTestId('face-June'));
    await press(wallPage.getByTestId('room-bank'));
    await askOnWall(wallPage, first.title);
    await expect
      .poll(async () => {
        const wallet = walletOf(await snapshot(phone), DEMO.june);
        return [wallet.available, wallet.reserved];
      })
      .toEqual([startWallet.available - first.price, startWallet.reserved + first.price]);
    await expect(wallPage.getByTestId('star-trays')).toHaveAttribute(
      'data-stars',
      String(startWallet.available - first.price),
    );

    // The grown-up says yes, then "we did it".
    await phonePage.goto('/parent');
    const yes = phonePage.getByTestId(`reward-yes-${first.title}`);
    await expect(yes).toBeVisible({ timeout: 6_000 });
    await yes.click();
    const didIt = phonePage.getByTestId(`reward-done-${first.title}`);
    await expect(didIt).toBeVisible();
    await expect(wallPage.getByTestId(`asked-${first.title}`)).toHaveAttribute('data-status', 'approved', {
      timeout: 8_000,
    });
    await didIt.click();
    await expect(didIt).toHaveCount(0);
    await expect
      .poll(async () => {
        const snap = await snapshot(phone);
        const wallet = walletOf(snap, DEMO.june);
        const redemption = snap.redemptions.find((r) => r.title === first.title && r.profileId === DEMO.june);
        return [wallet.available, wallet.reserved, redemption?.status ?? 'gone'];
      })
      .toEqual([startWallet.available - first.price, startWallet.reserved, 'fulfilled']);

    // The record of June's stars on the parent's phone says the same.
    await phonePage.goto('/parent/more/children');
    await phonePage.getByTestId('child-row-June').click();
    await phonePage.getByTestId('open-ledger').click();
    const ledgerSheet = phonePage.getByTestId('ledger-sheet');
    await expect(ledgerSheet).toBeVisible();
    const tiles = ledgerSheet.locator('[class*="tiles"] > *');
    await expect(tiles.nth(0)).toHaveText(`${startWallet.available - first.price}to spend`);
    await expect(tiles.nth(1)).toHaveText(`${startWallet.reserved}set aside`);
    await expect(ledgerSheet.locator('tbody tr').first()).toContainText(/A reward/);
    await phonePage.getByTestId('sheet-x').click();

    // A second request, declined: the stars come straight back.
    const middle = await snapshot(phone);
    const middleWallet = walletOf(middle, DEMO.june);
    const second = affordable(middle);
    await askOnWall(wallPage, second.title);
    await expect
      .poll(async () => walletOf(await snapshot(phone), DEMO.june).reserved)
      .toBe(middleWallet.reserved + second.price);

    await phonePage.goto('/parent');
    const row = phonePage.getByTestId(`asked-${second.title}`);
    await expect(row).toBeVisible({ timeout: 6_000 });
    await row.locator('xpath=ancestor::li[1]').getByRole('button', { name: 'Not now' }).click();
    const reasons = phonePage.getByRole('dialog', { name: 'Not this time' });
    await expect(reasons).toBeVisible();
    await reasons.locator('[class*="sheetBody"] button').first().click();
    await expect(row).toHaveCount(0);

    await expect
      .poll(async () => {
        const snap = await snapshot(phone);
        const wallet = walletOf(snap, DEMO.june);
        const redemption = snap.redemptions.find(
          (r) => r.title === second.title && r.profileId === DEMO.june && r.status !== 'fulfilled',
        );
        return [wallet.available, wallet.reserved, redemption?.status ?? 'gone'];
      })
      .toEqual([middleWallet.available, middleWallet.reserved, 'declined']);
    const declined = wallPage.getByTestId('scene-bank').getByTestId(`asked-${second.title}`);
    await expect(declined, 'the wall says no, kindly').toHaveAttribute('data-status', 'declined', {
      timeout: 8_000,
    });
    await expect(wallPage.getByTestId('star-trays')).toHaveAttribute(
      'data-stars',
      String(middleWallet.available),
    );

    await wall.close();
    await phone.close();
  });
});
