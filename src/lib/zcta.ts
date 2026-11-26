/**
 * Turning a US ZIP code into a coarse position, on the parent's own phone.
 *
 * The position is all the server needs for the sun and the weather, and the ZIP code itself never leaves the
 * phone: the whole table (about 270 KB, from the U.S. Census Bureau's public-domain ZCTA gazetteer) is fetched
 * once from our own site and searched here. Positions in it are the middle of the ZIP code's area, rounded to two
 * decimal places — about a kilometre, never an address.
 *
 * The table's layout is described in scripts/build-zcta.ts, which makes it.
 */

export interface Position {
  lat: number;
  lon: number;
}

const MAGIC = 'ZCT1';
const HEADER = 8;
const RECORD = 8;

/** The table, checked and ready to search. */
export interface ZipTable {
  count: number;
  view: DataView;
}

/** Check a downloaded table and wrap it for searching. Throws if it is not a table. */
export function parseZipTable(buffer: ArrayBuffer): ZipTable {
  if (buffer.byteLength < HEADER) throw new Error('The ZIP code table is too short.');
  const view = new DataView(buffer);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== MAGIC) throw new Error('This is not a ZIP code table.');
  const count = view.getUint32(4, true);
  if (buffer.byteLength !== HEADER + count * RECORD) throw new Error('The ZIP code table is the wrong size.');
  return { count, view };
}

/** Find one ZIP code (as a number) in the table, by halving. */
export function findZip(table: ZipTable, zip: number): Position | null {
  let low = 0;
  let high = table.count - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const at = HEADER + middle * RECORD;
    const found = table.view.getUint32(at, true);
    if (found === zip) {
      return {
        lat: table.view.getInt16(at + 4, true) / 100,
        lon: table.view.getInt16(at + 6, true) / 100,
      };
    }
    if (found < zip) low = middle + 1;
    else high = middle - 1;
  }
  return null;
}

async function fetchTable(): Promise<ArrayBuffer> {
  const response = await fetch('/data/zcta.bin');
  if (!response.ok) throw new Error(`The ZIP code table could not be loaded (${response.status}).`);
  return response.arrayBuffer();
}

/** Each way of loading is asked once; a failed load is forgotten so that the next look tries again. */
const tables = new WeakMap<() => Promise<ArrayBuffer>, Promise<ZipTable>>();

function tableFrom(load: () => Promise<ArrayBuffer>): Promise<ZipTable> {
  let table = tables.get(load);
  if (!table) {
    table = load().then(parseZipTable);
    tables.set(load, table);
    table.catch(() => tables.delete(load));
  }
  return table;
}

/**
 * The coarse position of a five-digit US ZIP code, or null when it is not one the Census Bureau maps (a PO box
 * or a company's own ZIP code has no area). Throws only when the table itself cannot be loaded.
 */
export async function lookupZip(
  zip: string,
  load: () => Promise<ArrayBuffer> = fetchTable,
): Promise<Position | null> {
  const code = zip.trim();
  if (!/^\d{5}$/.test(code)) return null;
  return findZip(await tableFrom(load), Number(code));
}
