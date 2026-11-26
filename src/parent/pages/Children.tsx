import { useEffect, useState } from 'react';
import { newId } from '../../../shared/ids';
import {
  AGE_BAND_LABELS,
  AGE_BANDS,
  levelFor,
  type AgeBand,
  type LedgerEntry,
  type Profile,
} from '../../../shared/model';
import type { AvatarId } from '../../../shared/pictures';
import { Avatar } from '../../art/pictures';
import { api } from '../../sync/api';
import { useParent } from '../context';
import { PageHead } from '../ui/Page';
import {
  Badge,
  Button,
  Card,
  ConfirmButton,
  Empty,
  Field,
  Glyph,
  IconButton,
  Line,
  PicturePicker,
  Row,
  Rows,
  Select,
  Sheet,
  Stack,
  StarCount,
  Stepper,
  TextInput,
  Toggle,
  useToast,
} from '../ui/kit';
import styles from './pages.module.css';

/**
 * The children: a nickname, a picture and a rough age — never a birthday, a surname or a photograph. A baby can
 * have a place in the family with nothing to do.
 */

export function Children() {
  const parent = useParent();
  const { view } = parent;
  const [editing, setEditing] = useState<Profile | 'new' | null>(null);
  const [ledgerOf, setLedgerOf] = useState<Profile | null>(null);
  const live = view.profiles.filter((profile) => !profile.archived).sort((a, b) => a.sort - b.sort);
  const away = view.profiles.filter((profile) => profile.archived);
  const guardian = parent.can('guardian');

  const move = (index: number, by: number) => {
    const ids = live.map((profile) => profile.id);
    const [taken] = ids.splice(index, 1);
    if (!taken) return;
    ids.splice(index + by, 0, taken);
    parent.tell('profile.reorder', { profileIds: ids });
  };

  return (
    <>
      <PageHead
        title="Children"
        onBack={() => parent.go('more')}
        action={
          guardian ? (
            <Button size="s" tone="primary" onClick={() => setEditing('new')} testId="add-child">
              {Glyph.plus} Add
            </Button>
          ) : undefined
        }
      />
      {live.length === 0 ? (
        <Card>
          <Empty picture={<Avatar id="fox" />} title="Nobody yet">
            <p>Add each child with a nickname and an animal of their own.</p>
          </Empty>
        </Card>
      ) : (
        <Rows>
          {live.map((child, index) => {
            const wallet = view.wallets.find((candidate) => candidate.profileId === child.id);
            return (
              <Row
                key={child.id}
                round
                picture={<Avatar id={child.avatar} />}
                title={child.nickname}
                detail={
                  child.independent ? (
                    <>
                      {AGE_BAND_LABELS[child.ageBand]} · level {levelFor(wallet?.lifetime ?? 0)}
                    </>
                  ) : (
                    `${AGE_BAND_LABELS[child.ageBand]} · no missions yet`
                  )
                }
                after={child.independent ? <StarCount n={wallet?.available ?? 0} /> : undefined}
                right={
                  <>
                    {guardian && live.length > 1 && (
                      <>
                        <IconButton
                          label={`Move ${child.nickname} up`}
                          onClick={() => index > 0 && move(index, -1)}
                        >
                          {Glyph.up}
                        </IconButton>
                        <IconButton
                          label={`Move ${child.nickname} down`}
                          onClick={() => index < live.length - 1 && move(index, 1)}
                        >
                          {Glyph.down}
                        </IconButton>
                      </>
                    )}
                  </>
                }
                onClick={guardian ? () => setEditing(child) : undefined}
                testId={`child-row-${child.nickname}`}
              />
            );
          })}
        </Rows>
      )}
      {away.length > 0 && (
        <Stack gap="s">
          <h2 className={styles.group}>Put away</h2>
          <Rows>
            {away.map((child) => (
              <Row
                key={child.id}
                round
                picture={<Avatar id={child.avatar} />}
                title={child.nickname}
                right={
                  guardian ? (
                    <Button
                      size="s"
                      tone="quiet"
                      onClick={() => parent.tell('profile.archive', { profileId: child.id, archived: false })}
                    >
                      Bring back
                    </Button>
                  ) : undefined
                }
              />
            ))}
          </Rows>
        </Stack>
      )}
      {editing && (
        <ChildEditor
          child={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onLedger={(child) => {
            setEditing(null);
            setLedgerOf(child);
          }}
        />
      )}
      {ledgerOf && <Ledger child={ledgerOf} onClose={() => setLedgerOf(null)} />}
    </>
  );
}

function ChildEditor({
  child,
  onClose,
  onLedger,
}: {
  child: Profile | null;
  onClose: () => void;
  onLedger: (child: Profile) => void;
}) {
  const parent = useParent();
  const toast = useToast();
  const taken = parent.view.profiles.map((profile) => profile.avatar);
  const [nickname, setNickname] = useState(child?.nickname ?? '');
  const [avatar, setAvatar] = useState<AvatarId>(
    child?.avatar ??
      (['fox', 'bear', 'bunny', 'owl', 'cat', 'frog'] as AvatarId[]).find((id) => !taken.includes(id)) ??
      'fox',
  );
  const [ageBand, setAgeBand] = useState<AgeBand>(child?.ageBand ?? 'preschool');
  const [independent, setIndependent] = useState(child?.independent ?? true);
  const [showNumbers, setShowNumbers] = useState(child?.prefs.showNumbers ?? false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const ok = child
      ? await parent.ask('profile.update', {
          profileId: child.id,
          nickname,
          avatar,
          ageBand,
          independent,
          showNumbers,
        })
      : await parent.ask('profile.create', { profileId: newId(), nickname, avatar, ageBand, independent });
    setBusy(false);
    if (ok) {
      toast(child ? 'Saved.' : `${nickname} is on the wall.`);
      onClose();
    }
  };

  return (
    <Sheet
      title={child ? child.nickname : 'Add a child'}
      onClose={onClose}
      testId="child-editor"
      footer={
        <>
          {child && (
            <ConfirmButton
              label="Put away"
              confirmLabel="Put away (nothing is deleted)"
              tone="plain"
              onConfirm={() => {
                parent.tell('profile.archive', { profileId: child.id, archived: true });
                onClose();
              }}
            />
          )}
          <Button
            tone="primary"
            busy={busy}
            disabled={nickname.trim() === ''}
            onClick={() => void save()}
            testId="save-child"
          >
            Save
          </Button>
        </>
      }
    >
      <Line>
        <PicturePicker
          kind="avatar"
          value={avatar}
          onChange={setAvatar}
          label="Their animal"
          testId="child-avatar"
        />
        <div style={{ flex: 1, minWidth: 180 }}>
          <Field label="Nickname" hint="What the family calls them. No surname is needed.">
            <TextInput
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              maxLength={24}
              testId="child-name"
            />
          </Field>
        </div>
      </Line>
      {taken.filter((id) => id === avatar).length > (child?.avatar === avatar ? 1 : 0) && (
        <p className={styles.warning}>
          Someone else already has this animal. Each child needs their own to tell them apart.
        </p>
      )}
      <Field label="About how old" hint="Only a rough band, to suggest what suits them.">
        <Select
          value={ageBand}
          onChange={(next) => {
            setAgeBand(next);
            if (!child && next === 'baby') setIndependent(false);
          }}
          options={AGE_BANDS.map((value) => ({ value, label: AGE_BAND_LABELS[value] }))}
        />
      </Field>
      <Toggle
        label="Has missions and stars of their own"
        hint="Off for a baby: a picture in the family, and nothing to do."
        checked={independent}
        onChange={setIndependent}
      />
      {child && (
        <Toggle
          label="Show numbers beside the stars"
          hint="For a child who can read numbers. The stars are always shown as pictures too."
          checked={showNumbers}
          onChange={setShowNumbers}
        />
      )}
      {child && child.independent && (
        <Button full onClick={() => onLedger(child)} testId="open-ledger">
          The record of {child.nickname}’s stars
        </Button>
      )}
    </Sheet>
  );
}

const SOURCE_WORDS: Record<string, string> = {
  task: 'A mission',
  routine: 'A routine',
  academy: 'The Academy',
  bonus: 'A gift from a grown-up',
  allowance: 'Weekly stars',
  redemption: 'A reward',
  correction: 'Put right',
};

/** Every line of a child's stars, newest first, and the one place a mistake is put right — in the open. */
function Ledger({ child, onClose }: { child: Profile; onClose: () => void }) {
  const parent = useParent();
  const toast = useToast();
  const [entries, setEntries] = useState<LedgerEntry[] | null>(null);
  const [fixing, setFixing] = useState(false);
  const [available, setAvailable] = useState(0);
  const [lifetime, setLifetime] = useState(0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const wallet = parent.view.wallets.find((candidate) => candidate.profileId === child.id);
  const rev = parent.view.rev;

  useEffect(() => {
    let current = true;
    api<{ entries: LedgerEntry[] }>('GET', `/history/ledger?profileId=${child.id}&limit=100`)
      .then((reply) => {
        if (current) setEntries(reply.entries);
      })
      .catch(() => {
        if (current) setEntries([]);
      });
    return () => {
      current = false;
    };
  }, [child.id, rev]);

  return (
    <Sheet title={`${child.nickname}’s stars`} onClose={onClose} testId="ledger-sheet">
      <div className={styles.tiles}>
        <Card>
          <div className={styles.big}>{wallet?.available ?? 0}</div>
          to spend
        </Card>
        <Card>
          <div className={styles.big}>{wallet?.reserved ?? 0}</div>
          set aside
        </Card>
        <Card>
          <div className={styles.big}>{wallet?.lifetime ?? 0}</div>
          earned in all
        </Card>
      </div>
      {parent.can('guardian') &&
        (fixing ? (
          <Card tone="honey">
            <Stack gap="s">
              <p>
                A correction adds a new line that says what changed and why. Nothing already written is
                altered.
              </p>
              <Stepper
                label="Stars to spend"
                value={available}
                min={-200}
                max={200}
                onChange={setAvailable}
                show={(value) => (value > 0 ? `+${value}` : value)}
              />
              <Stepper
                label="Stars earned in all"
                value={lifetime}
                min={-200}
                max={200}
                onChange={setLifetime}
                show={(value) => (value > 0 ? `+${value}` : value)}
              />
              <Field label="Why (kept in the record)">
                <TextInput value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} />
              </Field>
              <Line>
                <Button onClick={() => setFixing(false)}>Cancel</Button>
                <Button
                  tone="primary"
                  busy={busy}
                  disabled={note.trim() === '' || (available === 0 && lifetime === 0)}
                  onClick={async () => {
                    setBusy(true);
                    const ok = await parent.ask('ledger.correct', {
                      entryId: newId(),
                      profileId: child.id,
                      available,
                      lifetime,
                      note,
                    });
                    setBusy(false);
                    if (ok) {
                      toast('Put right, with a line in the record.');
                      setFixing(false);
                      setAvailable(0);
                      setLifetime(0);
                      setNote('');
                    }
                  }}
                >
                  Add the correction
                </Button>
              </Line>
            </Stack>
          </Card>
        ) : (
          <Button onClick={() => setFixing(true)}>Put a mistake right</Button>
        ))}
      {entries === null ? (
        <p>One moment…</p>
      ) : entries.length === 0 ? (
        <p>No stars yet.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>When</th>
              <th>What</th>
              <th className={styles.num}>To spend</th>
              <th className={styles.num}>In all</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>
                  {new Date(entry.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </td>
                <td>
                  {SOURCE_WORDS[entry.source] ?? entry.source}
                  {entry.kind === 'reserve' && ' (set aside)'}
                  {entry.kind === 'release' && ' (given back)'}
                  {entry.kind === 'refund' && ' (refunded)'}
                  {entry.note ? `: ${entry.note}` : ''}
                  <div className={styles.itemNote}>{entry.actor}</div>
                </td>
                <td className={styles.num}>
                  {entry.available > 0 ? `+${entry.available}` : entry.available || ''}
                </td>
                <td className={styles.num}>
                  {entry.lifetime > 0 ? `+${entry.lifetime}` : entry.lifetime || ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Badge>Lines are only ever added, never changed.</Badge>
    </Sheet>
  );
}
