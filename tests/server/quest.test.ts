import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '../../shared/ids.js';
import {
  addChild,
  addTask,
  newFamily,
  occurrenceOf,
  pairWall,
  startServer,
  taskInput,
  walletOf,
  type TestServer,
} from './harness.js';

let server: TestServer;
beforeAll(async () => {
  // A Tuesday afternoon in Chicago.
  server = await startServer({}, '2026-03-03T21:00:00Z');
});
afterAll(async () => {
  await server.close();
});

describe('a day’s missions', () => {
  it('gives each child their own, once, however many screens ask', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const bo = await addChild(family, 'Bo', { avatar: 'bear' });
    const baby = await addChild(family, 'Baby', { ageBand: 'baby' });
    const task = await addTask(family);
    const wall = await pairWall(family);
    const snapshots = await Promise.all([
      wall.pull(),
      family.parent.pull(),
      wall.pull(),
      family.parent.pull(),
    ]);
    for (const snapshot of snapshots) {
      const mine = snapshot.occurrences.filter((o) => o.templateId === task);
      expect(mine.map((o) => o.profileId).sort()).toEqual([kit, bo].sort());
    }
    // A baby has a place in the family and nothing to do.
    expect(snapshots[0]?.occurrences.some((o) => o.profileId === baby)).toBe(false);
  });

  it('makes one mission for the family when it is shared, done by whoever does it', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    await addChild(family, 'Bo');
    const task = await addTask(family, { shared: true, stars: 3 });
    const wall = await pairWall(family);
    const shared = (await wall.pull()).occurrences.filter((o) => o.templateId === task);
    expect(shared).toHaveLength(1);
    expect(shared[0]?.profileId).toBeNull();
    await wall.do('occurrence.submit', { occurrenceId: shared[0]?.id as string, profileId: kit });
    expect(walletOf(wall.snapshot!, kit).available).toBe(3);
  });

  it('follows the schedule: weekdays, one day a week, once, and not on holiday', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const weekdays = await addTask(family, { schedule: { kind: 'weekdays' } });
    const saturdays = await addTask(family, { schedule: { kind: 'weekly', days: [6] } });
    const once = await addTask(family, { schedule: { kind: 'once', date: '2026-03-03' } });
    const today = (await family.parent.pull()).occurrences
      .filter((o) => o.profileId === kit)
      .map((o) => o.templateId);
    expect(today).toContain(weekdays);
    expect(today).toContain(once);
    expect(today).not.toContain(saturdays);

    await family.parent.do('household.settings', {
      patch: { vacation: { from: '2026-03-04', to: '2026-03-06' } },
    });
    server.clock.set('2026-03-04T21:00:00Z');
    expect((await family.parent.pull()).occurrences.filter((o) => o.date === '2026-03-04')).toHaveLength(0);
    server.clock.set('2026-03-07T21:00:00Z');
    const saturday = (await family.parent.pull()).occurrences
      .filter((o) => o.date === '2026-03-07')
      .map((o) => o.templateId);
    expect(saturday).toEqual([saturdays]);
    server.clock.set('2026-03-03T21:00:00Z');
  });

  it('does not hand out the days nobody opened the wall', async () => {
    const quiet = await startServer({}, '2026-05-04T15:00:00Z');
    try {
      const family = await newFamily(quiet);
      const kit = await addChild(family, 'Kit');
      await addTask(family);
      await family.parent.pull();
      quiet.clock.set('2026-05-08T15:00:00Z');
      const snapshot = await family.parent.pull();
      expect(snapshot.today).toBe('2026-05-08');
      expect(snapshot.occurrences.filter((o) => o.profileId === kit).map((o) => o.date)).toEqual([
        '2026-05-08',
      ]);
      // …and nothing was written down as missed.
      const history = await quiet.database.db.execute(
        `select count(*)::int as c from homebase.task_occurrences where local_date between '2026-05-05' and '2026-05-07'`,
      );
      expect((history.rows[0] as { c: number }).c).toBe(0);
    } finally {
      await quiet.close();
    }
  });

  it('offers a flexible mission until it has been done often enough this week', async () => {
    const week = await startServer({}, '2026-06-01T15:00:00Z'); // a Monday
    try {
      const family = await newFamily(week);
      const kit = await addChild(family, 'Kit');
      const task = await addTask(family, { schedule: { kind: 'flexible', timesPerWeek: 2 }, kind: 'bonus' });
      const wall = await pairWall(family);
      for (const day of ['01', '02']) {
        week.clock.set(`2026-06-${day}T15:00:00Z`);
        const occurrence = occurrenceOf(await wall.pull(), task, kit);
        await wall.do('occurrence.submit', { occurrenceId: occurrence.id, profileId: kit });
      }
      week.clock.set('2026-06-03T15:00:00Z');
      expect(
        (await wall.pull()).occurrences.filter((o) => o.templateId === task && o.date === '2026-06-03'),
      ).toHaveLength(0);
      // A new week, and it is offered again.
      week.clock.set('2026-06-07T15:00:00Z');
      expect(
        (await wall.pull()).occurrences.filter((o) => o.templateId === task && o.date === '2026-06-07'),
      ).toHaveLength(1);
    } finally {
      await week.close();
    }
  });
});

describe('doing a mission', () => {
  it('gives the stars once, however many times “I did it” is tapped or sent', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const task = await addTask(family, { stars: 2 });
    const wall = await pairWall(family);
    const occurrence = occurrenceOf(await wall.pull(), task, kit);

    const opId = newId();
    const first = await wall.op('occurrence.submit', { occurrenceId: occurrence.id, profileId: kit }, opId);
    expect(first).toMatchObject({ status: 'applied', data: { status: 'approved', starsGiven: 2 } });
    // The very same request again (a retry after a lost reply): the same answer, and nothing more.
    const replay = await wall.op('occurrence.submit', { occurrenceId: occurrence.id, profileId: kit }, opId);
    expect(replay).toEqual(first);
    // A second tap (a new request for the same thing): nothing to do.
    const again = await wall.op('occurrence.submit', { occurrenceId: occurrence.id, profileId: kit });
    expect(again.status).toBe('noop');
    // Ten at once.
    await Promise.all(
      Array.from({ length: 10 }, () =>
        wall.op('occurrence.submit', { occurrenceId: occurrence.id, profileId: kit }),
      ),
    );

    const snapshot = await wall.pull();
    expect(walletOf(snapshot, kit)).toMatchObject({ available: 2, lifetime: 2, reserved: 0 });
    expect(occurrenceOf(snapshot, task, kit)).toMatchObject({
      status: 'approved',
      credited: true,
      doneBy: kit,
    });
  });

  it('waits for a grown-up where the family wants that, and approving twice or on two phones is one yes', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const task = await addTask(family, { stars: 3, verification: 'guardian' });
    const wall = await pairWall(family);
    const occurrence = occurrenceOf(await wall.pull(), task, kit);
    const sent = await wall.op('occurrence.submit', { occurrenceId: occurrence.id, profileId: kit });
    expect(sent).toMatchObject({ status: 'applied', data: { status: 'submitted', starsGiven: 0 } });
    expect(walletOf(wall.snapshot!, kit).available).toBe(0);

    // The wall cannot say yes to itself.
    expect(await wall.op('occurrence.approve', { occurrenceIds: [occurrence.id] })).toMatchObject({
      status: 'rejected',
      reason: 'forbidden',
    });

    // Two phones tap "approve" at the same moment.
    const invite = await family.parent.post<{ code: string }>('/auth/invites', { role: 'guardian' });
    const { Browser } = await import('./harness.js');
    const other = new Browser(server);
    await other.post('/auth/join', {
      code: invite.body.code,
      email: `two-${newId()}@example.test`,
      password: 'another long password',
      displayName: 'Robin',
    });
    const [a, b] = await Promise.all([
      family.parent.op('occurrence.approve', { occurrenceIds: [occurrence.id] }),
      other.op('occurrence.approve', { occurrenceIds: [occurrence.id] }),
    ]);
    expect([a.status, b.status].sort()).toEqual(['applied', 'noop']);
    const snapshot = await family.parent.pull();
    expect(walletOf(snapshot, kit)).toMatchObject({ available: 3, lifetime: 3 });
    const lines = await server.database.db.execute(
      `select count(*)::int as c from homebase.ledger where source_id = '${occurrence.id}'`,
    );
    expect((lines.rows[0] as { c: number }).c).toBe(1);
  });

  it('lets a child take back an “I did it” for a little while, and puts the stars back where they were', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const task = await addTask(family, { stars: 2 });
    const wall = await pairWall(family);
    const occurrence = occurrenceOf(await wall.pull(), task, kit);
    await wall.do('occurrence.submit', { occurrenceId: occurrence.id, profileId: kit });
    expect(occurrenceOf(wall.snapshot!, task, kit).undoUntil).not.toBeNull();
    await wall.do('occurrence.undo', { occurrenceId: occurrence.id });
    expect(walletOf(wall.snapshot!, kit)).toMatchObject({ available: 0, lifetime: 0 });
    expect(occurrenceOf(wall.snapshot!, task, kit).status).toBe('available');
    // Done properly this time: the stars come again, once.
    await wall.do('occurrence.submit', { occurrenceId: occurrence.id, profileId: kit });
    expect(walletOf(wall.snapshot!, kit)).toMatchObject({ available: 2, lifetime: 2 });
    // After the little while, only a grown-up can change it.
    server.clock.advance(3 * 60 * 1000);
    expect(await wall.op('occurrence.undo', { occurrenceId: occurrence.id })).toMatchObject({
      status: 'rejected',
      reason: 'not_allowed_now',
    });
    await family.parent.do('occurrence.reverse', { occurrenceId: occurrence.id, note: 'Not quite done' });
    const after = await family.parent.pull();
    expect(walletOf(after, kit)).toMatchObject({ available: 0, lifetime: 0 });
    // Every step of that is still on the record: given, taken back, given, taken back.
    const lines = await server.database.db.execute(
      `select kind, available from homebase.ledger where source_id = '${occurrence.id}' order by at, id`,
    );
    expect((lines.rows as { kind: string }[]).map((row) => row.kind).sort()).toEqual([
      'correction',
      'correction',
      'grant',
      'grant',
    ]);
    server.clock.advance(-3 * 60 * 1000);
  });

  it('sends a mission back with kind words and takes nothing away', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const task = await addTask(family, { verification: 'guardian' });
    const wall = await pairWall(family);
    const occurrence = occurrenceOf(await wall.pull(), task, kit);
    await wall.do('occurrence.submit', { occurrenceId: occurrence.id, profileId: kit });
    await family.parent.do('occurrence.return', { occurrenceId: occurrence.id, reason: 'almost' });
    const back = occurrenceOf(await wall.pull(), task, kit);
    expect(back).toMatchObject({ status: 'returned', returnReason: 'almost' });
    expect(walletOf(wall.snapshot!, kit)).toMatchObject({ available: 0, lifetime: 0 });
    // …and it can be sent again.
    expect((await wall.do('occurrence.submit', { occurrenceId: occurrence.id, profileId: kit })).status).toBe(
      'submitted',
    );
  });

  it('never takes a star for a mission skipped or not done', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const first = await addTask(family, { stars: 2 });
    const skippable = await addTask(family, { stars: 2, kind: 'bonus', skip: 'child', title: 'Bonus' });
    const firm = await addTask(family, { stars: 2, skip: 'grownup', title: 'Firm' });
    const wall = await pairWall(family);
    await wall.do('occurrence.submit', {
      occurrenceId: occurrenceOf(await wall.pull(), first, kit).id,
      profileId: kit,
    });
    await wall.do('occurrence.skip', {
      occurrenceId: occurrenceOf(wall.snapshot!, skippable, kit).id,
      profileId: kit,
    });
    // A child cannot wave away a mission the family has made firm; a grown-up can set it aside.
    const firmId = occurrenceOf(wall.snapshot!, firm, kit).id;
    expect(await wall.op('occurrence.skip', { occurrenceId: firmId, profileId: kit })).toMatchObject({
      status: 'rejected',
      reason: 'forbidden',
    });
    await family.parent.do('occurrence.dismiss', { occurrenceId: firmId });
    server.clock.advance(26 * 60 * 60 * 1000);
    const tomorrow = await wall.pull();
    expect(walletOf(tomorrow, kit)).toMatchObject({ available: 2, lifetime: 2 });
    server.clock.advance(-26 * 60 * 60 * 1000);
  });

  it('lets a grown-up mark a mission done for a child, and not for someone else’s mission', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const bo = await addChild(family, 'Bo');
    const task = await addTask(family, { assignees: [kit], stars: 4, verification: 'guardian' });
    const occurrence = occurrenceOf(await family.parent.pull(), task, kit);
    expect(
      await family.parent.op('occurrence.markDone', { occurrenceId: occurrence.id, profileId: bo }),
    ).toMatchObject({ status: 'rejected', reason: 'forbidden' });
    await family.parent.do('occurrence.markDone', { occurrenceId: occurrence.id, profileId: kit });
    expect(walletOf(family.parent.snapshot!, kit).available).toBe(4);
    expect(walletOf(family.parent.snapshot!, bo).available).toBe(0);
  });

  it('keeps one child’s missions out of another child’s hands', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const bo = await addChild(family, 'Bo');
    const task = await addTask(family, { stars: 2 });
    const wall = await pairWall(family);
    const kits = occurrenceOf(await wall.pull(), task, kit);
    expect(await wall.op('occurrence.submit', { occurrenceId: kits.id, profileId: bo })).toMatchObject({
      status: 'rejected',
      reason: 'forbidden',
    });
    expect(walletOf(wall.snapshot!, bo).available).toBe(0);
    expect(occurrenceOf(wall.snapshot!, task, kit).status).toBe('available');
  });

  it('holds stars for a grown-up once the day’s unchecked limit is reached', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    await family.parent.do('household.settings', { patch: { quest: { dailyAutoCreditCap: 3 } } });
    const a = await addTask(family, { stars: 2, title: 'A' });
    const b = await addTask(family, { stars: 2, title: 'B' });
    const wall = await pairWall(family);
    await wall.pull();
    expect(
      (
        await wall.do('occurrence.submit', {
          occurrenceId: occurrenceOf(wall.snapshot!, a, kit).id,
          profileId: kit,
        })
      ).status,
    ).toBe('approved');
    expect(
      (
        await wall.do('occurrence.submit', {
          occurrenceId: occurrenceOf(wall.snapshot!, b, kit).id,
          profileId: kit,
        })
      ).status,
    ).toBe('submitted');
    expect(walletOf(wall.snapshot!, kit).available).toBe(2);
  });
});

describe('editing a mission', () => {
  it('changes today’s untouched copies and leaves what was already done as it was', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const bo = await addChild(family, 'Bo');
    const task = await addTask(family, { stars: 2, title: 'Old words' });
    const wall = await pairWall(family);
    await wall.do('occurrence.submit', {
      occurrenceId: occurrenceOf(await wall.pull(), task, kit).id,
      profileId: kit,
    });
    await family.parent.do('task.update', {
      ...taskInput(task, { stars: 5, title: 'New words' }),
      baseVersion: 1,
    });
    const snapshot = await wall.pull();
    expect(occurrenceOf(snapshot, task, kit)).toMatchObject({
      title: 'Old words',
      stars: 2,
      status: 'approved',
      templateVersion: 1,
    });
    expect(occurrenceOf(snapshot, task, bo)).toMatchObject({
      title: 'New words',
      stars: 5,
      status: 'available',
      templateVersion: 2,
    });
    expect(walletOf(snapshot, kit).available).toBe(2);
    await wall.do('occurrence.submit', { occurrenceId: occurrenceOf(snapshot, task, bo).id, profileId: bo });
    expect(walletOf(wall.snapshot!, bo).available).toBe(5);
  });

  it('tells the second of two parents editing at once that the first got there', async () => {
    const family = await newFamily(server);
    await addChild(family, 'Kit');
    const task = await addTask(family);
    await family.parent.do('task.update', { ...taskInput(task, { title: 'First edit' }), baseVersion: 1 });
    const second = await family.parent.op('task.update', {
      ...taskInput(task, { title: 'Second edit' }),
      baseVersion: 1,
    });
    expect(second).toMatchObject({ status: 'rejected', reason: 'conflict' });
    expect((await family.parent.pull()).templates?.find((t) => t.id === task)?.title).toBe('First edit');
  });

  it('takes a paused mission off today’s board and brings it back', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const task = await addTask(family);
    await family.parent.do('task.status', { templateId: task, status: 'paused' });
    expect((await family.parent.pull()).occurrences.filter((o) => o.templateId === task)).toHaveLength(0);
    await family.parent.do('task.status', { templateId: task, status: 'active' });
    expect(occurrenceOf(await family.parent.pull(), task, kit).status).toBe('available');
  });

  it('puts missions in the order a parent chooses, on today’s board at once', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const shoes = await addTask(family, { title: 'Shoes' });
    const teeth = await addTask(family, { title: 'Teeth' });
    const books = await addTask(family, { title: 'Books' });
    const wall = await pairWall(family);
    const titles = (snapshot: Awaited<ReturnType<typeof wall.pull>>) =>
      snapshot.occurrences
        .filter((o) => o.profileId === kit)
        .sort((a, b) => a.sort - b.sort)
        .map((o) => o.title);
    expect(titles(await wall.pull())).toEqual(['Shoes', 'Teeth', 'Books']);

    await family.parent.do('task.reorder', { templateIds: [books, shoes, teeth] });
    expect(titles(await wall.pull())).toEqual(['Books', 'Shoes', 'Teeth']);
    expect((await family.parent.pull()).templates?.map((template) => template.title)).toEqual([
      'Books',
      'Shoes',
      'Teeth',
    ]);
    // The wall cannot rearrange the plan.
    expect((await wall.op('task.reorder', { templateIds: [teeth, shoes, books] })).status).toBe('rejected');
    expect(titles(await wall.pull())).toEqual(['Books', 'Shoes', 'Teeth']);
  });

  it('refuses a mission that is not a mission', async () => {
    const family = await newFamily(server);
    const bad = await family.parent.op('task.create', { ...taskInput(newId()), stars: 9999 });
    expect(bad).toMatchObject({ status: 'rejected', reason: 'invalid' });
    const picture = await family.parent.ops([
      { id: newId(), type: 'task.create', input: { ...taskInput(newId()), picture: 'chainsaw' } },
    ]);
    expect(picture[0]).toMatchObject({ status: 'rejected', reason: 'invalid' });
    const stranger = await family.parent.op('task.create', taskInput(newId(), { assignees: [newId()] }));
    expect(stranger).toMatchObject({ status: 'rejected', reason: 'invalid' });
  });
});

describe('when the clocks change', () => {
  it('hands out one day’s missions for each calendar day through a spring-forward and a fall-back', async () => {
    for (const [zone, days] of [
      ['America/Chicago', ['2026-03-07', '2026-03-08', '2026-03-09']], // 8 March: 23 hours
      ['America/Chicago', ['2026-10-31', '2026-11-01', '2026-11-02']], // 1 November: 25 hours
      ['Europe/London', ['2026-03-28', '2026-03-29', '2026-03-30']],
    ] as const) {
      const dst = await startServer({}, `${days[0]}T18:00:00Z`);
      try {
        const family = await newFamily(dst, { timeZone: zone });
        const kit = await addChild(family, 'Kit');
        const task = await addTask(family, { stars: 1 });
        const wall = await pairWall(family);
        for (const day of days) {
          // Ask at several moments through the day, on both sides of the change.
          // (Each of these is inside the calendar day in both zones.)
          for (const hour of ['07', '09', '12', '18', '22']) {
            dst.clock.set(`${day}T${hour}:30:00Z`);
            await wall.pull();
          }
          dst.clock.set(`${day}T19:00:00Z`);
          const snapshot = await wall.pull();
          expect(snapshot.today).toBe(day);
          await wall.do('occurrence.submit', {
            occurrenceId: occurrenceOf(snapshot, task, kit).id,
            profileId: kit,
          });
        }
        const rows = await dst.database.db.execute(
          `select local_date, count(*)::int as c from homebase.task_occurrences group by local_date order by local_date`,
        );
        expect(rows.rows).toEqual(days.map((day) => ({ local_date: day, c: 1 })));
        expect(walletOf(await wall.pull(), kit).lifetime).toBe(3);
      } finally {
        await dst.close();
      }
    }
  });
});
