import { describe, expect, it } from 'vitest';
import { BADGE_IDS, BADGES, badgesFor, isBadgeId, type BadgeCounts } from '../../shared/badges.js';

const NOTHING: BadgeCounts = {
  lifetime: 0,
  kind: 0,
  shared: 0,
  mornings: 0,
  bedtimes: 0,
  routines: 0,
  bigRewards: 0,
  helpAsked: 0,
};

describe('badges', () => {
  it('gives nothing for nothing', () => {
    expect(badgesFor(NOTHING)).toEqual([]);
  });

  it('counts stars ever earned, a step at a time', () => {
    expect(badgesFor({ ...NOTHING, lifetime: 1 })).toEqual(['first-star']);
    expect(badgesFor({ ...NOTHING, lifetime: 9 })).toEqual(['first-star']);
    expect(badgesFor({ ...NOTHING, lifetime: 10 })).toEqual(['first-star', 'stars-10']);
    expect(badgesFor({ ...NOTHING, lifetime: 250 })).toEqual([
      'first-star',
      'stars-10',
      'stars-25',
      'stars-50',
      'stars-100',
      'stars-250',
    ]);
  });

  it('is for things that add up: kindness, family jobs, routines, saving, asking for help', () => {
    expect(badgesFor({ ...NOTHING, kind: 4 })).toEqual([]);
    expect(badgesFor({ ...NOTHING, kind: 5 })).toEqual(['kind-heart']);
    expect(badgesFor({ ...NOTHING, shared: 5 })).toEqual(['team-mate']);
    expect(badgesFor({ ...NOTHING, mornings: 5 })).toEqual(['sunrise']);
    expect(badgesFor({ ...NOTHING, bedtimes: 5 })).toEqual(['moonlight']);
    expect(badgesFor({ ...NOTHING, routines: 19 })).toEqual([]);
    expect(badgesFor({ ...NOTHING, routines: 20 })).toEqual(['steady-steps']);
    expect(badgesFor({ ...NOTHING, bigRewards: 1 })).toEqual(['saver']);
    expect(badgesFor({ ...NOTHING, helpAsked: 3 })).toEqual(['brave-asker']);
  });

  it('never needs days in a row, and has something to say for every badge', () => {
    for (const id of BADGE_IDS) {
      expect(isBadgeId(id)).toBe(true);
      expect(BADGES[id].say.length).toBeGreaterThan(5);
      // No badge is for a streak, for speed, or for beating anybody.
      expect(`${BADGES[id].label} ${BADGES[id].say}`).not.toMatch(
        /streak|in a row|fastest|first place|winner|beat/i,
      );
    }
    expect(isBadgeId('streak-7')).toBe(false);
    expect(isBadgeId('constructor')).toBe(false);
  });
});
