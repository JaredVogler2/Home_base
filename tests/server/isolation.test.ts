import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '../../shared/ids.js';
import { inHousehold } from '../../server/db/client.js';
import { HOUSEHOLD_TABLES } from '../../server/db/schema.js';
import {
  addChild,
  addReward,
  addTask,
  newFamily,
  occurrenceOf,
  pairWall,
  startServer,
  taskInput,
  walletOf,
  type TestServer,
} from './harness.js';

let server: TestServer;
beforeAll(async () => {
  server = await startServer({}, '2026-03-03T21:00:00Z');
});
afterAll(async () => {
  await server.close();
});

describe('two families on one deployment', () => {
  it('cannot see or touch anything of each other’s, by any request', async () => {
    const ours = await newFamily(server);
    const theirs = await newFamily(server);
    const ourKid = await addChild(ours, 'Ours');
    const theirKid = await addChild(theirs, 'Theirs');
    const theirTask = await addTask(theirs, { stars: 5, title: 'Their mission' });
    const theirReward = await addReward(theirs, 1);
    const theirList = (await theirs.parent.pull()).lists[0]!.id;
    const theirOccurrence = occurrenceOf(theirs.parent.snapshot!, theirTask, theirKid);
    const ourWall = await pairWall(ours);

    const snapshot = await ours.parent.pull();
    const text = JSON.stringify(snapshot);
    expect(text).not.toContain('Theirs');
    expect(text).not.toContain('Their mission');
    expect(text).not.toContain(theirs.householdId);

    const attempts = await Promise.all([
      ours.parent.op('occurrence.markDone', { occurrenceId: theirOccurrence.id, profileId: theirKid }),
      ours.parent.op('occurrence.approve', { occurrenceIds: [theirOccurrence.id] }),
      ours.parent.op('ledger.bonus', { entryId: newId(), profileId: theirKid, stars: 99, note: null }),
      ours.parent.op('task.update', { ...taskInput(theirTask, { title: 'Hacked' }), baseVersion: 1 }),
      ours.parent.op('task.status', { templateId: theirTask, status: 'archived' }),
      ours.parent.op('task.create', taskInput(newId(), { assignees: [theirKid] })),
      ours.parent.op('profile.update', {
        profileId: theirKid,
        nickname: 'Hacked',
        avatar: 'cat',
        ageBand: 'early',
        independent: true,
        showNumbers: true,
      }),
      ours.parent.op('reward.status', { rewardId: theirReward, status: 'archived' }),
      ourWall.op('redemption.request', {
        redemptionId: newId(),
        profileId: ourKid,
        rewardId: theirReward,
        rewardVersion: 1,
        price: 1,
      }),
      ourWall.op('occurrence.submit', { occurrenceId: theirOccurrence.id, profileId: ourKid }),
      ours.parent.op('shopping.add', {
        itemId: newId(),
        listId: theirList,
        text: 'Planted',
        quantity: null,
        unit: null,
        note: null,
        url: null,
        store: null,
        priority: false,
        category: 'other',
        picture: 'other',
      }),
    ]);
    for (const outcome of attempts) expect(outcome.status, JSON.stringify(outcome)).toBe('rejected');

    const after = await theirs.parent.pull();
    expect(after.profiles[0]?.nickname).toBe('Theirs');
    expect(after.templates?.[0]).toMatchObject({ title: 'Their mission', status: 'active' });
    expect(walletOf(after, theirKid).available).toBe(0);
    expect(after.items).toHaveLength(0);
    expect(after.rewards[0]?.status).toBe('active');
  });

  it('are kept apart by the database itself, whatever the query asks for', async () => {
    const ours = await newFamily(server);
    const theirs = await newFamily(server);
    await addChild(theirs, 'Theirs');
    await addTask(theirs);
    expect(server.database.rls).toBe(true);
    for (const table of HOUSEHOLD_TABLES) {
      const rows = await inHousehold(server.database, ours.householdId, (tx) =>
        tx.execute(
          sql.raw(
            `select count(*)::int as c from "homebase"."${table}" where "household_id" = '${theirs.householdId}'`,
          ),
        ),
      );
      expect((rows.rows[0] as { c: number }).c, table).toBe(0);
    }
    // No WHERE at all: still only our own rows.
    const all = await inHousehold(server.database, ours.householdId, (tx) =>
      tx.execute(sql`select "household_id" from "homebase"."profiles"`),
    );
    const owners = (all.rows as { household_id: string }[]).map((row) => row.household_id);
    expect(owners.every((owner) => owner === ours.householdId)).toBe(true);
    // Writing into another household is refused, and so is moving a row there.
    await expect(
      inHousehold(server.database, ours.householdId, (tx) =>
        tx.execute(
          sql`insert into "homebase"."profiles" ("id", "household_id", "nickname", "avatar", "age_band") values (${newId()}, ${theirs.householdId}, 'Planted', 'cat', 'early')`,
        ),
      ),
    ).rejects.toThrow();
    const moved = await inHousehold(server.database, ours.householdId, (tx) =>
      tx.execute(
        sql`update "homebase"."profiles" set "nickname" = 'Hacked' where "household_id" = ${theirs.householdId} returning "id"`,
      ),
    );
    expect(moved.rows).toHaveLength(0);
  });

  it('keeps accounts, sessions and codes out of reach of household work altogether', async () => {
    const ours = await newFamily(server);
    for (const statement of [
      `select "password_hash" from "homebase"."users"`,
      `select "email" from "homebase"."users"`,
      `select * from "homebase"."sessions"`,
      `select * from "homebase"."recovery_codes"`,
      `select * from "homebase"."pair_codes"`,
      `update "homebase"."ledger" set "available" = 1000`,
      `delete from "homebase"."ledger"`,
      `delete from "homebase"."audit"`,
      `insert into "homebase"."households" ("id", "name", "time_zone") values ('${newId()}', 'Extra', 'UTC')`,
      `update "homebase"."households" set "demo" = true`,
    ]) {
      await expect(
        inHousehold(server.database, ours.householdId, (tx) => tx.execute(sql.raw(statement))),
        statement,
      ).rejects.toThrow();
    }
    // What it may see of a grown-up: a name and a picture, of its own members only.
    const names = await inHousehold(server.database, ours.householdId, (tx) =>
      tx.execute(sql`select "display_name" from "homebase"."users"`),
    );
    expect(names.rows).toEqual([{ display_name: 'Alex' }]);
  });
});

describe('what a wall in child mode may do', () => {
  it('is decided by the session, never by which child is “selected” or what the request claims', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const task = await addTask(family, { verification: 'guardian' });
    const wall = await pairWall(family);
    const occurrence = occurrenceOf(await wall.pull(), task, kit);
    const forbidden = await wall.ops([
      { id: newId(), type: 'task.create', input: taskInput(newId()) },
      { id: newId(), type: 'occurrence.approve', input: { occurrenceIds: [occurrence.id] } },
      { id: newId(), type: 'occurrence.markDone', input: { occurrenceId: occurrence.id, profileId: kit } },
      {
        id: newId(),
        type: 'ledger.bonus',
        input: { entryId: newId(), profileId: kit, stars: 5, note: null },
      },
      { id: newId(), type: 'household.settings', input: { patch: { wall: { holdGate: true } } } },
      {
        id: newId(),
        type: 'profile.create',
        input: { profileId: newId(), nickname: 'Sneaky', avatar: 'cat', ageBand: 'early', independent: true },
      },
      { id: newId(), type: 'device.revoke', input: { deviceId: newId() } },
      { id: newId(), type: 'member.remove', input: { userId: newId() } },
      // Claims about itself that the server does not listen to.
      {
        id: newId(),
        type: 'ledger.bonus',
        input: { entryId: newId(), profileId: kit, stars: 5, note: null, access: 'owner', role: 'owner' },
      },
    ]);
    expect(forbidden.map((outcome) => outcome.status)).toEqual(Array(9).fill('rejected'));
    expect(
      forbidden
        .slice(0, 8)
        .every((outcome) => outcome.status === 'rejected' && outcome.reason === 'forbidden'),
    ).toBe(true);
  });

  it('loses the everyday household actions too when the family switches the press-and-hold off', async () => {
    const family = await newFamily(server);
    const wall = await pairWall(family);
    const list = (await wall.pull()).lists[0]!.id;
    const add = (text: string) =>
      wall.op('shopping.add', {
        itemId: newId(),
        listId: list,
        text,
        quantity: null,
        unit: null,
        note: null,
        url: null,
        store: null,
        priority: false,
        category: 'other',
        picture: 'other',
      });
    expect((await add('Milk')).status).toBe('applied');
    await family.parent.do('household.settings', { patch: { wall: { holdGate: false } } });
    expect(await add('Bread')).toMatchObject({ status: 'rejected', reason: 'forbidden' });
    expect((await wall.pull()).viewer.access).toBe('child');
  });

  it('does not let a request that was refused while locked go through later when a grown-up unlocks', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const wall = await pairWall(family);
    await family.parent.post('/auth/pin', { pin: '4071' });
    const userId = (await family.parent.pull()).members[0]?.userId;
    const queued = {
      id: newId(),
      type: 'ledger.bonus',
      input: { entryId: newId(), profileId: kit, stars: 50, note: null },
    };
    expect((await wall.ops([queued]))[0]).toMatchObject({ status: 'rejected', reason: 'forbidden' });
    await wall.post('/wall/unlock', { userId, pin: '4071' });
    // The same queued request, replayed after the unlock: its answer was "no", and stays "no".
    expect((await wall.ops([queued]))[0]).toMatchObject({ status: 'rejected', reason: 'forbidden' });
    expect(walletOf(await wall.pull(), kit).available).toBe(0);
  });
});

describe('requests that are not requests', () => {
  it('answers each one in a batch separately, and one bad one does not undo the good ones', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const good = newId();
    const outcomes = await family.parent.ops([
      { id: good, type: 'ledger.bonus', input: { entryId: newId(), profileId: kit, stars: 2, note: null } },
      { id: newId(), type: 'no.such.thing', input: {} },
      { id: 'not-an-id', type: 'ledger.bonus', input: {} },
      { id: newId(), type: 'ledger.bonus', input: { profileId: kit, stars: -4 } },
      { id: newId(), type: '__proto__', input: {} },
    ]);
    expect(outcomes.map((outcome) => outcome.status)).toEqual([
      'applied',
      'rejected',
      'rejected',
      'rejected',
      'rejected',
    ]);
    expect(walletOf(await family.parent.pull(), kit).available).toBe(2);
  });

  it('refuses a body that is not JSON, too many at once, or nothing', async () => {
    const family = await newFamily(server);
    expect(
      (
        await family.parent.request('POST', '/sync/ops', 'ops=1', {
          'content-type': 'application/x-www-form-urlencoded',
        })
      ).status,
    ).toBe(400);
    expect((await family.parent.request('POST', '/sync/ops', '{not json')).status).toBe(400);
    expect((await family.parent.post('/sync/ops', { ops: [] })).status).toBe(400);
    expect(
      (
        await family.parent.post('/sync/ops', {
          ops: Array.from({ length: 26 }, () => ({ id: newId(), type: 'x', input: {} })),
        })
      ).status,
    ).toBe(400);
    expect((await family.parent.post('/sync/ops', { ops: 'drop table' })).status).toBe(400);
  });

  it('will not let settings be bent into something else', async () => {
    const family = await newFamily(server);
    for (const patch of [
      { quietHours: { start: '25:99' } },
      { wall: { relockSeconds: 999999 } },
      { academy: { url: 'https://evil.example/', enabled: true } },
      { academy: { url: 'javascript:alert(1)' } },
      { academy: { url: 'https://training-academy-dun.vercel.app/?token=abc' } },
      { ai: { monthlyCapCents: -1 } },
      { __proto__: { polluted: true }, guideName: '' },
    ]) {
      expect((await family.parent.op('household.settings', { patch })).status, JSON.stringify(patch)).toBe(
        'rejected',
      );
    }
    await family.parent.do('household.settings', {
      patch: {
        academy: { url: 'https://training-academy-dun.vercel.app/', enabled: true },
        guideName: 'Pip',
      },
    });
    const settings = (await family.parent.pull()).household.settings;
    expect(settings.academy).toMatchObject({
      enabled: true,
      url: 'https://training-academy-dun.vercel.app/',
    });
    expect(settings.guideName).toBe('Pip');
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it('rounds a home’s position to the middle of its area, and tells a child’s wall no more than that', async () => {
    const family = await newFamily(server);
    await family.parent.do('household.settings', {
      patch: { location: { lat: 39.123456, lon: -94.987654, label: '64101' } },
    });
    const wall = await pairWall(family);
    expect((await family.parent.pull()).household.settings.location).toEqual({
      lat: 39.12,
      lon: -94.99,
      label: '64101',
    });
    expect((await wall.pull()).household.settings.location).toEqual({ lat: 39.12, lon: -94.99, label: '' });
    const audit = await server.database.db.execute(
      `select detail from homebase.audit where action = 'settings.changed' and household_id = '${family.householdId}'`,
    );
    expect(JSON.stringify(audit.rows)).not.toContain('64101');
    expect(JSON.stringify(audit.rows)).not.toContain('39.1');
  });
});
