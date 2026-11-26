import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '../../shared/ids.js';
import type { OpInput } from '../../shared/ops.js';
import {
  addChild,
  addTask,
  newFamily,
  occurrenceOf,
  pairWall,
  startServer,
  walletOf,
  type Family,
  type TestServer,
} from './harness.js';

let server: TestServer;
beforeAll(async () => {
  server = await startServer({}, '2026-03-03T13:00:00Z'); // Tuesday, 7 a.m. in Chicago
});
afterAll(async () => {
  await server.close();
});

type Steps = OpInput<'routine.create'>['steps'];

function step(title: string, extra: Partial<Steps[number]> = {}): Steps[number] {
  return {
    id: newId(),
    title,
    picture: 'dress',
    say: null,
    seconds: 120,
    needsAdult: false,
    optional: false,
    days: null,
    taskId: null,
    ...extra,
  };
}

async function addRoutine(
  family: Family,
  steps: Steps,
  extra: Partial<OpInput<'routine.create'>> = {},
): Promise<string> {
  const routineId = newId();
  await family.parent.do('routine.create', {
    routineId,
    kind: 'morning',
    title: 'Morning',
    picture: 'wake',
    steps,
    assignees: [],
    days: [0, 1, 2, 3, 4, 5, 6],
    start: '06:00',
    end: '09:30',
    skip: 'grownup',
    ...extra,
  });
  return routineId;
}

describe('running a routine', () => {
  it('goes step by step, at the child’s own speed, and knows when it is finished', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const steps = [step('Wake up'), step('Get dressed'), step('Breakfast')];
    const routine = await addRoutine(family, steps);
    const wall = await pairWall(family);
    const runId = newId();
    await wall.do('run.start', { runId, routineId: routine, profileId: kit });
    expect(wall.snapshot!.runs[0]).toMatchObject({ status: 'active', done: {} });
    await wall.do('run.step', { runId, stepId: steps[0]!.id, state: 'done' });
    // A long breakfast changes nothing: there is no clock on a routine.
    server.clock.advance(55 * 60 * 1000);
    await wall.do('run.step', { runId, stepId: steps[1]!.id, state: 'done' });
    const last = await wall.do('run.step', { runId, stepId: steps[2]!.id, state: 'done' });
    expect(last.completed).toBe(true);
    expect(wall.snapshot!.runs[0]).toMatchObject({ status: 'completed' });
    server.clock.advance(-55 * 60 * 1000);
  });

  it('is one go per child per day, whichever screen opens it, and can be left and come back to', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const steps = [step('One'), step('Two')];
    const routine = await addRoutine(family, steps);
    const wall = await pairWall(family);
    const tablet = await pairWall(family, 'Tablet');
    const first = newId();
    await wall.do('run.start', { runId: first, routineId: routine, profileId: kit });
    await wall.do('run.step', { runId: first, stepId: steps[0]!.id, state: 'done' });
    await wall.do('run.pause', { runId: first });
    // The tablet upstairs opens the same routine: it finds the same go, with step one done.
    const second = await tablet.do('run.start', { runId: newId(), routineId: routine, profileId: kit });
    expect(second.runId).toBe(first);
    expect(tablet.snapshot!.runs).toHaveLength(1);
    expect(tablet.snapshot!.runs[0]).toMatchObject({ status: 'active', done: { [steps[0]!.id]: 'done' } });
  });

  it('counts a tap once, lets a tap be taken back, and records help without judging it', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const steps = [step('One'), step('Two')];
    const routine = await addRoutine(family, steps);
    const wall = await pairWall(family);
    const runId = newId();
    await wall.do('run.start', { runId, routineId: routine, profileId: kit });
    await Promise.all(
      Array.from({ length: 6 }, () => wall.op('run.step', { runId, stepId: steps[0]!.id, state: 'done' })),
    );
    await wall.do('run.step', { runId, stepId: steps[1]!.id, state: 'help' });
    await wall.do('run.step', { runId, stepId: steps[0]!.id, state: 'undo' });
    expect(wall.snapshot!.runs[0]).toMatchObject({ done: {}, help: [steps[1]!.id] });
    const rows = await server.database.db.execute(
      `select count(*)::int as c from homebase.routine_step_events where run_id = '${runId}'`,
    );
    expect((rows.rows[0] as { c: number }).c).toBe(1);
  });

  it('lets a grown-up say “we did that together”, and only a grown-up leave a firm step out', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const steps = [step('Teeth', { needsAdult: true }), step('Coat', { optional: true }), step('Shoes')];
    const routine = await addRoutine(family, steps);
    const wall = await pairWall(family);
    const runId = newId();
    await wall.do('run.start', { runId, routineId: routine, profileId: kit });
    await wall.do('run.together', { runId, stepId: steps[0]!.id });
    // A child may leave out a step marked optional…
    await wall.do('run.step', { runId, stepId: steps[1]!.id, state: 'skipped' });
    // …and not one that is not.
    expect(await wall.op('run.step', { runId, stepId: steps[2]!.id, state: 'skipped' })).toMatchObject({
      reason: 'forbidden',
    });
    await family.parent.do('run.step', { runId, stepId: steps[2]!.id, state: 'skipped' });
    expect(wall.snapshot === null).toBe(false);
    const run = (await wall.pull()).runs[0];
    expect(run).toMatchObject({
      status: 'completed',
      done: { [steps[0]!.id]: 'together', [steps[1]!.id]: 'skipped', [steps[2]!.id]: 'skipped' },
    });
  });

  it('shows only the steps that belong to the day', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const steps = [
      step('Dress'),
      step('Backpack', { days: [1, 2, 3, 4, 5] }),
      step('Swim bag', { days: [6] }),
    ];
    const routine = await addRoutine(family, steps);
    const wall = await pairWall(family);
    await wall.do('run.start', { runId: newId(), routineId: routine, profileId: kit });
    expect(wall.snapshot!.runs[0]?.steps.map((s) => s.title)).toEqual(['Dress', 'Backpack']);
  });

  it('carries on with the steps it began with when a parent edits the routine half-way', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const steps = [step('One'), step('Two')];
    const routine = await addRoutine(family, steps);
    const wall = await pairWall(family);
    const runId = newId();
    await wall.do('run.start', { runId, routineId: routine, profileId: kit });
    await wall.do('run.step', { runId, stepId: steps[0]!.id, state: 'done' });
    await family.parent.do('routine.update', {
      routineId: routine,
      baseVersion: 1,
      kind: 'morning',
      title: 'New morning',
      picture: 'wake',
      steps: [step('Completely'), step('Different'), step('Steps')],
      assignees: [],
      days: [0, 1, 2, 3, 4, 5, 6],
      start: null,
      end: null,
      skip: 'grownup',
    });
    const snapshot = await wall.pull();
    expect(snapshot.routines[0]).toMatchObject({ title: 'New morning', version: 2 });
    expect(snapshot.runs[0]).toMatchObject({ routineVersion: 1 });
    expect(snapshot.runs[0]?.steps.map((s) => s.title)).toEqual(['One', 'Two']);
    const done = await wall.do('run.step', { runId, stepId: steps[1]!.id, state: 'done' });
    expect(done.completed).toBe(true);
  });
});

describe('a step that is also a mission', () => {
  it('gives the mission’s stars once, whether the step or the mission is tapped first, or both', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const bo = await addChild(family, 'Bo');
    const teeth = await addTask(family, { stars: 2, title: 'Brush teeth' });
    const steps = [step('Brush teeth', { taskId: teeth }), step('Pajamas')];
    const routine = await addRoutine(family, steps);
    const wall = await pairWall(family);

    // Kit does it from the routine: the mission is done, the stars come once.
    const kitRun = newId();
    await wall.do('run.start', { runId: kitRun, routineId: routine, profileId: kit });
    const viaStep = await wall.do('run.step', { runId: kitRun, stepId: steps[0]!.id, state: 'done' });
    expect(viaStep.starsGiven).toBe(2);
    expect(occurrenceOf(wall.snapshot!, teeth, kit).status).toBe('approved');
    await wall.op('occurrence.submit', {
      occurrenceId: occurrenceOf(wall.snapshot!, teeth, kit).id,
      profileId: kit,
    });
    expect(walletOf(wall.snapshot!, kit)).toMatchObject({ available: 2, lifetime: 2 });

    // Bo does the mission first, then meets the step.
    await wall.do('occurrence.submit', {
      occurrenceId: occurrenceOf(wall.snapshot!, teeth, bo).id,
      profileId: bo,
    });
    const boRun = newId();
    await wall.do('run.start', { runId: boRun, routineId: routine, profileId: bo });
    const after = await wall.do('run.step', { runId: boRun, stepId: steps[0]!.id, state: 'done' });
    expect(after.starsGiven).toBe(0);
    expect(walletOf(wall.snapshot!, bo)).toMatchObject({ available: 2, lifetime: 2 });
  });

  it('gives nothing for the routine itself unless the family has decided it should', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const steps = [step('Only')];
    const routine = await addRoutine(family, steps);
    const wall = await pairWall(family);
    const runId = newId();
    await wall.do('run.start', { runId, routineId: routine, profileId: kit });
    await wall.do('run.step', { runId, stepId: steps[0]!.id, state: 'done' });
    expect(walletOf(wall.snapshot!, kit).lifetime).toBe(0);

    await family.parent.do('household.settings', { patch: { routines: { awardStars: true, stars: 1 } } });
    const bo = await addChild(family, 'Bo');
    const boRun = newId();
    await wall.do('run.start', { runId: boRun, routineId: routine, profileId: bo });
    await wall.do('run.step', { runId: boRun, stepId: steps[0]!.id, state: 'done' });
    // Tapping it again, undoing and redoing: still one star.
    await wall.do('run.step', { runId: boRun, stepId: steps[0]!.id, state: 'undo' });
    await wall.do('run.step', { runId: boRun, stepId: steps[0]!.id, state: 'done' });
    expect(walletOf(wall.snapshot!, bo)).toMatchObject({ available: 1, lifetime: 1 });
  });
});

describe('designing routines', () => {
  it('copies a routine with steps of its own, and pauses one without losing it', async () => {
    const family = await newFamily(server);
    await addChild(family, 'Kit');
    const steps = [step('One'), step('Two')];
    const routine = await addRoutine(family, steps);
    const copy = newId();
    await family.parent.do('routine.clone', {
      routineId: routine,
      newRoutineId: copy,
      title: 'Weekend morning',
    });
    const routines = (await family.parent.pull()).routines;
    const cloned = routines.find((r) => r.id === copy);
    expect(cloned?.title).toBe('Weekend morning');
    expect(cloned?.steps.map((s) => s.title)).toEqual(['One', 'Two']);
    expect(cloned?.steps.map((s) => s.id)).not.toEqual(steps.map((s) => s.id));

    await family.parent.do('routine.status', { routineId: routine, status: 'paused' });
    const wall = await pairWall(family);
    expect((await wall.pull()).routines.map((r) => r.id)).toEqual([copy]);
    expect((await family.parent.pull()).routines.map((r) => r.status).sort()).toEqual(['active', 'paused']);
  });

  it('refuses a routine with no steps, a step pointing at a mission that is not there, or half a time window', async () => {
    const family = await newFamily(server);
    const base = {
      kind: 'morning' as const,
      title: 'M',
      picture: 'wake' as const,
      assignees: [],
      days: [1],
      skip: 'grownup' as const,
    };
    expect(
      await family.parent.op('routine.create', {
        ...base,
        routineId: newId(),
        steps: [],
        start: null,
        end: null,
      }),
    ).toMatchObject({ reason: 'invalid' });
    expect(
      await family.parent.op('routine.create', {
        ...base,
        routineId: newId(),
        steps: [step('x', { taskId: newId() })],
        start: null,
        end: null,
      }),
    ).toMatchObject({ reason: 'invalid' });
    expect(
      await family.parent.op('routine.create', {
        ...base,
        routineId: newId(),
        steps: [step('x')],
        start: '07:00',
        end: null,
      }),
    ).toMatchObject({ reason: 'invalid' });
  });
});
