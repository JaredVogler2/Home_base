import { describe, expect, it } from 'vitest';
import { planLoadFor, timesAWeek, unevenRates, type PlanTemplate } from '../../shared/plan';

const mission = (patch: Partial<PlanTemplate>): PlanTemplate => ({
  status: 'active',
  shared: false,
  assignees: [],
  schedule: { kind: 'daily' },
  stars: 1,
  effort: 1,
  ...patch,
});

describe('what the plan asks of a child', () => {
  it('knows how often each kind of schedule comes round in a week', () => {
    expect(timesAWeek({ kind: 'daily' })).toBe(7);
    expect(timesAWeek({ kind: 'weekdays' })).toBe(5);
    expect(timesAWeek({ kind: 'weekly', days: [1, 3] })).toBe(2);
    expect(timesAWeek({ kind: 'flexible', timesPerWeek: 3 })).toBe(3);
    expect(timesAWeek({ kind: 'once', date: '2026-03-03' })).toBe(0);
  });

  it('adds up a child’s own missions: how many, how much effort, how many stars', () => {
    const plan = [
      mission({ assignees: ['kit'], stars: 2, effort: 2 }),
      mission({ schedule: { kind: 'weekdays' }, stars: 1, effort: 1 }),
      mission({ assignees: ['bo'], stars: 5, effort: 3 }),
    ];
    expect(planLoadFor(plan, 'kit')).toEqual({ missions: 12, effort: 19, stars: 19, rate: 1 });
    expect(planLoadFor(plan, 'bo')).toEqual({ missions: 12, effort: 26, stars: 40, rate: 1.5 });
  });

  it('leaves out what is resting, put away, or for the whole family', () => {
    const plan = [
      mission({ status: 'paused', stars: 9 }),
      mission({ status: 'archived', stars: 9 }),
      mission({ shared: true, stars: 9 }),
    ];
    expect(planLoadFor(plan, 'kit')).toEqual({ missions: 0, effort: 0, stars: 0, rate: null });
  });

  it('says the plan is uneven only when the same effort is worth half as much again to one child', () => {
    const load = (rate: number | null) => ({ missions: 1, effort: 1, stars: 1, rate });
    expect(unevenRates([load(1), load(1.4)])).toBe(false);
    expect(unevenRates([load(1), load(1.5)])).toBe(true);
    // A child the plan asks nothing of is not part of the comparison.
    expect(unevenRates([load(1), load(null)])).toBe(false);
    expect(unevenRates([load(2)])).toBe(false);
  });
});
