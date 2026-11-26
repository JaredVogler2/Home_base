import { expect, test, type Page } from '@playwright/test';
import { enter, newScreen, openWall, resetDemo } from './support/demo';

/**
 * Stillness: a device that asks for less motion, a family that chooses calm, and quiet hours at night each
 * make the wall hold still — `data-motion="still"` on the root, and nothing animating.
 */

async function running(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => animation.playState === 'running')
      .map((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target as Element | null;
        const name =
          (animation as CSSAnimation).animationName ?? (animation as CSSTransition).transitionProperty;
        return `${name ?? 'animation'} on ${target?.tagName.toLowerCase() ?? '?'}.${target?.getAttribute('class') ?? ''}`;
      }),
  );
}

async function holdsStill(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'still', { timeout: 8_000 });
  await page.waitForTimeout(1_000);
  expect(await running(page), 'nothing is animating').toEqual([]);
}

test.describe('the wall holds still', { tag: '@w1080' }, () => {
  test.beforeEach(async () => {
    await resetDemo();
  });

  test.describe('on a device that asks for less motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('reduced motion: still, and nothing running after a second', async ({ page, context }) => {
      await enter(context, 'wall');
      await openWall(page, '10:30');
      await holdsStill(page);
    });
  });

  test('calm mode, switched on by a parent, makes the wall still within a few seconds', async ({
    page,
    context,
    browser,
  }) => {
    await enter(context, 'wall');
    await openWall(page, '10:30');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
    await expect
      .poll(async () => (await running(page)).length, { message: 'the house moves at first' })
      .toBeGreaterThan(0);

    const phone = await newScreen(browser, 'phone');
    await enter(phone, 'guardian');
    const parent = await phone.newPage();
    await parent.goto('/parent');
    await parent.getByTestId('tab-more').click();
    await parent.getByTestId('more-wall').click();
    const calm = parent.getByTestId('set-calm');
    await expect(calm).toHaveAttribute('aria-checked', 'false');
    await calm.click();
    await expect(calm).toHaveAttribute('aria-checked', 'true');
    await expect(parent.getByTestId('sync-state')).toHaveText(/Up to date/, { timeout: 8_000 });

    await holdsStill(page);
    await phone.close();
  });

  test('a wall nobody can see holds its animations, and picks them up again when it is back', async ({
    page,
    context,
  }) => {
    await enter(context, 'wall');
    await openWall(page, '10:30');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
    await expect
      .poll(async () => (await running(page)).length, { message: 'the house moves at first' })
      .toBeGreaterThan(0);

    // The display's screen saver comes over the page: the browser says the page is hidden.
    const show = (state: 'hidden' | 'visible') =>
      page.evaluate((value) => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
        document.dispatchEvent(new Event('visibilitychange'));
      }, state);
    await show('hidden');
    await expect(page.locator('html')).toHaveAttribute('data-hidden', 'true');
    await expect.poll(async () => running(page), { message: 'nothing runs while hidden' }).toEqual([]);

    await show('visible');
    await expect(page.locator('html')).not.toHaveAttribute('data-hidden', 'true');
    await expect
      .poll(async () => (await running(page)).length, { message: 'the house moves again' })
      .toBeGreaterThan(0);
  });

  test('in quiet hours the wall is dimmed and still', async ({ page, context }) => {
    await enter(context, 'wall');
    await openWall(page, '21:30');
    await expect(page.getByTestId('night'), 'the wall is dimmed').toBeVisible();
    await holdsStill(page);
  });
});
