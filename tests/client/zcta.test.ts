import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { encodeTable, parseGazetteer } from '../../scripts/build-zcta';
import { findZip, lookupZip, parseZipTable } from '../../src/lib/zcta';

/**
 * ZIP code to coarse position, on the phone. A tiny table made here tests the search; the real table, when it has
 * been built, is checked for one well-known ZIP code.
 */

const tiny = encodeTable([
  { zip: 501, lat: 40.81, lon: -73.05 },
  { zip: 10001, lat: 40.75, lon: -73.99 },
  { zip: 64108, lat: 39.08, lon: -94.58 },
  { zip: 96813, lat: 21.31, lon: -157.85 },
]);
const tinyBuffer = (): ArrayBuffer => tiny.slice().buffer as ArrayBuffer;

describe('the ZIP code table', () => {
  it('finds every ZIP code in it, and nothing else', () => {
    const table = parseZipTable(tinyBuffer());
    expect(table.count).toBe(4);
    expect(findZip(table, 501)).toEqual({ lat: 40.81, lon: -73.05 });
    expect(findZip(table, 10001)).toEqual({ lat: 40.75, lon: -73.99 });
    expect(findZip(table, 64108)).toEqual({ lat: 39.08, lon: -94.58 });
    expect(findZip(table, 96813)).toEqual({ lat: 21.31, lon: -157.85 });
    for (const missing of [0, 500, 502, 10000, 64109, 99999]) expect(findZip(table, missing)).toBeNull();
  });

  it('refuses anything that is not a table', () => {
    expect(() => parseZipTable(new ArrayBuffer(4))).toThrow();
    expect(() =>
      parseZipTable(new TextEncoder().encode('NOPE\u0000\u0000\u0000\u0000').buffer as ArrayBuffer),
    ).toThrow();
    expect(() => parseZipTable(tiny.slice(0, tiny.length - 1).buffer as ArrayBuffer)).toThrow(/wrong size/);
    expect(parseZipTable(encodeTable([]).buffer as ArrayBuffer).count).toBe(0);
  });

  it('is built from the gazetteer, tab- or pipe-separated, keeping only sensible rows', () => {
    const tabs = [
      'GEOID\tALAND\tAWATER\tALAND_SQMI\tAWATER_SQMI\tINTPTLAT\tINTPTLONG                 ',
      '64108\t1\t2\t3\t4\t39.084512\t-94.583188            ',
      '10001\t1\t2\t3\t4\t40.750633\t-73.997177',
      'ABCDE\t1\t2\t3\t4\t40\t-73',
      '96813\t1\t2\t3\t4\tnot\ta number',
      '',
    ].join('\n');
    expect(parseGazetteer(tabs)).toEqual([
      { zip: 10001, lat: 40.75, lon: -74 },
      { zip: 64108, lat: 39.08, lon: -94.58 },
    ]);
    const pipes = [
      'GEOID|GEOIDFQ|ALAND|INTPTLAT|INTPTLONG',
      '96813|x|1|21.3|-157.85',
      '96910|x|1|13.45|+144.75',
    ].join('\r\n');
    expect(parseGazetteer(pipes)).toEqual([
      { zip: 96813, lat: 21.3, lon: -157.85 },
      { zip: 96910, lat: 13.45, lon: 144.75 },
    ]);
    expect(() => parseGazetteer('NAME\tWHATEVER\n1\t2')).toThrow(/columns/);
  });
});

describe('lookupZip', () => {
  it('looks up a five-digit ZIP code, loading the table only once', async () => {
    let loads = 0;
    const load = async () => {
      loads++;
      return tinyBuffer();
    };
    expect(await lookupZip('64108', load)).toEqual({ lat: 39.08, lon: -94.58 });
    expect(await lookupZip(' 10001 ', load)).toEqual({ lat: 40.75, lon: -73.99 });
    expect(await lookupZip('00501', load)).toEqual({ lat: 40.81, lon: -73.05 });
    expect(await lookupZip('99999', load)).toBeNull();
    expect(loads).toBe(1);
  });

  it('does not even load the table for something that is not a ZIP code', async () => {
    const load = async (): Promise<ArrayBuffer> => {
      throw new Error('should not be loaded');
    };
    for (const text of ['', '6410', '641088', '64108-1234', 'abcde', '6410a', '1e4']) {
      expect(await lookupZip(text, load)).toBeNull();
    }
  });

  it('tries again after a failed load', async () => {
    let attempts = 0;
    const load = async () => {
      attempts++;
      if (attempts === 1) throw new Error('offline');
      return tinyBuffer();
    };
    await expect(lookupZip('64108', load)).rejects.toThrow('offline');
    expect(await lookupZip('64108', load)).toEqual({ lat: 39.08, lon: -94.58 });
  });
});

// A plain path: under happy-dom the global URL is not the one node:fs understands.
const realFile = join(dirname(fileURLToPath(import.meta.url)), '../../public/data/zcta.bin');

describe.skipIf(!existsSync(realFile))('the real table in public/data', () => {
  it('holds the Census Bureau’s areas and finds 64108 near 39.1,-94.6', async () => {
    const bytes = readFileSync(realFile);
    const load = async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const table = parseZipTable(await load());
    expect(table.count).toBeGreaterThan(30_000);
    expect(table.count).toBeLessThan(40_000);

    const found = await lookupZip('64108', load);
    expect(found).not.toBeNull();
    expect(Math.abs(found!.lat - 39.1)).toBeLessThan(0.1);
    expect(Math.abs(found!.lon - -94.6)).toBeLessThan(0.1);
    expect(await lookupZip('99999', load)).toBeNull();
  });
});
