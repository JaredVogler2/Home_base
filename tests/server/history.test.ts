import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { csvCell } from '../../server/domain/export';
import { newId } from '../../shared/ids';
import {
  addChild,
  addReward,
  addTask,
  Browser,
  newFamily,
  occurrenceOf,
  pairWall,
  startServer,
  walletOf,
  type Family,
  type TestServer,
} from './harness';

/**
 * Looking back, taking the records away, and deleting them. These are the promises a parent is given in
 * Settings: that the numbers come with what they are out of, that an export is whole and holds no secrets, and
 * that deleting a child or the household removes every record of them.
 */

interface Summary {
  weeks: { start: string; current: boolean }[];
  children: {
    profileId: string | null;
    cells: { offered: number; done: number; earned: number; spent: number; basis: string }[];
  }[];
  detailDays: number;
}

describe('history, export and deletion', () => {
  let server: TestServer;
  let family: Family;
  let wall: Browser;
  let childId: string;
  let taskId: string;

  beforeAll(async () => {
    server = await startServer({}, '2026-03-03T15:00:00Z');
    family = await newFamily(server);
    wall = await pairWall(family);
    childId = await addChild(family, 'Robin');
    taskId = await addTask(family, { title: 'Shoes in the basket', stars: 2, verification: 'auto' });
  });

  afterAll(async () => {
    await server.close();
  });

  it('counts what was handed out and what was done, week by week', async () => {
    const occurrence = occurrenceOf(await wall.pull(), taskId, childId);
    await wall.do('occurrence.submit', { occurrenceId: occurrence.id, profileId: childId });
    const reply = await family.parent.get<Summary>('/history/summary?weeks=4');
    expect(reply.status).toBe(200);
    expect(reply.body.weeks).toHaveLength(4);
    expect(reply.body.weeks[3]?.current).toBe(true);
    const row = reply.body.children.find((child) => child.profileId === childId);
    expect(row?.cells[3]).toMatchObject({ offered: 1, done: 1, earned: 2, spent: 0, basis: 'detail' });
    // An earlier week with nothing in it says so, rather than showing a zero that looks like a result.
    expect(row?.cells[0]?.basis).toBe('none');
  });

  it('refuses a number of weeks it will not go back', async () => {
    expect((await family.parent.get('/history/summary?weeks=0')).status).toBe(400);
    expect((await family.parent.get('/history/summary?weeks=500')).status).toBe(400);
  });

  it('shows a child’s star lines, and the totals agree with them', async () => {
    const ledger = await family.parent.get<{
      entries: { kind: string; available: number; lifetime: number; source: string }[];
    }>(`/history/ledger?profileId=${childId}`);
    expect(ledger.body.entries).toHaveLength(1);
    expect(ledger.body.entries[0]).toMatchObject({
      kind: 'grant',
      available: 2,
      lifetime: 2,
      source: 'task',
    });
    const check = await family.parent.get<{ ok: boolean }>('/history/reconcile');
    expect(check.body.ok).toBe(true);
  });

  it('is closed to the wall', async () => {
    for (const path of [
      '/history/summary',
      `/history/ledger?profileId=${childId}`,
      '/history/events',
      '/history/changes',
      '/history/reconcile',
      '/export/household.json',
      '/export/ledger.csv',
      '/export/history.csv',
    ]) {
      expect((await wall.get(path)).status, path).toBe(403);
    }
    expect((await wall.post(`/family/profiles/${childId}/delete`, { nickname: 'Robin' })).status).toBe(403);
    expect((await wall.post('/family/household/delete', { password: 'x', name: 'Test Family' })).status).toBe(
      403,
    );
  });

  it('exports everything in one file, with no secret in it', async () => {
    const reply = await family.parent.get<{
      format: string;
      children: { nickname: string }[];
      stars: { ledger: unknown[] };
      missions: { title: string }[];
    }>('/export/household.json');
    expect(reply.status).toBe(200);
    expect(reply.headers.get('content-disposition')).toContain('attachment');
    expect(reply.headers.get('cache-control')).toBe('no-store');
    expect(reply.body.format).toBe('homebase.household-export');
    expect(reply.body.children.map((child) => child.nickname)).toContain('Robin');
    expect(reply.body.stars.ledger).toHaveLength(1);
    expect(reply.body.missions.map((mission) => mission.title)).toContain('Shoes in the basket');
    // Hashes, tokens and addresses stay behind.
    const text = JSON.stringify(reply.body);
    expect(text).not.toMatch(/scrypt\$/);
    expect(text).not.toMatch(/passwordHash|pinHash|tokenHash|codeHash/);
    expect(text).not.toContain(family.email);
  });

  it('writes the ledger as a spreadsheet that cannot run a formula', async () => {
    await family.parent.do('ledger.bonus', {
      entryId: newId(),
      profileId: childId,
      stars: 1,
      note: '=HYPERLINK("x")',
    });
    const reply = await family.parent.get<string>('/export/ledger.csv');
    expect(reply.headers.get('content-type')).toContain('text/csv');
    const lines = reply.body.trim().split('\r\n');
    expect(lines[0]).toBe('when,child,kind,to spend,set aside,earned in all,from,note,by');
    expect(lines).toHaveLength(3);
    expect(reply.body).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('plain, with a comma')).toBe('"plain, with a comma"');
    expect(csvCell(null)).toBe('');
  });

  it('keeps another household out of all of it', async () => {
    const other = await newFamily(server);
    const reply = await other.parent.get<{ entries: unknown[] }>(`/history/ledger?profileId=${childId}`);
    expect(reply.body.entries).toEqual([]);
    const gone = await other.parent.post(`/family/profiles/${childId}/delete`, { nickname: 'Robin' });
    expect(gone.status).toBe(404);
    expect(walletOf(await family.parent.pull(), childId).lifetime).toBe(3);
  });

  it('deletes a child and every record of them, only when the nickname is typed', async () => {
    await addReward(family, 1, { title: 'Pick the story' });
    const wrong = await family.parent.post(`/family/profiles/${childId}/delete`, { nickname: 'Robyn' });
    expect(wrong.status).toBe(400);

    const done = await family.parent.post(`/family/profiles/${childId}/delete`, { nickname: 'robin' });
    expect(done.status).toBe(200);
    const snapshot = await family.parent.pull();
    expect(snapshot.profiles.find((profile) => profile.id === childId)).toBeUndefined();
    expect(snapshot.wallets.find((wallet) => wallet.profileId === childId)).toBeUndefined();
    expect(snapshot.occurrences.filter((occurrence) => occurrence.profileId === childId)).toEqual([]);
    const exported = await family.parent.get<{
      stars: { ledger: unknown[] };
      lookBack: { events: { profileId: string | null }[] };
      setUpChanges: { action: string; detail: Record<string, unknown> }[];
    }>('/export/household.json');
    expect(exported.body.stars.ledger).toEqual([]);
    expect(exported.body.lookBack.events.filter((event) => event.profileId === childId)).toEqual([]);
    // What remains is a note that a child was deleted — not who.
    const note = exported.body.setUpChanges.find((change) => change.action === 'profile.deleted');
    expect(note).toBeDefined();
    expect(JSON.stringify(note)).not.toContain('Robin');
  });

  it('deletes the household only for its owner, with the password and the name', async () => {
    const doomed = await newFamily(server);
    const invite = await doomed.parent.post<{ code: string }>('/auth/invites', { role: 'guardian' });
    const second = new Browser(server);
    const joined = await second.post('/auth/join', {
      code: invite.body.code,
      email: `second-${newId().slice(0, 8)}@example.test`,
      password: 'a-long-enough-password',
      displayName: 'Second',
    });
    expect(joined.status).toBe(201);
    const name = 'Test Family';
    expect(
      (await second.post('/family/household/delete', { password: 'a-long-enough-password', name })).status,
    ).toBe(403);
    expect(
      (await doomed.parent.post('/family/household/delete', { password: 'not-my-password', name })).status,
    ).toBe(400);
    expect(
      (
        await doomed.parent.post('/family/household/delete', {
          password: doomed.password,
          name: 'Another house',
        })
      ).status,
    ).toBe(400);
    const done = await doomed.parent.post('/family/household/delete', { password: doomed.password, name });
    expect(done.status).toBe(200);
    // Both grown-ups are signed out, and the accounts went with the household.
    expect((await doomed.parent.get('/sync')).status).toBe(401);
    expect((await second.get('/sync')).status).toBe(401);
    const again = new Browser(server);
    expect((await again.post('/auth/login', { email: doomed.email, password: doomed.password })).status).toBe(
      401,
    );
    // The first family is untouched.
    expect((await family.parent.get('/sync')).status).toBe(200);
  });
});
