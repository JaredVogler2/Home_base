import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '../../shared/ids.js';
import {
  addChild,
  addTask,
  newFamily,
  occurrenceOf,
  pairWall,
  startServer,
  walletOf,
  type TestServer,
} from './harness.js';

let server: TestServer;
beforeAll(async () => {
  server = await startServer({}, '2026-03-03T21:00:00Z');
});
afterAll(async () => {
  await server.close();
});

describe('badges', () => {
  it('gives the first star its badge, once, to the child who earned it', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const bo = await addChild(family, 'Bo', { avatar: 'bear' });
    const task = await addTask(family, { stars: 1 });
    const wall = await pairWall(family);
    const before = await wall.pull();
    expect(before.badges).toEqual([]);

    await wall.do('occurrence.submit', { occurrenceId: occurrenceOf(before, task, kit).id, profileId: kit });
    expect(wall.snapshot?.badges).toEqual([{ profileId: kit, badge: 'first-star', earnedOn: '2026-03-03' }]);

    // Bo's own first star is Bo's own badge; Kit's is not given twice.
    await wall.do('occurrence.submit', { occurrenceId: occurrenceOf(before, task, bo).id, profileId: bo });
    const earned = wall.snapshot?.badges ?? [];
    expect(
      earned
        .filter((badge) => badge.badge === 'first-star')
        .map((badge) => badge.profileId)
        .sort(),
    ).toEqual([kit, bo].sort());
    expect(earned).toHaveLength(2);
    // A parent's phone sees the same keepsakes.
    expect((await family.parent.pull()).badges).toHaveLength(2);
  });

  it('waits for a grown-up’s yes when the mission needs one', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const task = await addTask(family, { stars: 10, verification: 'guardian' });
    const wall = await pairWall(family);
    const occurrence = occurrenceOf(await wall.pull(), task, kit);
    await wall.do('occurrence.submit', { occurrenceId: occurrence.id, profileId: kit });
    expect(wall.snapshot?.badges).toEqual([]);
    await family.parent.do('occurrence.approve', { occurrenceIds: [occurrence.id] });
    expect((await wall.pull()).badges.map((badge) => badge.badge)).toEqual(['first-star', 'stars-10']);
  });

  it('is kept for good: a correction can take stars back, never a badge', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    await family.parent.do('ledger.bonus', { entryId: newId(), profileId: kit, stars: 12, note: null });
    const after = await family.parent.pull();
    expect(after.badges.map((badge) => badge.badge)).toEqual(['first-star', 'stars-10']);

    await family.parent.do('ledger.correct', {
      entryId: newId(),
      profileId: kit,
      available: -12,
      lifetime: -12,
      note: 'Entered twice by mistake',
    });
    const corrected = await family.parent.pull();
    expect(walletOf(corrected, kit).lifetime).toBe(0);
    expect(corrected.badges.map((badge) => badge.badge)).toEqual(['first-star', 'stars-10']);
  });

  it('thanks a child for asking for a hand, the third time', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const tasks = [
      await addTask(family, { title: 'Shoes by the door' }),
      await addTask(family, { title: 'Coat on the hook' }),
      await addTask(family, { title: 'Bag packed' }),
    ];
    const wall = await pairWall(family);
    const snapshot = await wall.pull();
    for (const [index, task] of tasks.entries()) {
      await wall.do('occurrence.help', {
        occurrenceId: occurrenceOf(snapshot, task, kit).id,
        profileId: kit,
      });
      const badges = (wall.snapshot?.badges ?? []).map((badge) => badge.badge);
      expect(badges.includes('brave-asker')).toBe(index === 2);
    }
  });
});
