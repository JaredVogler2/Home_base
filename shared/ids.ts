/**
 * Identifiers. Every record's id is a UUID made where the record is made — on the wall, on a phone, or on the
 * server — so that something created offline already has its final name and a retry can never create a second one.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/**
 * A random (version 4) UUID.
 *
 * `crypto.randomUUID` is in every browser HOMEBASE supports and in Node — but browsers withhold it from a page
 * that was not fetched securely, and "not securely" includes a wall opened at http://192.168.… on the home
 * network before the house has been put on the internet. The random numbers themselves are never withheld, so
 * there the same kind of id is made from them by hand.
 */
export function newId(): string {
  const source = globalThis.crypto;
  if (typeof source.randomUUID === 'function') return source.randomUUID();
  const bytes = source.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // the standard variant
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The id that stands for "nobody in particular" where a unique index needs a value (shared tasks). */
export const NIL_UUID = '00000000-0000-0000-0000-000000000000';
