import type { Config } from '../config.js';

/**
 * What a model costs, in one table, so that a spending cap can be kept.
 *
 * US dollars per million tokens, standard (not batch, not priority, not cached) rates.
 *
 * Sources, read on 2026-11-26:
 *   - Anthropic: the claude-api skill's model table (cached from platform.claude.com on 2026-11-03), which points
 *     to https://platform.claude.com/docs/en/about-claude/pricing. claude-haiku-5-5 has two rate cards: the one
 *     below for prompts of 100K tokens or fewer, and $0.50 / $2.50 above that (`long`).
 *   - OpenAI: https://developers.openai.com/api/docs/pricing (standard tier, short context ≤272K input tokens) and
 *     https://developers.openai.com/api/docs/models/gpt-6-luna.
 *
 * Prices change. The person who runs the server can override the price of whichever model a provider is set to
 * use with HOMEBASE_AI_PRICE_ANTHROPIC / HOMEBASE_AI_PRICE_OPENAI ("input,output"). A model that is not in the
 * table and has no override is priced at the dearest rate below, so that a cap can never be under-counted.
 */

export interface Price {
  input: number;
  output: number;
  /** A dearer card for very long prompts, where the provider has one. */
  long?: { aboveInputTokens: number; input: number; output: number };
}

export const PRICES: Readonly<Record<string, Price>> = {
  // Anthropic
  'claude-haiku-5-5': {
    input: 0.1,
    output: 0.5,
    long: { aboveInputTokens: 100_000, input: 0.5, output: 2.5 },
  },
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-opus-5': { input: 5, output: 25 },
  'claude-fable-5-2': { input: 8, output: 40 },
  'claude-fable-5-1': { input: 10, output: 50 },
  // OpenAI
  'gpt-6-luna': { input: 0.1, output: 0.5 },
  'gpt-6.1-terra': { input: 1, output: 5 },
  'gpt-6.2-sol': { input: 2, output: 10 },
  'gpt-6.2-astra': { input: 8, output: 40 },
  'gpt-6-astra': { input: 10, output: 50 },
  'gpt-5.6-luna': { input: 0.2, output: 1.2 },
  'gpt-5-mini': { input: 0.25, output: 2 },
  'gpt-5-nano': { input: 0.05, output: 0.4 },
};

/** The default, low-cost model of each provider. */
export const DEFAULT_MODELS = { anthropic: 'claude-haiku-5-5', openai: 'gpt-6-luna' } as const;

/** The dearest input and output rates known, for a model nobody has priced. */
export const DEAREST: Price = Object.values(PRICES).reduce<Price>(
  (worst, price) => ({
    input: Math.max(worst.input, price.input, price.long?.input ?? 0),
    output: Math.max(worst.output, price.output, price.long?.output ?? 0),
  }),
  { input: 0, output: 0 },
);

/** "0.10,0.50" → a price; anything else → null (and the table, or the dearest rate, is used). */
export function parsePriceOverride(value: string | null | undefined): Price | null {
  if (!value) return null;
  const parts = value.split(',').map((part) => Number(part.trim()));
  if (parts.length !== 2) return null;
  const [input, output] = parts as [number, number];
  if (!Number.isFinite(input) || !Number.isFinite(output) || input < 0 || output < 0) return null;
  return { input, output };
}

export function priceFor(
  provider: 'anthropic' | 'openai' | 'mock',
  model: string,
  config: Pick<Config, 'aiPriceAnthropic' | 'aiPriceOpenai'>,
): { price: Price; known: boolean } {
  const override =
    provider === 'anthropic'
      ? parsePriceOverride(config.aiPriceAnthropic)
      : provider === 'openai'
        ? parsePriceOverride(config.aiPriceOpenai)
        : null;
  if (override) return { price: override, known: true };
  const listed = PRICES[model];
  return listed ? { price: listed, known: true } : { price: DEAREST, known: false };
}

/**
 * The cost of some tokens in thousandths of a cent, rounded up. $1 per million tokens is 0.1 millicents a token.
 */
export function costMillicents(price: Price, inputTokens: number, outputTokens: number): number {
  const card = price.long && inputTokens > price.long.aboveInputTokens ? price.long : price;
  const exact = Math.max(0, inputTokens) * card.input * 0.1 + Math.max(0, outputTokens) * card.output * 0.1;
  // Floating point can put 15 at 15.000000000000002; a whole millicent of slack would over-count every call.
  return Math.ceil(Math.round(exact * 1000) / 1000);
}
