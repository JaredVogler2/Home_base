/**
 * Builds public/data/zcta.bin: every US ZIP Code Tabulation Area with the middle of its area, rounded to two
 * decimal places, so that a parent's phone can turn a ZIP code into a coarse position by itself. The ZIP code is
 * never sent anywhere; only the rounded position is saved in the household's settings.
 *
 * The source is the U.S. Census Bureau's ZCTA gazetteer file, which is public domain:
 *   https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html
 * The newest year that exists is used (this year's, else last year's, …).
 *
 *   npx tsx scripts/build-zcta.ts [--work <folder>]
 *
 * The download goes into a working folder outside the repository (default: the system's temporary folder), and
 * is treated as untrusted: its size is capped, the zip is listed and read with `unzip` (nothing in it is run or
 * written out under its own name), and every line is checked before it is used. Behind an HTTPS proxy, run it
 * with NODE_USE_ENV_PROXY=1 so that Node's fetch uses the proxy.
 *
 * The file's layout (all numbers little-endian):
 *
 *   offset 0   4 bytes   the ASCII letters "ZCT1"
 *   offset 4   uint32    how many records follow
 *   offset 8   records, 8 bytes each, sorted by ZIP code with no ZIP code twice:
 *                uint32  the ZIP code as a number (00501 is 501)
 *                int16   latitude  × 100
 *                int16   longitude × 100
 *
 * src/lib/zcta.ts reads it.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAGIC = 'ZCT1';
const MAX_DOWNLOAD_BYTES = 20_000_000;
const MAX_TEXT_BYTES = 50_000_000;

export interface ZipPosition {
  zip: number;
  lat: number;
  lon: number;
}

/**
 * Read the gazetteer's text, keeping only rows that make sense. Up to 2025 the columns were separated by tabs;
 * from 2026 by "|". Whichever the header uses is used for every line.
 */
export function parseGazetteer(text: string): ZipPosition[] {
  const lines = text.split(/\r?\n/);
  const first = lines[0] ?? '';
  const separator = first.includes('|') ? '|' : '\t';
  const header = first.split(separator).map((name) => name.trim().toUpperCase());
  const geoid = header.indexOf('GEOID');
  const latAt = header.indexOf('INTPTLAT');
  const lonAt = header.indexOf('INTPTLONG');
  if (geoid < 0 || latAt < 0 || lonAt < 0)
    throw new Error('The gazetteer does not have the expected columns.');

  const byZip = new Map<number, ZipPosition>();
  let skipped = 0;
  for (const line of lines.slice(1)) {
    if (line.trim() === '') continue;
    const cells = line.split(separator).map((cell) => cell.trim());
    const code = cells[geoid] ?? '';
    const lat = Number(cells[latAt]);
    const lon = Number(cells[lonAt]);
    if (
      !/^\d{5}$/.test(code) ||
      !/^[+-]?\d{1,3}(\.\d+)?$/.test(cells[latAt] ?? '') ||
      !/^[+-]?\d{1,3}(\.\d+)?$/.test(cells[lonAt] ?? '') ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    ) {
      skipped++;
      continue;
    }
    const zip = Number(code);
    if (byZip.has(zip)) {
      skipped++;
      continue;
    }
    byZip.set(zip, { zip, lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 });
  }
  if (skipped > 0) console.warn(`Skipped ${skipped} line(s) that did not make sense.`);
  return [...byZip.values()].sort((a, b) => a.zip - b.zip);
}

/** Write the table in the layout described at the top of this file. */
export function encodeTable(rows: readonly ZipPosition[]): Uint8Array {
  const sorted = [...rows].sort((a, b) => a.zip - b.zip);
  const bytes = new Uint8Array(8 + sorted.length * 8);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < 4; i++) bytes[i] = MAGIC.charCodeAt(i);
  view.setUint32(4, sorted.length, true);
  let previous = -1;
  sorted.forEach((row, index) => {
    if (!Number.isInteger(row.zip) || row.zip < 0 || row.zip > 99_999 || row.zip === previous) {
      throw new Error(`Not a ZIP code that can be stored: ${row.zip}`);
    }
    previous = row.zip;
    const at = 8 + index * 8;
    view.setUint32(at, row.zip, true);
    view.setInt16(at + 4, Math.round(row.lat * 100), true);
    view.setInt16(at + 6, Math.round(row.lon * 100), true);
  });
  return bytes;
}

async function download(work: string): Promise<{ zipFile: string; year: number }> {
  const thisYear = new Date().getFullYear();
  for (const year of [thisYear, thisYear - 1, thisYear - 2]) {
    const url = `https://www2.census.gov/geo/docs/maps-data/data/gazetteer/${year}_Gazetteer/${year}_Gaz_zcta_national.zip`;
    const response = await fetch(url, { redirect: 'error' });
    if (response.status === 404) {
      await response.body?.cancel();
      continue;
    }
    if (!response.ok) throw new Error(`The Census Bureau answered ${response.status} for ${url}`);
    const body = new Uint8Array(await response.arrayBuffer());
    if (body.byteLength > MAX_DOWNLOAD_BYTES) throw new Error('The download is far larger than expected.');
    if (body[0] !== 0x50 || body[1] !== 0x4b) throw new Error('The download is not a zip file.');
    const zipFile = join(work, `${year}_Gaz_zcta_national.zip`);
    writeFileSync(zipFile, body);
    console.info(`Downloaded ${url} (${body.byteLength} bytes)`);
    return { zipFile, year };
  }
  throw new Error('No ZCTA gazetteer was found for the last three years.');
}

/** The one text file inside the zip, read without writing anything out under the zip's own names. */
function readGazetteerText(zipFile: string): string {
  const entries = execFileSync('unzip', ['-Z1', zipFile], { encoding: 'utf8', maxBuffer: 1_000_000 })
    .split('\n')
    .map((name) => name.trim())
    .filter((name) => name !== '');
  const wanted = entries.filter((name) => /^\d{4}_Gaz_zcta_national\.txt$/.test(name));
  if (entries.length !== 1 || wanted.length !== 1) {
    throw new Error(`The zip does not hold just the expected file (it holds: ${entries.join(', ')}).`);
  }
  return execFileSync('unzip', ['-p', zipFile, wanted[0]!], {
    encoding: 'utf8',
    maxBuffer: MAX_TEXT_BYTES,
  });
}

async function main(): Promise<void> {
  const workFlag = process.argv.indexOf('--work');
  const work = workFlag > 0 ? process.argv[workFlag + 1]! : join(tmpdir(), 'homebase-zcta');
  mkdirSync(work, { recursive: true });
  const { zipFile, year } = await download(work);
  const rows = parseGazetteer(readGazetteerText(zipFile));
  // About 33,800 areas; far fewer or far more means the file is not what we think it is.
  if (rows.length < 30_000 || rows.length > 40_000) {
    throw new Error(`Expected about 33,000 ZIP code areas, found ${rows.length}. Nothing was written.`);
  }
  const out = fileURLToPath(new URL('../public/data/zcta.bin', import.meta.url));
  mkdirSync(fileURLToPath(new URL('../public/data/', import.meta.url)), { recursive: true });
  const bytes = encodeTable(rows);
  writeFileSync(out, bytes);
  console.info(
    `Wrote ${rows.length} ZIP code areas from the ${year} gazetteer to public/data/zcta.bin (${bytes.byteLength} bytes).`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
