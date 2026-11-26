import type {
  ActionPictureId,
  AvatarId,
  DayPictureId,
  RewardPictureId,
  ShoppingCategory,
  ShoppingPictureId,
} from './pictures.js';
import type { Schedule } from './schedule.js';
import type { HouseholdSettings } from './settings.js';
import type { LocalDate, LocalTime } from './time.js';

/**
 * The shapes that travel between the server and the wall or a phone. They are what a screen needs to draw, not
 * the database's rows: a mission on the wall already carries its picture and its words, so a screen never has to
 * join anything, and nothing a screen does not need (a password hash, an e-mail address, a token) is in here.
 */

// ---------------------------------------------------------------------------------------------------------------------
// People and devices
// ---------------------------------------------------------------------------------------------------------------------

/** How old, roughly. A band, never a birthday. */
export const AGE_BANDS = ['baby', 'toddler', 'preschool', 'early', 'older'] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export const AGE_BAND_LABELS: Record<AgeBand, string> = {
  baby: 'Baby (under 1½)',
  toddler: 'Toddler (1½–3)',
  preschool: 'Preschooler (3–5)',
  early: 'Early school (5–8)',
  older: 'Older (8+)',
};

export interface ProfilePrefs {
  /** Show how many stars as a numeral beside the pictures. Off for children who cannot read numbers yet. */
  showNumbers: boolean;
}

export interface Profile {
  id: string;
  nickname: string;
  avatar: AvatarId;
  ageBand: AgeBand;
  /**
   * Whether this child has missions and a bank of their own. A baby has a picture and a place in the family and
   * nothing to do.
   */
  independent: boolean;
  sort: number;
  prefs: ProfilePrefs;
  archived: boolean;
}

export const GUARDIAN_ROLES = ['owner', 'guardian', 'caregiver'] as const;
export type GuardianRole = (typeof GUARDIAN_ROLES)[number];

export interface Member {
  userId: string;
  displayName: string;
  avatar: AvatarId;
  role: GuardianRole;
  hasPin: boolean;
  /** Only ever sent to that guardian themselves. */
  email?: string;
}

export interface Device {
  id: string;
  name: string;
  kind: 'wall' | 'tablet';
  createdAt: string;
  lastSeenAt: string | null;
  revoked: boolean;
}

// ---------------------------------------------------------------------------------------------------------------------
// QUEST
// ---------------------------------------------------------------------------------------------------------------------

export interface ChecklistStep {
  id: string;
  picture: ActionPictureId;
  label: string;
}

export const TASK_KINDS = ['core', 'bonus'] as const;
/** `core` is part of how the household runs; `bonus` is an extra a child may choose. */
export type TaskKind = (typeof TASK_KINDS)[number];

export const VERIFICATIONS = ['auto', 'guardian'] as const;
export type Verification = (typeof VERIFICATIONS)[number];

export const SKIP_POLICIES = ['child', 'grownup', 'off'] as const;
/** Who may say "not today": the child, only a grown-up, or it is not offered. Skipping costs nothing. */
export type SkipPolicy = (typeof SKIP_POLICIES)[number];

export interface TaskTemplate {
  id: string;
  /** Counts up with every edit. A mission handed out earlier keeps the version it was handed out with. */
  version: number;
  status: 'active' | 'paused' | 'archived';
  kind: TaskKind;
  title: string;
  picture: ActionPictureId;
  /** What the guide says. Null takes the picture's own sentence. */
  say: string | null;
  steps: ChecklistStep[];
  schedule: Schedule;
  /** Who it is for. Empty means every child who has missions. */
  assignees: string[];
  /** One for the family — whoever does it, does it — instead of one for each child. */
  shared: boolean;
  stars: number;
  effort: 1 | 2 | 3;
  verification: Verification;
  skip: SkipPolicy;
  needsAdult: boolean;
  /** A sand-timer to look at, never a deadline. Null for none. */
  timerSeconds: number | null;
  sort: number;
  updatedAt: string;
}

export const OCCURRENCE_STATUSES = [
  'available',
  'in_progress',
  'submitted',
  'approved',
  'returned',
  'skipped',
] as const;
export type OccurrenceStatus = (typeof OCCURRENCE_STATUSES)[number];

/** Kind words for "have another go". There is no reason that blames. */
export const RETURN_REASONS = {
  together: 'Let’s finish this one together.',
  almost: 'Nearly there — one more look.',
  later: 'Let’s try again a bit later.',
  show: 'Come and show me first.',
} as const;
export type ReturnReason = keyof typeof RETURN_REASONS;

/** One mission, for one day. It carries its own picture and words as they were when it was handed out. */
export interface Occurrence {
  id: string;
  templateId: string;
  templateVersion: number;
  /** Whose it is; null for a mission shared by the family. */
  profileId: string | null;
  date: LocalDate;
  status: OccurrenceStatus;
  kind: TaskKind;
  title: string;
  picture: ActionPictureId;
  say: string | null;
  steps: ChecklistStep[];
  stars: number;
  needsAdult: boolean;
  timerSeconds: number | null;
  skip: SkipPolicy;
  verification: Verification;
  sort: number;
  /** Who did it (for a shared mission, whoever tapped). */
  doneBy: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  /** Whether its stars have been given. Only ever true once. */
  credited: boolean;
  returnReason: ReturnReason | null;
  /** A child asked for a hand with it. */
  helpAsked: boolean;
  /** "Oops, not yet" is offered until this instant. */
  undoUntil: string | null;
  snoozedUntil: string | null;
}

// ---------------------------------------------------------------------------------------------------------------------
// BANK
// ---------------------------------------------------------------------------------------------------------------------

export interface Wallet {
  profileId: string;
  /** Stars that can be spent now. */
  available: number;
  /** Stars set aside for a reward that has been asked for and not yet answered. */
  reserved: number;
  /** Every star ever earned. Spending never lowers it. */
  lifetime: number;
}

export interface Reward {
  id: string;
  /** Counts up when the price or the offer changes, so a child never agrees to a price they did not see. */
  version: number;
  status: 'active' | 'paused' | 'archived';
  title: string;
  picture: RewardPictureId;
  say: string | null;
  price: number;
  /** How many are left; null when there is no limit. */
  stock: number | null;
  /** Who may choose it. Empty means every child with a bank. */
  profiles: string[];
  sort: number;
}

export const REDEMPTION_STATUSES = [
  'requested',
  'approved',
  'declined',
  'cancelled',
  'fulfilled',
  'refunded',
] as const;
export type RedemptionStatus = (typeof REDEMPTION_STATUSES)[number];

/** Neutral words for "not this time". */
export const DECLINE_REASONS = {
  later: 'Not today — let’s pick a day together.',
  another: 'Let’s choose a different one this time.',
  talk: 'Let’s talk about this one first.',
} as const;
export type DeclineReason = keyof typeof DECLINE_REASONS;

export interface Redemption {
  id: string;
  profileId: string;
  rewardId: string;
  title: string;
  picture: RewardPictureId;
  price: number;
  status: RedemptionStatus;
  requestedAt: string;
  decidedAt: string | null;
  fulfilledAt: string | null;
  declineReason: DeclineReason | null;
}

/** The reward a child is saving for. */
export interface Goal {
  profileId: string;
  rewardId: string;
}

export const LEDGER_KINDS = ['grant', 'reserve', 'release', 'spend', 'refund', 'correction'] as const;
export type LedgerKind = (typeof LEDGER_KINDS)[number];

export const LEDGER_SOURCES = [
  'task',
  'routine',
  'academy',
  'bonus',
  'allowance',
  'redemption',
  'correction',
] as const;
export type LedgerSource = (typeof LEDGER_SOURCES)[number];

/** One line of the star ledger. Lines are only ever added. */
export interface LedgerEntry {
  id: string;
  profileId: string;
  at: string;
  kind: LedgerKind;
  available: number;
  reserved: number;
  lifetime: number;
  source: LedgerSource;
  sourceId: string | null;
  note: string | null;
  actor: string;
}

// ---------------------------------------------------------------------------------------------------------------------
// ROUTINES
// ---------------------------------------------------------------------------------------------------------------------

export const ROUTINE_KINDS = [
  'morning',
  'bedtime',
  'leaving',
  'afterschool',
  'cleanup',
  'trip',
  'custom',
] as const;
export type RoutineKind = (typeof ROUTINE_KINDS)[number];

export interface RoutineStep {
  id: string;
  title: string;
  picture: ActionPictureId;
  say: string | null;
  /** About how long, for a grown-up planning the morning. Never shown to a child as time running out. */
  seconds: number | null;
  needsAdult: boolean;
  /** May be left out without a grown-up. */
  optional: boolean;
  /** Only on these weekdays (0 = Sunday); null for every day the routine runs. */
  days: number[] | null;
  /** A mission that doing this step also does: one mission, one set of stars, however it was done. */
  taskId: string | null;
}

export interface Routine {
  id: string;
  version: number;
  status: 'active' | 'paused' | 'archived';
  kind: RoutineKind;
  title: string;
  picture: ActionPictureId;
  steps: RoutineStep[];
  assignees: string[];
  /** Weekdays it runs on (0 = Sunday). */
  days: number[];
  /** When the wall offers it; null means it is always there to start. */
  start: LocalTime | null;
  end: LocalTime | null;
  skip: SkipPolicy;
  sort: number;
  updatedAt: string;
}

export const STEP_STATES = ['done', 'together', 'skipped'] as const;
export type StepState = (typeof STEP_STATES)[number];

export interface RoutineRun {
  id: string;
  routineId: string;
  routineVersion: number;
  profileId: string;
  date: LocalDate;
  status: 'active' | 'suspended' | 'completed';
  /** The steps as they were when the run began: editing a routine does not rearrange a morning in progress. */
  steps: RoutineStep[];
  done: Record<string, StepState>;
  help: string[];
  startedAt: string;
  completedAt: string | null;
}

// ---------------------------------------------------------------------------------------------------------------------
// TO BUY
// ---------------------------------------------------------------------------------------------------------------------

export interface ShoppingList {
  id: string;
  name: string;
  kind: 'groceries' | 'general';
  sort: number;
  archived: boolean;
}

export const ITEM_STATUSES = ['needed', 'checked', 'requested', 'declined'] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export interface ShoppingItem {
  id: string;
  listId: string;
  /** Exactly what was typed or said. Tidying never replaces it. */
  text: string;
  picture: ShoppingPictureId;
  category: ShoppingCategory;
  quantity: number | null;
  unit: string | null;
  note: string | null;
  url: string | null;
  store: string | null;
  priority: boolean;
  status: ItemStatus;
  /** A child who asked for it with a picture. */
  requestedBy: string | null;
  /** A grown-up's name, "the wall", "Siri". */
  addedBy: string;
  /** How many times someone tried to add it again while it was already on the list. */
  alsoAsked: number;
  createdAt: string;
  updatedAt: string;
  checkedAt: string | null;
}

// ---------------------------------------------------------------------------------------------------------------------
// The rest of the house
// ---------------------------------------------------------------------------------------------------------------------

export interface CalendarDay {
  date: LocalDate;
  /** Parent-approved labels only. The events themselves never reach a child's screen. */
  labels: DayPictureId[];
}

export interface MediaItem {
  id: string;
  width: number;
  height: number;
  /** Widths available, smallest first. */
  widths: number[];
  inSlideshow: boolean;
  createdAt: string;
}

export interface AcademyLink {
  profileId: string;
  /** The Academy's own made-up id for the player; never a name. */
  playerId: string;
  lastImportAt: string | null;
}

export const SKY_STATES = [
  'clear',
  'partly',
  'cloudy',
  'fog',
  'drizzle',
  'rain',
  'storm',
  'snow',
  'wind',
] as const;
export type SkyState = (typeof SKY_STATES)[number];

export interface Weather {
  state: SkyState;
  /** In the household's chosen units, rounded. */
  temperature: number | null;
  units: 'us' | 'metric';
  /** When the weather service made this reading or forecast. */
  at: string;
  /** True when the service could not be reached and this is the last thing it said. */
  stale: boolean;
}

export interface Milestone {
  id: string;
  date: LocalDate;
  title: string;
  picture: ActionPictureId | RewardPictureId | DayPictureId | null;
  profileId: string | null;
}

/** What a screen is allowed to do, decided by the server from the session — never from who is "selected". */
export const ACCESS_LEVELS = ['child', 'household', 'guardian', 'owner'] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export interface Viewer {
  kind: 'device' | 'guardian';
  access: AccessLevel;
  /** The guardian signed in, or the one who unlocked the wall. */
  userId: string | null;
  deviceId: string | null;
  /** When the wall's grown-ups area locks itself again. */
  unlockedUntil: string | null;
}

/**
 * Everything a screen needs, as of one revision of the household. A screen replaces what it had with this; there
 * is nothing to merge and so nothing to merge wrongly.
 */
export interface Snapshot {
  rev: number;
  serverTime: string;
  /** The calendar day where the family lives. */
  today: LocalDate;
  viewer: Viewer;
  household: {
    id: string;
    name: string;
    timeZone: string;
    settings: HouseholdSettings;
    demo: boolean;
  };
  profiles: Profile[];
  wallets: Wallet[];
  occurrences: Occurrence[];
  routines: Routine[];
  runs: RoutineRun[];
  rewards: Reward[];
  redemptions: Redemption[];
  goals: Goal[];
  lists: ShoppingList[];
  items: ShoppingItem[];
  calendar: CalendarDay[];
  media: MediaItem[];
  /** Guardians' pictures and names, for the wall's "which grown-up?" */
  members: Member[];
  // --- grown-ups only (absent on a wall that is not unlocked) ---
  templates?: TaskTemplate[];
  devices?: Device[];
  academyLinks?: AcademyLink[];
  milestones?: Milestone[];
}

/** Stars needed to reach a level. Level 1 is where everyone starts; each level asks five more than the last. */
export function starsForLevel(level: number): number {
  if (level <= 1) return 0;
  return (5 * (level - 1) * (level + 2)) / 2;
}

/** The level that this many lifetime stars has reached. */
export function levelFor(lifetime: number): number {
  let level = 1;
  while (starsForLevel(level + 1) <= lifetime) level++;
  return level;
}
