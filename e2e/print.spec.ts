import { expect, test } from '@playwright/test';
import { enter } from './support/demo';

/**
 * A routine on paper, for the bathroom mirror: the same pictures in the same order, a ring to tick for each
 * day, and nothing else on the sheet — not the app's own buttons, and not the family's name.
 */
test.describe('a routine to print', { tag: '@phone' }, () => {
  test('shows the routine’s steps as a sheet; on paper only the sheet is there; Escape puts it away', async ({
    page,
    context,
  }) => {
    await enter(context, 'guardian');
    await page.goto('/parent/plan/routines');
    await page.getByTestId('routine-Morning').click();
    const editor = page.getByTestId('routine-editor');
    await expect(editor).toBeVisible();
    await page.getByTestId('print-routine-open').click();

    const sheet = page.getByTestId('print-routine');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('heading', { level: 1 })).toHaveText('Morning');
    const steps = sheet.locator('ol > li');
    expect(await steps.count()).toBeGreaterThanOrEqual(3);
    // Every step has its picture and seven rings, one for each day.
    for (const step of await steps.all()) {
      await expect(step.locator('svg').first()).toBeVisible();
      expect(await step.locator('[class*="ring"]').count()).toBeGreaterThanOrEqual(7);
    }
    // The sheet says nothing about who the family is.
    await expect(sheet).not.toContainText('Maple Street');

    // On paper: the buttons are gone, and so is everything behind the sheet.
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByTestId('print-now')).toBeHidden();
    const behind = await page.evaluate(() =>
      [...document.body.children]
        .filter((element) => !element.classList.contains('print-sheet'))
        .map((element) => getComputedStyle(element).display),
    );
    expect(behind.every((display) => display === 'none')).toBe(true);
    await expect(steps.first()).toBeVisible();

    // Back on the screen, Escape puts the paper away and the editor is still there, as it was.
    await page.emulateMedia({ media: 'screen' });
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(editor).toBeVisible();
  });
});
