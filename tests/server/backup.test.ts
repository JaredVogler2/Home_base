import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { newId } from '../../shared/ids.js';
import {
  addChild,
  addTask,
  Browser,
  newFamily,
  occurrenceOf,
  pairWall,
  PG_ADMIN,
  startServer,
  USING_POSTGRES,
  walletOf,
} from './harness.js';

/**
 * Backing up and putting back, the way docs/DEPLOYMENT.md says to: `pg_dump --schema=homebase --no-owner`, then
 * the file into an empty database. Run only against a real PostgreSQL (`npm run test:pg`), and only where the
 * `pg_dump` on this machine is the same major version as the server: an older one refuses to run, and a newer
 * one writes settings into the file that the older server refuses when it is put back (found the first time
 * this ran in CI, with pg_dump 17 and a PostgreSQL 16).
 */

function toolsFit(): boolean {
  if (!USING_POSTGRES) return false;
  try {
    const tool = Number(/(\d+)\./.exec(execFileSync('pg_dump', ['--version']).toString())?.[1] ?? 0);
    const server = Number(
      /^(\d+)/.exec(execFileSync('psql', [PG_ADMIN, '-Atc', 'show server_version']).toString())?.[1] ?? 99,
    );
    if (tool !== server) {
      console.warn(
        `[backup test] skipped: pg_dump is version ${tool} and the server is ${server}; they must match.`,
      );
    }
    return tool === server;
  } catch {
    return false;
  }
}

describe.skipIf(!toolsFit())('backing up and putting back', () => {
  it('restores a household whole from a pg_dump: the same people, stars, record and list, and it carries on', async () => {
    const at = '2026-03-03T21:00:00Z';
    const source = await startServer({}, at);
    const targetName = `hb_restore_${Math.random().toString(36).slice(2, 12)}`;
    const targetUrl = new URL(PG_ADMIN);
    targetUrl.pathname = `/${targetName}`;
    try {
      // A household with a little of everything.
      const family = await newFamily(source);
      const kit = await addChild(family, 'Kit');
      const task = await addTask(family, { stars: 2 });
      const wall = await pairWall(family);
      const mission = occurrenceOf(await wall.pull(), task, kit);
      await wall.do('occurrence.submit', { occurrenceId: mission.id, profileId: kit });
      await family.parent.do('ledger.bonus', {
        entryId: newId(),
        profileId: kit,
        stars: 3,
        note: 'Helped Grandpa',
      });
      const list = (await family.parent.pull()).lists.find((entry) => entry.kind === 'groceries')!;
      await family.parent.do('shopping.add', {
        itemId: newId(),
        listId: list.id,
        text: 'Oat milk',
        quantity: 2,
        unit: null,
        note: null,
        url: null,
        store: null,
        priority: false,
        category: 'dairy',
        picture: 'milk',
      });
      const before = await family.parent.pull();
      const ledgerBefore = await family.parent.get<string>('/export/ledger.csv');

      // The backup, exactly as the deployment guide gives it.
      const dump = execFileSync(
        'pg_dump',
        [source.deps.config.databaseUrl!, '--schema=homebase', '--no-owner'],
        {
          maxBuffer: 256 * 1024 * 1024,
        },
      );
      expect(dump.length).toBeGreaterThan(10_000);

      // An empty database, and the file put into it.
      const admin = new pg.Client({ connectionString: PG_ADMIN });
      await admin.connect();
      await admin.query(`create database ${targetName}`);
      await admin.end();
      execFileSync('psql', [targetUrl.toString(), '-q', '-v', 'ON_ERROR_STOP=1'], { input: dump });

      // HOMEBASE started against the restored database: nothing to migrate, and the household is all there.
      const restored = await startServer({ databaseUrl: targetUrl.toString() }, at);
      try {
        const health = await new Browser(restored).get<{ database: string; isolation: string }>('/health');
        expect(health.body).toMatchObject({ database: 'ok', isolation: 'database' });

        const phone = new Browser(restored);
        const signedIn = await phone.post('/auth/login', { email: family.email, password: family.password });
        expect(signedIn.status).toBe(200);
        const after = await phone.pull();
        expect(after.profiles.map((profile) => profile.nickname)).toEqual(
          before.profiles.map((profile) => profile.nickname),
        );
        expect(walletOf(after, kit)).toEqual(walletOf(before, kit));
        expect(walletOf(after, kit)).toMatchObject({ available: 5, lifetime: 5 });
        expect(after.items.map((item) => [item.text, item.quantity])).toEqual([['Oat milk', 2]]);
        expect(after.badges).toEqual(before.badges);
        // The record of stars, line for line.
        expect((await phone.get<string>('/export/ledger.csv')).body).toBe(ledgerBefore.body);

        // The restored database still keeps households apart, and still takes new work.
        const stranger = await newFamily(restored);
        expect((await stranger.parent.pull()).profiles).toEqual([]);
        await phone.do('ledger.bonus', { entryId: newId(), profileId: kit, stars: 1, note: null });
        expect(walletOf(await phone.pull(), kit).available).toBe(6);
        // The wall's pairing came back with the rest: the same screen is still that family's wall.
        expect(after.devices?.some((device) => device.kind === 'wall')).toBe(true);
      } finally {
        await restored.close();
      }
    } finally {
      await source.close();
      const admin = new pg.Client({ connectionString: PG_ADMIN });
      await admin.connect();
      await admin.query(`drop database if exists ${targetName} with (force)`);
      await admin.end();
    }
  }, 120_000);
});
