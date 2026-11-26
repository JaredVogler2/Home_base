import * as v from 'valibot';
import { isUuid } from './ids.js';
import {
  AGE_BANDS,
  DECLINE_REASONS,
  RETURN_REASONS,
  ROUTINE_KINDS,
  SKIP_POLICIES,
  TASK_KINDS,
  VERIFICATIONS,
} from './model.js';
import type { AccessLevel, DeclineReason, ReturnReason } from './model.js';
import {
  ACTION_PICTURE_IDS,
  AVATAR_IDS,
  DAY_PICTURE_IDS,
  REWARD_PICTURE_IDS,
  SHOPPING_CATEGORIES,
  SHOPPING_PICTURE_IDS,
} from './pictures.js';
import { ScheduleSchema } from './schedule.js';
import { isLocalDate, isLocalTime, isValidTimeZone } from './time.js';

/**
 * Every change a screen can ask for, as data.
 *
 * A screen never edits anything directly. It writes down what it wants — "this mission is done", "add milk" —
 * gives the request an id of its own, and sends it. Because the id is the screen's, the same request sent twice
 * (a double tap, a retry, a phone coming back online with a queue) is done once. Each kind of request below has
 * the shape of its details and the least access needed to make it; the server checks both, every time.
 */

// ---------------------------------------------------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------------------------------------------------

const id = v.pipe(
  v.string(),
  v.check((value: string) => isUuid(value), 'an id'),
);
// Control characters have no place in a name or a note, and are how odd things get into logs.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const clean = v.transform((value: string) => value.replace(CONTROL, '').replace(/\s+/g, ' ').trim());
const text = (max: number) => v.pipe(v.string(), clean, v.minLength(1), v.maxLength(max));
const optionalText = (max: number) =>
  v.nullable(
    v.pipe(
      v.string(),
      clean,
      v.maxLength(max),
      v.transform((value: string) => (value === '' ? null : value)),
    ),
  );
const int = (min: number, max: number) => v.pipe(v.number(), v.integer(), v.minValue(min), v.maxValue(max));
const localDate = v.pipe(
  v.string(),
  v.check((value: string) => isLocalDate(value), 'a calendar day'),
);
const localTime = v.pipe(
  v.string(),
  v.check((value: string) => isLocalTime(value), 'a time of day'),
);
const weekdays = v.pipe(v.array(int(0, 6)), v.minLength(1), v.maxLength(7));
const idList = (max: number) => v.pipe(v.array(id), v.maxLength(max));

const actionPicture = v.picklist(ACTION_PICTURE_IDS);
const rewardPicture = v.picklist(REWARD_PICTURE_IDS);
const shoppingPicture = v.picklist(SHOPPING_PICTURE_IDS);
const dayPicture = v.picklist(DAY_PICTURE_IDS);
const avatar = v.picklist(AVATAR_IDS);

/** A link a grown-up pasted. Only http and https, no sign-in details, and never followed by the server. */
const link = v.nullable(
  v.pipe(
    v.string(),
    v.trim(),
    v.maxLength(500),
    v.check((value: string) => {
      if (value === '') return true;
      try {
        const url = new URL(value);
        return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password;
      } catch {
        return false;
      }
    }, 'a web address'),
    v.transform((value: string) => (value === '' ? null : value)),
  ),
);

const ChecklistStepSchema = v.object({ id, picture: actionPicture, label: text(40) });

const TaskFields = {
  kind: v.picklist(TASK_KINDS),
  title: text(60),
  picture: actionPicture,
  say: optionalText(120),
  steps: v.pipe(v.array(ChecklistStepSchema), v.maxLength(6)),
  schedule: ScheduleSchema,
  assignees: idList(12),
  shared: v.boolean(),
  stars: int(0, 20),
  effort: v.picklist([1, 2, 3]),
  verification: v.picklist(VERIFICATIONS),
  skip: v.picklist(SKIP_POLICIES),
  needsAdult: v.boolean(),
  timerSeconds: v.nullable(int(30, 3600)),
};

const RoutineStepSchema = v.object({
  id,
  title: text(40),
  picture: actionPicture,
  say: optionalText(120),
  seconds: v.nullable(int(10, 3600)),
  needsAdult: v.boolean(),
  optional: v.boolean(),
  days: v.nullable(weekdays),
  taskId: v.nullable(id),
});

const RoutineFields = {
  kind: v.picklist(ROUTINE_KINDS),
  title: text(40),
  picture: actionPicture,
  steps: v.pipe(v.array(RoutineStepSchema), v.minLength(1), v.maxLength(12)),
  assignees: idList(12),
  days: weekdays,
  start: v.nullable(localTime),
  end: v.nullable(localTime),
  skip: v.picklist(SKIP_POLICIES),
};

const RewardFields = {
  title: text(60),
  picture: rewardPicture,
  say: optionalText(120),
  price: int(1, 500),
  stock: v.nullable(int(0, 999)),
  profiles: idList(12),
};

const ItemFields = {
  text: text(120),
  quantity: v.nullable(int(1, 999)),
  unit: optionalText(16),
  note: optionalText(200),
  url: link,
  store: optionalText(40),
  priority: v.boolean(),
  category: v.picklist(SHOPPING_CATEGORIES),
  picture: shoppingPicture,
};

const op = <T extends v.GenericSchema>(level: AccessLevel, input: T) => ({ level, input });

// ---------------------------------------------------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------------------------------------------------

export const OPS = {
  // --- a child, on the wall -------------------------------------------------------------------------------------
  'occurrence.start': op('child', v.object({ occurrenceId: id, profileId: id })),
  'occurrence.submit': op('child', v.object({ occurrenceId: id, profileId: id })),
  'occurrence.undo': op('child', v.object({ occurrenceId: id })),
  'occurrence.help': op('child', v.object({ occurrenceId: id, profileId: id })),
  'occurrence.skip': op('child', v.object({ occurrenceId: id, profileId: id })),
  'run.start': op('child', v.object({ runId: id, routineId: id, profileId: id })),
  'run.step': op(
    'child',
    v.object({ runId: id, stepId: id, state: v.picklist(['done', 'skipped', 'help', 'undo']) }),
  ),
  'run.pause': op('child', v.object({ runId: id })),
  'run.resume': op('child', v.object({ runId: id })),
  'redemption.request': op(
    'child',
    v.object({
      redemptionId: id,
      profileId: id,
      rewardId: id,
      /** The offer the child was looking at when they said yes. A changed offer is not agreed to by an old tap. */
      rewardVersion: int(1, 1_000_000),
      price: int(1, 500),
    }),
  ),
  'redemption.cancel': op('child', v.object({ redemptionId: id })),
  'goal.set': op('child', v.object({ profileId: id, rewardId: v.nullable(id) })),
  /** A child asks for something from the shop by tapping its picture. It waits for a grown-up; nothing is bought. */
  'shopping.request': op('child', v.object({ itemId: id, profileId: id, picture: shoppingPicture })),

  // --- everyday family things (a two-second press on the wall) -------------------------------------------------
  'shopping.add': op(
    'household',
    v.object({
      itemId: id,
      listId: id,
      ...ItemFields,
      via: v.optional(v.picklist(['typed', 'pasted', 'voice', 'picture'])),
    }),
  ),
  'shopping.check': op('household', v.object({ itemId: id, checked: v.boolean() })),
  'run.together': op('household', v.object({ runId: id, stepId: id })),

  // --- a helper or a parent ------------------------------------------------------------------------------------
  'occurrence.approve': op(
    'caregiver',
    v.object({ occurrenceIds: v.pipe(v.array(id), v.minLength(1), v.maxLength(50)) }),
  ),
  'occurrence.return': op(
    'caregiver',
    v.object({ occurrenceId: id, reason: v.picklist(Object.keys(RETURN_REASONS) as ReturnReason[]) }),
  ),
  'occurrence.markDone': op('caregiver', v.object({ occurrenceId: id, profileId: id })),
  'occurrence.snooze': op('caregiver', v.object({ occurrenceId: id, hours: int(1, 12) })),
  'occurrence.dismiss': op('caregiver', v.object({ occurrenceId: id })),
  'shopping.decide': op('caregiver', v.object({ itemId: id, accept: v.boolean() })),
  'shopping.edit': op(
    'caregiver',
    v.object({
      itemId: id,
      /** Only what was changed. Two phones changing different things both keep their change. */
      patch: v.partial(v.object({ ...ItemFields, listId: id })),
    }),
  ),
  'shopping.remove': op('caregiver', v.object({ itemId: id })),
  'shopping.restore': op('caregiver', v.object({ itemId: id })),
  'shopping.clearChecked': op('caregiver', v.object({ listId: id })),

  // --- a parent ------------------------------------------------------------------------------------------------
  'occurrence.reverse': op('guardian', v.object({ occurrenceId: id, note: optionalText(200) })),
  'task.create': op('guardian', v.object({ templateId: id, ...TaskFields })),
  'task.update': op('guardian', v.object({ templateId: id, baseVersion: int(1, 1_000_000), ...TaskFields })),
  'task.status': op(
    'guardian',
    v.object({ templateId: id, status: v.picklist(['active', 'paused', 'archived']) }),
  ),
  'task.reorder': op('guardian', v.object({ templateIds: idList(200) })),
  'routine.create': op('guardian', v.object({ routineId: id, ...RoutineFields })),
  'routine.update': op(
    'guardian',
    v.object({ routineId: id, baseVersion: int(1, 1_000_000), ...RoutineFields }),
  ),
  'routine.status': op(
    'guardian',
    v.object({ routineId: id, status: v.picklist(['active', 'paused', 'archived']) }),
  ),
  'routine.clone': op('guardian', v.object({ routineId: id, newRoutineId: id, title: text(40) })),
  'run.finish': op('guardian', v.object({ runId: id })),
  'reward.create': op('guardian', v.object({ rewardId: id, ...RewardFields })),
  'reward.update': op(
    'guardian',
    v.object({ rewardId: id, baseVersion: int(1, 1_000_000), ...RewardFields }),
  ),
  'reward.status': op(
    'guardian',
    v.object({ rewardId: id, status: v.picklist(['active', 'paused', 'archived']) }),
  ),
  'redemption.decide': op(
    'guardian',
    v.object({
      redemptionId: id,
      approve: v.boolean(),
      reason: v.optional(v.picklist(Object.keys(DECLINE_REASONS) as DeclineReason[])),
    }),
  ),
  'redemption.fulfill': op('guardian', v.object({ redemptionId: id })),
  'redemption.refund': op('guardian', v.object({ redemptionId: id, note: optionalText(200) })),
  /** A gift of stars from a grown-up, for something no mission covers. */
  'ledger.bonus': op(
    'guardian',
    v.object({ entryId: id, profileId: id, stars: int(1, 100), note: optionalText(200) }),
  ),
  /** Putting a mistake right, in the open: a new line that says what changed and why. Nothing is rewritten. */
  'ledger.correct': op(
    'guardian',
    v.object({
      entryId: id,
      profileId: id,
      available: int(-1000, 1000),
      lifetime: int(-1000, 1000),
      note: text(200),
    }),
  ),
  'profile.create': op(
    'guardian',
    v.object({
      profileId: id,
      nickname: text(24),
      avatar,
      ageBand: v.picklist(AGE_BANDS),
      independent: v.boolean(),
    }),
  ),
  'profile.update': op(
    'guardian',
    v.object({
      profileId: id,
      nickname: text(24),
      avatar,
      ageBand: v.picklist(AGE_BANDS),
      independent: v.boolean(),
      showNumbers: v.boolean(),
    }),
  ),
  'profile.archive': op('guardian', v.object({ profileId: id, archived: v.boolean() })),
  'profile.reorder': op('guardian', v.object({ profileIds: idList(24) })),
  'household.rename': op(
    'guardian',
    v.object({
      name: text(40),
      timeZone: v.pipe(
        v.string(),
        v.check((value: string) => isValidTimeZone(value), 'a time zone'),
      ),
    }),
  ),
  /** Any part of the settings; what is not mentioned is left as it was. */
  'household.settings': op('guardian', v.object({ patch: v.record(v.string(), v.unknown()) })),
  'list.create': op(
    'guardian',
    v.object({ listId: id, name: text(40), kind: v.picklist(['groceries', 'general']) }),
  ),
  'list.update': op('guardian', v.object({ listId: id, name: text(40), archived: v.boolean() })),
  'device.rename': op('guardian', v.object({ deviceId: id, name: text(40) })),
  'device.revoke': op('guardian', v.object({ deviceId: id })),
  'milestone.save': op(
    'guardian',
    v.object({
      milestoneId: id,
      date: localDate,
      title: text(80),
      picture: v.nullable(v.union([actionPicture, rewardPicture, dayPicture])),
      profileId: v.nullable(id),
    }),
  ),
  'milestone.remove': op('guardian', v.object({ milestoneId: id })),
  'calendar.setDay': op(
    'guardian',
    v.object({ date: localDate, labels: v.pipe(v.array(dayPicture), v.maxLength(3)) }),
  ),
  'calendar.rule.save': op('guardian', v.object({ ruleId: id, match: text(40), label: dayPicture })),
  'calendar.rule.remove': op('guardian', v.object({ ruleId: id })),
  'media.update': op('guardian', v.object({ mediaId: id, inSlideshow: v.boolean() })),
  'media.remove': op('guardian', v.object({ mediaId: id })),
  'academy.unlink': op('guardian', v.object({ profileId: id })),
  'history.forget': op('guardian', v.object({ eventId: id })),

  // --- the owner -----------------------------------------------------------------------------------------------
  'member.role': op('owner', v.object({ userId: id, role: v.picklist(['guardian', 'caregiver']) })),
  'member.remove': op('owner', v.object({ userId: id })),
} as const;

export type OpType = keyof typeof OPS;
export type OpInput<T extends OpType> = v.InferOutput<(typeof OPS)[T]['input']>;
export const OP_TYPES = Object.keys(OPS) as OpType[];

export function isOpType(value: unknown): value is OpType {
  return typeof value === 'string' && Object.hasOwn(OPS, value);
}

/** A request as a screen sends it. */
export interface OpEnvelope<T extends OpType = OpType> {
  id: string;
  type: T;
  /** When the screen made it. Kept for the record; the server's own clock decides everything. */
  at: string;
  input: OpInput<T>;
}

/** Why a request was turned down. Each has plain words on the screen that asked. */
export const REJECTIONS = [
  'invalid', // the details do not make sense
  'forbidden', // this screen may not do that
  'not_found', // the thing it is about is not there (any more)
  'conflict', // somebody else changed it first
  'not_allowed_now', // right thing, wrong moment (already approved, already answered)
  'not_enough_stars',
  'price_changed',
  'out_of_stock',
  'not_offered', // the reward or mission is paused or is not for this child
  'limit_reached',
] as const;
export type Rejection = (typeof REJECTIONS)[number];

export type OpOutcome =
  | { id: string; status: 'applied'; data: Record<string, unknown> }
  /** Nothing needed doing: it was already so. Not an error. */
  | { id: string; status: 'noop'; data: Record<string, unknown> }
  | { id: string; status: 'rejected'; reason: Rejection; message: string }
  /** Something went wrong on the way. Nothing was changed; the screen keeps the request and tries again. */
  | { id: string; status: 'retry' };

export const MAX_OPS_PER_REQUEST = 25;
