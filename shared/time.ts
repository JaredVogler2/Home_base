/**
 * Calendar days and wall-clock times in the household's own time zone.
 *
 * A task "for Tuesday" belongs to Tuesday where the family lives, whatever the server's clock or a travelling
 * phone thinks. So days are plain `YYYY-MM-DD` strings worked out from an instant and an IANA zone, and all
 * arithmetic on them is done on the calendar, never by adding 24 hours (which is wrong twice a year).
 */

export type LocalDate = string; // YYYY-MM-DD
export type LocalTime = string; // HH:mm, 24-hour

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

export function isValidTimeZone(timeZone: string): boolean {
  if (typeof timeZone !== 'string' || timeZone.length === 0 || timeZone.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== 'string') return false;
  const match = DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isLocalTime(value: unknown): value is LocalTime {
  return typeof value === 'string' && TIME.test(value);
}

export interface ZonedParts {
  date: LocalDate;
  time: LocalTime;
  /** Minutes since local midnight. */
  minutes: number;
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
}

/** What the calendar and the clock on the family's wall say at this instant. */
export function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts: Record<string, string> = {};
  for (const part of formatterFor(timeZone).formatToParts(instant)) parts[part.type] = part.value;
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  return {
    date,
    time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    minutes: hour * 60 + minute,
    weekday: weekdayOf(date),
  };
}

export function localDateOf(instant: Date, timeZone: string): LocalDate {
  return zonedParts(instant, timeZone).date;
}

function toUtcDate(date: LocalDate): Date {
  const match = DATE.exec(date);
  if (!match) throw new RangeError(`Not a calendar day: ${date}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function fromUtcDate(date: Date): LocalDate {
  return date.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday. A property of the calendar day, the same in every zone. */
export function weekdayOf(date: LocalDate): number {
  return toUtcDate(date).getUTCDay();
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const utc = toUtcDate(date);
  utc.setUTCDate(utc.getUTCDate() + days);
  return fromUtcDate(utc);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / 86_400_000);
}

/** The first day of the week that holds `date`. `weekStart` is 0 for Sunday or 1 for Monday. */
export function startOfWeek(date: LocalDate, weekStart: 0 | 1): LocalDate {
  const offset = (weekdayOf(date) - weekStart + 7) % 7;
  return addDays(date, -offset);
}

export function minutesOf(time: LocalTime): number {
  const match = TIME.exec(time);
  if (!match) throw new RangeError(`Not a time of day: ${time}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Whether a time of day falls inside a window. A window whose end is before its start runs through midnight
 * (quiet hours from 19:30 to 06:30). A window whose ends are equal is empty.
 */
export function inWindow(minutes: number, start: LocalTime, end: LocalTime): boolean {
  const from = minutesOf(start);
  const to = minutesOf(end);
  if (from === to) return false;
  return from < to ? minutes >= from && minutes < to : minutes >= from || minutes < to;
}

/**
 * The instant at which the family's clock shows `time` on `date`.
 *
 * Twice a year this is not a simple question. When clocks go forward an hour of the day does not happen: the
 * answer is then the first instant after the gap. When they go back an hour happens twice: the answer is its
 * first occurrence.
 */
export function instantOf(date: LocalDate, time: LocalTime, timeZone: string): Date {
  const utcGuess = toUtcDate(date).getTime() + minutesOf(time) * 60_000;
  const target = `${date}T${time}`;
  const candidates: number[] = [];
  // Offsets in use anywhere are within ±14 h; try each quarter hour around the guess that could match.
  for (let offsetMinutes = -14 * 60; offsetMinutes <= 14 * 60; offsetMinutes += 15) {
    const instant = utcGuess - offsetMinutes * 60_000;
    const parts = zonedParts(new Date(instant), timeZone);
    if (`${parts.date}T${parts.time}` === target) candidates.push(instant);
  }
  if (candidates.length > 0) return new Date(Math.min(...candidates));
  // The time does not exist on that day (a spring-forward gap): walk forward to the first minute that does.
  for (let step = 1; step <= 180; step++) {
    const later = minutesOf(time) + step;
    if (later >= 24 * 60) break;
    const laterTime = `${String(Math.floor(later / 60)).padStart(2, '0')}:${String(later % 60).padStart(2, '0')}`;
    const found = instantOfExact(date, laterTime, timeZone);
    if (found) return found;
  }
  return new Date(utcGuess);
}

function instantOfExact(date: LocalDate, time: LocalTime, timeZone: string): Date | null {
  const utcGuess = toUtcDate(date).getTime() + minutesOf(time) * 60_000;
  const target = `${date}T${time}`;
  let best: number | null = null;
  for (let offsetMinutes = -14 * 60; offsetMinutes <= 14 * 60; offsetMinutes += 15) {
    const instant = utcGuess - offsetMinutes * 60_000;
    const parts = zonedParts(new Date(instant), timeZone);
    if (`${parts.date}T${parts.time}` === target && (best === null || instant < best)) best = instant;
  }
  return best === null ? null : new Date(best);
}

/** Round an instant down to the minute: history keeps coarse times, never to-the-second traces. */
export function coarse(instant: Date): Date {
  return new Date(Math.floor(instant.getTime() / 60_000) * 60_000);
}
