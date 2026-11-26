import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  MIN_TIMED_RUNS,
  ONE_SITTING_MINUTES,
  routineTiming,
  type TimedRun,
} from '../../server/domain/history';
import { newId } from '../../shared/ids';
import type { OpInput } from '../../shared/ops';
import { addChild, newFamily, pairWall, startServer, type Family, type TestServer } from './harness';

/**
 * Where a routine tends to wait. The brief asks that history "reports where routines take longer or require
 * assistance without treating it as a clinical assessment", with denominators and with missing data said out
 * loud. So: nothing is said from fewer than three goes, a go that was set aside is left out and counted as such,
 * and the figure is the middle go, which one slow Tuesday cannot move.
 */

const STEPS = [
  { id: 'wake', title: 'Wake up', picture: 'wake' },
  { id: 'dress', title: 'Get dressed', picture: 'dress' },
  { id: 'eat', title: 'Breakfast', picture: 'breakfast' },
];

const at = (minutes: number): Date => new Date(Date.UTC(2026, 2, 3, 13, minutes));

/** A go started on the hour, with each step ticked so many minutes after the start. */
const go = (wake: number, dress: number, eat: number, leftOut: string[] = []): TimedRun => ({
  startedAt: at(0),
  steps: STEPS,
  ticks: [
    { stepId: 'wake', at: at(wake), leftOut: leftOut.includes('wake') },
    { stepId: 'dress', at: at(dress), leftOut: leftOut.includes('dress') },
    { stepId: 'eat', at: at(eat), leftOut: leftOut.includes('eat') },
  ],
});

describe('where a routine tends to wait (the sums)', () => {
  it('says nothing from too few goes, and says how many it has', () => {
    const timing = routineTiming([go(1, 9, 14), go(0, 6, 10)]);
    expect(MIN_TIMED_RUNS).toBe(3);
    expect(timing).toEqual({ usualMinutes: null, timed: 2, setAside: 0, longest: null });
  });

  it('gives the middle go and the step with the longest usual gap before its tick', () => {
    const timing = routineTiming([go(1, 9, 14), go(0, 6, 10), go(2, 12, 20)]);
    expect(timing.usualMinutes).toBe(14);
    expect(timing.timed).toBe(3);
    // Gaps before "Get dressed": 8, 6 and 10 minutes — the middle is 8. Before "Breakfast": 5, 4 and 8.
    expect(timing.longest).toEqual({ title: 'Get dressed', picture: 'dress', usualMinutes: 8, of: 3 });
  });

  it('is not moved by one very slow morning', () => {
    const usual = routineTiming([go(1, 9, 14), go(0, 6, 10), go(2, 12, 20)]);
    const withASlowOne = routineTiming([go(1, 9, 14), go(0, 6, 10), go(2, 12, 20), go(5, 60, 110)]);
    // Four goes: the middle lies between 14 and 20.
    expect(withASlowOne.usualMinutes).toBe(17);
    expect(withASlowOne.longest?.title).toBe(usual.longest?.title);
    expect(withASlowOne.longest?.usualMinutes).toBe(9);
  });

  it('leaves out a go that was set aside and finished much later, and says that it did', () => {
    const later = ONE_SITTING_MINUTES + 30;
    const timing = routineTiming([go(1, 9, 14), go(0, 6, 10), go(2, 12, 20), go(1, later, later)]);
    expect(timing.setAside).toBe(1);
    expect(timing.timed).toBe(3);
    expect(timing.usualMinutes).toBe(14);
  });

  it('points at no step when none stands out', () => {
    // Everything ticked at once at the end: the taps say when the screen was touched, not what took long.
    const timing = routineTiming([go(10, 10, 10), go(12, 12, 12), go(9, 9, 9)]);
    expect(timing.usualMinutes).toBe(10);
    // The first step carries the whole wait, because it is the first tick: that is true, and it is said.
    expect(timing.longest).toEqual({ title: 'Wake up', picture: 'wake', usualMinutes: 10, of: 3 });
    const quick = routineTiming([go(0, 1, 1), go(1, 1, 2), go(0, 0, 1)]);
    expect(quick.usualMinutes).toBe(1);
    expect(quick.longest).toBeNull();
  });

  it('does not time a step that was left out, though the clock moves on past it', () => {
    const runs = [go(1, 9, 14, ['dress']), go(0, 6, 10, ['dress']), go(2, 12, 20, ['dress'])];
    const timing = routineTiming(runs);
    // "Get dressed" was left out every time, so it cannot be where the routine waits; "Breakfast" is next.
    expect(timing.longest).toEqual({ title: 'Breakfast', picture: 'breakfast', usualMinutes: 5, of: 3 });
  });

  it('settles ticks in the same minute by the routine’s own order', () => {
    const sameMinute: TimedRun = {
      startedAt: at(0),
      steps: STEPS,
      // Given out of order, all in minute six.
      ticks: [
        { stepId: 'eat', at: at(6), leftOut: false },
        { stepId: 'wake', at: at(6), leftOut: false },
        { stepId: 'dress', at: at(6), leftOut: false },
      ],
    };
    const timing = routineTiming([sameMinute, sameMinute, sameMinute]);
    expect(timing.longest).toEqual({ title: 'Wake up', picture: 'wake', usualMinutes: 6, of: 3 });
  });

  it('ignores a go with nothing ticked, and a tick for a step the routine no longer has', () => {
    const empty: TimedRun = { startedAt: at(0), steps: STEPS, ticks: [] };
    const stray: TimedRun = {
      startedAt: at(0),
      steps: STEPS,
      ticks: [
        { stepId: 'gone', at: at(3), leftOut: false },
        { stepId: 'eat', at: at(7), leftOut: false },
      ],
    };
    const timing = routineTiming([empty, stray, stray, stray]);
    expect(timing.timed).toBe(3);
    expect(timing.usualMinutes).toBe(7);
    // The stray tick still moved the clock: breakfast waited four minutes after it, not seven.
    expect(timing.longest).toEqual({ title: 'Breakfast', picture: 'breakfast', usualMinutes: 4, of: 3 });
  });
});

type Steps = OpInput<'routine.create'>['steps'];

interface RoutineRow {
  routineId: string;
  title: string;
  started: number;
  completed: number;
  morning: number;
  afternoon: number;
  evening: number;
  timing: {
    usualMinutes: number | null;
    timed: number;
    setAside: number;
    longest: { title: string; usualMinutes: number; of: number } | null;
  };
}

describe('where a routine tends to wait (through the server)', () => {
  let server: TestServer;
  let family: Family;
  const MINUTE = 60_000;

  const step = (title: string, picture: Steps[number]['picture']): Steps[number] => ({
    id: newId(),
    title,
    picture,
    say: null,
    seconds: null,
    needsAdult: false,
    optional: false,
    days: null,
    taskId: null,
  });

  beforeAll(async () => {
    server = await startServer({}, '2026-03-03T13:00:00Z'); // Tuesday, 7 a.m. in Chicago
    family = await newFamily(server);
  });
  afterAll(async () => {
    await server.close();
  });

  it('reports when a routine was finished and where it waits, for the routine and not for a child', async () => {
    const steps = [step('Wake up', 'wake'), step('Get dressed', 'dress'), step('Breakfast', 'breakfast')];
    const routineId = newId();
    await family.parent.do('routine.create', {
      routineId,
      kind: 'morning',
      title: 'Morning',
      picture: 'wake',
      steps,
      assignees: [],
      days: [0, 1, 2, 3, 4, 5, 6],
      start: null,
      end: null,
      skip: 'grownup',
    });
    const wall = await pairWall(family);

    // Three children, each ticking the three steps so many minutes after starting at seven.
    const mornings: [string, number[]][] = [
      ['Ash', [1, 9, 14]],
      ['Bea', [0, 6, 10]],
      ['Cal', [2, 12, 20]],
    ];
    for (const [name, minutes] of mornings) {
      const child = await addChild(family, name);
      const runId = newId();
      await wall.do('run.start', { runId, routineId, profileId: child });
      let now = 0;
      for (const [index, minute] of minutes.entries()) {
        server.clock.advance((minute - now) * MINUTE);
        now = minute;
        await wall.do('run.step', { runId, stepId: steps[index]!.id, state: 'done' });
      }
      server.clock.advance(-now * MINUTE);
    }

    // A fourth starts at seven, is called away, and finishes after supper.
    const dee = await addChild(family, 'Dee');
    const late = newId();
    await wall.do('run.start', { runId: late, routineId, profileId: dee });
    await wall.do('run.step', { runId: late, stepId: steps[0]!.id, state: 'done' });
    await wall.do('run.pause', { runId: late });
    server.clock.advance(12 * 60 * MINUTE);
    await wall.do('run.step', { runId: late, stepId: steps[1]!.id, state: 'done' });
    await wall.do('run.step', { runId: late, stepId: steps[2]!.id, state: 'done' });
    server.clock.advance(-12 * 60 * MINUTE);

    const reply = await family.parent.get<{ routines: RoutineRow[] }>('/history/summary?weeks=4');
    expect(reply.status).toBe(200);
    const row = reply.body.routines.find((routine) => routine.routineId === routineId);
    expect(row).toMatchObject({
      title: 'Morning',
      started: 4,
      completed: 4,
      morning: 3,
      afternoon: 0,
      evening: 1,
    });
    expect(row?.timing).toEqual({
      usualMinutes: 14,
      timed: 3,
      setAside: 1,
      longest: { title: 'Get dressed', picture: 'dress', usualMinutes: 8, of: 3 },
    });
    // The answer is about the routine: no child is named in it anywhere.
    expect(JSON.stringify(row)).not.toMatch(/Ash|Bea|Cal|Dee/);
  });

  it('says there is too little to go on rather than guessing from one go', async () => {
    const steps = [step('Pajamas', 'pajamas'), step('Story', 'story')];
    const routineId = newId();
    await family.parent.do('routine.create', {
      routineId,
      kind: 'bedtime',
      title: 'Bedtime',
      picture: 'lightsout',
      steps,
      assignees: [],
      days: [0, 1, 2, 3, 4, 5, 6],
      start: null,
      end: null,
      skip: 'grownup',
    });
    const wall = await pairWall(family, 'Landing');
    const child = await addChild(family, 'Eli');
    const runId = newId();
    await wall.do('run.start', { runId, routineId, profileId: child });
    await wall.do('run.step', { runId, stepId: steps[0]!.id, state: 'done' });
    server.clock.advance(9 * MINUTE);
    await wall.do('run.step', { runId, stepId: steps[1]!.id, state: 'done' });
    server.clock.advance(-9 * MINUTE);

    const reply = await family.parent.get<{ routines: RoutineRow[] }>('/history/summary?weeks=4');
    const row = reply.body.routines.find((routine) => routine.routineId === routineId);
    expect(row?.timing).toEqual({ usualMinutes: null, timed: 1, setAside: 0, longest: null });
    expect(row).toMatchObject({ completed: 1, morning: 1 });
  });

  it('is closed to the wall', async () => {
    const wall = await pairWall(family, 'Hall');
    expect((await wall.get('/history/summary?weeks=4')).status).toBe(403);
  });
});
