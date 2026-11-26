import { expect, test } from '@playwright/test';
import { newScreen } from './support/demo';

/**
 * A brand-new household, not the demo: starting one, the recovery codes shown once, a first child, signing out
 * and back in, a wrong password refused in words, and a second grown-up joining with an invitation.
 */

const stamp = Date.now().toString(36);
const OWNER = { name: 'Alex', email: `alex-${stamp}@example.test`, password: 'a-long-test-password-1' };
const SECOND = { name: 'Kit', email: `kit-${stamp}@example.test`, password: 'another-test-password-2' };
const HOUSEHOLD = 'Test Lane house';

/** A whole sentence: starts with a capital, ends with a full stop (or similar). */
const SENTENCE = /^[A-Z][^]*[.!?]$/;

test.describe('a new household', { tag: '@phone' }, () => {
  test('sign up, recovery codes once, a child, sign out and in, a wrong password, and an invitation', async ({
    page,
    browser,
  }) => {
    // Start a household.
    await page.goto('/parent');
    await page.getByTestId('auth-to-signup').click();
    await expect(page.getByRole('heading', { name: 'Start a household' })).toBeVisible();
    await page.getByTestId('auth-name').fill(OWNER.name);
    await page.getByTestId('auth-email').fill(OWNER.email);
    await page.getByTestId('auth-password').fill(OWNER.password);
    await page.getByTestId('auth-household').fill(HOUSEHOLD);
    await page.getByTestId('auth-submit').click();

    // The recovery codes, once.
    const codes = page.getByTestId('recovery-codes').locator('li');
    await expect(codes.first()).toBeVisible();
    expect(await codes.count()).toBeGreaterThanOrEqual(4);
    const first = (await codes.first().textContent())!.trim();
    expect(first.length).toBeGreaterThanOrEqual(6);
    await page.getByTestId('codes-done').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
    await expect(page.getByText(HOUSEHOLD).first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
    await expect(page.getByTestId('recovery-codes'), 'not shown again').toHaveCount(0);
    await expect(page.getByText(first)).toHaveCount(0);

    // A first child.
    await page.goto('/parent/more/children');
    await page.getByTestId('add-child').click();
    await page.getByTestId('child-name').fill('Robin');
    await page.getByTestId('save-child').click();
    await expect(page.getByTestId('child-editor')).toHaveCount(0);
    await expect(page.getByTestId('child-row-Robin')).toBeVisible();

    // Sign out.
    await page.goto('/parent/more');
    await page.getByTestId('sign-out-main').click();
    await expect(page.getByTestId('auth-submit')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

    // A wrong password is refused, in a sentence.
    await page.getByTestId('auth-email').fill(OWNER.email);
    await page.getByTestId('auth-password').fill('not-the-password');
    await page.getByTestId('auth-submit').click();
    const problem = page.getByTestId('auth-problem');
    await expect(problem).toBeVisible();
    await expect(problem).toHaveText(SENTENCE);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

    // The right one lets them in, to their own household.
    await page.getByTestId('auth-password').fill(OWNER.password);
    await page.getByTestId('auth-submit').click();
    // Signed in again, on the page where they signed out.
    await expect(page.getByTestId('sync-state')).toBeVisible();
    await expect(page.getByRole('banner')).toContainText(HOUSEHOLD);
    await page.getByTestId('tab-today').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
    await expect(page.getByTestId('child-Robin')).toBeVisible();

    // An invitation from the owner lets a second grown-up join, on their own phone.
    await page.goto('/parent/more/grownups');
    await page.getByTestId('invite').click();
    await page.getByTestId('make-invite').click();
    const code = (await page.getByTestId('made-code').textContent())!.trim();
    expect(code.length).toBeGreaterThanOrEqual(6);

    const other = await newScreen(browser, 'phone');
    const otherPage = await other.newPage();
    await otherPage.goto(`/join?code=${encodeURIComponent(code)}`);
    await expect(otherPage.getByRole('heading', { name: 'Join with an invitation' })).toBeVisible();
    await expect(otherPage.getByTestId('auth-code')).toHaveValue(code);
    await otherPage.getByTestId('auth-submit').click();
    await expect(otherPage.getByText(HOUSEHOLD)).toBeVisible();
    await otherPage.getByTestId('auth-name').fill(SECOND.name);
    await otherPage.getByTestId('auth-email').fill(SECOND.email);
    await otherPage.getByTestId('auth-password').fill(SECOND.password);
    await otherPage.getByTestId('auth-submit').click();
    await expect(otherPage.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
    await expect(otherPage.getByTestId('child-Robin'), 'the same household').toBeVisible();

    // The owner sees them among the grown-ups.
    await page.getByTestId('sheet-x').click();
    await page.reload();
    await expect(page.getByTestId(`member-${SECOND.name}`)).toBeVisible({ timeout: 8_000 });
    await other.close();
  });
});
