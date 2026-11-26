import { useRef, type CSSProperties, type ReactNode } from 'react';
import type { Profile } from '../../../shared/model';
import { Tock, type TockPose } from '../../art/guide/Tock';
import { P } from '../../art/palette';
import { Avatar } from '../../art/pictures';
import styles from './chrome.module.css';

/**
 * The few controls that are on every screen of the wall, each drawn as what it does: a house to go home, a
 * loudspeaker to hear it again, a face for who is playing. They are big, they are low, and they are never
 * hover-only or drag-only: one tap each.
 */

/** A face in a ring: one of the family. The one who is playing is larger, ringed and lifted. */
export function Face({
  profile,
  active = false,
  onTap,
  style,
  quiet = false,
}: {
  profile: Pick<Profile, 'id' | 'nickname' | 'avatar'>;
  active?: boolean;
  onTap?: () => void;
  style?: CSSProperties;
  quiet?: boolean;
}) {
  const content = (
    <>
      <span className={styles.faceRing} aria-hidden="true" />
      <span className={styles.facePicture}>
        <Avatar id={profile.avatar} />
      </span>
    </>
  );
  if (!onTap) {
    return (
      <span
        className={styles.face}
        data-active={active}
        data-quiet={quiet}
        style={style}
        role="img"
        aria-label={profile.nickname}
      >
        {content}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={styles.face}
      data-active={active}
      data-quiet={quiet}
      style={style}
      onClick={onTap}
      aria-pressed={active}
      aria-label={active ? `${profile.nickname} is playing` : `${profile.nickname}`}
      data-testid={`face-${profile.nickname}`}
    >
      {content}
    </button>
  );
}

/** A round picture button. `tone` is its colour family; the picture inside says what it does. */
export function RoundButton({
  label,
  onTap,
  tone = 'honey',
  children,
  style,
  testId,
  disabled,
}: {
  label: string;
  onTap: () => void;
  tone?: 'honey' | 'paper' | 'sage' | 'terra' | 'blue';
  children: ReactNode;
  style?: CSSProperties;
  testId?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={styles.round}
      data-tone={tone}
      onClick={onTap}
      aria-label={label}
      style={style}
      data-testid={testId}
      disabled={disabled}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        {children}
      </svg>
    </button>
  );
}

export const HomeGlyph = () => (
  <>
    <path
      d="M22 50 L50 24 L78 50"
      fill="none"
      stroke={P.ink}
      strokeWidth="9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M30 48 V74 Q30 78 34 78 H66 Q70 78 70 74 V48" fill={P.ink} />
    <rect x="44" y="58" width="12" height="20" rx="3" fill={P.honey} />
  </>
);

export const SpeakerGlyph = () => (
  <>
    <path
      d="M24 42 h12 l18 -15 v46 l-18 -15 h-12 z"
      fill={P.ink}
      stroke={P.ink}
      strokeWidth="5"
      strokeLinejoin="round"
    />
    <path d="M64 38 q10 12 0 24" fill="none" stroke={P.ink} strokeWidth="6.5" strokeLinecap="round" />
    <path d="M73 28 q19 22 0 44" fill="none" stroke={P.ink} strokeWidth="6.5" strokeLinecap="round" />
  </>
);

export const BackGlyph = () => (
  <path
    d="M58 26 L34 50 L58 74"
    fill="none"
    stroke={P.ink}
    strokeWidth="10"
    strokeLinecap="round"
    strokeLinejoin="round"
  />
);

export const TickGlyph = ({ colour = P.white }: { colour?: string }) => (
  <path
    d="M26 52 L43 68 L75 32"
    fill="none"
    stroke={colour}
    strokeWidth="12"
    strokeLinecap="round"
    strokeLinejoin="round"
  />
);

export const HandGlyph = () => (
  <>
    <rect x="40" y="56" width="22" height="26" rx="8" fill={P.blue} />
    <path
      d="M32 54 V34 a5.5 5.5 0 0 1 11 0 V28 a5.5 5.5 0 0 1 11 0 v6 a5.5 5.5 0 0 1 11 0 V54 q0 12 -16 12 q-17 0 -17 -12 z"
      fill={P.skin}
    />
    <path
      d="M68 44 a5 5 0 0 1 9 3 l-5 12"
      fill="none"
      stroke={P.skin}
      strokeWidth="9"
      strokeLinecap="round"
    />
  </>
);

export const KeyGlyph = () => (
  <g fill="none" stroke={P.ink} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="34" cy="50" r="13" />
    <path d="M47 50 h32 m-8 0 v12 m-12 -12 v9" />
  </g>
);

export const CloseGlyph = () => (
  <path d="M30 30 L70 70 M70 30 L30 70" fill="none" stroke={P.ink} strokeWidth="10" strokeLinecap="round" />
);

export const WaitGlyph = ({ colour = P.ink }: { colour?: string }) => (
  <path
    d="M30 22 h40 l-20 28 l20 28 h-40 l20 -28 z"
    fill={colour}
    stroke={colour}
    strokeWidth="6"
    strokeLinejoin="round"
  />
);

/** Tock, with what he is saying beside him. Tapping him says it again. */
export function Guide({
  words,
  pose,
  onTap,
  style,
  side = 'left',
  name,
}: {
  words: string;
  pose: TockPose;
  onTap: () => void;
  style?: CSSProperties;
  /**
   * Where his words go, chosen so that they never lie over something to tap: `left` beside him (a room on a
   * wide screen), `up` over him (a room on a tall one), `lawn` over him and away to the right (the house, wide),
   * `path` beside his head (the house, tall).
   */
  side?: 'left' | 'up' | 'lawn' | 'path';
  name: string;
}) {
  return (
    <div className={styles.guide} style={style} data-side={side}>
      {words && (
        <p className={styles.bubble} aria-live="polite" data-testid="guide-words">
          {words}
        </p>
      )}
      <button
        type="button"
        className={styles.guideButton}
        onClick={onTap}
        aria-label={`${name} says: ${words || 'hello'}. Tap to hear it again.`}
        data-testid="guide"
      >
        <Tock pose={pose} />
      </button>
    </div>
  );
}

/**
 * A press that has to be held. For the things on the wall a grown-up does and a small child should not do by
 * accident — it is a guard against stray fingers, not a lock (the lock is the PIN).
 */
export function HoldButton({
  label,
  onHeld,
  children,
  className,
  style,
  ms = 1600,
  testId,
}: {
  label: string;
  onHeld: () => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  ms?: number;
  testId?: string;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const begin = () => {
    cancel();
    timer.current = setTimeout(() => {
      timer.current = null;
      onHeld();
    }, ms);
  };
  return (
    <button
      type="button"
      className={className ? `${styles.hold} ${className}` : styles.hold}
      style={{ ...style, '--hold-ms': `${ms}ms` } as CSSProperties}
      aria-label={`${label} (press and hold)`}
      onPointerDown={begin}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(event) => event.preventDefault()}
      // A keyboard or a switch cannot "hold": Enter does it, which is no easier for a toddler to find.
      onKeyDown={(event) => {
        if (event.key === 'Enter') onHeld();
      }}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

/** One word under a picture, for a child beginning to read. Never the only way to know what something is. */
export function Label({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span className={styles.label} style={style} aria-hidden="true">
      {children}
    </span>
  );
}

/** Where things stand with the server: nothing when all is well; a small cloud when saving or out of touch. */
export function StatusCloud({ online, pending }: { online: boolean; pending: number }) {
  if (online && pending === 0) return null;
  const words = !online
    ? pending > 0
      ? 'Out of touch. What you did is kept and will be sent.'
      : 'Out of touch. Showing what was here last.'
    : 'Saving…';
  return (
    <div
      className={styles.status}
      role="status"
      data-state={online ? 'saving' : 'offline'}
      data-testid="status"
    >
      <svg viewBox="0 0 100 70" aria-hidden="true" focusable="false">
        <path
          d="M24 60 a18 18 0 0 1 2 -36 a24 24 0 0 1 46 6 a15 15 0 0 1 2 30 z"
          fill={online ? P.paper : P.creamShade}
          stroke={P.inkSoft}
          strokeWidth="5"
          strokeLinejoin="round"
        />
        {online ? (
          <g fill={P.inkSoft}>
            <circle cx="36" cy="44" r="4.5" />
            <circle cx="50" cy="44" r="4.5" />
            <circle cx="64" cy="44" r="4.5" />
          </g>
        ) : (
          <path d="M38 34 L62 54 M62 34 L38 54" stroke={P.inkSoft} strokeWidth="6" strokeLinecap="round" />
        )}
      </svg>
      <span className={styles.statusWords}>{words}</span>
    </div>
  );
}
