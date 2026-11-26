import type { ReactNode } from 'react';
import { P } from '../palette';

/**
 * Parts that many drawings share. Using the same sparkle, the same shadow and the same little hand everywhere is
 * most of what makes a hundred drawings look like one hand drew them.
 */

/** The soft shade a thing casts on whatever it stands on. Tinted ink, never grey. */
export function Ground({
  cx = 50,
  cy = 89,
  rx = 30,
  ry = 4.5,
}: {
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
}) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={P.ink} opacity="0.13" />;
}

/** A four-pointed glint: "clean", "new", "done". */
export function Sparkle({
  x,
  y,
  s = 1,
  fill = P.honey,
  className,
}: {
  x: number;
  y: number;
  s?: number;
  fill?: string;
  className?: string;
}) {
  return (
    <path
      className={className}
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 -7 Q1 -1 7 0 Q1 1 0 7 Q-1 1 -7 0 Q-1 -1 0 -7 Z"
      fill={fill}
    />
  );
}

/** The star that stands for one star in the bank. Only ever used to mean that. */
export function Star({
  x,
  y,
  s = 1,
  fill = P.honey,
  stroke = P.honeyDeep,
}: {
  x: number;
  y: number;
  s?: number;
  fill?: string;
  stroke?: string;
}) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 -10 L2.9 -3.3 L10 -2.7 L4.6 2 L6.2 9 L0 5.3 L-6.2 9 L-4.6 2 L-10 -2.7 L-2.9 -3.3 Z"
      fill={fill}
      stroke={stroke}
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  );
}

/** A heart, for kindness and for the things a family loves. */
export function Heart({ x, y, s = 1, fill = P.red }: { x: number; y: number; s?: number; fill?: string }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 8 C-12 0 -10 -9 -4.5 -9 C-2 -9 0 -7 0 -5 C0 -7 2 -9 4.5 -9 C10 -9 12 0 0 8 Z"
      fill={fill}
    />
  );
}

/** A drop of water. */
export function Drop({
  x,
  y,
  s = 1,
  fill = P.blue,
  className,
}: {
  x: number;
  y: number;
  s?: number;
  fill?: string;
  className?: string;
}) {
  return (
    <path
      className={className}
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 -7 C4 -1 5 1 5 3.5 A5 5 0 0 1 -5 3.5 C-5 1 -4 -1 0 -7 Z"
      fill={fill}
    />
  );
}

/** A soap bubble: a ring with a glint. */
export function Bubble({ x, y, r = 5, className }: { x: number; y: number; r?: number; className?: string }) {
  return (
    <g className={className}>
      <circle cx={x} cy={y} r={r} fill={P.blueLight} stroke={P.blue} strokeWidth="1.6" />
      <circle cx={x - r * 0.3} cy={y - r * 0.3} r={r * 0.25} fill={P.white} />
    </g>
  );
}

/** A small mitten of a hand, reaching in from an edge: "you do this". */
export function Hand({ x, y, r = 0, flip = false }: { x: number; y: number; r?: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${flip ? -1 : 1} 1)`}>
      <rect x="-6" y="2" width="12" height="16" rx="5" fill={P.blue} />
      <ellipse cx="0" cy="-3" rx="8.5" ry="8" fill={P.skin} />
      <ellipse cx="-8" cy="-2" rx="3.4" ry="4.2" fill={P.skin} />
      <ellipse cx="-2" cy="-5" rx="3" ry="2" fill={P.white} opacity="0.35" />
    </g>
  );
}

/** A friendly face for a thing that has one: two eyes and a smile. */
export function Face({
  x,
  y,
  s = 1,
  sleepy = false,
}: {
  x: number;
  y: number;
  s?: number;
  sleepy?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {sleepy ? (
        <>
          <path d="M-9 -1 q3 3 6 0" fill="none" stroke={P.ink} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M3 -1 q3 3 6 0" fill="none" stroke={P.ink} strokeWidth="2.2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="-6" cy="-1" r="2.4" fill={P.ink} />
          <circle cx="6" cy="-1" r="2.4" fill={P.ink} />
        </>
      )}
      <path d="M-4 5 q4 4 8 0" fill="none" stroke={P.ink} strokeWidth="2.2" strokeLinecap="round" />
      <ellipse cx="-11" cy="4" rx="3" ry="2" fill={P.rose} opacity="0.7" />
      <ellipse cx="11" cy="4" rx="3" ry="2" fill={P.rose} opacity="0.7" />
    </g>
  );
}

/** A wicker basket, open at the top, for anything that goes in a basket. Drawn in two halves so a thing can sit inside. */
export function BasketBack({ x = 50, y = 62, w = 60 }: { x?: number; y?: number; w?: number }) {
  return <ellipse cx={x} cy={y} rx={w / 2} ry={w * 0.11} fill={P.woodDeep} />;
}

export function BasketFront({
  x = 50,
  y = 62,
  w = 60,
  h = 26,
}: {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}) {
  const half = w / 2;
  return (
    <g>
      <path
        d={`M${x - half} ${y} L${x - half + 6} ${y + h - 5} Q${x - half + 7} ${y + h} ${x - half + 13} ${y + h} L${x + half - 13} ${y + h} Q${x + half - 7} ${y + h} ${x + half - 6} ${y + h - 5} L${x + half} ${y} Q${x} ${y + w * 0.2} ${x - half} ${y} Z`}
        fill={P.wood}
      />
      <path
        d={`M${x - half + 3} ${y + h * 0.42} Q${x} ${y + h * 0.62} ${x + half - 3} ${y + h * 0.42}`}
        fill="none"
        stroke={P.woodDeep}
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d={`M${x - half + 5} ${y + h * 0.72} Q${x} ${y + h * 0.9} ${x + half - 5} ${y + h * 0.72}`}
        fill="none"
        stroke={P.woodDeep}
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d={`M${x - half} ${y} Q${x} ${y + w * 0.2} ${x + half} ${y}`}
        fill="none"
        stroke={P.woodLight}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </g>
  );
}

export type Art = () => ReactNode;
