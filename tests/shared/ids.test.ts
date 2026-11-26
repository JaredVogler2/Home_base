import { afterEach, describe, expect, it, vi } from 'vitest';
import { isUuid, newId } from '../../shared/ids';

/**
 * Every tap on a screen is named with an id made on that screen. A browser withholds `crypto.randomUUID` from a
 * page that was not fetched securely — a wall tried at a plain http address on the home network, say — and a
 * house that could not name a tap there would not work at all.
 */
describe('ids made on a screen', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('are version-4 UUIDs, and different every time', () => {
    const made = new Set(Array.from({ length: 200 }, () => newId()));
    expect(made.size).toBe(200);
    for (const id of made) {
      expect(isUuid(id)).toBe(true);
      expect(id[14]).toBe('4');
    }
  });

  it('are still made where the browser withholds randomUUID (a plain http address)', () => {
    const real = globalThis.crypto;
    // What a page on a not-secure address sees: the random numbers, without the convenience.
    vi.stubGlobal('crypto', { getRandomValues: real.getRandomValues.bind(real) });
    expect('randomUUID' in globalThis.crypto).toBe(false);
    const made = new Set(Array.from({ length: 200 }, () => newId()));
    expect(made.size).toBe(200);
    for (const id of made) {
      expect(isUuid(id)).toBe(true);
      expect(id[14]).toBe('4');
      expect('89ab').toContain(id[19]);
    }
  });
});
