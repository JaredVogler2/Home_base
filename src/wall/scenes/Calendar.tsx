import { useEffect } from 'react';
import { DAY_PICTURES } from '../../../shared/pictures';
import { addDays, weekdayOf } from '../../../shared/time';
import { P } from '../../art/palette';
import { DayPicture } from '../../art/pictures';
import { useWall } from '../context';
import type { Box } from '../home/layout';
import { Frame } from './Frame';
import styles from './Calendar.module.css';

/**
 * CALENDAR.
 *
 * Two things. For a child: this week as seven cards with a picture of what kind of day each is — a school day,
 * a visitor, a birthday — and nothing more; a grown-up chooses those pictures, and the appointments themselves
 * never come to this screen. For a grown-up: how to get to the display's own calendar, which is where the
 * family's real calendar lives. HOMEBASE cannot open that calendar itself, and says so.
 */

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function Calendar({ origin }: { origin: Box | null }) {
  const wall = useWall();
  const { view } = wall;
  const week = Array.from({ length: 7 }, (_, index) => addDays(view.today, index));
  const labelsOf = (date: string) => view.calendar.find((day) => day.date === date)?.labels ?? [];
  const todays = labelsOf(view.today);

  useEffect(() => {
    wall.tell(
      todays.length > 0
        ? `Today: ${todays.map((label) => DAY_PICTURES[label].say).join(' ')}`
        : 'This is our week.',
      'point',
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Frame tone="cream" origin={origin} testId="scene-calendar" showWho={false}>
      <div className={styles.calendar}>
        <ol className={styles.week} aria-label="This week">
          {week.map((date, index) => {
            const labels = labelsOf(date);
            const name = index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : DAYS[weekdayOf(date)];
            return (
              <li key={date} className={styles.day} data-today={index === 0} data-testid={`day-${index}`}>
                <button
                  type="button"
                  className={styles.dayButton}
                  onClick={() => {
                    wall.sound('tap');
                    wall.tell(
                      labels.length > 0
                        ? `${name}: ${labels.map((label) => DAY_PICTURES[label].say).join(' ')}`
                        : `${name}. Nothing special.`,
                      'point',
                    );
                  }}
                  aria-label={`${name}: ${labels.length > 0 ? labels.map((label) => DAY_PICTURES[label].label).join(', ') : 'nothing special'}`}
                >
                  <span className={styles.dayName}>{name}</span>
                  <span className={styles.dayPictures} data-count={labels.length}>
                    {labels.length === 0 ? (
                      <svg
                        viewBox="0 0 100 100"
                        aria-hidden="true"
                        focusable="false"
                        className={styles.plain}
                      >
                        <circle cx="50" cy="50" r="15" fill={P.creamShade} />
                      </svg>
                    ) : (
                      labels.map((label) => <DayPicture key={label} id={label} play={index === 0} />)
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <aside className={styles.native} aria-label="The family calendar">
          <h2>The family calendar</h2>
          <ol className={styles.steps}>
            <li>
              <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
                <rect
                  x="14"
                  y="16"
                  width="72"
                  height="56"
                  rx="8"
                  fill={P.paper}
                  stroke={P.ink}
                  strokeWidth="5"
                />
                <rect x="20" y="62" width="60" height="6" rx="3" fill={P.blue} />
                <path
                  d="M50 96 V76 M40 86 l10 -10 l10 10"
                  fill="none"
                  stroke={P.terraDeep}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Swipe up from the bottom edge.</span>
            </li>
            <li>
              <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
                <rect
                  x="14"
                  y="20"
                  width="72"
                  height="56"
                  rx="8"
                  fill={P.paper}
                  stroke={P.ink}
                  strokeWidth="5"
                />
                <circle cx="50" cy="66" r="6" fill="none" stroke={P.terraDeep} strokeWidth="5" />
                <path d="M30 66 l-6 -5 v10 z" fill={P.inkSoft} />
                <rect x="66" y="61" width="10" height="10" rx="2" fill={P.inkSoft} />
              </svg>
              <span>Tap the round Home button.</span>
            </li>
            <li>
              <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
                <rect
                  x="22"
                  y="22"
                  width="56"
                  height="56"
                  rx="12"
                  fill={P.paper}
                  stroke={P.ink}
                  strokeWidth="5"
                />
                <rect x="22" y="22" width="56" height="18" rx="9" fill={P.terra} />
                <g fill={P.inkSoft}>
                  <circle cx="38" cy="52" r="4" />
                  <circle cx="50" cy="52" r="4" />
                  <circle cx="62" cy="52" r="4" />
                  <circle cx="38" cy="64" r="4" />
                </g>
                <circle cx="50" cy="64" r="5.5" fill={P.honey} />
              </svg>
              <span>Open the Calendar.</span>
            </li>
          </ol>
          <p className={styles.fine}>
            HOMEBASE cannot open the display’s own calendar for you. To come back, open HOMEBASE again from
            the display’s home screen.
          </p>
        </aside>
      </div>
    </Frame>
  );
}
