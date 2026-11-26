import { useEffect, useState } from 'react';
import type { Profile } from '../../../shared/model';
import { ActionPicture, Avatar } from '../../art/pictures';
import { api } from '../../sync/api';
import { useParent } from '../context';
import { CHART, InOutColumns, MeterList, SplitBar, WeekColumns, type WeekTick } from '../ui/charts';
import { PageHead } from '../ui/Page';
import { Button, Card, Empty, Section, Segmented, Stack } from '../ui/kit';
import { Moments } from './Moments';
import styles from './pages.module.css';

/**
 * Looking back: what was handed out and what was done, week by week.
 *
 * Every number is shown with what it is out of. Each child is set beside their own earlier weeks and never
 * beside a brother or sister. These are counts of things the family already knew had happened — not scores, not
 * speeds, and not a judgement of anybody.
 */

interface Cell {
  offered: number;
  done: number;
  skipped: number;
  returned: number;
  helped: number;
  routinesStarted: number;
  routinesCompleted: number;
  routineHelp: number;
  earned: number;
  spent: number;
  basis: 'detail' | 'totals' | 'none';
}

interface Summary {
  weeks: { start: string; end: string; current: boolean }[];
  children: { profileId: string | null; cells: Cell[] }[];
  timeOfDay: { profileId: string; morning: number; afternoon: number; evening: number }[];
  help: { templateId: string; title: string; picture: string; asked: number; offered: number }[];
  routines: {
    routineId: string;
    title: string;
    picture: string;
    started: number;
    completed: number;
    stepsAlone: number;
    stepsTogether: number;
    stepsSkipped: number;
    helpAsked: number;
  }[];
  rewards: { asked: number; approved: number; fulfilled: number; declined: number; refunded: number };
  shopping: {
    bought: number;
    staples: { text: string; times: number; lastBought: string; daysSince: number }[];
  };
  paused: boolean;
  detailDays: number;
  trendMonths: number;
}

const tickOf = (week: Summary['weeks'][number]): WeekTick => {
  const date = new Date(`${week.start}T12:00:00`);
  return {
    label: date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
    name: `Week of ${date.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}`,
    current: week.current,
  };
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** One child's week, in a sentence, with every "out of" in it. */
function sentence(child: Profile, cell: Cell | undefined, soFar: boolean): string {
  if (!cell || cell.basis === 'none') return `Nothing was recorded for ${child.nickname}.`;
  const parts: string[] = [];
  if (cell.offered > 0) {
    parts.push(`finished ${cell.done} of ${plural(cell.offered, 'mission', 'missions')}`);
    if (cell.helped > 0) parts.push(`asked for a hand with ${cell.helped}`);
    if (cell.skipped > 0) parts.push(`${cell.skipped} were “not today”`);
  } else {
    parts.push('had no missions handed out');
  }
  if (cell.routinesStarted > 0)
    parts.push(
      `finished ${cell.routinesCompleted} of ${plural(cell.routinesStarted, 'routine', 'routines')} started`,
    );
  const stars =
    cell.earned > 0 || cell.spent > 0
      ? ` ${cell.earned} ${cell.earned === 1 ? 'star' : 'stars'} came in and ${cell.spent} went on rewards.`
      : '';
  return `${child.nickname} ${parts.join(', ')}${soFar ? ' so far' : ''}.${stars}`;
}

export function History({ rest }: { rest: string[] }) {
  const parent = useParent();
  const { view } = parent;
  const [weeks, setWeeks] = useState(8);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [failed, setFailed] = useState(false);
  const rev = view.rev;
  void rest;

  useEffect(() => {
    let current = true;
    api<Summary>('GET', `/history/summary?weeks=${weeks}`)
      .then((reply) => {
        if (current) {
          setSummary(reply);
          setFailed(false);
        }
      })
      .catch(() => {
        if (current) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, [weeks, rev]);

  const children = view.profiles.filter((profile) => !profile.archived && profile.independent);
  const ticks = summary?.weeks.map(tickOf) ?? [];
  const last = (summary?.weeks.length ?? 1) - 1;

  return (
    <>
      <PageHead title="History" />
      <Segmented
        label="How far back"
        value={weeks}
        onChange={setWeeks}
        testId="history-weeks"
        options={[
          { value: 4, label: '4 weeks' },
          { value: 8, label: '8 weeks' },
          { value: 12, label: '12 weeks' },
          { value: 26, label: 'Half a year' },
        ]}
      />

      {summary?.paused && (
        <Card tone="blue">
          The look-back is switched off, so nothing new is being recorded. Stars are still counted exactly.
        </Card>
      )}
      {failed && !summary && <Card>The look-back could not be fetched just now.</Card>}
      {!summary && !failed && <p role="status">One moment…</p>}

      {summary && children.length === 0 && (
        <Card>
          <Empty title="Nothing to look back on yet">
            <p>Once a child has missions, their weeks show up here.</p>
          </Empty>
        </Card>
      )}

      {summary && children.length > 0 && (
        <Section title="This week" testId="recap">
          <Card>
            <Stack gap="s">
              {children.map((child) => (
                <p key={child.id}>
                  {sentence(
                    child,
                    summary.children.find((row) => row.profileId === child.id)?.cells[last],
                    Boolean(summary.weeks[last]?.current),
                  )}
                </p>
              ))}
              {summary.rewards.asked > 0 && (
                <p>
                  Over these {weeks} weeks, {plural(summary.rewards.asked, 'reward was', 'rewards were')}{' '}
                  asked for: {summary.rewards.approved} said yes to ({summary.rewards.fulfilled} done),{' '}
                  {summary.rewards.declined} “not this time”.
                </p>
              )}
            </Stack>
          </Card>
        </Section>
      )}

      {summary &&
        children.map((child) => {
          const cells = summary.children.find((row) => row.profileId === child.id)?.cells ?? [];
          const times = summary.timeOfDay.find((row) => row.profileId === child.id);
          const anything = cells.some((cell) => cell.basis !== 'none');
          return (
            <Section key={child.id} title={child.nickname} testId={`history-${child.nickname}`}>
              <Card>
                {!anything ? (
                  <p className={styles.itemNote}>Nothing recorded in these weeks.</p>
                ) : (
                  <Stack gap="l">
                    <div className={styles.childHead}>
                      <span className={styles.childFace}>
                        <Avatar id={child.avatar} />
                      </span>
                      <p className={styles.itemNote}>
                        {child.nickname}’s own weeks, side by side. Not compared with anyone else.
                      </p>
                    </div>
                    <WeekColumns
                      title="Missions finished, out of those handed out"
                      weeks={ticks}
                      partName="Finished"
                      restName="Not finished"
                      wholeName="missions"
                      cells={cells.map((cell) => ({
                        total: cell.offered,
                        part: cell.done,
                        known: cell.basis !== 'none',
                        note:
                          [
                            cell.helped > 0 ? `asked for a hand ${cell.helped}×` : null,
                            cell.skipped > 0 ? `${cell.skipped} “not today”` : null,
                            cell.basis === 'totals' ? 'weekly totals only' : null,
                          ]
                            .filter(Boolean)
                            .join(', ') || undefined,
                      }))}
                    />
                    <InOutColumns
                      title="Stars in and out"
                      weeks={ticks}
                      upName="Came in"
                      downName="Went on rewards"
                      cells={cells.map((cell) => ({
                        up: Math.max(0, cell.earned),
                        down: Math.max(0, cell.spent),
                      }))}
                    />
                    {times && times.morning + times.afternoon + times.evening > 0 && (
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
                          When missions were finished (last four weeks)
                        </p>
                        <SplitBar
                          label="When missions were finished"
                          parts={[
                            { name: 'Morning', value: times.morning, colour: CHART.morning },
                            { name: 'Afternoon', value: times.afternoon, colour: CHART.afternoon },
                            { name: 'Evening', value: times.evening, colour: CHART.evening },
                          ]}
                        />
                      </div>
                    )}
                  </Stack>
                )}
              </Card>
            </Section>
          );
        })}

      {summary && summary.help.length > 0 && (
        <Section
          title="Where a hand was asked for"
          hint="Over the last four weeks. Something to do together for a while, perhaps, or to split into smaller steps."
        >
          <Card>
            <MeterList
              colour={CHART.together}
              track="#d9e9fb"
              rows={summary.help.map((row) => ({
                name: row.title,
                value: row.asked,
                total: row.offered,
                figure: `${row.asked} of ${row.offered} times`,
              }))}
            />
          </Card>
        </Section>
      )}

      {summary && summary.routines.some((row) => row.started > 0) && (
        <Section title="Routines" hint="Over the last four weeks: how the steps were done.">
          <Stack gap="s">
            {summary.routines
              .filter((row) => row.started > 0)
              .map((row) => (
                <Card key={row.routineId}>
                  <Stack gap="s">
                    <div className={styles.childHead}>
                      <span style={{ width: 44, height: 44, flex: 'none' }}>
                        <ActionPicture id={row.picture as never} />
                      </span>
                      <p>
                        <strong>{row.title}</strong>: finished {row.completed} of {row.started} times started
                        {row.helpAsked > 0 ? `; a hand asked for ${row.helpAsked}×` : ''}.
                      </p>
                    </div>
                    <SplitBar
                      label={`Steps of ${row.title}`}
                      parts={[
                        { name: 'On their own', value: row.stepsAlone, colour: CHART.alone },
                        { name: 'Together', value: row.stepsTogether, colour: CHART.together },
                        { name: 'Left out', value: row.stepsSkipped, colour: CHART.quiet },
                      ]}
                    />
                  </Stack>
                </Card>
              ))}
          </Stack>
        </Section>
      )}

      {summary && summary.shopping.staples.length > 0 && (
        <Section
          title="Bought again and again"
          hint={`From ${summary.shopping.bought} things ticked off in these weeks.`}
        >
          <Card>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>What</th>
                  <th className={styles.num}>Times</th>
                  <th className={styles.num}>Last bought</th>
                </tr>
              </thead>
              <tbody>
                {summary.shopping.staples.map((row) => (
                  <tr key={row.text}>
                    <td>{row.text}</td>
                    <td className={styles.num}>{row.times}</td>
                    <td className={styles.num}>
                      {row.daysSince === 0
                        ? 'today'
                        : row.daysSince === 1
                          ? 'yesterday'
                          : `${row.daysSince} days ago`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </Section>
      )}

      <Moments />

      {summary && (
        <Section title="About these numbers">
          <Card>
            <Stack gap="s">
              <p>
                Day-by-day records are kept for {summary.detailDays} days, then only weekly totals for{' '}
                {summary.trendMonths} months. A week marked “nothing kept” has no record — it is not a week in
                which nothing was done.
              </p>
              <p>
                These are counts, not measurements of a child. A week can look different for a hundred
                ordinary reasons: a cold, a holiday, a new baby.
              </p>
              <Button onClick={() => parent.go('more', 'records')}>What is kept, export and deleting</Button>
            </Stack>
          </Card>
        </Section>
      )}
    </>
  );
}
