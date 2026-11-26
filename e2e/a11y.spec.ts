import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { enter, openWall, press, resetDemo, settle } from './support/demo';

/**
 * Accessibility: axe on the front door, the pairing screen, the wall and its rooms, and the grown-ups' pages.
 * Serious and critical problems fail the test. Exclusions, if any are ever needed, go in EXCLUDE below with the
 * narrowest selector and the reason — and are reported.
 *
 * Also: a keyboard reaches every room of the house, Enter opens it, and there is a keyboard way home.
 */

/** Selectors left out of every scan, each with its reason. Kept empty unless something truly must be. */
const EXCLUDE: { selector: string; why: string }[] = [];

async function scan(page: Page, where: string): Promise<void> {
  await settle(page);
  // @axe-core/playwright is typed against its own copy of playwright-core; the page is the same thing at runtime.
  let builder = new AxeBuilder({ page } as unknown as ConstructorParameters<typeof AxeBuilder>[0]).withTags([
    'wcag2a',
    'wcag2aa',
    'wcag21a',
    'wcag21aa',
    'best-practice',
  ]);
  for (const { selector } of EXCLUDE) builder = builder.exclude(selector);
  const result = await builder.analyze();
  const bad = result.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map(
      (violation) =>
        `${violation.impact} ${violation.id}: ${violation.help}\n    ${violation.nodes
          .slice(0, 4)
          .map((node) => `${node.target.join(' ')} — ${node.any[0]?.message ?? node.failureSummary ?? ''}`)
          .join('\n    ')}`,
    );
  // Soft, so that one run lists every page's problems rather than stopping at the first.
  expect.soft(bad, `serious or critical accessibility problems on ${where}`).toEqual([]);
}

test.describe('accessibility: the wall', { tag: '@w1080' }, () => {
  test.beforeAll(async () => {
    await resetDemo();
  });

  test('front door and pairing screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('go-wall')).toBeVisible();
    await scan(page, 'the front door');
    await page.goto('/wall?at=16:30');
    await expect(page.getByTestId('pair-code')).toBeVisible({ timeout: 10_000 });
    await scan(page, 'the pairing screen');
  });

  test('wall home and three rooms', async ({ page, context }) => {
    await enter(context, 'wall');
    await openWall(page, '16:30');
    await scan(page, 'the wall home');
    await press(page.getByTestId('face-June'));
    for (const room of ['quest', 'bank', 'pantry']) {
      await press(page.getByTestId(`room-${room}`));
      await expect(page.getByTestId(`scene-${room}`)).toBeVisible();
      await scan(page, `the ${room} room`);
      await press(page.getByTestId(`scene-${room}`).getByTestId('go-home'));
      await expect(page.getByTestId(`scene-${room}`)).toHaveCount(0);
    }
    await press(page.getByTestId('room-quest'));
    await press(page.getByTestId('scene-quest').locator('[data-testid^="mission-"]').first());
    await expect(page.getByTestId('mission-sheet')).toBeVisible();
    await scan(page, 'an open mission');
  });

  test('a keyboard reaches every room, Enter opens it, and the home button brings it back', async ({
    page,
    context,
  }) => {
    await enter(context, 'wall');
    await openWall(page, '16:30');
    const rooms = ['memories', 'calendar', 'quest', 'routines', 'bank', 'pantry', 'academy', 'grownups'];
    const reached = new Set<string>();
    for (let i = 0; i < 40 && reached.size < rooms.length; i++) {
      await page.keyboard.press('Tab');
      const id = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? '');
      if (id.startsWith('room-')) reached.add(id.slice(5));
    }
    expect([...reached].sort(), 'Tab reaches every room').toEqual([...rooms].sort());

    for (const room of ['quest', 'bank', 'calendar']) {
      await page.getByTestId(`room-${room}`).focus();
      await page.keyboard.press('Enter');
      const scene = page.getByTestId(`scene-${room}`);
      await expect(scene, `Enter opens ${room}`).toBeVisible();
      // Tab on until the home button has the focus, then Enter.
      let onHome = false;
      for (let i = 0; i < 60 && !onHome; i++) {
        await page.keyboard.press('Tab');
        onHome = await scene.getByTestId('go-home').evaluate((button) => button === document.activeElement);
      }
      expect(onHome, `Tab reaches the home button in ${room}`).toBe(true);
      await page.keyboard.press('Enter');
      await expect(scene).toHaveCount(0);
      await expect(page.getByTestId('scene-home')).toBeVisible();
    }
  });

  test('Escape takes a keyboard user from a room back home', async ({ page, context }) => {
    await enter(context, 'wall');
    await openWall(page, '16:30');
    await page.getByTestId('room-calendar').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('scene-calendar')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('scene-calendar'), 'Escape leaves the room').toHaveCount(0, {
      timeout: 3_000,
    });
  });
});

test.describe('accessibility: the grown-ups’ side', { tag: '@phone' }, () => {
  test.beforeAll(async () => {
    await resetDemo();
  });

  test('sign-in', async ({ page }) => {
    await page.goto('/parent');
    await expect(page.getByTestId('auth-submit')).toBeVisible();
    await scan(page, 'the sign-in page');
  });

  test('Today, To buy, Plan with the mission editor, History, Family and a settings page', async ({
    page,
    context,
  }) => {
    await enter(context, 'guardian');
    const pages: [string, string, string][] = [
      ['/parent', 'Today', 'Today'],
      ['/parent/lists', 'To buy', 'To buy'],
      ['/parent/history', 'History', 'History'],
      ['/parent/more', 'Family', 'Family'],
      ['/parent/more/wall', 'The wall', 'the wall settings page'],
    ];
    for (const [path, heading, where] of pages) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await page.waitForTimeout(400);
      await scan(page, where);
    }
    await page.goto('/parent/plan');
    await expect(page.getByRole('heading', { level: 1, name: 'Plan' })).toBeVisible();
    await scan(page, 'Plan');
    await page.locator('[data-testid^="template-"]').first().click();
    await expect(page.getByTestId('mission-editor')).toBeVisible();
    await scan(page, 'Plan with the mission editor open');
  });
});
