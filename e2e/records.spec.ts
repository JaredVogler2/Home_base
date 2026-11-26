import { expect, test } from '@playwright/test';
import { makeAcademyExport } from '../tests/shared/academy-fixture';
import { DEMO, enter, guardianApi, newScreen, resetDemo, snapshot } from './support/demo';

/**
 * A parent's own records: bringing in a child's Training Academy progress from a file, with consent first; and
 * the day-by-day record, where a line that was simply wrong can be forgotten.
 */

test.describe('records a parent keeps', { tag: '@phone' }, () => {
  test.beforeEach(async () => {
    await resetDemo();
  });

  test('Academy progress is brought in from a file, only after a yes, and a wrong file is turned away', async ({
    page,
    context,
  }) => {
    await enter(context, 'guardian');
    await page.goto('/parent/more/academy');
    await page.getByTestId('academy-child-Milo').click();
    const sheet = page.getByTestId('academy-sheet');
    await expect(sheet).toBeVisible();

    // Nothing can be brought in until a parent has said yes for this child.
    const bring = sheet.getByRole('button', { name: 'Choose the export file' });
    await expect(bring).toBeDisabled();
    await sheet.getByTestId('academy-consent').click();
    await expect(bring).toBeEnabled();

    // A file that is not an Academy export never leaves the phone.
    await sheet.getByTestId('academy-file').setInputFiles({
      name: 'holiday.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ photos: ['beach'] })),
    });
    await expect(sheet.getByRole('alert')).toBeVisible();
    await expect(sheet.getByTestId('academy-result')).toHaveCount(0);

    // A real export: two sittings, made the way the Academy makes them.
    const file = makeAcademyExport({
      name: 'A name typed in the Academy',
      sessions: [
        { id: 'sitting-one', startedAt: '2026-03-01T15:00:00Z', completed: true, attempts: [{}, {}] },
        { id: 'sitting-two', startedAt: '2026-03-02T15:10:00Z', completed: false, attempts: [{}] },
      ],
    });
    await sheet.getByTestId('academy-file').setInputFiles({
      name: 'academy-export.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(file)),
    });
    await expect(sheet.getByTestId('academy-result')).toContainText('Brought in 2 new activities');

    // Bringing the same file in again adds nothing.
    await sheet.getByTestId('academy-file').setInputFiles({
      name: 'academy-export.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(file)),
    });
    await expect(sheet.getByTestId('academy-result')).toContainText('Brought in 0 new activities');
    await expect(sheet.getByTestId('academy-result')).toContainText('2 already here');

    // The server holds two sittings for Milo, and not the name that was typed in the Academy.
    const api = await guardianApi();
    const summary = await api.get(`/api/academy/summary?profileId=${DEMO.milo}&weeks=8`);
    expect(summary.ok()).toBe(true);
    expect(JSON.stringify(await summary.json())).not.toContain('A name typed in the Academy');
    const exported = await (await api.get('/api/export/household.json')).text();
    expect(exported).not.toContain('A name typed in the Academy');
    await api.dispose();
  });

  test('History says how each routine went — its steps, when, and where it waits — and what a child is saving for', async ({
    page,
    context,
    browser,
  }) => {
    await enter(context, 'guardian');
    // A child chooses something to save for, on the wall.
    const wall = await newScreen(browser, 'wall');
    await enter(wall, 'wall');
    const reward = (await snapshot(wall)).rewards.find(
      (entry) => entry.status === 'active' && entry.profiles.length === 0,
    )!;
    const chosen = await wall.request.post('/api/sync/ops', {
      data: {
        ops: [
          {
            id: crypto.randomUUID(),
            type: 'goal.set',
            at: new Date().toISOString(),
            input: { profileId: DEMO.june, rewardId: reward.id },
          },
        ],
      },
    });
    expect(JSON.stringify(await chosen.json())).toContain('"applied"');
    await wall.close();

    await page.goto('/parent/history');
    const routines = page.getByTestId('history-routines');
    await expect(routines).toBeVisible();
    // How the steps were done: on their own, together with a grown-up, left out — counts, with their legend.
    await expect(
      routines.getByRole('img', { name: /^Steps of Morning: On their own \d+, Together \d+/ }),
    ).toBeVisible();
    // When it was finished, and where it tends to wait: about the routine, with how many goes it is out of.
    await expect(
      routines.getByRole('img', { name: /^When Morning was finished: Morning \d+/ }),
    ).toBeVisible();
    const timing = routines.getByTestId('timing-Morning');
    await expect(timing).toHaveCount(2);
    await expect(timing.nth(0)).toHaveText(
      /^Usually about \d+ minutes? from the first tap to the last \(the middle of \d+ goes\)\.$/,
    );
    await expect(timing.nth(1)).toHaveText(
      /^The longest wait is usually before “.+” is ticked: about \d+ minutes? \(\d+ goes\)\.$/,
    );
    // No child is named in what a routine's minutes say.
    await expect(timing.nth(0)).not.toContainText(/June|Milo|Bea/);
    await expect(timing.nth(1)).not.toContainText(/June|Milo|Bea/);
    // And the page says what the minutes are, and are not.
    await expect(page.getByText('not how quick anyone is')).toBeVisible();

    // What June chose on the wall, against the stars she has now.
    const saving = page.getByTestId('goals');
    await expect(saving).toContainText(`June: ${reward.title}`);
    await expect(saving).toContainText(new RegExp(`of ${reward.price}`));
  });

  test('a line of the day-by-day record that was simply wrong can be forgotten', async ({
    page,
    context,
  }) => {
    await enter(context, 'guardian');
    const api = await guardianApi();
    const linesNow = async () =>
      ((await (await api.get('/api/history/events?days=14&limit=60')).json()) as { events: { id: string }[] })
        .events;
    const before = await linesNow();
    expect(before.length).toBeGreaterThan(2);

    await page.goto('/parent/more/records');
    const record = page.getByTestId('day-record');
    await expect(record).toBeVisible();
    // A handful at first, the newest on top; the rest are a tap away.
    await expect(record.locator('tbody tr')).toHaveCount(8);
    await record.getByTestId('day-record-more').click();
    await expect(record.locator('tbody tr')).toHaveCount(Math.min(before.length, 28));
    const target = before[0]!.id;
    await record.getByTestId(`forget-${target}`).click();
    // It asks once before it does it.
    await expect.poll(linesNow).toHaveLength(before.length);
    await record.getByTestId(`forget-${target}-confirm`).click();
    await expect(record.getByTestId(`forget-${target}`)).toHaveCount(0);
    await expect.poll(async () => (await linesNow()).map((line) => line.id)).not.toContain(target);
    await api.dispose();
  });
});
