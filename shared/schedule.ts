import * as v from 'valibot';
import { addDays, isLocalDate, startOfWeek, weekdayOf, type LocalDate } from './time.js';

/**
 * When a mission is offered.
 *
 * A schedule answers one question — "is this offered on that calendar day?" — from the calendar alone. It never
 * looks at a clock, so a change to daylight saving cannot offer a day twice or skip one; and it never looks at the
 * past, so a day nobody opened the wall is simply a day with no missions, not a row of missed ones.
 */

const weekday = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(6));
const dateString = v.pipe(
  v.string(),
  v.check((value: string) => isLocalDate(value), 'a calendar day, YYYY-MM-DD'),
);

export const ScheduleSchema = v.variant('kind', [
  v.object({ kind: v.literal('daily') }),
  v.object({ kind: v.literal('weekdays') }),
  v.object({
    kind: v.literal('weekly'),
    /** 0 = Sunday … 6 = Saturday; at least one. */
    days: v.pipe(v.array(weekday), v.minLength(1), v.maxLength(7)),
  }),
  v.object({ kind: v.literal('once'), date: dateString }),
  v.object({
    /** Offered every day until it has been done this many times in the week. */
    kind: v.literal('flexible'),
    timesPerWeek: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(7)),
  }),
]);
export type Schedule = v.InferOutput<typeof ScheduleSchema>;

export interface ScheduleContext {
  weekStart: 0 | 1;
  /** For a flexible mission: how many times it has been done already in the week that holds the day asked about. */
  doneThisWeek?: number;
  vacation?: { from: LocalDate; to: LocalDate } | null;
}

export function onVacation(date: LocalDate, vacation: ScheduleContext['vacation']): boolean {
  return !!vacation && date >= vacation.from && date <= vacation.to;
}

export function isOfferedOn(schedule: Schedule, date: LocalDate, context: ScheduleContext): boolean {
  if (onVacation(date, context.vacation)) return false;
  switch (schedule.kind) {
    case 'daily':
      return true;
    case 'weekdays': {
      const day = weekdayOf(date);
      return day >= 1 && day <= 5;
    }
    case 'weekly':
      return schedule.days.includes(weekdayOf(date));
    case 'once':
      return schedule.date === date;
    case 'flexible':
      return (context.doneThisWeek ?? 0) < schedule.timesPerWeek;
  }
}

/** The seven days of the week that holds `date`, first day first. */
export function weekOf(date: LocalDate, weekStart: 0 | 1): LocalDate[] {
  const first = startOfWeek(date, weekStart);
  return Array.from({ length: 7 }, (_, index) => addDays(first, index));
}

/** A grown-up's sentence for a schedule. */
export function describeSchedule(schedule: Schedule): string {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  switch (schedule.kind) {
    case 'daily':
      return 'Every day';
    case 'weekdays':
      return 'Monday to Friday';
    case 'weekly':
      return [...schedule.days]
        .sort((a, b) => a - b)
        .map((day) => names[day])
        .join(', ');
    case 'once':
      return `Once, on ${schedule.date}`;
    case 'flexible':
      return schedule.timesPerWeek === 1
        ? 'Once a week, any day'
        : `${schedule.timesPerWeek} times a week, any days`;
  }
}
