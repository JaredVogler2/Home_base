import { useState } from 'react';
import { newId } from '../../../shared/ids';
import type { ChecklistStep, SkipPolicy, TaskKind, TaskTemplate, Verification } from '../../../shared/model';
import { ACTION_PICTURES, type ActionPictureId } from '../../../shared/pictures';
import { hazardsIn } from '../../../shared/safety';
import type { Schedule } from '../../../shared/schedule';
import { ActionPicture } from '../../art/pictures';
import { useParent } from '../context';
import {
  Button,
  ChildChips,
  ConfirmButton,
  Days,
  Field,
  Glyph,
  IconButton,
  Line,
  PicturePicker,
  Segmented,
  Select,
  Sheet,
  Stepper,
  TextInput,
  Toggle,
  useToast,
} from '../ui/kit';
import styles from './pages.module.css';

/**
 * Making or changing a mission. The picture comes first, because the picture is what a child will know it by;
 * the words are for the grown-ups and for the guide to say aloud.
 */

type Kind = Schedule['kind'];

export interface MissionSeed {
  picture: ActionPictureId;
  title: string;
}

export function MissionEditor({
  template,
  seed,
  onClose,
}: {
  template: TaskTemplate | null;
  seed?: MissionSeed;
  onClose: () => void;
}) {
  const parent = useParent();
  const toast = useToast();
  const { view } = parent;
  const children = view.profiles.filter((profile) => !profile.archived && profile.independent);

  const [picture, setPicture] = useState<ActionPictureId>(template?.picture ?? seed?.picture ?? 'tidy');
  const [title, setTitle] = useState(template?.title ?? seed?.title ?? '');
  const [say, setSay] = useState(template?.say ?? '');
  const [kind, setKind] = useState<TaskKind>(template?.kind ?? 'core');
  const [assignees, setAssignees] = useState<string[]>(template?.assignees ?? []);
  const [shared, setShared] = useState(template?.shared ?? false);
  const [stars, setStars] = useState(template?.stars ?? 1);
  const [effort, setEffort] = useState<1 | 2 | 3>(template?.effort ?? 1);
  const [verification, setVerification] = useState<Verification>(template?.verification ?? 'guardian');
  const [skip, setSkip] = useState<SkipPolicy>(template?.skip ?? 'grownup');
  const [needsAdult, setNeedsAdult] = useState(template?.needsAdult ?? false);
  const [timer, setTimer] = useState(String(template?.timerSeconds ?? 0));
  const [steps, setSteps] = useState<ChecklistStep[]>(template?.steps ?? []);
  const start = template?.schedule ?? ({ kind: 'daily' } as Schedule);
  const [when, setWhen] = useState<Kind>(start.kind);
  const [days, setDays] = useState<number[]>(start.kind === 'weekly' ? start.days : [6]);
  const [times, setTimes] = useState(start.kind === 'flexible' ? start.timesPerWeek : 2);
  const [date, setDate] = useState(start.kind === 'once' ? start.date : view.today);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  const hazards = hazardsIn(title, say, ...steps.map((step) => step.label));
  const blocked = hazards.length > 0 && !needsAdult && !checked;

  const schedule = (): Schedule =>
    when === 'weekly'
      ? { kind: 'weekly', days }
      : when === 'flexible'
        ? { kind: 'flexible', timesPerWeek: times }
        : when === 'once'
          ? { kind: 'once', date }
          : { kind: when };

  const save = async () => {
    setBusy(true);
    const fields = {
      kind,
      title,
      picture,
      say: say.trim() === '' ? null : say,
      steps: steps.filter((step) => step.label.trim() !== ''),
      schedule: schedule(),
      assignees: shared ? [] : assignees,
      shared,
      stars,
      effort,
      verification,
      skip,
      needsAdult,
      timerSeconds: Number(timer) > 0 ? Number(timer) : null,
    };
    const ok = template
      ? await parent.ask('task.update', { templateId: template.id, baseVersion: template.version, ...fields })
      : await parent.ask('task.create', { templateId: newId(), ...fields });
    setBusy(false);
    if (ok) {
      toast(
        template
          ? 'Saved. Missions already handed out today keep how they were.'
          : 'The mission is on the board.',
      );
      onClose();
    }
  };

  return (
    <Sheet
      title={template ? 'Change a mission' : 'New mission'}
      onClose={onClose}
      testId="mission-editor"
      footer={
        <>
          {template && (
            <ConfirmButton
              label={template.status === 'archived' ? 'Bring back' : 'Put away'}
              confirmLabel={template.status === 'archived' ? 'Bring it back' : 'Put it away'}
              tone="plain"
              onConfirm={() => {
                parent.tell('task.status', {
                  templateId: template.id,
                  status: template.status === 'archived' ? 'active' : 'archived',
                });
                onClose();
              }}
            />
          )}
          <Button
            tone="primary"
            busy={busy}
            disabled={title.trim() === '' || blocked}
            onClick={() => void save()}
            testId="save-mission"
          >
            Save
          </Button>
        </>
      }
    >
      <Line>
        <PicturePicker
          kind="action"
          value={picture}
          onChange={setPicture}
          label="Picture"
          testId="mission-picture"
        />
        <div style={{ flex: 1, minWidth: 190 }}>
          <Field label="What it is called">
            <TextInput
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={60}
              placeholder={ACTION_PICTURES[picture].label}
              testId="mission-title"
            />
          </Field>
        </div>
      </Line>
      <Field
        label="What the guide says (optional)"
        hint={`Left empty, he says: “${ACTION_PICTURES[picture].say}”`}
      >
        <TextInput value={say} onChange={(event) => setSay(event.target.value)} maxLength={120} />
      </Field>

      {hazards.length > 0 && !needsAdult && (
        <div className={styles.warning} role="alert">
          <p>
            This sounds like it may involve {hazards.join(' and ')}. For a small child that is a job to do
            with a grown-up.
          </p>
          <Line>
            <Button size="s" tone="primary" onClick={() => setNeedsAdult(true)}>
              Make it “with a grown-up”
            </Button>
            <Button size="s" onClick={() => setChecked(true)} disabled={checked}>
              {checked ? 'Checked' : 'I have checked: it is safe for my child'}
            </Button>
          </Line>
        </div>
      )}

      <Toggle
        label="For the whole family"
        hint="One mission between everyone: whoever does it, does it."
        checked={shared}
        onChange={setShared}
      />
      {!shared && (
        <ChildChips
          label="Who is it for?"
          profiles={children}
          value={assignees}
          onChange={setAssignees}
          everyone="Every child"
        />
      )}

      <Segmented
        label="When"
        value={when}
        onChange={setWhen}
        testId="mission-when"
        options={[
          { value: 'daily', label: 'Every day' },
          { value: 'weekdays', label: 'Mon–Fri' },
          { value: 'weekly', label: 'Chosen days' },
          { value: 'flexible', label: 'Some days' },
          { value: 'once', label: 'One day' },
        ]}
      />
      {when === 'weekly' && (
        <Days
          label="Which days"
          value={days}
          onChange={setDays}
          weekStart={view.household.settings.weekStart}
        />
      )}
      {when === 'flexible' && (
        <Stepper
          label="How many times a week"
          value={times}
          min={1}
          max={7}
          onChange={setTimes}
          show={(value) => `${value}×`}
        />
      )}
      {when === 'once' && (
        <Field label="Which day">
          <TextInput
            type="date"
            value={date}
            min={view.today}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>
      )}

      <Stepper
        label="Stars"
        value={stars}
        min={0}
        max={20}
        onChange={setStars}
        testId="mission-stars"
        show={(value) => (value === 0 ? 'none' : `★ ${value}`)}
      />
      <Segmented
        label="Kind"
        value={kind}
        onChange={setKind}
        options={[
          { value: 'core', label: 'Part of the day' },
          { value: 'bonus', label: 'An extra to choose' },
        ]}
      />
      <Segmented
        label="How much effort"
        value={effort}
        onChange={setEffort}
        options={[
          { value: 1, label: 'A little' },
          { value: 2, label: 'Some' },
          { value: 3, label: 'A lot' },
        ]}
      />
      <Segmented
        label="When it is finished"
        value={verification}
        onChange={setVerification}
        options={[
          { value: 'guardian', label: 'A grown-up says yes' },
          { value: 'auto', label: 'Stars straight away' },
        ]}
      />
      <Toggle
        label="With a grown-up"
        hint="Shown with a grown-up beside it on the board."
        checked={needsAdult}
        onChange={setNeedsAdult}
      />
      <Field label="“Not today”" hint="Skipping never costs anything.">
        <Select
          value={skip}
          onChange={setSkip}
          options={[
            { value: 'grownup', label: 'Only a grown-up can say it' },
            { value: 'child', label: 'The child can say it' },
            { value: 'off', label: 'Not offered' },
          ]}
        />
      </Field>
      <Field
        label="Sand-timer"
        hint="Something to watch, never a deadline. Nothing happens when it runs out."
      >
        <Select
          value={timer}
          onChange={setTimer}
          options={[
            { value: '0', label: 'None' },
            { value: '60', label: '1 minute' },
            { value: '120', label: '2 minutes' },
            { value: '180', label: '3 minutes' },
            { value: '300', label: '5 minutes' },
            { value: '600', label: '10 minutes' },
            { value: '900', label: '15 minutes' },
          ]}
        />
      </Field>

      <div className={styles.steps}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>Little steps (optional)</span>
        {steps.map((step, index) => (
          <div key={step.id} className={styles.step}>
            <PicturePicker
              kind="action"
              value={step.picture}
              label={`Picture for step ${index + 1}`}
              onChange={(next) =>
                setSteps(steps.map((other) => (other.id === step.id ? { ...other, picture: next } : other)))
              }
            />
            <TextInput
              value={step.label}
              aria-label={`Step ${index + 1}`}
              maxLength={40}
              onChange={(event) =>
                setSteps(
                  steps.map((other) =>
                    other.id === step.id ? { ...other, label: event.target.value } : other,
                  ),
                )
              }
            />
            <IconButton
              label={`Remove step ${index + 1}`}
              onClick={() => setSteps(steps.filter((other) => other.id !== step.id))}
            >
              {Glyph.bin}
            </IconButton>
          </div>
        ))}
        {steps.length < 6 && (
          <Button size="s" onClick={() => setSteps([...steps, { id: newId(), picture, label: '' }])}>
            {Glyph.plus} Add a step
          </Button>
        )}
      </div>
    </Sheet>
  );
}

/** Pictures to start a mission from: every drawing, with the name it comes with. */
export function MissionIdeas({
  onPick,
  onClose,
}: {
  onPick: (seed: MissionSeed) => void;
  onClose: () => void;
}) {
  return (
    <Sheet title="What is the mission?" onClose={onClose} testId="mission-ideas">
      <p>Pick the picture a child will know it by. You can change the words next.</p>
      <ul className={styles.gallery}>
        {(Object.keys(ACTION_PICTURES) as ActionPictureId[]).map((id) => (
          <li key={id}>
            <button
              type="button"
              className={styles.idea}
              onClick={() => onPick({ picture: id, title: ACTION_PICTURES[id].label })}
              data-testid={`idea-${id}`}
            >
              <ActionPicture id={id} />
              {ACTION_PICTURES[id].label}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
