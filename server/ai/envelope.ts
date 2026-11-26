import * as v from 'valibot';
import {
  AI_LIMITS,
  isAiAllowedOp,
  type AiAllowedOp,
  type AiChange,
  type AiWorkflow,
  type ItemPreview,
  type RoutinePreview,
  type TaskPreview,
} from '../../shared/ai.js';
import type { ShoppingItem } from '../../shared/model.js';
import { ROUTINE_KINDS } from '../../shared/model.js';
import { OPS } from '../../shared/ops.js';
import {
  ACTION_PICTURE_IDS,
  SHOPPING_CATEGORIES,
  SHOPPING_PICTURE_IDS,
  type ActionPictureId,
} from '../../shared/pictures.js';
import { hazardsIn } from '../../shared/safety.js';
import { ScheduleSchema } from '../../shared/schedule.js';
import { scrub, type Aliases, type Refs } from './anonymise.js';

/**
 * The deterministic gate between what a model said and what a grown-up is shown.
 *
 * Whatever came back — however it was worded, whatever a list item told the model to do — only changes of the
 * kinds on the allow-list survive, each completed by the server (fresh ids, sensible defaults, "a grown-up
 * checks it"), checked against that operation's own schema in shared/ops.ts, with children mapped back from
 * "Child A" to real ids, pictures checked against the registry, stars clamped, hazards flagged, addresses and
 * markup stripped from every title, and the number of changes capped. Everything thrown away is listed with
 * the reason, so that nothing is lost silently. Accepting a change later still goes through the normal
 * operation runner with all of its own checks.
 */

export interface ValidationContext {
  workflow: AiWorkflow;
  aliases: Aliases;
  /** For shopping: the list's items, by real id, and the request's references to them. */
  items?: ReadonlyMap<string, ShoppingItem>;
  itemRefs?: Refs;
  newId: () => string;
}

export interface ValidatedChanges {
  changes: AiChange[];
  safetyFlags: string[];
  dropped: string[];
}

/** Which kinds of change each job may suggest: a subset of the global allow-list. */
const WORKFLOW_OPS: Record<AiWorkflow, readonly AiAllowedOp[]> = {
  routine_architect: ['routine.create'],
  weekly_reflection: ['routine.create', 'task.create'],
  shopping_tidy: ['shopping.edit'],
  reward_economist: [],
};

const ACTION_IDS: ReadonlySet<string> = new Set(ACTION_PICTURE_IDS);
const SHOPPING_IDS: ReadonlySet<string> = new Set(SHOPPING_PICTURE_IDS);
const CATEGORIES: ReadonlySet<string> = new Set(SHOPPING_CATEGORIES);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A title a model wrote: no addresses, no markup, no names, within the length the operation allows. */
export function cleanTitle(value: unknown, max: number, aliases?: Aliases): string {
  if (typeof value !== 'string') return '';
  return scrub(value, { max, names: aliases?.names });
}

/** Free words from a model (reasons, notes): the same cleaning, a little longer. */
export function cleanWords(value: unknown, max: number, aliases?: Aliases): string {
  return cleanTitle(value, max, aliases);
}

const clampInt = (value: unknown, min: number, max: number): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, Math.round(value)));
};

function weekdaysOf(value: unknown): number[] {
  if (!Array.isArray(value)) return [0, 1, 2, 3, 4, 5, 6];
  const days = [...new Set(value.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6) as number[])];
  return days.length > 0 ? days.sort((a, b) => a - b) : [0, 1, 2, 3, 4, 5, 6];
}

function assigneesOf(value: unknown, aliases: Aliases, dropped: string[]): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const alias of value) {
    const id = aliases.profileOf(alias);
    if (id) {
      if (!out.includes(id)) out.push(id);
    } else {
      dropped.push(`An unknown child (${cleanTitle(alias, 20) || 'blank'}) was left out.`);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// One kind of change at a time
// ---------------------------------------------------------------------------------------------------------------------

interface Completed {
  input: Record<string, unknown>;
  preview: AiChange['preview'];
  safetyFlags: string[];
}

function completeRoutine(
  draft: Record<string, unknown>,
  vc: ValidationContext,
  dropped: string[],
): Completed | null {
  const title = cleanTitle(draft.title, 40, vc.aliases);
  if (!title) {
    dropped.push('A routine without a usable name was left out.');
    return null;
  }
  const rawSteps = Array.isArray(draft.steps) ? draft.steps : [];
  const flags: string[] = [];
  const steps: RoutinePreview['steps'] = [];
  for (const raw of rawSteps) {
    if (!isObject(raw)) continue;
    const stepTitle = cleanTitle(raw.title, 40, vc.aliases);
    if (!stepTitle) {
      dropped.push('A step without usable words was left out.');
      continue;
    }
    if (typeof raw.picture !== 'string' || !ACTION_IDS.has(raw.picture)) {
      dropped.push(`The step “${stepTitle}” asked for a picture HOMEBASE does not have, so it was left out.`);
      continue;
    }
    const hazards = hazardsIn(stepTitle);
    const needsAdult = raw.needsAdult === true || hazards.length > 0;
    if (hazards.length > 0) {
      flags.push(`“${stepTitle}” mentions ${hazards.join(' and ')}: it is marked “with a grown-up”.`);
    }
    steps.push({
      title: stepTitle,
      picture: raw.picture,
      seconds: clampInt(raw.seconds, 10, 3600),
      needsAdult,
      optional: raw.optional === true,
    });
  }
  const limit = vc.workflow === 'routine_architect' ? 8 : 12;
  if (steps.length > limit) {
    dropped.push(`Only the first ${limit} steps were kept.`);
    steps.length = limit;
  }
  if (steps.length < 2) {
    dropped.push(`The routine “${title}” had fewer than two usable steps, so it was left out.`);
    return null;
  }
  const titleHazards = hazardsIn(title);
  if (titleHazards.length > 0) {
    flags.push(
      `The routine’s name mentions ${titleHazards.join(' and ')}: look at it before it reaches the wall.`,
    );
  }
  const picture =
    typeof draft.picture === 'string' && ACTION_IDS.has(draft.picture)
      ? draft.picture
      : (steps[0]?.picture as string);
  const kind =
    typeof draft.kind === 'string' && (ROUTINE_KINDS as readonly string[]).includes(draft.kind)
      ? draft.kind
      : 'custom';
  const days = weekdaysOf(draft.days);
  const assignees = assigneesOf(draft.assignees, vc.aliases, dropped);
  const input = {
    routineId: vc.newId(),
    kind,
    title,
    picture,
    steps: steps.map((step) => ({
      id: vc.newId(),
      title: step.title,
      picture: step.picture,
      say: null,
      seconds: step.seconds,
      needsAdult: step.needsAdult,
      optional: step.optional,
      days: null,
      taskId: null,
    })),
    assignees,
    days,
    start: null,
    end: null,
    skip: 'child',
  };
  return {
    input,
    preview: { kind: 'routine', title, picture, days, assignees, steps },
    safetyFlags: flags,
  };
}

function completeTask(
  draft: Record<string, unknown>,
  vc: ValidationContext,
  dropped: string[],
): Completed | null {
  const title = cleanTitle(draft.title, 60, vc.aliases);
  if (!title) {
    dropped.push('A mission without a usable name was left out.');
    return null;
  }
  if (typeof draft.picture !== 'string' || !ACTION_IDS.has(draft.picture)) {
    dropped.push(`The mission “${title}” asked for a picture HOMEBASE does not have, so it was left out.`);
    return null;
  }
  const asSchedule = (raw: unknown): unknown => {
    if (!isObject(raw)) return null;
    if (raw.kind === 'daily' || raw.kind === 'weekdays') return { kind: raw.kind };
    if (raw.kind === 'weekly') return { kind: 'weekly', days: weekdaysOf(raw.days) };
    if (raw.kind === 'flexible') return { kind: 'flexible', timesPerWeek: raw.timesPerWeek };
    return null;
  };
  const schedule = v.safeParse(ScheduleSchema, asSchedule(draft.schedule));
  if (!schedule.success || schedule.output.kind === 'once') {
    dropped.push(`The mission “${title}” had no usable days, so it was left out.`);
    return null;
  }
  const asked = clampInt(draft.stars, 0, 1000) ?? 0;
  const stars = Math.min(asked, AI_LIMITS.missionStars);
  if (asked > stars) dropped.push(`The mission “${title}” asked for ${asked} stars; it was set to ${stars}.`);
  const hazards = hazardsIn(title);
  const flags =
    hazards.length > 0
      ? [`“${title}” mentions ${hazards.join(' and ')}: it is marked “with a grown-up”.`]
      : [];
  const needsAdult = draft.needsAdult === true || hazards.length > 0;
  const assignees = assigneesOf(draft.assignees, vc.aliases, dropped);
  const input = {
    templateId: vc.newId(),
    kind: 'core',
    title,
    picture: draft.picture as ActionPictureId,
    say: null,
    steps: [],
    schedule: schedule.output,
    assignees,
    shared: false,
    stars,
    effort: 1,
    // A new mission from the helper is always looked at by a grown-up before its stars are given.
    verification: 'guardian',
    skip: 'child',
    needsAdult,
    timerSeconds: null,
  };
  const preview: TaskPreview = {
    kind: 'task',
    title,
    picture: draft.picture,
    stars,
    schedule: schedule.output,
    assignees,
    needsAdult,
    verification: 'guardian',
  };
  return { input, preview, safetyFlags: flags };
}

function completeItemEdit(
  draft: Record<string, unknown>,
  vc: ValidationContext,
  dropped: string[],
): Completed | null {
  const itemId = vc.itemRefs?.idOf(draft.item) ?? null;
  const item = itemId ? vc.items?.get(itemId) : undefined;
  if (!itemId || !item) {
    dropped.push(
      `A change to an item that is not on the list (${cleanTitle(draft.item, 12) || 'blank'}) was left out.`,
    );
    return null;
  }
  const patch: Record<string, unknown> = {};
  if (draft.category !== null && draft.category !== undefined) {
    if (typeof draft.category === 'string' && CATEGORIES.has(draft.category)) {
      if (draft.category !== item.category) patch.category = draft.category;
    } else dropped.push(`An unknown aisle for “${item.text}” was left out.`);
  }
  if (draft.picture !== null && draft.picture !== undefined) {
    if (typeof draft.picture === 'string' && SHOPPING_IDS.has(draft.picture)) {
      if (draft.picture !== item.picture) patch.picture = draft.picture;
    } else dropped.push(`A picture HOMEBASE does not have for “${item.text}” was left out.`);
  }
  if (draft.quantity !== null && draft.quantity !== undefined) {
    const quantity = clampInt(draft.quantity, 1, 999);
    if (quantity !== null && quantity !== item.quantity) patch.quantity = quantity;
  }
  if (draft.unit !== null && draft.unit !== undefined) {
    const unit = cleanTitle(draft.unit, 16);
    if (unit && unit !== item.unit) patch.unit = unit;
  }
  // The item's own words are never changed, whatever was asked: `text` is simply not something this builds.
  if (Object.keys(patch).length === 0) {
    dropped.push(`A suggestion for “${item.text}” would have changed nothing.`);
    return null;
  }
  const before = { category: item.category, picture: item.picture, quantity: item.quantity, unit: item.unit };
  const preview: ItemPreview = {
    kind: 'item',
    itemId,
    text: item.text,
    before,
    after: { ...before, ...(patch as Partial<typeof before>) },
  };
  return { input: { itemId, patch }, preview, safetyFlags: [] };
}

// ---------------------------------------------------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------------------------------------------------

/** Turn whatever the model proposed into changes a grown-up may be shown, or nothing. */
export function validateChanges(vc: ValidationContext, rawChanges: unknown): ValidatedChanges {
  const dropped: string[] = [];
  const changes: AiChange[] = [];
  const safetyFlags: string[] = [];
  const list = Array.isArray(rawChanges) ? rawChanges : [];
  const allowedHere = WORKFLOW_OPS[vc.workflow];
  const cap = AI_LIMITS.changes[vc.workflow];

  for (const raw of list) {
    if (!isObject(raw)) {
      dropped.push('Something that was not a change was left out.');
      continue;
    }
    const op = raw.op;
    if (!isAiAllowedOp(op) || !allowedHere.includes(op)) {
      // The words of a refused kind are not repeated back, in case they were put there to be.
      dropped.push(
        `A kind of change the helper may not suggest (${typeof op === 'string' ? op.replace(/[^a-z.]/gi, '').slice(0, 30) : 'unknown'}) was left out.`,
      );
      continue;
    }
    if (changes.length >= cap) {
      dropped.push(`Only ${cap} suggested change${cap === 1 ? '' : 's'} can be kept.`);
      continue;
    }
    const draft = isObject(raw.input) ? raw.input : {};
    const completed =
      op === 'routine.create'
        ? completeRoutine(draft, vc, dropped)
        : op === 'task.create'
          ? completeTask(draft, vc, dropped)
          : completeItemEdit(draft, vc, dropped);
    if (!completed) continue;
    // The operation's own schema has the last word, exactly as it would for a change made by hand.
    const checked = v.safeParse(OPS[op].input, completed.input);
    if (!checked.success) {
      dropped.push('A suggested change did not pass HOMEBASE’s own checks, so it was left out.');
      continue;
    }
    if (op === 'shopping.edit' && 'text' in (checked.output as { patch: object }).patch) {
      dropped.push('A suggestion that would have changed an item’s own words was left out.');
      continue;
    }
    changes.push({
      index: changes.length,
      op,
      input: checked.output as Record<string, unknown>,
      preview: completed.preview,
      safetyFlags: completed.safetyFlags,
    });
    safetyFlags.push(...completed.safetyFlags);
  }
  return { changes, safetyFlags, dropped };
}

/** "low", "medium" or "high"; anything else is "high", because then nobody can be sure. */
export function uncertaintyOf(
  level: unknown,
  note: unknown,
): { level: 'low' | 'medium' | 'high'; note: string } {
  const safe = level === 'low' || level === 'medium' || level === 'high' ? level : 'high';
  return { level: safe, note: cleanWords(note, 200) || 'The helper did not say.' };
}

export interface ValidatedEnvelope extends ValidatedChanges {
  rationale: string;
  uncertainty: { level: 'low' | 'medium' | 'high'; note: string };
}

/**
 * The parts every draft has: the helper's reasons, how sure it is, and its changes (through the gate above).
 * Null when the reply was not even an object; the job then fails cleanly and nothing is stored.
 */
export function validateEnvelope(vc: ValidationContext, raw: unknown): ValidatedEnvelope | null {
  if (!isObject(raw)) return null;
  return {
    rationale: cleanWords(raw.rationale, 600, vc.aliases),
    uncertainty: uncertaintyOf(raw.uncertainty, raw.uncertaintyNote),
    ...validateChanges(vc, raw.changes),
  };
}
