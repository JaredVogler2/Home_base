import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  WORKFLOW_CATEGORIES,
  workflowAllowed,
  type AiChange,
  type AiEnvelope,
  type AiProposalSummary,
  type AiStatus,
  type AiWorkflow,
  type Economist,
} from '../../../shared/ai';
import { SHOPPING_CATEGORIES } from '../../../shared/pictures';
import { AI_DATA_CATEGORIES, type AiDataCategory } from '../../../shared/settings';
import { api, ApiError } from '../../sync/api';
import { store } from '../../sync/store';
import { useParent } from '../context';
import { PageHead } from '../ui/Page';
import {
  Badge,
  Button,
  Card,
  ChildChips,
  Field,
  Line,
  PictureOf,
  Row,
  Rows,
  Section,
  Segmented,
  Stack,
  Stepper,
  TextArea,
  Toggle,
  useToast,
} from '../ui/kit';
import styles from './pages.module.css';
import { useSettings } from './Settings';

/**
 * The planning helper: optional, off until a parent switches it on, and never on the wall. It drafts; a grown-up
 * decides. "How long until…?" is worked out by HOMEBASE itself and is here whether the helper is on or off.
 * There is no chat box and no "ask anything": only a few narrow jobs, each a short form.
 */

const PROVIDER_NAME = { anthropic: 'Anthropic', openai: 'OpenAI' } as const;
const PROVIDER_ENV = { anthropic: 'ANTHROPIC_API_KEY', openai: 'OPENAI_API_KEY' } as const;
const PROVIDER_TERMS = {
  anthropic: 'Anthropic’s commercial terms and privacy policy, on anthropic.com',
  openai: 'OpenAI’s API data usage policies and terms, on openai.com',
} as const;

const CATEGORY_TEXT: Record<AiDataCategory, { label: string; sends: string }> = {
  tasks: {
    label: 'Missions',
    sends:
      'Weekly counts of missions handed out, done, left for another day or helped with, and the titles of the missions a hand is asked for most.',
  },
  routines: {
    label: 'Routines',
    sends:
      'What you type when asking for a routine, each child’s age band, and weekly counts and titles of routines.',
  },
  rewards: {
    label: 'Rewards',
    sends:
      'Reward titles and prices, stars to spend now, and the weekly rates worked out below. Never the star ledger’s lines.',
  },
  shopping: {
    label: 'To buy',
    sends:
      'The words of items still to buy, with their aisle, picture and quantity. Never notes, links, shops or who added them.',
  },
  calendar: {
    label: 'Calendar',
    sends: 'Kinds of day only (school day, home day). No job uses this yet.',
  },
  academy: {
    label: 'Academy',
    sends: 'Which Academy areas were practised. No job uses this yet.',
  },
};

const NEVER_SENT = [
  'children’s names (they are sent as Child A, Child B), photos or voices',
  'e-mail addresses, the household’s name or where you live',
  'notes and links on list items, or device names',
  'calendar events',
  'the star ledger’s lines',
];

const JOB_TEXT: Record<AiWorkflow, { title: string; hint: string }> = {
  routine_architect: {
    title: 'Draft a routine',
    hint: 'Say what it is for in a sentence. You get a picture routine to look at; nothing is added until you say so.',
  },
  weekly_reflection: {
    title: 'Look back at the last weeks',
    hint: 'A few observations, each with the count it comes from, and one or two small things to try.',
  },
  shopping_tidy: {
    title: 'Tidy the list',
    hint: 'Aisles and pictures that look wrong, and possible duplicates. Items’ own words are never changed.',
  },
  reward_economist: {
    title: 'Explain “How long until…?”',
    hint: 'Plain words about the numbers above, and perhaps a price to think about. It cannot change any price.',
  },
};

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const weeks = (value: number | null) =>
  value === null ? 'not at this rate' : value === 0 ? 'now' : `${value} wk`;

export function Helper() {
  const parent = useParent();
  const guardian = parent.can('guardian');
  return (
    <>
      <PageHead title="The planning helper" onBack={() => parent.go('more')} />
      <HowLongUntil />
      {guardian ? (
        <HelperSettingsAndJobs />
      ) : (
        <Card tone="blue">Only a parent can set up or use the planning helper.</Card>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// "How long until…?" — no model, always here
// ---------------------------------------------------------------------------------------------------------------------

function HowLongUntil() {
  const parent = useParent();
  const [data, setData] = useState<Economist | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const rev = parent.view.rev;
  useEffect(() => {
    let live = true;
    api<Economist>('GET', '/ai/economist')
      .then((answer) => live && setData(answer))
      .catch(
        (error: unknown) => live && setProblem(error instanceof ApiError ? error.message : 'Could not load.'),
      );
    return () => {
      live = false;
    };
  }, [rev]);
  return (
    <Section
      title="How long until…?"
      hint="Worked out by HOMEBASE itself, with or without the helper. Two rates: the most the present missions could give in a week (the ceiling), and what was actually earned over the last four weeks."
      testId="how-long"
    >
      {problem && <Card tone="rose">{problem}</Card>}
      {data && data.children.length === 0 && <Card>Add a child with missions first.</Card>}
      {data?.children.map((child) => (
        <Card key={child.profileId} testId={`how-long-${child.nickname}`}>
          <Stack gap="s">
            <strong>{child.nickname}</strong>
            <p className={styles.itemNote}>
              {child.available} stars to spend now · ceiling {child.ceilingPerWeek} a week · last four weeks{' '}
              {child.recentTotal} ({child.recentPerWeek} a week)
            </p>
            {child.rewards.length === 0 ? (
              <p className={styles.itemNote}>No rewards on offer for {child.nickname}.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Reward</th>
                    <th className={styles.num}>Price</th>
                    <th className={styles.num}>Still to save</th>
                    <th className={styles.num}>At the ceiling</th>
                    <th className={styles.num}>At the recent rate</th>
                  </tr>
                </thead>
                <tbody>
                  {child.rewards.map((reward) => (
                    <tr key={reward.rewardId}>
                      <td>{reward.title}</td>
                      <td className={styles.num}>{reward.price}</td>
                      <td className={styles.num}>{reward.need}</td>
                      <td className={styles.num}>{weeks(reward.weeksAtCeiling)}</td>
                      <td className={styles.num}>{weeks(reward.weeksAtRecent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Stack>
        </Card>
      ))}
    </Section>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Setting it up
// ---------------------------------------------------------------------------------------------------------------------

function HelperSettingsAndJobs() {
  const [settings, set] = useSettings();
  const ai = settings.ai;
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [draft, setDraft] = useState<AiEnvelope | null>(null);
  const [proposals, setProposals] = useState<AiProposalSummary[]>([]);

  const reload = useCallback(() => {
    api<AiStatus>('GET', '/ai/status').then(setStatus, () => undefined);
    api<{ proposals: AiProposalSummary[] }>('GET', '/ai/proposals').then(
      (answer) => setProposals(answer.proposals),
      () => undefined,
    );
  }, []);
  const aiKey = JSON.stringify(ai);
  useEffect(() => {
    reload();
  }, [reload, aiKey]);

  if (!status) return <Card>Loading…</Card>;
  const available = status.providersAvailable;
  const provider = ai.provider && available.includes(ai.provider) ? ai.provider : null;

  return (
    <>
      <Section
        title="The helper"
        hint="Optional. It can only suggest: every suggestion waits for you, and nothing it says can move stars, approve rewards, delete anything, buy anything or contact anyone."
        testId="helper-setup"
      >
        <Card>
          <Stack>
            {available.length === 0 ? (
              <Card tone="honey" testId="helper-no-key">
                <Stack gap="s">
                  <strong>This HOMEBASE has no API key for a model provider.</strong>
                  <p>
                    The person who runs the server must set <code>{PROVIDER_ENV.anthropic}</code> (for
                    Anthropic) or <code>{PROVIDER_ENV.openai}</code> (for OpenAI) and restart it. Keys come
                    from each provider’s developer console and are paid for by use.
                  </p>
                  <p>A ChatGPT or Claude chat subscription is not an API key and does not include this.</p>
                </Stack>
              </Card>
            ) : (
              <Segmented
                label="Provider"
                value={provider ?? ''}
                options={[
                  ...(provider ? [] : [{ value: '' as const, label: 'Choose' }]),
                  ...available.map((name) => ({ value: name, label: PROVIDER_NAME[name] })),
                ]}
                onChange={(next) => {
                  if (next === 'anthropic' || next === 'openai') set({ ai: { provider: next } });
                }}
                testId="helper-provider"
              />
            )}
            {provider && (
              <p className={styles.itemNote} data-testid="helper-terms">
                What you allow below is sent to {PROVIDER_NAME[provider]} ({status.model}) and is subject to{' '}
                {PROVIDER_NAME[provider]}’s own terms and data retention, which HOMEBASE does not control and
                cannot promise anything about. Read {PROVIDER_TERMS[provider]}.
              </p>
            )}
            <Toggle
              label="Use the planning helper"
              hint={
                provider
                  ? 'Off: nothing is ever sent anywhere, and everything else works as before.'
                  : 'Choose a provider first.'
              }
              checked={ai.enabled && provider !== null}
              disabled={!provider}
              onChange={(enabled) => set({ ai: { enabled } })}
              testId="helper-enabled"
            />
          </Stack>
        </Card>

        <Card>
          <Stack gap="s">
            <strong>What may be sent</strong>
            <p className={styles.itemNote}>Nothing until you tick it. Each job says which it needs.</p>
            {AI_DATA_CATEGORIES.map((category) => (
              <Toggle
                key={category}
                label={CATEGORY_TEXT[category].label}
                hint={CATEGORY_TEXT[category].sends}
                checked={ai.share.includes(category)}
                onChange={(on) =>
                  set({
                    ai: {
                      share: on ? [...ai.share, category] : ai.share.filter((other) => other !== category),
                    },
                  })
                }
                testId={`helper-share-${category}`}
              />
            ))}
            <strong>Never sent</strong>
            <ul className={styles.itemNote}>
              {NEVER_SENT.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </Stack>
        </Card>

        <Card>
          <Stack gap="s">
            <strong>What it may cost</strong>
            <Stepper
              label="At most each day"
              value={ai.dailyCapCents}
              min={0}
              max={1000}
              step={5}
              show={money}
              onChange={(dailyCapCents) => set({ ai: { dailyCapCents } })}
              testId="helper-daily"
            />
            <Stepper
              label="At most each month"
              value={ai.monthlyCapCents}
              min={0}
              max={5000}
              step={50}
              show={money}
              onChange={(monthlyCapCents) => set({ ai: { monthlyCapCents } })}
              testId="helper-monthly"
            />
            <p className={styles.itemNote} data-testid="helper-spent">
              Spent today {money(status.spentTodayCents)} · this month {money(status.spentThisMonthCents)}.
              $0.00 means the helper never runs. Before each request HOMEBASE works out the most it could cost
              and does not send it if that would pass either limit.
            </p>
            <Toggle
              label="Keep what was sent and what came back"
              hint="Off: only the draft itself is kept. On: the words sent and the reply are kept with each draft, here, for you to look at."
              checked={ai.keepTranscripts}
              onChange={(keepTranscripts) => set({ ai: { keepTranscripts } })}
              testId="helper-transcripts"
            />
          </Stack>
        </Card>
      </Section>

      {ai.enabled && provider && (
        <Jobs
          status={status}
          providerName={PROVIDER_NAME[provider]}
          share={ai.share}
          onDraft={(envelope) => {
            setDraft(envelope);
            reload();
          }}
        />
      )}

      {draft && (
        <Draft
          envelope={draft}
          onDone={() => {
            setDraft(null);
            reload();
          }}
        />
      )}

      {proposals.length > 0 && (
        <Section title="Recent drafts" testId="helper-recent">
          <Rows>
            {proposals.map((proposal) => (
              <Row
                key={proposal.id}
                title={JOB_TEXT[proposal.workflow]?.title ?? proposal.workflow}
                detail={new Date(proposal.createdAt).toLocaleString()}
                after={
                  <Badge
                    tone={
                      proposal.status === 'accepted'
                        ? 'sage'
                        : proposal.status === 'dismissed'
                          ? undefined
                          : 'honey'
                    }
                  >
                    {proposal.status === 'accepted'
                      ? 'Applied'
                      : proposal.status === 'dismissed'
                        ? 'Put aside'
                        : 'Waiting'}
                  </Badge>
                }
                onClick={() => setDraft({ ...proposal.envelope, id: proposal.id })}
              />
            ))}
          </Rows>
        </Section>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// The jobs, as small forms
// ---------------------------------------------------------------------------------------------------------------------

function Jobs({
  status,
  providerName,
  share,
  onDraft,
}: {
  status: AiStatus;
  providerName: string;
  share: AiDataCategory[];
  onDraft: (envelope: AiEnvelope) => void;
}) {
  const parent = useParent();
  const toast = useToast();
  const children = parent.view.profiles.filter((profile) => !profile.archived && profile.independent);
  const [request, setRequest] = useState('');
  const [forWhom, setForWhom] = useState<string[]>([]);
  const [running, setRunning] = useState<AiWorkflow | null>(null);

  const run = async (workflow: AiWorkflow, input: Record<string, unknown>) => {
    setRunning(workflow);
    try {
      onDraft(await api<AiEnvelope>('POST', '/ai/run', { workflow, input }));
    } catch (error) {
      toast(error instanceof ApiError ? error.message : 'The helper could not answer.', { tone: 'problem' });
    } finally {
      setRunning(null);
    }
  };

  const needs = (workflow: AiWorkflow) => {
    const need = WORKFLOW_CATEGORIES[workflow];
    const names = (need.all ?? need.any ?? []).map((category) => CATEGORY_TEXT[category].label);
    return `Needs “${names.join(need.any ? '” or “' : '” and “')}” ticked above.`;
  };

  const job = (workflow: AiWorkflow, body: ReactNode, input: () => Record<string, unknown>, ready = true) => {
    const allowed = workflowAllowed(workflow, share);
    return (
      <Card key={workflow} testId={`job-${workflow}`}>
        <Stack gap="s">
          <strong>{JOB_TEXT[workflow].title}</strong>
          <p className={styles.itemNote}>{allowed ? JOB_TEXT[workflow].hint : needs(workflow)}</p>
          {allowed && body}
          <Line>
            <Button
              tone="primary"
              busy={running === workflow}
              disabled={!allowed || !ready || running !== null}
              onClick={() => run(workflow, input())}
              testId={`run-${workflow}`}
            >
              {JOB_TEXT[workflow].title}
            </Button>
          </Line>
        </Stack>
      </Card>
    );
  };

  return (
    <Section
      title="Ask the helper"
      hint={
        status.canRun
          ? `Each job sends one request to ${providerName}. No chat, no “ask anything”.`
          : `The helper cannot run just now${status.reason?.startsWith('cap') ? ': a spending limit has been reached' : ''}.`
      }
      testId="helper-jobs"
    >
      {running && (
        <Card tone="blue" testId="helper-asking">
          <span role="status">Asking {providerName}…</span>
        </Card>
      )}
      {job(
        'routine_architect',
        <>
          <Field label="What is it for?" hint={`${request.length} of 300`}>
            <TextArea
              value={request}
              maxLength={300}
              rows={2}
              placeholder="School tomorrow, need shoes and backpack"
              onChange={(event) => setRequest(event.target.value)}
              testId="routine-request"
            />
          </Field>
          {children.length > 0 && (
            <ChildChips label="For" profiles={children} value={forWhom} onChange={setForWhom} />
          )}
        </>,
        () => ({ request: request.trim(), childIds: forWhom }),
        request.trim().length >= 3,
      )}
      {job('weekly_reflection', null, () => ({ weeks: 4 }))}
      {job('shopping_tidy', null, () => ({}))}
      {job('reward_economist', null, () => ({}))}
    </Section>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// One draft
// ---------------------------------------------------------------------------------------------------------------------

const UNCERTAINTY_WORDS = { low: 'Fairly sure', medium: 'Not very sure', high: 'Unsure' } as const;
const aisle = (category: string) =>
  (SHOPPING_CATEGORIES as readonly string[]).includes(category)
    ? category[0]!.toUpperCase() + category.slice(1)
    : category;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function Draft({ envelope, onDone }: { envelope: AiEnvelope; onDone: () => void }) {
  const parent = useParent();
  const toast = useToast();
  const names = new Map(parent.view.profiles.map((profile) => [profile.id, profile.nickname]));
  const appliedAlready = new Set(envelope.applied?.changes ?? []);
  const [ticked, setTicked] = useState<number[]>(
    envelope.changes.map((change) => change.index).filter((index) => !appliedAlready.has(index)),
  );
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    setBusy(true);
    try {
      const answer = await api<{ outcomes: { index: number; status: string; message?: string }[] }>(
        'POST',
        `/ai/proposals/${envelope.id}/apply`,
        { changes: ticked },
      );
      const refused = answer.outcomes.filter((outcome) => outcome.status === 'rejected');
      toast(
        refused.length > 0
          ? (refused[0]!.message ?? 'Some could not be applied.')
          : 'Done. It is in your plan now.',
        {
          tone: refused.length > 0 ? 'problem' : 'plain',
        },
      );
      await store.sync();
      onDone();
    } catch (error) {
      toast(error instanceof ApiError ? error.message : 'That did not work.', { tone: 'problem' });
    } finally {
      setBusy(false);
    }
  };

  const dismiss = async () => {
    try {
      await api('POST', `/ai/proposals/${envelope.id}/dismiss`, {});
    } catch {
      // Already applied or gone: closing is still the right thing.
    }
    onDone();
  };

  return (
    <Section
      title="The helper’s draft"
      hint={`From ${envelope.cost.provider} (${envelope.cost.model}). Look before you apply anything.`}
      testId="helper-draft"
    >
      <Card>
        <Stack gap="s">
          {envelope.rationale && (
            <p>
              <strong>Its reasons: </strong>
              {envelope.rationale}
            </p>
          )}
          {envelope.explanation && <p data-testid="draft-explanation">{envelope.explanation}</p>}
          <p className={styles.itemNote}>
            {UNCERTAINTY_WORDS[envelope.uncertainty.level]}: {envelope.uncertainty.note}
          </p>
          {envelope.safetyFlags.map((flag) => (
            <p key={flag} className={styles.warning}>
              {flag}
            </p>
          ))}
          {envelope.observations.length > 0 && (
            <>
              <strong>What it noticed</strong>
              <ul>
                {envelope.observations.map((observation, index) => (
                  <li key={index}>
                    {observation.text}
                    {observation.evidence.map((at) => {
                      const evidence = envelope.evidence[at];
                      if (!evidence) return null;
                      const who = evidence.profileId
                        ? names.get(evidence.profileId)
                        : evidence.profileId === null
                          ? 'shared missions'
                          : null;
                      return (
                        <span key={at} className={styles.itemNote}>
                          {' '}
                          — {who ? `${who}: ` : ''}
                          {evidence.label}
                        </span>
                      );
                    })}
                  </li>
                ))}
              </ul>
            </>
          )}
          {envelope.experiments.length > 0 && (
            <>
              <strong>Something to try</strong>
              <ul>
                {envelope.experiments.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </>
          )}
          {envelope.duplicates.length > 0 && (
            <>
              <strong>Possible duplicates</strong>
              <ul>
                {envelope.duplicates.map((group) => (
                  <li key={group.itemIds.join()}>{group.texts.join(' · ')}</li>
                ))}
              </ul>
            </>
          )}
          {envelope.priceSuggestions.length > 0 && (
            <>
              <strong>Prices to think about (nothing is changed)</strong>
              <ul>
                {envelope.priceSuggestions.map((suggestion) => (
                  <li key={suggestion.rewardId}>
                    {suggestion.title}: {suggestion.price} → {suggestion.suggestedPrice} stars.{' '}
                    {suggestion.reason}
                  </li>
                ))}
              </ul>
            </>
          )}
          {envelope.evidence.length > 0 && envelope.observations.length === 0 && (
            <ul className={styles.itemNote}>
              {envelope.evidence.slice(0, 12).map((evidence, index) => (
                <li key={index}>
                  {evidence.profileId ? `${names.get(evidence.profileId) ?? 'A child'}: ` : ''}
                  {evidence.label}
                </li>
              ))}
            </ul>
          )}
        </Stack>
      </Card>

      {envelope.changes.length > 0 && (
        <Card>
          <Stack gap="s">
            <strong>What it would add or change</strong>
            {envelope.changes.map((change) => (
              <label key={change.index} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  checked={ticked.includes(change.index)}
                  disabled={appliedAlready.has(change.index)}
                  onChange={(event) =>
                    setTicked((current) =>
                      event.target.checked
                        ? [...current, change.index]
                        : current.filter((index) => index !== change.index),
                    )
                  }
                  data-testid={`draft-change-${change.index}`}
                  style={{ marginTop: 6, width: 22, height: 22 }}
                />
                <span style={{ flex: 1 }}>
                  <ChangePreview change={change} names={names} />
                  {appliedAlready.has(change.index) && <Badge tone="sage">Applied</Badge>}
                </span>
              </label>
            ))}
            <Line>
              <Button
                tone="primary"
                busy={busy}
                disabled={ticked.length === 0}
                onClick={apply}
                testId="draft-apply"
              >
                Apply the ticked ones
              </Button>
              <Button tone="quiet" onClick={dismiss} testId="draft-dismiss">
                No thanks
              </Button>
            </Line>
          </Stack>
        </Card>
      )}
      {envelope.changes.length === 0 && (
        <Line>
          <Button tone="quiet" onClick={dismiss} testId="draft-dismiss">
            Close
          </Button>
        </Line>
      )}
      {envelope.dropped.length > 0 && (
        <p className={styles.itemNote}>Left out by HOMEBASE’s checks: {envelope.dropped.join(' ')}</p>
      )}
    </Section>
  );
}

function ChangePreview({ change, names }: { change: AiChange; names: Map<string, string> }) {
  const preview = change.preview;
  const who = (ids: string[]) =>
    ids.length === 0 ? 'every child' : ids.map((id) => names.get(id) ?? 'a child').join(', ');
  if (preview.kind === 'routine') {
    return (
      <Stack gap="s">
        <span>
          <strong>New routine: {preview.title}</strong> —{' '}
          {preview.days.map((day) => DAY_NAMES[day]).join(' ')} · for {who(preview.assignees)}
        </span>
        <ol className={styles.steps}>
          {preview.steps.map((step, index) => (
            <li key={index} className={styles.step}>
              <span className={styles.stepPicture}>
                <PictureOf kind="action" id={step.picture} />
              </span>
              <span>
                {step.title}
                {step.needsAdult && <Badge tone="terra">with a grown-up</Badge>}
                {step.optional && <Badge>optional</Badge>}
              </span>
              <span className={styles.itemNote}>
                {step.seconds ? `about ${Math.round(step.seconds / 60) || 1} min` : ''}
              </span>
            </li>
          ))}
        </ol>
      </Stack>
    );
  }
  if (preview.kind === 'task') {
    return (
      <Line>
        <span className={styles.itemPicture}>
          <PictureOf kind="action" id={preview.picture} />
        </span>
        <span>
          <strong>New mission: {preview.title}</strong> — {preview.stars} stars, for {who(preview.assignees)};
          a grown-up checks it{preview.needsAdult ? ', done with a grown-up' : ''}.
        </span>
      </Line>
    );
  }
  return (
    <Line>
      <span className={styles.itemPicture}>
        <PictureOf kind="shopping" id={preview.after.picture} />
      </span>
      <span>
        <strong>{preview.text}</strong>: {aisle(preview.before.category)} → {aisle(preview.after.category)}
        {preview.before.quantity !== preview.after.quantity || preview.before.unit !== preview.after.unit
          ? ` · ${preview.after.quantity ?? ''} ${preview.after.unit ?? ''}`
          : ''}
      </span>
    </Line>
  );
}
