import type { ActionPictureId } from '../../../shared/pictures';
import { P } from '../palette';
import { Bubble, Drop, Face, Ground, Hand, Sparkle, type Art } from './kit';

/**
 * Things to do, second sheet: tidying away, washing, dressing and getting out of the door. As on the first sheet,
 * each drawing shows the doing — the ball on its way into the box, the water on its way into the bottle.
 */

/** A tap reaching in from the right. The water leaves it at (x, y). Shared by the hands and the bottle. */
const Tap = ({ x, y }: { x: number; y: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <rect x="15" y="-23.5" width="18" height="6" rx="3" fill={P.teal} />
    <rect x="21.5" y="-19" width="5" height="5" fill={P.inkSoft} />
    <path
      d="M38 -11.5 H11 Q0 -11.5 0 -5"
      fill="none"
      stroke={P.inkSoft}
      strokeWidth="9"
      strokeLinecap="round"
    />
    <rect x="-6.5" y="-6" width="13" height="6" rx="2.5" fill={P.inkSoft} />
    <path d="M35 -13.5 H12" stroke={P.white} strokeWidth="2.4" strokeLinecap="round" opacity="0.4" />
  </g>
);

/** One striped sock, toe to the right (or to the left, flipped), its cuff at (x, y). */
const Sock = ({
  x,
  y,
  s = 1,
  flip = false,
  fill = P.sage,
  deep = P.sageDeep,
  band = P.cream,
}: {
  x: number;
  y: number;
  s?: number;
  flip?: boolean;
  fill?: string;
  deep?: string;
  band?: string;
}) => (
  <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
    <path d="M0 3 H13 V19 Q13 23 18 24 Q28 25.5 28 32.5 Q28 39 20 39 H9 Q0 39 0 30 Z" fill={fill} />
    <rect x="0" y="9" width="13" height="3.4" fill={band} />
    <rect x="0" y="14.6" width="13" height="3.4" fill={band} />
    <path d="M20.5 24.5 Q28 26.4 28 32.5 Q28 39 20 39 H17.5 Q21.5 31.5 20.5 24.5 Z" fill={deep} />
    <path d="M0 27.5 Q9 29.5 10 39 H9 Q0 39 0 30 Z" fill={deep} />
    <rect x="-1.5" y="-1" width="16" height="7" rx="3.5" fill={deep} />
  </g>
);

/** A T-shirt, laid flat. Drawn full size for getting dressed, and small for the laundry. */
const Tee = ({ fill, deep }: { fill: string; deep: string }) => (
  <>
    <path
      d="M31 15 L42 11 Q50 19 58 11 L69 15 L86 29 L77 41 L68 35 V57 H32 V35 L23 41 L14 29 Z"
      fill={fill}
      stroke={fill}
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <path d="M41 11.4 Q50 20.5 59 11.4 L56 10 Q50 14.5 44 10 Z" fill={deep} />
  </>
);

/** A book standing on its end, spine out. */
const Book = ({
  x,
  y,
  w,
  h,
  fill,
  light,
  deep,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  light: string;
  deep: string;
}) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx="3" fill={fill} />
    <rect x={x + 2.5} y={y + 6} width={w - 5} height="5.5" rx="2.75" fill={light} />
    <rect x={x} y={y + h - 11} width={w} height="4" fill={deep} opacity="0.6" />
  </g>
);

const toys: Art = () => (
  <>
    <Ground rx={36} />
    <rect x="18" y="50" width="64" height="34" rx="7" fill={P.tealDeep} />
    {/* the teddy, already in */}
    <circle cx="24.5" cy="34" r="7" fill={P.wood} />
    <circle cx="49.5" cy="34" r="7" fill={P.wood} />
    <circle cx="24.5" cy="34" r="3.2" fill={P.woodLight} />
    <circle cx="49.5" cy="34" r="3.2" fill={P.woodLight} />
    <circle cx="37" cy="46" r="16" fill={P.wood} />
    <ellipse cx="37" cy="51.5" rx="8" ry="5.5" fill={P.woodLight} />
    <Face x={37} y={46} />
    {/* the ball, on its way */}
    <g className="pa-drop">
      <circle cx="69" cy="23" r="12.5" fill={P.red} />
      <path
        d="M57 19.5 Q69 25 81 19.5 A12.5 12.5 0 0 1 80.8 27 Q69 32.5 57.2 27 A12.5 12.5 0 0 1 57 19.5 Z"
        fill={P.honey}
      />
      <circle cx="64" cy="16" r="3" fill={P.white} opacity="0.5" />
    </g>
    <rect x="14" y="56" width="72" height="30" rx="8" fill={P.teal} />
    <rect x="14" y="56" width="72" height="9" rx="4.5" fill={P.tealLight} />
    <circle cx="50" cy="75" r="4.5" fill={P.honey} />
  </>
);

const laundry: Art = () => (
  <>
    <Ground rx={32} />
    <ellipse cx="50" cy="52" rx="30" ry="7" fill={P.roseDeep} />
    <path d="M28 55 Q30 43 42 46 Q50 39 59 46 Q70 44 72 55 Z" fill={P.teal} />
    {/* a sock and a shirt, on their way in */}
    <g className="pa-drop">
      <g transform="rotate(14 73 28)">
        <Sock x={63} y={12} s={0.8} fill={P.blue} deep={P.blueDeep} band={P.white} />
      </g>
    </g>
    <g className="pa-drop pa-d2">
      <g transform="translate(32 23) rotate(-12) scale(0.6) translate(-50 -34)">
        <Tee fill={P.honey} deep={P.honeyDeep} />
      </g>
    </g>
    <path d="M20 52 L26 82 Q27 88 33 88 H67 Q73 88 74 82 L80 52 Q50 66 20 52 Z" fill={P.rose} />
    <g fill={P.roseDeep} opacity="0.45">
      <rect x="34" y="66" width="5.5" height="15" rx="2.75" />
      <rect x="47.25" y="68" width="5.5" height="15" rx="2.75" />
      <rect x="60.5" y="66" width="5.5" height="15" rx="2.75" />
    </g>
    <path d="M20 52 Q50 66 80 52" fill="none" stroke={P.roseLight} strokeWidth="4" strokeLinecap="round" />
  </>
);

const bed: Art = () => (
  <>
    <Ground rx={40} />
    <rect x="77" y="24" width="12" height="64" rx="6" fill={P.wood} />
    <rect x="80" y="29" width="3.5" height="26" rx="1.75" fill={P.woodLight} />
    <rect x="18" y="70" width="64" height="10" rx="3" fill={P.woodDeep} />
    <rect x="18" y="56" width="62" height="17" rx="5" fill={P.creamShade} />
    <rect
      x="54"
      y="43"
      width="24"
      height="15"
      rx="7.5"
      fill={P.white}
      stroke={P.blueLight}
      strokeWidth="2.5"
    />
    {/* the blanket, pulled up smooth */}
    <g className="pa-slide">
      <path d="M18 60 Q18 52 26 52 H52 Q58 52 58 58 V73 Q58 77 54 77 H18 Z" fill={P.blue} />
      <rect x="48" y="52" width="10" height="25" rx="5" fill={P.blueLight} />
      <path d="M18 71 H48 V77 H18 Z" fill={P.blueDeep} opacity="0.5" />
    </g>
    <rect x="11" y="46" width="12" height="42" rx="6" fill={P.wood} />
    <rect x="14" y="51" width="3.5" height="18" rx="1.75" fill={P.woodLight} />
    <g className="pa-twinkle">
      <Sparkle x={36} y={33} s={1.2} />
      <Sparkle x={56} y={23} s={0.8} />
    </g>
  </>
);

const books: Art = () => (
  <>
    <Ground rx={38} cy={90} />
    <rect x="16" y="82" width="8" height="8" rx="3" fill={P.woodDeep} />
    <rect x="76" y="82" width="8" height="8" rx="3" fill={P.woodDeep} />
    <Book x={13} y={36} w={13} h={40} fill={P.terra} light={P.terraLight} deep={P.terraDeep} />
    {/* the one going back into its place */}
    <g className="pa-drop">
      <Book x={27.5} y={18} w={12} h={44} fill={P.rose} light={P.roseLight} deep={P.roseDeep} />
    </g>
    <Book x={41} y={28} w={14} h={48} fill={P.blue} light={P.blueLight} deep={P.blueDeep} />
    <Book x={56.5} y={38} w={12} h={38} fill={P.sage} light={P.sageLight} deep={P.sageDeep} />
    <g transform="rotate(-12 76.6 76)">
      <Book x={76.6} y={36} w={12} h={40} fill={P.honey} light={P.honeyLight} deep={P.honeyDeep} />
    </g>
    <rect x="8" y="76" width="84" height="9" rx="4.5" fill={P.wood} />
    <rect x="8" y="76" width="84" height="3.6" rx="1.8" fill={P.woodLight} />
  </>
);

const hands: Art = () => (
  <>
    <Tap x={50} y={31} />
    <rect x="46.5" y="31" width="7" height="22" rx="3.5" fill={P.blue} />
    {/* two hands, rubbing */}
    <g className="pa-scrub">
      <g transform="translate(37 62) scale(1.7)">
        <Hand x={0} y={0} r={28} />
      </g>
    </g>
    <g className="pa-scrub pa-d2">
      <g transform="translate(63 62) scale(1.7)">
        <Hand x={0} y={0} r={-28} flip />
      </g>
    </g>
    <Bubble x={46} y={53} r={6} />
    <Bubble x={56} y={59} r={4.5} />
    <Bubble x={17} y={41} r={6} />
    <Bubble x={84} y={44} r={5} />
    <Drop x={50} y={82} s={0.9} />
    <Drop x={62} y={88} s={0.6} />
  </>
);

const dress: Art = () => (
  <>
    <Ground rx={30} />
    <Tee fill={P.teal} deep={P.tealDeep} />
    <path
      d="M17 28.6 L24.2 38.2 M83 28.6 L75.8 38.2"
      stroke={P.tealDeep}
      strokeWidth="3"
      strokeLinecap="round"
    />
    {/* a sun on the front: these are for the day */}
    <circle cx="50" cy="39" r="5.5" fill={P.honey} />
    <path
      d="M50 30.5 v-3 M50 47.5 v3 M41.5 39 h-3 M58.5 39 h3 M44 33 l-2.1 -2.1 M56 33 l2.1 -2.1 M44 45 l-2.1 2.1 M56 45 l2.1 2.1"
      stroke={P.honey}
      strokeWidth="2.4"
      strokeLinecap="round"
    />
    {/* shorts */}
    <path
      d="M32 64 H68 L73 87 H54 L50 76 L46 87 H27 Z"
      fill={P.terra}
      stroke={P.terra}
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <rect x="30.5" y="62" width="39" height="7" rx="3.5" fill={P.terraDeep} />
    <path
      d="M35 73 q1 6 7 6 M65 73 q-1 6 -7 6"
      fill="none"
      stroke={P.terraLight}
      strokeWidth="2.4"
      strokeLinecap="round"
    />
  </>
);

const socks: Art = () => (
  <>
    <Ground rx={36} cy={88} />
    <Sock x={47} y={30.4} s={1.4} flip />
    {/* the other one, toes wiggling */}
    <g className="pa-wiggle">
      <g transform="rotate(6 69 50)">
        <Sock x={51} y={22} s={1.4} />
      </g>
    </g>
  </>
);

const bath: Art = () => (
  <>
    <Ground rx={38} />
    <rect x="21" y="78" width="12" height="11" rx="4.5" fill={P.honeyDeep} />
    <rect x="67" y="78" width="12" height="11" rx="4.5" fill={P.honeyDeep} />
    <ellipse cx="50" cy="50" rx="39" ry="9" fill={P.blue} stroke={P.blueLight} strokeWidth="3" />
    {/* the duck */}
    <g className="pa-bob">
      <ellipse cx="38" cy="50" rx="15" ry="10" fill={P.honey} />
      <circle cx="47" cy="35" r="9" fill={P.honey} />
      <path d="M54.5 32.5 Q62 33.5 61 37.5 Q57 39.5 54 37.5 Z" fill={P.terra} />
      <circle cx="49.5" cy="33" r="1.9" fill={P.ink} />
      <path
        d="M28 49 Q35 55 42 48"
        fill="none"
        stroke={P.honeyDeep}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M40.5 31 Q42.5 27.5 47 27.5"
        fill="none"
        stroke={P.honeyLight}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </g>
    <path
      d="M11 50 Q50 68 89 50 L85 70 Q83 83 69 83 H31 Q17 83 15 70 Z"
      fill={P.white}
      stroke={P.blueLight}
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    <path
      d="M17.5 70 Q19.5 81.5 31 81.5 H69 Q80.5 81.5 82.5 70 Q70 76 50 76 Q30 76 17.5 70 Z"
      fill={P.blueLight}
    />
    <path d="M11 50 Q50 68 89 50" fill="none" stroke={P.blueLight} strokeWidth="4.5" strokeLinecap="round" />
    <g fill={P.white} stroke={P.blueLight} strokeWidth="2.4">
      <circle cx="66" cy="56" r="7" />
      <circle cx="77" cy="52" r="6" />
      <circle cx="58" cy="61" r="5" />
      <circle cx="21" cy="52" r="5.5" />
    </g>
    <g className="pa-float">
      <Bubble x={72} y={34} r={6} />
      <Bubble x={84} y={24} r={4} />
    </g>
  </>
);

const hair: Art = () => (
  <>
    {/* a lock of hair, tied with a bow */}
    <path
      d="M32 18 C24 28 20 42 23 56 C25 66 23 75 19 83 C26 83 31 80 33 76 C34 82 37 87 40 89 C43 86 45 81 46 76 C49 80 53 83 59 83 C55 75 56 64 55 54 C53 40 52 28 44 18 Z"
      fill={P.wood}
      stroke={P.wood}
      strokeWidth="4"
      strokeLinejoin="round"
    />
    <path
      d="M34 24 C27 36 25 52 28 68"
      fill="none"
      stroke={P.woodLight}
      strokeWidth="3.4"
      strokeLinecap="round"
    />
    <path
      d="M42 64 C43 71 42 77 40 82"
      fill="none"
      stroke={P.woodDeep}
      strokeWidth="3"
      strokeLinecap="round"
      opacity="0.6"
    />
    <path
      d="M38 15 L26 8 Q23 15 26 22 Z M38 15 L50 8 Q53 15 50 22 Z"
      fill={P.teal}
      stroke={P.teal}
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <circle cx="38" cy="15" r="4" fill={P.tealDeep} />
    {/* the brush, coming down through it */}
    <g className="pa-drop">
      <g transform="translate(48 47) rotate(22)">
        <rect x="12" y="-4.5" width="32" height="9" rx="4.5" fill={P.roseDeep} />
        <ellipse cx="0" cy="0" rx="17" ry="13" fill={P.rose} />
        <ellipse cx="0" cy="0" rx="12" ry="8.5" fill={P.roseLight} />
        <path
          d="M-7 -3.5 v3 M-2.3 -3.5 v3 M2.4 -3.5 v3 M7 -3.5 v3 M-4.6 2.5 v3 M0 2.5 v3 M4.7 2.5 v3"
          stroke={P.inkSoft}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </g>
    </g>
    <g className="pa-twinkle">
      <Sparkle x={78} y={24} s={0.9} />
    </g>
  </>
);

const potty: Art = () => (
  <>
    <Ground rx={34} cx={46} />
    {/* paper, within reach */}
    <rect
      x="84"
      y="34"
      width="7.5"
      height="21"
      rx="2.5"
      fill={P.white}
      stroke={P.blueLight}
      strokeWidth="2.5"
    />
    <circle cx="79.5" cy="33" r="12" fill={P.white} stroke={P.blueLight} strokeWidth="2.5" />
    <circle cx="79.5" cy="33" r="4.5" fill={P.wood} />
    {/* the potty, lid up */}
    <rect x="12" y="22" width="24" height="44" rx="7" fill={P.teal} />
    <rect x="16" y="27" width="4" height="22" rx="2" fill={P.tealLight} opacity="0.8" />
    <rect x="18" y="16" width="12" height="8" rx="3.5" fill={P.honey} />
    <rect x="37" y="23" width="8" height="38" rx="4" fill={P.tealDeep} />
    <path d="M16 62 H78 Q78 78 64 81 V85 Q64 88 61 88 H35 Q32 88 32 85 V80 Q18 78 16 62 Z" fill={P.teal} />
    <path
      d="M21 73 Q25 79.5 32 80 V85 Q32 88 35 88 H61 Q64 88 64 85 V81 Q72 79 75.5 73 Q62 78 48 78 Q34 78 21 73 Z"
      fill={P.tealDeep}
      opacity="0.5"
    />
    <rect x="32" y="56" width="49" height="9" rx="4.5" fill={P.tealDeep} />
    <rect x="37" y="58" width="22" height="2.6" rx="1.3" fill={P.tealLight} opacity="0.7" />
  </>
);

const lightsout: Art = () => (
  <>
    <rect x="6" y="10" width="88" height="78" rx="14" fill={P.night} />
    <path d="M73 16 a12.5 12.5 0 1 0 10.5 19 a11 11 0 0 1 -10.5 -19 z" fill={P.honeyLight} />
    <circle cx="22" cy="26" r="1.8" fill={P.lavLight} className="pa-twinkle" />
    <circle cx="80" cy="56" r="1.6" fill={P.lavLight} />
    <path d="M6 72 H94 V78 Q94 88 84 88 H16 Q6 88 6 78 Z" fill={P.lavDeep} />
    {/* the lamp, asleep */}
    <rect x="27" y="66" width="28" height="8" rx="4" fill={P.lav} />
    <rect x="38.5" y="48" width="5" height="20" rx="2.5" fill={P.lav} />
    <g className="pa-swing">
      <path d="M55 50 V59" stroke={P.lavLight} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="55" cy="61" r="2.8" fill={P.honeyLight} />
    </g>
    <path
      d="M30 24 H52 Q55 24 56 27 L62 47 Q63 51 59 51 H23 Q19 51 20 47 L26 27 Q27 24 30 24 Z"
      fill={P.lav}
    />
    <path d="M28.5 30 L25 43" stroke={P.lavLight} strokeWidth="3" strokeLinecap="round" opacity="0.8" />
    <Face x={41} y={38} sleepy />
  </>
);

const backpack: Art = () => (
  <>
    <Ground rx={30} />
    <path
      d="M26 44 Q14 58 25 78 M74 44 Q86 58 75 78"
      fill="none"
      stroke={P.redDeep}
      strokeWidth="6"
      strokeLinecap="round"
    />
    <path
      d="M41 22 V17 Q41 9 50 9 Q59 9 59 17 V22"
      fill="none"
      stroke={P.redDeep}
      strokeWidth="5"
      strokeLinecap="round"
    />
    <path d="M24 42 Q24 18 50 18 Q76 18 76 42 V76 Q76 87 65 87 H35 Q24 87 24 76 Z" fill={P.red} />
    <path
      d="M30 38 Q32 26 44 23"
      fill="none"
      stroke={P.terraLight}
      strokeWidth="4"
      strokeLinecap="round"
      opacity="0.7"
    />
    {/* the zip, and the pocket on the front */}
    <path d="M31 45 Q50 35 69 45" fill="none" stroke={P.redDeep} strokeWidth="3" strokeLinecap="round" />
    <rect x="65" y="43" width="5.5" height="10" rx="2.75" fill={P.honey} />
    <rect x="31" y="57" width="38" height="24" rx="8" fill={P.redDeep} />
    <path d="M38 64 H62" stroke={P.terraLight} strokeWidth="2.6" strokeLinecap="round" />
    <rect x="37" y="62" width="5" height="9" rx="2.5" fill={P.honey} />
  </>
);

const lunchbox: Art = () => (
  <>
    <Ground rx={36} />
    <path
      d="M41 17 V14 Q41 9 46 9 H54 Q59 9 59 14 V17"
      fill="none"
      stroke={P.honeyDeep}
      strokeWidth="4.5"
      strokeLinecap="round"
    />
    <rect x="16" y="14" width="68" height="40" rx="8" fill={P.honey} />
    <rect x="21" y="19" width="58" height="30" rx="5" fill={P.honeyLight} />
    <rect x="18" y="48" width="64" height="34" rx="7" fill={P.honeyDeep} />
    {/* a sandwich */}
    <rect x="22" y="53" width="28" height="9" rx="3" fill={P.woodLight} />
    <rect x="22" y="49.5" width="28" height="5" rx="2.5" fill={P.red} />
    <path d="M20.5 48 q3.75 5 7.5 0 q3.75 5 7.5 0 q3.75 5 7.5 0 q3.75 5 7.5 0 v-3 h-30 z" fill={P.sage} />
    <rect x="22" y="36" width="28" height="11" rx="5" fill={P.woodLight} />
    <rect x="26" y="38.5" width="12" height="2.6" rx="1.3" fill={P.cream} opacity="0.8" />
    {/* an apple */}
    <path d="M67 38 Q68 33 71 32" fill="none" stroke={P.woodDeep} strokeWidth="2.4" strokeLinecap="round" />
    <ellipse cx="74.5" cy="34" rx="4.5" ry="2.6" fill={P.sageDeep} transform="rotate(-25 74.5 34)" />
    <path
      d="M67 40 Q61 35.5 57 41 Q53 48 58 56 Q62 61.5 67 59 Q72 61.5 76 56 Q81 48 77 41 Q73 35.5 67 40 Z"
      fill={P.red}
    />
    <ellipse cx="60.5" cy="45" rx="2" ry="3.5" fill={P.white} opacity="0.5" transform="rotate(20 60.5 45)" />
    <rect x="14" y="58" width="72" height="28" rx="8" fill={P.honey} />
    <rect x="14" y="58" width="72" height="8" rx="4" fill={P.honeyLight} />
    <rect x="44" y="62" width="12" height="11" rx="3.5" fill={P.honeyDeep} />
  </>
);

const bottle: Art = () => (
  <>
    <Ground rx={26} cx={47} />
    {/* its lid, waiting beside it */}
    <rect x="15.5" y="69" width="7" height="11" rx="3" fill={P.sageDeep} />
    <rect x="9" y="77" width="20" height="10" rx="4" fill={P.sage} />
    {/* the bottle, filling */}
    <rect x="34" y="41" width="32" height="47" rx="9" fill={P.blueLight} stroke={P.blue} strokeWidth="2.5" />
    <path d="M36 64 Q43 61 50 64 Q57 67 64 64 V79 Q64 86 57 86 H43 Q36 86 36 79 Z" fill={P.blue} />
    <g className="pa-drop">
      <rect x="46.5" y="26" width="7" height="41" rx="3.5" fill={P.blue} />
    </g>
    <rect x="36.5" y="35" width="27" height="8" rx="3.5" fill={P.sage} />
    <rect x="38.5" y="48" width="4" height="30" rx="2" fill={P.white} opacity="0.7" />
    <Tap x={50} y={30} />
    <Drop x={28} y={46} s={0.7} />
    <Drop x={74} y={56} s={0.6} />
  </>
);

const coat: Art = () => (
  <>
    <Ground rx={30} />
    {/* the hood */}
    <path d="M30 34 Q28 8 50 8 Q72 8 70 34 Z" fill={P.blue} />
    <path d="M37 34 Q36 16 50 16 Q64 16 63 34 Z" fill={P.blueDeep} />
    <path
      d="M36.5 32 Q35.5 15 50 15 Q64.5 15 63.5 32"
      fill="none"
      stroke={P.cream}
      strokeWidth="4.5"
      strokeLinecap="round"
    />
    {/* the coat, zipped to the top */}
    <path
      d="M36 30 Q50 40 64 30 L75 34 L90 64 L80 70 L70 54 L72 86 H28 L30 54 L20 70 L10 64 L25 34 Z"
      fill={P.blue}
      stroke={P.blue}
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <path
      d="M10 64 L20 70 L21.8 65.4 L11.8 59.4 Z M90 64 L80 70 L78.2 65.4 L88.2 59.4 Z"
      fill={P.blueDeep}
      stroke={P.blueDeep}
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <path d="M27 39 L18 58" stroke={P.blueLight} strokeWidth="3" strokeLinecap="round" opacity="0.7" />
    <path d="M50 38 V86" stroke={P.blueDeep} strokeWidth="2.6" strokeLinecap="round" />
    <path d="M36 62 L41 71 M64 62 L59 71" stroke={P.blueDeep} strokeWidth="3" strokeLinecap="round" />
    <rect x="47.5" y="36" width="5" height="9" rx="2.5" fill={P.honey} />
  </>
);

const hat: Art = () => (
  <>
    <Ground rx={36} cy={84} ry={5} />
    <g className="pa-spin">
      <circle cx="80" cy="22" r="6.5" fill={P.honey} />
      <path
        d="M80 12.5 v-3 M80 31.5 v3 M70.5 22 h-3 M89.5 22 h3 M73.3 15.3 l-2.1 -2.1 M86.7 15.3 l2.1 -2.1 M73.3 28.7 l-2.1 2.1 M86.7 28.7 l2.1 2.1"
        stroke={P.honey}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </g>
    <ellipse cx="50" cy="64" rx="41" ry="16" fill={P.woodLight} />
    <ellipse cx="50" cy="66" rx="28" ry="9.5" fill={P.wood} opacity="0.55" />
    <path d="M27 60 Q27 26 50 26 Q73 26 73 60 Q50 70 27 60 Z" fill={P.woodLight} />
    <path d="M27 52 Q50 62 73 52 V60 Q50 70 27 60 Z" fill={P.red} />
    <path
      d="M33 46 Q34 35 45 31"
      fill="none"
      stroke={P.cream}
      strokeWidth="4"
      strokeLinecap="round"
      opacity="0.8"
    />
  </>
);

export const ACTIONS_B: Partial<Record<ActionPictureId, Art>> = {
  toys,
  laundry,
  bed,
  books,
  hands,
  dress,
  socks,
  bath,
  hair,
  potty,
  lightsout,
  backpack,
  lunchbox,
  bottle,
  coat,
  hat,
};
