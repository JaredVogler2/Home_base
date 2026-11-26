import { useState } from 'react';
import { newId } from '../../../shared/ids';
import type { Milestone } from '../../../shared/model';
import { useParent } from '../context';
import {
  Button,
  Card,
  ConfirmButton,
  Empty,
  Field,
  Line,
  PictureOf,
  PicturePicker,
  Row,
  Rows,
  Section,
  Select,
  Sheet,
  Stack,
  TextInput,
} from '../ui/kit';

/**
 * Moments worth keeping: a parent's own notes of things that happened — the first time shoes went on without
 * help, the day the stabilisers came off. A line, a date, a picture and, if it was one child's, whose.
 *
 * They are written by a grown-up, shown only to grown-ups, and are no part of any count: nothing is earned by
 * them and nothing is measured. They are in the family's export and go when the family's records go.
 */

type Picture = NonNullable<Milestone['picture']>;
const FAMILY = 'family';

function longDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function Moments() {
  const parent = useParent();
  const { view } = parent;
  const [editing, setEditing] = useState<Milestone | 'new' | null>(null);
  if (!parent.can('guardian')) return null;
  const moments = view.milestones ?? [];
  const names = new Map(view.profiles.map((profile) => [profile.id, profile.nickname]));

  return (
    <Section
      title="Moments worth keeping"
      hint="Your own notes of things that happened. Only grown-ups see them; nothing is counted."
      action={
        <Button size="s" onClick={() => setEditing('new')} testId="new-moment">
          Add
        </Button>
      }
      testId="moments"
    >
      <Card>
        {moments.length === 0 ? (
          <Empty title="Nothing written down yet">
            <p>The first time something was done alone, a day to remember: add it when it happens.</p>
          </Empty>
        ) : (
          <Rows>
            {moments.map((moment) => (
              <Row
                key={moment.id}
                picture={<PictureOf kind="any" id={moment.picture ?? 'kind'} />}
                title={moment.title}
                detail={[longDate(moment.date), moment.profileId ? names.get(moment.profileId) : null]
                  .filter(Boolean)
                  .join(' · ')}
                onClick={() => setEditing(moment)}
                testId={`moment-${moment.title}`}
              />
            ))}
          </Rows>
        )}
      </Card>
      {editing && (
        <MomentSheet moment={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </Section>
  );
}

function MomentSheet({ moment, onClose }: { moment: Milestone | null; onClose: () => void }) {
  const parent = useParent();
  const { view } = parent;
  const [title, setTitle] = useState(moment?.title ?? '');
  const [date, setDate] = useState(moment?.date ?? view.today);
  const [picture, setPicture] = useState<Picture>(moment?.picture ?? 'kind');
  const [who, setWho] = useState(moment?.profileId ?? FAMILY);
  const [busy, setBusy] = useState(false);
  const children = view.profiles.filter((profile) => !profile.archived);
  const ready = title.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= view.today;

  return (
    <Sheet
      title={moment ? 'A moment' : 'A moment worth keeping'}
      onClose={onClose}
      testId="moment-sheet"
      footer={
        <Line>
          {moment && (
            <ConfirmButton
              label="Remove"
              confirmLabel="Yes, remove it"
              onConfirm={() => {
                parent.tell('milestone.remove', { milestoneId: moment.id });
                onClose();
              }}
              testId="remove-moment"
            />
          )}
          <Button
            tone="primary"
            busy={busy}
            disabled={!ready}
            testId="save-moment"
            onClick={async () => {
              setBusy(true);
              const saved = await parent.ask('milestone.save', {
                milestoneId: moment?.id ?? newId(),
                date,
                title: title.trim(),
                picture,
                profileId: who === FAMILY ? null : who,
              });
              setBusy(false);
              if (saved) onClose();
            }}
          >
            Save
          </Button>
        </Line>
      }
    >
      <Stack>
        <Line>
          <PicturePicker
            kind="any"
            value={picture}
            onChange={setPicture}
            label="Picture"
            testId="moment-picture"
          />
          <Field label="What happened">
            <TextInput
              value={title}
              maxLength={80}
              placeholder="Shoes on, all by herself"
              onChange={(event) => setTitle(event.target.value)}
              testId="moment-title"
            />
          </Field>
        </Line>
        <Field label="When" hint={date > view.today ? 'A moment is something that has happened.' : undefined}>
          <TextInput
            type="date"
            value={date}
            max={view.today}
            onChange={(event) => setDate(event.target.value)}
            testId="moment-date"
          />
        </Field>
        <Field label="Whose">
          <Select
            value={who}
            onChange={setWho}
            options={[
              { value: FAMILY, label: 'The whole family' },
              ...children.map((child) => ({ value: child.id, label: child.nickname })),
            ]}
          />
        </Field>
      </Stack>
    </Sheet>
  );
}
