import { expect, test } from '@playwright/test';
import { DEMO, enter, openWall, press, resetDemo, snapshot } from './support/demo';

/**
 * A child's routine on the wall — the day clock room — and the extras on the mission board.
 *
 * A routine is one picture at a time: what to do now, what comes next, one large "done". A child can ask for a
 * hand and can take a tap back; nothing counts down and nothing is lost by stopping.
 */

test.describe('a child’s routine and extras', { tag: '@w1080' }, () => {
  test.beforeEach(async () => {
    await resetDemo();
  });

  test('a routine goes one picture at a time: now and next, a hand asked for, a tap taken back, all done', async ({
    page,
    context,
  }) => {
    await enter(context, 'wall');
    await openWall(page, '07:15');
    await press(page.getByTestId('face-June'));
    await press(page.getByTestId('room-routines'));
    const scene = page.getByTestId('scene-routines');
    await expect(scene).toBeVisible();

    // The routine for this time of day is put first; a tap starts it (or picks it up where it was left).
    const runner = scene.getByTestId('routine-runner');
    if (!(await runner.isVisible())) {
      const offered = scene.getByTestId('routine-chooser').locator('button').first();
      await expect(offered).toHaveAttribute('data-now', 'true');
      await press(offered);
    }
    await expect(runner).toBeVisible();

    const now = runner.getByTestId('step-now');
    const first = await now.getAttribute('aria-label');
    expect(first).toMatch(/^Now: /);
    // What comes next is shown beside it, named for a screen reader and drawn for everyone else.
    await expect(runner.getByLabel(/^Next: /)).toBeVisible();

    // "Help, please" brings a grown-up and does not move the routine on.
    await press(runner.getByTestId('step-help'));
    await expect(runner.getByTestId('step-help')).toBeDisabled();
    await expect(now).toHaveAttribute('aria-label', first!);

    // Done moves to the next picture; "oops, back" takes that tap back.
    await press(runner.getByTestId('step-done'));
    await expect(now).not.toHaveAttribute('aria-label', first!);
    await press(runner.getByTestId('step-back'));
    await expect(now).toHaveAttribute('aria-label', first!);

    // Then all the way through: however many steps today has, each is one tap.
    const finished = scene.getByTestId('routine-finished');
    for (let taps = 0; taps < 12 && !(await finished.isVisible()); taps++) {
      const before = await now.getAttribute('aria-label');
      await press(runner.getByTestId('step-done'));
      await expect
        .poll(async () => (await finished.isVisible()) || (await now.getAttribute('aria-label')) !== before)
        .toBe(true);
    }
    // "All done!" stays in front — said, drawn and celebrated — until the child taps; it does not flick away.
    await expect(finished).toBeVisible();
    await expect(finished).toContainText('All done!');
    await expect(page.getByText('All done! Well done.').first()).toBeVisible();
    await page.waitForTimeout(1_500);
    await expect(finished).toBeVisible();
    await press(finished.getByTestId('routine-leave'));
    await expect(scene.getByTestId('routine-chooser')).toBeVisible();
    await expect(scene.getByTestId('routine-chooser').locator('[data-finished="true"]')).toHaveCount(1);

    // The server holds a finished go for June today, with the one ask for help on it — and no stars for it,
    // because getting dressed is not something this family pays for.
    await expect
      .poll(async () => {
        const snap = await snapshot(context);
        const run = snap.runs.find((entry) => entry.profileId === DEMO.june && entry.date === snap.today);
        return run ? `${run.status}|${run.help.length}` : 'none';
      })
      .toBe('completed|1');
  });

  test('an extra on the board is marked as a choice, and saying "not today" to it costs nothing', async ({
    page,
    context,
  }) => {
    await enter(context, 'wall');
    const before = await snapshot(context);
    // Which extras are on offer depends on the day of the week. Take a child who has one today, and the one
    // with the fewest missions waiting, so that the extra is among the handful the board shows at once.
    const waitingFor = (profileId: string) =>
      before.occurrences.filter(
        (mission) => mission.profileId === profileId && !['approved', 'skipped'].includes(mission.status),
      );
    const candidates = before.profiles
      .filter((profile) => profile.independent && !profile.archived)
      .map((profile) => ({
        profile,
        waiting: waitingFor(profile.id),
        extra: waitingFor(profile.id).find(
          (mission) => mission.kind === 'bonus' && mission.status === 'available',
        ),
      }))
      .filter((entry) => entry.extra)
      .sort((a, b) => a.waiting.length - b.waiting.length);
    test.skip(candidates.length === 0, 'the made-up family has no extra on offer today');
    const { profile, extra } = candidates[0]!;

    await openWall(page, '16:30');
    await press(page.getByTestId(`face-${profile.nickname}`));
    await press(page.getByTestId('room-quest'));
    const board = page.getByTestId('scene-quest');
    await expect(board).toBeVisible();
    const card = board.getByTestId(`mission-${extra!.title}`);
    test.skip(!(await card.isVisible()), 'the extra is behind the day’s own missions just now');
    await expect(card).toHaveAttribute('data-kind', 'bonus');
    await expect(card).toHaveAccessibleName(`${extra!.title} (an extra): to do`);

    const stars = before.wallets.find((wallet) => wallet.profileId === profile.id)!;
    await press(card);
    const sheet = page.getByTestId('mission-sheet');
    await expect(sheet).toBeVisible();
    await press(sheet.getByTestId('skip'));
    await expect(sheet).toHaveCount(0);
    await expect
      .poll(
        async () => (await snapshot(context)).occurrences.find((mission) => mission.id === extra!.id)?.status,
      )
      .toBe('skipped');
    const after = (await snapshot(context)).wallets.find((wallet) => wallet.profileId === profile.id)!;
    expect([after.available, after.lifetime]).toEqual([stars.available, stars.lifetime]);
  });
});
