import { useEffect, useState } from 'react';
import { P } from '../../art/palette';
import styles from './GentleTimer.module.css';

/**
 * A timer for a mission that takes a while — two minutes of teeth, five of tidying.
 *
 * It is a help, never a hurry: a child starts it themselves, it shows a ring quietly filling with no numbers,
 * nothing turns red, and nothing happens when it is full except that Tock says so. "I did it" works whether the
 * timer was used or not, finished or not. In calm mode the ring moves on in small steps instead of sweeping.
 */
export function GentleTimer({
  seconds,
  onDone,
  word,
}: {
  seconds: number;
  onDone: () => void;
  /** A word under it, for a child beginning to read. */
  word?: boolean;
}) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const running = startedAt !== null && elapsed < seconds;
  const full = startedAt !== null && elapsed >= seconds;

  useEffect(() => {
    if (startedAt === null) return;
    const tick = () => {
      const now = Math.min(seconds, Math.floor((Date.now() - startedAt) / 1000));
      setElapsed(now);
      if (now >= seconds) {
        window.clearInterval(timer);
        onDone();
      }
    };
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt, seconds]);

  const share = startedAt === null ? 0 : Math.min(1, elapsed / seconds);
  const round = 2 * Math.PI * 40;
  return (
    <button
      type="button"
      className={styles.timer}
      data-state={full ? 'full' : running ? 'running' : 'ready'}
      data-testid="mission-timer"
      aria-label={
        full ? 'Timer: time is up. Tap to start again.' : running ? 'Timer: running' : 'Timer: tap to start'
      }
      onClick={() => {
        // Tapping while it runs does nothing: a small child taps things twice.
        if (running) return;
        setElapsed(0);
        setStartedAt(Date.now());
      }}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle cx="50" cy="50" r="40" fill={P.paper} stroke={P.honeyLight} strokeWidth="10" />
        <circle
          className={styles.ring}
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke={P.honey}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${round * share} ${round}`}
          transform="rotate(-90 50 50)"
        />
        {full ? (
          <path
            d="M34 52 L46 63 L67 39"
            fill="none"
            stroke={P.sageDeep}
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <g>
            <path d="M38 30 h24 M38 70 h24" stroke={P.woodDeep} strokeWidth="5" strokeLinecap="round" />
            <path
              d="M41 32 q0 13 9 18 q9 -5 9 -18 z M41 68 q0 -13 9 -18 q9 5 9 18 z"
              fill={P.honeyLight}
              stroke={P.woodDeep}
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <path d="M44 66 q6 -9 12 0 z" fill={P.honeyDeep} />
          </g>
        )}
      </svg>
      {word && <span>Timer</span>}
    </button>
  );
}
