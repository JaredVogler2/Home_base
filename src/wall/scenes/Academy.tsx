import { useEffect, useState } from 'react';
import { checkAcademyUrl } from '../../../shared/settings';
import { Boat } from '../../art/house/Backdrop';
import { P } from '../../art/palette';
import { useWall } from '../context';
import type { Box } from '../home/layout';
import { BigButton } from './bits';
import { Frame } from './Frame';
import styles from './Academy.module.css';

/**
 * ACADEMY: the boat to the Training Academy.
 *
 * The Academy is its own place, on its own address, with its own saved games; HOMEBASE does not reach into it.
 * This room is the jetty: one big boat to tap, which takes the whole screen there. Nothing about the child goes
 * with it — no name, no token, nothing in the address.
 *
 * Coming back is the browser's "back", or opening HOMEBASE again: the Academy has no door of its own that
 * leads here (that would be a change to the Academy, which is its owner's to make). The room says so plainly,
 * in pictures for the child and in words for the grown-up.
 */

const LEFT_KEY = 'homebase.left-for-academy';

/** True once, just after coming back from the Academy. */
export function cameBackFromAcademy(): boolean {
  try {
    const left = window.sessionStorage.getItem(LEFT_KEY);
    if (!left) return false;
    window.sessionStorage.removeItem(LEFT_KEY);
    return Date.now() - Number(left) < 6 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function Academy({ origin }: { origin: Box | null }) {
  const wall = useWall();
  const academy = wall.view.household.settings.academy;
  // Checked again here, on the device, before a child's tap is ever sent anywhere: an address that is not a
  // plain https address simply does not sail. (The server has already refused anything not on its list.)
  const checked = academy.enabled && academy.url ? checkAcademyUrl(academy.url, [hostOf(academy.url)]) : null;
  const url = checked?.ok ? checked.url : null;
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    wall.tell(
      url ? 'The boat goes to the Academy. Tap the boat!' : 'The boat is resting today.',
      url ? 'point' : 'sleep',
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sail = () => {
    if (!url || leaving) return;
    setLeaving(true);
    wall.sound('open');
    wall.tell('Off we go! See you when you come back.', 'wave');
    try {
      window.sessionStorage.setItem(LEFT_KEY, String(Date.now()));
    } catch {
      // No storage: the welcome back is skipped, nothing else changes.
    }
    // A moment for the boat to set off, then the whole screen goes to the Academy.
    window.setTimeout(() => window.location.assign(url), wall.still ? 300 : 1100);
  };

  return (
    <Frame tone="pond" origin={origin} testId="scene-academy" showWho={false} floor={false}>
      <div className={styles.academy}>
        <div className={styles.water} aria-hidden="true" />
        <div className={styles.island} aria-hidden="true">
          <svg viewBox="0 0 200 160" focusable="false">
            <ellipse cx="100" cy="140" rx="96" ry="16" fill="#f3e3b5" />
            <path d="M30 138 q70 -60 140 0 z" fill="#9fd9a4" />
            <path d="M84 132 l8 -92 h16 l8 92 z" fill={P.cream} stroke="#d9c7a3" strokeWidth="3" />
            <path d="M88.5 84 h23 l1.5 18 h-26 z" fill={P.terra} />
            <rect x="86" y="22" width="28" height="20" rx="4" fill={P.honey} />
            <path d="M80 24 h40 l-20 -20 z" fill={P.terra} />
          </svg>
        </div>
        <button
          type="button"
          className={styles.boat}
          data-leaving={leaving}
          onClick={sail}
          disabled={!url}
          aria-label={url ? 'Sail to the Training Academy' : 'The Academy boat is resting'}
          data-testid="sail"
        >
          <Boat resting={!url} />
        </button>
        {url ? (
          <div className={styles.go}>
            <BigButton
              tone="go"
              word="Sail to the Academy"
              onTap={sail}
              testId="sail-button"
              disabled={leaving}
            >
              <path
                d="M22 50 h48 M54 30 l22 20 l-22 20"
                fill="none"
                stroke="#fff"
                strokeWidth="11"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </BigButton>
            <p className={styles.back}>
              <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
                <path
                  d="M22 50 L50 24 L78 50"
                  fill="none"
                  stroke={P.ink}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M30 48 V74 Q30 78 34 78 H66 Q70 78 70 74 V48" fill={P.ink} />
              </svg>
              <span>
                To come home: swipe up from the bottom of the screen and tap ◁ Back, or open HOMEBASE again.
              </span>
            </p>
          </div>
        ) : (
          <p className={styles.resting} data-testid="academy-resting">
            The boat is not going anywhere yet. A grown-up can set where it sails, on their phone: Settings →
            Training Academy.
          </p>
        )}
      </div>
    </Frame>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}
