import { describe, expect, it } from 'vitest';
import { ladderFor } from '../../src/lib/photos';

/** Which copies the phone makes of a photo, by the original's width. */

describe('the ladder of copies', () => {
  it('makes the usual three of a large photo, largest first', () => {
    expect(ladderFor(2500)).toEqual([2500, 1920, 960]);
    expect(ladderFor(4032)).toEqual([3840, 1920, 960]);
    expect(ladderFor(6000)).toEqual([3840, 1920, 960]);
  });

  it('never makes a copy wider than the original, nor the same width twice', () => {
    expect(ladderFor(800)).toEqual([800]);
    expect(ladderFor(960)).toEqual([960]);
    expect(ladderFor(1920)).toEqual([1920, 960]);
    expect(ladderFor(1000)).toEqual([1000, 960]);
    expect(ladderFor(3840)).toEqual([3840, 1920, 960]);
  });

  it('is never empty', () => {
    for (const width of [160, 500, 959, 961, 1919, 1921, 3839, 3841, 10000]) {
      const ladder = ladderFor(width);
      expect(ladder.length).toBeGreaterThan(0);
      expect(Math.max(...ladder)).toBe(Math.min(width, 3840));
      expect([...ladder].sort((a, b) => b - a)).toEqual(ladder);
    }
  });
});
