import type { ReactNode } from 'react';
import './pictures/pictures.css';

/**
 * A drawing, in a square. Every picture in the house — a mission, a step, a reward, a thing to buy, an animal —
 * is drawn on the same 100-by-100 square and shown through this, so a card never has to know how its picture
 * was made.
 *
 * `play` lets the parts that can move, move. `label` is what a screen reader says; without it the picture is
 * decoration and is hidden from one (the words beside it say the same thing).
 */
export interface PictureProps {
  children: ReactNode;
  play?: boolean;
  label?: string;
  className?: string;
}

export function Picture({ children, play = false, label, className }: PictureProps) {
  return (
    <svg
      className={className ? `pic ${className}` : 'pic'}
      viewBox="0 0 100 100"
      data-play={play ? 'true' : 'false'}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {children}
    </svg>
  );
}
