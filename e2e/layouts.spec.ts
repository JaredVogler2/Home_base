import { expect, test } from '@playwright/test';
import { enter, openWall, resetDemo, settle } from './support/demo';

/**
 * Every screen shape: the house fits whatever screen it is on, with nothing cut off and nothing on top of
 * anything else; the grown-ups' pages never scroll sideways on a phone; a wide screen gets the side navigation.
 */

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const overlap = (a: Box, b: Box) =>
  a.x < b.x + b.width - 0.5 &&
  b.x < a.x + a.width - 0.5 &&
  a.y < b.y + b.height - 0.5 &&
  b.y < a.y + a.height - 0.5;

const PARENT_PAGES = [
  '/parent',
  '/parent/lists',
  '/parent/plan',
  '/parent/plan/routines',
  '/parent/plan/rewards',
  '/parent/history',
  '/parent/more',
  '/parent/more/children',
  '/parent/more/grownups',
  '/parent/more/screens',
  '/parent/more/wall',
  '/parent/more/rules',
  '/parent/more/household',
  '/parent/more/sky',
  '/parent/more/calendar',
  '/parent/more/photos',
  '/parent/more/academy',
  '/parent/more/shortcuts',
  '/parent/more/records',
  '/parent/more/helper',
  '/parent/more/connections',
];

test.describe('layouts', () => {
  test.beforeAll(async () => {
    await resetDemo();
  });

  test(
    'the wall home: six rooms, the boat, the attic window and the faces, all inside the screen and apart',
    { tag: ['@w1080', '@w720', '@tall', '@phone'] },
    async ({ page, context }) => {
      await enter(context, 'wall');
      await openWall(page, '10:30');
      await settle(page);
      const viewport = page.viewportSize()!;
      const ids = [
        'room-memories',
        'room-calendar',
        'room-quest',
        'room-routines',
        'room-bank',
        'room-pantry',
        'room-academy',
        'room-grownups',
        'face-June',
        'face-Milo',
        'face-Bea',
      ];
      const boxes: [string, Box][] = [];
      for (const id of ids) {
        const element = page.getByTestId(id);
        await expect(element, `${id} is drawn`).toBeVisible();
        const box = (await element.boundingBox())!;
        expect(box.x, `${id} starts inside the left edge`).toBeGreaterThanOrEqual(0);
        expect(box.y, `${id} starts inside the top edge`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, `${id} ends inside the right edge`).toBeLessThanOrEqual(
          viewport.width + 0.5,
        );
        expect(box.y + box.height, `${id} ends inside the bottom edge`).toBeLessThanOrEqual(
          viewport.height + 0.5,
        );
        boxes.push([id, box]);
      }
      const clashes: string[] = [];
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++)
          if (overlap(boxes[i]![1], boxes[j]![1])) clashes.push(`${boxes[i]![0]} × ${boxes[j]![0]}`);
      expect(clashes, 'nothing lies over anything else').toEqual([]);
      const scroll = await page.evaluate(() => ({
        x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      }));
      expect(scroll, 'the house never scrolls').toEqual({ x: 0, y: 0 });
    },
  );

  test('no grown-ups’ page scrolls sideways on a phone', { tag: '@phone' }, async ({ page, context }) => {
    await enter(context, 'guardian');
    const wide: string[] = [];
    await page.goto('/parent');
    await expect(page.getByRole('navigation', { name: 'Sections' })).toBeVisible();
    for (const path of PARENT_PAGES) {
      // Moving inside the app, as its own links do, rather than loading every page afresh.
      await page.evaluate((to) => {
        window.history.pushState(null, '', to);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, path);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.locator('main h1').first()).toBeVisible();
      await page.waitForTimeout(250);
      const sideways = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (sideways > 0) wide.push(`${path} (${sideways}px)`);
    }
    expect(wide, 'pages wider than the phone').toEqual([]);
  });

  test('a wide screen gets the side navigation', { tag: '@w720' }, async ({ page, context }) => {
    await enter(context, 'guardian');
    await page.goto('/parent');
    const nav = page.getByRole('navigation', { name: 'Sections' });
    await expect(nav).toBeVisible();
    const box = (await nav.boundingBox())!;
    expect(box.x, 'on the left').toBeLessThan(40);
    expect(box.height, 'taller than it is wide').toBeGreaterThan(box.width);
    const today = (await page.getByTestId('tab-today').boundingBox())!;
    const lists = (await page.getByTestId('tab-lists').boundingBox())!;
    expect(lists.y, 'the sections are stacked').toBeGreaterThan(today.y + today.height - 1);
    expect(Math.abs(lists.x - today.x)).toBeLessThan(2);
    const main = (await page.locator('main').boundingBox())!;
    expect(main.x, 'the page is beside the navigation').toBeGreaterThanOrEqual(box.x + box.width - 1);
  });
});
