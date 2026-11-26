import type { Config } from '../config.js';
import type { HouseholdSettings } from '../../shared/settings.js';
import { DEFAULT_MODELS } from './pricing.js';

/**
 * Asking a model for a piece of JSON, and nothing else.
 *
 * Each adapter is a plain HTTPS request through the fetch it is handed (in production the real one, in a test a
 * fake that records every request). No SDK, no tools, no browsing, no file uploads: one system message, one user
 * message, a JSON schema the reply must follow, an output-token limit and a time limit. Prompts, replies and keys
 * are never logged here or anywhere else.
 */

export type JsonSchema = Record<string, unknown>;

export interface CompletionRequest {
  system: string;
  user: string;
  schema: JsonSchema;
  schemaName: string;
  maxOutputTokens: number;
  signal: AbortSignal;
}

export interface Completion {
  json: unknown;
  inputTokens: number;
  outputTokens: number;
}

export interface AiProvider {
  name: 'anthropic' | 'openai' | 'mock';
  model: string;
  complete(request: CompletionRequest): Promise<Completion>;
}

export type ProviderProblem =
  /** The provider answered with an error status. */
  | 'http'
  /** Out of time; whatever the provider did, we stopped waiting. */
  | 'timeout'
  /** The request did not get there (no network, DNS, TLS). */
  | 'network'
  /** It answered, but not with JSON. */
  | 'invalid_json'
  /** The model declined. */
  | 'refused'
  /** The reply was cut off by the output-token limit. */
  | 'truncated';

export class ProviderError extends Error {
  constructor(
    readonly problem: ProviderProblem,
    message: string,
    readonly status: number | null = null,
    /** What the provider said it used, where it said. */
    readonly usage: { inputTokens: number; outputTokens: number } | null = null,
  ) {
    super(message);
    this.name = 'ProviderError';
  }

  /** At most one more try, and only for "too busy" and the provider's own faults. */
  get retryable(): boolean {
    return this.problem === 'http' && this.status !== null && (this.status === 429 || this.status >= 500);
  }
}

const num = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

async function send(
  fetcher: typeof fetch,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal: AbortSignal,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetcher(url, { method: 'POST', headers, body: JSON.stringify(body), signal });
  } catch (error) {
    if (signal.aborted) throw new ProviderError('timeout', 'The provider took too long.');
    throw new ProviderError('network', error instanceof Error ? error.name : 'network');
  }
  let text: string;
  try {
    text = await response.text();
  } catch {
    if (signal.aborted) throw new ProviderError('timeout', 'The provider took too long.');
    throw new ProviderError('network', 'The reply did not arrive whole.');
  }
  if (!response.ok) {
    // The provider's error words are not kept or shown: they may echo the request.
    throw new ProviderError('http', `The provider answered ${response.status}.`, response.status);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ProviderError('invalid_json', 'The provider’s answer was not JSON.');
  }
}

function parseModelJson(text: string, usage: { inputTokens: number; outputTokens: number }): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ProviderError('invalid_json', 'The model’s reply was not JSON.', null, usage);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Anthropic — the Messages API with JSON outputs (output_config.format, type json_schema).
// Shape checked against Anthropic's developer documentation (the raw-HTTP examples, "Structured outputs" and the
// model migration notes) on 2026-11-26; API version header 2026-10-21.
// ---------------------------------------------------------------------------------------------------------------------

export const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_VERSION = '2026-10-21';

/** `effort` exists on current models; Haiku 4.5, Sonnet 4.5 and older reject it. */
function anthropicTakesEffort(model: string): boolean {
  return !/^claude-(3|haiku-4|sonnet-4-5|opus-4-1|opus-4-5|sonnet-4-)/.test(model);
}

export function anthropic(fetcher: typeof fetch, key: string, model: string): AiProvider {
  return {
    name: 'anthropic',
    model,
    async complete(request) {
      const body: Record<string, unknown> = {
        model,
        max_tokens: request.maxOutputTokens,
        system: request.system,
        messages: [{ role: 'user', content: request.user }],
        output_config: {
          format: { type: 'json_schema', schema: request.schema },
          // Short, plain answers: low effort keeps thinking (which counts as output) small.
          ...(anthropicTakesEffort(model) ? { effort: 'low' } : {}),
        },
      };
      const reply = (await send(
        fetcher,
        ANTHROPIC_URL,
        {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body,
        request.signal,
      )) as {
        content?: { type?: string; text?: string }[];
        stop_reason?: string;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      const usage = {
        inputTokens: num(reply.usage?.input_tokens),
        outputTokens: num(reply.usage?.output_tokens),
      };
      if (reply.stop_reason === 'refusal')
        throw new ProviderError('refused', 'The model declined.', null, usage);
      if (reply.stop_reason === 'max_tokens')
        throw new ProviderError('truncated', 'The reply was cut short.', null, usage);
      const text = (reply.content ?? [])
        .filter((block) => block.type === 'text' && typeof block.text === 'string')
        .map((block) => block.text)
        .join('');
      return { json: parseModelJson(text, usage), ...usage };
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// OpenAI — the Responses API with Structured Outputs (text.format, type json_schema, strict).
// Shape read from https://developers.openai.com/api/docs/guides/structured-outputs and the API reference for
// POST /v1/responses (https://developers.openai.com/api/reference/resources/responses/methods/create) on
// 2026-11-26. `store: false` asks OpenAI not to keep the response for later retrieval.
// ---------------------------------------------------------------------------------------------------------------------

export const OPENAI_URL = 'https://api.openai.com/v1/responses';

/** Reasoning models take reasoning.effort; older chat models (gpt-4o, gpt-4.1) do not. */
function openaiReasons(model: string): boolean {
  return /^(gpt-5|gpt-6|o\d)/.test(model);
}

export function openai(fetcher: typeof fetch, key: string, model: string): AiProvider {
  return {
    name: 'openai',
    model,
    async complete(request) {
      const body: Record<string, unknown> = {
        model,
        instructions: request.system,
        input: request.user,
        max_output_tokens: request.maxOutputTokens,
        store: false,
        text: {
          format: { type: 'json_schema', name: request.schemaName, schema: request.schema, strict: true },
        },
        ...(openaiReasons(model) ? { reasoning: { effort: 'low' } } : {}),
      };
      const reply = (await send(
        fetcher,
        OPENAI_URL,
        { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body,
        request.signal,
      )) as {
        status?: string;
        output?: { type?: string; content?: { type?: string; text?: string; refusal?: string }[] }[];
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      const usage = {
        inputTokens: num(reply.usage?.input_tokens),
        outputTokens: num(reply.usage?.output_tokens),
      };
      if (reply.status === 'incomplete')
        throw new ProviderError('truncated', 'The reply was cut short.', null, usage);
      const parts = (reply.output ?? [])
        .filter((item) => item.type === 'message')
        .flatMap((item) => item.content ?? []);
      if (parts.some((part) => part.type === 'refusal'))
        throw new ProviderError('refused', 'The model declined.', null, usage);
      if (reply.status !== undefined && reply.status !== 'completed')
        throw new ProviderError('http', `The provider said ${reply.status.slice(0, 20)}.`, 502, usage);
      const text = parts
        .filter((part) => part.type === 'output_text' && typeof part.text === 'string')
        .map((part) => part.text)
        .join('');
      return { json: parseModelJson(text, usage), ...usage };
    },
  };
}

/** For unit tests of the code around a provider: answers whatever it is told to. */
export function mockProvider(
  answer: (request: CompletionRequest) => Promise<Completion> | Completion,
): AiProvider {
  return { name: 'mock', model: 'mock', complete: async (request) => answer(request) };
}

// ---------------------------------------------------------------------------------------------------------------------
// Which provider, if any
// ---------------------------------------------------------------------------------------------------------------------

export type ProviderUnavailable = 'off' | 'offline' | 'no_provider' | 'no_key';

export function providersAvailable(
  config: Pick<Config, 'anthropicKey' | 'openaiKey'>,
): ('anthropic' | 'openai')[] {
  const found: ('anthropic' | 'openai')[] = [];
  if (config.anthropicKey) found.push('anthropic');
  if (config.openaiKey) found.push('openai');
  return found;
}

export function modelFor(
  config: Pick<Config, 'anthropicModel' | 'openaiModel'>,
  provider: 'anthropic' | 'openai',
): string {
  return provider === 'anthropic'
    ? (config.anthropicModel ?? DEFAULT_MODELS.anthropic)
    : (config.openaiModel ?? DEFAULT_MODELS.openai);
}

export function providerFor(
  config: Config,
  settings: HouseholdSettings,
  fetcher: typeof fetch,
): { ok: true; provider: AiProvider } | { ok: false; reason: ProviderUnavailable } {
  if (!settings.ai.enabled) return { ok: false, reason: 'off' };
  if (config.offline) return { ok: false, reason: 'offline' };
  const chosen = settings.ai.provider;
  if (!chosen) return { ok: false, reason: 'no_provider' };
  const key = chosen === 'anthropic' ? config.anthropicKey : config.openaiKey;
  if (!key) return { ok: false, reason: 'no_key' };
  const model = modelFor(config, chosen);
  return {
    ok: true,
    provider: chosen === 'anthropic' ? anthropic(fetcher, key, model) : openai(fetcher, key, model),
  };
}
