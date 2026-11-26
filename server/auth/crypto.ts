import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  randomInt,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';

/**
 * Secrets. Passwords and PINs are stretched with scrypt and never stored; tokens and codes are random, shown
 * once, and only their SHA-256 is kept; the little that must be read back (a calendar's private link) is
 * encrypted with a key that lives in the environment, not in the database.
 */

export interface HashCost {
  /** The work factor, as a power of two. 15 costs about 32 MB and a tenth of a second per guess. */
  log2N: number;
}

export const STRONG_COST: HashCost = { log2N: 15 };
/** For tests only, where hundreds of sign-ins happen in a second. Never the default. */
export const TEST_COST: HashCost = { log2N: 8 };

const R = 8;
const P = 1;
const KEY_BYTES = 32;

function scryptAsync(secret: string | Buffer, salt: Buffer, log2N: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const N = 2 ** log2N;
    scrypt(secret, salt, KEY_BYTES, { N, r: R, p: P, maxmem: 256 * N * R }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

const b64 = (buffer: Buffer): string => buffer.toString('base64url');

export async function hashPassword(password: string, cost: HashCost = STRONG_COST): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize('NFKC'), salt, cost.log2N);
  return `scrypt$${cost.log2N}$${b64(salt)}$${b64(key)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'scrypt') return false;
  const log2N = Number(parts[1]);
  if (!Number.isInteger(log2N) || log2N < 8 || log2N > 20) return false;
  const salt = Buffer.from(parts[2] ?? '', 'base64url');
  const expected = Buffer.from(parts[3] ?? '', 'base64url');
  if (expected.length !== KEY_BYTES) return false;
  const actual = await scryptAsync(password.normalize('NFKC'), salt, log2N);
  return timingSafeEqual(actual, expected);
}

/**
 * A PIN is four to eight digits: nothing can make that hard to guess for someone who holds the hash. So the PIN
 * is first mixed with the deployment's secret key, which is not in the database, and guessing at the wall is
 * slowed by the rate limiter. Without a secret key the PIN is still stretched, and the limiter still applies.
 */
function pepper(pin: string, secretKey: string | null): string | Buffer {
  return secretKey ? createHmac('sha256', secretKey).update(`pin:${pin}`).digest() : `pin:${pin}`;
}

export async function hashPin(
  pin: string,
  secretKey: string | null,
  cost: HashCost = STRONG_COST,
): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(pepper(pin, secretKey), salt, cost.log2N);
  return `scrypt$${cost.log2N}$${b64(salt)}$${b64(key)}`;
}

export async function verifyPin(pin: string, stored: string, secretKey: string | null): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'scrypt') return false;
  const log2N = Number(parts[1]);
  if (!Number.isInteger(log2N) || log2N < 8 || log2N > 20) return false;
  const expected = Buffer.from(parts[3] ?? '', 'base64url');
  if (expected.length !== KEY_BYTES) return false;
  const actual = await scryptAsync(pepper(pin, secretKey), Buffer.from(parts[2] ?? '', 'base64url'), log2N);
  return timingSafeEqual(actual, expected);
}

export function isValidPin(pin: unknown): pin is string {
  if (typeof pin !== 'string' || !/^\d{4,8}$/.test(pin)) return false;
  // The handful everybody tries first.
  if (/^(\d)\1+$/.test(pin)) return false;
  if ('0123456789'.includes(pin) || '9876543210'.includes(pin)) return false;
  return true;
}

/** 256 random bits, for a session, a pairing secret or a shortcut key. Shown once, never stored. */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

/** What is stored of a token or a code. They are random, so a plain hash is enough. */
export function fingerprint(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

/** Letters and digits that cannot be mistaken for one another when read off a screen across a room. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';

/** A code to read aloud or type: 40 bits at eight characters. */
export function newCode(length = 8): string {
  let code = '';
  for (let index = 0; index < length; index++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

/** Fold what somebody typed into what was issued: capitals, and no spaces or dashes. */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** The form a code is issued in is already normal; this is what both sides hash. */
export function codeFingerprint(code: string): string {
  return fingerprint(`code:${normalizeCode(code)}`);
}

export function formatCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

function encryptionKey(secretKey: string): Buffer {
  return Buffer.from(hkdfSync('sha256', secretKey, 'homebase', 'connection-secrets', 32));
}

/** Encrypt something that must be read back later (AES-256-GCM). */
export function seal(plain: string, secretKey: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(secretKey), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `v1.${b64(iv)}.${b64(body)}.${b64(cipher.getAuthTag())}`;
}

export function unseal(sealed: string, secretKey: string): string | null {
  const parts = sealed.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') return null;
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      encryptionKey(secretKey),
      Buffer.from(parts[1] ?? '', 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(parts[3] ?? '', 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(parts[2] ?? '', 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}

/** Compare two strings without telling a guesser how much of theirs was right. */
export function safeEqual(a: string, b: string): boolean {
  const left = createHash('sha256').update(a).digest();
  const right = createHash('sha256').update(b).digest();
  return timingSafeEqual(left, right);
}
