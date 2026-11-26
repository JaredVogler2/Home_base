import { useEffect, useRef, useState } from 'react';
import { ACADEMY_PROBLEM_TEXT, checkAcademyExport, type AcademySummary } from '../../../shared/academy';
import type { Profile } from '../../../shared/model';
import { DEFAULT_ACADEMY_HOSTS } from '../../../shared/settings';
import { Avatar } from '../../art/pictures';
import { api, ApiError } from '../../sync/api';
import { store } from '../../sync/store';
import { useParent } from '../context';
import { PageHead } from '../ui/Page';
import {
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
 * The Training Academy: the family's separate learning game. HOMEBASE opens it from the boat on the pond and
 * otherwise leaves it alone — it keeps a child's progress on the device it is played on. A parent can bring a
 * summary of that progress here by hand, with an export file, for one child at a time.
 */

const WORLD_WORDS: Record<string, string> = {
  'reading-cove': 'Reading Cove',
  'number-garden': 'Number Garden',
  'robot-ridge': 'Robot Ridge',
  'memory-forest': 'Memory Forest',
  'inventor-island': 'Inventor Island',
  'explorer-harbor': 'Explorer Harbor',
  'music-lab': 'Music Lab',
  other: 'Other activities',
};

interface ImportResult {
  sessions: { new: number; updated: number; alreadyHad: number };
  stars: { granted: number; heldBackByCap: number };
}

export function AcademyPage() {
  const parent = useParent();
  const toast = useToast();
  const [settings, set, guardian] = useSettings();
  const { view } = parent;
  const [url, setUrl] = useState(settings.academy.url ?? `https://${DEFAULT_ACADEMY_HOSTS[0]}/`);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Profile | null>(null);
  const children = view.profiles.filter((profile) => !profile.archived && profile.independent);
  const links = view.academyLinks ?? [];

  return (
    <>
      <PageHead title="Training Academy" onBack={() => parent.go('more')} />
      <Section title="The boat on the pond" hint="Tapping the boat on the wall sails to the Academy.">
        <Card>
          <Stack>
            <Toggle
              label="The boat sails"
              hint="Off: the boat rests at the jetty and does nothing."
              checked={settings.academy.enabled}
              disabled={!settings.academy.url}
              onChange={(enabled) => set({ academy: { enabled } })}
              testId="set-academy"
            />
            <Field
              label="The Academy’s address"
              hint="Only an https address this HOMEBASE has been told to trust is accepted, and nothing is added to it: no names, no tokens."
            >
              <Line>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <TextInput
                    type="url"
                    inputMode="url"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    maxLength={300}
                    testId="academy-url"
                  />
                </div>
                <Button
                  tone="primary"
                  busy={busy}
                  disabled={!guardian || url.trim() === ''}
                  testId="academy-url-save"
                  onClick={async () => {
                    setBusy(true);
                    const ok = await parent.ask('household.settings', {
                      patch: { academy: { url: url.trim(), enabled: true } },
                    });
                    setBusy(false);
                    if (ok) toast('Saved. The boat sails there.');
                  }}
                >
                  Save
                </Button>
              </Line>
            </Field>
            <p className={styles.itemNote}>
              Coming home: the Academy is its own site, so HOMEBASE cannot put a button inside it. On the
              wall, swipe up from the bottom edge and tap back, or see the device guide for a one-tap way
              home.
            </p>
          </Stack>
        </Card>
      </Section>

      <Section
        title="Stars for taking part"
        hint="Never for speed or for being right: a star is for having sat down and finished an activity."
      >
        <Card>
          <Stack>
            <Toggle
              label="Give stars for finished Academy activities"
              hint="Only for activities you bring in below, and only up to the daily limit."
              checked={settings.academy.participation.enabled}
              onChange={(enabled) =>
                set({ academy: { participation: { ...settings.academy.participation, enabled } } })
              }
            />
            {settings.academy.participation.enabled && (
              <>
                <Stepper
                  label="Stars for each finished activity"
                  value={settings.academy.participation.starsPerSession}
                  min={1}
                  max={5}
                  onChange={(starsPerSession) =>
                    set({
                      academy: { participation: { ...settings.academy.participation, starsPerSession } },
                    })
                  }
                />
                <Stepper
                  label="At most, each day"
                  value={settings.academy.participation.dailyCap}
                  min={1}
                  max={20}
                  onChange={(dailyCap) =>
                    set({ academy: { participation: { ...settings.academy.participation, dailyCap } } })
                  }
                />
              </>
            )}
          </Stack>
        </Card>
      </Section>

      <Section
        title="Bringing progress here"
        hint="Optional. In the Academy’s grown-ups’ area, export a player; then add that file here for the child it belongs to."
      >
        {children.length === 0 ? (
          <Card>Add a child first.</Card>
        ) : (
          <Rows>
            {children.map((child) => {
              const link = links.find((candidate) => candidate.profileId === child.id);
              return (
                <Row
                  key={child.id}
                  round
                  picture={<Avatar id={child.avatar} />}
                  title={child.nickname}
                  detail={
                    link
                      ? `Linked${link.lastImportAt ? ` · last brought in ${new Date(link.lastImportAt).toLocaleDateString()}` : ''}`
                      : 'Not linked: plays without anything being kept here'
                  }
                  onClick={() => setOpen(child)}
                  testId={`academy-child-${child.nickname}`}
                />
              );
            })}
          </Rows>
        )}
      </Section>
      {open && <AcademyChild child={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function AcademyChild({ child, onClose }: { child: Profile; onClose: () => void }) {
  const parent = useParent();
  const toast = useToast();
  const guardian = parent.can('guardian');
  const input = useRef<HTMLInputElement>(null);
  const [summary, setSummary] = useState<AcademySummary | null>(null);
  const [consent, setConsent] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const linked = (parent.view.academyLinks ?? []).some((link) => link.profileId === child.id);
  const rev = parent.view.rev;

  useEffect(() => {
    let current = true;
    api<AcademySummary>('GET', `/academy/summary?profileId=${child.id}&weeks=8`)
      .then((reply) => {
        if (current) setSummary(reply);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [child.id, rev]);

  const bring = async (file: File) => {
    setProblem(null);
    setResult(null);
    setBusy(true);
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        setProblem(ACADEMY_PROBLEM_TEXT['not-an-export']);
        return;
      }
      // Checked here first, so that a wrong file is turned away before anything leaves the phone.
      const checked = checkAcademyExport(parsed);
      if (!checked.ok) {
        setProblem(ACADEMY_PROBLEM_TEXT[checked.reason]);
        return;
      }
      const reply = await api<ImportResult>('POST', '/academy/import', {
        profileId: child.id,
        consent: true,
        file: parsed,
      });
      setResult(reply);
      await store.sync();
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'That did not work. Nothing was changed.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <Sheet title={`${child.nickname} and the Academy`} onClose={onClose} testId="academy-sheet">
      {problem && (
        <p className={styles.warning} role="alert">
          {problem}
        </p>
      )}
      {result && (
        <Card tone="sage">
          <p data-testid="academy-result">
            Brought in {result.sessions.new} new {result.sessions.new === 1 ? 'activity' : 'activities'}
            {result.sessions.updated > 0 ? `, ${result.sessions.updated} moved on` : ''}
            {result.sessions.alreadyHad > 0 ? `, ${result.sessions.alreadyHad} already here` : ''}.
            {result.stars.granted > 0 ? ` ${result.stars.granted} stars for taking part.` : ''}
            {result.stars.heldBackByCap > 0
              ? ` ${result.stars.heldBackByCap} more were over the daily limit.`
              : ''}
          </p>
        </Card>
      )}

      {guardian && (
        <Card>
          <Stack gap="s">
            <p>
              <strong>What is kept:</strong> for each activity, which island, the day, whether it was
              finished, and how many tries were on their own or with help. <strong>Not kept:</strong> answers,
              scores, times, or the name typed in the Academy.
            </p>
            <Toggle
              label={`Yes, keep this for ${child.nickname}`}
              checked={consent}
              onChange={setConsent}
              testId="academy-consent"
            />
            <input
              ref={input}
              type="file"
              accept="application/json,.json"
              className="visually-hidden"
              aria-label="Academy export file"
              data-testid="academy-file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void bring(file);
              }}
            />
            <Button tone="primary" busy={busy} disabled={!consent} onClick={() => input.current?.click()}>
              Choose the export file
            </Button>
          </Stack>
        </Card>
      )}

      {summary && summary.worlds.length > 0 ? (
        <Section
          title="The last eight weeks"
          hint="What was practised, and how much of it was on their own. Not a score."
        >
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Island</th>
                <th className={styles.num}>Finished</th>
                <th className={styles.num}>Tries alone</th>
                <th className={styles.num}>With help</th>
              </tr>
            </thead>
            <tbody>
              {summary.worlds.map((world) => (
                <tr key={world.world}>
                  <td>{WORLD_WORDS[world.world] ?? world.world}</td>
                  <td className={styles.num}>
                    {world.completed} of {world.sessions}
                  </td>
                  <td className={styles.num}>
                    {world.independent} of {world.attempts}
                  </td>
                  <td className={styles.num}>
                    {world.supported} of {world.attempts}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : (
        <p className={styles.itemNote}>Nothing brought in for the last eight weeks.</p>
      )}

      {linked && guardian && (
        <ConfirmButton
          label="Disconnect and delete what was brought in"
          confirmLabel="Disconnect and delete"
          onConfirm={() => {
            parent.tell('academy.unlink', { profileId: child.id });
            toast('Disconnected. Stars already given stay.');
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}
