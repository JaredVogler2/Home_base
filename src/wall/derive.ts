import type {
  Occurrence,
  Profile,
  Redemption,
  Reward,
  Routine,
  RoutineRun,
  RoutineStep,
  ShoppingItem,
  Snapshot,
} from '../../shared/model';
import type { ActionPictureId, ShoppingPictureId } from '../../shared/pictures';
import { inWindow, weekdayOf } from '../../shared/time';
import type { BoardCard } from '../art/house/rooms';

/**
 * What the pictures show, worked out from the household as it stands. Pure sums and choices, with no drawing
 * and no clock of their own — so each can be tested on its own, and so the wall and its tests agree about
 * which three missions are "the ones on the board".
 */

export function childrenOf(view: Snapshot): Profile[] {
  return view.profiles.filter((profile) => !profile.archived).sort((a, b) => a.sort - b.sort);
}

export function childById(view: Snapshot, id: string | null): Profile | null {
  return id ? (view.profiles.find((profile) => profile.id === id && !profile.archived) ?? null) : null;
}

const ORDER: Record<Occurrence['status'], number> = {
  returned: 0,
  in_progress: 1,
  available: 2,
  submitted: 3,
  approved: 4,
  skipped: 5,
};

/** Today's missions for one child (theirs, and the family's), or for everyone when nobody is chosen. */
export function missionsFor(view: Snapshot, who: string | null, nowMs: number): Occurrence[] {
  return view.occurrences
    .filter((occurrence) => occurrence.date === view.today)
    .filter((occurrence) => (who ? occurrence.profileId === who || occurrence.profileId === null : true))
    .filter((occurrence) => occurrence.status !== 'skipped')
    .filter((occurrence) => !occurrence.snoozedUntil || new Date(occurrence.snoozedUntil).getTime() <= nowMs)
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.sort - b.sort || a.id.localeCompare(b.id));
}

export function isDone(occurrence: Occurrence): boolean {
  return occurrence.status === 'approved';
}

export function isSent(occurrence: Occurrence): boolean {
  return occurrence.status === 'submitted';
}

export function isToDo(occurrence: Occurrence): boolean {
  return (
    occurrence.status === 'available' ||
    occurrence.status === 'in_progress' ||
    occurrence.status === 'returned'
  );
}

export function boardOf(
  view: Snapshot,
  who: string | null,
  nowMs: number,
): { cards: BoardCard[]; done: number; total: number } {
  const missions = missionsFor(view, who, nowMs);
  // With nobody chosen the board shows one card for each mission, not one for each child.
  const seen = new Set<string>();
  const unique = missions.filter((mission) => {
    const key = who ? mission.id : mission.templateId;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return {
    cards: unique.map((mission) => ({
      picture: mission.picture,
      state: isDone(mission) ? ('done' as const) : isSent(mission) ? ('sent' as const) : ('todo' as const),
    })),
    done: missions.filter((mission) => isDone(mission) || isSent(mission)).length,
    total: missions.length,
  };
}

export function starsOf(view: Snapshot, who: string | null): number {
  if (who) return view.wallets.find((wallet) => wallet.profileId === who)?.available ?? 0;
  return view.wallets.reduce((sum, wallet) => sum + wallet.available, 0);
}

export function waitingRedemptions(view: Snapshot, who: string | null): Redemption[] {
  return view.redemptions.filter(
    (redemption) => redemption.status === 'requested' && (!who || redemption.profileId === who),
  );
}

export function rewardsFor(view: Snapshot, who: string | null): Reward[] {
  return view.rewards
    .filter((reward) => reward.status === 'active')
    .filter((reward) => !who || reward.profiles.length === 0 || reward.profiles.includes(who))
    .sort((a, b) => a.price - b.price || a.sort - b.sort);
}

export function goalOf(view: Snapshot, who: string | null): Reward | null {
  const goal = who ? view.goals.find((candidate) => candidate.profileId === who) : undefined;
  return goal
    ? (view.rewards.find((reward) => reward.id === goal.rewardId && reward.status === 'active') ?? null)
    : null;
}

export function basketOf(view: Snapshot): { pictures: ShoppingPictureId[]; count: number; asked: boolean } {
  const needed = view.items.filter((item) => item.status === 'needed');
  const pictures: ShoppingPictureId[] = [];
  for (const item of [...needed].sort((a, b) => Number(b.priority) - Number(a.priority))) {
    if (!pictures.includes(item.picture)) pictures.push(item.picture);
    if (pictures.length === 3) break;
  }
  return { pictures, count: needed.length, asked: view.items.some((item) => item.status === 'requested') };
}

export function routinesFor(view: Snapshot, who: string | null): Routine[] {
  const weekday = weekdayOf(view.today);
  return view.routines
    .filter((routine) => routine.status === 'active' && routine.days.includes(weekday))
    .filter((routine) => !who || routine.assignees.length === 0 || routine.assignees.includes(who))
    .sort((a, b) => a.sort - b.sort);
}

export function runOf(view: Snapshot, routineId: string, who: string): RoutineRun | null {
  return (
    view.runs.find(
      (run) => run.routineId === routineId && run.profileId === who && run.date === view.today,
    ) ?? null
  );
}

export function stepsToday(routine: Routine, today: string): RoutineStep[] {
  const weekday = weekdayOf(today);
  return routine.steps.filter((step) => step.days === null || step.days.includes(weekday));
}

export function nextStep(run: RoutineRun): RoutineStep | null {
  return run.steps.find((step) => run.done[step.id] === undefined) ?? null;
}

/** The routine that belongs to this time of day, if there is one that has not been finished. */
export function routineNow(view: Snapshot, who: string | null, minutes: number): Routine | null {
  for (const routine of routinesFor(view, who)) {
    if (!routine.start || !routine.end || !inWindow(minutes, routine.start, routine.end)) continue;
    if (who) {
      const run = runOf(view, routine.id, who);
      if (run?.status === 'completed') continue;
    }
    return routine;
  }
  return null;
}

/** What the day clock shows as "next", and whether something is under way. */
export function clockOf(
  view: Snapshot,
  who: string | null,
  minutes: number,
): { next: ActionPictureId | null; running: boolean } {
  const active = view.runs.find((run) => run.status === 'active' && (!who || run.profileId === who));
  if (active) return { next: nextStep(active)?.picture ?? null, running: true };
  const routine = routineNow(view, who, minutes);
  if (!routine) return { next: null, running: false };
  return { next: stepsToday(routine, view.today)[0]?.picture ?? routine.picture, running: false };
}

export function neededItems(view: Snapshot, listId: string): ShoppingItem[] {
  return view.items.filter((item) => item.listId === listId && item.status !== 'declined');
}

/** How a reward stands for a child: can they have it now, and how many more stars if not. */
export function reach(price: number, stars: number): { canHave: boolean; more: number } {
  return { canHave: stars >= price, more: Math.max(0, price - stars) };
}
