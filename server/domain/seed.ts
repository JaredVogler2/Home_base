import { eq } from 'drizzle-orm';
import type { ActionPictureId } from '../../shared/pictures.js';
import type { Schedule } from '../../shared/schedule.js';
import { DEFAULT_SETTINGS } from '../../shared/settings.js';
import { classifyItem, normalizeItem } from '../../shared/shopping.js';
import { addDays, coarse, instantOf, localDateOf, weekdayOf, type LocalDate } from '../../shared/time.js';
import { hashPassword, hashPin, type HashCost } from '../auth/crypto.js';
import { asSystem, inHousehold, type Database } from '../db/client.js';
import {
  calendarDays,
  events,
  households,
  memberships,
  milestones,
  profiles,
  shoppingItems,
  shoppingLists,
  users,
  wallets,
} from '../db/schema.js';
import { createReward, requestRedemption, setGoal } from './bank.js';
import { makeCtx, readHousehold, SYSTEM_ACTOR, type Ctx } from './context.js';
import { post } from './ledger.js';
import { createTask, listOccurrences, submitOccurrence } from './quest.js';
import { createRoutine } from './routines.js';

/**
 * The Maple Street family: made up, every one of them.
 *
 * This is what a demo shows and what the screenshots in the documents are of. No name, place, photo or habit in
 * it belongs to anybody. The ids are fixed so that a demo that restarts is the same demo, and the "history" is
 * worked out from the calendar by a small formula rather than at random, so that two runs draw the same charts.
 */

export const DEMO = {
  householdId: 'd0d0d0d0-0000-4000-8000-000000000001',
  sam: 'd0d0d0d0-0000-4000-8000-0000000000a1',
  riley: 'd0d0d0d0-0000-4000-8000-0000000000a2',
  jo: 'd0d0d0d0-0000-4000-8000-0000000000a3',
  june: 'd0d0d0d0-0000-4000-8000-0000000000c1',
  milo: 'd0d0d0d0-0000-4000-8000-0000000000c2',
  bea: 'd0d0d0d0-0000-4000-8000-0000000000c3',
  groceries: 'd0d0d0d0-0000-4000-8000-0000000000e1',
  toBuy: 'd0d0d0d0-0000-4000-8000-0000000000e2',
  /** The demo's sign-in details. They open nothing but made-up data, and only where the demo is switched on. */
  password: 'maple-street-demo',
  samEmail: 'sam@maple-street.example',
  rileyEmail: 'riley@maple-street.example',
  joEmail: 'jo@maple-street.example',
  samPin: '2580',
  rileyPin: '1379',
} as const;

const id = (n: number): string => `d0d0d0d0-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;

/** A number from 0 to 99 that depends only on its inputs: the demo's stand-in for chance. */
function chance(...parts: (string | number)[]): number {
  let hash = 2166136261;
  for (const char of parts.join('|')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}

interface SeedTask {
  n: number;
  title: string;
  picture: ActionPictureId;
  kind: 'core' | 'bonus';
  schedule: Schedule;
  who: string[];
  shared?: boolean;
  stars: number;
  effort: 1 | 2 | 3;
  verification: 'auto' | 'guardian';
  needsAdult?: boolean;
  steps?: { picture: ActionPictureId; label: string }[];
  say?: string;
  /** How often it gets done, in a hundred, for the made-up history. */
  rate: number;
}

const TASKS: SeedTask[] = [
  {
    n: 101,
    title: 'Shoes in the basket',
    picture: 'shoes',
    kind: 'core',
    schedule: { kind: 'daily' },
    who: [DEMO.june, DEMO.milo],
    stars: 1,
    effort: 1,
    verification: 'auto',
    rate: 82,
  },
  {
    n: 102,
    title: 'Brush teeth',
    picture: 'toothbrush',
    kind: 'core',
    schedule: { kind: 'daily' },
    who: [DEMO.june, DEMO.milo],
    stars: 1,
    effort: 1,
    verification: 'auto',
    needsAdult: true,
    say: 'Time to brush teeth. A grown-up can help.',
    rate: 90,
  },
  {
    n: 103,
    title: 'Blocks away',
    picture: 'blocks',
    kind: 'core',
    schedule: { kind: 'daily' },
    who: [DEMO.milo],
    stars: 1,
    effort: 1,
    verification: 'auto',
    rate: 64,
  },
  {
    n: 104,
    title: 'Help set the table',
    picture: 'table',
    kind: 'core',
    schedule: { kind: 'weekdays' },
    who: [DEMO.june],
    stars: 2,
    effort: 2,
    verification: 'guardian',
    steps: [
      { picture: 'table', label: 'Plates' },
      { picture: 'cup', label: 'Cups' },
      { picture: 'wipe', label: 'Napkins' },
    ],
    rate: 70,
  },
  {
    n: 105,
    title: 'Feed the cat',
    picture: 'pet',
    kind: 'core',
    schedule: { kind: 'daily' },
    who: [DEMO.june],
    stars: 1,
    effort: 1,
    verification: 'auto',
    rate: 88,
  },
  {
    n: 106,
    title: 'Bring the laundry',
    picture: 'laundry',
    kind: 'core',
    schedule: { kind: 'weekly', days: [6] },
    who: [],
    shared: true,
    stars: 2,
    effort: 2,
    verification: 'guardian',
    rate: 75,
  },
  {
    n: 107,
    title: 'Water the plants',
    picture: 'plant',
    kind: 'bonus',
    schedule: { kind: 'flexible', timesPerWeek: 2 },
    who: [DEMO.june, DEMO.milo],
    stars: 2,
    effort: 2,
    verification: 'auto',
    rate: 30,
  },
  {
    n: 108,
    title: 'Books on the shelf',
    picture: 'books',
    kind: 'bonus',
    schedule: { kind: 'daily' },
    who: [DEMO.june, DEMO.milo],
    stars: 1,
    effort: 1,
    verification: 'auto',
    rate: 45,
  },
  {
    n: 109,
    title: 'A kind thing',
    picture: 'kind',
    kind: 'bonus',
    schedule: { kind: 'flexible', timesPerWeek: 3 },
    who: [DEMO.june, DEMO.milo],
    stars: 2,
    effort: 2,
    verification: 'guardian',
    say: 'Do something kind for someone.',
    rate: 22,
  },
];

const REWARDS = [
  { n: 201, title: 'Pick the story', picture: 'storypick', price: 5 },
  { n: 202, title: 'New stickers', picture: 'stickers', price: 8, stock: 6 },
  { n: 203, title: 'Family game', picture: 'game', price: 10 },
  { n: 204, title: 'Bake together', picture: 'baking', price: 15 },
  { n: 205, title: 'Playground trip', picture: 'park', price: 20 },
  { n: 206, title: 'Movie night', picture: 'movie', price: 30 },
] as const;

interface SeedStep {
  title: string;
  picture: ActionPictureId;
  seconds?: number;
  needsAdult?: boolean;
  optional?: boolean;
  days?: number[];
  task?: number;
}

const ROUTINES: {
  n: number;
  kind: 'morning' | 'bedtime' | 'leaving' | 'afterschool' | 'cleanup';
  title: string;
  picture: ActionPictureId;
  days: number[];
  start: string | null;
  end: string | null;
  steps: SeedStep[];
}[] = [
  {
    n: 301,
    kind: 'morning',
    title: 'Morning',
    picture: 'wake',
    days: [0, 1, 2, 3, 4, 5, 6],
    start: '06:00',
    end: '09:30',
    steps: [
      { title: 'Wake up', picture: 'wake', seconds: 120 },
      { title: 'Potty', picture: 'potty', seconds: 180 },
      { title: 'Get dressed', picture: 'dress', seconds: 420 },
      { title: 'Breakfast', picture: 'breakfast', seconds: 900 },
      { title: 'Brush teeth', picture: 'toothbrush', seconds: 180, needsAdult: true, task: 102 },
      { title: 'Backpack', picture: 'backpack', seconds: 120, days: [1, 2, 3, 4, 5] },
    ],
  },
  {
    n: 302,
    kind: 'bedtime',
    title: 'Bedtime',
    picture: 'lightsout',
    days: [0, 1, 2, 3, 4, 5, 6],
    start: '18:30',
    end: '20:30',
    steps: [
      { title: 'Bath', picture: 'bath', seconds: 900, needsAdult: true, days: [0, 2, 4] },
      { title: 'Pajamas', picture: 'pajamas', seconds: 300 },
      { title: 'Brush teeth', picture: 'toothbrush', seconds: 180, needsAdult: true },
      { title: 'Story', picture: 'story', seconds: 600 },
      { title: 'Lights out', picture: 'lightsout', seconds: 60 },
    ],
  },
  {
    n: 303,
    kind: 'leaving',
    title: 'Out the door',
    picture: 'car',
    days: [0, 1, 2, 3, 4, 5, 6],
    start: null,
    end: null,
    steps: [
      { title: 'Potty', picture: 'potty', seconds: 180 },
      { title: 'Socks and shoes', picture: 'socks', seconds: 240 },
      { title: 'Coat', picture: 'coat', seconds: 90, optional: true },
      { title: 'Water bottle', picture: 'bottle', seconds: 60 },
      { title: 'To the car', picture: 'car', seconds: 120 },
    ],
  },
  {
    n: 304,
    kind: 'afterschool',
    title: 'Home again',
    picture: 'shoes',
    days: [1, 2, 3, 4, 5],
    start: '15:00',
    end: '17:30',
    steps: [
      { title: 'Shoes in the basket', picture: 'shoes', seconds: 60, task: 101 },
      { title: 'Wash hands', picture: 'hands', seconds: 60 },
      { title: 'Lunch box out', picture: 'lunchbox', seconds: 60 },
      { title: 'Snack', picture: 'snack', seconds: 600 },
    ],
  },
  {
    n: 305,
    kind: 'cleanup',
    title: 'Tidy-up time',
    picture: 'tidy',
    days: [0, 1, 2, 3, 4, 5, 6],
    start: null,
    end: null,
    steps: [
      { title: 'Toys in the box', picture: 'toys', seconds: 240 },
      { title: 'Books on the shelf', picture: 'books', seconds: 120 },
      { title: 'Blocks away', picture: 'blocks', seconds: 180 },
    ],
  },
];

const SHOPPING: {
  list: 'groceries' | 'toBuy';
  text: string;
  quantity?: number;
  status?: 'needed' | 'checked' | 'requested';
  by: string;
  child?: string;
  note?: string;
  priority?: boolean;
}[] = [
  { list: 'groceries', text: 'Milk', by: 'Sam', priority: true },
  { list: 'groceries', text: 'Bananas', quantity: 6, by: 'Riley' },
  { list: 'groceries', text: 'Eggs', quantity: 12, by: 'Sam' },
  { list: 'groceries', text: 'Yogurt', by: 'Riley', note: 'the plain one' },
  { list: 'groceries', text: 'Carrots', by: 'Siri' },
  { list: 'groceries', text: 'Bread', status: 'checked', by: 'Sam' },
  { list: 'groceries', text: 'Cheese', status: 'checked', by: 'Riley' },
  { list: 'groceries', text: 'Berries', status: 'requested', by: 'a child', child: DEMO.milo },
  { list: 'toBuy', text: 'Rain boots, size 9', by: 'Riley', note: 'for Milo' },
  { list: 'toBuy', text: 'Birthday card', by: 'Sam' },
  { list: 'toBuy', text: 'Light bulbs', quantity: 2, by: 'Sam' },
];

export interface SeedOptions {
  now: Date;
  hashCost: HashCost;
  secretKey: string | null;
  /** The Academy's address to show in the demo, where one is allowed. */
  academyUrl: string | null;
}

/** Is the demo family there? */
export async function demoExists(database: Database): Promise<boolean> {
  const rows = await asSystem(database, (tx) =>
    tx.select({ id: households.id }).from(households).where(eq(households.id, DEMO.householdId)).limit(1),
  );
  return rows.length > 0;
}

export async function removeDemo(database: Database): Promise<void> {
  await asSystem(database, async (tx) => {
    await tx.delete(households).where(eq(households.id, DEMO.householdId));
    for (const userId of [DEMO.sam, DEMO.riley, DEMO.jo]) await tx.delete(users).where(eq(users.id, userId));
  });
}

async function seedPast(ctx: Ctx, today: LocalDate, timeZone: string): Promise<void> {
  // Four weeks of an ordinary family: most things done most days, mornings harder on Mondays.
  const eventRows: (typeof events.$inferInsert)[] = [];
  let n = 0;
  const totals = new Map<string, number>([
    [DEMO.june, 0],
    [DEMO.milo, 0],
  ]);
  for (let back = 28; back >= 1; back--) {
    const date = addDays(today, -back);
    const weekday = weekdayOf(date);
    for (const task of TASKS) {
      const offered =
        task.schedule.kind === 'daily' ||
        (task.schedule.kind === 'weekdays' && weekday >= 1 && weekday <= 5) ||
        (task.schedule.kind === 'weekly' && task.schedule.days.includes(weekday)) ||
        task.schedule.kind === 'flexible';
      if (!offered) continue;
      const who = task.shared ? [DEMO.june] : task.who;
      for (const profileId of who) {
        const roll = chance(date, task.n, profileId);
        const at = coarse(instantOf(date, task.kind === 'core' ? '17:40' : '16:10', timeZone));
        if (roll < task.rate) {
          eventRows.push({
            id: id(10_000 + n++),
            householdId: ctx.household.id,
            at,
            localDate: date,
            kind: 'mission.done',
            profileId,
            subjectId: id(task.n),
            data: {
              stars: task.stars,
              effort: task.effort,
              by: task.verification === 'auto' ? 'auto' : 'grownup',
            },
            actor: 'seed',
          });
          totals.set(profileId, (totals.get(profileId) ?? 0) + task.stars);
        } else if (roll > 94 && task.kind === 'core') {
          eventRows.push({
            id: id(10_000 + n++),
            householdId: ctx.household.id,
            at,
            localDate: date,
            kind: 'mission.skipped',
            profileId,
            subjectId: id(task.n),
            data: {},
            actor: 'seed',
          });
        }
      }
    }
    for (const routine of ROUTINES.slice(0, 2)) {
      for (const profileId of [DEMO.june, DEMO.milo]) {
        if (chance(date, routine.n, profileId, 'ran') > 86) continue;
        const steps = routine.steps.filter((step) => !step.days || step.days.includes(weekday));
        const hard = routine.kind === 'morning' && weekday === 1;
        let together = 0;
        let skipped = 0;
        for (const step of steps) {
          const roll = chance(date, routine.n, profileId, step.title);
          const helpRate = (step.needsAdult ? 55 : profileId === DEMO.milo ? 28 : 10) + (hard ? 18 : 0);
          if (roll < helpRate) together++;
          else if (roll > 96) skipped++;
        }
        const planned = steps.reduce((sum, step) => sum + (step.seconds ?? 120), 0) / 60;
        const minutes = Math.round(
          planned * (0.8 + chance(date, routine.n, profileId, 'pace') / 140) + (hard ? 9 : 0),
        );
        const start = routine.kind === 'morning' ? '07:05' : '19:10';
        eventRows.push({
          id: id(10_000 + n++),
          householdId: ctx.household.id,
          at: coarse(instantOf(date, start, timeZone)),
          localDate: date,
          kind: 'routine.completed',
          profileId,
          subjectId: id(routine.n),
          data: {
            steps: steps.length,
            alone: steps.length - together - skipped,
            together,
            skipped,
            helpAsked: together > 2 ? 1 : 0,
            minutes,
            kind: routine.kind,
          },
          actor: 'seed',
        });
      }
    }
    if (weekday === 6) {
      for (const [index, text] of ['milk', 'bread', 'banana', 'egg', 'yogurt'].entries()) {
        eventRows.push({
          id: id(10_000 + n++),
          householdId: ctx.household.id,
          at: coarse(instantOf(date, '10:30', timeZone)),
          localDate: date,
          kind: 'shopping.bought',
          subjectId: id(400 + index),
          data: {
            item: text,
            text,
            category: classifyItem(text).category,
            picture: classifyItem(text).picture,
          },
          actor: 'seed',
        });
      }
    }
  }
  for (let start = 0; start < eventRows.length; start += 200) {
    await ctx.tx.insert(events).values(eventRows.slice(start, start + 200));
  }
  // What all that would have earned, as one opening line each; then a little spending.
  for (const [profileId, stars] of totals) {
    await post(ctx, {
      profileId,
      kind: 'grant',
      available: stars,
      lifetime: stars,
      source: 'task',
      key: `seed:opening:${profileId}`,
      note: 'Stars earned before today',
      actor: 'seed',
    });
  }
  const spent: [string, number, string][] = [
    [DEMO.june, 20, 'Playground trip'],
    [DEMO.june, 10, 'Family game'],
    [DEMO.june, 15, 'Bake together'],
    [DEMO.milo, 8, 'New stickers'],
    [DEMO.milo, 5, 'Pick the story'],
    [DEMO.milo, 10, 'Family game'],
  ];
  for (const [index, [profileId, price, title]] of spent.entries()) {
    const balance = await ctx.tx
      .select({ available: wallets.available })
      .from(wallets)
      .where(eq(wallets.profileId, profileId))
      .limit(1);
    if ((balance[0]?.available ?? 0) < price + 6) continue;
    await post(ctx, {
      profileId,
      kind: 'reserve',
      available: -price,
      reserved: price,
      source: 'redemption',
      key: `seed:spend:${index}:reserve`,
      note: title,
      actor: 'seed',
    });
    await post(ctx, {
      profileId,
      kind: 'spend',
      reserved: -price,
      source: 'redemption',
      key: `seed:spend:${index}:spend`,
      note: title,
      actor: 'seed',
    });
  }
}

/** Build the Maple Street family in an empty corner of the database. Does nothing if they are already there. */
export async function seedDemo(database: Database, options: SeedOptions): Promise<boolean> {
  if (await demoExists(database)) return false;
  const { now } = options;
  const timeZone = 'America/Chicago';
  const today = localDateOf(now, timeZone);
  const passwordHash = await hashPassword(DEMO.password, options.hashCost);
  const samPin = await hashPin(DEMO.samPin, options.secretKey, options.hashCost);
  const rileyPin = await hashPin(DEMO.rileyPin, options.secretKey, options.hashCost);

  await asSystem(database, async (tx) => {
    await tx.insert(households).values({
      id: DEMO.householdId,
      name: 'Maple Street',
      timeZone,
      demo: true,
      settings: {
        ...DEFAULT_SETTINGS,
        // A made-up place in the middle of the country, so the demo's sun rises at a believable time.
        location: { lat: 39.1, lon: -94.58, label: 'Demo town' },
        academy: {
          ...DEFAULT_SETTINGS.academy,
          enabled: options.academyUrl !== null,
          url: options.academyUrl,
        },
      } as unknown as Record<string, unknown>,
      createdAt: now,
    });
    await tx.insert(users).values([
      { id: DEMO.sam, email: DEMO.samEmail, displayName: 'Sam', avatar: 'owl', passwordHash, createdAt: now },
      {
        id: DEMO.riley,
        email: DEMO.rileyEmail,
        displayName: 'Riley',
        avatar: 'otter',
        passwordHash,
        createdAt: now,
      },
      {
        id: DEMO.jo,
        email: DEMO.joEmail,
        displayName: 'Grandma Jo',
        avatar: 'hedgehog',
        passwordHash,
        createdAt: now,
      },
    ]);
    await tx.insert(memberships).values([
      {
        id: id(1),
        householdId: DEMO.householdId,
        userId: DEMO.sam,
        role: 'owner',
        pinHash: samPin,
        createdAt: now,
      },
      {
        id: id(2),
        householdId: DEMO.householdId,
        userId: DEMO.riley,
        role: 'guardian',
        pinHash: rileyPin,
        createdAt: new Date(now.getTime() + 1),
      },
      {
        id: id(3),
        householdId: DEMO.householdId,
        userId: DEMO.jo,
        role: 'caregiver',
        createdAt: new Date(now.getTime() + 2),
      },
    ]);
  });

  await inHousehold(database, DEMO.householdId, async (tx) => {
    const household = await readHousehold(tx, DEMO.householdId);
    if (!household) throw new Error('demo household vanished');
    const ctx = makeCtx(tx, household, { ...SYSTEM_ACTOR, name: 'seed', userId: DEMO.sam }, now);

    await tx.insert(profiles).values([
      {
        id: DEMO.june,
        householdId: DEMO.householdId,
        nickname: 'June',
        avatar: 'fox',
        ageBand: 'early',
        independent: true,
        sort: 1,
        prefs: { showNumbers: true },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: DEMO.milo,
        householdId: DEMO.householdId,
        nickname: 'Milo',
        avatar: 'bear',
        ageBand: 'preschool',
        independent: true,
        sort: 2,
        prefs: { showNumbers: false },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: DEMO.bea,
        householdId: DEMO.householdId,
        nickname: 'Bea',
        avatar: 'bunny',
        ageBand: 'baby',
        independent: false,
        sort: 3,
        prefs: { showNumbers: false },
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await tx.insert(wallets).values([
      { profileId: DEMO.june, householdId: DEMO.householdId },
      { profileId: DEMO.milo, householdId: DEMO.householdId },
      { profileId: DEMO.bea, householdId: DEMO.householdId },
    ]);

    await seedPast(ctx, today, timeZone);

    for (const task of TASKS) {
      await createTask(ctx, {
        templateId: id(task.n),
        kind: task.kind,
        title: task.title,
        picture: task.picture,
        say: task.say ?? null,
        steps: (task.steps ?? []).map((step, index) => ({ id: id(task.n * 100 + index), ...step })),
        schedule: task.schedule,
        assignees: task.who,
        shared: task.shared ?? false,
        stars: task.stars,
        effort: task.effort,
        verification: task.verification,
        skip: task.kind === 'bonus' ? 'child' : 'grownup',
        needsAdult: task.needsAdult ?? false,
        timerSeconds: task.picture === 'toothbrush' ? 120 : null,
      });
    }
    for (const routine of ROUTINES) {
      await createRoutine(ctx, {
        routineId: id(routine.n),
        kind: routine.kind,
        title: routine.title,
        picture: routine.picture,
        steps: routine.steps.map((step, index) => ({
          id: id(routine.n * 100 + index),
          title: step.title,
          picture: step.picture,
          say: null,
          seconds: step.seconds ?? null,
          needsAdult: step.needsAdult ?? false,
          optional: step.optional ?? false,
          days: step.days ?? null,
          taskId: step.task ? id(step.task) : null,
        })),
        assignees: [],
        days: routine.days,
        start: routine.start,
        end: routine.end,
        skip: 'grownup',
      });
    }
    for (const reward of REWARDS) {
      await createReward(ctx, {
        rewardId: id(reward.n),
        title: reward.title,
        picture: reward.picture,
        say: null,
        price: reward.price,
        stock: 'stock' in reward ? reward.stock : null,
        profiles: [],
      });
    }

    await tx.insert(shoppingLists).values([
      {
        id: DEMO.groceries,
        householdId: DEMO.householdId,
        name: 'Groceries',
        kind: 'groceries',
        sort: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: DEMO.toBuy,
        householdId: DEMO.householdId,
        name: 'To buy',
        kind: 'general',
        sort: 2,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await tx.insert(shoppingItems).values(
      SHOPPING.map((item, index) => {
        const guess = classifyItem(item.text);
        const at = new Date(now.getTime() - (SHOPPING.length - index) * 37 * 60_000);
        return {
          id: id(500 + index),
          householdId: DEMO.householdId,
          listId: item.list === 'groceries' ? DEMO.groceries : DEMO.toBuy,
          text: item.text,
          normalized: normalizeItem(item.text),
          picture: guess.picture,
          category: guess.category,
          quantity: item.quantity ?? null,
          note: item.note ?? null,
          priority: item.priority ?? false,
          status: item.status ?? 'needed',
          requestedBy: item.child ?? null,
          addedBy: item.by,
          checkedAt: item.status === 'checked' ? at : null,
          checkedBy: item.status === 'checked' ? item.by : null,
          createdAt: at,
          updatedAt: at,
        };
      }),
    );

    await tx.insert(calendarDays).values([
      {
        householdId: DEMO.householdId,
        localDate: today,
        label: weekdayOf(today) === 0 || weekdayOf(today) === 6 ? 'homeday' : 'school',
        source: 'manual',
      },
      { householdId: DEMO.householdId, localDate: addDays(today, 1), label: 'sports', source: 'manual' },
      { householdId: DEMO.householdId, localDate: addDays(today, 2), label: 'library', source: 'manual' },
      { householdId: DEMO.householdId, localDate: addDays(today, 3), label: 'visitor', source: 'manual' },
      { householdId: DEMO.householdId, localDate: addDays(today, 5), label: 'birthday', source: 'manual' },
    ]);
    await tx.insert(milestones).values([
      {
        id: id(601),
        householdId: DEMO.householdId,
        localDate: addDays(today, -19),
        title: 'Put shoes on all by himself',
        picture: 'socks',
        profileId: DEMO.milo,
        createdBy: DEMO.riley,
        createdAt: now,
      },
      {
        id: id(602),
        householdId: DEMO.householdId,
        localDate: addDays(today, -8),
        title: 'Read a whole page aloud',
        picture: 'story',
        profileId: DEMO.june,
        createdBy: DEMO.sam,
        createdAt: now,
      },
      {
        id: id(603),
        householdId: DEMO.householdId,
        localDate: addDays(today, -3),
        title: 'First picnic of the year',
        picture: 'picnic',
        profileId: null,
        createdBy: DEMO.sam,
        createdAt: now,
      },
    ]);

    // Today, as it might look at tea time: a mission or two done, one waiting for a grown-up, a reward asked for.
    const todays = await listOccurrences(ctx);
    const find = (task: number, profileId: string | null) =>
      todays.find((occurrence) => occurrence.templateId === id(task) && occurrence.profileId === profileId);
    const childCtx: Ctx = {
      ...ctx,
      actor: { level: 'child', name: 'wall:Kitchen', userId: null, deviceId: null },
    };
    const done: [number, string][] = [
      [105, DEMO.june],
      [101, DEMO.milo],
      [104, DEMO.june],
    ];
    for (const [task, profileId] of done) {
      const occurrence = find(task, profileId);
      if (occurrence) await submitOccurrence(childCtx, { occurrenceId: occurrence.id, profileId });
    }
    await setGoal(childCtx, { profileId: DEMO.june, rewardId: id(206) });
    await setGoal(childCtx, { profileId: DEMO.milo, rewardId: id(203) });
    const miloStars = await tx
      .select({ available: wallets.available })
      .from(wallets)
      .where(eq(wallets.profileId, DEMO.milo))
      .limit(1);
    if ((miloStars[0]?.available ?? 0) >= 5) {
      await requestRedemption(childCtx, {
        redemptionId: id(701),
        profileId: DEMO.milo,
        rewardId: id(201),
        rewardVersion: 1,
        price: 5,
      });
    }
  });
  return true;
}
