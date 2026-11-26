import type { ReactNode } from 'react';
import type { BadgeId } from '../../shared/badges';
import { P } from './palette';
import { Heart, Star } from './pictures/kit';

/**
 * The badges, drawn: a ribbon and a disc with one clear thing on it. Like every other drawing they carry no
 * words, and each has its own shape inside as well as its own colour, so none is told apart by colour alone.
 */

interface Look {
  ribbon: string;
  disc: string;
  rim: string;
  inside: ReactNode;
}

const dots = (count: number, radius: number, fill: string) =>
  Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    return (
      <circle
        key={index}
        cx={50 + Math.cos(angle) * radius}
        cy={56 + Math.sin(angle) * radius}
        r="2.2"
        fill={fill}
      />
    );
  });

const LOOKS: Record<BadgeId, Look> = {
  'first-star': {
    ribbon: P.blue,
    disc: P.honeyLight,
    rim: P.honey,
    inside: <Star x={50} y={56} s={1.5} />,
  },
  'stars-10': {
    ribbon: P.teal,
    disc: P.honeyLight,
    rim: P.honey,
    inside: (
      <>
        <Star x={50} y={56} s={1.15} />
        {dots(10, 20, P.honeyDeep)}
      </>
    ),
  },
  'stars-25': {
    ribbon: P.sage,
    disc: P.honeyLight,
    rim: P.honey,
    inside: (
      <>
        <Star x={41} y={58} s={1.05} />
        <Star x={60} y={52} s={1.05} />
      </>
    ),
  },
  'stars-50': {
    ribbon: P.rose,
    disc: P.honeyLight,
    rim: P.honey,
    inside: (
      <>
        <Star x={50} y={46} s={0.95} />
        <Star x={39} y={63} s={0.95} />
        <Star x={61} y={63} s={0.95} />
      </>
    ),
  },
  'stars-100': {
    ribbon: P.lav,
    disc: P.honey,
    rim: P.honeyDeep,
    inside: (
      <>
        <Star x={40} y={47} s={0.85} fill={P.white} />
        <Star x={60} y={47} s={0.85} fill={P.white} />
        <Star x={40} y={66} s={0.85} fill={P.white} />
        <Star x={60} y={66} s={0.85} fill={P.white} />
      </>
    ),
  },
  'stars-250': {
    ribbon: P.honey,
    disc: P.night,
    rim: P.lavDeep,
    inside: (
      <>
        <path d="M44 42 a15 15 0 1 0 16 22 a12 12 0 0 1 -16 -22 z" fill={P.honeyLight} />
        <Star x={64} y={46} s={0.6} />
        <Star x={66} y={66} s={0.5} />
        <Star x={36} y={68} s={0.5} />
      </>
    ),
  },
  'kind-heart': {
    ribbon: P.rose,
    disc: P.roseLight,
    rim: P.rose,
    inside: <Heart x={50} y={57} s={1.9} />,
  },
  'team-mate': {
    ribbon: P.sage,
    disc: P.sageLight,
    rim: P.sage,
    inside: (
      <>
        <circle cx="40" cy="50" r="8" fill={P.blue} />
        <circle cx="60" cy="50" r="8" fill={P.terra} />
        <path d="M28 72 q12 -18 22 -4 q10 -14 22 4 z" fill={P.sageDeep} />
      </>
    ),
  },
  sunrise: {
    ribbon: P.terra,
    disc: P.blueLight,
    rim: P.blue,
    inside: (
      <>
        <g stroke={P.honey} strokeWidth="3.4" strokeLinecap="round">
          <path d="M50 34 v6 M34 42 l4 4 M66 42 l-4 4" />
        </g>
        <path d="M34 62 a16 16 0 0 1 32 0 z" fill={P.honey} />
        <rect x="30" y="62" width="40" height="5" rx="2.5" fill={P.sageDeep} />
      </>
    ),
  },
  moonlight: {
    ribbon: P.lav,
    disc: P.night,
    rim: P.lavDeep,
    inside: (
      <>
        <path d="M46 40 a17 17 0 1 0 18 24 a14 14 0 0 1 -18 -24 z" fill={P.honeyLight} />
        <circle cx="66" cy="46" r="2.4" fill={P.white} />
        <circle cx="38" cy="68" r="1.8" fill={P.white} />
      </>
    ),
  },
  'steady-steps': {
    ribbon: P.teal,
    disc: P.tealLight,
    rim: P.teal,
    inside: (
      <g fill={P.tealDeep}>
        <ellipse cx="42" cy="62" rx="6" ry="9" transform="rotate(-14 42 62)" />
        <circle cx="37" cy="49" r="2.4" />
        <circle cx="43" cy="47" r="2.4" />
        <ellipse cx="60" cy="52" rx="6" ry="9" transform="rotate(14 60 52)" />
        <circle cx="59" cy="38" r="2.4" />
        <circle cx="65" cy="40" r="2.4" />
      </g>
    ),
  },
  saver: {
    ribbon: P.honey,
    disc: P.roseLight,
    rim: P.rose,
    inside: (
      <>
        <path d="M34 42 l6 8 M66 42 l-6 8" stroke={P.rose} strokeWidth="6" strokeLinecap="round" />
        <circle cx="50" cy="58" r="15" fill={P.rose} />
        <ellipse cx="50" cy="62" rx="8" ry="6" fill={P.roseLight} />
        <circle cx="47" cy="62" r="1.8" fill={P.roseDeep} />
        <circle cx="53" cy="62" r="1.8" fill={P.roseDeep} />
        <circle cx="44" cy="52" r="1.8" fill={P.ink} />
        <circle cx="56" cy="52" r="1.8" fill={P.ink} />
      </>
    ),
  },
  'brave-asker': {
    ribbon: P.blue,
    disc: P.blueLight,
    rim: P.blue,
    inside: (
      <>
        <rect x="43" y="60" width="14" height="14" rx="5" fill={P.blue} />
        <path
          d="M38 60 V46 a3.6 3.6 0 0 1 7.2 0 V42 a3.6 3.6 0 0 1 7.2 0 v4 a3.6 3.6 0 0 1 7.2 0 V60 q0 8 -10.8 8 q-10.8 0 -10.8 -8 z"
          fill={P.skin}
        />
      </>
    ),
  },
};

export function BadgeArt({ id }: { id: BadgeId }) {
  const look = LOOKS[id];
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false">
      <path d="M34 12 h14 l4 30 l-12 6 z" fill={look.ribbon} />
      <path d="M66 12 h-14 l-4 30 l12 6 z" fill={look.ribbon} opacity="0.8" />
      <circle cx="50" cy="56" r="34" fill={look.rim} />
      <circle cx="50" cy="56" r="28" fill={look.disc} />
      {look.inside}
    </svg>
  );
}

/** A rosette for how far a child has come: one more petal for each level, and nothing ever comes off it. */
export function LevelRosette({ level, showNumber }: { level: number; showNumber: boolean }) {
  const petals = Math.min(12, Math.max(1, level));
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false">
      <path d="M38 62 l-8 30 l14 -8 l6 10 l4 -30 z" fill={P.terra} />
      <path d="M62 62 l8 30 l-14 -8 l-6 10 l-4 -30 z" fill={P.terraDeep} />
      {Array.from({ length: 12 }, (_, index) => {
        const angle = (index / 12) * Math.PI * 2 - Math.PI / 2;
        return (
          <circle
            key={index}
            cx={50 + Math.cos(angle) * 24}
            cy={46 + Math.sin(angle) * 24}
            r="10"
            fill={index < petals ? P.honey : P.creamShade}
          />
        );
      })}
      <circle cx="50" cy="46" r="20" fill={P.paper} stroke={P.honeyDeep} strokeWidth="3" />
      {showNumber ? (
        <text
          x="50"
          y="55"
          textAnchor="middle"
          fontFamily="'Fredoka Variable', Fredoka, sans-serif"
          fontWeight="600"
          fontSize="26"
          fill={P.ink}
        >
          {level}
        </text>
      ) : (
        <Star x={50} y={47} s={1.25} />
      )}
    </svg>
  );
}
