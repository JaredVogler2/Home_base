import { useState } from 'react';
import { newId } from '../../../shared/ids';
import {
  DECLINE_REASONS,
  RETURN_REASONS,
  type DeclineReason,
  type Occurrence,
  type Profile,
  type Redemption,
  type ReturnReason,
} from '../../../shared/model';
import { describeItem } from '../../../shared/shopping';
import { ActionPicture, Avatar, RewardPicture, ShoppingPicture } from '../../art/pictures';
import { useParent } from '../context';
import { PageHead } from '../ui/Page';
import {
  Badge,
  Button,
  Card,
  ChildChips,
  ConfirmButton,
  Empty,
  Field,
  Glyph,
  Row,
  Rows,
  Section,
  Sheet,
  Stack,
  StarCount,
  Stepper,
  TextInput,
  useToast,
} from '../ui/kit';
import styles from './pages.module.css';

/**
 * Today: what is waiting for a grown-up, then how each child's day stands. The things that need an answer are
 * at the top and take one tap; nothing here scolds anybody for what was not done.
 */

const STATUS_WORDS: Record<Occurrence['status'], string> = {
  available: 'To do',
  in_progress: 'Started',
  submitted: 'Waiting for you',
  approved: 'Done',
  returned: 'Having another go',
  skipped: 'Not today',
};

export function Today() {
  const parent = useParent();
  const toast = useToast();
  const { view } = parent;
  const [returning, setReturning] = useState<Occurrence | null>(null);
  const [declining, setDeclining] = useState<Redemption | null>(null);
  const [acting, setActing] = useState<Occurrence | null>(null);
  const [bonusFor, setBonusFor] = useState<Profile | null>(null);

  const children = view.profiles.filter((profile) => !profile.archived);
  const nameOf = (id: string | null) =>
    view.profiles.find((profile) => profile.id === id)?.nickname ?? 'The family';
  const faceOf = (id: string | null) => {
    const profile = view.profiles.find((candidate) => candidate.id === id);
    return profile ? <Avatar id={profile.avatar} /> : undefined;
  };

  const submitted = view.occurrences.filter((occurrence) => occurrence.status === 'submitted');
  const asked = view.redemptions.filter((redemption) => redemption.status === 'requested');
  const promised = view.redemptions.filter((redemption) => redemption.status === 'approved');
  const wanted = view.items.filter((item) => item.status === 'requested');
  const helping = view.occurrences.filter(
    (occurrence) =>
      occurrence.helpAsked && (occurrence.status === 'available' || occurrence.status === 'in_progress'),
  );
  const nothingWaiting =
    submitted.length + asked.length + promised.length + wanted.length + helping.length === 0;
  const guardian = parent.can('guardian');
  const vacation = view.household.settings.vacation;
  const away = vacation && view.today >= vacation.from && view.today <= vacation.to;

  return (
    <>
      <PageHead title="Today" />

      {away && (
        <Card tone="blue">
          <strong>Holiday mode is on.</strong> No missions or routines are handed out until {vacation.to}.
          Nothing is counted as missed.
        </Card>
      )}

      <Section
        title="Waiting for you"
        testId="inbox"
        action={
          submitted.length > 1 ? (
            <Button
              size="s"
              tone="good"
              testId="approve-all"
              onClick={() => {
                parent.tell('occurrence.approve', { occurrenceIds: submitted.map((item) => item.id) });
                toast(`Said yes to ${submitted.length} missions.`);
              }}
            >
              Yes to all {submitted.length}
            </Button>
          ) : undefined
        }
      >
        {nothingWaiting ? (
          <Card>
            <Empty title="Nothing is waiting">
              <p>When a child finishes a mission or asks for something, it shows up here.</p>
            </Empty>
          </Card>
        ) : (
          <Rows>
            {helping.map((occurrence) => (
              <Row
                key={`help-${occurrence.id}`}
                picture={<ActionPicture id={occurrence.picture} />}
                title={`${nameOf(occurrence.profileId)} asked for a hand`}
                detail={occurrence.title}
                after={<Badge tone="blue">Help</Badge>}
                onClick={() => setActing(occurrence)}
              />
            ))}
            {submitted.map((occurrence) => (
              <Row
                key={occurrence.id}
                picture={<ActionPicture id={occurrence.picture} />}
                title={occurrence.title}
                detail={
                  <>
                    {nameOf(occurrence.doneBy ?? occurrence.profileId)} says it is done ·{' '}
                    <StarCount n={occurrence.stars} />
                  </>
                }
                testId={`waiting-${occurrence.title}`}
                right={
                  <span className={styles.pair}>
                    <Button
                      size="s"
                      tone="good"
                      aria-label={`Yes: ${occurrence.title}`}
                      testId={`approve-${occurrence.title}`}
                      onClick={() => parent.tell('occurrence.approve', { occurrenceIds: [occurrence.id] })}
                    >
                      Yes
                    </Button>
                    <Button
                      size="s"
                      onClick={() => setReturning(occurrence)}
                      aria-label={`Not yet: ${occurrence.title}`}
                    >
                      Not yet
                    </Button>
                  </span>
                }
              />
            ))}
            {asked.map((redemption) => (
              <Row
                key={redemption.id}
                picture={<RewardPicture id={redemption.picture} />}
                title={redemption.title}
                detail={
                  <>
                    {nameOf(redemption.profileId)} would like this · <StarCount n={redemption.price} />
                  </>
                }
                testId={`asked-${redemption.title}`}
                right={
                  guardian ? (
                    <span className={styles.pair}>
                      <Button
                        size="s"
                        tone="good"
                        testId={`reward-yes-${redemption.title}`}
                        onClick={() =>
                          parent.tell('redemption.decide', { redemptionId: redemption.id, approve: true })
                        }
                      >
                        Yes
                      </Button>
                      <Button size="s" onClick={() => setDeclining(redemption)}>
                        Not now
                      </Button>
                    </span>
                  ) : (
                    <Badge>For a parent</Badge>
                  )
                }
              />
            ))}
            {promised.map((redemption) => (
              <Row
                key={redemption.id}
                picture={<RewardPicture id={redemption.picture} />}
                title={redemption.title}
                detail={`You said yes to ${nameOf(redemption.profileId)}. Tap when it has happened.`}
                right={
                  guardian ? (
                    <span className={styles.pair}>
                      <Button
                        size="s"
                        tone="primary"
                        testId={`reward-done-${redemption.title}`}
                        onClick={() => parent.tell('redemption.fulfill', { redemptionId: redemption.id })}
                      >
                        We did it
                      </Button>
                      <ConfirmButton
                        size="s"
                        label="Undo"
                        confirmLabel="Give stars back"
                        onConfirm={() =>
                          parent.tell('redemption.refund', { redemptionId: redemption.id, note: null })
                        }
                      />
                    </span>
                  ) : undefined
                }
              />
            ))}
            {wanted.map((item) => (
              <Row
                key={item.id}
                picture={<ShoppingPicture id={item.picture} />}
                title={describeItem(item)}
                detail={`${nameOf(item.requestedBy)} asked for this`}
                right={
                  <span className={styles.pair}>
                    <Button
                      size="s"
                      tone="good"
                      testId={`want-yes-${item.text}`}
                      onClick={() => parent.tell('shopping.decide', { itemId: item.id, accept: true })}
                    >
                      Add
                    </Button>
                    <Button
                      size="s"
                      onClick={() => parent.tell('shopping.decide', { itemId: item.id, accept: false })}
                    >
                      Not now
                    </Button>
                  </span>
                }
              />
            ))}
          </Rows>
        )}
      </Section>

      {children.map((child) => {
        const wallet = view.wallets.find((candidate) => candidate.profileId === child.id);
        const mine = view.occurrences
          .filter((occurrence) => occurrence.profileId === child.id && occurrence.date === view.today)
          .sort((a, b) => a.sort - b.sort);
        const done = mine.filter((occurrence) => occurrence.status === 'approved').length;
        const runs = view.runs.filter((run) => run.profileId === child.id && run.date === view.today);
        return (
          <Section key={child.id} title="" testId={`child-${child.nickname}`}>
            <Card>
              <Stack>
                <div className={styles.childHead}>
                  <span className={styles.childFace}>
                    <Avatar id={child.avatar} />
                  </span>
                  <div>
                    <div className={styles.childName}>{child.nickname}</div>
                    <div className={styles.childMeta}>
                      {child.independent ? (
                        <>
                          <StarCount
                            n={wallet?.available ?? 0}
                            label={`${wallet?.available ?? 0} stars to spend`}
                          />
                          {wallet && wallet.reserved > 0 && <span>{wallet.reserved} set aside</span>}
                          <span>{wallet?.lifetime ?? 0} earned in all</span>
                        </>
                      ) : (
                        <span>No missions yet</span>
                      )}
                    </div>
                  </div>
                  {guardian && child.independent && (
                    <span className={styles.childSpace}>
                      <Button size="s" onClick={() => setBonusFor(child)} testId={`bonus-${child.nickname}`}>
                        Give a star
                      </Button>
                    </span>
                  )}
                </div>
                {mine.length > 0 && (
                  <>
                    <div
                      className={styles.bar}
                      role="img"
                      aria-label={`${done} of ${mine.length} missions done today`}
                    >
                      <div className={styles.barFill} style={{ width: `${(done / mine.length) * 100}%` }} />
                    </div>
                    <Rows>
                      {mine.map((occurrence) => (
                        <Row
                          key={occurrence.id}
                          picture={<ActionPicture id={occurrence.picture} />}
                          title={occurrence.title}
                          detail={<StarCount n={occurrence.stars} />}
                          after={
                            <Badge
                              tone={
                                occurrence.status === 'approved'
                                  ? 'sage'
                                  : occurrence.status === 'submitted'
                                    ? 'honey'
                                    : undefined
                              }
                            >
                              {STATUS_WORDS[occurrence.status]}
                            </Badge>
                          }
                          onClick={() => setActing(occurrence)}
                          testId={`mission-${child.nickname}-${occurrence.title}`}
                        />
                      ))}
                    </Rows>
                  </>
                )}
                {runs.map((run) => {
                  const routine = view.routines.find((candidate) => candidate.id === run.routineId);
                  const finished = Object.keys(run.done).length;
                  return (
                    <div key={run.id}>
                      <p>
                        <strong>{routine?.title ?? 'Routine'}</strong>:{' '}
                        {run.status === 'completed'
                          ? 'finished'
                          : `${finished} of ${run.steps.length} steps${run.status === 'suspended' ? ', paused' : ''}`}
                        {run.help.length > 0 && ` · asked for help ${run.help.length}×`}
                      </p>
                    </div>
                  );
                })}
                {child.independent && mine.length === 0 && runs.length === 0 && (
                  <p className={styles.childMeta}>Nothing handed out today.</p>
                )}
              </Stack>
            </Card>
          </Section>
        );
      })}

      {view.occurrences.some(
        (occurrence) => occurrence.profileId === null && occurrence.date === view.today,
      ) && (
        <Section title="For the whole family">
          <Rows>
            {view.occurrences
              .filter((occurrence) => occurrence.profileId === null && occurrence.date === view.today)
              .map((occurrence) => (
                <Row
                  key={occurrence.id}
                  picture={<ActionPicture id={occurrence.picture} />}
                  title={occurrence.title}
                  detail={
                    occurrence.doneBy ? (
                      `${nameOf(occurrence.doneBy)} did it`
                    ) : (
                      <StarCount n={occurrence.stars} />
                    )
                  }
                  after={<Badge>{STATUS_WORDS[occurrence.status]}</Badge>}
                  onClick={() => setActing(occurrence)}
                />
              ))}
          </Rows>
        </Section>
      )}

      {children.length === 0 && (
        <Card tone="honey">
          <Empty title="Add your children first">
            <p>Each child gets a picture of their own to tap on the wall.</p>
            <Button tone="primary" onClick={() => parent.go('more', 'children')}>
              Add a child
            </Button>
          </Empty>
        </Card>
      )}

      {returning && (
        <Sheet title="Not yet" onClose={() => setReturning(null)}>
          <p>
            “{returning.title}” goes back on the board with kind words, and can be finished again. No stars
            are lost.
          </p>
          <Stack gap="s">
            {(Object.keys(RETURN_REASONS) as ReturnReason[]).map((reason) => (
              <Button
                key={reason}
                full
                onClick={() => {
                  parent.tell('occurrence.return', { occurrenceId: returning.id, reason });
                  setReturning(null);
                }}
              >
                {RETURN_REASONS[reason]}
              </Button>
            ))}
          </Stack>
        </Sheet>
      )}

      {declining && (
        <Sheet title="Not this time" onClose={() => setDeclining(null)}>
          <p>The stars set aside for “{declining.title}” go straight back. Choose what the wall says:</p>
          <Stack gap="s">
            {(Object.keys(DECLINE_REASONS) as DeclineReason[]).map((reason) => (
              <Button
                key={reason}
                full
                onClick={() => {
                  parent.tell('redemption.decide', { redemptionId: declining.id, approve: false, reason });
                  setDeclining(null);
                }}
              >
                {DECLINE_REASONS[reason]}
              </Button>
            ))}
          </Stack>
        </Sheet>
      )}

      {acting && <MissionActions occurrence={acting} onClose={() => setActing(null)} faceOf={faceOf} />}
      {bonusFor && <Bonus child={bonusFor} onClose={() => setBonusFor(null)} />}
    </>
  );
}

function MissionActions({
  occurrence,
  onClose,
}: {
  occurrence: Occurrence;
  onClose: () => void;
  faceOf: (id: string | null) => React.ReactNode;
}) {
  const parent = useParent();
  const { view } = parent;
  const children = view.profiles.filter((profile) => !profile.archived && profile.independent);
  const [who, setWho] = useState<string[]>(occurrence.profileId ? [occurrence.profileId] : []);
  const open =
    occurrence.status === 'available' ||
    occurrence.status === 'in_progress' ||
    occurrence.status === 'returned';
  const doer = occurrence.profileId ?? who[0] ?? null;
  return (
    <Sheet title={occurrence.title} onClose={onClose} testId="mission-actions">
      <p>
        {STATUS_WORDS[occurrence.status]} · <StarCount n={occurrence.stars} />
        {occurrence.needsAdult && ' · with a grown-up'}
      </p>
      {open && (
        <>
          {occurrence.profileId === null && (
            <ChildChips
              label="Who did it?"
              profiles={children}
              value={who}
              onChange={(next) => setWho(next.slice(-1))}
              everyone="Choose"
            />
          )}
          <Button
            tone="good"
            full
            disabled={!doer}
            testId="mark-done"
            onClick={() => {
              if (!doer) return;
              parent.tell('occurrence.markDone', { occurrenceId: occurrence.id, profileId: doer });
              onClose();
            }}
          >
            {Glyph.tick} Done — we saw it
          </Button>
          <Button
            full
            onClick={() => {
              parent.tell('occurrence.snooze', { occurrenceId: occurrence.id, hours: 2 });
              onClose();
            }}
          >
            Later (hide for two hours)
          </Button>
          <Button
            full
            onClick={() => {
              parent.tell('occurrence.dismiss', { occurrenceId: occurrence.id });
              onClose();
            }}
          >
            Not today (nothing is lost)
          </Button>
        </>
      )}
      {occurrence.status === 'submitted' && (
        <Button
          tone="good"
          full
          onClick={() => {
            parent.tell('occurrence.approve', { occurrenceIds: [occurrence.id] });
            onClose();
          }}
        >
          Yes, it is done
        </Button>
      )}
      {occurrence.status === 'approved' && occurrence.credited && parent.can('guardian') && (
        <>
          <p className={styles.childMeta}>
            Marked done by mistake? Taking it back removes its stars with a line in the record that says why.
          </p>
          <ConfirmButton
            label="Take it back"
            confirmLabel="Yes, take it back"
            onConfirm={() => {
              parent.tell('occurrence.reverse', {
                occurrenceId: occurrence.id,
                note: 'Marked done by mistake',
              });
              onClose();
            }}
          />
        </>
      )}
    </Sheet>
  );
}

function Bonus({ child, onClose }: { child: Profile; onClose: () => void }) {
  const parent = useParent();
  const toast = useToast();
  const [stars, setStars] = useState(1);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      title={`A star for ${child.nickname}`}
      onClose={onClose}
      testId="bonus-sheet"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            tone="primary"
            busy={busy}
            testId="bonus-save"
            onClick={async () => {
              setBusy(true);
              const ok = await parent.ask('ledger.bonus', {
                entryId: newId(),
                profileId: child.id,
                stars,
                note: note.trim() === '' ? null : note,
              });
              setBusy(false);
              if (ok) {
                toast(`${stars} ${stars === 1 ? 'star' : 'stars'} for ${child.nickname}.`);
                onClose();
              }
            }}
          >
            Give
          </Button>
        </>
      }
    >
      <p>For something no mission covers: a kindness, a brave try, a big help.</p>
      <Stepper label="How many stars" value={stars} min={1} max={20} onChange={setStars} />
      <Field label="What for (optional)" hint="Kept in the record of stars.">
        <TextInput value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} />
      </Field>
    </Sheet>
  );
}
