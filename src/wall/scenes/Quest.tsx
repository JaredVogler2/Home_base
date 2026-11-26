import { useEffect, useState } from 'react';
import { RETURN_REASONS, type Occurrence } from '../../../shared/model';
import { ACTION_PICTURES } from '../../../shared/pictures';
import { P } from '../../art/palette';
import { ActionPicture } from '../../art/pictures';
import { CloseGlyph, HandGlyph, TickGlyph } from '../chrome/chrome';
import { useWall } from '../context';
import { childById, isDone, isSent, isToDo, missionsFor } from '../derive';
import type { Box } from '../home/layout';
import { Badge, BigButton, Stars } from './bits';
import { Frame, Sheet } from './Frame';
import { GentleTimer } from './GentleTimer';
import styles from './Quest.module.css';
import { Who } from './Who';

/**
 * QUEST: the mission board.
 *
 * A handful of pictures pinned to a board — never a wall of chores. Tap one and it grows: the picture shows the
 * doing (the block dropping into the box), Tock says it, and there is one very large button for "I did it".
 * Nothing here can be lost: a mission not done simply is not done, and tomorrow is another board.
 */

const sayOf = (mission: Occurrence): string => mission.say ?? ACTION_PICTURES[mission.picture].say;

/** How many finished missions the tray shows (the latest ones). */
const TRAY = 8;

export function Quest({ origin }: { origin: Box | null }) {
  const wall = useWall();
  const { view, who, nowMs } = wall;
  const child = childById(view, who);
  const [openId, setOpenId] = useState<string | null>(null);
  const missions = who ? missionsFor(view, who, nowMs) : [];
  const limit = Math.max(view.household.settings.quest.showAtOnce, 3);
  // What is still to do is on the board, a few at a time. What is done is never lost sight of: while there is
  // more to do it moves to the tray along the bottom, each with its tick; when everything is done the finished
  // cards have the board to themselves.
  const finished = missions.filter(isDone);
  const waiting = missions.filter((mission) => !isDone(mission));
  const shown = waiting.length > 0 ? waiting.slice(0, limit) : finished.slice(0, limit);
  const tray = waiting.length > 0 ? finished.slice(-TRAY) : [];
  const open = missions.find((mission) => mission.id === openId) ?? null;
  const toDo = missions.filter(isToDo).length;

  useEffect(() => {
    if (!child) {
      wall.tell('Who is here? Tap your picture.', 'wave');
    } else if (missions.length === 0) {
      wall.tell(`No missions today, ${child.nickname}.`, 'idle');
    } else if (toDo === 0) {
      wall.tell(`All done, ${child.nickname}!`, 'cheer');
    } else {
      wall.tell(`${child.nickname}, tap a picture.`, 'point');
    }
    // Said once on arriving and when the child changes; not every time a star arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [child?.id]);

  return (
    <Frame tone="sage" origin={origin} testId="scene-quest">
      {!child ? (
        <Who />
      ) : missions.length === 0 ? (
        <div className={styles.empty} data-testid="quest-empty">
          <div className={styles.emptyPicture}>
            <ActionPicture id="rest" />
          </div>
        </div>
      ) : (
        <div className={styles.board}>
          <ul className={styles.cards} data-count={shown.length}>
            {shown.map((mission, index) => (
              <li
                key={mission.id}
                style={
                  { '--tilt': `${[-1.6, 1.1, -0.7, 1.5, -1.2, 0.8][index % 6]}deg` } as React.CSSProperties
                }
              >
                <MissionCard
                  mission={mission}
                  saving={wall.isSaving(mission.id)}
                  onTap={() => {
                    wall.sound('tap');
                    setOpenId(mission.id);
                    wall.tell(sayOf(mission), 'point');
                    if (mission.status === 'available')
                      wall.ask('occurrence.start', { occurrenceId: mission.id, profileId: child.id });
                  }}
                />
              </li>
            ))}
          </ul>
          {tray.length > 0 && (
            <ul className={styles.tray} data-testid="done-tray" aria-label="Done today">
              {tray.map((mission) => (
                <li key={mission.id}>
                  <button
                    type="button"
                    className={styles.stamp}
                    aria-label={`${mission.title}: done`}
                    data-testid={`done-${mission.title}`}
                    onClick={() => {
                      wall.sound('tap');
                      setOpenId(mission.id);
                      wall.tell(`${mission.title}. Done!`, 'cheer');
                    }}
                  >
                    <ActionPicture id={mission.picture} />
                    <span className={styles.stampTick}>
                      <Badge kind="done" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {open && child && <MissionSheet mission={open} profileId={child.id} onClose={() => setOpenId(null)} />}
    </Frame>
  );
}

function MissionCard({
  mission,
  saving,
  onTap,
}: {
  mission: Occurrence;
  saving: boolean;
  onTap: () => void;
}) {
  const wall = useWall();
  const state = isDone(mission)
    ? 'done'
    : isSent(mission)
      ? 'sent'
      : mission.status === 'returned'
        ? 'again'
        : 'todo';
  const words = { done: 'done', sent: 'waiting for a grown-up', again: 'have another go', todo: 'to do' }[
    state
  ];
  return (
    <button
      type="button"
      className={styles.card}
      data-state={state}
      onClick={onTap}
      aria-label={`${mission.title}${mission.kind === 'bonus' ? ' (an extra)' : ''}: ${words}`}
      data-kind={mission.kind}
      data-testid={`mission-${mission.title}`}
    >
      <span className={styles.pin} aria-hidden="true" />
      {/* An extra to choose, not part of the day: a ribbon on the card's corner. Never a star — stars are stars. */}
      {mission.kind === 'bonus' && (
        <svg className={styles.extra} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
          <path d="M0 0 H40 L0 40 Z" fill={P.lav} />
          <path d="M12 5 Q13 11 19 12 Q13 13 12 19 Q11 13 5 12 Q11 11 12 5 Z" fill={P.white} />
        </svg>
      )}
      <span className={styles.picture}>
        <ActionPicture id={mission.picture} />
      </span>
      {wall.labels && <span className={styles.title}>{mission.title}</span>}
      {mission.stars > 0 && (
        <Stars
          filled={state === 'done' ? mission.stars : 0}
          of={mission.stars}
          size="2.5cqw"
          label={`${mission.stars} ${mission.stars === 1 ? 'star' : 'stars'}`}
        />
      )}
      <span className={styles.corner}>
        {saving ? (
          <Badge kind="saving" />
        ) : state === 'done' ? (
          <Badge kind="done" />
        ) : state === 'sent' ? (
          <Badge kind="waiting" />
        ) : state === 'again' ? (
          <Badge kind="again" />
        ) : mission.needsAdult ? (
          <Badge kind="adult" />
        ) : null}
      </span>
    </button>
  );
}

function MissionSheet({
  mission,
  profileId,
  onClose,
}: {
  mission: Occurrence;
  profileId: string;
  onClose: () => void;
}) {
  const wall = useWall();
  const [ticked, setTicked] = useState<string[]>([]);
  const done = isDone(mission);
  const sent = isSent(mission);
  const canUndo =
    (done || sent) && mission.undoUntil !== null && new Date(mission.undoUntil).getTime() > wall.nowMs;

  const didIt = () => {
    wall.ask('occurrence.submit', { occurrenceId: mission.id, profileId });
    if (mission.verification === 'auto') {
      wall.sound(mission.stars > 0 ? 'star' : 'done');
      wall.celebrate();
      wall.tell('You did it!', 'cheer');
    } else {
      wall.sound('sent');
      wall.tell('Well done! A grown-up will come and see.', 'cheer');
    }
  };

  return (
    <Sheet onClose={onClose} testId="mission-sheet" label={mission.title}>
      <div className={styles.sheet}>
        <div className={styles.show} data-done={done || sent}>
          <ActionPicture id={mission.picture} play={!done && !sent} />
          {(done || sent) && (
            <span className={styles.bigBadge}>
              <Badge kind={done ? 'done' : 'waiting'} />
            </span>
          )}
        </div>
        <div className={styles.side}>
          <h2 className={styles.heading}>{mission.title}</h2>
          {mission.stars > 0 && <Stars filled={done ? mission.stars : 0} of={mission.stars} size="3cqw" />}
          {mission.status === 'returned' && mission.returnReason && (
            <p className={styles.kind}>{RETURN_REASONS[mission.returnReason]}</p>
          )}
          {mission.needsAdult && !done && (
            <p className={styles.note}>
              <Badge kind="adult" /> <span>With a grown-up</span>
            </p>
          )}
          {mission.steps.length > 0 && !done && !sent && (
            <ul className={styles.steps} aria-label="Steps">
              {mission.steps.map((step) => {
                const on = ticked.includes(step.id);
                return (
                  <li key={step.id}>
                    <button
                      type="button"
                      className={styles.step}
                      data-on={on}
                      aria-pressed={on}
                      aria-label={step.label}
                      onClick={() => {
                        wall.sound('step');
                        setTicked((current) =>
                          on ? current.filter((id) => id !== step.id) : [...current, step.id],
                        );
                      }}
                    >
                      <ActionPicture id={step.picture} />
                      {wall.labels && <span>{step.label}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className={styles.actions}>
            {mission.timerSeconds !== null && mission.timerSeconds > 0 && !done && !sent && (
              <GentleTimer
                seconds={mission.timerSeconds}
                word={wall.labels}
                onDone={() => {
                  wall.sound('done');
                  wall.tell('Time is up. All done?', 'cheer');
                }}
              />
            )}
            {!done && !sent && (
              <BigButton tone="go" word="I did it!" onTap={didIt} testId="did-it">
                <TickGlyph />
              </BigButton>
            )}
            {done && (
              <p className={styles.status} data-testid="mission-done">
                Done!
              </p>
            )}
            {sent && (
              <p className={styles.status} data-testid="mission-sent">
                Waiting for a grown-up
              </p>
            )}
            {canUndo && (
              <BigButton
                tone="soft"
                word="Oops, not yet"
                testId="undo"
                onTap={() => {
                  wall.sound('oops');
                  wall.ask('occurrence.undo', { occurrenceId: mission.id });
                  wall.tell('That is all right. It is back on the board.', 'idle');
                }}
              >
                <path
                  d="M34 36 H60 a16 16 0 0 1 0 32 H40"
                  fill="none"
                  stroke="#3a2e4d"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M44 24 L30 36 L44 48"
                  fill="none"
                  stroke="#3a2e4d"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </BigButton>
            )}
            {!done && !sent && (
              <BigButton
                tone="plain"
                word={mission.helpAsked ? 'Help is coming' : 'Help, please'}
                testId="help"
                disabled={mission.helpAsked}
                onTap={() => {
                  wall.sound('chirp');
                  wall.ask('occurrence.help', { occurrenceId: mission.id, profileId });
                  wall.tell('I have asked a grown-up to come and help.', 'wave');
                }}
              >
                <HandGlyph />
              </BigButton>
            )}
            {!done && !sent && mission.skip === 'child' && (
              <BigButton
                tone="soft"
                word="Not today"
                testId="skip"
                onTap={() => {
                  wall.sound('back');
                  wall.ask('occurrence.skip', { occurrenceId: mission.id, profileId });
                  wall.tell('All right. Not today.', 'idle');
                  onClose();
                }}
              >
                <path d="M30 50 h40" stroke="#3a2e4d" strokeWidth="10" strokeLinecap="round" />
              </BigButton>
            )}
            <BigButton tone="soft" word="Back" onTap={onClose} testId="sheet-close">
              <CloseGlyph />
            </BigButton>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
