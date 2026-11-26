import { expect, test } from '@playwright/test';
import { enter, openWall, press, resetDemo } from './support/demo';

/**
 * Tock's first-visit tour: shown on a fresh screen, ended by the first tap (which still does what it does),
 * not shown again after a reload, and never at night.
 */

test.describe('the first-visit tour', { tag: '@w1080' }, () => {
  test.beforeAll(async () => {
    await resetDemo();
  });

  test('appears on a fresh screen; the first tap on a face ends it and chooses that child; not again after a reload', async ({
    page,
    context,
  }) => {
    await enter(context, 'wall', { tour: true });
    await openWall(page, '16:30');
    const tour = page.getByTestId('tour');
    await expect(tour, 'the tour shows on a fresh screen').toBeVisible();
    await expect(page.getByTestId('guide-words')).toContainText('Tock');

    const june = page.getByTestId('face-June');
    await press(june);
    await expect(tour, 'the first tap ends it').toHaveCount(0);
    await expect(june, 'and the tap still chose the child').toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await expect(page.getByTestId('scene-home')).toBeVisible();
    await page.waitForTimeout(1_500);
    await expect(tour, 'not again after a reload').toHaveCount(0);
  });

  test('does not run in quiet hours', async ({ page, context }) => {
    await enter(context, 'wall', { tour: true });
    await openWall(page, '21:30');
    await page.waitForTimeout(1_500);
    await expect(page.getByTestId('tour')).toHaveCount(0);
  });
});
