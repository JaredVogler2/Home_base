import { Hono } from 'hono';
import * as v from 'valibot';
import { ACADEMY_SUMMARY_WEEKS, MAX_ACADEMY_FILE_CHARS } from '../../../shared/academy.js';
import { isUuid } from '../../../shared/ids.js';
import type { Rejection } from '../../../shared/ops.js';
import { AcademyFileRejected, academySummary, importAcademy } from '../../domain/academy.js';
import { Reject } from '../../domain/context.js';
import { readJson, requireSession, withHousehold, type AppEnv } from '../env.js';
import { badRequest, HttpError, type ErrorCode } from '../errors.js';

/**
 * Training Academy progress, brought in by a parent from a file.
 *
 *   POST /academy/import    { profileId, consent: true, file }  — a parent only; says what was added
 *   GET  /academy/summary   ?profileId=…&weeks=…                — parents and carers; practice by island
 *
 * The file is the Academy's own export, sent as it is. Everything about it is checked here: nothing the phone
 * worked out — least of all a number of stars — is taken on trust. See server/domain/academy.ts.
 */

/** An export with room to spare, inside the JSON it travels in. */
const IMPORT_MAX_BYTES = MAX_ACADEMY_FILE_CHARS + 16 * 1024;

const CODE_OF: Partial<Record<Rejection, ErrorCode>> = {
  forbidden: 'forbidden',
  not_found: 'not_found',
  conflict: 'conflict',
  not_allowed_now: 'conflict',
};

/** A domain "no", as an answer the API gives. */
async function answering<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof AcademyFileRejected) {
      const code = error.problem === 'too-large' ? 'payload_too_large' : 'bad_request';
      throw new HttpError(code, error.message, { reason: error.problem });
    }
    if (error instanceof Reject) throw new HttpError(CODE_OF[error.reason] ?? 'bad_request', error.message);
    throw error;
  }
}

const ImportBody = v.object({
  profileId: v.pipe(
    v.string(),
    v.check((value: string) => isUuid(value), 'an id'),
  ),
  consent: v.optional(v.unknown()),
  file: v.unknown(),
});

export const academyRoutes = new Hono<AppEnv>();

academyRoutes.post('/import', async (c) => {
  requireSession(c);
  const parsed = v.safeParse(ImportBody, await readJson(c, IMPORT_MAX_BYTES));
  if (!parsed.success) throw badRequest('Choose a child and add the Academy export file.');
  const { profileId, consent, file } = parsed.output;
  const result = await answering(() =>
    withHousehold(c, 'guardian', (ctx) => importAcademy(ctx, { profileId, consent, file }), { lock: true }),
  );
  return c.json(result);
});

academyRoutes.get('/summary', async (c) => {
  requireSession(c);
  const profileId = c.req.query('profileId');
  if (!isUuid(profileId)) throw badRequest('Choose a child.');
  const weeksText = c.req.query('weeks');
  const weeks = weeksText === undefined ? ACADEMY_SUMMARY_WEEKS.default : Number(weeksText);
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > ACADEMY_SUMMARY_WEEKS.max) {
    throw badRequest(`Choose between 1 and ${ACADEMY_SUMMARY_WEEKS.max} weeks.`);
  }
  const summary = await answering(() =>
    withHousehold(c, 'caregiver', (ctx) => academySummary(ctx, profileId, weeks)),
  );
  return c.json(summary);
});
