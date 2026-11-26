/**
 * What may leave, and in what form.
 *
 * Children become "Child A", "Child B" — a mapping that lasts for one request and is turned back into real ids
 * on the server when the reply comes in. Missions, routines, items and rewards become short references ("M1",
 * "R2", "I3", "W1") for the same reason: the model never sees an id that could be looked up anywhere, and every
 * reference it gives back is checked against this request's own table.
 *
 * Words a person typed (a mission's title, a list item) are untrusted data. They are scrubbed — no web
 * addresses, no e-mail addresses, no phone numbers, no markup, no children's nicknames — cut short, and sent
 * inside a fenced block that the instructions call data. That is not relied on alone: the reply is checked by
 * server/ai/envelope.ts so that nothing outside the allow-list can come of it, whatever the words said.
 */

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g;
const URL_LIKE =
  /\b(?:[a-z][a-z0-9+.-]*:\/\/|www\.)\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|co|uk|us|app|dev|info|biz|me|ly|gl|link|shop|store|xyz|ai)\b(?:\/\S*)?/gi;
const EMAIL = /[^\s@<>()"']+@[^\s@<>()"']+\.[^\s@<>()"']+/g;
const PHONE = /\+?\d[\d\s().-]{6,}\d/g;
const MARKUP = /<[^>]*>|[<>`]|\[([^\]]*)\]\([^)]*\)|&[a-z]+;|[{}]/gi;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export interface ScrubOptions {
  /** The household's children's nicknames, each with the alias that replaces it. */
  names?: readonly { nickname: string; alias: string }[];
  max: number;
}

/** Someone's words, made safe to send: no addresses, no markup, no names, and not too long. */
export function scrub(text: string | null | undefined, options: ScrubOptions): string {
  if (!text) return '';
  let out = text.normalize('NFKC').replace(CONTROL, ' ');
  out = out.replace(EMAIL, ' ').replace(URL_LIKE, ' ').replace(PHONE, ' ');
  out = out.replace(MARKUP, (_match, linkText: string | undefined) => (linkText ? ` ${linkText} ` : ' '));
  for (const { nickname, alias } of options.names ?? []) {
    const name = nickname.trim();
    if (name.length < 2) continue;
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(name)}(?![\\p{L}\\p{N}])`, 'giu'), alias);
  }
  out = out.replace(/\s+/g, ' ').trim();
  return out.length > options.max ? `${out.slice(0, options.max - 1).trimEnd()}…` : out;
}

/** Does this look like it carries an address or markup? Used to strip model output, too. */
export function looksUnsafe(text: string): boolean {
  URL_LIKE.lastIndex = 0;
  EMAIL.lastIndex = 0;
  return URL_LIKE.test(text) || EMAIL.test(text) || /[<>]/.test(text);
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Child A, Child B…, in the household's own order, for one request. */
export class Aliases {
  private readonly toAlias = new Map<string, string>();
  private readonly fromAlias = new Map<string, string>();
  readonly names: { nickname: string; alias: string }[] = [];

  constructor(children: readonly { id: string; nickname: string }[]) {
    children.slice(0, LETTERS.length).forEach((child, index) => {
      const alias = `Child ${LETTERS[index]}`;
      this.toAlias.set(child.id, alias);
      this.fromAlias.set(alias.toLowerCase(), child.id);
      this.names.push({ nickname: child.nickname, alias });
    });
  }

  alias(profileId: string | null): string {
    if (profileId === null) return 'Family';
    return this.toAlias.get(profileId) ?? 'Family';
  }

  /** The real id behind an alias the model gave back; null for anything this request did not hand out. */
  profileOf(alias: unknown): string | null {
    if (typeof alias !== 'string') return null;
    return this.fromAlias.get(alias.trim().toLowerCase()) ?? null;
  }

  get all(): string[] {
    return [...this.toAlias.values()];
  }

  /** The aliases a piece of text mentions. */
  mentioned(text: string): string[] {
    const found = new Set<string>();
    for (const match of text.matchAll(/\bChild ([A-Z])\b/g)) {
      if (this.fromAlias.has(`child ${match[1]!.toLowerCase()}`)) found.add(match[0]);
    }
    return [...found];
  }

  /** Back on the family's side of the line: "Child A" becomes the child's nickname again, for the grown-ups. */
  restore(text: string): string {
    return text.replace(/\bChild ([A-Z])\b/g, (whole) => {
      const named = this.names.find((entry) => entry.alias === whole);
      return named ? named.nickname : whole;
    });
  }
}

/** Short references for one kind of thing ("M1", "M2"…), and the way back. */
export class Refs {
  private readonly toRef = new Map<string, string>();
  private readonly fromRef = new Map<string, string>();

  constructor(readonly prefix: string) {}

  ref(id: string): string {
    let ref = this.toRef.get(id);
    if (!ref) {
      ref = `${this.prefix}${this.toRef.size + 1}`;
      this.toRef.set(id, ref);
      this.fromRef.set(ref.toLowerCase(), id);
    }
    return ref;
  }

  idOf(ref: unknown): string | null {
    if (typeof ref !== 'string') return null;
    return this.fromRef.get(ref.trim().toLowerCase()) ?? null;
  }
}

/** The fence around household data. Inside it is data; nothing inside it is an instruction. */
export function fence(name: string, data: unknown): string {
  // JSON escapes quotes and newlines; scrubbing has already removed < and >, so the fence cannot be closed early.
  return `<household_data name="${name}">\n${JSON.stringify(data)}\n</household_data>`;
}

/** The most that is ever sent in one request's user message. */
export const MAX_USER_CHARS = 16_000;
