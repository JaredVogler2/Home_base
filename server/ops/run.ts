import { and, eq } from 'drizzle-orm';
import * as v from 'valibot';
import { isUuid } from '../../shared/ids.js';
import { hasAccess, type AccessLevel } from '../../shared/model.js';
import { isOpType, OPS, type OpOutcome, type OpType, type Rejection } from '../../shared/ops.js';
import { inHousehold, type Database } from '../db/client.js';
import { operations } from '../db/schema.js';
import { awardBadges, BADGE_OPS } from '../domain/badges.js';
import { bumpRevision, lockHousehold, makeCtx, Reject, type Actor, type Deploy } from '../domain/context.js';
import { HANDLERS, type Done } from './handlers.js';

/**
 * Doing what a screen asked, once.
 *
 * Each request is done in a transaction of its own, so that one bad request in a batch does not undo the good
 * ones. Inside it, in order:
 *   1. the household's row is locked — two requests about one family never run at the same moment;
 *   2. the request's id is looked up — if it has been answered before, that answer is given again and nothing
 *      else happens (this is what makes a retry, a double tap and a replayed offline queue harmless);
 *   3. the screen's right to make this kind of request is checked against the session, never against anything
 *      the screen says about itself;
 *   4. the rule runs. If it says "no", whatever it had started is rolled back and the "no" is the answer;
 *   5. the answer is written down beside the id, and every screen is told there is news.
 * If anything fails that is not a "no" — the database hiccups, say — nothing at all is kept and the screen is
 * told to try again later with the same id.
 */

export interface OpsDeps {
  database: Database;
  now: () => Date;
  deploy: Deploy;
}

export interface Requester {
  householdId: string;
  actor: Actor;
  /** Worked out from the session and the household's settings inside the transaction. */
  access: (holdGate: boolean) => AccessLevel;
}

interface Stored {
  status: 'applied' | 'noop' | 'rejected';
  data?: Record<string, unknown>;
  reason?: Rejection;
  message?: string;
}

function outcomeOf(id: string, stored: Stored): OpOutcome {
  if (stored.status === 'rejected') {
    return {
      id,
      status: 'rejected',
      reason: stored.reason ?? 'invalid',
      message: stored.message ?? 'That could not be done.',
    };
  }
  return { id, status: stored.status, data: stored.data ?? {} };
}

const SORRY: Record<Rejection, string> = {
  invalid: 'That did not make sense, so nothing was changed.',
  forbidden: 'That is for a grown-up to do.',
  not_found: 'That is not here any more.',
  conflict: 'Someone else changed that first.',
  not_allowed_now: 'That cannot be done just now.',
  not_enough_stars: 'There are not enough stars for that yet.',
  price_changed: 'That one has changed. Have another look.',
  out_of_stock: 'There are none of those left just now.',
  not_offered: 'That is not on offer just now.',
  limit_reached: 'That is the most there can be for now.',
};

export interface AppliedOps {
  outcomes: OpOutcome[];
  /** Whether any request needed a grown-up's access and was done: the wall's unlock is then kept open a while. */
  usedGrownUpAccess: boolean;
}

export async function applyOps(
  deps: OpsDeps,
  requester: Requester,
  envelopes: readonly unknown[],
): Promise<AppliedOps> {
  const outcomes: OpOutcome[] = [];
  let usedGrownUpAccess = false;
  for (const envelope of envelopes) {
    const shape = envelope as { id?: unknown; type?: unknown; input?: unknown } | null;
    const id = shape && isUuid(shape.id) ? shape.id : null;
    if (!id) {
      // Without an id there is nothing to remember it by. The screen is told, and may not retry.
      outcomes.push({
        id: String(shape?.id ?? ''),
        status: 'rejected',
        reason: 'invalid',
        message: SORRY.invalid,
      });
      continue;
    }
    try {
      const outcome = await applyOne(deps, requester, id, shape?.type, shape?.input);
      if (outcome.grownUp) usedGrownUpAccess = true;
      outcomes.push(outcome.outcome);
    } catch (error) {
      console.error(
        `[ops] ${String(shape?.type)} ${id} failed:`,
        error instanceof Error ? error.message : error,
      );
      outcomes.push({ id, status: 'retry' });
    }
  }
  return { outcomes, usedGrownUpAccess };
}

async function applyOne(
  deps: OpsDeps,
  requester: Requester,
  id: string,
  type: unknown,
  rawInput: unknown,
): Promise<{ outcome: OpOutcome; grownUp: boolean }> {
  return inHousehold(deps.database, requester.householdId, async (tx) => {
    const household = await lockHousehold(tx, requester.householdId);
    if (!household) throw new Error('household not found');

    const before = await tx
      .select({ status: operations.status, result: operations.result })
      .from(operations)
      .where(and(eq(operations.householdId, household.id), eq(operations.opId, id)))
      .limit(1);
    if (before[0]) {
      const kept = before[0].result as Partial<Stored>;
      return {
        outcome: outcomeOf(id, { ...kept, status: before[0].status as Stored['status'] }),
        grownUp: false,
      };
    }

    const ctx = makeCtx(tx, household, requester.actor, deps.now(), deps.deploy);
    let stored: Stored;
    let grownUp = false;
    let typeName = typeof type === 'string' ? type.slice(0, 60) : 'unknown';

    if (!isOpType(type)) {
      stored = { status: 'rejected', reason: 'invalid', message: SORRY.invalid };
    } else {
      typeName = type;
      const spec = OPS[type];
      const access = requester.access(household.settings.wall.holdGate);
      const parsed = v.safeParse(spec.input, rawInput);
      if (!hasAccess(access, spec.level)) {
        stored = { status: 'rejected', reason: 'forbidden', message: SORRY.forbidden };
      } else if (!parsed.success) {
        stored = { status: 'rejected', reason: 'invalid', message: SORRY.invalid };
      } else {
        try {
          // A savepoint: if the rule says "no" part-way, what it had begun is undone and the "no" is kept.
          const done = await tx.transaction(async (inner) =>
            run(type, { ...ctx, tx: inner as typeof tx }, parsed.output as never),
          );
          stored = { status: done.changed ? 'applied' : 'noop', data: done.data ?? {} };
          if (done.changed) {
            // A keepsake for something that has just added up, written in the same breath as the thing itself.
            if (BADGE_OPS.has(type)) await awardBadges(ctx);
            await bumpRevision(ctx);
            grownUp = hasAccess(spec.level, 'caregiver');
          }
        } catch (error) {
          if (!(error instanceof Reject)) throw error;
          stored = {
            status: 'rejected',
            reason: error.reason,
            message: error.message || SORRY[error.reason],
          };
        }
      }
    }

    await tx.insert(operations).values({
      householdId: household.id,
      opId: id,
      type: typeName,
      status: stored.status,
      result: { data: stored.data, reason: stored.reason, message: stored.message },
      actor: requester.actor.name,
      createdAt: ctx.now,
    });
    return { outcome: outcomeOf(id, stored), grownUp };
  });
}

function run<T extends OpType>(
  type: T,
  ctx: Parameters<(typeof HANDLERS)[T]>[0],
  input: Parameters<(typeof HANDLERS)[T]>[1],
): Promise<Done> {
  return (HANDLERS[type] as (ctx: unknown, input: unknown) => Promise<Done>)(ctx, input);
}
