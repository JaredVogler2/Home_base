import { describe, expect, it } from 'vitest';
import { mix, mix3, ramp } from '../../src/art/colour';
import { lookOfSky, seasonOf } from '../../src/wall/sky';

describe('mixing colours', () => {
  it('goes from one to the other, and a mix can be mixed again', () => {
    expect(mix('#000000', '#ffffff', 0)).toBe('rgb(0 0 0)');
    expect(mix('#000000', '#ffffff', 1)).toBe('rgb(255 255 255)');
    expect(mix('#000000', '#ffffff', 0.5)).toBe('rgb(128 128 128)');
    expect(mix(mix('#000000', '#ffffff', 0.5), '#ffffff', 1)).toBe('rgb(255 255 255)');
    expect(mix3('#000000', '#808080', '#ffffff', 0.5)).toBe('rgb(128 128 128)');
  });

  it('runs through any number of colours, and holds the ends', () => {
    const stops = [
      [0, '#000000'],
      [0.5, '#ff0000'],
      [1, '#ffffff'],
    ] as const;
    expect(ramp(stops, -1)).toBe('rgb(0 0 0)');
    expect(ramp(stops, 0)).toBe('rgb(0 0 0)');
    expect(ramp(stops, 0.25)).toBe('rgb(128 0 0)');
    expect(ramp(stops, 0.5)).toBe('rgb(255 0 0)');
    expect(ramp(stops, 0.75)).toBe('rgb(255 128 128)');
    expect(ramp(stops, 2)).toBe('rgb(255 255 255)');
  });
});

describe('the look of the sky', () => {
  const kansasCity = { lat: 39.1, lon: -94.58 };
  const at = (iso: string, extra: Partial<Parameters<typeof lookOfSky>[0]> = {}) =>
    lookOfSky({
      ms: Date.parse(iso),
      timeZone: 'America/Chicago',
      location: kansasCity,
      daylight: true,
      weather: null,
      decor: 'auto',
      ...extra,
    });

  it('never hands the picture a colour that is not a colour', () => {
    for (const hour of ['00', '05', '07', '08', '12', '16', '17', '18', '21']) {
      for (const weather of [null, 'clear', 'cloudy', 'rain', 'snow', 'fog'] as const) {
        const look = at(`2026-11-25T${hour}:30:00-06:00`, { weather });
        for (const [name, value] of Object.entries(look.vars)) {
          expect(value, `${name} at ${hour}:30 in ${String(weather)}`).not.toMatch(/NaN|undefined/);
        }
      }
    }
  });

  it('is light at midday and dark at midnight, with the sun or the moon in it', () => {
    const noon = at('2026-06-21T12:30:00-05:00');
    expect(noon.now.phase).toBe('day');
    expect(noon.lamps).toBe(0);
    expect(noon.body?.kind).toBe('sun');
    const midnight = at('2026-06-21T00:30:00-05:00');
    expect(midnight.now.phase).toBe('night');
    expect(midnight.lamps).toBe(1);
    expect(midnight.body?.kind).toBe('moon');
    expect(Number(midnight.vars['--stars'])).toBeGreaterThan(0.5);
  });

  it('follows the real sun: light late on a June evening, dark early on a December one', () => {
    expect(at('2026-06-21T20:15:00-05:00').now.light).toBeGreaterThan(0.5);
    expect(at('2026-12-21T17:45:00-06:00').now.light).toBeLessThan(0.3);
  });

  it('warms the low sky as the sun goes down, and not under heavy cloud', () => {
    const channels = (value: string | undefined) => (value?.match(/\d+/g) ?? []).map(Number);
    // About twenty minutes before sunset in Kansas City at the end of November.
    const golden = at('2026-11-25T16:40:00-06:00');
    const [red = 0, , blue = 0] = channels(golden.vars['--sky-low']);
    expect(red - blue).toBeGreaterThan(40);
    const overcast = at('2026-11-25T16:40:00-06:00', { weather: 'rain' });
    const [greyRed = 0, , greyBlue = 0] = channels(overcast.vars['--sky-low']);
    expect(Math.abs(greyRed - greyBlue)).toBeLessThan(red - blue);
    // At midday the low sky is cool again.
    const [noonRed = 0, , noonBlue = 0] = channels(at('2026-11-25T12:00:00-06:00').vars['--sky-low']);
    expect(noonBlue).toBeGreaterThanOrEqual(noonRed);
  });

  it('hides the stars and greys the sky under cloud', () => {
    const clear = at('2026-06-21T00:30:00-05:00', { weather: 'clear' });
    const rain = at('2026-06-21T00:30:00-05:00', { weather: 'rain' });
    expect(Number(rain.vars['--stars'])).toBeLessThan(Number(clear.vars['--stars']));
    expect(rain.cloud).toBeGreaterThan(clear.cloud);
  });

  it('keeps a plain daytime sky for a family that asks for one', () => {
    const look = at('2026-06-21T00:30:00-05:00', { daylight: false });
    expect(look.now.phase).toBe('day');
    expect(look.lamps).toBe(0);
  });

  it('works by the clock where the family has not said where it lives', () => {
    const morning = at('2026-06-21T09:00:00-05:00', { location: null });
    const night = at('2026-06-21T23:00:00-05:00', { location: null });
    expect(morning.now.phase).toBe('day');
    expect(night.now.phase).toBe('night');
  });

  it('knows the seasons are the other way round south of the equator', () => {
    expect(seasonOf(7, 40)).toBe('summer');
    expect(seasonOf(7, -34)).toBe('winter');
    expect(seasonOf(10, null)).toBe('autumn');
    expect(seasonOf(1, -34)).toBe('summer');
  });
});
