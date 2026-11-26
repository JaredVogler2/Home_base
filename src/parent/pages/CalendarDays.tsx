import { useState } from 'react';
import { DAY_PICTURE_IDS, DAY_PICTURES, type DayPictureId } from '../../../shared/pictures';
import { addDays, weekdayOf } from '../../../shared/time';
import { DayPicture } from '../../art/pictures';
import { useParent } from '../context';
import { PageHead } from '../ui/Page';
import { Button, Card, kit, Row, Rows, Section, Sheet, Stack } from '../ui/kit';
import styles from './pages.module.css';

/**
 * What kind of day it is, for the children: up to three pictures a day — school, a visitor, a birthday — chosen
 * by a parent. The family's real calendar stays in the display's own Calendar Mode; none of its events, places
 * or people ever reach the child's side of HOMEBASE.
 */

const NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function CalendarDays() {
  const parent = useParent();
  const { view } = parent;
  const guardian = parent.can('guardian');
  const [editing, setEditing] = useState<string | null>(null);
  const days = Array.from({ length: 21 }, (_, index) => addDays(view.today, index));
  const labelsOf = (date: string) => view.calendar.find((day) => day.date === date)?.labels ?? [];
  const current = editing ? labelsOf(editing) : [];

  const toggle = (date: string, label: DayPictureId) => {
    const have = labelsOf(date);
    const next = have.includes(label) ? have.filter((other) => other !== label) : [...have, label].slice(-3);
    parent.tell('calendar.setDay', { date, labels: next });
  };

  return (
    <>
      <PageHead title="Kinds of day" onBack={() => parent.go('more')} />
      <Card tone="blue">
        <Stack gap="s">
          <p>
            These pictures are all the children’s calendar shows. For the family’s real calendar, use the
            display’s own <strong>Calendar Mode</strong> with a shared family calendar — it stays there, and
            works even when HOMEBASE is off.
          </p>
        </Stack>
      </Card>
      <Section title="The next three weeks">
        <Rows>
          {days.map((date, index) => {
            const labels = labelsOf(date);
            return (
              <Row
                key={date}
                title={index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : NAMES[weekdayOf(date)]}
                detail={
                  labels.length > 0
                    ? labels.map((label) => DAY_PICTURES[label].label).join(' · ')
                    : new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })
                }
                after={
                  <span style={{ display: 'flex', gap: 4 }}>
                    {labels.map((label) => (
                      <span key={label} style={{ width: 40, height: 40 }}>
                        <DayPicture id={label} />
                      </span>
                    ))}
                  </span>
                }
                onClick={guardian ? () => setEditing(date) : undefined}
                testId={`day-${index}`}
              />
            );
          })}
        </Rows>
      </Section>
      {editing && (
        <Sheet
          title={new Date(`${editing}T12:00:00`).toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
          onClose={() => setEditing(null)}
          testId="day-sheet"
          footer={
            <Button tone="primary" onClick={() => setEditing(null)}>
              Done
            </Button>
          }
        >
          <p>Up to three. Tap again to take one off.</p>
          <ul className={kit.pictureGrid}>
            {DAY_PICTURE_IDS.map((label) => (
              <li key={label}>
                <button
                  type="button"
                  className={kit.pictureChoice}
                  aria-pressed={current.includes(label)}
                  onClick={() => toggle(editing, label)}
                  data-testid={`day-label-${label}`}
                >
                  <DayPicture id={label} />
                  {DAY_PICTURES[label].label}
                </button>
              </li>
            ))}
          </ul>
          <p className={styles.itemNote}>Only these pictures are shown: never a place, a time or a name.</p>
        </Sheet>
      )}
    </>
  );
}
