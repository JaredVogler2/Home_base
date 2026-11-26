import { describe, expect, it } from 'vitest';
import { hazardsIn } from '../../shared/safety';

describe('a second look at a mission', () => {
  it('lets the ordinary things a small child does go by', () => {
    for (const title of [
      'Shoes in the basket',
      'Put the blocks away',
      'Help set the table',
      'Brush teeth',
      'Bring the laundry',
      'Water the plant',
      'Feed the pet',
      'A kind thing',
    ]) {
      expect(hazardsIn(title), title).toEqual([]);
    }
  });

  it('notices heat, blades, chemicals, heights, water, traffic and fire', () => {
    expect(hazardsIn('Turn on the stove')).toContain('heat');
    expect(hazardsIn('Chop the carrots with a knife')).toContain('sharp things');
    expect(hazardsIn('Clean the sink', 'use the bleach')).toContain('chemicals or medicine');
    expect(hazardsIn('Clean the gutter from the ladder')).toContain('heights');
    expect(hazardsIn('Skim the pool')).toContain('water');
    expect(hazardsIn('Take the bins to the road')).toContain('traffic or machines');
    expect(hazardsIn('Light the candle')).toContain('fire');
    expect(hazardsIn('Watch your brother')).toContain('looking after another child');
  });

  it('is not fooled by a word inside another word', () => {
    expect(hazardsIn('Read a book about firefighters')).toEqual([]);
    expect(hazardsIn('Put on the broad hat')).toEqual([]);
    expect(hazardsIn('Find the ironing board picture')).toContain('heat');
  });
});
