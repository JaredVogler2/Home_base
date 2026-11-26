import { expect, test } from '@playwright/test';
import { makeAcademyExport } from '../tests/shared/academy-fixture';
import { DEMO, enter, guardianApi, resetDemo } from './support/demo';

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
    await expect(record.locator('tbody tr')).toHaveCount(before.length);
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
