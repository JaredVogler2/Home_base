import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addChild, addTask, Browser, newFamily, startServer, type TestServer } from './harness';

/**
 * The once-a-day nudge from the host. It must do nothing for anyone who does not hold the host's secret, and
 * for the host it must do each household's morning exactly once however often it is called.
 */

describe('the daily nudge', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startServer({ cronSecret: 'a-secret-only-the-host-holds' }, '2026-03-03T15:00:00Z');
  });
  afterAll(async () => {
    await server.close();
  });

  it('answers nobody without the secret', async () => {
    const stranger = new Browser(server);
    expect((await stranger.get('/cron/daily')).status).toBe(401);
    expect(
      (await stranger.request('GET', '/cron/daily', undefined, { authorization: 'Bearer wrong' })).status,
    ).toBe(401);
    expect(
      (
        await stranger.request('GET', '/cron/daily', undefined, {
          authorization: 'a-secret-only-the-host-holds',
        })
      ).status,
    ).toBe(401);
  });

  it('is switched off entirely where no secret has been set', async () => {
    const open = await startServer({ cronSecret: null });
    try {
      const reply = await new Browser(open).request('GET', '/cron/daily', undefined, {
        authorization: 'Bearer ',
      });
      expect(reply.status).toBe(401);
    } finally {
      await open.close();
    }
  });

  it('gets each household’s morning ready once, and says nothing about them', async () => {
    const family = await newFamily(server);
    const childId = await addChild(family, 'Robin');
    const taskId = await addTask(family, { stars: 1 });
    const before = (await family.parent.pull()).occurrences.length;
    expect(before).toBe(1);

    // The next morning, before anybody has opened a screen.
    server.clock.set('2026-03-04T12:00:00Z');
    const host = new Browser(server);
    const auth = { authorization: 'Bearer a-secret-only-the-host-holds' };
    const first = await host.request<{ ok: boolean; households: number; kept: number }>(
      'GET',
      '/cron/daily',
      undefined,
      auth,
    );
    expect(first.status).toBe(200);
    expect(first.body.kept).toBe(1);
    expect(Object.keys(first.body).sort()).toEqual(['households', 'kept', 'ok']);
    const second = await host.request<{ kept: number }>('GET', '/cron/daily', undefined, auth);
    expect(second.body.kept).toBe(0);

    const today = (await family.parent.pull()).occurrences.filter(
      (occurrence) => occurrence.templateId === taskId && occurrence.profileId === childId,
    );
    expect(today.filter((occurrence) => occurrence.date === '2026-03-04')).toHaveLength(1);
  });
});
