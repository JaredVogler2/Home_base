import type { ActionPictureId } from '../../../shared/pictures';
import { P } from '../palette';
import { BasketBack, BasketFront, Bubble, Face, Ground, Sparkle, type Art } from './kit';

/**
 * Things to do, first sheet. Each drawing shows the doing — the block going into the box, the brush on the tooth —
 * so that a child who cannot read, and has not been told, can still see what is wanted.
 */

const blocks: Art = () => (
  <>
    <Ground rx={36} />
    <rect x="18" y="50" width="64" height="34" rx="7" fill={P.woodDeep} />
    <rect x="27" y="40" width="20" height="20" rx="4.5" fill={P.blue} />
    <rect x="31" y="44" width="7" height="7" rx="2.5" fill={P.blueLight} opacity="0.8" />
    <rect x="52" y="44" width="18" height="18" rx="4.5" fill={P.sage} />
    <g className="pa-drop">
      <rect x="39" y="12" width="22" height="22" rx="5" fill={P.red} />
      <rect x="43.5" y="16.5" width="8" height="8" rx="2.5" fill={P.terraLight} opacity="0.85" />
    </g>
    <rect x="14" y="56" width="72" height="30" rx="8" fill={P.wood} />
    <rect x="14" y="56" width="72" height="9" rx="4.5" fill={P.woodLight} />
    <rect x="41" y="70" width="18" height="6" rx="3" fill={P.woodDeep} opacity="0.55" />
  </>
);

const Shoe = ({ x, y, fill, className }: { x: number; y: number; fill: string; className?: string }) => (
  <g className={className} transform={`translate(${x} ${y})`}>
    <path d="M0 16 Q0 0 10 0 Q15 0 18 7 Q27 9 33 12 Q38 14 38 20 V22 H0 Z" fill={fill} />
    <rect x="-1" y="20" width="40" height="6" rx="3" fill={P.cream} />
    <path d="M12 8 l5 4 M17 6 l5 5" stroke={P.cream} strokeWidth="2.4" strokeLinecap="round" />
    <path
      d="M2 5 Q5 0 10 0"
      fill="none"
      stroke={P.white}
      strokeWidth="2.4"
      strokeLinecap="round"
      opacity="0.5"
    />
  </g>
);

const shoes: Art = () => (
  <>
    <Ground rx={36} />
    <BasketBack y={58} w={66} />
    <Shoe x={22} y={36} fill={P.teal} />
    <g className="pa-drop">
      <g transform="rotate(-14 62 26)">
        <Shoe x={44} y={10} fill={P.teal} />
      </g>
    </g>
    <BasketFront y={58} w={66} h={28} />
  </>
);

const toothbrush: Art = () => (
  <>
    <Ground rx={26} />
    {/* a tooth, glad to be brushed */}
    <path
      d="M30 34 Q30 20 50 20 Q70 20 70 34 Q70 48 65 60 Q62 74 57 74 Q53 74 52 62 Q51 56 50 56 Q49 56 48 62 Q47 74 43 74 Q38 74 35 60 Q30 48 30 34 Z"
      fill={P.white}
      stroke={P.blueLight}
      strokeWidth="2.5"
    />
    <path d="M36 32 Q37 25 46 24" fill="none" stroke={P.blueLight} strokeWidth="3" strokeLinecap="round" />
    <Face x={50} y={40} />
    <g className="pa-scrub">
      <g transform="rotate(-18 60 30)">
        <rect
          x="40"
          y="6"
          width="26"
          height="10"
          rx="3"
          fill={P.white}
          stroke={P.blueLight}
          strokeWidth="1.6"
        />
        <path d="M42 6 q11 -9 22 0 z" fill={P.sage} />
        <rect x="38" y="14" width="54" height="8" rx="4" fill={P.blue} />
        <rect x="42" y="15.5" width="20" height="2.6" rx="1.3" fill={P.blueLight} opacity="0.8" />
      </g>
    </g>
    <Bubble x={22} y={24} r={5} className="pa-twinkle" />
    <Bubble x={80} y={48} r={4} className="pa-twinkle pa-d2" />
    <Sparkle x={78} y={22} s={0.9} className="pa-twinkle pa-d1" />
  </>
);

const table: Art = () => (
  <>
    <rect x="8" y="22" width="84" height="60" rx="10" fill={P.sageLight} />
    <rect
      x="8"
      y="22"
      width="84"
      height="60"
      rx="10"
      fill="none"
      stroke={P.sage}
      strokeWidth="2.5"
      strokeDasharray="5 5"
    />
    <circle cx="50" cy="52" r="23" fill={P.white} stroke={P.blueLight} strokeWidth="2.5" />
    <circle cx="50" cy="52" r="14" fill={P.cream} stroke={P.blueLight} strokeWidth="2" />
    {/* the fork, arriving */}
    <g className="pa-slide">
      <rect x="17" y="46" width="5" height="26" rx="2.5" fill={P.inkSoft} />
      <path
        d="M13 30 v12 q0 5 6.5 5 q6.5 0 6.5 -5 v-12"
        fill="none"
        stroke={P.inkSoft}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M19.5 30 v12" stroke={P.inkSoft} strokeWidth="3" strokeLinecap="round" />
    </g>
    {/* the spoon, already there */}
    <rect x="78" y="46" width="5" height="26" rx="2.5" fill={P.inkSoft} />
    <ellipse cx="80.5" cy="38" rx="6.5" ry="9" fill={P.inkSoft} />
    <ellipse cx="79" cy="36" rx="2.5" ry="4.5" fill={P.white} opacity="0.45" />
  </>
);

const wake: Art = () => (
  <>
    <rect x="6" y="10" width="88" height="78" rx="14" fill={P.blueLight} />
    <g className="pa-rise">
      <g stroke={P.honey} strokeWidth="4" strokeLinecap="round">
        <path d="M50 18 v-7" />
        <path d="M28 28 l-5 -5" />
        <path d="M72 28 l5 -5" />
        <path d="M19 50 h-7" />
        <path d="M81 50 h7" />
      </g>
      <circle cx="50" cy="52" r="23" fill={P.honey} />
      <path d="M33 44 Q38 32 50 31" fill="none" stroke={P.honeyLight} strokeWidth="4" strokeLinecap="round" />
      <Face x={50} y={50} />
    </g>
    <path d="M6 66 Q30 54 50 64 Q72 74 94 62 V78 Q94 88 84 88 H16 Q6 88 6 78 Z" fill={P.sage} />
    <path
      d="M6 74 Q34 66 58 76 Q76 82 94 74 V78 Q94 88 84 88 H16 Q6 88 6 78 Z"
      fill={P.sageDeep}
      opacity="0.55"
    />
  </>
);

const breakfast: Art = () => (
  <>
    <Ground rx={34} />
    <g className="pa-float">
      <path
        d="M40 30 q-4 -6 0 -11 q4 -5 0 -10"
        fill="none"
        stroke={P.creamShade}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </g>
    <g className="pa-float pa-d2">
      <path
        d="M56 30 q-4 -6 0 -11 q4 -5 0 -10"
        fill="none"
        stroke={P.creamShade}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </g>
    <ellipse cx="46" cy="46" rx="33" ry="9" fill={P.cream} />
    <g fill={P.honey}>
      <circle cx="32" cy="45" r="4.5" />
      <circle cx="44" cy="43" r="4.5" />
      <circle cx="56" cy="46" r="4.5" />
      <circle cx="38" cy="49" r="4" />
    </g>
    <circle cx="50" cy="49" r="3.6" fill={P.red} />
    <path d="M13 46 Q13 82 46 82 Q79 82 79 46 Q46 58 13 46 Z" fill={P.blue} />
    <path
      d="M19 54 Q22 72 36 77"
      fill="none"
      stroke={P.blueLight}
      strokeWidth="4"
      strokeLinecap="round"
      opacity="0.7"
    />
    <rect x="30" y="80" width="32" height="7" rx="3.5" fill={P.blueDeep} />
    <g className="pa-tilt">
      <rect x="70" y="26" width="6" height="34" rx="3" fill={P.inkSoft} transform="rotate(24 73 43)" />
      <ellipse cx="84" cy="22" rx="7" ry="9.5" fill={P.inkSoft} transform="rotate(24 84 22)" />
    </g>
  </>
);

const pajamas: Art = () => (
  <>
    <Ground rx={30} />
    {/* top */}
    <path
      d="M30 16 L42 12 Q50 20 58 12 L70 16 L86 30 L76 42 L68 36 V58 H32 V36 L24 42 L14 30 Z"
      fill={P.lav}
    />
    <path d="M42 12 Q50 20 58 12 L54 11 Q50 15 46 11 Z" fill={P.lavDeep} />
    <path d="M50 20 V58" stroke={P.lavDeep} strokeWidth="2.2" strokeLinecap="round" opacity="0.6" />
    <circle cx="50" cy="30" r="2.2" fill={P.cream} />
    <circle cx="50" cy="40" r="2.2" fill={P.cream} />
    <circle cx="50" cy="50" r="2.2" fill={P.cream} />
    <path d="M40 30 a6 6 0 1 0 5 9 a5 5 0 0 1 -5 -9 z" fill={P.honey} />
    <Sparkle x={62} y={44} s={0.7} fill={P.honeyLight} className="pa-twinkle" />
    {/* bottoms */}
    <path d="M32 62 H68 L72 88 H55 L50 72 L45 88 H28 Z" fill={P.lav} />
    <rect x="32" y="62" width="36" height="6" rx="3" fill={P.lavDeep} />
    <Sparkle x={38} y={78} s={0.6} fill={P.honeyLight} className="pa-twinkle pa-d2" />
    <Sparkle x={63} y={80} s={0.6} fill={P.honeyLight} className="pa-twinkle pa-d1" />
  </>
);

const story: Art = () => (
  <>
    <Ground rx={38} cy={86} />
    <Sparkle x={30} y={20} s={1} className="pa-float" />
    <Sparkle x={52} y={14} s={1.2} className="pa-float pa-d1" />
    <Sparkle x={72} y={22} s={0.9} className="pa-float pa-d2" />
    <path d="M8 40 Q30 30 50 40 Q70 30 92 40 V82 Q70 72 50 82 Q30 72 8 82 Z" fill={P.terra} />
    <path d="M13 38 Q32 28 50 39 V78 Q32 68 13 77 Z" fill={P.paper} />
    <path d="M87 38 Q68 28 50 39 V78 Q68 68 87 77 Z" fill={P.paper} />
    <path d="M50 39 V78" stroke={P.creamShade} strokeWidth="3" strokeLinecap="round" />
    <g stroke={P.creamShade} strokeWidth="2.6" strokeLinecap="round">
      <path d="M20 46 Q32 40 43 46" fill="none" />
      <path d="M20 55 Q32 49 43 55" fill="none" />
      <path d="M20 64 Q32 58 43 64" fill="none" />
    </g>
    <circle cx="68" cy="52" r="9" fill={P.honey} />
    <path d="M58 68 Q68 60 79 66" fill="none" stroke={P.sage} strokeWidth="4" strokeLinecap="round" />
    <path d="M74 32 v20 l4 -4 l4 4 v-22 z" fill={P.red} />
  </>
);

export const ACTIONS_A: Partial<Record<ActionPictureId, Art>> = {
  blocks,
  shoes,
  toothbrush,
  table,
  wake,
  breakfast,
  pajamas,
  story,
};
