import { createHash } from 'node:crypto';
import { workflowAllowed, type AiEnvelope, type AiRefusal, type AiWorkflow } from '../../shared/ai.js';
import type { LocalDate } from '../../shared/time.js';
import { inHousehold, type Database } from '../db/client.js';
import { aiProposals, aiUsage } from '../db/schema.js';
import { lockHousehold, type Ctx } from '../domain/context.js';
import type { Deps } from '../deps.js';
import { capProblem, estimateTokens, spentSoFar, worstCaseMillicents } from './budget.js';
import { costMillicents, priceFor, type Price } from './pricing.js';
import { providerFor, ProviderError, type AiProvider, type Completion } from './provider.js';
import { prepareWorkflow, type Prepared } from './workflows.js';

/**
 * Running one job of the helper, from "may we?" to a stored draft.
 *
 *   1. Inside the household (as a parent, holding the household's lock): is it on, is there a key, may this
 *      job's data leave, and would the dearest this request could cost still fit inside today's and this month's
 *      limits? Any "no" is said before anything is built or sent. A "yes" sets that dearest cost aside at once,
 *      as a line of its own in the usage ledger, so that a second request — on this server or another — counts
 *      it as already spent. The limits therefore hold however many requests arrive together.
 *   2. One request at a time per household on a server, with a time limit and an output-token limit; one more
 *      try only if the provider said it was busy (429) or had a fault of its own (5xx), and only if the limits
 *      still allow.
 *   3. What every attempt cost is written down whatever happened — success, error, nonsense, time out — and the
 *      amount set aside is given back in the same breath. If the server dies in between, the amount stays set
 *      aside: the request may have been billed.
 *   4. The reply goes through the deterministic checks. Only if something usable survives is a draft stored;
 *      the prompt and reply are kept with it only where the household asked for that.
 */

/** Adjustable by tests, which cannot wait half a minute. */
export const aiTuning = { timeoutMs: 30_000, retryDelayMs: 400 };

export class AiRefused extends Error {
  constructor(
    readonly reason: AiRefusal,
    message: string,
  ) {
    super(message);
    this.name = 'AiRefused';
  }
}

const ENV_OF = { anthropic: 'ANTHROPIC_API_KEY', openai: 'OPENAI_API_KEY' } as const;
const NAME_OF = { anthropic: 'Anthropic', openai: 'OpenAI', mock: 'the test provider' } as const;

const CATEGORY_WORDS: Record<AiWorkflow, string> = {
  routine_architect: '“Routines”',
  weekly_reflection: '“Missions” or “Routines”',
  shopping_tidy: '“To buy”',
  reward_economist: '“Rewards”',
};

export function refusalWords(
  reason: AiRefusal,
  extra: { provider?: string | null; workflow?: AiWorkflow } = {},
): string {
  switch (reason) {
    case 'off':
      return 'The planning helper is switched off. Everything else in HOMEBASE works without it.';
    case 'offline':
      return 'This HOMEBASE is set never to reach outside services (HOMEBASE_OFFLINE), so the helper cannot run.';
    case 'no_provider':
      return 'Choose which provider the helper should use first.';
    case 'no_key': {
      const provider = extra.provider === 'openai' ? 'openai' : 'anthropic';
      return `This server has no API key for ${NAME_OF[provider]}. The person who runs HOMEBASE must set ${ENV_OF[provider]}.`;
    }
    case 'category':
      return `That job needs ${extra.workflow ? CATEGORY_WORDS[extra.workflow] : 'more'} ticked under “What may be sent”. Nothing was sent.`;
    case 'cap_daily':
      return 'Today’s spending limit for the helper has been reached (or is set to $0.00). Nothing was sent.';
    case 'cap_monthly':
      return 'This month’s spending limit for the helper has been reached (or is set to $0.00). Nothing was sent.';
    case 'busy':
      return 'The helper is already working on something for this household. Try again in a moment.';
    case 'provider':
      return 'The provider did not answer properly. Nothing was changed; you can try again later.';
    case 'timeout':
      return 'The provider took too long to answer. Nothing was changed; you can try again later.';
    case 'nothing_usable':
      return 'The helper’s answer had nothing HOMEBASE could use, so nothing was kept.';
  }
}

export interface Plan {
  householdId: string;
  workflow: AiWorkflow;
  provider: AiProvider;
  prepared: Prepared;
  price: Price;
  worst: number;
  inputEstimate: number;
  today: LocalDate;
  caps: { dailyCapCents: number; monthlyCapCents: number };
  keepTranscripts: boolean;
  userId: string | null;
}

/** Step 1, inside the household's transaction. Throws AiRefused for every "not now". */
export async function planRun(ctx: Ctx, deps: Deps, workflow: AiWorkflow, input: unknown): Promise<Plan> {
  const settings = ctx.household.settings;
  const chosen = providerFor(deps.config, settings, deps.fetch);
  if (!chosen.ok)
    throw new AiRefused(chosen.reason, refusalWords(chosen.reason, { provider: settings.ai.provider }));
  if (!workflowAllowed(workflow, settings.ai.share))
    throw new AiRefused('category', refusalWords('category', { workflow }));
  const prepared = await prepareWorkflow(ctx, workflow, input, settings.ai.share);
  const { price } = priceFor(chosen.provider.name, chosen.provider.model, deps.config);
  const inputEstimate = estimateTokens(prepared.system, prepared.user, JSON.stringify(prepared.schema));
  const worst = worstCaseMillicents(price, inputEstimate, prepared.maxOutputTokens);
  const spent = await spentSoFar(ctx.tx, ctx.household.id, ctx.today);
  const capped = capProblem(settings.ai, spent, worst);
  if (capped) throw new AiRefused(capped, refusalWords(capped));
  const plan: Plan = {
    householdId: ctx.household.id,
    workflow,
    provider: chosen.provider,
    prepared,
    price,
    worst,
    inputEstimate,
    today: ctx.today,
    caps: { dailyCapCents: settings.ai.dailyCapCents, monthlyCapCents: settings.ai.monthlyCapCents },
    keepTranscripts: settings.ai.keepTranscripts,
    userId: ctx.actor.userId,
  };
  await ctx.tx.insert(aiUsage).values(ledgerLine(plan, ctx.now, 'reserved', plan.worst));
  return plan;
}

/**
 * The two book-keeping lines of the usage ledger. `reserved` sets a request's dearest possible cost aside before
 * it is sent; `released` (the same amount, negative) gives it back when the request's real cost is written down.
 * The ledger is only ever added to, so the sum is always what has been spent plus what is still in flight.
 */
export const RESERVED = 'reserved';
export const RELEASED = 'released';

function ledgerLine(plan: Plan, at: Date, outcome: string, millicents: number) {
  return {
    id: crypto.randomUUID(),
    householdId: plan.householdId,
    at,
    localDate: plan.today,
    provider: plan.provider.name,
    model: plan.provider.model,
    workflow: plan.workflow,
    inputTokens: 0,
    outputTokens: 0,
    costMillicents: Math.round(millicents),
    outcome,
  };
}

/** Give back what was set aside without anything having been sent. */
async function release(database: Database, deps: Deps, plan: Plan): Promise<void> {
  await inHousehold(database, plan.householdId, (tx) =>
    tx.insert(aiUsage).values(ledgerLine(plan, deps.now(), RELEASED, -plan.worst)),
  );
}

/** Before a second try: under the household's lock, check the limits again and set the cost aside again. */
async function reserveAgain(database: Database, deps: Deps, plan: Plan): Promise<void> {
  await inHousehold(database, plan.householdId, async (tx) => {
    await lockHousehold(tx, plan.householdId);
    const spent = await spentSoFar(tx, plan.householdId, plan.today);
    const capped = capProblem(plan.caps, spent, plan.worst);
    if (capped) throw new AiRefused(capped, refusalWords(capped));
    await tx.insert(aiUsage).values(ledgerLine(plan, deps.now(), RESERVED, plan.worst));
  });
}

/** Households with a request in flight on this server. */
const inFlight = new Set<string>();

type Outcome =
  | 'ok'
  | 'invalid_shape'
  | 'nothing_valid'
  | 'http_error'
  | 'network_error'
  | 'timeout'
  | 'invalid_json'
  | 'refused'
  | 'truncated'
  | 'error';

async function recordUsage(
  database: Database,
  deps: Deps,
  plan: Plan,
  usage: { inputTokens: number; outputTokens: number; millicents: number },
  outcome: Outcome,
): Promise<void> {
  // The real cost goes in and the amount set aside comes out in one transaction: never one without the other.
  await inHousehold(database, plan.householdId, (tx) =>
    tx.insert(aiUsage).values([
      {
        ...ledgerLine(plan, deps.now(), outcome, Math.max(0, usage.millicents)),
        inputTokens: Math.max(0, Math.round(usage.inputTokens)),
        outputTokens: Math.max(0, Math.round(usage.outputTokens)),
      },
      ledgerLine(plan, deps.now(), RELEASED, -plan.worst),
    ]),
  );
}

/** What a failed attempt is counted as costing. An abandoned request may still be billed: count the worst. */
function failedUsage(
  plan: Plan,
  error: ProviderError,
): { inputTokens: number; outputTokens: number; millicents: number } {
  if (error.usage) {
    return {
      ...error.usage,
      millicents: costMillicents(plan.price, error.usage.inputTokens, error.usage.outputTokens),
    };
  }
  if (error.problem === 'timeout') {
    return {
      inputTokens: plan.inputEstimate,
      outputTokens: plan.prepared.maxOutputTokens,
      millicents: plan.worst,
    };
  }
  // An error status or no connection: the providers do not charge for a request they refused or never got.
  return { inputTokens: 0, outputTokens: 0, millicents: 0 };
}

const OUTCOME_OF: Record<ProviderError['problem'], Outcome> = {
  http: 'http_error',
  network: 'network_error',
  timeout: 'timeout',
  invalid_json: 'invalid_json',
  refused: 'refused',
  truncated: 'truncated',
};

async function attempt(plan: Plan): Promise<Completion> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), aiTuning.timeoutMs);
  try {
    return await plan.provider.complete({
      system: plan.prepared.system,
      user: plan.prepared.user,
      schema: plan.prepared.schema,
      schemaName: plan.prepared.schemaName,
      maxOutputTokens: plan.prepared.maxOutputTokens,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) throw new ProviderError('timeout', 'The provider took too long.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Steps 2–4. */
export async function executeRun(database: Database, deps: Deps, plan: Plan): Promise<AiEnvelope> {
  if (inFlight.has(plan.householdId)) {
    // Nothing will be sent for this plan: what it set aside goes straight back.
    await release(database, deps, plan);
    throw new AiRefused('busy', refusalWords('busy'));
  }
  inFlight.add(plan.householdId);
  try {
    let completion: Completion | null = null;
    for (let round = 0; round < 2 && !completion; round++) {
      if (round > 0) {
        await new Promise((resolve) => setTimeout(resolve, aiTuning.retryDelayMs));
        // The first try's cost is written down and its reservation given back; the second needs its own.
        await reserveAgain(database, deps, plan);
      }
      try {
        completion = await attempt(plan);
      } catch (error) {
        if (!(error instanceof ProviderError)) {
          // Not the provider's doing: a fault here. Counted at the worst, since the request may have gone out.
          await recordUsage(
            database,
            deps,
            plan,
            {
              inputTokens: plan.inputEstimate,
              outputTokens: plan.prepared.maxOutputTokens,
              millicents: plan.worst,
            },
            'error',
          );
          throw error;
        }
        await recordUsage(database, deps, plan, failedUsage(plan, error), OUTCOME_OF[error.problem]);
        // Only the kind of problem is logged: never the prompt, the reply or the key.
        console.warn(
          `[ai] ${plan.provider.name} ${plan.workflow}: ${error.problem}${error.status ? ` ${error.status}` : ''}`,
        );
        if (error.retryable && round === 0) continue;
        if (error.problem === 'timeout') throw new AiRefused('timeout', refusalWords('timeout'));
        if (error.problem === 'http' || error.problem === 'network')
          throw new AiRefused('provider', refusalWords('provider'));
        throw new AiRefused('nothing_usable', refusalWords('nothing_usable'));
      }
    }
    if (!completion) throw new AiRefused('provider', refusalWords('provider'));

    const millicents = costMillicents(plan.price, completion.inputTokens, completion.outputTokens);
    let finished: ReturnType<Prepared['finish']>;
    try {
      finished = plan.prepared.finish(completion.json);
    } catch {
      finished = { ok: false, outcome: 'invalid_shape' };
    }
    await recordUsage(
      database,
      deps,
      plan,
      { inputTokens: completion.inputTokens, outputTokens: completion.outputTokens, millicents },
      finished.ok ? 'ok' : finished.outcome,
    );
    if (!finished.ok) throw new AiRefused('nothing_usable', refusalWords('nothing_usable'));

    const now = deps.now();
    const envelope: AiEnvelope = {
      id: crypto.randomUUID(),
      type: plan.workflow,
      createdAt: now.toISOString(),
      ...finished.parts,
      cost: {
        provider: plan.provider.name,
        model: plan.provider.model,
        inputTokens: completion.inputTokens,
        outputTokens: completion.outputTokens,
        millicents,
        worstCaseMillicents: plan.worst,
      },
    };
    await inHousehold(database, plan.householdId, (tx) =>
      tx.insert(aiProposals).values({
        id: envelope.id,
        householdId: plan.householdId,
        workflow: plan.workflow,
        status: 'draft',
        envelope: envelope as unknown as Record<string, unknown>,
        transcript: plan.keepTranscripts
          ? {
              provider: plan.provider.name,
              model: plan.provider.model,
              system: plan.prepared.system,
              user: plan.prepared.user,
              reply: completion.json,
            }
          : null,
        createdBy: plan.userId,
        createdAt: now,
      }),
    );
    return envelope;
  } finally {
    inFlight.delete(plan.householdId);
  }
}

/** The id an accepted change is applied under: the same every time, so that applying twice does it once. */
export function applyOpId(proposalId: string, index: number): string {
  const hex = createHash('sha256').update(`homebase-ai-apply:${proposalId}:${index}`).digest('hex');
  const variant = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
