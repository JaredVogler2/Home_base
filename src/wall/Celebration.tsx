import { useEffect } from 'react';
import { P } from '../art/palette';
import styles from './Celebration.module.css';

/**
 * A small gladness: a ring of sparkles that opens and is gone in under two seconds. No flashing, no noise of its
 * own, nothing to tap, and under calm mode or quiet hours it simply appears and fades.
 */
const RAYS = 10;

export function Celebration({ onDone }: { onDone: () => void }) {
  // It takes itself away: where nothing moves (calm mode, quiet hours) there is no fade to wait for.
  useEffect(() => {
    const timer = window.setTimeout(onDone, 1700);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className={styles.celebration} aria-hidden="true" data-testid="celebration">
      {Array.from({ length: RAYS }, (_, index) => (
        <span key={index} className={styles.ray} style={{ transform: `rotate(${(360 / RAYS) * index}deg)` }}>
          <svg
            className={styles.spark}
            viewBox="-10 -10 20 20"
            style={{ animationDelay: `${(index % 3) * 60}ms` }}
          >
            {index % 2 === 0 ? (
              <path d="M0 -8 Q1 -1 8 0 Q1 1 0 8 Q-1 1 -8 0 Q-1 -1 0 -8 Z" fill={P.honey} />
            ) : (
              <circle r="4.5" fill={[P.rose, P.teal, P.lav, P.sage, P.blue][index % 5]} />
            )}
          </svg>
        </span>
      ))}
    </div>
  );
}
