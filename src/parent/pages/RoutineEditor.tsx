import { useState } from 'react';
import { newId } from '../../../shared/ids';
import type { Routine, RoutineKind, RoutineStep, SkipPolicy } from '../../../shared/model';
import { ACTION_PICTURES, type ActionPictureId } from '../../../shared/pictures';
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
  Select,
  Sheet,
  Stack,
  TextInput,
  Toggle,
  useToast,
} from '../ui/kit';
import styles from './pages.module.css';

/**
 * A routine: a few steps in order, one picture each — "first this, then that". A child sees one step at a time
 * on the wall and taps when it is done; the doing happens away from the screen.
 */

const KINDS: { value: RoutineKind; label: string; picture: ActionPictureId; steps: ActionPictureId[] }[] = [
  {
    value: 'morning',
    label: 'Morning',
    picture: 'wake',
    steps: ['wake', 'potty', 'dress', 'breakfast', 'toothbrush', 'shoes', 'backpack'],
  },
  {
    value: 'bedtime',
    label: 'Bedtime',
    picture: 'lightsout',
    steps: ['bath', 'pajamas', 'toothbrush', 'story', 'lightsout'],
  },
  {
    value: 'leaving',
    label: 'Leaving the house',
    picture: 'car',
    steps: ['potty', 'shoes', 'coat', 'backpack', 'car'],
  },
  {
    value: 'afterschool',
    label: 'After school',
    picture: 'backpack',
    steps: ['shoes', 'hands', 'lunchbox', 'snack'],
  },
  { value: 'cleanup', label: 'Tidy-up', picture: 'tidy', steps: ['toys', 'books', 'blocks'] },
  {
    value: 'trip',
    label: 'Getting ready for a trip',
    picture: 'bottle',
    steps: ['potty', 'bottle', 'hat', 'shoes', 'car'],
  },
  { value: 'custom', label: 'Something else', picture: 'tidy', steps: [] },
];

const stepFrom = (picture: ActionPictureId): RoutineStep => ({
  id: newId(),
  title: ACTION_PICTURES[picture].label,
  picture,
  say: null,
  seconds: null,
  needsAdult: false,
  optional: false,
  days: null,
  taskId: null,
});

export function RoutineEditor({ routine, onClose }: { routine: Routine | null; onClose: () => void }) {
  const parent = useParent();
  const toast = useToast();
  const { view } = parent;
  const children = view.profiles.filter((profile) => !profile.archived && profile.independent);
  const [kind, setKind] = useState<RoutineKind>(routine?.kind ?? 'morning');
  const [title, setTitle] = useState(routine?.title ?? '');
  const [picture, setPicture] = useState<ActionPictureId>(routine?.picture ?? 'wake');
  const [steps, setSteps] = useState<RoutineStep[]>(routine?.steps ?? []);
  const [assignees, setAssignees] = useState<string[]>(routine?.assignees ?? []);
  const [days, setDays] = useState<number[]>(routine?.days ?? [0, 1, 2, 3, 4, 5, 6]);
  const [timed, setTimed] = useState(Boolean(routine?.start && routine?.end));
  const [start, setStart] = useState(routine?.start ?? '06:30');
  const [end, setEnd] = useState(routine?.end ?? '09:00');
  const [skip, setSkip] = useState<SkipPolicy>(routine?.skip ?? 'grownup');
  const [stepOpen, setStepOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const choose = (next: RoutineKind) => {
    setKind(next);
    const preset = KINDS.find((candidate) => candidate.value === next);
    // A new routine starts from the usual steps for its kind; an existing one is never rearranged for you.
    if (!routine && preset) {
      if (steps.length === 0 || title === '') {
        setSteps(preset.steps.map(stepFrom));
        setPicture(preset.picture);
        if (next !== 'custom') setTitle(preset.label);
      }
    }
  };

  const move = (index: number, by: number) => {
    const next = [...steps];
    const [taken] = next.splice(index, 1);
    if (!taken) return;
    next.splice(index + by, 0, taken);
    setSteps(next);
  };
  const patch = (id: string, change: Partial<RoutineStep>) =>
    setSteps(steps.map((step) => (step.id === id ? { ...step, ...change } : step)));

  const save = async () => {
    setBusy(true);
    const fields = {
      kind,
      title,
      picture,
      steps: steps.map((step) => ({ ...step, say: step.say && step.say.trim() !== '' ? step.say : null })),
      assignees,
      days,
      start: timed ? start : null,
      end: timed ? end : null,
      skip,
    };
    const ok = routine
      ? await parent.ask('routine.update', { routineId: routine.id, baseVersion: routine.version, ...fields })
      : await parent.ask('routine.create', { routineId: newId(), ...fields });
    setBusy(false);
    if (ok) {
      toast(
        routine ? 'Saved. A routine already under way finishes the way it began.' : 'The routine is ready.',
      );
      onClose();
    }
  };

  const open = steps.find((step) => step.id === stepOpen) ?? null;
  const minutes = Math.round(steps.reduce((sum, step) => sum + (step.seconds ?? 0), 0) / 60);

  return (
    <Sheet
      title={routine ? 'Change a routine' : 'New routine'}
      onClose={onClose}
      testId="routine-editor"
      footer={
        <>
          {routine && (
            <>
              <ConfirmButton
                label={routine.status === 'archived' ? 'Bring back' : 'Put away'}
                confirmLabel={routine.status === 'archived' ? 'Bring it back' : 'Put it away'}
                tone="plain"
                onConfirm={() => {
                  parent.tell('routine.status', {
                    routineId: routine.id,
                    status: routine.status === 'archived' ? 'active' : 'archived',
                  });
                  onClose();
                }}
              />
              <Button
                tone="quiet"
                onClick={() => {
                  parent.tell('routine.clone', {
                    routineId: routine.id,
                    newRoutineId: newId(),
                    title: `${routine.title} (copy)`.slice(0, 40),
                  });
                  toast('Copied. The copy is paused until you are ready.');
                  onClose();
                }}
              >
                Copy
              </Button>
            </>
          )}
          <Button
            tone="primary"
            busy={busy}
            disabled={title.trim() === '' || steps.length === 0}
            onClick={() => void save()}
            testId="save-routine"
          >
            Save
          </Button>
        </>
      }
    >
      <Field label="What kind">
        <Select
          value={kind}
          onChange={choose}
          options={KINDS.map(({ value, label }) => ({ value, label }))}
          testId="routine-kind"
        />
      </Field>
      <Line>
        <PicturePicker kind="action" value={picture} onChange={setPicture} label="Picture" />
        <div style={{ flex: 1, minWidth: 190 }}>
          <Field label="What it is called">
            <TextInput
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={40}
              testId="routine-title"
            />
          </Field>
        </div>
      </Line>

      <Stack gap="s">
        <Line between>
          <span style={{ fontWeight: 700, fontSize: 15 }}>
            Steps, in order{minutes > 0 ? ` · about ${minutes} min` : ''}
          </span>
        </Line>
        <ol className={styles.steps}>
          {steps.map((step, index) => (
            <li key={step.id} className={styles.step}>
              <button
                type="button"
                className={styles.stepPicture}
                onClick={() => setStepOpen(step.id)}
                aria-label={`Change step ${index + 1}: ${step.title}`}
              >
                <ActionPicture id={step.picture} />
              </button>
              <button
                type="button"
                onClick={() => setStepOpen(step.id)}
                style={{ border: 0, background: 'none', textAlign: 'left', padding: 0, minHeight: 44 }}
              >
                <strong>{step.title}</strong>
                <span className={styles.itemNote} style={{ display: 'block' }}>
                  {[
                    step.needsAdult ? 'with a grown-up' : null,
                    step.optional ? 'may be left out' : null,
                    step.seconds ? `${Math.round(step.seconds / 60)} min` : null,
                    step.days ? 'some days' : null,
                    step.taskId ? 'also a mission' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Tap to change'}
                </span>
              </button>
              <span className={styles.stepButtons}>
                <IconButton label={`Move ${step.title} earlier`} onClick={() => index > 0 && move(index, -1)}>
                  {Glyph.up}
                </IconButton>
                <IconButton
                  label={`Move ${step.title} later`}
                  onClick={() => index < steps.length - 1 && move(index, 1)}
                >
                  {Glyph.down}
                </IconButton>
              </span>
            </li>
          ))}
        </ol>
        {steps.length < 12 && (
          <Button onClick={() => setAdding(true)} testId="add-step">
            {Glyph.plus} Add a step
          </Button>
        )}
      </Stack>

      <ChildChips
        label="Who is it for?"
        profiles={children}
        value={assignees}
        onChange={setAssignees}
        everyone="Every child"
      />
      <Days
        label="On which days"
        value={days}
        onChange={setDays}
        weekStart={view.household.settings.weekStart}
      />
      <Toggle
        label="Only at a time of day"
        hint="The wall offers it between these times. Off: it is always there to start."
        checked={timed}
        onChange={setTimed}
      />
      {timed && (
        <Line>
          <Field label="From">
            <TextInput type="time" value={start} onChange={(event) => setStart(event.target.value)} />
          </Field>
          <Field label="Until">
            <TextInput type="time" value={end} onChange={(event) => setEnd(event.target.value)} />
          </Field>
        </Line>
      )}
      <Field
        label="Leaving a step out"
        hint="A step marked “may be left out” can always be skipped by the child."
      >
        <Select
          value={skip}
          onChange={setSkip}
          options={[
            { value: 'grownup', label: 'Only a grown-up can skip a step' },
            { value: 'child', label: 'The child can skip any step' },
            { value: 'off', label: 'No skipping' },
          ]}
        />
      </Field>
      {routine && routine.status !== 'archived' && (
        <Toggle
          label="In use"
          hint="Switch off to rest it without losing it."
          checked={routine.status === 'active'}
          onChange={(on) =>
            parent.tell('routine.status', { routineId: routine.id, status: on ? 'active' : 'paused' })
          }
        />
      )}

      {adding && (
        <Sheet title="Add a step" onClose={() => setAdding(false)} testId="step-ideas">
          <ul className={styles.gallery}>
            {(Object.keys(ACTION_PICTURES) as ActionPictureId[]).map((id) => (
              <li key={id}>
                <button
                  type="button"
                  className={styles.idea}
                  onClick={() => {
                    setSteps([...steps, stepFrom(id)]);
                    setAdding(false);
                  }}
                  data-testid={`step-idea-${id}`}
                >
                  <ActionPicture id={id} />
                  {ACTION_PICTURES[id].label}
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      )}

      {open && (
        <Sheet
          title="A step"
          onClose={() => setStepOpen(null)}
          testId="step-editor"
          footer={
            <>
              <ConfirmButton
                label="Remove"
                confirmLabel="Remove the step"
                onConfirm={() => {
                  setSteps(steps.filter((step) => step.id !== open.id));
                  setStepOpen(null);
                }}
              />
              <Button tone="primary" onClick={() => setStepOpen(null)}>
                Done
              </Button>
            </>
          }
        >
          <Line>
            <PicturePicker
              kind="action"
              value={open.picture}
              onChange={(next) => patch(open.id, { picture: next })}
              label="Picture"
            />
            <div style={{ flex: 1, minWidth: 190 }}>
              <Field label="What it is called">
                <TextInput
                  value={open.title}
                  onChange={(event) => patch(open.id, { title: event.target.value })}
                  maxLength={40}
                />
              </Field>
            </div>
          </Line>
          <Field
            label="What the guide says (optional)"
            hint={`Left empty, he says: “${ACTION_PICTURES[open.picture].say}”`}
          >
            <TextInput
              value={open.say ?? ''}
              onChange={(event) => patch(open.id, { say: event.target.value })}
              maxLength={120}
            />
          </Field>
          <Field
            label="About how long"
            hint="For you, planning the morning. A child never sees time running out."
          >
            <Select
              value={String(open.seconds ?? 0)}
              onChange={(next) => patch(open.id, { seconds: Number(next) || null })}
              options={[
                { value: '0', label: 'Not timed' },
                { value: '60', label: '1 minute' },
                { value: '120', label: '2 minutes' },
                { value: '300', label: '5 minutes' },
                { value: '600', label: '10 minutes' },
                { value: '900', label: '15 minutes' },
                { value: '1200', label: '20 minutes' },
                { value: '1800', label: '30 minutes' },
              ]}
            />
          </Field>
          <Toggle
            label="With a grown-up"
            checked={open.needsAdult}
            onChange={(on) => patch(open.id, { needsAdult: on })}
          />
          <Toggle
            label="May be left out"
            hint="A child can skip it without asking."
            checked={open.optional}
            onChange={(on) => patch(open.id, { optional: on })}
          />
          <Toggle
            label="Only on some days"
            checked={open.days !== null}
            onChange={(on) => patch(open.id, { days: on ? [1, 2, 3, 4, 5] : null })}
          />
          {open.days && (
            <Days
              label="Which days"
              value={open.days}
              onChange={(next) => patch(open.id, { days: next })}
              weekStart={view.household.settings.weekStart}
            />
          )}
          {(view.templates ?? []).length > 0 && (
            <Field
              label="Also counts as a mission"
              hint="Doing this step finishes that mission too: one set of stars, however it was done."
            >
              <Select
                value={open.taskId ?? ''}
                onChange={(next) => patch(open.id, { taskId: next === '' ? null : next })}
                options={[
                  { value: '', label: 'No' },
                  ...(view.templates ?? [])
                    .filter((template) => template.status !== 'archived')
                    .map((template) => ({ value: template.id, label: template.title })),
                ]}
              />
            </Field>
          )}
        </Sheet>
      )}
    </Sheet>
  );
}
