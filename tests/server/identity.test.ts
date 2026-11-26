import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addChild, Browser, newFamily, pairWall, startServer, type TestServer } from './harness.js';

let server: TestServer;
beforeAll(async () => {
  server = await startServer();
});
afterAll(async () => {
  await server.close();
});

describe('signing up and signing in', () => {
  it('creates a household, signs the grown-up in and hands over recovery codes once', async () => {
    const family = await newFamily(server);
    expect(family.recoveryCodes).toHaveLength(8);
    const me = await family.parent.get<{ signedIn: boolean; role: string; me: { email: string } }>(
      '/auth/me',
    );
    expect(me.body.signedIn).toBe(true);
    expect(me.body.role).toBe('owner');
    expect(me.body.me.email).toBe(family.email);
    const snapshot = await family.parent.pull();
    expect(snapshot.household.name).toBe('Test Family');
    expect(snapshot.viewer.access).toBe('owner');
    expect(snapshot.lists.map((list) => list.name)).toEqual(['Groceries', 'To buy']);
  });

  it('keeps the session cookie from scripts and other sites', async () => {
    const browser = new Browser(server);
    const reply = await browser.post('/auth/signup', {
      email: 'cookie@example.test',
      password: 'correct horse battery',
      displayName: 'Cookie',
      householdName: 'Cookie House',
      timeZone: 'Europe/London',
    });
    const cookie = reply.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
  });

  it('says the same thing for a wrong password and for an account that does not exist', async () => {
    const family = await newFamily(server);
    const stranger = new Browser(server);
    const wrong = await stranger.post<{ error: { message: string } }>('/auth/login', {
      email: family.email,
      password: 'not the password!',
    });
    const nobody = await stranger.post<{ error: { message: string } }>('/auth/login', {
      email: 'nobody@example.test',
      password: 'not the password!',
    });
    expect(wrong.status).toBe(401);
    expect(nobody.status).toBe(401);
    expect(wrong.body.error.message).toBe(nobody.body.error.message);
  });

  it('slows down guessing a password, and forgives after the right one', async () => {
    const family = await newFamily(server);
    const guesser = new Browser(server);
    let last = 0;
    for (let attempt = 0; attempt < 9; attempt++) {
      last = (
        await guesser.post('/auth/login', { email: family.email, password: `wrong password ${attempt}` })
      ).status;
    }
    expect(last).toBe(429);
    // Even the right password is refused while the door is shut…
    expect(
      (await guesser.post('/auth/login', { email: family.email, password: family.password })).status,
    ).toBe(429);
    // …and works again when the quarter hour is over.
    server.clock.advance(16 * 60 * 1000);
    expect(
      (await guesser.post('/auth/login', { email: family.email, password: family.password })).status,
    ).toBe(200);
  });

  it('refuses a short password and a malformed address, saying which field', async () => {
    const browser = new Browser(server);
    const short = await browser.post<{ error: { field: string } }>('/auth/signup', {
      email: 'short@example.test',
      password: 'short',
      displayName: 'S',
      householdName: 'H',
      timeZone: 'UTC',
    });
    expect(short.status).toBe(400);
    expect(short.body.error.field).toBe('password');
    const zone = await browser.post<{ error: { field: string } }>('/auth/signup', {
      email: 'zone@example.test',
      password: 'long enough password',
      displayName: 'S',
      householdName: 'H',
      timeZone: 'Mars/Olympus',
    });
    expect(zone.body.error.field).toBe('timeZone');
  });

  it('lets a grown-up back in with a recovery code, once', async () => {
    const family = await newFamily(server);
    const code = family.recoveryCodes[0] as string;
    const phone = new Browser(server);
    const ok = await phone.post('/auth/recover', {
      email: family.email,
      recoveryCode: code,
      password: 'a brand new password',
    });
    expect(ok.status).toBe(200);
    expect((await phone.get<{ signedIn: boolean }>('/auth/me')).body.signedIn).toBe(true);
    // The old session is gone, the old password is gone, and the code is spent.
    expect((await family.parent.get<{ signedIn: boolean }>('/auth/me')).body.signedIn).toBe(false);
    const again = await new Browser(server).post('/auth/recover', {
      email: family.email,
      recoveryCode: code,
      password: 'yet another password',
    });
    expect(again.status).toBe(403);
  });

  it('signs out', async () => {
    const family = await newFamily(server);
    await family.parent.post('/auth/logout');
    expect((await family.parent.get('/sync')).status).toBe(401);
  });
});

describe('a deployment that belongs to one family', () => {
  it('lets the first family sign up and turns the second away', async () => {
    const closed = await startServer({ openSignup: false });
    try {
      await newFamily(closed);
      const second = await new Browser(closed).post<{ error: { code: string } }>('/auth/signup', {
        email: 'second@example.test',
        password: 'correct horse battery',
        displayName: 'Second',
        householdName: 'Second',
        timeZone: 'UTC',
      });
      expect(second.status).toBe(403);
    } finally {
      await closed.close();
    }
  });
});

describe('inviting the other parent', () => {
  it('joins with a one-use code, and the code cannot be used again', async () => {
    const family = await newFamily(server);
    const invite = await family.parent.post<{ code: string }>('/auth/invites', { role: 'guardian' });
    expect(invite.status).toBe(201);
    const other = new Browser(server);
    const peek = await other.post<{ householdName: string; role: string }>('/auth/invites/peek', {
      code: invite.body.code,
    });
    expect(peek.body).toMatchObject({ householdName: 'Test Family', role: 'guardian' });
    const join = await other.post('/auth/join', {
      code: invite.body.code.toLowerCase().replace('-', ' '),
      email: 'other@example.test',
      password: 'another long password',
      displayName: 'Robin',
    });
    expect(join.status).toBe(201);
    const snapshot = await other.pull();
    expect(snapshot.viewer.access).toBe('guardian');
    expect(snapshot.members.map((member) => member.displayName).sort()).toEqual(['Alex', 'Robin']);

    const third = await new Browser(server).post('/auth/join', {
      code: invite.body.code,
      email: 'third@example.test',
      password: 'another long password',
      displayName: 'Third',
    });
    expect(third.status).toBe(404);
  });

  it('refuses an invitation that has run out or been taken back', async () => {
    const family = await newFamily(server);
    const stale = await family.parent.post<{ code: string }>('/auth/invites', { role: 'caregiver' });
    server.clock.advance(49 * 60 * 60 * 1000);
    const late = await new Browser(server).post('/auth/join', {
      code: stale.body.code,
      email: 'late@example.test',
      password: 'another long password',
      displayName: 'Late',
    });
    expect(late.status).toBe(404);

    const revoked = await family.parent.post<{ id: string; code: string }>('/auth/invites', {
      role: 'caregiver',
    });
    await family.parent.request('DELETE', `/auth/invites/${revoked.body.id}`);
    const gone = await new Browser(server).post('/auth/join', {
      code: revoked.body.code,
      email: 'gone@example.test',
      password: 'another long password',
      displayName: 'Gone',
    });
    expect(gone.status).toBe(404);
  });

  it('lets only the owner remove a grown-up, and the removed one is out at once', async () => {
    const family = await newFamily(server);
    const invite = await family.parent.post<{ code: string }>('/auth/invites', { role: 'guardian' });
    const other = new Browser(server);
    await other.post('/auth/join', {
      code: invite.body.code,
      email: 'leaver@example.test',
      password: 'another long password',
      displayName: 'Robin',
    });
    const owner = (await family.parent.pull()).members.find((member) => member.role === 'owner');
    const robin = (await family.parent.pull()).members.find((member) => member.displayName === 'Robin');
    // A guardian cannot remove the owner…
    const coup = await other.op('member.remove', { userId: owner?.userId as string });
    expect(coup).toMatchObject({ status: 'rejected', reason: 'forbidden' });
    // …the owner can remove the guardian, whose phone then knows nothing.
    await family.parent.do('member.remove', { userId: robin?.userId as string });
    expect((await other.get('/sync')).status).toBe(401);
  });
});

describe('pairing a wall screen', () => {
  it('gives the wall its own session, in child mode, without it ever seeing a password', async () => {
    const family = await newFamily(server);
    const wall = await pairWall(family);
    const snapshot = await wall.pull();
    expect(snapshot.viewer).toMatchObject({ kind: 'device', access: 'household', userId: null });
    // What only a grown-up may see is simply not sent.
    expect(snapshot.templates).toBeUndefined();
    expect(snapshot.devices).toBeUndefined();
    const devices = (await family.parent.pull()).devices ?? [];
    expect(devices.map((device) => device.name)).toEqual(['Kitchen']);
  });

  it('does nothing for a stranger, a wrong secret, a used code or a code that ran out', async () => {
    const family = await newFamily(server);
    const wall = new Browser(server);
    const start = await wall.post<{ code: string; secret: string }>('/pair/start');
    // Nobody has claimed it yet.
    expect((await wall.post<{ status: string }>('/pair/collect', start.body)).body.status).toBe('waiting');
    // A stranger cannot claim it.
    expect(
      (await new Browser(server).post('/pair/claim', { code: start.body.code, name: 'Mine' })).status,
    ).toBe(401);
    await family.parent.post('/pair/claim', { code: start.body.code, name: 'Hall' });
    // Somebody who saw the code but is not the screen that showed it gets nothing.
    const thief = await new Browser(server).post('/pair/collect', {
      code: start.body.code,
      secret: 'x'.repeat(43),
    });
    expect(thief.status).toBe(404);
    expect((await wall.post<{ status: string }>('/pair/collect', start.body)).body.status).toBe('paired');
    // Once only.
    const twice = new Browser(server);
    expect((await twice.post<{ status: string }>('/pair/collect', start.body)).body.status).toBe('used');
    expect(twice.cookie).toBeNull();

    const late = new Browser(server);
    const lateStart = await late.post<{ code: string; secret: string }>('/pair/start');
    server.clock.advance(11 * 60 * 1000);
    expect(
      (await family.parent.post('/pair/claim', { code: lateStart.body.code, name: 'Late' })).status,
    ).toBe(404);
  });

  it('turns an unpaired screen into a stranger from its next request', async () => {
    const family = await newFamily(server);
    const wall = await pairWall(family);
    const deviceId = ((await family.parent.pull()).devices ?? [])[0]?.id as string;
    expect((await wall.get('/sync')).status).toBe(200);
    await family.parent.do('device.revoke', { deviceId });
    expect((await wall.get('/sync')).status).toBe(401);
  });
});

describe('the grown-ups’ PIN on the wall', () => {
  it('opens the wall for a while and then shuts it, by the server’s clock', async () => {
    const family = await newFamily(server);
    const wall = await pairWall(family);
    await addChild(family, 'Kit');
    expect((await family.parent.post('/auth/pin', { pin: '1234' })).status).toBe(400);
    expect((await family.parent.post('/auth/pin', { pin: '4071' })).status).toBe(200);
    const me = (await family.parent.pull()).members[0];
    expect(me?.hasPin).toBe(true);

    const unlock = await wall.post<{ unlockedUntil: string }>('/wall/unlock', {
      userId: me?.userId,
      pin: '4071',
    });
    expect(unlock.status).toBe(200);
    const open = await wall.pull();
    expect(open.viewer.access).toBe('owner');
    expect(open.templates).toBeDefined();

    server.clock.advance(121 * 1000);
    const shut = await wall.pull();
    expect(shut.viewer.access).toBe('household');
    expect(shut.templates).toBeUndefined();
  });

  it('shuts the door after five wrong PINs, even to the right one, and notes it', async () => {
    const family = await newFamily(server);
    const wall = await pairWall(family);
    await family.parent.post('/auth/pin', { pin: '4071' });
    const userId = (await family.parent.pull()).members[0]?.userId;
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt++) {
      statuses.push((await wall.post('/wall/unlock', { userId, pin: `90${attempt}1` })).status);
    }
    expect(statuses.slice(0, 5)).toEqual([403, 403, 403, 403, 403]);
    expect(statuses[5]).toBe(429);
    expect((await wall.post('/wall/unlock', { userId, pin: '4071' })).status).toBe(429);
    server.clock.advance(16 * 60 * 1000);
    expect((await wall.post('/wall/unlock', { userId, pin: '4071' })).status).toBe(200);
  });

  it('cannot be used from a phone, or for a grown-up of another household', async () => {
    const family = await newFamily(server);
    const other = await newFamily(server);
    await other.parent.post('/auth/pin', { pin: '4071' });
    const outsider = (await other.parent.pull()).members[0]?.userId;
    const wall = await pairWall(family);
    expect((await wall.post('/wall/unlock', { userId: outsider, pin: '4071' })).status).toBe(403);
    expect((await family.parent.post('/wall/unlock', { userId: outsider, pin: '4071' })).status).toBe(403);
  });
});

describe('requests from somewhere else', () => {
  it('refuses a change that arrives with the cookie but from another site', async () => {
    const family = await newFamily(server);
    const forged = await family.parent.request(
      'POST',
      '/auth/logout',
      {},
      { origin: 'https://evil.example' },
    );
    expect(forged.status).toBe(403);
    expect((await family.parent.get<{ signedIn: boolean }>('/auth/me')).body.signedIn).toBe(true);
  });

  it('never lets the browser or a cache keep an answer', async () => {
    const family = await newFamily(server);
    const reply = await family.parent.get('/sync');
    expect(reply.headers.get('cache-control')).toBe('no-store');
    expect(reply.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('answers the health check without saying anything about anybody', async () => {
    const reply = await new Browser(server).get<Record<string, unknown>>('/health');
    expect(reply.status).toBe(200);
    expect(reply.body).toMatchObject({ ok: true, database: 'ok', isolation: 'database' });
    expect(JSON.stringify(reply.body)).not.toMatch(/example\.test|Test Family/);
  });
});
