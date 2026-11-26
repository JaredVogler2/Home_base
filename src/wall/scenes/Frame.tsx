import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { Face, Guide, HomeGlyph, RoundButton, SpeakerGlyph } from '../chrome/chrome';
import { useWall } from '../context';
import { childById, childrenOf } from '../derive';
import type { Box } from '../home/layout';
import styles from './Frame.module.css';

/**
 * The inside of a room: what every room has in common.
 *
 * A room opens by growing out of the place on the house where it was tapped, so a child sees that this is that
 * room, bigger. In every room the way home is the same picture in the same corner, Tock is in the other with
 * his words, and the face of whoever is playing is at the top — tap it to be someone else.
 */

export type Tone = 'sage' | 'honey' | 'rose' | 'teal' | 'lav' | 'cream' | 'pond';

export function Frame({
  tone,
  origin,
  testId,
  children,
  showWho = true,
  floor = true,
}: {
  tone: Tone;
  origin: Box | null;
  testId: string;
  children: ReactNode;
  /** Show whose room this is (rooms that are the same for everyone leave it out). */
  showWho?: boolean;
  floor?: boolean;
}) {
  const wall = useWall();
  const { layout, view, who } = wall;
  const child = childById(view, who);
  const from = origin
    ? ({
        '--from-x': `${((origin.x + origin.w / 2) / layout.sheet.w) * 100}%`,
        '--from-y': `${((origin.y + origin.h / 2) / layout.sheet.h) * 100}%`,
        '--from-s': String(Math.max(0.12, origin.w / layout.sheet.w)),
      } as CSSProperties)
    : undefined;
  const guideName = view.household.settings.guideName;
  return (
    <section
      className={styles.frame}
      data-tone={tone}
      data-floor={floor}
      style={from}
      data-testid={testId}
      aria-label={testId.replace('scene-', '')}
    >
      <div className={styles.content}>{children}</div>

      {showWho && child && childrenOf(view).length > 1 && (
        <div className={styles.who}>
          <Face
            profile={child}
            active
            onTap={() => {
              wall.sound('tap');
              wall.setWho(null);
            }}
          />
        </div>
      )}

      <div className={styles.homeButton}>
        <RoundButton
          label="Home"
          tone="paper"
          testId="go-home"
          onTap={() => {
            wall.sound('back');
            wall.home();
          }}
        >
          <HomeGlyph />
        </RoundButton>
      </div>
      <div className={styles.sayButton}>
        <RoundButton
          label="Say it again"
          onTap={() => wall.tell(wall.said.words || `I am ${guideName}.`, wall.said.pose)}
          testId="say-again"
        >
          <SpeakerGlyph />
        </RoundButton>
      </div>
      <Guide
        name={guideName}
        words={wall.said.words}
        pose={wall.said.pose}
        style={{
          right: layout.shape === 'tall' ? '20%' : '8.2%',
          bottom: '1.5%',
          width: layout.shape === 'tall' ? '20%' : '8.6%',
          aspectRatio: '200 / 210',
        }}
        side={layout.shape === 'tall' ? 'up' : 'left'}
        onTap={() => {
          wall.sound('chirp');
          wall.tell(wall.said.words || `I am ${guideName}.`, 'wave');
        }}
      />
    </section>
  );
}

/** A panel that comes up over a room for one thing: a mission, a reward. Closing it is always the same button. */
export function Sheet({
  children,
  onClose,
  testId,
  label,
}: {
  children: ReactNode;
  onClose: () => void;
  testId: string;
  label: string;
}) {
  // Escape closes it, for a keyboard; a tap on the dimmed room behind it closes it, for a finger.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className={styles.veil}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={label} data-testid={testId}>
        {children}
      </div>
    </div>
  );
}
