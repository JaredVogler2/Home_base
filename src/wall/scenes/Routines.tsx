import { useEffect, useRef, useState } from 'react';
import { newId } from '../../../shared/ids';
import type { Routine, RoutineRun, RoutineStep } from '../../../shared/model';
import { ACTION_PICTURES } from '../../../shared/pictures';
import { P } from '../../art/palette';
import { ActionPicture } from '../../art/pictures';
import { CloseGlyph, HandGlyph, HoldButton, TickGlyph } from '../chrome/chrome';
import { useWall } from '../context';
import { childById, nextStep, routineNow, routinesFor, runOf, stepsToday } from '../derive';
import type { Box } from '../home/layout';
import { Badge, BigButton } from './bits';
import { Frame } from './Frame';
import styles from './Routines.module.css';
import { Who } from './Who';

/**
 * ROUTINES: the morning, bedtime, getting out of the door.
 *
 * One step at a time, very large: what to do NOW, a smaller picture of what comes NEXT, and a row of beads for
 * how far along the whole thing is. There is no clock on it. A child taps the tick when the step is done, in
 * their own time, and most of that time is spent away from the screen doing the thing — which is the point.
 */

const sayOf = (step: RoutineStep): string => step.say ?? ACTION_PICTURES[step.picture].say;

export function Routines({ origin }: { origin: Box | null }) {
  const wall = useWall();
  const { view, who, minutes } = wall;
  const child = childById(view, who);
  const routines = routinesFor(view, who);
  const now = routineNow(view, who, minutes);
  const running = who
    ? view.runs.find((run) => run.profileId === who && run.date === view.today && run.status === 'active')
    : undefined;
  // The go being walked through on this screen stays in front when its last step is ticked, so that "all done"
  // is seen and heard — the list of routines comes back when the child taps, not the instant it is finished.
  const [walking, setWalking] = useState<string | null>(null);
  if (running && running.id !== walking) setWalking(running.id);
  const justFinished =
    !running && walking
      ? view.runs.find((run) => run.id === walking && run.profileId === who && run.status === 'completed')
      : undefined;
  const shown = running ?? justFinished;

  useEffect(() => {
    if (!child) wall.tell('Who is here? Tap your picture.', 'wave');
    else if (!shown)
      wall.tell(routines.length === 0 ? 'Nothing to do just now.' : 'What shall we do?', 'point');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [child?.id, shown?.id]);

  return (
    <Frame tone="honey" origin={origin} testId="scene-routines">
      {!child ? (
        <Who />
      ) : shown ? (
        <Runner
          run={shown}
          routine={view.routines.find((routine) => routine.id === shown.routineId) ?? null}
          onLeave={() => setWalking(null)}
        />
      ) : routines.length === 0 ? (
        <div className={styles.empty} data-testid="routines-empty">
          <div className={styles.emptyPicture}>
            <ActionPicture id="outside" />
          </div>
        </div>
      ) : (
        <ul className={styles.chooser} data-testid="routine-chooser">
          {[...routines]
            .sort((a, b) => Number(b.id === now?.id) - Number(a.id === now?.id))
            .map((routine) => {
              const run = runOf(view, routine.id, child.id);
              const steps = run?.steps ?? stepsToday(routine, view.today);
              const done = run ? steps.filter((step) => run.done[step.id] !== undefined).length : 0;
              const finished = run?.status === 'completed';
              return (
                <li key={routine.id}>
                  <button
                    type="button"
                    className={styles.routine}
                    data-now={routine.id === now?.id}
                    data-finished={finished}
                    onClick={() => {
                      wall.sound('open');
                      if (run && run.status === 'suspended') wall.ask('run.resume', { runId: run.id });
                      else if (!run)
                        wall.ask('run.start', { runId: newId(), routineId: routine.id, profileId: child.id });
                      else if (finished) wall.tell(`${routine.title} is all done today.`, 'cheer');
                    }}
                    aria-label={`${routine.title}. ${finished ? 'Finished today.' : run ? `${done} of ${steps.length} steps done.` : `${steps.length} steps.`}`}
                    data-testid={`routine-${routine.title}`}
                  >
                    <span className={styles.routinePicture}>
                      <ActionPicture id={routine.picture} />
                    </span>
                    {wall.labels && <span className={styles.routineTitle}>{routine.title}</span>}
                    <Beads steps={steps} run={run} small />
                    {finished && (
                      <span className={styles.corner}>
                        <Badge kind="done" />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
        </ul>
      )}
    </Frame>
  );
}

function Beads({
  steps,
  run,
  small = false,
}: {
  steps: RoutineStep[];
  run: RoutineRun | null;
  small?: boolean;
}) {
  const current = run ? nextStep(run)?.id : steps[0]?.id;
  return (
    <span className={styles.beads} data-small={small} aria-hidden="true">
      {steps.map((step) => {
        const state = run?.done[step.id];
        return (
          <span
            key={step.id}
            className={styles.bead}
            data-state={state ?? (step.id === current && run ? 'now' : 'todo')}
          />
        );
      })}
    </span>
  );
}

function Runner({
  run,
  routine,
  onLeave,
}: {
  run: RoutineRun;
  routine: Routine | null;
  onLeave: () => void;
}) {
  const wall = useWall();
  // A finished go has no "now", even if a step that may be left out was left out.
  const step = run.status === 'completed' ? null : nextStep(run);
  const index = step ? run.steps.findIndex((candidate) => candidate.id === step.id) : run.steps.length;
  const after = step
    ? (run.steps.slice(index + 1).find((candidate) => run.done[candidate.id] === undefined) ?? null)
    : null;
  const before = index > 0 ? (run.steps[index - 1] ?? null) : null;
  const canSkip = step ? step.optional || routine?.skip === 'child' : false;
  const spoken = useRef<string | null>(null);
  const together = wall.view.household.settings.wall.holdGate;
  const askedHelp = step ? run.help.includes(step.id) : false;

  useEffect(() => {
    if (step && spoken.current !== step.id) {
      spoken.current = step.id;
      wall.tell(sayOf(step), 'point');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.id]);

  if (!step) {
    // The step ticked last, in the routine's own order: the one a slip of the finger would have been on.
    const lastDone =
      [...run.steps].reverse().find((candidate) => run.done[candidate.id] !== undefined) ?? null;
    return (
      <div className={styles.finished} data-testid="routine-finished">
        <div className={styles.finishedPicture}>
          <ActionPicture id={routine?.picture ?? 'rest'} />
          <span className={styles.finishedTick}>
            <Badge kind="done" />
          </span>
        </div>
        <Beads steps={run.steps} run={run} />
        <p className={styles.finishedWords}>All done!</p>
        <div className={styles.finishedActions}>
          {lastDone && (
            <BigButton
              tone="soft"
              word="Oops, back"
              testId="routine-undo"
              onTap={() => {
                // The last tick was a slip: it is taken back like any other, and the routine carries on.
                wall.sound('oops');
                wall.ask('run.step', { runId: run.id, stepId: lastDone.id, state: 'undo' });
                wall.tell('That is all right. One more to do.', 'idle');
              }}
            >
              <path
                d="M72 50 h-44 M42 34 l-16 16 l16 16"
                fill="none"
                stroke={P.ink}
                strokeWidth="9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </BigButton>
          )}
          <BigButton tone="soft" word="Back" testId="routine-leave" onTap={onLeave}>
            <CloseGlyph />
          </BigButton>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.runner} data-testid="routine-runner">
      <Beads steps={run.steps} run={run} />
      <div className={styles.track}>
        <div className={styles.before} aria-hidden="true">
          {before && (
            <>
              <ActionPicture id={before.picture} />
              <span className={styles.beforeTick}>
                <Badge kind="done" />
              </span>
            </>
          )}
        </div>
        <div className={styles.now} data-testid="step-now" aria-label={`Now: ${step.title}`}>
          <ActionPicture id={step.picture} play />
          {wall.labels && <span className={styles.nowTitle}>{step.title}</span>}
          {step.needsAdult && (
            <span className={styles.nowBadge}>
              <Badge kind="adult" />
            </span>
          )}
        </div>
        <div className={styles.next} aria-label={after ? `Next: ${after.title}` : 'That is the last one'}>
          {after ? (
            <>
              <ActionPicture id={after.picture} />
              <svg className={styles.nextMark} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
                <circle cx="50" cy="50" r="46" fill={P.honey} />
                <path
                  d="M40 30 L70 50 L40 70 Z"
                  fill={P.ink}
                  stroke={P.ink}
                  strokeWidth="6"
                  strokeLinejoin="round"
                />
              </svg>
            </>
          ) : (
            <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
              <path d="M30 86 V18" stroke={P.woodDeep} strokeWidth="7" strokeLinecap="round" />
              <path d="M33 20 h44 l-12 15 l12 15 h-44 z" fill={P.sageDeep} />
            </svg>
          )}
        </div>
      </div>
      <div className={styles.actions}>
        <BigButton
          tone="go"
          word="Done"
          testId="step-done"
          onTap={() => {
            wall.sound(after ? 'step' : 'done');
            wall.ask('run.step', { runId: run.id, stepId: step.id, state: 'done' });
            if (!after) {
              wall.celebrate();
              wall.tell('All done! Well done.', 'cheer');
            }
          }}
        >
          <TickGlyph />
        </BigButton>
        <BigButton
          tone="plain"
          word={askedHelp ? 'Help is coming' : 'Help, please'}
          testId="step-help"
          disabled={askedHelp}
          onTap={() => {
            wall.sound('chirp');
            wall.ask('run.step', { runId: run.id, stepId: step.id, state: 'help' });
            wall.tell('I have asked a grown-up to come and help.', 'wave');
          }}
        >
          <HandGlyph />
        </BigButton>
        {canSkip && (
          <BigButton
            tone="soft"
            word="Leave it out"
            testId="step-skip"
            onTap={() => {
              wall.sound('back');
              wall.ask('run.step', { runId: run.id, stepId: step.id, state: 'skipped' });
            }}
          >
            <path
              d="M28 50 h44 M58 34 l16 16 l-16 16"
              fill="none"
              stroke={P.ink}
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </BigButton>
        )}
        {before && (
          <BigButton
            tone="soft"
            word="Oops, back"
            testId="step-back"
            onTap={() => {
              wall.sound('oops');
              wall.ask('run.step', { runId: run.id, stepId: before.id, state: 'undo' });
            }}
          >
            <path
              d="M72 50 h-44 M42 34 l-16 16 l16 16"
              fill="none"
              stroke={P.ink}
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </BigButton>
        )}
        {together && (
          <HoldButton
            label="Together: we did that together"
            className={styles.together}
            testId="step-together"
            onHeld={() => {
              wall.sound('step');
              wall.ask('run.together', { runId: run.id, stepId: step.id });
            }}
          >
            <Badge kind="adult" />
            <span>Together</span>
          </HoldButton>
        )}
      </div>
    </div>
  );
}
