import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Snapshot } from '../../shared/model';
import { Browser, startServer, type TestServer } from './harness';

/**
 * The demo: a made-up family that anybody may look at. It has to be a believable household — and, more to the
 * point, an honest one: its stars must add up from its own record like any other family's, and none of it may
 * exist on a deployment that has not been told it is a demo.
 */

describe('the demo household', () => {
  let server: TestServer;
  let parent: Browser;
  let snapshot: Snapshot;

  beforeAll(async () => {
    server = await startServer({ demo: true }, '2026-11-25T22:00:00Z');
    parent = new Browser(server);
    const entered = await parent.post('/demo/enter', { as: 'guardian' });
    expect(entered.status).toBe(200);
    snapshot = await parent.pull();
  });

  afterAll(async () => {
    await server.close();
  });

  it('is a family with children, missions, routines, rewards and lists, marked as made up', () => {
    expect(snapshot.household.demo).toBe(true);
    expect(snapshot.profiles.map((profile) => profile.nickname)).toEqual(['June', 'Milo', 'Bea']);
    expect(snapshot.templates?.length).toBeGreaterThan(5);
    expect(snapshot.routines.length).toBeGreaterThan(2);
    expect(snapshot.rewards.length).toBeGreaterThan(3);
    expect(snapshot.lists.length).toBeGreaterThan(0);
    // Nothing in it is a real place: the position is the made-up town's, and nobody's address.
    expect(snapshot.household.settings.location?.label).toBe('Demo town');
  });

  it('has stars that add up from its own record, line by line', async () => {
    const check = await parent.get<{ ok: boolean; children: { matches: boolean }[] }>('/history/reconcile');
    expect(check.body.ok).toBe(true);
    expect(check.body.children.length).toBeGreaterThan(1);
    const june = snapshot.wallets.find((wallet) => wallet.profileId === snapshot.profiles[0]?.id);
    // A few stars on the tray, not a hoard; and far more earned over the weeks than is there to spend.
    expect(june?.available).toBeGreaterThan(5);
    expect(june?.available).toBeLessThan(40);
    expect(june?.lifetime).toBeGreaterThan(june?.available ?? 0);
  });

  it('has eight weeks to look back on, each with what it was out of', async () => {
    const reply = await parent.get<{
      weeks: unknown[];
      children: {
        profileId: string | null;
        cells: { offered: number; done: number; earned: number; basis: string }[];
      }[];
      routines: { started: number; completed: number }[];
      rewards: { asked: number; fulfilled: number };
      shopping: { staples: unknown[] };
    }>('/history/summary?weeks=8');
    expect(reply.status).toBe(200);
    const june = reply.body.children.find((row) => row.profileId === snapshot.profiles[0]?.id);
    const known = june?.cells.filter((cell) => cell.basis === 'detail') ?? [];
    expect(known.length).toBeGreaterThanOrEqual(8);
    for (const cell of known) {
      expect(cell.done).toBeLessThanOrEqual(cell.offered);
      expect(cell.offered).toBeGreaterThan(0);
    }
    // Stars came in during earlier weeks too, not all at once on the day the demo was made.
    expect(known.filter((cell) => cell.earned > 0).length).toBeGreaterThanOrEqual(6);
    expect(reply.body.routines.some((routine) => routine.started > 0 && routine.completed > 0)).toBe(true);
    expect(reply.body.rewards.fulfilled).toBeGreaterThan(0);
    expect(reply.body.shopping.staples.length).toBeGreaterThan(0);
  });

  it('can be put back to how it started', async () => {
    const juneId = snapshot.profiles[0]?.id ?? '';
    const lifetimeOf = (view: Snapshot) =>
      view.wallets.find((wallet) => wallet.profileId === juneId)?.lifetime ?? 0;
    const before = lifetimeOf(snapshot);
    await parent.do('ledger.bonus', {
      entryId: '11111111-1111-4111-8111-111111111111',
      profileId: juneId,
      stars: 3,
      note: null,
    });
    expect(lifetimeOf(await parent.pull())).toBe(before + 3);
    expect((await parent.post('/demo/reset')).status).toBe(200);
    const fresh = new Browser(server);
    await fresh.post('/demo/enter', { as: 'guardian' });
    expect(lifetimeOf(await fresh.pull())).toBe(before);
  });

  it('does not exist where the deployment is not a demo', async () => {
    const real = await startServer({ demo: false });
    try {
      const visitor = new Browser(real);
      expect((await visitor.post('/demo/enter', { as: 'guardian' })).status).toBe(404);
      expect((await visitor.post('/demo/reset')).status).toBe(404);
    } finally {
      await real.close();
    }
  });
});
