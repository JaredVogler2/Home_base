import { expect, test } from '@playwright/test';
import { enter, newScreen, resetDemo, snapshot } from './support/demo';

/**
 * Pairing a screen: a fresh browser shows a code, a parent claims it, the screen becomes the house by itself,
 * and switching it off from the phone sends it back to a code.
 */

test.describe('pairing a wall', { tag: '@w1080' }, () => {
  test.beforeAll(async () => {
    await resetDemo();
  });

  test('a fresh wall shows a code, a parent claims it, the wall becomes the house, and switching it off brings the code back', async ({
    browser,
  }) => {
    const wall = await newScreen(browser, 'wall');
    const phone = await newScreen(browser, 'phone');
    await enter(phone, 'guardian');
    const wallPage = await wall.newPage();
    const phonePage = await phone.newPage();

    // Pinned to the afternoon: at night (quiet hours) a wall asks the server for news only every few minutes.
    await wallPage.goto('/wall?at=16:30');
    const shown = wallPage.getByTestId('pair-code');
    await expect(shown).toBeVisible({ timeout: 10_000 });
    const code = (await shown.textContent())!.trim();
    expect(code).toMatch(/^[A-Z0-9-]{6,12}$/);

    // The link in the square code: it lands on the Screens page with the code filled in.
    await phonePage.goto(`/pair?code=${encodeURIComponent(code)}`);
    await expect(phonePage).toHaveURL(/\/parent\/more\/screens/);
    const input = phonePage.getByTestId('pair-code-input');
    await expect(input).toHaveValue(code);
    await phonePage.getByTestId('pair-name').fill('Hall screen');
    await phonePage.getByTestId('pair-claim').click();
    await expect(phonePage.getByText('The screen will come to life in a few seconds.')).toBeVisible();

    // The wall becomes the house by itself.
    await expect(wallPage.getByTestId('scene-home'), 'the house appears within about 6 seconds').toBeVisible({
      timeout: 7_000,
    });
    const device = (await snapshot(phone)).devices?.find((candidate) => candidate.name === 'Hall screen');
    expect(device, 'the phone knows the new screen').toBeTruthy();

    // On a paired wall, the grown-ups' side says this is a wall.
    const second = await wall.newPage();
    await second.goto('/parent');
    await expect(second.getByRole('heading', { name: 'This screen is set up as a wall' })).toBeVisible();
    await second.close();
    // Back to the wall's own tab: a page that cannot be seen does not ask the server for news.
    await wallPage.bringToFront();
    expect(await wallPage.evaluate(() => document.visibilityState)).toBe('visible');

    // Switched off from the phone: the wall goes back to a code.
    const row = phonePage.getByTestId('device-Hall screen');
    await expect(row).toBeVisible({ timeout: 6_000 });
    await row.click();
    await phonePage.getByTestId('revoke-device').click();
    await phonePage.getByTestId('revoke-device-confirm').click();
    await expect(wallPage.getByTestId('pair-code'), 'a code again within about 8 seconds').toBeVisible({
      timeout: 9_000,
    });
    await expect(wallPage.getByTestId('scene-home')).toHaveCount(0);

    await wall.close();
    await phone.close();
  });

  test('a wrong code is refused with a sentence', async ({ browser }) => {
    const phone = await newScreen(browser, 'phone');
    await enter(phone, 'guardian');
    const page = await phone.newPage();
    await page.goto('/parent/more/screens');
    await page.getByTestId('pair-code-input').fill('ZZZZ-ZZZZ');
    await page.getByTestId('pair-claim').click();
    const problem = page.getByRole('alert');
    await expect(problem).toBeVisible();
    await expect(problem).toHaveText(/^[A-Z][^]*[.!]$/);
    await expect(page.getByTestId('pair-claim')).toBeVisible();
    await phone.close();
  });
});
