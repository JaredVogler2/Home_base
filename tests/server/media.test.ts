import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newId } from '../../shared/ids.js';
import { attempt, LIMITS } from '../../server/auth/rate-limit.js';
import { asSystem } from '../../server/db/client.js';
import { media, mediaBlobs } from '../../server/db/schema.js';
import {
  Browser,
  newFamily,
  ORIGIN,
  pairWall,
  startServer,
  type Family,
  type TestServer,
} from './harness.js';

/**
 * The family's own photos. The phone makes the copies; the server keeps the bytes, checks they are a photo,
 * keeps to the quota, and gives each one only to the household's own screens.
 */

let server: TestServer;
const LIMIT = 40_000;
beforeAll(async () => {
  server = await startServer({ mediaLimitBytes: LIMIT });
});
afterAll(async () => {
  await server.close();
});

/** Enough of a JPEG to pass a look at its first bytes: the server only sniffs. */
function jpeg(size = 64, fill = 1): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(size).fill(fill);
  bytes.set([0xff, 0xd8, 0xff, 0xe0], 0);
  return bytes;
}

function webp(size = 64): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(size).fill(2);
  bytes.set(new TextEncoder().encode('RIFF'), 0);
  bytes.set(new TextEncoder().encode('WEBPVP8 '), 8);
  return bytes;
}

async function put(
  browser: Browser,
  mediaId: string,
  width: number,
  bytes: Uint8Array<ArrayBuffer>,
  type = 'image/jpeg',
  extra: Record<string, string> = {},
) {
  const headers: Record<string, string> = { 'content-type': type, origin: ORIGIN, ...extra };
  if (browser.cookie) headers.cookie = browser.cookie;
  const response = await server.app.request(`${ORIGIN}/api/media/${mediaId}/${width}`, {
    method: 'PUT',
    headers,
    body: bytes,
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

async function fetchCopy(browser: Browser, mediaId: string, width: number) {
  const headers: Record<string, string> = {};
  if (browser.cookie) headers.cookie = browser.cookie;
  const response = await server.app.request(`${ORIGIN}/api/media/${mediaId}/${width}`, { headers });
  return {
    status: response.status,
    headers: response.headers,
    bytes: new Uint8Array(await response.arrayBuffer()),
  };
}

async function create(family: Family, mediaId = newId()) {
  const reply = await family.parent.post<{ ok: boolean; mediaId: string }>('/media', {
    mediaId,
    width: 4000,
    height: 3000,
  });
  expect(reply.status).toBe(200);
  return mediaId;
}

describe('photos', () => {
  it('stores copies and serves the nearest width', async () => {
    const family = await newFamily(server);
    const mediaId = await create(family);
    const small = jpeg(100, 7);
    const large = jpeg(300, 9);
    expect((await put(family.parent, mediaId, 960, small)).body).toEqual({ ok: true, widths: [960] });
    const second = await put(family.parent, mediaId, 1920, large);
    expect(second).toEqual({ status: 200, body: { ok: true, widths: [960, 1920] } });

    const exact = await fetchCopy(family.parent, mediaId, 960);
    expect(exact.status).toBe(200);
    expect(exact.bytes).toEqual(small);
    // Between the two: the smallest that is at least that wide.
    expect((await fetchCopy(family.parent, mediaId, 1200)).bytes).toEqual(large);
    // Wider than any: the largest there is.
    expect((await fetchCopy(family.parent, mediaId, 3840)).bytes).toEqual(large);
    // Narrower than any: the smallest.
    expect((await fetchCopy(family.parent, mediaId, 200)).bytes).toEqual(small);

    const snapshot = await family.parent.pull();
    const item = snapshot.media.find((one) => one.id === mediaId);
    expect(item?.widths).toEqual([960, 1920]);
  });

  it('sends a copy with headers that keep it a picture, kept privately', async () => {
    const family = await newFamily(server);
    const mediaId = await create(family);
    await put(family.parent, mediaId, 960, webp(80), 'image/webp');
    const reply = await fetchCopy(family.parent, mediaId, 960);
    expect(reply.status).toBe(200);
    expect(reply.headers.get('content-type')).toBe('image/webp');
    expect(reply.headers.get('cache-control')).toBe('private, max-age=31536000, immutable');
    expect(reply.headers.get('x-content-type-options')).toBe('nosniff');
    expect(reply.headers.get('content-disposition')).toBe('inline');
    expect(reply.headers.get('cross-origin-resource-policy')).toBe('same-origin');
  });

  it('is told of a new photo at its next check-in', async () => {
    const family = await newFamily(server);
    const before = (await family.parent.pull()).rev;
    const mediaId = await create(family);
    await put(family.parent, mediaId, 960, jpeg());
    expect((await family.parent.pull()).rev).toBeGreaterThan(before);
  });

  it('makes a photo once, however often it is asked', async () => {
    const family = await newFamily(server);
    const mediaId = newId();
    await create(family, mediaId);
    const again = await family.parent.post('/media', { mediaId, width: 4000, height: 3000 });
    expect(again).toMatchObject({ status: 200, body: { ok: true, mediaId } });
    // Until a copy has arrived there is nothing to show, so no screen is told about it.
    expect((await family.parent.pull()).media.filter((one) => one.id === mediaId)).toHaveLength(0);
    await put(family.parent, mediaId, 960, jpeg());
    const snapshot = await family.parent.pull();
    expect(snapshot.media.filter((one) => one.id === mediaId)).toHaveLength(1);
  });

  it('refuses anything that is not really a JPEG or WebP, or says it is the other', async () => {
    const family = await newFamily(server);
    const mediaId = await create(family);
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const html = new TextEncoder().encode('<!doctype html><script>alert(1)</script>');
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const gif = new TextEncoder().encode('GIF89a......');
    expect((await put(family.parent, mediaId, 960, svg)).status).toBe(400);
    expect((await put(family.parent, mediaId, 960, html)).status).toBe(400);
    expect((await put(family.parent, mediaId, 960, png)).status).toBe(400);
    expect((await put(family.parent, mediaId, 960, gif)).status).toBe(400);
    expect((await put(family.parent, mediaId, 960, new Uint8Array(0))).status).toBe(400);
    // Declared as one kind, really the other.
    expect((await put(family.parent, mediaId, 960, webp(), 'image/jpeg')).status).toBe(400);
    expect((await put(family.parent, mediaId, 960, jpeg(), 'image/webp')).status).toBe(400);
    // A kind not kept at all, whatever the bytes.
    expect((await put(family.parent, mediaId, 960, svg, 'image/svg+xml')).status).toBe(400);
    expect((await put(family.parent, mediaId, 960, jpeg(), 'text/html')).status).toBe(400);
    // A width outside the ladder.
    expect((await put(family.parent, mediaId, 100, jpeg())).status).toBe(400);
    expect((await put(family.parent, mediaId, 5000, jpeg())).status).toBe(400);
    expect((await fetchCopy(family.parent, mediaId, 960)).status).toBe(404);
  });

  it('refuses a copy over 4 MB, by its stated length and by its real one', async () => {
    const family = await newFamily(server);
    const mediaId = await create(family);
    const stated = await put(family.parent, mediaId, 960, jpeg(), 'image/jpeg', {
      'content-length': '4000001',
    });
    expect(stated.status).toBe(413);
    const real = await put(family.parent, mediaId, 960, jpeg(4_000_001));
    expect(real.status).toBe(413);
    expect(typeof (real.body.error as { message: string }).message).toBe('string');
  });

  it('keeps at most four sizes of a photo, and lets one be sent again', async () => {
    const family = await newFamily(server);
    const mediaId = await create(family);
    for (const width of [480, 960, 1920, 3840]) {
      expect((await put(family.parent, mediaId, width, jpeg(32))).status).toBe(200);
    }
    const fifth = await put(family.parent, mediaId, 1280, jpeg(32));
    expect(fifth.status).toBe(409);
    const again = await put(family.parent, mediaId, 960, jpeg(40, 5));
    expect(again.body).toEqual({ ok: true, widths: [480, 960, 1920, 3840] });
    expect((await fetchCopy(family.parent, mediaId, 960)).bytes).toEqual(jpeg(40, 5));
  });

  it('keeps to the household’s photo space, and removing a photo frees it', async () => {
    const family = await newFamily(server);
    const first = await create(family);
    const second = await create(family);
    expect((await put(family.parent, first, 1920, jpeg(30_000))).status).toBe(200);
    const full = await put(family.parent, second, 1920, jpeg(20_000));
    expect(full.status).toBe(409);
    expect((full.body.error as { message: string }).message).toMatch(/photo space is full/);
    // Replacing a copy counts the new one instead of the old, not as well as it.
    expect((await put(family.parent, first, 1920, jpeg(35_000))).status).toBe(200);

    await family.parent.do('media.remove', { mediaId: first });
    const left = await asSystem(server.database, (tx) =>
      tx.select().from(mediaBlobs).where(eq(mediaBlobs.mediaId, first)),
    );
    expect(left).toHaveLength(0);
    expect((await fetchCopy(family.parent, first, 1920)).status).toBe(404);
    expect((await put(family.parent, second, 1920, jpeg(20_000))).status).toBe(200);
  });

  it('keeps at most 500 photos', async () => {
    const family = await newFamily(server);
    await asSystem(server.database, (tx) =>
      tx.insert(media).values(
        Array.from({ length: 500 }, () => ({
          id: newId(),
          householdId: family.householdId,
          width: 10,
          height: 10,
          widths: [],
          bytes: 0,
        })),
      ),
    );
    const refused = await family.parent.post<{ error: { message: string } }>('/media', {
      mediaId: newId(),
      width: 4000,
      height: 3000,
    });
    expect(refused.status).toBe(409);
    expect(refused.body.error.message).toMatch(/500 photos/);
  });

  it('lets only a parent add photos — not the wall, not a helper', async () => {
    const family = await newFamily(server);
    const wall = await pairWall(family);
    expect((await wall.post('/media', { mediaId: newId(), width: 10, height: 10 })).status).toBe(403);
    const mediaId = await create(family);
    expect((await put(wall, mediaId, 960, jpeg())).status).toBe(403);

    const invite = await family.parent.post<{ code: string }>('/auth/invites', { role: 'caregiver' });
    const helper = new Browser(server);
    await helper.post('/auth/join', {
      code: invite.body.code,
      email: `helper-${newId()}@example.test`,
      password: 'another long password',
      displayName: 'Gran',
    });
    expect((await helper.post('/media', { mediaId: newId(), width: 10, height: 10 })).status).toBe(403);
    expect((await put(helper, mediaId, 960, jpeg())).status).toBe(403);
    expect((await put(new Browser(server), mediaId, 960, jpeg())).status).toBe(401);
  });

  it('shows the wall only what the slideshow shows', async () => {
    const family = await newFamily(server);
    const wall = await pairWall(family);
    const mediaId = await create(family);
    await put(family.parent, mediaId, 960, jpeg());
    expect((await fetchCopy(wall, mediaId, 960)).status).toBe(200);

    await family.parent.do('media.update', { mediaId, inSlideshow: false });
    expect((await fetchCopy(wall, mediaId, 960)).status).toBe(404);
    expect((await fetchCopy(family.parent, mediaId, 960)).status).toBe(200);

    await family.parent.do('media.update', { mediaId, inSlideshow: true });
    await family.parent.do('household.settings', { patch: { memories: { hidden: true } } });
    expect((await fetchCopy(wall, mediaId, 960)).status).toBe(404);
    expect((await fetchCopy(family.parent, mediaId, 960)).status).toBe(200);
  });

  it('never shows one household’s photo to another', async () => {
    const ours = await newFamily(server);
    const theirs = await newFamily(server);
    const theirWall = await pairWall(theirs);
    const mediaId = await create(ours);
    await put(ours.parent, mediaId, 960, jpeg());
    expect((await fetchCopy(theirs.parent, mediaId, 960)).status).toBe(404);
    expect((await fetchCopy(theirWall, mediaId, 960)).status).toBe(404);
    expect((await put(theirs.parent, mediaId, 960, jpeg())).status).toBe(404);
    expect((await fetchCopy(new Browser(server), mediaId, 960)).status).toBe(401);
    // Their phone cannot take our photo's id for one of theirs either.
    const taken = await theirs.parent.post('/media', { mediaId, width: 10, height: 10 });
    expect(taken.status).toBe(409);
  });

  it('stops taking copies from a household that has sent very many in a short while', async () => {
    const family = await newFamily(server);
    const mediaId = newId();
    await family.parent.post('/media', { mediaId, width: 1920, height: 1080 });
    expect((await put(family.parent, mediaId, 960, jpeg())).status).toBe(200);
    // Use the rest of the allowance up, as a run of uploads would.
    await asSystem(server.database, async (tx) => {
      for (let sent = 1; sent < LIMITS.upload.max; sent++) {
        await attempt(tx, `upload:${family.householdId}`, LIMITS.upload, server.clock.now());
      }
    });
    const refused = await put(family.parent, mediaId, 1920, jpeg(128));
    expect(refused.status).toBe(429);
    // Another family is not held up by it.
    const other = await newFamily(server);
    const theirs = newId();
    await other.parent.post('/media', { mediaId: theirs, width: 1920, height: 1080 });
    expect((await put(other.parent, theirs, 960, jpeg())).status).toBe(200);
  });
});
