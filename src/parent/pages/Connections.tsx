import { useEffect, useState, type ReactNode } from 'react';
import { ActionPicture, DayPicture, ShoppingPicture } from '../../art/pictures';
import { api } from '../../sync/api';
import { useParent } from '../context';
import { PageHead } from '../ui/Page';
import { Badge, Card, Glyph, Row, Rows, Section } from '../ui/kit';
import styles from './pages.module.css';

/**
 * Connections: how each thing HOMEBASE talks to is doing now, and what has happened to them lately.
 *
 * Everything works with all of these off. So "off" is said plainly and is never a warning; a warning is kept for
 * something a family switched on that is not answering. The record underneath is made of fixed words — a screen's
 * name, a part of the house, a kind of problem — and never of anything a family typed.
 */

interface Line {
  at: string;
  what: string;
  who: string;
  about: string | null;
}

export interface HealthReport {
  days: number;
  weather: { on: boolean; observedAt: string | null; failures: number };
  helper: { on: boolean; ok: number; failed: number; lastOkAt: string | null; lastFailedAt: string | null };
  academy: { on: boolean; linked: number; lastImportAt: string | null };
  shortcuts: { active: number; lastUsedAt: string | null };
  screens: { name: string; kind: string; addedAt: string; lastSeenAt: string | null; switchedOff: boolean }[];
  requests: { done: number; ordinaryNo: number; refused: number; failed: number };
  lines: Line[];
}

/** A weather service that has missed this many tries in a row has been quiet for about a quarter of an hour. */
const QUIET_AFTER = 3;

const HELPER_WHY: Record<string, string> = {
  timeout: 'the provider took too long',
  http_error: 'the provider answered with an error',
  network_error: 'the provider could not be reached',
  refused: 'the provider declined to answer',
  truncated: 'the answer was cut short',
  invalid_json: 'the answer could not be read',
  invalid_shape: 'the answer was not in the shape asked for',
  nothing_valid: 'nothing in the answer could be used',
  error: 'something went wrong on HOMEBASE’s side',
};

/** What happened, in a grown-up's words. An unknown kind is shown as it is rather than hidden. */
export function wordsFor(line: Line): string {
  const about = line.about ?? 'something';
  switch (line.what) {
    case 'weather.failed':
      return 'The weather service stopped answering. The sky carried on by the clock.';
    case 'weather.recovered':
      return `The weather service is answering again${line.about ? `, after ${line.about} missed tries` : ''}.`;
    case 'sync.failed':
      return `HOMEBASE could not carry out a request about ${about}. The screen kept it and tried again.`;
    case 'request.not_allowed':
      return `A request about ${about} was turned down: that screen may not do it.`;
    case 'request.made_no_sense':
      return `A request about ${about} was turned down: it did not make sense.`;
    case 'helper.failed':
      return `The planning helper could not finish: ${HELPER_WHY[line.about ?? ''] ?? 'it did not say why'}.`;
    case 'device.paired':
      return 'A screen was added.';
    case 'device.revoked':
      return 'A screen was switched off.';
    case 'academy.imported':
      return 'Academy progress was brought in.';
    case 'academy.unlinked':
      return 'The Academy was disconnected for a child.';
    case 'shortcut.created':
      return 'A Siri key was made.';
    case 'shortcut.revoked':
      return 'A Siri key was cancelled.';
    case 'wall.pin_locked_out':
      return 'Too many wrong PINs on the wall: it was locked for a while.';
    default:
      return line.what;
  }
}

const who = (name: string): string =>
  name === 'auto' || name === 'system' ? 'HOMEBASE' : name.replace(/^[a-z]+:/, '');

function ago(iso: string | null, now: number, never: string): string {
  if (!iso) return never;
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 3) return 'just now';
  if (minutes < 90) return `${minutes} minutes ago`;
  if (minutes < 60 * 36) return `${Math.round(minutes / 60)} hours ago`;
  return `${Math.round(minutes / 1440)} days ago`;
}

export function Connections() {
  const parent = useParent();
  const { view } = parent;
  const [report, setReport] = useState<HealthReport | null>(null);
  const [failed, setFailed] = useState(false);
  const rev = view.rev;
  const now = new Date(view.serverTime).getTime();

  useEffect(() => {
    let current = true;
    api<HealthReport>('GET', '/history/health')
      .then((reply) => {
        if (current) {
          setReport(reply);
          setFailed(false);
        }
      })
      .catch(() => {
        if (current) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, [rev]);

  const arrow = <span style={{ color: 'var(--ink-faint)', display: 'grid' }}>{Glyph.next}</span>;
  const off = <Badge>Off</Badge>;
  const fine = <Badge tone="sage">Fine</Badge>;
  const look = <Badge tone="honey">Have a look</Badge>;

  const row = (to: string, title: string, detail: string, picture: ReactNode, state: ReactNode) => (
    <Row
      key={to}
      picture={picture}
      title={title}
      detail={detail}
      after={
        <>
          {state}
          {arrow}
        </>
      }
      onClick={() => parent.go('more', to)}
      testId={`connection-${to}`}
    />
  );

  return (
    <>
      <PageHead title="Connections" onBack={() => parent.go('more')} />
      {failed && !report && <Card>This could not be fetched just now.</Card>}
      {!report && !failed && <p role="status">One moment…</p>}

      {report && (
        <>
          <Section
            title="Now"
            hint="Everything in HOMEBASE works with all of these off. Each line opens the page where it is set up."
            testId="connections-now"
          >
            <Rows>
              {row(
                'sky',
                'Weather',
                !report.weather.on
                  ? 'Off: the sky goes by the clock and the sun'
                  : report.weather.failures >= QUIET_AFTER
                    ? `Not answering. Last heard ${ago(report.weather.observedAt, now, 'never')}`
                    : `Last heard ${ago(report.weather.observedAt, now, 'not yet')}`,
                <ActionPicture id="wake" />,
                !report.weather.on ? off : report.weather.failures >= QUIET_AFTER ? look : fine,
              )}
              {row(
                'helper',
                'The planning helper',
                !report.helper.on
                  ? 'Off: nothing is sent anywhere'
                  : report.helper.ok + report.helper.failed === 0
                    ? `Not used in the last ${report.days} days`
                    : `${report.helper.ok} of ${report.helper.ok + report.helper.failed} requests finished in the last ${report.days} days`,
                <ActionPicture id="drawing" />,
                !report.helper.on
                  ? off
                  : report.helper.failed > 0 &&
                      (report.helper.lastOkAt === null ||
                        (report.helper.lastFailedAt ?? '') > report.helper.lastOkAt)
                    ? look
                    : fine,
              )}
              {row(
                'academy',
                'Training Academy',
                !report.academy.on
                  ? 'Off: the boat is resting'
                  : report.academy.linked === 0
                    ? 'The boat sails. No progress has been brought in'
                    : `Progress last brought in ${ago(report.academy.lastImportAt, now, 'not yet')}`,
                <DayPicture id="lesson" />,
                report.academy.on ? fine : off,
              )}
              {row(
                'shortcuts',
                'Siri and Shortcuts',
                report.shortcuts.active === 0
                  ? 'No keys'
                  : `${report.shortcuts.active} ${report.shortcuts.active === 1 ? 'key' : 'keys'}; last used ${ago(report.shortcuts.lastUsedAt, now, 'never')}`,
                <ShoppingPicture id="milk" />,
                report.shortcuts.active === 0 ? off : fine,
              )}
              {row(
                'screens',
                'Screens',
                report.screens.filter((screen) => !screen.switchedOff).length === 0
                  ? 'No wall yet'
                  : report.screens
                      .filter((screen) => !screen.switchedOff)
                      .map((screen) => `${screen.name}: ${ago(screen.lastSeenAt, now, 'not seen yet')}`)
                      .join(' · '),
                <DayPicture id="homeday" />,
                report.screens.some((screen) => !screen.switchedOff) ? fine : off,
              )}
            </Rows>
          </Section>

          <Section
            title="Requests from the screens"
            hint={`Over the last ${report.days} days. Every tap on a screen is a small request to HOMEBASE.`}
            testId="connections-requests"
          >
            <Card>
              <table className={styles.table}>
                <tbody>
                  <tr>
                    <td>Done</td>
                    <td className={styles.num}>{report.requests.done}</td>
                  </tr>
                  <tr>
                    <td>
                      Answered with an ordinary “no”
                      <div className={styles.itemNote}>
                        Not enough stars yet, somebody else got there first. The house working as it should.
                      </div>
                    </td>
                    <td className={styles.num}>{report.requests.ordinaryNo}</td>
                  </tr>
                  <tr>
                    <td>
                      Turned down
                      <div className={styles.itemNote}>
                        A screen asked for something it may not do, or sent something that made no sense.
                      </div>
                    </td>
                    <td className={styles.num}>{report.requests.refused}</td>
                  </tr>
                  <tr>
                    <td>
                      Could not be carried out
                      <div className={styles.itemNote}>
                        A fault on HOMEBASE’s side. The screen keeps the request and tries again, so nothing
                        is lost.
                      </div>
                    </td>
                    <td className={styles.num}>{report.requests.failed}</td>
                  </tr>
                </tbody>
              </table>
            </Card>
          </Section>

          <Section
            title="What has happened"
            hint={`The last ${report.days} days, newest first. Kept with the record of set-up changes; no list item, name of a mission or address is in it.`}
            testId="connections-lines"
          >
            {report.lines.length === 0 ? (
              <Card>
                <p className={styles.itemNote}>Nothing to report.</p>
              </Card>
            ) : (
              <table className={styles.table}>
                <tbody>
                  {report.lines.map((line, index) => (
                    <tr key={`${line.at}-${index}`} data-what={line.what}>
                      <td>
                        {new Date(line.at).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </td>
                      <td>{wordsFor(line)}</td>
                      <td>{who(line.who)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </>
      )}
    </>
  );
}
