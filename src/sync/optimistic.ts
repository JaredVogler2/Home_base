import type {
  Occurrence,
  Redemption,
  RoutineRun,
  ShoppingItem,
  Snapshot,
  StepState,
} from '../../shared/model';
import type { OpEnvelope, OpInput, OpType } from '../../shared/ops';
import { SHOPPING_PICTURES } from '../../shared/pictures';
import { classifyItem, normalizeItem } from '../../shared/shopping';
import { weekdayOf } from '../../shared/time';

/**
 * What a request will most likely do, shown at once — so that a tap is answered by the screen and not by the
 * network.
 *
 * This is a guess, and it is kept honest in two ways. It never shows the one thing only the server can decide:
 * a mission that was sent is shown as *sent*, never as paid, until the server says the stars were given. And it
 * is thrown away as soon as the server answers: the screen then shows what really happened, whatever that is.
 */

type Reducer<T extends OpType> = (snapshot: Snapshot, input: OpInput<T>, at: string) => Snapshot;

const mapOccurrence = (
  snapshot: Snapshot,
  id: string,
  change: (occurrence: Occurrence) => Occurrence,
): Snapshot => ({
  ...snapshot,
  occurrences: snapshot.occurrences.map((occurrence) =>
    occurrence.id === id ? change(occurrence) : occurrence,
  ),
});

const mapRun = (snapshot: Snapshot, id: string, change: (run: RoutineRun) => RoutineRun): Snapshot => ({
  ...snapshot,
  runs: snapshot.runs.map((run) => (run.id === id ? change(run) : run)),
});

const mapItem = (snapshot: Snapshot, id: string, change: (item: ShoppingItem) => ShoppingItem): Snapshot => ({
  ...snapshot,
  items: snapshot.items.map((item) => (item.id === id ? change(item) : item)),
});

const mapRedemption = (
  snapshot: Snapshot,
  id: string,
  change: (redemption: Redemption) => Redemption,
): Snapshot => ({
  ...snapshot,
  redemptions: snapshot.redemptions.map((redemption) =>
    redemption.id === id ? change(redemption) : redemption,
  ),
});

function moveStars(snapshot: Snapshot, profileId: string, available: number, reserved: number): Snapshot {
  return {
    ...snapshot,
    wallets: snapshot.wallets.map((wallet) =>
      wallet.profileId === profileId
        ? {
            ...wallet,
            available: Math.max(0, wallet.available + available),
            reserved: Math.max(0, wallet.reserved + reserved),
          }
        : wallet,
    ),
  };
}

function finished(run: RoutineRun): boolean {
  return run.steps.every((step) => step.optional || run.done[step.id] !== undefined);
}

const REDUCERS: { [T in OpType]?: Reducer<T> } = {
  'occurrence.start': (snapshot, input) =>
    mapOccurrence(snapshot, input.occurrenceId, (o) =>
      o.status === 'available' || o.status === 'returned' ? { ...o, status: 'in_progress' } : o,
    ),
  'occurrence.submit': (snapshot, input, at) =>
    mapOccurrence(snapshot, input.occurrenceId, (o) =>
      o.status === 'submitted' || o.status === 'approved' || o.status === 'skipped'
        ? o
        : {
            ...o,
            status: 'submitted',
            doneBy: input.profileId,
            submittedAt: at,
            returnReason: null,
            undoUntil: new Date(
              new Date(at).getTime() + snapshot.household.settings.quest.undoSeconds * 1000,
            ).toISOString(),
          },
    ),
  'occurrence.undo': (snapshot, input) =>
    mapOccurrence(snapshot, input.occurrenceId, (o) => ({
      ...o,
      status: 'available',
      doneBy: null,
      submittedAt: null,
      credited: false,
      undoUntil: null,
    })),
  'occurrence.help': (snapshot, input) =>
    mapOccurrence(snapshot, input.occurrenceId, (o) => ({ ...o, helpAsked: true })),
  'occurrence.skip': (snapshot, input) =>
    mapOccurrence(snapshot, input.occurrenceId, (o) => ({ ...o, status: 'skipped' })),
  'occurrence.dismiss': (snapshot, input) =>
    mapOccurrence(snapshot, input.occurrenceId, (o) => ({ ...o, status: 'skipped' })),
  'occurrence.approve': (snapshot, input, at) => ({
    ...snapshot,
    occurrences: snapshot.occurrences.map((o) =>
      input.occurrenceIds.includes(o.id) && o.status === 'submitted'
        ? { ...o, status: 'approved', credited: true, decidedAt: at }
        : o,
    ),
  }),
  'occurrence.return': (snapshot, input) =>
    mapOccurrence(snapshot, input.occurrenceId, (o) => ({
      ...o,
      status: 'returned',
      returnReason: input.reason,
      undoUntil: null,
    })),
  'occurrence.markDone': (snapshot, input, at) =>
    mapOccurrence(snapshot, input.occurrenceId, (o) => ({
      ...o,
      status: 'approved',
      credited: true,
      doneBy: input.profileId,
      decidedAt: at,
    })),

  'run.start': (snapshot, input, at) => {
    if (
      snapshot.runs.some(
        (run) =>
          run.routineId === input.routineId &&
          run.profileId === input.profileId &&
          run.date === snapshot.today,
      )
    ) {
      return snapshot;
    }
    const routine = snapshot.routines.find((candidate) => candidate.id === input.routineId);
    if (!routine) return snapshot;
    const weekday = weekdayOf(snapshot.today);
    return {
      ...snapshot,
      runs: [
        ...snapshot.runs,
        {
          id: input.runId,
          routineId: routine.id,
          routineVersion: routine.version,
          profileId: input.profileId,
          date: snapshot.today,
          status: 'active',
          steps: routine.steps.filter((step) => step.days === null || step.days.includes(weekday)),
          done: {},
          help: [],
          startedAt: at,
          completedAt: null,
        },
      ],
    };
  },
  'run.step': (snapshot, input, at) =>
    mapRun(snapshot, input.runId, (run) => {
      if (input.state === 'help')
        return run.help.includes(input.stepId) ? run : { ...run, help: [...run.help, input.stepId] };
      const done: Record<string, StepState> = { ...run.done };
      if (input.state === 'undo') delete done[input.stepId];
      else done[input.stepId] = input.state;
      const next: RoutineRun = { ...run, done, status: run.status === 'suspended' ? 'active' : run.status };
      if (input.state === 'undo') return { ...next, status: 'active', completedAt: null };
      return finished(next) ? { ...next, status: 'completed', completedAt: at } : next;
    }),
  'run.together': (snapshot, input, at) =>
    mapRun(snapshot, input.runId, (run) => {
      const next: RoutineRun = { ...run, done: { ...run.done, [input.stepId]: 'together' } };
      return finished(next) ? { ...next, status: 'completed', completedAt: at } : next;
    }),
  'run.pause': (snapshot, input) =>
    mapRun(snapshot, input.runId, (run) => (run.status === 'active' ? { ...run, status: 'suspended' } : run)),
  'run.resume': (snapshot, input) =>
    mapRun(snapshot, input.runId, (run) => (run.status === 'suspended' ? { ...run, status: 'active' } : run)),
  'run.finish': (snapshot, input, at) =>
    mapRun(snapshot, input.runId, (run) => ({ ...run, status: 'completed', completedAt: at })),

  'redemption.request': (snapshot, input, at) => {
    const reward = snapshot.rewards.find((candidate) => candidate.id === input.rewardId);
    const wallet = snapshot.wallets.find((candidate) => candidate.profileId === input.profileId);
    if (!reward || !wallet || wallet.available < input.price) return snapshot;
    return {
      ...moveStars(snapshot, input.profileId, -input.price, input.price),
      redemptions: [
        {
          id: input.redemptionId,
          profileId: input.profileId,
          rewardId: reward.id,
          title: reward.title,
          picture: reward.picture,
          price: input.price,
          status: 'requested',
          requestedAt: at,
          decidedAt: null,
          fulfilledAt: null,
          declineReason: null,
        },
        ...snapshot.redemptions,
      ],
      goals: snapshot.goals.filter(
        (goal) => !(goal.profileId === input.profileId && goal.rewardId === reward.id),
      ),
    };
  },
  'redemption.cancel': (snapshot, input) => {
    const found = snapshot.redemptions.find((redemption) => redemption.id === input.redemptionId);
    if (!found || found.status !== 'requested') return snapshot;
    return mapRedemption(moveStars(snapshot, found.profileId, found.price, -found.price), found.id, (r) => ({
      ...r,
      status: 'cancelled',
    }));
  },
  'redemption.decide': (snapshot, input, at) => {
    const found = snapshot.redemptions.find((redemption) => redemption.id === input.redemptionId);
    if (!found || found.status !== 'requested') return snapshot;
    const moved = input.approve
      ? moveStars(snapshot, found.profileId, 0, -found.price)
      : moveStars(snapshot, found.profileId, found.price, -found.price);
    return mapRedemption(moved, found.id, (r) => ({
      ...r,
      status: input.approve ? 'approved' : 'declined',
      decidedAt: at,
      declineReason: input.approve ? null : (input.reason ?? 'later'),
    }));
  },
  'redemption.fulfill': (snapshot, input, at) =>
    mapRedemption(snapshot, input.redemptionId, (r) => ({ ...r, status: 'fulfilled', fulfilledAt: at })),
  'goal.set': (snapshot, input) => ({
    ...snapshot,
    goals: [
      ...snapshot.goals.filter((goal) => goal.profileId !== input.profileId),
      ...(input.rewardId ? [{ profileId: input.profileId, rewardId: input.rewardId }] : []),
    ],
  }),

  'shopping.add': (snapshot, input, at) => {
    const normalized = normalizeItem(input.text);
    const same = snapshot.items.find(
      (item) => item.listId === input.listId && normalizeItem(item.text) === normalized,
    );
    if (same) {
      return mapItem(snapshot, same.id, (item) =>
        item.status === 'checked'
          ? { ...item, status: 'needed', checkedAt: null, quantity: input.quantity, unit: input.unit }
          : { ...item, status: 'needed', alsoAsked: item.alsoAsked + 1 },
      );
    }
    return {
      ...snapshot,
      items: [
        ...snapshot.items,
        {
          id: input.itemId,
          listId: input.listId,
          text: input.text,
          picture: input.picture,
          category: input.category,
          quantity: input.quantity,
          unit: input.unit,
          note: input.note,
          url: input.url,
          store: input.store,
          priority: input.priority,
          status: 'needed',
          requestedBy: null,
          addedBy: '…',
          alsoAsked: 0,
          createdAt: at,
          updatedAt: at,
          checkedAt: null,
        },
      ],
    };
  },
  'shopping.check': (snapshot, input, at) =>
    mapItem(snapshot, input.itemId, (item) =>
      item.status === 'requested' || item.status === 'declined'
        ? item
        : { ...item, status: input.checked ? 'checked' : 'needed', checkedAt: input.checked ? at : null },
    ),
  'shopping.edit': (snapshot, input, at) =>
    mapItem(snapshot, input.itemId, (item) => {
      const next = { ...item, ...input.patch, updatedAt: at };
      if (
        input.patch.text !== undefined &&
        input.patch.category === undefined &&
        input.patch.picture === undefined
      ) {
        Object.assign(next, classifyItem(input.patch.text));
      }
      return next;
    }),
  'shopping.remove': (snapshot, input) => ({
    ...snapshot,
    items: snapshot.items.filter((item) => item.id !== input.itemId),
  }),
  'shopping.clearChecked': (snapshot, input) => ({
    ...snapshot,
    items: snapshot.items.filter((item) => !(item.listId === input.listId && item.status === 'checked')),
  }),
  'shopping.request': (snapshot, input, at) => {
    const list = snapshot.lists.find((candidate) => candidate.kind === 'groceries') ?? snapshot.lists[0];
    if (!list) return snapshot;
    const label = SHOPPING_PICTURES[input.picture].label;
    const same = snapshot.items.find(
      (item) => item.listId === list.id && normalizeItem(item.text) === normalizeItem(label),
    );
    if (same) return mapItem(snapshot, same.id, (item) => ({ ...item, alsoAsked: item.alsoAsked + 1 }));
    return {
      ...snapshot,
      items: [
        ...snapshot.items,
        {
          id: input.itemId,
          listId: list.id,
          text: label,
          picture: input.picture,
          category: classifyItem(label).category,
          quantity: null,
          unit: null,
          note: null,
          url: null,
          store: null,
          priority: false,
          status: 'requested',
          requestedBy: input.profileId,
          addedBy: 'a child',
          alsoAsked: 0,
          createdAt: at,
          updatedAt: at,
          checkedAt: null,
        },
      ],
    };
  },
  'shopping.decide': (snapshot, input) =>
    mapItem(snapshot, input.itemId, (item) =>
      item.status === 'requested' ? { ...item, status: input.accept ? 'needed' : 'declined' } : item,
    ),

  // --- a grown-up's switches: shown as flipped at once; the server's answer is what stays ---
  'household.settings': (snapshot, input) => ({
    ...snapshot,
    household: {
      ...snapshot.household,
      settings: mergePlain(
        snapshot.household.settings as unknown as Record<string, unknown>,
        input.patch,
      ) as unknown as Snapshot['household']['settings'],
    },
  }),
  'task.status': (snapshot, input) => ({
    ...snapshot,
    templates: snapshot.templates?.map((template) =>
      template.id === input.templateId ? { ...template, status: input.status } : template,
    ),
  }),
  'routine.status': (snapshot, input) => ({
    ...snapshot,
    routines: snapshot.routines.map((routine) =>
      routine.id === input.routineId ? { ...routine, status: input.status } : routine,
    ),
  }),
  'reward.status': (snapshot, input) => ({
    ...snapshot,
    rewards: snapshot.rewards.map((reward) =>
      reward.id === input.rewardId ? { ...reward, status: input.status } : reward,
    ),
  }),
  'profile.archive': (snapshot, input) => ({
    ...snapshot,
    profiles: snapshot.profiles.map((profile) =>
      profile.id === input.profileId ? { ...profile, archived: input.archived } : profile,
    ),
  }),
  'list.update': (snapshot, input) => ({
    ...snapshot,
    lists: snapshot.lists.map((list) =>
      list.id === input.listId ? { ...list, name: input.name, archived: input.archived } : list,
    ),
  }),
  'calendar.setDay': (snapshot, input) => ({
    ...snapshot,
    calendar: [
      ...snapshot.calendar.filter((day) => day.date !== input.date),
      ...(input.labels.length > 0 ? [{ date: input.date, labels: input.labels }] : []),
    ].sort((a, b) => a.date.localeCompare(b.date)),
  }),
  'media.update': (snapshot, input) => ({
    ...snapshot,
    media: snapshot.media.map((item) =>
      item.id === input.mediaId ? { ...item, inSlideshow: input.inSlideshow } : item,
    ),
  }),
  'media.remove': (snapshot, input) => ({
    ...snapshot,
    media: snapshot.media.filter((item) => item.id !== input.mediaId),
  }),
};

function isPlain(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The same merge the server does for a change of settings: what is not mentioned is left as it was. */
function mergePlain(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    const current = out[key];
    out[key] = isPlain(value) && isPlain(current) ? mergePlain(current, value) : value;
  }
  return out;
}

/** The ids of the things a request is about, so that a screen can mark them as "being saved". */
export function touchedBy(op: OpEnvelope): string[] {
  const input = op.input as Record<string, unknown>;
  const ids: string[] = [];
  for (const key of [
    'occurrenceId',
    'runId',
    'redemptionId',
    'itemId',
    'templateId',
    'routineId',
    'rewardId',
    'profileId',
  ]) {
    const value = input[key];
    if (typeof value === 'string') ids.push(value);
  }
  if (Array.isArray(input.occurrenceIds)) ids.push(...(input.occurrenceIds as string[]));
  return ids;
}

export function applyLocal(snapshot: Snapshot, op: OpEnvelope): Snapshot {
  const reducer = REDUCERS[op.type] as Reducer<OpType> | undefined;
  if (!reducer) return snapshot;
  try {
    return reducer(snapshot, op.input, op.at);
  } catch {
    // A guess that cannot be made is simply not made.
    return snapshot;
  }
}

export function applyAll(snapshot: Snapshot, ops: readonly OpEnvelope[]): Snapshot {
  return ops.reduce(applyLocal, snapshot);
}
