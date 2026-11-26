import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '../../shared/ids.js';
import { inHousehold } from '../../server/db/client.js';
import { makeCtx, readHousehold, SYSTEM_ACTOR } from '../../server/domain/context.js';
import { reconcile } from '../../server/domain/ledger.js';
import {
  addChild,
  addReward,
  newFamily,
  pairWall,
  startServer,
  walletOf,
  type Family,
  type TestServer,
} from './harness.js';

let server: TestServer;
beforeAll(async () => {
  server = await startServer({}, '2026-03-03T21:00:00Z');
});
afterAll(async () => {
  await server.close();
});

async function give(family: Family, profileId: string, stars: number) {
  await family.parent.do('ledger.bonus', { entryId: newId(), profileId, stars, note: 'For the test' });
}

async function assertLedgerAgrees(family: Family) {
  const result = await inHousehold(server.database, family.householdId, async (tx) => {
    const household = await readHousehold(tx, family.householdId);
    return reconcile(makeCtx(tx, household!, SYSTEM_ACTOR, server.clock.now()));
  });
  for (const line of result)
    expect(line.matches, `wallet of ${line.profileId} should equal its ledger`).toBe(true);
  return result;
}

describe('asking for a reward', () => {
  it('sets the stars aside at once, and a grown-up’s yes spends them', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const reward = await addReward(family, 5);
    await give(family, kit, 8);
    const wall = await pairWall(family);
    const redemptionId = newId();
    const asked = await wall.op('redemption.request', {
      redemptionId,
      profileId: kit,
      rewardId: reward,
      rewardVersion: 1,
      price: 5,
    });
    expect(asked).toMatchObject({ status: 'applied', data: { status: 'requested', available: 3 } });
    expect(walletOf(wall.snapshot!, kit)).toMatchObject({ available: 3, reserved: 5, lifetime: 8 });
    expect(wall.snapshot!.redemptions[0]).toMatchObject({
      status: 'requested',
      price: 5,
      title: 'Family game',
    });

    // The wall cannot answer its own request.
    expect(await wall.op('redemption.decide', { redemptionId, approve: true })).toMatchObject({
      status: 'rejected',
      reason: 'forbidden',
    });

    await family.parent.do('redemption.decide', { redemptionId, approve: true });
    expect(walletOf(family.parent.snapshot!, kit)).toMatchObject({ available: 3, reserved: 0, lifetime: 8 });
    await family.parent.do('redemption.fulfill', { redemptionId });
    expect(family.parent.snapshot!.redemptions[0]?.status).toBe('fulfilled');
    await assertLedgerAgrees(family);
  });

  it('gives the stars back when the answer is “not this time”, with neutral words', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const reward = await addReward(family, 5, { stock: 2 });
    await give(family, kit, 5);
    const wall = await pairWall(family);
    const redemptionId = newId();
    await wall.do('redemption.request', {
      redemptionId,
      profileId: kit,
      rewardId: reward,
      rewardVersion: 1,
      price: 5,
    });
    expect(wall.snapshot!.rewards[0]?.stock).toBe(1);
    await family.parent.do('redemption.decide', { redemptionId, approve: false, reason: 'another' });
    const snapshot = await wall.pull();
    expect(walletOf(snapshot, kit)).toMatchObject({ available: 5, reserved: 0, lifetime: 5 });
    expect(snapshot.redemptions[0]).toMatchObject({ status: 'declined', declineReason: 'another' });
    expect(snapshot.rewards[0]?.stock).toBe(2);
    await assertLedgerAgrees(family);
  });

  it('lets a child change their mind before anyone answers, and not after', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const reward = await addReward(family, 4);
    await give(family, kit, 8);
    const wall = await pairWall(family);
    const first = newId();
    await wall.do('redemption.request', {
      redemptionId: first,
      profileId: kit,
      rewardId: reward,
      rewardVersion: 1,
      price: 4,
    });
    await wall.do('redemption.cancel', { redemptionId: first });
    expect(walletOf(wall.snapshot!, kit)).toMatchObject({ available: 8, reserved: 0 });
    const second = newId();
    await wall.do('redemption.request', {
      redemptionId: second,
      profileId: kit,
      rewardId: reward,
      rewardVersion: 1,
      price: 4,
    });
    await family.parent.do('redemption.decide', { redemptionId: second, approve: true });
    expect(await wall.op('redemption.cancel', { redemptionId: second })).toMatchObject({
      status: 'rejected',
      reason: 'not_allowed_now',
    });
  });

  it('cannot spend the same stars twice, whatever arrives at once', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const reward = await addReward(family, 6);
    await give(family, kit, 10);
    const wall = await pairWall(family);
    const tablet = await pairWall(family, 'Tablet');
    // Two screens, two requests for a six-star reward, ten stars in the bank, the same instant.
    const [a, b] = await Promise.all([
      wall.op('redemption.request', {
        redemptionId: newId(),
        profileId: kit,
        rewardId: reward,
        rewardVersion: 1,
        price: 6,
      }),
      tablet.op('redemption.request', {
        redemptionId: newId(),
        profileId: kit,
        rewardId: reward,
        rewardVersion: 1,
        price: 6,
      }),
    ]);
    expect([a.status, b.status].sort()).toEqual(['applied', 'rejected']);
    const refused = a.status === 'rejected' ? a : b;
    expect(refused).toMatchObject({ reason: 'not_enough_stars' });
    expect(walletOf(await wall.pull(), kit)).toMatchObject({ available: 4, reserved: 6 });
    await assertLedgerAgrees(family);
  });

  it('answers once when two parents answer at the same moment — even differently', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const reward = await addReward(family, 5);
    await give(family, kit, 5);
    const wall = await pairWall(family);
    const redemptionId = newId();
    await wall.do('redemption.request', {
      redemptionId,
      profileId: kit,
      rewardId: reward,
      rewardVersion: 1,
      price: 5,
    });
    const [yes, no] = await Promise.all([
      family.parent.op('redemption.decide', { redemptionId, approve: true }),
      family.parent.op('redemption.decide', { redemptionId, approve: false }),
    ]);
    // Whichever arrived first stands; the other is told it has been answered.
    expect([yes.status, no.status].sort()).toEqual(['applied', 'rejected']);
    const wallet = walletOf(await wall.pull(), kit);
    expect(wallet.reserved).toBe(0);
    expect([0, 5]).toContain(wallet.available);
    await assertLedgerAgrees(family);
  });

  it('shows a changed price again instead of charging it', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const reward = await addReward(family, 5);
    await give(family, kit, 20);
    const wall = await pairWall(family);
    await wall.pull();
    // The child is looking at "5 stars". A parent makes it 12.
    await family.parent.do('reward.update', {
      rewardId: reward,
      baseVersion: 1,
      title: 'Family game',
      picture: 'game',
      say: null,
      price: 12,
      stock: null,
      profiles: [],
    });
    const stale = await wall.op('redemption.request', {
      redemptionId: newId(),
      profileId: kit,
      rewardId: reward,
      rewardVersion: 1,
      price: 5,
    });
    expect(stale).toMatchObject({ status: 'rejected', reason: 'price_changed' });
    expect(walletOf(wall.snapshot!, kit)).toMatchObject({ available: 20, reserved: 0 });
    // Having seen the new price, the child may say yes to it.
    expect(wall.snapshot!.rewards[0]).toMatchObject({ price: 12, version: 2 });
    await wall.do('redemption.request', {
      redemptionId: newId(),
      profileId: kit,
      rewardId: reward,
      rewardVersion: 2,
      price: 12,
    });
    expect(walletOf(wall.snapshot!, kit)).toMatchObject({ available: 8, reserved: 12 });
  });

  it('refuses what is paused, sold out, or not for this child', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const bo = await addChild(family, 'Bo');
    await give(family, kit, 30);
    await give(family, bo, 30);
    const wall = await pairWall(family);
    const paused = await addReward(family, 5, { title: 'Paused' });
    await family.parent.do('reward.status', { rewardId: paused, status: 'paused' });
    expect(
      await wall.op('redemption.request', {
        redemptionId: newId(),
        profileId: kit,
        rewardId: paused,
        rewardVersion: 2,
        price: 5,
      }),
    ).toMatchObject({ reason: 'not_offered' });

    const last = await addReward(family, 5, { title: 'Last one', stock: 1 });
    await wall.do('redemption.request', {
      redemptionId: newId(),
      profileId: kit,
      rewardId: last,
      rewardVersion: 1,
      price: 5,
    });
    expect(
      await wall.op('redemption.request', {
        redemptionId: newId(),
        profileId: bo,
        rewardId: last,
        rewardVersion: 1,
        price: 5,
      }),
    ).toMatchObject({ reason: 'out_of_stock' });

    const forKit = newId();
    await family.parent.do('reward.create', {
      rewardId: forKit,
      title: 'Just Kit',
      picture: 'toy',
      say: null,
      price: 5,
      stock: null,
      profiles: [kit],
    });
    expect(
      await wall.op('redemption.request', {
        redemptionId: newId(),
        profileId: bo,
        rewardId: forKit,
        rewardVersion: 1,
        price: 5,
      }),
    ).toMatchObject({ reason: 'not_offered' });
    // A paused reward is not on the wall at all.
    expect((await wall.pull()).rewards.map((reward) => reward.title)).not.toContain('Paused');
  });

  it('refunds a reward that will not happen after all', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const reward = await addReward(family, 7);
    await give(family, kit, 7);
    const wall = await pairWall(family);
    const redemptionId = newId();
    await wall.do('redemption.request', {
      redemptionId,
      profileId: kit,
      rewardId: reward,
      rewardVersion: 1,
      price: 7,
    });
    await family.parent.do('redemption.decide', { redemptionId, approve: true });
    await family.parent.do('redemption.refund', { redemptionId, note: 'Rained off' });
    await family.parent.op('redemption.refund', { redemptionId, note: 'again' });
    expect(walletOf(await wall.pull(), kit)).toMatchObject({ available: 7, reserved: 0, lifetime: 7 });
    await assertLedgerAgrees(family);
  });

  it('never lowers lifetime stars by spending', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const reward = await addReward(family, 9);
    await give(family, kit, 10);
    const wall = await pairWall(family);
    const redemptionId = newId();
    await wall.do('redemption.request', {
      redemptionId,
      profileId: kit,
      rewardId: reward,
      rewardVersion: 1,
      price: 9,
    });
    await family.parent.do('redemption.decide', { redemptionId, approve: true });
    expect(walletOf(family.parent.snapshot!, kit)).toMatchObject({ available: 1, lifetime: 10 });
  });
});

describe('the ledger', () => {
  it('can be worked out again from its lines, after everything that can happen has happened', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const reward = await addReward(family, 3);
    const wall = await pairWall(family);
    await give(family, kit, 12);
    for (let round = 0; round < 3; round++) {
      const redemptionId = newId();
      await wall.do('redemption.request', {
        redemptionId,
        profileId: kit,
        rewardId: reward,
        rewardVersion: 1,
        price: 3,
      });
      if (round === 0) await family.parent.do('redemption.decide', { redemptionId, approve: true });
      if (round === 1) await family.parent.do('redemption.decide', { redemptionId, approve: false });
      if (round === 2) await wall.do('redemption.cancel', { redemptionId });
    }
    await family.parent.do('ledger.correct', {
      entryId: newId(),
      profileId: kit,
      available: -2,
      lifetime: -2,
      note: 'Counted twice by mistake',
    });
    const [line] = await assertLedgerAgrees(family);
    expect(line?.wallet).toMatchObject({ available: 7, reserved: 0, lifetime: 10 });
  });

  it('gives a bonus once however often the same request arrives', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const opId = newId();
    const entryId = newId();
    for (let attempt = 0; attempt < 3; attempt++) {
      await family.parent.op('ledger.bonus', { entryId, profileId: kit, stars: 4, note: null }, opId);
    }
    // A different request that names the same line is the same gift, not another.
    await family.parent.op('ledger.bonus', { entryId, profileId: kit, stars: 4, note: null });
    expect(walletOf(await family.parent.pull(), kit).available).toBe(4);
  });

  it('refuses a correction that would leave fewer than no stars, and says a correction must change something', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    await give(family, kit, 2);
    expect(
      await family.parent.op('ledger.correct', {
        entryId: newId(),
        profileId: kit,
        available: -5,
        lifetime: 0,
        note: 'Too much',
      }),
    ).toMatchObject({ reason: 'not_enough_stars' });
    expect(
      await family.parent.op('ledger.correct', {
        entryId: newId(),
        profileId: kit,
        available: 0,
        lifetime: 0,
        note: 'Nothing',
      }),
    ).toMatchObject({ reason: 'invalid' });
    expect(walletOf(await family.parent.pull(), kit)).toMatchObject({ available: 2, lifetime: 2 });
  });

  it('is not something a child’s screen or a helper can write to', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const wall = await pairWall(family);
    expect(
      await wall.op('ledger.bonus', { entryId: newId(), profileId: kit, stars: 50, note: null }),
    ).toMatchObject({ reason: 'forbidden' });
    const invite = await family.parent.post<{ code: string }>('/auth/invites', { role: 'caregiver' });
    const { Browser } = await import('./harness.js');
    const helper = new Browser(server);
    await helper.post('/auth/join', {
      code: invite.body.code,
      email: `helper-${newId()}@example.test`,
      password: 'another long password',
      displayName: 'Jo',
    });
    expect(
      await helper.op('ledger.bonus', { entryId: newId(), profileId: kit, stars: 50, note: null }),
    ).toMatchObject({ reason: 'forbidden' });
    expect(walletOf(await family.parent.pull(), kit).available).toBe(0);
  });

  it('gives the weekly stars once on their day, however many screens wake up', async () => {
    const week = await startServer({}, '2026-03-06T15:00:00Z'); // a Friday
    try {
      const family = await newFamily(week);
      const kit = await addChild(family, 'Kit');
      await family.parent.do('household.settings', {
        patch: { bank: { allowance: { enabled: true, stars: 3, weekday: 6 } } },
      });
      const wall = await pairWall(family);
      await wall.pull();
      expect(walletOf(wall.snapshot!, kit).available).toBe(0);
      week.clock.set('2026-03-07T12:00:00Z'); // Saturday
      await Promise.all([wall.pull(), family.parent.pull(), wall.pull()]);
      week.clock.set('2026-03-07T20:00:00Z');
      expect(walletOf(await wall.pull(), kit)).toMatchObject({ available: 3, lifetime: 3 });
      week.clock.set('2026-03-08T15:00:00Z');
      expect(walletOf(await wall.pull(), kit).available).toBe(3);
    } finally {
      await week.close();
    }
  });
});

describe('saving up', () => {
  it('remembers what a child is saving for until they ask for it', async () => {
    const family = await newFamily(server);
    const kit = await addChild(family, 'Kit');
    const reward = await addReward(family, 6);
    const wall = await pairWall(family);
    await wall.do('goal.set', { profileId: kit, rewardId: reward });
    expect(wall.snapshot!.goals).toEqual([{ profileId: kit, rewardId: reward }]);
    await give(family, kit, 6);
    await wall.do('redemption.request', {
      redemptionId: newId(),
      profileId: kit,
      rewardId: reward,
      rewardVersion: 1,
      price: 6,
    });
    expect(wall.snapshot!.goals).toEqual([]);
  });
});
