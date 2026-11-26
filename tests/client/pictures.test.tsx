import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ACTION_PICTURES,
  AVATARS,
  DAY_PICTURES,
  REWARD_PICTURES,
  SHOPPING_PICTURES,
} from '../../shared/pictures';
import { ACTION_ART, AVATAR_ART, DAY_ART, REWARD_ART, SHOPPING_ART } from '../../src/art/pictures';
import type { Art } from '../../src/art/pictures/kit';

/**
 * A child who cannot read is told what to do by a drawing. A name in the registry with no drawing behind it
 * would show a question mark on the wall, so every name is checked here, and every drawing is checked for the
 * things that have gone wrong before: a broken number, a word inside the picture, a drawing too heavy to move.
 */

const SHEETS: [string, Record<string, unknown>, Partial<Record<string, Art>>][] = [
  ['things to do', ACTION_PICTURES, ACTION_ART],
  ['rewards', REWARD_PICTURES, REWARD_ART],
  ['shopping', SHOPPING_PICTURES, SHOPPING_ART],
  ['days', DAY_PICTURES, DAY_ART],
  ['faces', AVATARS, AVATAR_ART],
];

describe.each(SHEETS)('drawings: %s', (_name, registry, art) => {
  const ids = Object.keys(registry);

  it('has a drawing for every name in the registry', () => {
    expect(ids.filter((id) => !art[id])).toEqual([]);
  });

  it('has no drawing the registry does not know', () => {
    expect(Object.keys(art).filter((id) => !(id in registry))).toEqual([]);
  });

  it.each(ids.filter((id) => art[id]))('%s draws cleanly', (id) => {
    const Draw = art[id]!;
    const markup = renderToStaticMarkup(
      <svg viewBox="0 0 100 100">
        <Draw />
      </svg>,
    );
    expect(markup).not.toMatch(/NaN|undefined|Infinity/);
    // The picture is the word: no lettering inside it (a parent's label goes beside it, in their language).
    expect(markup).not.toMatch(/<text[\s>]/);
    // No gradients, filters or blur: flat shapes only, so sixty of them can be on a wall at once.
    expect(markup).not.toMatch(/<(filter|linearGradient|radialGradient|mask|foreignObject)[\s>]/);
    const shapes = markup.match(/<(path|rect|circle|ellipse|line|polygon|polyline)[\s>]/g)?.length ?? 0;
    expect(shapes).toBeGreaterThan(1);
    expect(shapes).toBeLessThanOrEqual(90);
  });
});
