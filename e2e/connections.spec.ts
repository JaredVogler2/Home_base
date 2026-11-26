import { expect, test } from '@playwright/test';
import { enter, newScreen, resetDemo } from './support/demo';

/**
 * Connections: one page that says how each thing HOMEBASE talks to is doing, and keeps a short account of what
 * has happened — a screen added, a request turned down — in fixed words, with nothing a family typed in it.
 */

test.describe('connections', { tag: '@phone' }, () => {
  test.beforeAll(async () => {
    await resetDemo();
  });

  test('says what is off without alarm, counts the screens’ requests, and keeps what happened', async ({
    page,
    context,
    browser,
  }) => {
    await enter(context, 'guardian');
    // The wall asks for something only a parent may do. (A real wall never does; this is a screen misbehaving.)
    const wall = await newScreen(browser, 'wall');
    await enter(wall, 'wall');
    const refused = await wall.request.post('/api/sync/ops', {
      data: {
        ops: [
          {
            id: crypto.randomUUID(),
            type: 'household.rename',
            at: new Date().toISOString(),
            input: { name: 'Not ours to change', timeZone: 'UTC' },
          },
        ],
      },
    });
    expect(refused.ok()).toBe(true);
    expect(JSON.stringify(await refused.json())).toContain('forbidden');
    await wall.close();

    await page.goto('/parent/more');
    await page.getByTestId('more-connections').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Connections' })).toBeVisible();

    // In the demo nothing outside is switched on, and that is said plainly, not as a fault.
    const now = page.getByTestId('connections-now');
    await expect(now.getByTestId('connection-sky')).toContainText('Off');
    await expect(now.getByTestId('connection-helper')).toContainText('nothing is sent anywhere');
    await expect(now.getByTestId('connection-screens')).toContainText('Kitchen wall');
    await expect(now).not.toContainText('Have a look');

    // The refused request is counted and told, by screen and part of the house — and not by what it said.
    const requests = page.getByTestId('connections-requests');
    await expect(requests.getByRole('row', { name: /Turned down/ })).toContainText('1');
    const lines = page.getByTestId('connections-lines');
    await expect(lines.locator('[data-what="request.not_allowed"]')).toContainText(
      'A request about settings was turned down: that screen may not do it.',
    );
    await expect(lines.locator('[data-what="request.not_allowed"]')).toContainText('Kitchen wall');
    await expect(lines).not.toContainText('Not ours to change');

    // Each line of "Now" opens the page where that connection is set up.
    await now.getByTestId('connection-sky').click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Sky/);
  });
});
