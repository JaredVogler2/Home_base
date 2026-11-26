import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import * as v from 'valibot';
import { isUuid } from '../../../shared/ids.js';
import { hasAccess } from '../../../shared/model.js';
import { accessOf } from '../../auth/sessions.js';
import { media, mediaBlobs } from '../../db/schema.js';
import { auditLog, bumpRevision } from '../../domain/context.js';
import { readJson, requireSession, withHousehold, type AppEnv } from '../env.js';
import { badRequest, conflict, forbidden, HttpError, notFound } from '../errors.js';

/**
 * The family's own photos, for the wall's slideshow.
 *
 * A grown-up's phone does the work: it turns the photo the right way up, makes a few smaller copies and encodes
 * them afresh, so what reaches us has no camera details in it (no place, no time, no phone) and the server needs
 * no image library at all. We only keep the bytes — in the database, so a small household needs nothing else —
 * and look at the first few of them to be sure they are a photo and not a page or a script.
 *
 *   POST /media               "a photo is coming": its id and the size of the original
 *   PUT  /media/:id/:width    one copy, as raw JPEG or WebP bytes
 *   GET  /media/:id/:width    the copy nearest that width, for any screen of the household
 */

/** The most photos one household keeps. */
export const MAX_PHOTOS = 500;
/** The most copies of one photo (a ladder of widths). */
export const MAX_COPIES = 4;
/** The largest one copy may be. */
export const MAX_COPY_BYTES = 4_000_000;
const MIN_WIDTH = 160;
const MAX_WIDTH = 3840;

type ImageType = 'image/jpeg' | 'image/webp';

/** What the first bytes say the file is: only the two kinds we keep, and nothing else. */
function sniff(bytes: Uint8Array): ImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  return null;
}

function declaredType(header: string | undefined): ImageType | null {
  const type = (header ?? '').split(';')[0]?.trim().toLowerCase();
  return type === 'image/jpeg' || type === 'image/webp' ? type : null;
}

function wholeNumber(text: string, min: number, max: number): number | null {
  if (!/^\d{1,5}$/.test(text)) return null;
  const value = Number(text);
  return value >= min && value <= max ? value : null;
}

/** Of the copies there are, the one to send for a screen that wants this width. */
export function bestWidth(widths: readonly number[], wanted: number): number | null {
  const sorted = [...widths].sort((a, b) => a - b);
  return sorted.find((width) => width >= wanted) ?? sorted.at(-1) ?? null;
}

const tooBig = () =>
  new HttpError('payload_too_large', 'That photo is too large. Each copy can be at most 4 MB.');

export const mediaRoutes = new Hono<AppEnv>();

mediaRoutes.post('/', async (c) => {
  const parsed = v.safeParse(
    v.object({
      mediaId: v.pipe(
        v.string(),
        v.check((value: string) => isUuid(value), 'an id'),
      ),
      width: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(20000)),
      height: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(20000)),
    }),
    await readJson(c, 4 * 1024),
  );
  if (!parsed.success) throw badRequest('That photo did not come with its id and size.');
  const { mediaId, width, height } = parsed.output;
  await withHousehold(
    c,
    'guardian',
    async (ctx) => {
      // Asked again (a retry after a lost reply): the answer is the same, and nothing new is made.
      const existing = await ctx.tx
        .select({ id: media.id })
        .from(media)
        .where(and(eq(media.id, mediaId), eq(media.householdId, ctx.household.id)))
        .limit(1);
      if (existing[0]) return;
      const counted = await ctx.tx
        .select({ count: sql<number>`count(*)::int` })
        .from(media)
        .where(and(eq(media.householdId, ctx.household.id), isNull(media.deletedAt)));
      if (Number(counted[0]?.count ?? 0) >= MAX_PHOTOS) {
        throw conflict(
          `HOMEBASE keeps up to ${MAX_PHOTOS} photos. Remove a few old ones to make room for new ones.`,
        );
      }
      const made = await ctx.tx
        .insert(media)
        .values({
          id: mediaId,
          householdId: ctx.household.id,
          width,
          height,
          widths: [],
          bytes: 0,
          inSlideshow: true,
          createdBy: ctx.actor.userId,
          createdAt: ctx.now,
        })
        .onConflictDoNothing()
        .returning({ id: media.id });
      // The id is taken, and not by this household: the phone should make a new one.
      if (!made[0]) throw conflict('That photo could not be added. Please try again.');
      await auditLog(ctx, 'media.added', {});
    },
    { lock: true },
  );
  return c.json({ ok: true, mediaId });
});

mediaRoutes.put('/:id/:width', async (c) => {
  const deps = c.get('deps');
  const mediaId = c.req.param('id');
  const width = wholeNumber(c.req.param('width'), MIN_WIDTH, MAX_WIDTH);
  if (!isUuid(mediaId)) throw notFound('That photo is not here.');
  if (width === null) throw badRequest(`A copy is between ${MIN_WIDTH} and ${MAX_WIDTH} pixels wide.`);
  const declared = declaredType(c.req.header('content-type'));
  if (!declared) throw badRequest('Photos are sent as JPEG or WebP.');
  const length = Number(c.req.header('content-length') ?? '0');
  if (length > MAX_COPY_BYTES) throw tooBig();

  // Who may send is checked before the bytes are read, and the bytes are read before the household is held.
  if (!hasAccess(accessOf(requireSession(c), false), 'guardian')) throw forbidden();
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.length > MAX_COPY_BYTES) throw tooBig();
  const actual = sniff(bytes);
  if (!actual) throw badRequest('That is not a JPEG or WebP photo.');
  if (actual !== declared) throw badRequest('That photo is not the kind it says it is.');

  const widths = await withHousehold(
    c,
    'guardian',
    async (ctx) => {
      const rows = await ctx.tx
        .select({ widths: media.widths, bytes: media.bytes })
        .from(media)
        .where(and(eq(media.id, mediaId), eq(media.householdId, ctx.household.id), isNull(media.deletedAt)))
        .limit(1);
      const photo = rows[0];
      if (!photo) throw notFound('That photo is not here.');
      const replacing = photo.widths.includes(width);
      if (!replacing && photo.widths.length >= MAX_COPIES) {
        throw conflict(`A photo has at most ${MAX_COPIES} sizes, and this one has them all.`);
      }

      // The household's total, with this copy in place of the one it replaces.
      const sizes = await ctx.tx
        .select({
          total: sql<number>`coalesce(sum(octet_length(${mediaBlobs.data})), 0)::bigint`,
          old: sql<number>`coalesce(sum(octet_length(${mediaBlobs.data})) filter (where ${mediaBlobs.mediaId} = ${mediaId} and ${mediaBlobs.width} = ${width}), 0)::bigint`,
        })
        .from(mediaBlobs)
        .where(eq(mediaBlobs.householdId, ctx.household.id));
      const total = Number(sizes[0]?.total ?? 0) - Number(sizes[0]?.old ?? 0) + bytes.length;
      if (total > deps.config.mediaLimitBytes) {
        throw conflict('The photo space is full. Remove a few old photos to make room for new ones.');
      }

      await ctx.tx
        .insert(mediaBlobs)
        .values({ mediaId, householdId: ctx.household.id, width, contentType: actual, data: bytes })
        .onConflictDoUpdate({
          target: [mediaBlobs.mediaId, mediaBlobs.width],
          set: { contentType: actual, data: bytes },
        });
      const kept = await ctx.tx
        .select({ width: mediaBlobs.width, size: sql<number>`octet_length(${mediaBlobs.data})` })
        .from(mediaBlobs)
        .where(and(eq(mediaBlobs.mediaId, mediaId), eq(mediaBlobs.householdId, ctx.household.id)))
        .orderBy(asc(mediaBlobs.width));
      const stored = kept.map((row) => row.width);
      await ctx.tx
        .update(media)
        .set({ widths: stored, bytes: kept.reduce((sum, row) => sum + Number(row.size), 0) })
        .where(eq(media.id, mediaId));
      // The wall hears there is a new photo (or a better copy of one) at its next check-in.
      await bumpRevision(ctx);
      return stored;
    },
    { lock: true },
  );
  return c.json({ ok: true, widths });
});

mediaRoutes.get('/:id/:width', async (c) => {
  const mediaId = c.req.param('id');
  const wanted = wholeNumber(c.req.param('width'), 1, 20000);
  if (!isUuid(mediaId) || wanted === null) throw notFound('That photo is not here.');
  const copy = await withHousehold(c, 'child', async (ctx) => {
    const rows = await ctx.tx
      .select({ widths: media.widths, inSlideshow: media.inSlideshow })
      .from(media)
      .where(and(eq(media.id, mediaId), eq(media.householdId, ctx.household.id), isNull(media.deletedAt)))
      .limit(1);
    const photo = rows[0];
    if (!photo) return null;
    // A wall nobody has unlocked shows only what the slideshow shows — and nothing while visitors are round.
    const grownUp = hasAccess(ctx.actor.level, 'caregiver');
    if (!grownUp && (ctx.household.settings.memories.hidden || !photo.inSlideshow)) return null;
    const width = bestWidth(photo.widths, wanted);
    if (width === null) return null;
    const found = await ctx.tx
      .select({ contentType: mediaBlobs.contentType, data: mediaBlobs.data })
      .from(mediaBlobs)
      .where(
        and(
          eq(mediaBlobs.mediaId, mediaId),
          eq(mediaBlobs.householdId, ctx.household.id),
          eq(mediaBlobs.width, width),
        ),
      )
      .limit(1);
    return found[0] ?? null;
  });
  // Another household's photo, a removed one and a hidden one all look the same: not here.
  if (!copy) throw notFound('That photo is not here.');
  // A screen may keep a copy for good: the phone sends each width once (sending one again only mends a failed
  // upload), and a removed photo is simply never asked for again.
  c.header('Content-Type', copy.contentType);
  c.header('Cache-Control', 'private, max-age=31536000, immutable');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Content-Disposition', 'inline');
  c.header('Cross-Origin-Resource-Policy', 'same-origin');
  return c.body(new Uint8Array(copy.data));
});
