/**
 * Identifiers. Every record's id is a UUID made where the record is made — on the wall, on a phone, or on the
 * server — so that something created offline already has its final name and a retry can never create a second one.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/** A random (version 4) UUID. `crypto.randomUUID` exists in every browser HOMEBASE supports and in Node. */
export function newId(): string {
  return globalThis.crypto.randomUUID();
}

/** The id that stands for "nobody in particular" where a unique index needs a value (shared tasks). */
export const NIL_UUID = '00000000-0000-0000-0000-000000000000';
