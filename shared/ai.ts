import type { OpType } from './ops.js';
import type { Schedule } from './schedule.js';
import type { AiDataCategory, HouseholdSettings } from './settings.js';
import type { LocalDate } from './time.js';

/**
 * The optional planning helper, as both ends see it: which jobs it can do, what a draft looks like, and the
 * reward simulation that needs no model at all. The server's side is in server/ai/; the page is
 * src/parent/pages/Helper.tsx. See docs/integrations/AI.md.
 */

export const AI_WORKFLOWS = [
  'routine_architect',
  'weekly_reflection',
  'shopping_tidy',
  'reward_economist',
] as const;
export type AiWorkflow = (typeof AI_WORKFLOWS)[number];

export function isAiWorkflow(value: unknown): value is AiWorkflow {
  return typeof value === 'string' && (AI_WORKFLOWS as readonly string[]).includes(value);
}

/** What each job needs to be allowed to send. `any` means at least one of them. */
export const WORKFLOW_CATEGORIES: Record<AiWorkflow, { all?: AiDataCategory[]; any?: AiDataCategory[] }> = {
  routine_architect: { all: ['routines'] },
  weekly_reflection: { any: ['tasks', 'routines'] },
  shopping_tidy: { all: ['shopping'] },
  reward_economist: { all: ['rewards'] },
};

export function workflowAllowed(workflow: AiWorkflow, share: readonly AiDataCategory[]): boolean {
  const need = WORKFLOW_CATEGORIES[workflow];
  if (need.all && !need.all.every((category) => share.includes(category))) return false;
  if (need.any && !need.any.some((category) => share.includes(category))) return false;
  return true;
}

/** The only kinds of change a draft may ever hold. Nothing about stars, rewards, people, screens or settings. */
export const AI_ALLOWED_OPS = [
  'routine.create',
  'task.create',
  'shopping.edit',
] as const satisfies readonly OpType[];
export type AiAllowedOp = (typeof AI_ALLOWED_OPS)[number];

export function isAiAllowedOp(value: unknown): value is AiAllowedOp {
  return typeof value === 'string' && (AI_ALLOWED_OPS as readonly string[]).includes(value);
}

export const AI_LIMITS = {
  routineRequestChars: 300,
  /** At most this many suggestions of a change in one draft, per job. */
  changes: { routine_architect: 1, weekly_reflection: 2, shopping_tidy: 20, reward_economist: 0 },
  /** The most stars a drafted mission may carry, whatever the model says. */
  missionStars: 5,
} as const;

// ---------------------------------------------------------------------------------------------------------------------
// The draft ("proposal envelope")
// ---------------------------------------------------------------------------------------------------------------------

/** A pointer to something HOMEBASE itself knows: never a sentence from the model presented as fact. */
export interface AiEvidence {
  kind: 'weeks' | 'count' | 'mission' | 'routine' | 'item' | 'reward' | 'request';
  /** Plain words made by HOMEBASE from the numbers, e.g. "Missions done, Child A: 9 out of 12". */
  label: string;
  from?: LocalDate;
  to?: LocalDate;
  count?: number;
  outOf?: number;
  /** The id of the mission, routine, item or reward, where there is one. */
  ref?: string;
  /** Which child this is about (a real profile id, on the server's side of the line). */
  profileId?: string | null;
}

export interface AiObservation {
  text: string;
  /** Indexes into `evidence`. */
  evidence: number[];
}

export interface RoutinePreview {
  kind: 'routine';
  title: string;
  picture: string;
  days: number[];
  assignees: string[];
  steps: { title: string; picture: string; seconds: number | null; needsAdult: boolean; optional: boolean }[];
}

export interface TaskPreview {
  kind: 'task';
  title: string;
  picture: string;
  stars: number;
  schedule: Schedule;
  assignees: string[];
  needsAdult: boolean;
  verification: 'auto' | 'guardian';
}

export interface ItemPreview {
  kind: 'item';
  itemId: string;
  /** The item's own words, from the list (not from the model). */
  text: string;
  before: { category: string; picture: string; quantity: number | null; unit: string | null };
  after: { category: string; picture: string; quantity: number | null; unit: string | null };
}

export interface AiChange {
  index: number;
  op: AiAllowedOp;
  input: Record<string, unknown>;
  preview: RoutinePreview | TaskPreview | ItemPreview;
  safetyFlags: string[];
}

export interface PriceSuggestion {
  rewardId: string;
  profileId: string | null;
  title: string;
  price: number;
  suggestedPrice: number;
  reason: string;
}

export interface AiEnvelope {
  id: string;
  type: AiWorkflow;
  createdAt: string;
  evidence: AiEvidence[];
  /** The helper's own reasons, in its words: an opinion, shown as one. */
  rationale: string;
  uncertainty: { level: 'low' | 'medium' | 'high'; note: string };
  observations: AiObservation[];
  /** Small things to try, in words. A change that goes with one is in `changes`. */
  experiments: string[];
  /** Possible duplicates on a list, as groups of item ids with the items' own words. */
  duplicates: { itemIds: string[]; texts: string[] }[];
  explanation: string | null;
  priceSuggestions: PriceSuggestion[];
  changes: AiChange[];
  safetyFlags: string[];
  /** What was thrown away, and why, so that nothing is silently lost. */
  dropped: string[];
  cost: {
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    /** What was charged against the limits, in thousandths of a cent. */
    millicents: number;
    /** The most it could have cost, checked before asking. */
    worstCaseMillicents: number;
  };
  applied?: {
    at: string;
    changes: number[];
    outcomes: { index: number; status: string; message?: string }[];
  };
}

export interface AiProposalSummary {
  id: string;
  workflow: AiWorkflow;
  status: 'draft' | 'accepted' | 'dismissed';
  createdAt: string;
  decidedAt: string | null;
  envelope: AiEnvelope;
}

export type AiRefusal =
  | 'off'
  | 'offline'
  | 'no_provider'
  | 'no_key'
  | 'category'
  | 'cap_daily'
  | 'cap_monthly'
  | 'busy'
  | 'provider'
  | 'timeout'
  | 'nothing_usable';

export interface AiStatus {
  enabled: boolean;
  provider: 'anthropic' | 'openai' | null;
  providersAvailable: ('anthropic' | 'openai')[];
  model: string | null;
  share: AiDataCategory[];
  caps: { dailyCents: number; monthlyCents: number };
  spentTodayCents: number;
  spentThisMonthCents: number;
  canRun: boolean;
  reason?: AiRefusal;
}

// ---------------------------------------------------------------------------------------------------------------------
// "How long until…?" — the reward simulation. Deterministic; no model.
// ---------------------------------------------------------------------------------------------------------------------

export interface CeilingTemplate {
  status: 'active' | 'paused' | 'archived';
  shared: boolean;
  assignees: string[];
  schedule: Schedule;
  stars: number;
}

/** The most stars a child's present missions could bring in a week: a ceiling, not a forecast. */
export function weeklyCeilingFor(
  templates: readonly CeilingTemplate[],
  childId: string,
  bank: HouseholdSettings['bank'],
): number {
  let total = 0;
  for (const template of templates) {
    if (template.status !== 'active' || template.shared) continue;
    if (template.assignees.length > 0 && !template.assignees.includes(childId)) continue;
    const schedule = template.schedule;
    const times =
      schedule.kind === 'daily'
        ? 7
        : schedule.kind === 'weekdays'
          ? 5
          : schedule.kind === 'weekly'
            ? schedule.days.length
            : schedule.kind === 'flexible'
              ? schedule.timesPerWeek
              : 0;
    total += template.stars * times;
  }
  return (
    Math.floor((total * bank.spendRatePercent) / 100) + (bank.allowance.enabled ? bank.allowance.stars : 0)
  );
}

/** Weeks to save `need` stars at `perWeek`, to a tenth, rounded up; null when nothing is coming in. */
export function weeksToSave(need: number, perWeek: number): number | null {
  if (need <= 0) return 0;
  if (perWeek <= 0) return null;
  return Math.ceil((need / perWeek) * 10) / 10;
}

export interface EconomistReward {
  rewardId: string;
  title: string;
  picture: string;
  price: number;
  /** Stars still to save (0 when it can be had now). */
  need: number;
  weeksAtCeiling: number | null;
  weeksAtRecent: number | null;
}

export interface EconomistChild {
  profileId: string;
  nickname: string;
  available: number;
  ceilingPerWeek: number;
  recentPerWeek: number;
  /** Stars to spend actually earned over the four weeks, from the ledger. */
  recentTotal: number;
  rewards: EconomistReward[];
}

export interface Economist {
  today: LocalDate;
  recent: { from: LocalDate; to: LocalDate; weeks: 4 };
  children: EconomistChild[];
}
