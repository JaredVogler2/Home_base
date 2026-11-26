import { useEffect, useState } from 'react';
import { navigate } from '../../app/navigation';
import { Avatar } from '../../art/pictures';
import { api, ApiError } from '../../sync/api';
import { store } from '../../sync/store';
import { useParent } from '../context';
import { PageHead } from '../ui/Page';
import {
  Badge,
  Button,
  Card,
  ConfirmButton,
  Field,
  Line,
  Row,
  Rows,
  Section,
  Sheet,
  Stack,
  Stepper,
  TextInput,
  Toggle,
  useToast,
} from '../ui/kit';
import styles from './pages.module.css';
import { useSettings } from './Settings';

/**
 * Records: what HOMEBASE keeps, for how long, how to take a copy away, and how to delete. Said plainly, because
 * a family should not have to wonder.
 */

interface Change {
  at: string;
  action: string;
  actor: string;
}

const ACTION_WORDS: Record<string, string> = {
  'household.created': 'The household was started',
  'guardian.signed_in': 'A grown-up signed in',
  'guardian.joined': 'A grown-up joined',
  'guardian.pin_set': 'A wall PIN was set',
  'guardian.password_changed': 'A password was changed',
  'invite.created': 'An invitation was made',
  'device.paired': 'A screen was added',
  'device.revoked': 'A screen was switched off',
  'wall.unlocked': 'The wall was unlocked with a PIN',
  'member.role': 'A grown-up’s role was changed',
  'member.removed': 'A grown-up was removed',
  'settings.changed': 'Settings were changed',
  'export.made': 'An export was made',
  'profile.deleted': 'A child was deleted',
  'media.added': 'A photo was added',
  'media.removed': 'A photo was removed',
  'academy.imported': 'Academy progress was brought in',
  'academy.unlinked': 'The Academy was disconnected for a child',
  'history.forgot': 'A line of the day-by-day record was forgotten',
  'profile.created': 'A child was added',
  'profile.archived': 'A child was put away',
  'profile.restored': 'A child was brought back',
  'household.renamed': 'The household’s name or time zone was changed',
  'ai.applied': 'Suggestions from the planning helper were applied',
  'wall.pin_locked_out': 'Too many wrong PINs on the wall',
  'weather.failed': 'The weather service stopped answering',
  'weather.recovered': 'The weather service is answering again',
  'sync.failed': 'A request from a screen could not be carried out',
  'shortcut.created': 'A Siri shortcut token was made',
  'shortcut.revoked': 'A Siri shortcut token was cancelled',
};

interface DayEvent {
  id: string;
  at: string;
  kind: string;
  profileId: string | null;
  subjectId: string | null;
  data: Record<string, unknown>;
}

/** What a line of the day-by-day record says, after the child's name. */
const EVENT_WORDS: Record<string, string> = {
  'mission.sent': 'said a mission was done',
  'mission.done': 'finished a mission',
  'mission.help': 'asked for a hand with a mission',
  'mission.returned': 'was asked to have another go',
  'mission.reversed': 'had a finished mission taken back',
  'mission.skipped': 'said “not today”',
  'mission.undone': 'took back “I did it”',
  'reward.asked': 'asked for a reward',
  'reward.approved': 'was told yes to a reward',
  'reward.fulfilled': 'had a reward',
  'reward.refunded': 'had the stars for a reward given back',
  'routine.started': 'started a routine',
  'routine.completed': 'finished a routine',
  'routine.closed': 'had a routine closed by a grown-up',
  'routine.help': 'asked for a hand during a routine',
  'shopping.bought': 'was ticked off the shopping list',
  'stars.bonus': 'was given stars',
  'stars.corrected': 'had their stars corrected',
};

const LINES_AT_FIRST = 8;

export function Records() {
  const parent = useParent();
  const toast = useToast();
  const [settings, set, guardian] = useSettings();
  const { view } = parent;
  const owner = parent.can('owner');
  const [changes, setChanges] = useState<Change[] | null>(null);
  const [events, setEvents] = useState<DayEvent[] | null>(null);
  // A handful of lines at first: this page is mostly about what is kept and how to take it away.
  const [linesShown, setLinesShown] = useState(LINES_AT_FIRST);
  const [check, setCheck] = useState<boolean | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [ending, setEnding] = useState(false);
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const child = view.profiles.find((profile) => profile.id === deleting);
  const rev = view.rev;

  useEffect(() => {
    if (!guardian) return;
    let current = true;
    api<{ changes: Change[] }>('GET', '/history/changes')
      .then((reply) => {
        if (current) setChanges(reply.changes);
      })
      .catch(() => undefined);
    api<{ events: DayEvent[] }>('GET', '/history/events?days=14&limit=60')
      .then((reply) => {
        if (current) setEvents(reply.events);
      })
      .catch(() => undefined);
    api<{ ok: boolean }>('GET', '/history/reconcile')
      .then((reply) => {
        if (current) setCheck(reply.ok);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [guardian, rev]);

  return (
    <>
      <PageHead title="Records" onBack={() => parent.go('more')} />

      <Section title="What is kept">
        <Card>
          <Stack gap="s">
            <p>
              <strong>Kept:</strong> children’s nicknames, animals and rough ages; missions, routines and
              rewards, and when each was done; the stars and every line of their record; the shopping lists;
              the kinds of day you pick; photos you add; who changed the set-up.
            </p>
            <p>
              <strong>Never kept:</strong> birthdays, surnames, addresses, where anybody is, what a child says
              or taps moment to moment, anything from a camera or a microphone, the events on your calendar,
              or any judgement about a child.
            </p>
            <p className={styles.itemNote}>
              Times are kept to the minute, enough to say “mornings”. Nothing is shared with anybody, and
              there are no ads and no trackers.
            </p>
          </Stack>
        </Card>
      </Section>

      <Section title="For how long">
        <Card>
          <Stack>
            <Toggle
              label="Keep a look-back"
              hint="Off: no day-by-day record is made at all. Stars are still counted exactly."
              checked={!settings.history.paused}
              onChange={(on) => set({ history: { paused: !on } })}
              testId="set-history"
            />
            <Stepper
              label="Day-by-day records are kept for"
              value={settings.history.detailDays}
              min={14}
              max={365}
              step={settings.history.detailDays >= 90 ? 30 : 14}
              onChange={(detailDays) => set({ history: { detailDays } })}
              show={(value) => `${value} days`}
            />
            <Stepper
              label="Weekly totals are kept for"
              value={settings.history.trendMonths}
              min={1}
              max={36}
              onChange={(trendMonths) => set({ history: { trendMonths } })}
              show={(value) => `${value} ${value === 1 ? 'month' : 'months'}`}
            />
            <p className={styles.itemNote}>
              The record of stars is kept whole for as long as the child’s profile exists, so that it can
              always be added up again. The record of set-up changes is kept for thirteen months.
            </p>
          </Stack>
        </Card>
      </Section>

      {guardian && (
        <Section
          title="Take a copy"
          hint="Everything, in files you can open. Passwords, PINs and the photos themselves are not in them."
        >
          <Card>
            <Stack gap="s">
              <Line>
                <a
                  className={styles.download}
                  href="/api/export/household.json"
                  download
                  data-testid="export-json"
                >
                  Everything (JSON)
                </a>
                <a className={styles.download} href="/api/export/ledger.csv" download>
                  Stars (spreadsheet)
                </a>
                <a className={styles.download} href="/api/export/history.csv" download>
                  Look-back (spreadsheet)
                </a>
              </Line>
              {check !== null && (
                <p className={styles.itemNote} data-testid="reconcile">
                  {check
                    ? 'Checked just now: every child’s totals agree with the lines of their record.'
                    : 'The totals do not agree with the record. Please export a copy and report this.'}
                </p>
              )}
            </Stack>
          </Card>
        </Section>
      )}

      {guardian && events && events.length > 0 && (
        <Section
          title="The day-by-day record"
          hint="The last two weeks, newest first. If a line is simply wrong, forget it: it leaves the record, the export and the charts drawn from it. Stars are not changed here — correct those on the child’s page."
          testId="day-record"
        >
          <table className={styles.table}>
            <tbody>
              {events.slice(0, linesShown).map((event) => {
                const child = view.profiles.find((profile) => profile.id === event.profileId);
                const subject =
                  view.templates?.find((template) => template.id === event.subjectId)?.title ??
                  view.routines.find((routine) => routine.id === event.subjectId)?.title ??
                  view.rewards.find((reward) => reward.id === event.subjectId)?.title ??
                  (typeof event.data.text === 'string' ? event.data.text : null);
                const words = EVENT_WORDS[event.kind] ?? event.kind;
                return (
                  <tr key={event.id} data-kind={event.kind}>
                    <td>
                      {new Date(event.at).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </td>
                    <td>
                      {event.kind === 'shopping.bought'
                        ? `${subject ? `“${subject}”` : 'Something'} ${words}`
                        : `${child?.nickname ?? 'Someone'} ${words}${subject ? `: ${subject}` : ''}`}
                    </td>
                    <td>
                      <ConfirmButton
                        size="s"
                        tone="plain"
                        label="Forget"
                        confirmLabel="Forget it"
                        testId={`forget-${event.id}`}
                        onConfirm={() => {
                          setEvents(events.filter((entry) => entry.id !== event.id));
                          parent.tell('history.forget', { eventId: event.id });
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {events.length > linesShown && (
            <Button tone="quiet" onClick={() => setLinesShown(linesShown + 20)} testId="day-record-more">
              Show older lines
            </Button>
          )}
        </Section>
      )}

      {guardian && (
        <Section title="Delete" hint="For good. Take a copy first if you might want one.">
          <Rows>
            {view.profiles.map((profile) => (
              <Row
                key={profile.id}
                round
                picture={<Avatar id={profile.avatar} />}
                title={profile.nickname}
                detail="Their missions, routines, stars and look-back"
                after={<Badge tone="terra">Delete…</Badge>}
                onClick={() => {
                  setDeleting(profile.id);
                  setTyped('');
                  setProblem(null);
                }}
                testId={`delete-${profile.nickname}`}
              />
            ))}
          </Rows>
          {owner && (
            <Button
              tone="danger"
              onClick={() => {
                setEnding(true);
                setTyped('');
                setPassword('');
                setProblem(null);
              }}
              testId="delete-household"
            >
              Delete the whole household…
            </Button>
          )}
        </Section>
      )}

      {guardian && changes && changes.length > 0 && (
        <Section
          title="Changes to the set-up"
          hint="The last hundred. Who signed in, added a screen, changed a setting."
        >
          <table className={styles.table}>
            <tbody>
              {changes.slice(0, 30).map((change, index) => (
                <tr key={`${change.at}-${index}`}>
                  <td>
                    {new Date(change.at).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </td>
                  <td>{ACTION_WORDS[change.action] ?? change.action}</td>
                  <td>{change.actor.replace(/^[a-z]+:/, '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {child && (
        <Sheet
          title={`Delete ${child.nickname}`}
          onClose={() => setDeleting(null)}
          testId="delete-child-sheet"
          footer={
            <>
              <Button onClick={() => setDeleting(null)}>Keep</Button>
              <Button
                tone="danger"
                busy={busy}
                disabled={typed.trim().toLowerCase() !== child.nickname.trim().toLowerCase()}
                testId="delete-child-go"
                onClick={async () => {
                  setBusy(true);
                  setProblem(null);
                  try {
                    await api('POST', `/family/profiles/${child.id}/delete`, { nickname: typed });
                    await store.sync();
                    toast(`${child.nickname}’s records are deleted.`);
                    setDeleting(null);
                  } catch (error) {
                    setProblem(
                      error instanceof ApiError ? error.message : 'That did not work. Nothing was deleted.',
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Delete for good
              </Button>
            </>
          }
        >
          {problem && (
            <p className={styles.warning} role="alert">
              {problem}
            </p>
          )}
          <p>
            This removes {child.nickname}’s profile and everything recorded about them: missions, routine
            runs, every star and the record of them, reward requests, Academy summaries and the look-back. It
            cannot be undone. (To hide a profile without deleting, use “Put away” on the Children page.)
          </p>
          <Field label={`Type “${child.nickname}” to be sure`}>
            <TextInput
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              testId="delete-child-name"
            />
          </Field>
        </Sheet>
      )}

      {ending && (
        <Sheet
          title="Delete the household"
          onClose={() => setEnding(false)}
          testId="delete-household-sheet"
          footer={
            <>
              <Button onClick={() => setEnding(false)}>Keep</Button>
              <Button
                tone="danger"
                busy={busy}
                disabled={
                  password === '' || typed.trim().toLowerCase() !== view.household.name.trim().toLowerCase()
                }
                onClick={async () => {
                  setBusy(true);
                  setProblem(null);
                  try {
                    await api('POST', '/family/household/delete', { password, name: typed });
                    await store.signOut();
                    navigate({ name: 'landing' });
                  } catch (error) {
                    setProblem(
                      error instanceof ApiError ? error.message : 'That did not work. Nothing was deleted.',
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Delete everything
              </Button>
            </>
          }
        >
          {problem && (
            <p className={styles.warning} role="alert">
              {problem}
            </p>
          )}
          <p>
            This deletes every child, mission, list, photo and record of “{view.household.name}”, switches off
            its screens, and removes the accounts of grown-ups who belong to no other household. It cannot be
            undone.
          </p>
          <Field label={`Type “${view.household.name}” to be sure`}>
            <TextInput value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" />
          </Field>
          <Field label="Your password">
            <TextInput
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
        </Sheet>
      )}
    </>
  );
}
