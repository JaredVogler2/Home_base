import { P } from '../palette';
import './tock.css';

/**
 * Tock, the bluebird who lives behind the little door of the day clock.
 *
 * Tock is how the house talks to a child who cannot read: he looks at what he means, lifts a wing at it, and is
 * glad when it is done. He is drawn in parts — body, tail, two wings, crest, face — so that each can move a
 * little. He never moves fast, never flashes, and when motion is switched off he simply holds the pose.
 */
export type TockPose = 'idle' | 'wave' | 'point' | 'cheer' | 'think' | 'sleep' | 'listen';

export function Tock({
  pose = 'idle',
  flip = false,
  label,
}: {
  pose?: TockPose;
  flip?: boolean;
  label?: string;
}) {
  const asleep = pose === 'sleep';
  return (
    <svg
      className="tock"
      data-pose={pose}
      viewBox="0 0 200 210"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
    >
      <ellipse cx="100" cy="199" rx="56" ry="9" fill={P.ink} opacity="0.16" />
      <g className="tock-body">
        <g stroke="#c9742c" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M84 170 v22 m-12 5 l12 -5 l12 5" />
          <path d="M118 170 v22 m-12 5 l12 -5 l12 5" />
        </g>
        {/* the cocked tail */}
        <g className="tock-tail" fill={P.blueDeep}>
          <rect x="24" y="64" width="26" height="74" rx="13" transform="rotate(-38 37 138)" />
          <rect x="40" y="56" width="24" height="76" rx="12" transform="rotate(-22 52 132)" />
        </g>
        <path
          d="M100 38 c44 0 66 34 66 72 c0 40 -28 66 -66 66 c-38 0 -66 -26 -66 -66 c0 -38 22 -72 66 -72 z"
          fill={P.blue}
        />
        <path
          d="M100 38 c44 0 66 34 66 72 c0 14 -4 27 -10 37 c2 -44 -20 -92 -72 -106 c5 -2 10 -3 16 -3 z"
          fill={P.blueDeep}
          opacity="0.35"
        />
        <path
          d="M54 124 c4 34 22 50 48 50 c28 0 46 -18 50 -52 c-14 -14 -30 -20 -50 -20 c-20 0 -36 8 -48 22 z"
          fill="#ffb98a"
        />
        <ellipse cx="102" cy="152" rx="30" ry="20" fill="#fff3e2" />
        <path
          className="tock-wing-rest"
          d="M40 108 c-6 30 6 50 30 56 c-8 -22 -8 -40 -2 -58 c-10 -6 -20 -6 -28 2 z"
          fill={P.blueDeep}
        />
        <g className="tock-wing">
          <path d="M152 118 c26 -8 40 -30 40 -56 c-24 4 -42 18 -50 42 z" fill={P.blueDeep} />
          <path
            d="M158 106 c14 -8 22 -20 26 -34"
            fill="none"
            stroke={P.blue}
            strokeWidth="5"
            strokeLinecap="round"
          />
        </g>
        <path
          className="tock-crest"
          d="M92 44 c-4 -18 4 -28 14 -32 c-2 10 0 18 4 24 c4 -10 12 -16 22 -16 c-6 10 -8 18 -6 28 z"
          fill={P.blueDeep}
        />
        {asleep ? (
          <g fill="none" stroke={P.ink} strokeWidth="4.5" strokeLinecap="round">
            <path d="M70 92 q10 8 20 0" />
            <path d="M114 92 q10 8 20 0" />
          </g>
        ) : (
          <>
            <g className="tock-eyes">
              <ellipse cx="80" cy="92" rx="10" ry="12" fill={P.ink} />
              <ellipse cx="124" cy="92" rx="10" ry="12" fill={P.ink} />
            </g>
            <circle cx="83.5" cy="87.5" r="3.6" fill={P.white} />
            <circle cx="127.5" cy="87.5" r="3.6" fill={P.white} />
          </>
        )}
        <ellipse cx="64" cy="110" rx="10" ry="6.5" fill="#ff9d8a" opacity="0.9" />
        <ellipse cx="140" cy="110" rx="10" ry="6.5" fill="#ff9d8a" opacity="0.9" />
        <path
          className="tock-beak"
          d="M90 100 q12 -8 24 0 q-4 16 -12 19 q-8 -3 -12 -19 z"
          fill={P.honey}
          stroke={P.honeyDeep}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
