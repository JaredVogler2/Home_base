import { useEffect, useState } from 'react';
import { P } from '../../art/palette';
import { useWall } from '../context';
import { childrenOf } from '../derive';
import type { Box } from './layout';
import { place } from './layout';
import styles from './Tour.module.css';

/**
 * The first visit: Tock shows where things are — your picture, a room, the way to hear him again — by pointing
 * at each in turn and saying what it is. Nothing has to be read and nothing has to be waited for: any tap ends
 * the showing and does whatever was tapped, and the cross ends it too. It is shown once on a screen, and again
 * whenever somebody taps Tock at the front of the house.
 */

const SEEN_KEY = 'homebase.tour-seen';

export function tourSeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    // A browser that keeps nothing would show the tour every time: once per visit is enough.
    return true;
  }
}

function markSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Nothing to do.
  }
}

export function Tour({ onDone }: { onDone: () => void }) {
  const wall = useWall();
  const { layout, view } = wall;
  const [index, setIndex] = useState(0);
  const count = childrenOf(view).length;
  const faces = layout.faces;
  const span = count * faces.size + Math.max(0, count - 1) * faces.gap;
  const facesBox: Box = {
    x: faces.cx - span / 2 - 12,
    y: faces.cy - faces.size / 2 - 12,
    w: Math.max(span, faces.size) + 24,
    h: faces.size + 24,
  };
  // A room is ringed just inside its walls, so the ring never crosses the name on the beam above it.
  const steps: { box: Box; words: string; inside?: boolean }[] = [
    { box: layout.guide, words: `Hello! I am ${view.household.settings.guideName}. This is our house.` },
    ...(count > 0 ? [{ box: facesBox, words: 'First, tap your picture.' }] : []),
    { box: layout.rooms.quest, words: 'Then tap a room to go in. Here are your missions.', inside: true },
    { box: layout.rooms.bank, words: 'Your stars live here.', inside: true },
    { box: layout.sayAgain, words: 'Tap here, and I will say it again.' },
  ];
  const step = steps[Math.min(index, steps.length - 1)];
  const last = index >= steps.length;

  // Say each thing as it is pointed at; move on by itself; stop at the end.
  useEffect(() => {
    if (last) {
      markSeen();
      wall.tell('Off you go!', 'wave');
      onDone();
      return;
    }
    const current = steps[index];
    if (current) wall.tell(current.words, index === 0 ? 'wave' : 'point');
    const timer = window.setTimeout(() => setIndex((value) => value + 1), 4600);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, last]);

  // Any tap anywhere means "I know": the showing ends, and the tap does what it was going to do.
  useEffect(() => {
    const end = () => {
      markSeen();
      onDone();
    };
    window.addEventListener('pointerdown', end, { capture: true, once: true });
    window.addEventListener('keydown', end, { capture: true, once: true });
    return () => {
      window.removeEventListener('pointerdown', end, { capture: true });
      window.removeEventListener('keydown', end, { capture: true });
    };
  }, [onDone]);

  if (!step || last) return null;
  const grow = step.inside ? -14 : 14;
  const ring = place(layout, {
    x: step.box.x - grow,
    y: step.box.y - grow,
    w: step.box.w + grow * 2,
    h: step.box.h + grow * 2,
  });
  // The hand's fingertip rests on the thing; the hand hangs below it, or comes from above when the thing is
  // at the bottom of the screen and there is no room underneath.
  const hand = layout.sheet.w * (layout.shape === 'tall' ? 0.17 : 0.08);
  const tipX = step.box.x + step.box.w * 0.62;
  const below = step.box.y + step.box.h * 0.58 + hand * 0.66 <= layout.sheet.h;
  const tipY = step.box.y + step.box.h * (below ? 0.58 : 0.36);
  return (
    <div className={styles.tour} data-testid="tour" aria-hidden="true">
      <div className={styles.ring} style={ring} />
      <svg
        className={styles.hand}
        viewBox="0 0 100 100"
        data-from={below ? 'below' : 'above'}
        style={{
          left: `${((tipX - hand * 0.3) / layout.sheet.w) * 100}%`,
          top: `${((tipY - hand * (below ? 0.34 : 0.66)) / layout.sheet.h) * 100}%`,
        }}
      >
        <g transform="rotate(-24 50 50)">
          <rect x="40" y="56" width="22" height="30" rx="8" fill={P.blue} />
          <path
            d="M32 58 V30 a6 6 0 0 1 12 0 V46 h4 a6 6 0 0 1 6 6 h2 a6 6 0 0 1 6 6 h1 a5 5 0 0 1 5 5 V60 q0 14 -18 14 q-18 0 -18 -16 z"
            fill={P.skin}
            stroke={P.skinDeep}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </div>
  );
}
