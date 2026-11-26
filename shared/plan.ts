import type { Schedule } from './schedule.js';

/**
 * What the plan asks of a child in a week, and what it offers in return.
 *
 * This is about the plan a grown-up has written — how many missions, how much effort, how many stars — and
 * never about what a child did. It lets a parent see, child by child, whether the same effort is worth about
 * the same, so that a difference between an older and a younger child is a choice and not an accident.
 */

export interface PlanTemplate {
  status: 'active' | 'paused' | 'archived';
  shared: boolean;
  assignees: readonly string[];
  schedule: Schedule;
  stars: number;
  effort: number;
}

export interface PlanLoad {
  /** Missions handed to this child in an ordinary week (missions for the whole family are not counted). */
  missions: number;
  /** The sum of those missions' effort marks. */
  effort: number;
  /** Stars those missions could bring. */
  stars: number;
  /** Stars for each mark of effort, to one decimal place; null when nothing is asked. */
  rate: number | null;
}

/** How often a schedule comes round in a week. A one-off is not part of an ordinary week. */
export function timesAWeek(schedule: Schedule): number {
  switch (schedule.kind) {
    case 'daily':
      return 7;
    case 'weekdays':
      return 5;
    case 'weekly':
      return schedule.days.length;
    case 'flexible':
      return schedule.timesPerWeek;
    default:
      return 0;
  }
}

export function planLoadFor(templates: readonly PlanTemplate[], childId: string): PlanLoad {
  let missions = 0;
  let effort = 0;
  let stars = 0;
  for (const template of templates) {
    if (template.status !== 'active' || template.shared) continue;
    if (template.assignees.length > 0 && !template.assignees.includes(childId)) continue;
    const times = timesAWeek(template.schedule);
    missions += times;
    effort += times * template.effort;
    stars += times * template.stars;
  }
  return { missions, effort, stars, rate: effort > 0 ? Math.round((stars / effort) * 10) / 10 : null };
}

/**
 * Whether the same effort is worth noticeably different amounts to different children: true when the best
 * rate is at least half as much again as the worst. Only children the plan asks something of are compared.
 */
export function unevenRates(loads: readonly PlanLoad[]): boolean {
  const rates = loads.map((load) => load.rate).filter((rate): rate is number => rate !== null && rate > 0);
  if (rates.length < 2) return false;
  return Math.max(...rates) >= Math.min(...rates) * 1.5;
}
