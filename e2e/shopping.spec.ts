import { expect, test, type Page } from '@playwright/test';
import { DEMO, enter, newScreen, openWall, press, resetDemo, signIn, snapshot } from './support/demo';

/**
 * The shopping list, kept on two phones and shown on the wall: one line that holds two things, a pasted note,
 * ticking, editing, removing with Undo — and a child asking for something by picture.
 */

/** Paste text into a field the way a phone's paste does: a real paste event with the text on its clipboard. */
async function paste(page: Page, testId: string, text: string): Promise<void> {
  await page.getByTestId(testId).evaluate((field, words) => {
    const data = new DataTransfer();
    data.setData('text/plain', words);
    field.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
    );
  }, text);
}

test.describe('the shopping list', { tag: '@phone' }, () => {
  test.beforeAll(async () => {
    await resetDemo();
  });

  test('two phones and the wall keep one list; a child asks by picture and a grown-up says yes', async ({
    page,
    context,
    browser,
  }) => {
    await enter(context, 'guardian');
    await page.goto('/parent/lists');
    // The second list ("To buy") has no milk or eggs on it yet, so each line becomes a new thing.
    await page.getByRole('tab', { name: 'To buy' }).click();
    await expect(page).toHaveURL(new RegExp(`/parent/lists/${DEMO.toBuy}`));

    // One line, two things, the number read from the words.
    const add = page.getByTestId('add-item');
    await add.fill('2 milk, eggs');
    await add.press('Enter');
    await expect(add).toHaveValue('');
    await expect(page.getByTestId('item-milk')).toContainText('2 × milk');
    await expect(page.getByTestId('item-eggs')).toContainText('eggs');
    await expect(page.getByTestId('item-eggs')).not.toContainText('×');

    // A pasted note of three lines: three things.
    await paste(page, 'add-item', 'Apples\nRice\nDish soap');
    await expect(page.getByTestId('toast').filter({ hasText: 'Added 3 things' })).toBeVisible();
    for (const text of ['Apples', 'Rice', 'Dish soap'])
      await expect(page.getByTestId(`item-${text}`)).toBeVisible();

    // Tick one.
    await page.getByTestId('check-Apples').click();
    await expect(page.getByTestId('bought').getByTestId('item-Apples')).toBeVisible();
    await expect(page.getByTestId('check-Apples')).toHaveAttribute('aria-checked', 'true');

    // Edit one.
    await page.getByTestId('edit-Rice').click();
    const editor = page.getByTestId('edit-item');
    await editor.getByTestId('item-text').fill('Brown rice');
    await editor.getByTestId('save-item').click();
    await expect(editor).toHaveCount(0);
    await expect(page.getByTestId('item-Brown rice')).toBeVisible();
    await expect(page.getByTestId('item-Rice')).toHaveCount(0);

    // Remove one, then change our mind.
    await page.getByTestId('edit-Dish soap').click();
    await page.getByTestId('remove-item').click();
    await page.getByTestId('remove-item-confirm').click();
    await expect(page.getByTestId('item-Dish soap')).toHaveCount(0);
    await page.getByTestId('toast').getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByTestId('item-Dish soap')).toBeVisible();

    // The server holds exactly that.
    await expect
      .poll(async () => {
        const snap = await snapshot(context);
        return snap.items
          .filter((item) => item.listId === DEMO.toBuy)
          .map((item) => `${item.text}|${item.quantity ?? ''}|${item.status}`)
          .sort();
      })
      .toEqual(
        expect.arrayContaining([
          'milk|2|needed',
          'eggs||needed',
          'Apples||checked',
          'Brown rice||needed',
          'Dish soap||needed',
        ]),
      );

    // The wall's pantry shows the list.
    const wall = await newScreen(browser, 'wall');
    await enter(wall, 'wall');
    const wallPage = await wall.newPage();
    await openWall(wallPage, '16:30');
    await press(wallPage.getByTestId('room-pantry'));
    const pantry = wallPage.getByTestId('scene-pantry');
    await expect(pantry).toBeVisible();
    await press(pantry.getByRole('tab').nth(1));
    for (const text of ['milk', 'eggs', 'Brown rice', 'Dish soap', 'Apples'])
      await expect(pantry.getByTestId(`item-${text}`)).toBeVisible();
    await expect(pantry.getByTestId('item-Apples')).toHaveAttribute('data-status', 'checked');

    // A child asks for something by picture.
    await press(pantry.getByTestId('ask-item'));
    const ask = wallPage.getByTestId('ask-sheet');
    await press(ask.getByTestId('face-June'));
    await press(ask.getByTestId('choice-apple'));
    await expect(ask).toHaveCount(0);
    let askedText = '';
    await expect
      .poll(async () => {
        const item = (await snapshot(context)).items.find(
          (candidate) => candidate.status === 'requested' && candidate.requestedBy === DEMO.june,
        );
        askedText = item?.text ?? '';
        return askedText;
      })
      .not.toBe('');

    // The grown-up sees the request and says yes.
    await page.goto('/parent');
    const yes = page.getByTestId(`want-yes-${askedText}`);
    await expect(yes).toBeVisible({ timeout: 6_000 });
    await yes.click();
    await expect(yes).toHaveCount(0);
    await expect
      .poll(
        async () =>
          (await snapshot(context)).items.find(
            (item) => item.text === askedText && item.requestedBy === DEMO.june,
          )?.status,
      )
      .toBe('needed');
    // …and the wall shows it as wanted, no longer waiting.
    await press(pantry.getByRole('tab').nth(0));
    await expect(pantry.getByTestId(`item-${askedText}`)).toHaveAttribute('data-status', 'needed', {
      timeout: 8_000,
    });

    // The other parent's phone sees the same list.
    const other = await newScreen(browser, 'phone');
    await signIn(other, DEMO.rileyEmail, DEMO.password);
    const otherPage = await other.newPage();
    await otherPage.goto(`/parent/lists/${DEMO.toBuy}`);
    for (const text of ['milk', 'eggs', 'Brown rice', 'Dish soap'])
      await expect(otherPage.getByTestId(`item-${text}`)).toBeVisible({ timeout: 6_000 });
    await expect(otherPage.getByTestId('item-milk')).toContainText('2 × milk');
    // A change on the first phone reaches the second within a few seconds, without a reload.
    await page.goto(`/parent/lists/${DEMO.toBuy}`);
    await page.getByTestId('check-eggs').click();
    await expect(otherPage.getByTestId('check-eggs')).toHaveAttribute('aria-checked', 'true', {
      timeout: 6_000,
    });

    await wall.close();
    await other.close();
  });

  test('favourites: kept from the editor, put back with one tap, taken off the shelf', async ({
    page,
    context,
  }) => {
    await enter(context, 'guardian');
    await page.goto(`/parent/lists/${DEMO.toBuy}`);
    const shelf = page.getByTestId('favourites');
    const kept = async () =>
      (await snapshot(context)).household.settings.shopping.favourites.map((entry) => entry.text);
    // The made-up family already keeps a few; one tap puts one on this list.
    await expect(shelf.getByTestId('favourite-Oats')).toBeEnabled();
    await shelf.getByTestId('favourite-Oats').click();
    await expect(page.getByTestId('item-Oats')).toBeVisible();
    // Now that it is on the list the shelf says so, and a second tap cannot add it twice.
    await expect(shelf.getByTestId('favourite-Oats')).toBeDisabled();
    await expect(shelf.getByRole('button', { name: 'Oats: already on the list' })).toBeVisible();

    // Something new, made a favourite from its own editor.
    const add = page.getByTestId('add-item');
    await add.fill('Sticky tape');
    await add.press('Enter');
    await page.getByTestId('edit-Sticky tape').click();
    const editor = page.getByTestId('edit-item');
    await expect(editor.getByTestId('item-favourite')).toHaveAttribute('aria-checked', 'false');
    await editor.getByTestId('item-favourite').click();
    await editor.getByTestId('save-item').click();
    await expect(editor).toHaveCount(0);
    await expect(shelf.getByTestId('favourite-Sticky tape')).toBeDisabled();
    await expect.poll(kept).toContain('Sticky tape');

    // Bought; next week one tap wants it again — the same line, not a second one.
    await page.getByTestId('check-Sticky tape').click();
    await expect(shelf.getByTestId('favourite-Sticky tape')).toBeEnabled();
    await shelf.getByTestId('favourite-Sticky tape').click();
    await expect(page.getByTestId('check-Sticky tape')).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('item-Sticky tape')).toHaveCount(1);

    // Off the shelf again; the list keeps the thing itself.
    await page.getByTestId('favourites-change').click();
    await page.getByTestId('unfavourite-Sticky tape').click();
    await expect(shelf.getByTestId('unfavourite-Sticky tape')).toHaveCount(0);
    await page.getByTestId('favourites-change').click();
    await expect(page.getByTestId('item-Sticky tape')).toBeVisible();
    await expect.poll(kept).not.toContain('Sticky tape');
    await expect.poll(kept).toContain('Oats');
  });
});
