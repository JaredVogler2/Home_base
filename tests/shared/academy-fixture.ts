import { academyChecksumOf } from '../../shared/academy.js';

/**
 * Made-up Training Academy export files, built the way the Academy builds them (its `src/storage/transfer.ts`,
 * `buildBundle`): every record in full, sittings and answers sorted by id, and the checksum over
 * `{ profile, sessions, attempts }`. Nothing here is anyone's real data.
 */

export interface FixtureAttempt {
  stage?: 'guided' | 'independent';
  tryIndex?: number;
  hintLevel?: number;
  assistance?: 'none' | 'hint' | 'adult';
  outcome?: 'correct' | 'incorrect';
}

export interface FixtureSession {
  id: string;
  lessonId?: string;
  /** When the sitting began, as an ISO time. */
  startedAt: string;
  completed?: boolean;
  attempts?: FixtureAttempt[];
}

export interface FixtureOptions {
  playerId?: string;
  name?: string;
  sessions: FixtureSession[];
  /** Answers that belong to no sitting in the file (a sitting that was abandoned). */
  orphanAttempts?: number;
  /** How to seal the file; the Academy's own `checksumOf` can be passed in. */
  checksumOf?: (value: unknown) => string;
}

export type FixtureFile = Record<string, unknown> & {
  profile: Record<string, unknown>;
  sessions: Record<string, unknown>[];
  attempts: Record<string, unknown>[];
  checksum: string;
};

const ms = (iso: string) => new Date(iso).getTime();
const byId = (a: Record<string, unknown>, b: Record<string, unknown>) =>
  String(a.id).localeCompare(String(b.id));

function attemptRecord(
  playerId: string,
  sessionId: string,
  lessonId: string,
  seq: number,
  at: number,
  shape: FixtureAttempt,
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: `${sessionId}:${seq}`,
    profileId: playerId,
    sessionId,
    seq,
    lessonId,
    lessonVersion: 1,
    contentVersion: 1,
    challengeId: `${lessonId}.q${seq}`,
    skillId: 'number.counting.small-sets',
    variant: 'apples',
    stage: shape.stage ?? 'independent',
    tryIndex: shape.tryIndex ?? 0,
    hintLevel: shape.hintLevel ?? 0,
    assistance: shape.assistance ?? 'none',
    outcome: shape.outcome ?? 'correct',
    response: 'three',
    at: at + seq * 20_000,
    day: new Date(at).toISOString().slice(0, 10),
    durationMs: 4_000,
  };
}

export function makeAcademyExport(options: FixtureOptions): FixtureFile {
  const playerId = options.playerId ?? 'player-0001';
  const created = ms('2026-01-05T15:00:00Z');
  const profile = {
    schemaVersion: 1,
    id: playerId,
    name: options.name ?? 'Player One',
    avatar: 'star',
    createdAt: created,
    updatedAt: created,
    settings: { sessionMinutes: null },
  };
  const sessions: Record<string, unknown>[] = [];
  const attempts: Record<string, unknown>[] = [];
  for (const session of options.sessions) {
    const lessonId = session.lessonId ?? 'ng-give-01';
    const startedAt = ms(session.startedAt);
    const shapes = session.attempts ?? [{}, {}];
    const completed = session.completed ?? true;
    const endedAt = startedAt + (shapes.length + 1) * 20_000;
    sessions.push({
      schemaVersion: 1,
      id: session.id,
      profileId: playerId,
      lessonId,
      lessonVersion: 1,
      contentVersion: 1,
      seed: 12345,
      status: completed ? 'completed' : 'active',
      startedAt,
      updatedAt: endedAt,
      completedAt: completed ? endedAt : null,
      steps: [
        { stage: 'demo', challengeId: `${lessonId}.demo` },
        { stage: 'guided', challengeId: `${lessonId}.q0` },
      ],
      reserve: [],
      cursor: completed ? 2 : 1,
      presentation: { tryIndex: 0, hintLevel: 0, eliminated: [], revealed: false },
      nextSeq: shapes.length,
      reprobesUsed: 0,
      tally: { independentProbes: 0, independentFirstTryCorrect: 0, assistedSolves: 0 },
    });
    shapes.forEach((shape, seq) =>
      attempts.push(attemptRecord(playerId, session.id, lessonId, seq, startedAt, shape)),
    );
  }
  for (let seq = 0; seq < (options.orphanAttempts ?? 0); seq++) {
    attempts.push(attemptRecord(playerId, 'abandoned-sitting', 'rc-listen-01', seq, created, {}));
  }
  sessions.sort(byId);
  attempts.sort(byId);
  const seal = options.checksumOf ?? academyChecksumOf;
  return {
    format: 'training-academy.profile-export',
    formatVersion: 1,
    exportedAt: ms('2026-03-03T14:00:00Z'),
    app: { version: '0.0.0-fixture', dataVersion: 1 },
    profile,
    sessions,
    attempts,
    checksum: seal({ profile, sessions, attempts }),
  };
}

/** Seal a file again after changing it on purpose, as a person editing their own file could. */
export function reseal(file: FixtureFile): FixtureFile {
  return {
    ...file,
    checksum: academyChecksumOf({ profile: file.profile, sessions: file.sessions, attempts: file.attempts }),
  };
}

/** Where the Academy's source is, when it is checked out next to HOMEBASE (it is only read, never changed). */
export const ACADEMY_SOURCE =
  process.env.HOMEBASE_ACADEMY_SRC ??
  new URL('../../../jaredvogler2/training_academy/src', import.meta.url).pathname;
