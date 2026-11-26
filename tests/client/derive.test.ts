import { describe, expect, it } from 'vitest';
import type { Occurrence, Redemption, Snapshot, Weather } from '../../shared/model';
import { gladTidings, wearFor } from '../../src/wall/derive';
import { keepsUp, summarise } from '../../src/wall/pace';

const weather = (patch: Partial<Weather>): Weather => ({
  state: 'clear',
  temperature: 68,
  units: 'us',
  at: '2026-03-03T18:00:00Z',
  stale: false,
  ...patch,
});

describe('what to put on before going out', () => {
  it('says nothing when there is no weather, or only old news of it', () => {
    expect(wearFor(null)).toBeNull();
    expect(wearFor(weather({ state: 'rain', stale: true }))).toBeNull();
  });

  it('is an umbrella for anything wet', () => {
    expect(wearFor(weather({ state: 'rain' }))).toBe('umbrella');
    expect(wearFor(weather({ state: 'drizzle' }))).toBe('umbrella');
    expect(wearFor(weather({ state: 'storm' }))).toBe('umbrella');
  });

  it('is a coat for snow and for cold, in either kind of degrees', () => {
    expect(wearFor(weather({ state: 'snow', temperature: 30 }))).toBe('coat');
    expect(wearFor(weather({ state: 'cloudy', temperature: 40 }))).toBe('coat');
    expect(wearFor(weather({ state: 'cloudy', temperature: 5, units: 'metric' }))).toBe('coat');
    expect(wearFor(weather({ state: 'cloudy', temperature: 50 }))).toBeNull();
  });

  it('is a sun hat only when it is hot and the sun is out', () => {
    expect(wearFor(weather({ state: 'clear', temperature: 88 }))).toBe('hat');
    expect(wearFor(weather({ state: 'partly', temperature: 30, units: 'metric' }))).toBe('hat');
    expect(wearFor(weather({ state: 'cloudy', temperature: 88 }))).toBeNull();
    expect(wearFor(weather({ state: 'clear', temperature: 70 }))).toBeNull();
    expect(wearFor(weather({ state: 'clear', temperature: null }))).toBeNull();
  });
});

const KIT = 'kit';
const BO = 'bo';

function view(patch: Partial<Pick<Snapshot, 'badges' | 'occurrences' | 'redemptions'>>, household = 'h1') {
  return {
    household: { id: household },
    badges: [],
    occurrences: [],
    redemptions: [],
    ...patch,
  } as unknown as Snapshot;
}

const mission = (patch: Partial<Occurrence>): Occurrence =>
  ({
    id: 'o1',
    profileId: KIT,
    doneBy: KIT,
    status: 'submitted',
    credited: false,
    stars: 2,
    verification: 'guardian',
    ...patch,
  }) as Occurrence;

const treat = (patch: Partial<Redemption>): Redemption =>
  ({ id: 'r1', profileId: KIT, status: 'requested', title: 'Family game', ...patch }) as Redemption;

describe('glad tidings', () => {
  it('has nothing to say when nobody is at the wall, or the household changed underneath', () => {
    const before = view({ occurrences: [mission({})] });
    const after = view({ occurrences: [mission({ status: 'approved', credited: true })] });
    expect(gladTidings(before, after, null)).toEqual([]);
    expect(gladTidings(before, view({ occurrences: after.occurrences }, 'h2'), KIT)).toEqual([]);
  });

  it('cheers when a grown-up says yes to a waiting mission — for that child only', () => {
    const before = view({ occurrences: [mission({}), mission({ id: 'o2', stars: 3 })] });
    const after = view({
      occurrences: [
        mission({ status: 'approved', credited: true }),
        mission({ id: 'o2', stars: 3, status: 'approved', credited: true }),
      ],
    });
    expect(gladTidings(before, after, KIT)).toEqual([{ kind: 'stars', stars: 5 }]);
    expect(gladTidings(before, after, BO)).toEqual([]);
  });

  it('does not call a mission that needs no grown-up "a grown-up said yes"', () => {
    // The moment between a child's tap and the server's answer looks like waiting; it is not.
    const before = view({ occurrences: [mission({ verification: 'auto' })] });
    const after = view({
      occurrences: [mission({ verification: 'auto', status: 'approved', credited: true })],
    });
    expect(gladTidings(before, after, KIT)).toEqual([]);
  });

  it('says nothing about a mission sent back, or one that was already settled', () => {
    const before = view({
      occurrences: [mission({}), mission({ id: 'o2', status: 'approved', credited: true })],
    });
    const after = view({
      occurrences: [
        mission({ status: 'returned' }),
        mission({ id: 'o2', status: 'approved', credited: true }),
      ],
    });
    expect(gladTidings(before, after, KIT)).toEqual([]);
  });

  it('counts a mission done for the whole family for the child who did it', () => {
    const before = view({ occurrences: [mission({ profileId: null, doneBy: BO })] });
    const after = view({
      occurrences: [mission({ profileId: null, doneBy: BO, status: 'approved', credited: true })],
    });
    expect(gladTidings(before, after, BO)).toEqual([{ kind: 'stars', stars: 2 }]);
    expect(gladTidings(before, after, KIT)).toEqual([]);
  });

  it('announces a new badge once, and a reward agreed or handed over', () => {
    const before = view({
      badges: [{ profileId: KIT, badge: 'first-star', earnedOn: '2026-03-01' }],
      redemptions: [treat({}), treat({ id: 'r2', status: 'approved', title: 'Park trip' })],
    });
    const after = view({
      badges: [
        { profileId: KIT, badge: 'first-star', earnedOn: '2026-03-01' },
        { profileId: KIT, badge: 'stars-10', earnedOn: '2026-03-03' },
        { profileId: BO, badge: 'first-star', earnedOn: '2026-03-03' },
      ],
      redemptions: [
        treat({ status: 'approved' }),
        treat({ id: 'r2', status: 'fulfilled', title: 'Park trip' }),
        treat({ id: 'r3', status: 'approved', title: 'New today' }),
      ],
    });
    expect(gladTidings(before, after, KIT)).toEqual([
      { kind: 'badge', badge: 'stars-10' },
      { kind: 'reward-yes', title: 'Family game' },
      { kind: 'reward-done', title: 'Park trip' },
    ]);
    expect(gladTidings(after, after, KIT)).toEqual([]);
  });
});

describe('whether the display keeps up', () => {
  const steady = (ms: number, count = 120) => Array.from({ length: count }, () => ms);

  it('is happy with a display that draws sixty or thirty frames a second', () => {
    expect(keepsUp(summarise(steady(16.7)))).toBe(true);
    expect(keepsUp(summarise(steady(33.4)))).toBe(true);
  });

  it('gives up the ambient movement on a display that cannot manage thirty', () => {
    expect(keepsUp(summarise(steady(50)))).toBe(false);
    expect(keepsUp(summarise(steady(120, 25)))).toBe(false);
  });

  it('is not fooled by a few slow frames among many good ones', () => {
    expect(keepsUp(summarise([...steady(16.7, 100), 250, 180, 90]))).toBe(true);
  });

  it('is not fooled the other way either: most frames on time and a good many late is not keeping up', () => {
    // What a 4K wall drawn without a graphics card did: 22 frames a second, with a respectable middle frame.
    const uneven = [...steady(33.3, 70), ...steady(66.7, 50)];
    const sample = summarise(uneven);
    expect(sample.median).toBeCloseTo(33.3);
    expect(1000 / sample.mean).toBeLessThan(23);
    expect(keepsUp(sample)).toBe(false);
  });

  it('does not judge on too little: a page in the background draws nothing', () => {
    expect(keepsUp(summarise([]))).toBeNull();
    expect(keepsUp(summarise(steady(200, 5)))).toBeNull();
  });
});
