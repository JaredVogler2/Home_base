import { existsSync } from 'node:fs';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  academyChecksumOf,
  academyWorldOf,
  checkAcademyExport,
  hash53,
  MAX_ACADEMY_SESSIONS,
  stableStringify,
  summariseAcademy,
  type AcademyExport,
} from '../../shared/academy.js';
import { ACADEMY_SOURCE, makeAcademyExport, reseal, type FixtureFile } from './academy-fixture.js';

function fileOf(input: unknown): AcademyExport {
  const checked = checkAcademyExport(input);
  if (!checked.ok) throw new Error(`refused: ${checked.reason}`);
  return checked.file;
}

const sample = () =>
  makeAcademyExport({
    sessions: [
      { id: 's-1', startedAt: '2026-03-02T15:00:00Z' },
      { id: 's-2', startedAt: '2026-03-03T15:00:00Z', lessonId: 'rc-rhyme-01', completed: false },
    ],
  });

describe('checking an Academy export', () => {
  it('takes an untouched export, as an object or as its text', () => {
    const file = sample();
    expect(checkAcademyExport(file)).toMatchObject({ ok: true });
    expect(checkAcademyExport(JSON.stringify(file))).toMatchObject({ ok: true });
    expect(fileOf(file).profile.id).toBe('player-0001');
  });

  it('keeps nothing of the player but the made-up id', () => {
    const read = fileOf(sample());
    expect(read.profile).toEqual({ schemaVersion: 1, id: 'player-0001' });
    expect(JSON.stringify(read)).not.toContain('Player One');
    expect(JSON.stringify(read)).not.toContain('durationMs');
    expect(JSON.stringify(read)).not.toContain('outcome');
  });

  it('turns away what is not an export', () => {
    expect(checkAcademyExport(null)).toEqual({ ok: false, reason: 'not-an-export' });
    expect(checkAcademyExport('not json')).toEqual({ ok: false, reason: 'not-an-export' });
    expect(checkAcademyExport([1, 2])).toEqual({ ok: false, reason: 'not-an-export' });
    expect(checkAcademyExport({ ...sample(), format: 'training-academy.content-pack' })).toEqual({
      ok: false,
      reason: 'not-an-export',
    });
  });

  it('turns away a version it does not know', () => {
    expect(checkAcademyExport({ ...sample(), formatVersion: 2 })).toEqual({
      ok: false,
      reason: 'unsupported-version',
    });
    const file = sample();
    expect(checkAcademyExport(reseal({ ...file, profile: { ...file.profile, schemaVersion: 2 } }))).toEqual({
      ok: false,
      reason: 'unsupported-version',
    });
  });

  it('notices a file that was changed after it was saved', () => {
    const file = sample();
    const promoted = { ...file, sessions: file.sessions.map((s) => ({ ...s, status: 'completed' })) };
    expect(checkAcademyExport(promoted)).toEqual({ ok: false, reason: 'checksum' });
    expect(checkAcademyExport({ ...file, checksum: 'cyrb53:00000000000000' })).toEqual({
      ok: false,
      reason: 'checksum',
    });
    const added = { ...file, profile: { ...file.profile, stars: 1000 } };
    expect(checkAcademyExport(added)).toEqual({ ok: false, reason: 'checksum' });
  });

  it('turns away a file that is too large before looking inside it', () => {
    const file = sample();
    const many = Array.from({ length: MAX_ACADEMY_SESSIONS + 1 }, () => file.sessions[0]);
    expect(checkAcademyExport({ ...file, sessions: many })).toEqual({ ok: false, reason: 'too-large' });
    expect(checkAcademyExport('x'.repeat(2 * 1024 * 1024 + 1))).toEqual({ ok: false, reason: 'too-large' });
  });

  it('turns away a file of the wrong shape, even when sealed', () => {
    const file = sample();
    const broken = (change: (f: FixtureFile) => FixtureFile) => checkAcademyExport(reseal(change(file)));
    expect(
      broken((f) => ({ ...f, sessions: f.sessions.map((s) => ({ ...s, startedAt: 'yesterday' })) })),
    ).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(
      broken((f) => ({ ...f, sessions: f.sessions.map((s) => ({ ...s, lessonId: 'x'.repeat(200) })) })),
    ).toEqual({ ok: false, reason: 'invalid' });
    expect(broken((f) => ({ ...f, sessions: [...f.sessions, f.sessions[0]!] }))).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('turns away records that belong to another player', () => {
    const file = sample();
    const mixed = reseal({
      ...file,
      sessions: file.sessions.map((s) => ({ ...s, profileId: 'player-0002' })),
    });
    expect(checkAcademyExport(mixed)).toEqual({ ok: false, reason: 'foreign-records' });
  });
});

describe('the Academy’s checksum, ported', () => {
  const academyChecksum = `${ACADEMY_SOURCE}/storage/checksum.ts`;
  const academySchema = `${ACADEMY_SOURCE}/engine/schema.ts`;
  const haveAcademy = existsSync(academyChecksum) && existsSync(academySchema);

  it('matches known values', () => {
    expect(stableStringify({ b: 1, a: [true, null, undefined], c: undefined })).toBe(
      '{"a":[true,null,null],"b":1}',
    );
    expect(hash53('')).toMatch(/^[0-9a-f]{14}$/);
    expect(academyChecksumOf({})).toMatch(/^cyrb53:[0-9a-f]{14}$/);
  });

  it.skipIf(!haveAcademy)(
    'gives the same text and hash as the Academy’s own code, for any JSON',
    async () => {
      const academy = (await import(/* @vite-ignore */ academyChecksum)) as {
        stableStringify(value: unknown): string;
        hash53(text: string): string;
        checksumOf(value: unknown): string;
      };
      fc.assert(
        fc.property(fc.jsonValue(), fc.string({ unit: 'grapheme' }), (value, text) => {
          expect(stableStringify(value)).toBe(academy.stableStringify(value));
          expect(hash53(text)).toBe(academy.hash53(text));
          expect(academyChecksumOf(value)).toBe(academy.checksumOf(value));
        }),
        { numRuns: 300 },
      );
    },
  );

  it.skipIf(!haveAcademy)('accepts a file sealed by the Academy’s own checksum code', async () => {
    const academy = (await import(/* @vite-ignore */ academyChecksum)) as {
      checksumOf(value: unknown): string;
    };
    const file = makeAcademyExport({
      sessions: [{ id: 's-1', startedAt: '2026-03-02T15:00:00Z' }],
      checksumOf: academy.checksumOf,
    });
    expect(checkAcademyExport(file)).toMatchObject({ ok: true });
  });

  it.skipIf(!haveAcademy)('builds fixtures the Academy itself would read back unchanged', async () => {
    type Parse = (data: unknown) => { ok: true; value: unknown } | { ok: false; issues: string[] };
    const schema = (await import(/* @vite-ignore */ academySchema)) as {
      parseProfile: Parse;
      parseLessonSession: Parse;
      parseAttempt: Parse;
    };
    const file = makeAcademyExport({
      sessions: [
        {
          id: 's-1',
          startedAt: '2026-03-02T15:00:00Z',
          attempts: [{}, { tryIndex: 1, assistance: 'hint', hintLevel: 1 }],
        },
        { id: 's-2', startedAt: '2026-03-03T15:00:00Z', completed: false },
      ],
      orphanAttempts: 1,
    });
    // The Academy re-reads each record through these before it checks the sum: they must change nothing.
    expect(schema.parseProfile(file.profile)).toEqual({ ok: true, value: file.profile });
    for (const session of file.sessions)
      expect(schema.parseLessonSession(session)).toEqual({ ok: true, value: session });
    for (const attempt of file.attempts)
      expect(schema.parseAttempt(attempt)).toEqual({ ok: true, value: attempt });
  });
});

describe('summing up an export', () => {
  it('gives one row per sitting, dated where the family lives, with help counted', () => {
    const file = makeAcademyExport({
      sessions: [
        {
          id: 's-late',
          // 9 p.m. on the 3rd in Chicago is already the 4th in UTC.
          startedAt: '2026-03-04T03:00:00Z',
          lessonId: 'rr-move-01',
          attempts: [
            {},
            { stage: 'guided' },
            { hintLevel: 1, assistance: 'hint' },
            { assistance: 'adult' },
            { tryIndex: 1, outcome: 'incorrect' },
          ],
        },
        {
          id: 's-other',
          startedAt: '2026-03-02T15:00:00Z',
          lessonId: 'zz-new-01',
          completed: false,
          attempts: [],
        },
      ],
      orphanAttempts: 3,
    });
    expect(summariseAcademy(fileOf(file), 'America/Chicago')).toEqual([
      {
        sessionId: 's-other',
        world: 'other',
        lessonId: 'zz-new-01',
        localDate: '2026-03-02',
        completed: false,
        attempts: 0,
        independent: 0,
        supported: 0,
      },
      {
        sessionId: 's-late',
        world: 'robot-ridge',
        lessonId: 'rr-move-01',
        localDate: '2026-03-03',
        completed: true,
        attempts: 5,
        independent: 2,
        supported: 3,
      },
    ]);
    expect(summariseAcademy(fileOf(file), 'UTC').find((s) => s.sessionId === 's-late')?.localDate).toBe(
      '2026-03-04',
    );
  });

  it('knows every island by its activities’ first letters', () => {
    expect(academyWorldOf('rc-listen-01')).toBe('reading-cove');
    expect(academyWorldOf('ng-give-01')).toBe('number-garden');
    expect(academyWorldOf('rr-move-01')).toBe('robot-ridge');
    expect(academyWorldOf('mf-pairs-01')).toBe('memory-forest');
    expect(academyWorldOf('ii-bridge-01')).toBe('inventor-island');
    expect(academyWorldOf('eh-story-01')).toBe('explorer-harbor');
    expect(academyWorldOf('ml-beat-01')).toBe('music-lab');
    expect(academyWorldOf('constructor-01')).toBe('other');
  });
});
