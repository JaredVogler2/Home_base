import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import * as v from 'valibot';
import {
  isAiAllowedOp,
  isAiWorkflow,
  type AiEnvelope,
  type AiProposalSummary,
  type AiStatus,
} from '../../../shared/ai.js';
import { isUuid } from '../../../shared/ids.js';
import type { Rejection } from '../../../shared/ops.js';
import { centsOf, spentSoFar } from '../../ai/budget.js';
import { rewardSimulation } from '../../ai/economist.js';
import { modelFor, providerFor, providersAvailable } from '../../ai/provider.js';
import { AiRefused, applyOpId, executeRun, planRun } from '../../ai/run.js';
import { attempt, type Limit } from '../../auth/rate-limit.js';
import { accessOf } from '../../auth/sessions.js';
import { asSystem } from '../../db/client.js';
import { aiProposals } from '../../db/schema.js';
import { auditLog, Reject } from '../../domain/context.js';
import { applyOps } from '../../ops/run.js';
import { actorOf, readJson, requireGuardianSession, withHousehold, type AppEnv } from '../env.js';
import { badRequest, conflict, HttpError, notFound, tooMany, type ErrorCode } from '../errors.js';

/**
 * The optional planning helper. Off by default, for the grown-ups only, and only on their own phones: a wall —
 * even one unlocked with a PIN — can reach none of it. See docs/integrations/AI.md.
 *
 *   GET  /ai/status                   a parent       on or off, which keys the server has (never the keys), spend
 *   GET  /ai/economist                parent, helper "how long until…?" — worked out here, no model, works when off
 *   POST /ai/run                      a parent       { workflow, input } → a stored draft
 *   GET  /ai/proposals                a parent       recent drafts and what became of them
 *   POST /ai/proposals/:id/apply      a parent       { changes?: number[] } → through the normal operation runner
 *   POST /ai/proposals/:id/dismiss    a parent       "no thanks"
 */

/** A few runs a minute per household is plenty for a person, and stops a stuck button running up a bill. */
const RUN_LIMIT: Limit = { max: 4, windowSeconds: 60 };

const CODE_OF: Partial<Record<Rejection, ErrorCode>> = {
  forbidden: 'forbidden',
  not_found: 'not_found',
  conflict: 'conflict',
  not_allowed_now: 'conflict',
};

async function answering<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof AiRefused) {
      const code: ErrorCode =
        error.reason === 'provider' || error.reason === 'timeout' || error.reason === 'nothing_usable'
          ? 'unavailable'
          : 'conflict';
      throw new HttpError(code, error.message, { reason: error.reason });
    }
    if (error instanceof Reject) throw new HttpError(CODE_OF[error.reason] ?? 'bad_request', error.message);
    throw error;
  }
}

export const aiRoutes = new Hono<AppEnv>();

aiRoutes.get('/status', async (c) => {
  requireGuardianSession(c);
  const deps = c.get('deps');
  const status = await withHousehold(c, 'guardian', async (ctx): Promise<AiStatus> => {
    const ai = ctx.household.settings.ai;
    const spent = await spentSoFar(ctx.tx, ctx.household.id, ctx.today);
    const chosen = providerFor(deps.config, ctx.household.settings, deps.fetch);
    let reason: AiStatus['reason'] = chosen.ok ? undefined : chosen.reason;
    if (!reason && (ai.dailyCapCents <= 0 || spent.todayMillicents >= ai.dailyCapCents * 1000))
      reason = 'cap_daily';
    if (!reason && (ai.monthlyCapCents <= 0 || spent.monthMillicents >= ai.monthlyCapCents * 1000))
      reason = 'cap_monthly';
    return {
      enabled: ai.enabled,
      provider: ai.provider,
      providersAvailable: providersAvailable(deps.config),
      model: ai.provider ? modelFor(deps.config, ai.provider) : null,
      share: ai.share,
      caps: { dailyCents: ai.dailyCapCents, monthlyCents: ai.monthlyCapCents },
      spentTodayCents: centsOf(spent.todayMillicents),
      spentThisMonthCents: centsOf(spent.monthMillicents),
      canRun: reason === undefined,
      ...(reason ? { reason } : {}),
    };
  });
  return c.json(status);
});

aiRoutes.get('/economist', async (c) => {
  requireGuardianSession(c);
  return c.json(await withHousehold(c, 'caregiver', (ctx) => rewardSimulation(ctx)));
});

const RunBody = v.object({ workflow: v.string(), input: v.optional(v.unknown(), {}) });

aiRoutes.post('/run', async (c) => {
  const session = requireGuardianSession(c);
  const parsed = v.safeParse(RunBody, await readJson(c, 16 * 1024));
  if (!parsed.success || !isAiWorkflow(parsed.output.workflow))
    throw badRequest('Choose one of the helper’s jobs.');
  const workflow = parsed.output.workflow;
  const database = c.get('database');
  const deps = c.get('deps');
  const limited = await asSystem(database, (tx) =>
    attempt(tx, `ai-run:${session.householdId}`, RUN_LIMIT, c.get('now')),
  );
  if (!limited.allowed) throw tooMany(limited.retryAfter);
  const envelope = await answering(async () => {
    // Under the household's lock: two requests arriving together are planned one after the other, and the
    // second sees what the first has set aside.
    const plan = await withHousehold(
      c,
      'guardian',
      (ctx) => planRun(ctx, deps, workflow, parsed.output.input),
      {
        lock: true,
      },
    );
    return executeRun(database, deps, plan);
  });
  return c.json(envelope, 201);
});

aiRoutes.get('/proposals', async (c) => {
  requireGuardianSession(c);
  const rows = await withHousehold(c, 'guardian', (ctx) =>
    ctx.tx
      .select({
        id: aiProposals.id,
        workflow: aiProposals.workflow,
        status: aiProposals.status,
        createdAt: aiProposals.createdAt,
        decidedAt: aiProposals.decidedAt,
        envelope: aiProposals.envelope,
      })
      .from(aiProposals)
      .where(eq(aiProposals.householdId, ctx.household.id))
      .orderBy(desc(aiProposals.createdAt))
      .limit(20),
  );
  const proposals: AiProposalSummary[] = rows.map((row) => ({
    id: row.id,
    workflow: row.workflow as AiProposalSummary['workflow'],
    status: row.status as AiProposalSummary['status'],
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    envelope: row.envelope as unknown as AiEnvelope,
  }));
  return c.json({ proposals });
});

async function findProposal(c: Parameters<typeof withHousehold>[0], id: string) {
  return withHousehold(c, 'guardian', async (ctx) => {
    const rows = await ctx.tx
      .select()
      .from(aiProposals)
      .where(and(eq(aiProposals.householdId, ctx.household.id), eq(aiProposals.id, id)))
      .limit(1);
    return rows[0] ?? null;
  });
}

const ApplyBody = v.object({
  changes: v.optional(
    v.pipe(v.array(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(50))), v.maxLength(50)),
  ),
});

aiRoutes.post('/proposals/:id/apply', async (c) => {
  const session = requireGuardianSession(c);
  const id = c.req.param('id');
  if (!isUuid(id)) throw notFound('That draft is not here.');
  const parsed = v.safeParse(ApplyBody, await readJson(c));
  if (!parsed.success) throw badRequest('Choose which changes to apply.');
  const row = await findProposal(c, id);
  if (!row) throw notFound('That draft is not here.');
  if (row.status === 'dismissed')
    throw conflict('That draft was put aside. Ask the helper again if you want it.');
  const envelope = row.envelope as unknown as AiEnvelope;
  const all = Array.isArray(envelope.changes) ? envelope.changes : [];
  const wanted = parsed.output.changes ?? all.map((change) => change.index);
  const chosen = all.filter((change) => wanted.includes(change.index));
  if (chosen.length === 0) throw badRequest('Tick at least one change to apply.');
  // Checked again here, whatever is stored: only the allowed kinds of change ever reach the runner.
  if (chosen.some((change) => !isAiAllowedOp(change.op)))
    throw badRequest('That draft holds a change HOMEBASE will not make.');

  const database = c.get('database');
  const deps = c.get('deps');
  const applied = await applyOps(
    { database, now: () => c.get('now'), deploy: { academyHosts: deps.config.academyHosts } },
    {
      householdId: session.householdId,
      actor: actorOf(session, accessOf(session, false)),
      access: (holdGate) => accessOf(session, holdGate),
    },
    chosen.map((change) => ({
      id: applyOpId(row.id, change.index),
      type: change.op,
      at: c.get('now').toISOString(),
      input: change.input,
    })),
  );
  const outcomes = applied.outcomes.map((outcome, position) => ({
    index: chosen[position]!.index,
    status: outcome.status,
    ...(outcome.status === 'rejected' ? { message: outcome.message } : {}),
  }));
  const anyDone = outcomes.some((outcome) => outcome.status === 'applied' || outcome.status === 'noop');
  if (anyDone) {
    await withHousehold(
      c,
      'guardian',
      async (ctx) => {
        const indexes = [
          ...new Set([
            ...(envelope.applied?.changes ?? []),
            ...outcomes.filter((o) => o.status !== 'rejected' && o.status !== 'retry').map((o) => o.index),
          ]),
        ];
        const next: AiEnvelope = {
          ...envelope,
          applied: { at: ctx.now.toISOString(), changes: indexes.sort((a, b) => a - b), outcomes },
        };
        await ctx.tx
          .update(aiProposals)
          .set({
            status: 'accepted',
            decidedAt: row.decidedAt ?? ctx.now,
            envelope: next as unknown as Record<string, unknown>,
          })
          .where(and(eq(aiProposals.householdId, ctx.household.id), eq(aiProposals.id, row.id)));
        await auditLog(ctx, 'ai.applied', { proposal: row.id, workflow: row.workflow, changes: indexes });
      },
      { lock: true },
    );
  }
  return c.json({ outcomes, status: anyDone ? 'accepted' : row.status });
});

aiRoutes.post('/proposals/:id/dismiss', async (c) => {
  requireGuardianSession(c);
  const id = c.req.param('id');
  if (!isUuid(id)) throw notFound('That draft is not here.');
  const row = await findProposal(c, id);
  if (!row) throw notFound('That draft is not here.');
  if (row.status === 'accepted') throw conflict('Some of that draft has already been applied.');
  if (row.status === 'draft') {
    await withHousehold(c, 'guardian', (ctx) =>
      ctx.tx
        .update(aiProposals)
        .set({ status: 'dismissed', decidedAt: ctx.now })
        .where(and(eq(aiProposals.householdId, ctx.household.id), eq(aiProposals.id, id))),
    );
  }
  return c.json({ ok: true, status: 'dismissed' });
});
