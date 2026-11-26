import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { ChecklistStep, RoutineStep } from '../../shared/model.js';
import type { Schedule } from '../../shared/schedule.js';

/**
 * The database, as code. `npm run db:generate` turns a change here into the next SQL migration.
 *
 * Three rules hold everywhere:
 *   - every row that belongs to a family carries `household_id`, and row-level security (migration 0001) lets a
 *     request see only its own household's rows, whatever the query;
 *   - stars are whole numbers, and the ledger of them is only ever added to;
 *   - days are calendar days in the household's own time zone (`date`), instants are `timestamptz`.
 */

/**
 * Everything lives in its own schema, not in `public`. On hosts that publish `public` over an HTTP data API
 * (Supabase does), that alone keeps these tables off it.
 */
export const hb = pgSchema('homebase');

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType() {
    return 'bytea';
  },
});

const id = () => uuid('id').primaryKey();
const householdId = () =>
  uuid('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' });
const createdAt = () => timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow();
const instant = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const day = (name: string) => date(name, { mode: 'string' });

// ---------------------------------------------------------------------------------------------------------------------
// Households, people, devices, sessions
// ---------------------------------------------------------------------------------------------------------------------

export const households = hb.table('households', {
  id: id(),
  name: text('name').notNull(),
  timeZone: text('time_zone').notNull(),
  settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
  /** Counts up with every change to anything in the household. Screens ask "anything after N?". */
  revision: integer('revision').notNull().default(1),
  /** The made-up family of the demo. Demo sign-in only ever opens a household marked so. */
  demo: boolean('demo').notNull().default(false),
  /** The last calendar day the daily housekeeping ran for (retention, allowance). */
  housekeptOn: day('housekept_on'),
  createdAt: createdAt(),
});

/** A grown-up's account. The e-mail address is a sign-in name only: HOMEBASE never sends mail. */
export const users = hb.table(
  'users',
  {
    id: id(),
    email: text('email').notNull(),
    displayName: text('display_name').notNull(),
    avatar: text('avatar').notNull().default('owl'),
    passwordHash: text('password_hash').notNull(),
    createdAt: createdAt(),
    disabledAt: instant('disabled_at'),
  },
  (t) => [uniqueIndex('users_email_key').on(sql`lower(${t.email})`)],
);

export const memberships = hb.table(
  'memberships',
  {
    id: id(),
    householdId: householdId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    /** For unlocking the grown-ups' area on the wall. Hashed like a password. */
    pinHash: text('pin_hash'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('memberships_household_user_key').on(t.householdId, t.userId),
    index('memberships_user_idx').on(t.userId),
    check('memberships_role_check', sql`${t.role} in ('owner', 'guardian', 'caregiver')`),
  ],
);

export const recoveryCodes = hb.table(
  'recovery_codes',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    codeHash: text('code_hash').notNull(),
    usedAt: instant('used_at'),
    createdAt: createdAt(),
  },
  (t) => [index('recovery_codes_user_idx').on(t.userId)],
);

/** One-use, expiring links: an invitation to join a household, or a co-guardian's password reset. */
export const invites = hb.table(
  'invites',
  {
    id: id(),
    householdId: householdId(),
    kind: text('kind').notNull(),
    codeHash: text('code_hash').notNull(),
    role: text('role').notNull().default('guardian'),
    /** For a reset: whose password. */
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    expiresAt: instant('expires_at').notNull(),
    usedAt: instant('used_at'),
    revokedAt: instant('revoked_at'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('invites_code_key').on(t.codeHash),
    index('invites_household_idx').on(t.householdId),
    check('invites_kind_check', sql`${t.kind} in ('join', 'reset')`),
    check('invites_role_check', sql`${t.role} in ('guardian', 'caregiver')`),
  ],
);

export const devices = hb.table(
  'devices',
  {
    id: id(),
    householdId: householdId(),
    name: text('name').notNull(),
    kind: text('kind').notNull().default('wall'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    lastSeenAt: instant('last_seen_at'),
    revokedAt: instant('revoked_at'),
  },
  (t) => [
    index('devices_household_idx').on(t.householdId),
    check('devices_kind_check', sql`${t.kind} in ('wall', 'tablet')`),
  ],
);

/** A signed-in browser. Only a hash of its token is kept. */
export const sessions = hb.table(
  'sessions',
  {
    id: id(),
    tokenHash: text('token_hash').notNull(),
    kind: text('kind').notNull(),
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'cascade' }),
    /** A grown-up who unlocked the wall with their PIN, and until when. */
    unlockedBy: uuid('unlocked_by').references(() => users.id, { onDelete: 'set null' }),
    unlockedUntil: instant('unlocked_until'),
    unlockedAt: instant('unlocked_at'),
    createdAt: createdAt(),
    lastSeenAt: instant('last_seen_at').notNull().defaultNow(),
    expiresAt: instant('expires_at').notNull(),
    revokedAt: instant('revoked_at'),
  },
  (t) => [
    uniqueIndex('sessions_token_key').on(t.tokenHash),
    index('sessions_household_idx').on(t.householdId),
    check('sessions_kind_check', sql`${t.kind} in ('guardian', 'device')`),
    check(
      'sessions_subject_check',
      sql`(${t.kind} = 'guardian' and ${t.userId} is not null and ${t.deviceId} is null) or (${t.kind} = 'device' and ${t.deviceId} is not null and ${t.userId} is null)`,
    ),
  ],
);

/** A wall waiting to be claimed by a signed-in grown-up. Shown as a code and a QR; good once, for ten minutes. */
export const pairCodes = hb.table(
  'pair_codes',
  {
    id: id(),
    codeHash: text('code_hash').notNull(),
    /** Proves that whoever collects the session is the screen that showed the code. */
    secretHash: text('secret_hash').notNull(),
    kind: text('kind').notNull().default('wall'),
    expiresAt: instant('expires_at').notNull(),
    claimedBy: uuid('claimed_by').references(() => users.id, { onDelete: 'cascade' }),
    claimedHousehold: uuid('claimed_household').references(() => households.id, { onDelete: 'cascade' }),
    deviceName: text('device_name'),
    claimedAt: instant('claimed_at'),
    collectedAt: instant('collected_at'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('pair_codes_code_key').on(t.codeHash)],
);

/** Attempts in a window, for slowing down guessing (sign-in, PIN, codes, tokens). */
export const rateLimits = hb.table(
  'rate_limits',
  {
    key: text('key').notNull(),
    windowStart: instant('window_start').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

/** A narrow, revocable key for Apple Shortcuts: it can add to the shopping list and nothing else. */
export const shortcutTokens = hb.table(
  'shortcut_tokens',
  {
    id: id(),
    householdId: householdId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    tokenHash: text('token_hash').notNull(),
    createdAt: createdAt(),
    lastUsedAt: instant('last_used_at'),
    revokedAt: instant('revoked_at'),
  },
  (t) => [
    uniqueIndex('shortcut_tokens_token_key').on(t.tokenHash),
    index('shortcut_tokens_household_idx').on(t.householdId),
  ],
);

/**
 * Every change a screen has asked for, by the id the screen gave it. Asking twice — a double tap, a retry after
 * a lost reply, a phone coming back online — finds the first answer here and does nothing again.
 */
export const operations = hb.table(
  'operations',
  {
    householdId: householdId(),
    opId: uuid('op_id').notNull(),
    type: text('type').notNull(),
    status: text('status').notNull(),
    result: jsonb('result').$type<Record<string, unknown>>().notNull().default({}),
    actor: text('actor').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.householdId, t.opId] }),
    index('operations_created_idx').on(t.householdId, t.createdAt),
  ],
);

// ---------------------------------------------------------------------------------------------------------------------
// Children
// ---------------------------------------------------------------------------------------------------------------------

/** A child: a nickname, a picture and an age band. Nothing else about them is asked for or kept. */
export const profiles = hb.table(
  'profiles',
  {
    id: id(),
    householdId: householdId(),
    nickname: text('nickname').notNull(),
    avatar: text('avatar').notNull(),
    ageBand: text('age_band').notNull(),
    independent: boolean('independent').notNull().default(true),
    sort: integer('sort').notNull().default(0),
    prefs: jsonb('prefs').$type<Record<string, unknown>>().notNull().default({}),
    archivedAt: instant('archived_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('profiles_household_idx').on(t.householdId),
    check('profiles_age_band_check', sql`${t.ageBand} in ('baby', 'toddler', 'preschool', 'early', 'older')`),
  ],
);

// ---------------------------------------------------------------------------------------------------------------------
// QUEST
// ---------------------------------------------------------------------------------------------------------------------

export const taskTemplates = hb.table(
  'task_templates',
  {
    id: id(),
    householdId: householdId(),
    status: text('status').notNull().default('active'),
    version: integer('version').notNull().default(1),
    sort: integer('sort').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('task_templates_household_idx').on(t.householdId),
    check('task_templates_status_check', sql`${t.status} in ('active', 'paused', 'archived')`),
  ],
);

/** What a mission said at each edit. Never changed once written: yesterday's mission keeps yesterday's words. */
export const taskTemplateVersions = hb.table(
  'task_template_versions',
  {
    templateId: uuid('template_id')
      .notNull()
      .references(() => taskTemplates.id, { onDelete: 'cascade' }),
    householdId: householdId(),
    version: integer('version').notNull(),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    picture: text('picture').notNull(),
    say: text('say'),
    steps: jsonb('steps').$type<ChecklistStep[]>().notNull().default([]),
    schedule: jsonb('schedule').$type<Schedule>().notNull(),
    assignees: uuid('assignees')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    shared: boolean('shared').notNull().default(false),
    stars: integer('stars').notNull(),
    effort: integer('effort').notNull().default(1),
    verification: text('verification').notNull(),
    skip: text('skip').notNull().default('child'),
    needsAdult: boolean('needs_adult').notNull().default(false),
    timerSeconds: integer('timer_seconds'),
    createdBy: text('created_by').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.templateId, t.version] }),
    index('task_template_versions_household_idx').on(t.householdId),
    check('task_template_versions_kind_check', sql`${t.kind} in ('core', 'bonus')`),
    check('task_template_versions_verification_check', sql`${t.verification} in ('auto', 'guardian')`),
    check('task_template_versions_skip_check', sql`${t.skip} in ('child', 'grownup', 'off')`),
    check('task_template_versions_stars_check', sql`${t.stars} between 0 and 100`),
    check('task_template_versions_effort_check', sql`${t.effort} between 1 and 3`),
  ],
);

/**
 * One mission for one child (or the family) on one calendar day. The unique index is what makes a day's missions
 * appear exactly once however many screens open at midnight.
 */
export const taskOccurrences = hb.table(
  'task_occurrences',
  {
    id: id(),
    householdId: householdId(),
    templateId: uuid('template_id')
      .notNull()
      .references(() => taskTemplates.id, { onDelete: 'cascade' }),
    templateVersion: integer('template_version').notNull(),
    profileId: uuid('profile_id').references(() => profiles.id, { onDelete: 'cascade' }),
    localDate: day('local_date').notNull(),
    status: text('status').notNull().default('available'),
    stars: integer('stars').notNull(),
    doneBy: uuid('done_by').references(() => profiles.id, { onDelete: 'set null' }),
    startedAt: instant('started_at'),
    submittedAt: instant('submitted_at'),
    decidedAt: instant('decided_at'),
    decidedBy: text('decided_by'),
    returnReason: text('return_reason'),
    helpAsked: boolean('help_asked').notNull().default(false),
    undoUntil: instant('undo_until'),
    snoozedUntil: instant('snoozed_until'),
    /** The ledger line that gave this mission's stars. Set once. */
    creditTx: uuid('credit_tx'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('task_occurrences_once_key').on(
      t.templateId,
      t.localDate,
      sql`coalesce(${t.profileId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
    ),
    index('task_occurrences_day_idx').on(t.householdId, t.localDate),
    index('task_occurrences_status_idx').on(t.householdId, t.status),
    check(
      'task_occurrences_status_check',
      sql`${t.status} in ('available', 'in_progress', 'submitted', 'approved', 'returned', 'skipped')`,
    ),
    check('task_occurrences_stars_check', sql`${t.stars} between 0 and 100`),
  ],
);

// ---------------------------------------------------------------------------------------------------------------------
// BANK
// ---------------------------------------------------------------------------------------------------------------------

/**
 * A child's stars, as three running totals. They are kept in step with the ledger inside the same transaction as
 * every ledger line, and the checks below make an overdraft impossible to store, whatever the code does.
 */
export const wallets = hb.table(
  'wallets',
  {
    profileId: uuid('profile_id')
      .primaryKey()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    householdId: householdId(),
    available: integer('available').notNull().default(0),
    reserved: integer('reserved').notNull().default(0),
    lifetime: integer('lifetime').notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('wallets_household_idx').on(t.householdId),
    check('wallets_available_check', sql`${t.available} >= 0`),
    check('wallets_reserved_check', sql`${t.reserved} >= 0`),
    check('wallets_lifetime_check', sql`${t.lifetime} >= 0`),
  ],
);

/**
 * The star ledger. Lines are added and never changed (migration 0001 takes away the right to). Each has a key
 * that names what it is for — "the stars for this mission" — so the same thing cannot be paid twice.
 */
export const ledger = hb.table(
  'ledger',
  {
    id: id(),
    householdId: householdId(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    available: integer('available').notNull().default(0),
    reserved: integer('reserved').notNull().default(0),
    lifetime: integer('lifetime').notNull().default(0),
    source: text('source').notNull(),
    sourceId: uuid('source_id'),
    idempotencyKey: text('idempotency_key').notNull(),
    reverses: uuid('reverses'),
    note: text('note'),
    actor: text('actor').notNull(),
    at: instant('at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('ledger_idempotency_key').on(t.householdId, t.idempotencyKey),
    index('ledger_profile_idx').on(t.profileId, t.at),
    check(
      'ledger_kind_check',
      sql`${t.kind} in ('grant', 'reserve', 'release', 'spend', 'refund', 'correction')`,
    ),
    check(
      'ledger_source_check',
      sql`${t.source} in ('task', 'routine', 'academy', 'bonus', 'allowance', 'redemption', 'correction')`,
    ),
    // Each kind of line may only move the totals the way that kind means.
    check(
      'ledger_shape_check',
      sql`case ${t.kind}
            when 'grant' then ${t.available} >= 0 and ${t.reserved} = 0 and ${t.lifetime} >= 0
            when 'reserve' then ${t.available} < 0 and ${t.reserved} = -${t.available} and ${t.lifetime} = 0
            when 'release' then ${t.available} > 0 and ${t.reserved} = -${t.available} and ${t.lifetime} = 0
            when 'spend' then ${t.available} = 0 and ${t.reserved} < 0 and ${t.lifetime} = 0
            when 'refund' then ${t.available} > 0 and ${t.reserved} = 0 and ${t.lifetime} = 0
            else ${t.reserved} = 0
          end`,
    ),
  ],
);

export const rewards = hb.table(
  'rewards',
  {
    id: id(),
    householdId: householdId(),
    status: text('status').notNull().default('active'),
    version: integer('version').notNull().default(1),
    title: text('title').notNull(),
    picture: text('picture').notNull(),
    say: text('say'),
    price: integer('price').notNull(),
    stock: integer('stock'),
    profiles: uuid('profiles')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    sort: integer('sort').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('rewards_household_idx').on(t.householdId),
    check('rewards_status_check', sql`${t.status} in ('active', 'paused', 'archived')`),
    check('rewards_price_check', sql`${t.price} between 1 and 1000`),
    check('rewards_stock_check', sql`${t.stock} is null or ${t.stock} >= 0`),
  ],
);

export const redemptions = hb.table(
  'redemptions',
  {
    id: id(),
    householdId: householdId(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    rewardId: uuid('reward_id')
      .notNull()
      .references(() => rewards.id, { onDelete: 'cascade' }),
    rewardVersion: integer('reward_version').notNull(),
    title: text('title').notNull(),
    picture: text('picture').notNull(),
    price: integer('price').notNull(),
    status: text('status').notNull().default('requested'),
    requestedAt: instant('requested_at').notNull().defaultNow(),
    decidedAt: instant('decided_at'),
    decidedBy: text('decided_by'),
    declineReason: text('decline_reason'),
    fulfilledAt: instant('fulfilled_at'),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('redemptions_household_idx').on(t.householdId, t.status),
    check(
      'redemptions_status_check',
      sql`${t.status} in ('requested', 'approved', 'declined', 'cancelled', 'fulfilled', 'refunded')`,
    ),
    check('redemptions_price_check', sql`${t.price} > 0`),
  ],
);

export const goals = hb.table('goals', {
  profileId: uuid('profile_id')
    .primaryKey()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  householdId: householdId(),
  rewardId: uuid('reward_id')
    .notNull()
    .references(() => rewards.id, { onDelete: 'cascade' }),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------------------------------------------------
// ROUTINES
// ---------------------------------------------------------------------------------------------------------------------

export const routines = hb.table(
  'routines',
  {
    id: id(),
    householdId: householdId(),
    status: text('status').notNull().default('active'),
    version: integer('version').notNull().default(1),
    sort: integer('sort').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('routines_household_idx').on(t.householdId),
    check('routines_status_check', sql`${t.status} in ('active', 'paused', 'archived')`),
  ],
);

export const routineVersions = hb.table(
  'routine_versions',
  {
    routineId: uuid('routine_id')
      .notNull()
      .references(() => routines.id, { onDelete: 'cascade' }),
    householdId: householdId(),
    version: integer('version').notNull(),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    picture: text('picture').notNull(),
    steps: jsonb('steps').$type<RoutineStep[]>().notNull(),
    assignees: uuid('assignees')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    days: integer('days').array().notNull(),
    startTime: text('start_time'),
    endTime: text('end_time'),
    skip: text('skip').notNull().default('grownup'),
    createdBy: text('created_by').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.routineId, t.version] }),
    index('routine_versions_household_idx').on(t.householdId),
    check('routine_versions_skip_check', sql`${t.skip} in ('child', 'grownup', 'off')`),
  ],
);

/** One child's go at one routine on one day. There is one, however many times it is opened. */
export const routineRuns = hb.table(
  'routine_runs',
  {
    id: id(),
    householdId: householdId(),
    routineId: uuid('routine_id')
      .notNull()
      .references(() => routines.id, { onDelete: 'cascade' }),
    routineVersion: integer('routine_version').notNull(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    localDate: day('local_date').notNull(),
    status: text('status').notNull().default('active'),
    startedAt: instant('started_at').notNull(),
    completedAt: instant('completed_at'),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('routine_runs_once_key').on(t.routineId, t.profileId, t.localDate),
    index('routine_runs_day_idx').on(t.householdId, t.localDate),
    check('routine_runs_status_check', sql`${t.status} in ('active', 'suspended', 'completed')`),
  ],
);

/** What happened to each step, to the minute. One row for each step and kind: tapping twice changes nothing. */
export const routineStepEvents = hb.table(
  'routine_step_events',
  {
    runId: uuid('run_id')
      .notNull()
      .references(() => routineRuns.id, { onDelete: 'cascade' }),
    householdId: householdId(),
    stepId: uuid('step_id').notNull(),
    kind: text('kind').notNull(),
    at: instant('at').notNull(),
    actor: text('actor').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.runId, t.stepId, t.kind] }),
    index('routine_step_events_household_idx').on(t.householdId),
    check('routine_step_events_kind_check', sql`${t.kind} in ('done', 'together', 'skipped', 'help')`),
  ],
);

// ---------------------------------------------------------------------------------------------------------------------
// TO BUY
// ---------------------------------------------------------------------------------------------------------------------

export const shoppingLists = hb.table(
  'shopping_lists',
  {
    id: id(),
    householdId: householdId(),
    name: text('name').notNull(),
    kind: text('kind').notNull().default('groceries'),
    sort: integer('sort').notNull().default(0),
    archivedAt: instant('archived_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('shopping_lists_household_idx').on(t.householdId),
    check('shopping_lists_kind_check', sql`${t.kind} in ('groceries', 'general')`),
  ],
);

export const shoppingItems = hb.table(
  'shopping_items',
  {
    id: id(),
    householdId: householdId(),
    listId: uuid('list_id')
      .notNull()
      .references(() => shoppingLists.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    /** The text folded for comparing: lower case, no punctuation, singular. */
    normalized: text('normalized').notNull(),
    picture: text('picture').notNull().default('other'),
    category: text('category').notNull().default('other'),
    quantity: integer('quantity'),
    unit: text('unit'),
    note: text('note'),
    url: text('url'),
    store: text('store'),
    priority: boolean('priority').notNull().default(false),
    status: text('status').notNull().default('needed'),
    requestedBy: uuid('requested_by').references(() => profiles.id, { onDelete: 'set null' }),
    addedBy: text('added_by').notNull(),
    alsoAsked: integer('also_asked').notNull().default(0),
    /** A counter for each field, so that two phones editing different fields both keep their change. */
    fieldVersions: jsonb('field_versions').$type<Record<string, number>>().notNull().default({}),
    checkedAt: instant('checked_at'),
    checkedBy: text('checked_by'),
    archivedAt: instant('archived_at'),
    deletedAt: instant('deleted_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('shopping_items_list_idx').on(t.householdId, t.listId, t.status),
    index('shopping_items_normalized_idx').on(t.householdId, t.normalized),
    check('shopping_items_status_check', sql`${t.status} in ('needed', 'checked', 'requested', 'declined')`),
    check('shopping_items_quantity_check', sql`${t.quantity} is null or ${t.quantity} between 1 and 999`),
  ],
);

/** Who changed what on the list, and what it said before. */
export const shoppingItemHistory = hb.table(
  'shopping_item_history',
  {
    id: id(),
    householdId: householdId(),
    itemId: uuid('item_id')
      .notNull()
      .references(() => shoppingItems.id, { onDelete: 'cascade' }),
    at: instant('at').notNull().defaultNow(),
    actor: text('actor').notNull(),
    change: text('change').notNull(),
    before: jsonb('before').$type<Record<string, unknown>>(),
    after: jsonb('after').$type<Record<string, unknown>>(),
  },
  (t) => [
    index('shopping_item_history_item_idx').on(t.itemId, t.at),
    index('shopping_item_history_household_idx').on(t.householdId, t.at),
  ],
);

// ---------------------------------------------------------------------------------------------------------------------
// Academy, calendar, photos, weather
// ---------------------------------------------------------------------------------------------------------------------

/** Which Academy player is which child — only where a grown-up has said so. */
export const academyLinks = hb.table(
  'academy_links',
  {
    profileId: uuid('profile_id')
      .primaryKey()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    householdId: householdId(),
    playerId: text('player_id').notNull(),
    consentBy: uuid('consent_by').references(() => users.id, { onDelete: 'set null' }),
    consentAt: instant('consent_at').notNull(),
    lastImportAt: instant('last_import_at'),
  },
  (t) => [uniqueIndex('academy_links_player_key').on(t.householdId, t.playerId)],
);

/** One Academy sitting, as a total: which world, how many tries, how many with help. No answers, no times per item. */
export const academySessions = hb.table(
  'academy_sessions',
  {
    householdId: householdId(),
    /** The Academy's own id for the sitting: importing the same file twice adds nothing. */
    sessionId: text('session_id').notNull(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    world: text('world').notNull(),
    lessonId: text('lesson_id').notNull(),
    localDate: day('local_date').notNull(),
    completed: boolean('completed').notNull(),
    attempts: integer('attempts').notNull().default(0),
    independent: integer('independent').notNull().default(0),
    supported: integer('supported').notNull().default(0),
    creditTx: uuid('credit_tx'),
    importedAt: instant('imported_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.householdId, t.sessionId] }),
    index('academy_sessions_profile_idx').on(t.profileId, t.localDate),
  ],
);

/** A connection a grown-up made to an outside service. Its secret is stored encrypted, never in the clear. */
export const connections = hb.table(
  'connections',
  {
    id: id(),
    householdId: householdId(),
    provider: text('provider').notNull(),
    label: text('label').notNull(),
    secret: text('secret'),
    config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
    status: text('status').notNull().default('ok'),
    lastSyncAt: instant('last_sync_at'),
    lastError: text('last_error'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    index('connections_household_idx').on(t.householdId),
    check('connections_provider_check', sql`${t.provider} in ('calendar_ics')`),
  ],
);

/** How a grown-up wants calendar entries shown to children: a word to look for, and the picture it becomes. */
export const calendarRules = hb.table(
  'calendar_rules',
  {
    id: id(),
    householdId: householdId(),
    match: text('match').notNull(),
    label: text('label').notNull(),
    sort: integer('sort').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('calendar_rules_household_idx').on(t.householdId)],
);

/** A picture for a day. That is all that is kept of a calendar: no titles, places or people. */
export const calendarDays = hb.table(
  'calendar_days',
  {
    householdId: householdId(),
    localDate: day('local_date').notNull(),
    label: text('label').notNull(),
    /** `manual` when a grown-up set it by hand, otherwise the connection it came from. */
    source: text('source').notNull().default('manual'),
  },
  (t) => [primaryKey({ columns: [t.householdId, t.localDate, t.label, t.source] })],
);

export const media = hb.table(
  'media',
  {
    id: id(),
    householdId: householdId(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    widths: integer('widths').array().notNull(),
    bytes: integer('bytes').notNull(),
    inSlideshow: boolean('in_slideshow').notNull().default(true),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    deletedAt: instant('deleted_at'),
  },
  (t) => [index('media_household_idx').on(t.householdId)],
);

export const mediaBlobs = hb.table(
  'media_blobs',
  {
    mediaId: uuid('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    householdId: householdId(),
    width: integer('width').notNull(),
    contentType: text('content_type').notNull(),
    data: bytea('data').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.mediaId, t.width] }),
    index('media_blobs_household_idx').on(t.householdId),
  ],
);

/** The last thing the weather service said, so the wall can ask often and the service is asked seldom. */
export const weatherCache = hb.table('weather_cache', {
  householdId: uuid('household_id')
    .primaryKey()
    .references(() => households.id, { onDelete: 'cascade' }),
  /** Which place it is for; a changed location makes it stale at once. */
  place: text('place').notNull(),
  state: text('state').notNull(),
  temperatureC: integer('temperature_c'),
  observedAt: instant('observed_at').notNull(),
  fetchedAt: instant('fetched_at').notNull(),
  failures: integer('failures').notNull().default(0),
});

// ---------------------------------------------------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------------------------------------------------

/**
 * What happened, for the family's own look back: a mission done, a step skipped, a reward chosen. Coarse on
 * purpose — the minute, the child, the thing — and thinned out by the household's own retention setting.
 */
export const events = hb.table(
  'events',
  {
    id: id(),
    householdId: householdId(),
    at: instant('at').notNull(),
    localDate: day('local_date').notNull(),
    kind: text('kind').notNull(),
    profileId: uuid('profile_id').references(() => profiles.id, { onDelete: 'cascade' }),
    subjectId: uuid('subject_id'),
    data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
    actor: text('actor').notNull(),
  },
  (t) => [
    index('events_day_idx').on(t.householdId, t.localDate),
    index('events_kind_idx').on(t.householdId, t.kind, t.localDate),
  ],
);

/** Weekly totals, kept after the day-by-day records have gone. */
export const weeklyTotals = hb.table(
  'weekly_totals',
  {
    householdId: householdId(),
    weekStart: day('week_start').notNull(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    metric: text('metric').notNull(),
    value: integer('value').notNull(),
  },
  (t) => [primaryKey({ columns: [t.householdId, t.weekStart, t.profileId, t.metric] })],
);

/** Who did what to the household's set-up: signing in, pairing a screen, changing a role, exporting, deleting. */
export const audit = hb.table(
  'audit',
  {
    id: id(),
    householdId: householdId(),
    at: instant('at').notNull().defaultNow(),
    action: text('action').notNull(),
    actor: text('actor').notNull(),
    detail: jsonb('detail').$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [index('audit_household_idx').on(t.householdId, t.at)],
);

/** A family's own notes of things worth remembering. Written by grown-ups, shown to grown-ups. */
export const milestones = hb.table(
  'milestones',
  {
    id: id(),
    householdId: householdId(),
    localDate: day('local_date').notNull(),
    title: text('title').notNull(),
    picture: text('picture'),
    profileId: uuid('profile_id').references(() => profiles.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('milestones_household_idx').on(t.householdId, t.localDate)],
);

/** Earned once, kept for good, worth nothing: a picture for something a child did. */
export const badges = hb.table(
  'badges',
  {
    householdId: householdId(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    badge: text('badge').notNull(),
    earnedOn: day('earned_on').notNull(),
  },
  (t) => [primaryKey({ columns: [t.profileId, t.badge] }), index('badges_household_idx').on(t.householdId)],
);

// ---------------------------------------------------------------------------------------------------------------------
// Optional AI
// ---------------------------------------------------------------------------------------------------------------------

/** What each request to a model cost, so that a spending cap can be kept. No prompt or reply is stored here. */
export const aiUsage = hb.table(
  'ai_usage',
  {
    id: id(),
    householdId: householdId(),
    at: instant('at').notNull().defaultNow(),
    localDate: day('local_date').notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    workflow: text('workflow').notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    /** Thousandths of a cent, so that small requests still add up. */
    costMillicents: integer('cost_millicents').notNull().default(0),
    outcome: text('outcome').notNull(),
  },
  (t) => [index('ai_usage_household_idx').on(t.householdId, t.localDate)],
);

/** A suggestion waiting for a grown-up: what it would change, why, and on what evidence. Nothing applies itself. */
export const aiProposals = hb.table(
  'ai_proposals',
  {
    id: id(),
    householdId: householdId(),
    workflow: text('workflow').notNull(),
    status: text('status').notNull().default('draft'),
    envelope: jsonb('envelope').$type<Record<string, unknown>>().notNull(),
    /** Kept only where the household has asked for transcripts to be kept. */
    transcript: jsonb('transcript').$type<Record<string, unknown>>(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    decidedAt: instant('decided_at'),
  },
  (t) => [
    index('ai_proposals_household_idx').on(t.householdId, t.createdAt),
    check('ai_proposals_status_check', sql`${t.status} in ('draft', 'accepted', 'dismissed')`),
  ],
);

/** Every table whose rows belong to one household. Migration 0001 puts row-level security on each. */
export const HOUSEHOLD_TABLES = [
  'memberships',
  'invites',
  'devices',
  'shortcut_tokens',
  'operations',
  'profiles',
  'task_templates',
  'task_template_versions',
  'task_occurrences',
  'wallets',
  'ledger',
  'rewards',
  'redemptions',
  'goals',
  'routines',
  'routine_versions',
  'routine_runs',
  'routine_step_events',
  'shopping_lists',
  'shopping_items',
  'shopping_item_history',
  'academy_links',
  'academy_sessions',
  'connections',
  'calendar_rules',
  'calendar_days',
  'media',
  'media_blobs',
  'weather_cache',
  'events',
  'weekly_totals',
  'audit',
  'milestones',
  'badges',
  'ai_usage',
  'ai_proposals',
] as const;

/** Tables the app may add to and read, and never change or delete from. */
export const APPEND_ONLY_TABLES = ['ledger', 'audit', 'shopping_item_history'] as const;
