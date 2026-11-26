import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AcademySummary } from '../../shared/academy.js';
import { newId } from '../../shared/ids.js';
import { asSystem } from '../../server/db/client.js';
import { academySessions, audit, ledger } from '../../server/db/schema.js';
import type { AcademyImportResult } from '../../server/domain/academy.js';
import { makeAcademyExport, type FixtureSession } from '../shared/academy-fixture.js';
import {
  addChild,
  addTask,
  Browser,
  newFamily,
  occurrenceOf,
  pairWall,
  startServer,
  walletOf,
  type Family,
  type TestServer,
} from './harness.js';

let server: TestServer;
beforeAll(async () => {
  server = await startServer({}, '2026-03-10T18:00:00Z'); // Tuesday, noon in Chicago
});
afterAll(async () => {
  await server.close();
});

interface Refusal {
  error: { code: string; message: string; reason?: string };
}

function importing(
  browser: Browser,
  profileId: string,
  file: unknown,
  consent: { consent?: unknown } = { consent: true },
) {
  return browser.post<AcademyImportResult & Refusal>('/academy/import', { profileId, ...consent, file });
}

async function imported(browser: Browser, profileId: string, file: unknown): Promise<AcademyImportResult> {
  const reply = await importing(browser, profileId, file);
  if (reply.status !== 200) throw new Error(`import failed: ${reply.status} ${JSON.stringify(reply.body)}`);
  return reply.body;
}

async function participation(family: Family, patch: Record<string, unknown>) {
  await family.parent.do('household.settings', { patch: { academy: { participation: patch } } });
}

/** Sittings on the given Chicago days, one after another in the afternoon. */
function sittings(prefix: string, days: string[], extra: Partial<FixtureSession> = {}): FixtureSession[] {
  return days.map((day, index) => ({
    id: `${prefix}-${index + 1}`,
    startedAt: `${day}T${String(15 + (index % 5)).padStart(2, '0')}:00:00Z`,
    ...extra,
  }));
}

async function storedSittings(householdId: string, profileId: string) {
  return asSystem(server.database, (tx) =>
    tx
      .select()
      .from(academySessions)
      .where(and(eq(academySessions.householdId, householdId), eq(academySessions.profileId, profileId))),
  );
}

async function helperOf(family: Family): Promise<Browser> {
  const invite = await family.parent.post<{ code: string }>('/auth/invites', { role: 'caregiver' });
  const helper = new Browser(server);
  const joined = await helper.post('/auth/join', {
    code: invite.body.code,
    email: `helper-${newId()}@example.test`,
    password: 'another long password',
    displayName: 'Jo',
  });
  if (joined.status >= 300) throw new Error(`join failed: ${joined.status}`);
  return helper;
}

describe('bringing in an Academy export', () => {
  it('links the child, keeps a total per sitting, and gives no stars unless asked to', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const file = makeAcademyExport({
      sessions: [
        {
          id: 's-1',
          startedAt: '2026-03-09T15:00:00Z',
          lessonId: 'ng-give-01',
          attempts: [{}, { hintLevel: 1, assistance: 'hint' }, { tryIndex: 1 }],
        },
        { id: 's-2', startedAt: '2026-03-10T15:00:00Z', lessonId: 'rc-rhyme-01', completed: false },
      ],
    });
    expect(await imported(family.parent, kit, file)).toEqual({
      sessions: { new: 2, updated: 0, alreadyHad: 0 },
      stars: { granted: 0, heldBackByCap: 0 },
    });
    const snapshot = await family.parent.pull();
    expect(snapshot.academyLinks).toEqual([
      { profileId: kit, playerId: 'player-0001', lastImportAt: '2026-03-10T18:00:00.000Z' },
    ]);
    expect(walletOf(snapshot, kit)).toMatchObject({ available: 0, lifetime: 0 });
    const rows = await storedSittings(family.householdId, kit);
    expect(
      rows.map(({ sessionId, world, lessonId, localDate, completed, attempts, independent, supported }) => ({
        sessionId,
        world,
        lessonId,
        localDate,
        completed,
        attempts,
        independent,
        supported,
      })),
    ).toEqual(
      expect.arrayContaining([
        {
          sessionId: 's-1',
          world: 'number-garden',
          lessonId: 'ng-give-01',
          localDate: '2026-03-09',
          completed: true,
          attempts: 3,
          independent: 1,
          supported: 2,
        },
        {
          sessionId: 's-2',
          world: 'reading-cove',
          lessonId: 'rc-rhyme-01',
          localDate: '2026-03-10',
          completed: false,
          attempts: 2,
          independent: 2,
          supported: 0,
        },
      ]),
    );
    const logged = await asSystem(server.database, (tx) =>
      tx
        .select()
        .from(audit)
        .where(and(eq(audit.householdId, family.householdId), eq(audit.action, 'academy.imported'))),
    );
    expect(logged).toHaveLength(1);
    expect(JSON.stringify(logged[0]?.detail)).not.toContain('Player One');
  });

  it('adds nothing and gives nothing more when the same file comes again', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    await participation(family, { enabled: true, starsPerSession: 1, dailyCap: 5 });
    const file = makeAcademyExport({ sessions: sittings('s', ['2026-03-08', '2026-03-09']) });
    expect((await imported(family.parent, kit, file)).stars).toEqual({ granted: 2, heldBackByCap: 0 });
    expect(await imported(family.parent, kit, file)).toEqual({
      sessions: { new: 0, updated: 0, alreadyHad: 2 },
      stars: { granted: 0, heldBackByCap: 0 },
    });
    expect(walletOf(await family.parent.pull(), kit)).toMatchObject({ available: 2, lifetime: 2 });
    const rows = await storedSittings(family.householdId, kit);
    expect(rows.every((row) => row.creditTx !== null)).toBe(true);
    const lines = await asSystem(server.database, (tx) =>
      tx
        .select()
        .from(ledger)
        .where(and(eq(ledger.householdId, family.householdId), eq(ledger.source, 'academy'))),
    );
    expect(lines.map((line) => line.idempotencyKey).sort()).toEqual(['academy:s-1', 'academy:s-2']);
    expect(new Set(lines.map((line) => line.id))).toEqual(new Set(rows.map((row) => row.creditTx)));
  });

  it('takes only what is new from a later, longer export of the same player', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    await participation(family, { enabled: true, starsPerSession: 1, dailyCap: 5 });
    const first = makeAcademyExport({
      sessions: [
        { id: 's-1', startedAt: '2026-03-08T15:00:00Z' },
        { id: 's-2', startedAt: '2026-03-08T16:00:00Z', completed: false, attempts: [{}] },
      ],
    });
    expect(await imported(family.parent, kit, first)).toEqual({
      sessions: { new: 2, updated: 0, alreadyHad: 0 },
      stars: { granted: 1, heldBackByCap: 0 },
    });
    const later = makeAcademyExport({
      sessions: [
        { id: 's-1', startedAt: '2026-03-08T15:00:00Z' },
        { id: 's-2', startedAt: '2026-03-08T16:00:00Z', attempts: [{}, {}, { assistance: 'adult' }] },
        { id: 's-3', startedAt: '2026-03-09T15:00:00Z' },
      ],
    });
    expect(await imported(family.parent, kit, later)).toEqual({
      sessions: { new: 1, updated: 1, alreadyHad: 1 },
      stars: { granted: 2, heldBackByCap: 0 },
    });
    expect(walletOf(await family.parent.pull(), kit)).toMatchObject({ available: 3, lifetime: 3 });
    const finished = (await storedSittings(family.householdId, kit)).find((row) => row.sessionId === 's-2');
    expect(finished).toMatchObject({ completed: true, attempts: 3, supported: 1, independent: 2 });
    // An older file sent afterwards does not turn a finished sitting back.
    expect((await imported(family.parent, kit, first)).sessions).toEqual({
      new: 0,
      updated: 0,
      alreadyHad: 2,
    });
    expect(
      (await storedSittings(family.householdId, kit)).find((row) => row.sessionId === 's-2'),
    ).toMatchObject({
      completed: true,
      attempts: 3,
    });
  });

  it('refuses a file that is not an intact export, and writes nothing', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const file = makeAcademyExport({ sessions: sittings('s', ['2026-03-09']) });
    const cases: [unknown, number, string][] = [
      [{ ...file, checksum: 'cyrb53:00000000000000' }, 400, 'checksum'],
      [
        {
          ...file,
          sessions: file.sessions.map((s) => ({ ...s, status: 'completed', lessonId: 'rr-move-01' })),
        },
        400,
        'checksum',
      ],
      [{ ...file, format: 'something-else' }, 400, 'not-an-export'],
      ['just some text', 400, 'not-an-export'],
      [{ ...file, formatVersion: 2 }, 400, 'unsupported-version'],
    ];
    for (const [bad, status, reason] of cases) {
      const reply = await importing(family.parent, kit, bad);
      expect(reply.status).toBe(status);
      expect(reply.body.error.reason).toBe(reason);
    }
    const huge = makeAcademyExport({
      sessions: sittings(
        's',
        Array.from({ length: 6_000 }, () => '2026-03-09'),
      ),
    });
    const tooBig = await importing(family.parent, kit, huge);
    expect(tooBig.status).toBe(413);
    expect((await family.parent.pull()).academyLinks).toEqual([]);
    expect(await storedSittings(family.householdId, kit)).toEqual([]);
  });

  it('needs a parent’s yes', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const file = makeAcademyExport({ sessions: sittings('s', ['2026-03-09']) });
    for (const consent of [{}, { consent: false }, { consent: 'yes' }, { consent: 1 }, { consent: null }]) {
      const reply = await importing(family.parent, kit, file, consent);
      expect(reply.status).toBe(400);
      expect(reply.body.error.message).toMatch(/say yes/);
    }
    expect((await family.parent.pull()).academyLinks).toEqual([]);
  });

  it('is only for a child of this family who is not put away', async () => {
    const family = await newFamily(server);
    const other = await newFamily(server);
    const theirs = await addChild(other, 'Sam');
    const file = makeAcademyExport({ sessions: sittings('s', ['2026-03-09']) });
    expect((await importing(family.parent, theirs, file)).status).toBe(404);
    expect((await importing(family.parent, newId(), file)).status).toBe(404);
    expect((await other.parent.pull()).academyLinks).toEqual([]);

    const kit = await addChild(family, 'Kit');
    await family.parent.do('profile.archive', { profileId: kit, archived: true });
    expect((await importing(family.parent, kit, file)).status).toBe(409);
  });

  it('is for a parent: a helper and the wall may not bring a file in', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const file = makeAcademyExport({ sessions: sittings('s', ['2026-03-09']) });
    const helper = await helperOf(family);
    expect((await importing(helper, kit, file)).status).toBe(403);
    const wall = await pairWall(family);
    expect((await importing(wall, kit, file)).status).toBe(403);
    expect((await importing(new Browser(server), kit, file)).status).toBe(401);
    expect((await family.parent.pull()).academyLinks).toEqual([]);
  });

  it('keeps to the daily limit across imports', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    await participation(family, { enabled: true, starsPerSession: 1, dailyCap: 2 });
    const first = makeAcademyExport({ sessions: sittings('a', ['2026-03-09']) });
    expect((await imported(family.parent, kit, first)).stars).toEqual({ granted: 1, heldBackByCap: 0 });
    const second = makeAcademyExport({
      sessions: [
        ...sittings('a', ['2026-03-09']),
        ...sittings('b', ['2026-03-09', '2026-03-09', '2026-03-09', '2026-03-10']),
      ],
    });
    expect((await imported(family.parent, kit, second)).stars).toEqual({ granted: 2, heldBackByCap: 2 });
    expect(walletOf(await family.parent.pull(), kit)).toMatchObject({ available: 3, lifetime: 3 });
  });

  it('gives nothing while stars are off, and nothing later for sittings brought in then', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const file = makeAcademyExport({ sessions: sittings('s', ['2026-03-09', '2026-03-10']) });
    expect((await imported(family.parent, kit, file)).stars).toEqual({ granted: 0, heldBackByCap: 0 });
    await participation(family, { enabled: true, starsPerSession: 2, dailyCap: 10 });
    expect((await imported(family.parent, kit, file)).stars).toEqual({ granted: 0, heldBackByCap: 0 });
    expect(walletOf(await family.parent.pull(), kit)).toMatchObject({ available: 0, lifetime: 0 });
  });

  it('keeps but never pays for sittings dated in the future or long ago, or left unfinished', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    await participation(family, { enabled: true, starsPerSession: 1, dailyCap: 10 });
    const file = makeAcademyExport({
      sessions: [
        { id: 'future', startedAt: '2026-03-12T15:00:00Z' },
        { id: 'old', startedAt: '2026-01-05T15:00:00Z' },
        { id: 'edge', startedAt: '2026-01-09T18:00:00Z' }, // 60 days before the 10th of March
        { id: 'unfinished', startedAt: '2026-03-10T15:00:00Z', completed: false },
      ],
    });
    expect(await imported(family.parent, kit, file)).toEqual({
      sessions: { new: 4, updated: 0, alreadyHad: 0 },
      stars: { granted: 1, heldBackByCap: 0 },
    });
    const rows = await storedSittings(family.householdId, kit);
    expect(rows.filter((row) => row.creditTx !== null).map((row) => row.sessionId)).toEqual(['edge']);
  });

  it('scales spendable stars by the household’s rate, the same way a mission does', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    await family.parent.do('household.settings', { patch: { bank: { spendRatePercent: 50 } } });
    await participation(family, { enabled: true, starsPerSession: 3, dailyCap: 10 });
    await imported(family.parent, kit, makeAcademyExport({ sessions: sittings('s', ['2026-03-09']) }));
    const afterAcademy = walletOf(await family.parent.pull(), kit);
    expect(afterAcademy).toMatchObject({ available: 1, lifetime: 3 });

    const templateId = await addTask(family, { stars: 3, assignees: [kit] });
    const wall = await pairWall(family);
    const snapshot = await wall.pull();
    await wall.do('occurrence.submit', {
      occurrenceId: occurrenceOf(snapshot, templateId, kit).id,
      profileId: kit,
    });
    const afterMission = walletOf(await family.parent.pull(), kit);
    expect(afterMission.available - afterAcademy.available).toBe(afterAcademy.available);
    expect(afterMission.lifetime - afterAcademy.lifetime).toBe(afterAcademy.lifetime);
  });

  it('will not put one Academy player on two children, or two players on one child', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const ada = await addChild(family, 'Ada');
    const kits = makeAcademyExport({ playerId: 'player-kit', sessions: sittings('k', ['2026-03-09']) });
    const adas = makeAcademyExport({ playerId: 'player-ada', sessions: sittings('d', ['2026-03-09']) });
    await imported(family.parent, kit, kits);
    const sibling = await importing(family.parent, ada, kits);
    expect(sibling.status).toBe(409);
    expect(sibling.body.error.message).toMatch(/another child.*[Uu]nlink/);
    const swapped = await importing(family.parent, kit, adas);
    expect(swapped.status).toBe(409);
    expect(swapped.body.error.message).toMatch(/different Academy player.*[Uu]nlink/);
    expect((await family.parent.pull()).academyLinks).toHaveLength(1);
    expect(await storedSittings(family.householdId, ada)).toEqual([]);
  });
});

describe('unlinking the Academy', () => {
  it('deletes the link and the sittings, and leaves every star where it is', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    await participation(family, { enabled: true, starsPerSession: 2, dailyCap: 10 });
    const file = makeAcademyExport({ sessions: sittings('s', ['2026-03-08', '2026-03-09']) });
    await imported(family.parent, kit, file);
    expect(walletOf(await family.parent.pull(), kit)).toMatchObject({ available: 4, lifetime: 4 });

    await family.parent.do('academy.unlink', { profileId: kit });
    const snapshot = await family.parent.pull();
    expect(snapshot.academyLinks).toEqual([]);
    expect(walletOf(snapshot, kit)).toMatchObject({ available: 4, lifetime: 4 });
    expect(await storedSittings(family.householdId, kit)).toEqual([]);
    const lines = await asSystem(server.database, (tx) =>
      tx
        .select()
        .from(ledger)
        .where(and(eq(ledger.householdId, family.householdId), eq(ledger.source, 'academy'))),
    );
    expect(lines).toHaveLength(2);
    const summary = await family.parent.get<AcademySummary>(`/academy/summary?profileId=${kit}`);
    expect(summary.body).toMatchObject({ linked: false, lastImportAt: null, worlds: [] });

    // Linking again and sending the same file does not pay for the same sittings twice.
    expect(await imported(family.parent, kit, file)).toEqual({
      sessions: { new: 2, updated: 0, alreadyHad: 0 },
      stars: { granted: 0, heldBackByCap: 0 },
    });
    expect(walletOf(await family.parent.pull(), kit)).toMatchObject({ available: 4, lifetime: 4 });
  });
});

describe('the parents’ summary', () => {
  it('sums each island over the weeks asked for, with what each number is out of', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const file = makeAcademyExport({
      sessions: [
        {
          id: 'n-1',
          startedAt: '2026-03-09T15:00:00Z',
          lessonId: 'ng-give-01',
          attempts: [{}, { hintLevel: 1, assistance: 'hint' }],
        },
        {
          id: 'n-2',
          startedAt: '2026-03-02T15:00:00Z',
          lessonId: 'ng-glance-01',
          completed: false,
          attempts: [{}],
        },
        {
          id: 'r-1',
          startedAt: '2026-03-10T15:00:00Z',
          lessonId: 'rc-listen-01',
          attempts: [{ assistance: 'adult' }],
        },
        { id: 'r-old', startedAt: '2026-01-05T15:00:00Z', lessonId: 'rc-listen-01', attempts: [{}, {}, {}] },
        { id: 'future', startedAt: '2026-03-20T15:00:00Z', lessonId: 'rc-listen-01' },
      ],
    });
    const empty = await family.parent.get<AcademySummary>(`/academy/summary?profileId=${kit}`);
    expect(empty.body).toMatchObject({ linked: false, worlds: [] });
    await imported(family.parent, kit, file);

    const reply = await family.parent.get<AcademySummary>(`/academy/summary?profileId=${kit}`);
    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({
      profileId: kit,
      linked: true,
      lastImportAt: '2026-03-10T18:00:00.000Z',
      weeks: 8,
      from: '2026-01-14',
      to: '2026-03-10',
      worlds: [
        { world: 'number-garden', sessions: 2, completed: 1, attempts: 3, independent: 2, supported: 1 },
        { world: 'reading-cove', sessions: 1, completed: 1, attempts: 1, independent: 0, supported: 1 },
      ],
    });
    const oneWeek = await family.parent.get<AcademySummary>(`/academy/summary?profileId=${kit}&weeks=1`);
    expect(oneWeek.body.from).toBe('2026-03-04');
    expect(oneWeek.body.worlds.find((w) => w.world === 'number-garden')).toMatchObject({
      sessions: 1,
      attempts: 2,
    });
    const long = await family.parent.get<AcademySummary>(`/academy/summary?profileId=${kit}&weeks=26`);
    expect(long.body.worlds.find((w) => w.world === 'reading-cove')).toMatchObject({
      sessions: 2,
      attempts: 4,
    });

    for (const weeks of ['0', '27', 'x', '2.5', '']) {
      expect((await family.parent.get(`/academy/summary?profileId=${kit}&weeks=${weeks}`)).status).toBe(400);
    }
    expect((await family.parent.get('/academy/summary?profileId=nobody')).status).toBe(400);
    expect((await family.parent.get(`/academy/summary?profileId=${newId()}`)).status).toBe(404);
  });

  it('is for parents and carers, not for the wall or another family', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const helper = await helperOf(family);
    expect((await helper.get(`/academy/summary?profileId=${kit}`)).status).toBe(200);
    const wall = await pairWall(family);
    expect((await wall.get(`/academy/summary?profileId=${kit}`)).status).toBe(403);
    const other = await newFamily(server);
    expect((await other.parent.get(`/academy/summary?profileId=${kit}`)).status).toBe(404);
  });
});
