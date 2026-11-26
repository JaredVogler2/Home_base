import * as v from 'valibot';
import { localDateOf, type LocalDate } from './time.js';

/**
 * Reading a Training Academy export file — on a parent's phone before it is sent, and on the server, which never
 * trusts what the phone says about it.
 *
 * The Academy is a separate game that keeps everything on the device it is played on. A grown-up can save a
 * player's progress as a file from its grown-ups' area; that file is what this module reads. It is the Academy's
 * own format (`src/storage/transfer.ts` in the Academy's repository), not one made for HOMEBASE, so the shapes
 * below follow it field for field — but only the fields HOMEBASE looks at. Everything else in the file (the
 * nickname, the answers given, how long each took, whether they were right) is checked by the checksum and then
 * left where it is. It is never copied out of the file.
 *
 * What comes out is one small total per sitting: which island, which activity, which day, finished or not, and how
 * many answers were given alone and how many with help. That is all HOMEBASE keeps.
 */

export const ACADEMY_EXPORT_FORMAT = 'training-academy.profile-export';
export const ACADEMY_EXPORT_VERSION = 1;
/** The version of the Academy's player, sitting and answer records that this module understands. */
export const ACADEMY_RECORD_VERSION = 1;

/** Far more than a child plays in years; a file with more is not one to spend time on. */
export const MAX_ACADEMY_SESSIONS = 5_000;
export const MAX_ACADEMY_ATTEMPTS = 50_000;
/** Largest export text accepted, in characters. The import request is held to the same size. */
export const MAX_ACADEMY_FILE_CHARS = 2 * 1024 * 1024;

// ---------------------------------------------------------------------------------------------------------------------
// The file, as the Academy writes it (only what is read here)
// ---------------------------------------------------------------------------------------------------------------------

/** The Academy's record ids: `src/engine/schema.ts`, `recordId`. */
const recordId = v.pipe(v.string(), v.minLength(1), v.maxLength(120), v.regex(/^[A-Za-z0-9:_-]+$/));
/** Lesson ids are lowercase slugs in the Academy (`LessonIdSchema`); the length limit is HOMEBASE's own. */
const lessonId = v.pipe(v.string(), v.maxLength(80), v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/));
/** Milliseconds since 1970, as the Academy stores times. Held below the year 2100 so a date can always be made. */
const timestamp = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(4_102_444_800_000));
const count = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1_000));

const ProfileSchema = v.object({
  schemaVersion: v.literal(ACADEMY_RECORD_VERSION),
  /** A made-up id the Academy gave the player. The only thing about the player HOMEBASE keeps. */
  id: recordId,
});

/** One sitting of one activity (the Academy's `LessonSession`). */
const SessionSchema = v.object({
  schemaVersion: v.literal(ACADEMY_RECORD_VERSION),
  id: recordId,
  profileId: recordId,
  lessonId,
  status: v.picklist(['active', 'completed']),
  startedAt: timestamp,
  completedAt: v.nullable(timestamp),
});

/** One answer to one question (the Academy's `Attempt`). Whether it was right, and how long it took, is not read. */
const AttemptSchema = v.object({
  schemaVersion: v.literal(ACADEMY_RECORD_VERSION),
  id: recordId,
  profileId: recordId,
  sessionId: recordId,
  stage: v.picklist(['guided', 'independent']),
  /** 0 for the first answer to a question; each try after a wrong one counts up. */
  tryIndex: count,
  /** How many hints had been shown when the answer was given. */
  hintLevel: count,
  assistance: v.picklist(['none', 'hint', 'adult']),
});

const ExportSchema = v.object({
  format: v.literal(ACADEMY_EXPORT_FORMAT),
  formatVersion: v.literal(ACADEMY_EXPORT_VERSION),
  exportedAt: timestamp,
  profile: ProfileSchema,
  sessions: v.pipe(v.array(SessionSchema), v.maxLength(MAX_ACADEMY_SESSIONS)),
  attempts: v.pipe(v.array(AttemptSchema), v.maxLength(MAX_ACADEMY_ATTEMPTS)),
  checksum: v.pipe(v.string(), v.maxLength(40)),
});

export type AcademyExport = v.InferOutput<typeof ExportSchema>;
export type AcademyExportSession = AcademyExport['sessions'][number];
export type AcademyExportAttempt = AcademyExport['attempts'][number];

// ---------------------------------------------------------------------------------------------------------------------
// The Academy's checksum, ported as it is
// ---------------------------------------------------------------------------------------------------------------------

/**
 * JSON with object keys in sorted order, so the same data always gives the same text.
 * Copied unchanged from the Academy's `src/storage/checksum.ts` (`stableStringify`).
 */
export function stableStringify(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`);
  return `{${entries.join(',')}}`;
}

/**
 * cyrb53: a 53-bit string hash, as 14 hex digits.
 * Copied unchanged from the Academy's `src/storage/checksum.ts` (`hash53`).
 */
export function hash53(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const value = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return value.toString(16).padStart(14, '0');
}

/** `cyrb53:<14 hex digits>`, as in the Academy's `src/storage/checksum.ts` (`checksumOf`). */
export function academyChecksumOf(value: unknown): string {
  return `cyrb53:${hash53(stableStringify(value))}`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Checking a file
// ---------------------------------------------------------------------------------------------------------------------

export type AcademyProblem =
  'not-an-export' | 'unsupported-version' | 'too-large' | 'invalid' | 'checksum' | 'foreign-records';

/** Words for a grown-up, one for each reason a file is turned away. */
export const ACADEMY_PROBLEM_TEXT: Record<AcademyProblem, string> = {
  'not-an-export': 'That file is not a Training Academy export.',
  'unsupported-version': 'That export is from a version of the Academy that HOMEBASE cannot read yet.',
  'too-large': 'That export is larger than HOMEBASE accepts.',
  invalid:
    'That export is not in the shape the Academy writes. Save a fresh copy from the Academy and try again.',
  checksum: 'That export has been changed or damaged since it was saved. Save a fresh copy from the Academy.',
  'foreign-records': 'That export holds records for more than one player.',
};

export type AcademyCheck = { ok: true; file: AcademyExport } | { ok: false; reason: AcademyProblem };

/**
 * Check a file (its text, or the JSON already read from it) and return what HOMEBASE reads from it, or the first
 * reason it cannot be used. The steps follow the Academy's own `readBundle`: format, version, shape, checksum,
 * one player only — with HOMEBASE's own size limits put first, so that a hostile file is turned away cheaply.
 *
 * The checksum is worked out over the file's own `{ profile, sessions, attempts }`, exactly as they arrived. The
 * Academy makes it over those same objects when it saves (`buildBundle`), so an untouched export always matches.
 * (The Academy, reading a file back, first drops fields it does not know; HOMEBASE does not, so a file a person
 * has added a field to is refused here as changed. That is the safer way round.)
 */
export function checkAcademyExport(input: unknown): AcademyCheck {
  const fail = (reason: AcademyProblem): AcademyCheck => ({ ok: false, reason });

  let data = input;
  if (typeof input === 'string') {
    if (input.length > MAX_ACADEMY_FILE_CHARS) return fail('too-large');
    try {
      data = JSON.parse(input) as unknown;
    } catch {
      return fail('not-an-export');
    }
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return fail('not-an-export');
  const raw = data as Record<string, unknown>;
  if (raw.format !== ACADEMY_EXPORT_FORMAT) return fail('not-an-export');
  if (raw.formatVersion !== ACADEMY_EXPORT_VERSION) return fail('unsupported-version');
  const profileVersion = (raw.profile as { schemaVersion?: unknown } | null | undefined)?.schemaVersion;
  if (profileVersion !== undefined && profileVersion !== ACADEMY_RECORD_VERSION)
    return fail('unsupported-version');
  if (
    (Array.isArray(raw.sessions) && raw.sessions.length > MAX_ACADEMY_SESSIONS) ||
    (Array.isArray(raw.attempts) && raw.attempts.length > MAX_ACADEMY_ATTEMPTS)
  ) {
    return fail('too-large');
  }

  const parsed = v.safeParse(ExportSchema, raw);
  if (!parsed.success) return fail('invalid');
  const file = parsed.output;
  if (new Set(file.sessions.map((session) => session.id)).size !== file.sessions.length)
    return fail('invalid');

  let expected: string;
  try {
    expected = academyChecksumOf({ profile: raw.profile, sessions: raw.sessions, attempts: raw.attempts });
  } catch {
    // Nested too deep to write out: not something the Academy ever saves.
    return fail('invalid');
  }
  if (file.checksum !== expected) return fail('checksum');

  const player = file.profile.id;
  if (
    file.sessions.some((s) => s.profileId !== player) ||
    file.attempts.some((a) => a.profileId !== player)
  ) {
    return fail('foreign-records');
  }
  return { ok: true, file };
}

// ---------------------------------------------------------------------------------------------------------------------
// What HOMEBASE keeps
// ---------------------------------------------------------------------------------------------------------------------

/**
 * The Academy's islands, by the first part of an activity's id. A sitting does not say which island it was on;
 * every activity id in the Academy's content packs (`src/content/packs/*.json`, `src/content/lessons.lock.json`)
 * starts with its island's two letters, and this table is that convention. An activity it does not know is kept
 * under "other" rather than guessed at.
 */
export const ACADEMY_WORLDS: Readonly<Record<string, string>> = {
  rc: 'reading-cove',
  ng: 'number-garden',
  rr: 'robot-ridge',
  mf: 'memory-forest',
  ii: 'inventor-island',
  eh: 'explorer-harbor',
  ml: 'music-lab',
};
export const ACADEMY_OTHER_WORLD = 'other';

export function academyWorldOf(lessonId: string): string {
  const prefix = lessonId.split('-')[0] ?? '';
  return Object.hasOwn(ACADEMY_WORLDS, prefix) ? (ACADEMY_WORLDS[prefix] as string) : ACADEMY_OTHER_WORLD;
}

/** One sitting, as HOMEBASE keeps it. */
export interface AcademySessionSummary {
  sessionId: string;
  world: string;
  lessonId: string;
  /** The day the sitting began, where the family lives. */
  localDate: LocalDate;
  completed: boolean;
  /** Answers given in the sitting, counting each try. */
  attempts: number;
  /** …given alone: a first try, with no hint shown and no grown-up helping. */
  independent: number;
  /** …given with help: after a hint, with a grown-up, or as another try once the first was not it. */
  supported: number;
}

/**
 * Whether an answer was given with help. The Academy records three kinds: a hint shown first (`hintLevel`,
 * `assistance: 'hint'`), a grown-up helping (`assistance: 'adult'`), and another go after a first answer that was
 * not it (`tryIndex` above 0) — by then the game has shown that, and in a question with choices it has taken that
 * choice away. These are the same three the Academy itself counts as an "assisted" answer. Which stage the answer
 * came in (guided practice or the child's own go) is not used: it is the help actually given that counts.
 */
export function wasSupported(
  attempt: Pick<AcademyExportAttempt, 'tryIndex' | 'hintLevel' | 'assistance'>,
): boolean {
  return attempt.tryIndex > 0 || attempt.hintLevel > 0 || attempt.assistance !== 'none';
}

/**
 * One row per sitting in the file, with its day worked out in the family's own time zone. Answers that belong to
 * no sitting in the file (the Academy keeps answers from a sitting that was abandoned) are left out. Nothing about
 * being right or being quick is carried over.
 */
export function summariseAcademy(file: AcademyExport, timeZone: string): AcademySessionSummary[] {
  const counts = new Map<string, { attempts: number; supported: number }>();
  for (const session of file.sessions) counts.set(session.id, { attempts: 0, supported: 0 });
  for (const attempt of file.attempts) {
    const tally = counts.get(attempt.sessionId);
    if (!tally) continue;
    tally.attempts += 1;
    if (wasSupported(attempt)) tally.supported += 1;
  }
  return file.sessions
    .map((session) => {
      const tally = counts.get(session.id) ?? { attempts: 0, supported: 0 };
      return {
        sessionId: session.id,
        world: academyWorldOf(session.lessonId),
        lessonId: session.lessonId,
        localDate: localDateOf(new Date(session.startedAt), timeZone),
        completed: session.status === 'completed',
        attempts: tally.attempts,
        independent: tally.attempts - tally.supported,
        supported: tally.supported,
      };
    })
    .sort((a, b) =>
      a.localDate < b.localDate ? -1 : a.localDate > b.localDate ? 1 : a.sessionId.localeCompare(b.sessionId),
    );
}

/** The weeks a summary may look back over. */
export const ACADEMY_SUMMARY_WEEKS = { default: 8, max: 26 } as const;

/** One island's practice over the weeks asked for. Every number comes with what it is out of. */
export interface AcademyWorldSummary {
  world: string;
  sessions: number;
  completed: number;
  attempts: number;
  independent: number;
  supported: number;
}

export interface AcademySummary {
  profileId: string;
  linked: boolean;
  lastImportAt: string | null;
  weeks: number;
  from: LocalDate;
  to: LocalDate;
  worlds: AcademyWorldSummary[];
}
