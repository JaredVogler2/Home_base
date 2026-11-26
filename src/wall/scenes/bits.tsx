import type { CSSProperties, ReactNode } from 'react';
import { P } from '../../art/palette';
import styles from './bits.module.css';

/** Small parts that several rooms share. */

const STAR = 'M0 -10 L2.9 -3.3 L10 -2.7 L4.6 2 L6.2 9 L0 5.3 L-6.2 9 L-4.6 2 L-10 -2.7 L-2.9 -3.3 Z';

/**
 * Stars as things to see, not a number to read: `filled` bright ones, and the rest of `of` as empty places.
 * A screen reader is told the count.
 */
export function Stars({
  filled,
  of = filled,
  size = '2.2cqw',
  label,
}: {
  filled: number;
  of?: number;
  size?: string;
  label?: string;
}) {
  const total = Math.max(of, filled);
  return (
    <span
      className={styles.stars}
      role="img"
      aria-label={label ?? `${filled} ${filled === 1 ? 'star' : 'stars'}`}
      style={{ '--star': size } as CSSProperties}
    >
      {Array.from({ length: total }, (_, index) => (
        <svg
          key={index}
          viewBox="-12 -12 24 24"
          aria-hidden="true"
          focusable="false"
          data-on={index < filled}
          className={(index + 1) % 5 === 0 && index + 1 < total ? styles.fifth : undefined}
        >
          {index < filled ? (
            <path d={STAR} fill={P.honey} stroke={P.honeyDeep} strokeWidth="1.6" strokeLinejoin="round" />
          ) : (
            <path
              d={STAR}
              fill={P.paper}
              stroke={P.woodDeep}
              strokeWidth="1.6"
              strokeLinejoin="round"
              strokeDasharray="3.2 2.6"
              opacity="0.8"
            />
          )}
        </svg>
      ))}
    </span>
  );
}

/** A big button with a picture and, for those who can read, a word. */
export function BigButton({
  tone,
  word,
  onTap,
  children,
  testId,
  disabled,
}: {
  tone: 'go' | 'plain' | 'soft' | 'honey';
  word: string;
  onTap: () => void;
  children: ReactNode;
  testId?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={styles.big}
      data-tone={tone}
      onClick={onTap}
      data-testid={testId}
      disabled={disabled}
      aria-label={word}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        {children}
      </svg>
      <span className={styles.word}>{word}</span>
    </button>
  );
}

/** A small round mark on the corner of a card: done, waiting, needs a grown-up. */
export function Badge({ kind }: { kind: 'done' | 'waiting' | 'again' | 'adult' | 'saving' | 'help' }) {
  return (
    <span className={styles.badge} data-kind={kind} aria-hidden="true">
      <svg viewBox="0 0 100 100" focusable="false">
        {kind === 'done' && (
          <path
            d="M26 52 L43 68 L75 32"
            fill="none"
            stroke={P.white}
            strokeWidth="13"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {kind === 'waiting' && (
          <path
            d="M32 24 h36 l-18 26 l18 26 h-36 l18 -26 z"
            fill={P.ink}
            stroke={P.ink}
            strokeWidth="6"
            strokeLinejoin="round"
          />
        )}
        {kind === 'again' && (
          <>
            <path
              d="M70 50 a20 20 0 1 1 -8 -16"
              fill="none"
              stroke={P.ink}
              strokeWidth="10"
              strokeLinecap="round"
            />
            <path
              d="M54 22 l12 12 l-16 4 z"
              fill={P.ink}
              stroke={P.ink}
              strokeWidth="5"
              strokeLinejoin="round"
            />
          </>
        )}
        {kind === 'adult' && (
          <>
            <circle cx="38" cy="34" r="12" fill={P.ink} />
            <path d="M18 78 q20 -34 40 0 z" fill={P.ink} />
            <circle cx="68" cy="46" r="8" fill={P.ink} />
            <path d="M54 78 q14 -24 28 0 z" fill={P.ink} />
          </>
        )}
        {kind === 'help' && (
          <path
            d="M32 54 V34 a5.5 5.5 0 0 1 11 0 V28 a5.5 5.5 0 0 1 11 0 v6 a5.5 5.5 0 0 1 11 0 V56 q0 18 -16 18 q-17 0 -17 -20 z"
            fill={P.ink}
          />
        )}
        {kind === 'saving' && (
          <g fill={P.inkSoft}>
            <circle cx="30" cy="50" r="7" />
            <circle cx="50" cy="50" r="7" />
            <circle cx="70" cy="50" r="7" />
          </g>
        )}
      </svg>
    </span>
  );
}
