import type { ShoppingPictureId } from '../../../shared/pictures';
import { P } from '../palette';
import { Bubble, Drop, Ground, Sparkle, type Art } from './kit';

/**
 * Things to buy. One thing each, big and plain: these are shown small beside a word a child cannot read, and
 * large when a child taps one to ask for it. The last eleven are the aisles — a little still life of two or
 * three things, for whatever has no picture of its own.
 */

/** Where a shared part goes: its middle, how big, and how far it leans. */
type At = { x: number; y: number; s?: number; r?: number };

const at = ({ x, y, s = 1, r = 0 }: At) => `translate(${x} ${y}) rotate(${r}) scale(${s})`;

/** An egg, standing on its wide end. */
const Egg = (p: At) => (
  <g transform={at(p)}>
    <path
      d="M0 -13 C6 -13 10 -4 10 3 A10 10 0 0 1 -10 3 C-10 -4 -6 -13 0 -13 Z"
      fill={P.cream}
      stroke={P.creamShade}
      strokeWidth="2.4"
    />
    <path d="M9 -2 Q11 10 0 13 Q5 7 9 -2 Z" fill={P.creamShade} />
    <ellipse cx="-3.5" cy="-5" rx="2.2" ry="3.4" fill={P.white} />
  </g>
);

/** A bottle of milk: white, with a blue top and a blue band. Drawn on the whole square. */
const MilkBottle = () => (
  <>
    <path
      d="M40 15 H60 V27 Q60 32.5 66 37.5 Q74 44 74 53 V77 Q74 88 63 88 H37 Q26 88 26 77 V53 Q26 44 34 37.5 Q40 32.5 40 27 Z"
      fill={P.blueLight}
    />
    <path
      d="M44 26 H56 V27.5 Q56 34.5 63 40.5 Q70 46 70 53 V77 Q70 84 63 84 H37 Q30 84 30 77 V53 Q30 46 37 40.5 Q44 34.5 44 27.5 Z"
      fill={P.white}
    />
    <path
      d="M60.5 38.5 Q70 45.5 70 53 V77 Q70 84 63 84 H58 Q63.5 83.5 63.5 77 V51 Q63.5 44 60.5 38.5 Z"
      fill={P.blueLight}
      opacity="0.6"
    />
    <rect x="26" y="54" width="48" height="19" rx="2.5" fill={P.blue} />
    <rect x="62" y="54" width="12" height="19" rx="2.5" fill={P.blueDeep} opacity="0.45" />
    <rect x="31.5" y="58.5" width="5" height="10" rx="2.5" fill={P.blueLight} opacity="0.85" />
    <rect x="37.5" y="7" width="25" height="10.5" rx="4" fill={P.blue} />
    <rect x="41.5" y="9.4" width="9" height="3" rx="1.5" fill={P.blueLight} opacity="0.85" />
  </>
);

/** A wedge of cheese with holes. Drawn on the whole square. */
const CheeseWedge = () => (
  <>
    <path
      d="M14 57 L62 27 L88 46 Z"
      fill={P.honeyLight}
      stroke={P.honeyLight}
      strokeWidth="5"
      strokeLinejoin="round"
    />
    <path
      d="M14 58 L88 47 V74 L14 85 Z"
      fill={P.honey}
      stroke={P.honey}
      strokeWidth="5"
      strokeLinejoin="round"
    />
    <ellipse cx="60" cy="41" rx="7" ry="4" fill={P.honey} />
    <g fill={P.honeyDeep}>
      <ellipse cx="31" cy="71" rx="5.5" ry="6" />
      <ellipse cx="54" cy="62" rx="6.5" ry="7" />
      <ellipse cx="74" cy="65" rx="4.5" ry="5" />
      <circle cx="47" cy="78" r="3" />
    </g>
  </>
);

/** A roast drumstick: the meat at the middle, the bone out to the right. */
const Drumstick = ({ bone = P.creamShade, ...p }: At & { bone?: string }) => (
  <g transform={at(p)}>
    <rect x="18" y="-4" width="26" height="8" rx="4" fill={bone} />
    <circle cx="44" cy="-4.5" r="5.5" fill={bone} />
    <circle cx="44" cy="4.5" r="5.5" fill={bone} />
    <circle cx="43" cy="-6" r="2" fill={P.white} opacity="0.7" />
    <path
      d="M-26 0 C-26 -17 -9 -21 3 -16 C13 -12 20 -7 24 -4 Q27 0 24 4 C20 7 13 12 3 16 C-9 21 -26 17 -26 0 Z"
      fill={P.wood}
    />
    <path
      d="M-19 -5 C-16 -13 -6 -15 2 -12"
      fill="none"
      stroke={P.woodLight}
      strokeWidth="4"
      strokeLinecap="round"
    />
    <path
      d="M-18 9 C-10 16 0 15 9 10"
      fill="none"
      stroke={P.woodDeep}
      strokeWidth="3.6"
      strokeLinecap="round"
      opacity="0.4"
    />
  </g>
);

/** A paw print. */
const Paw = ({ fill, ...p }: At & { fill: string }) => (
  <g transform={at(p)} fill={fill}>
    <path d="M0 -2 C6 -2 10 3 10 7 C10 11 6 12 0 11 C-6 12 -10 11 -10 7 C-10 3 -6 -2 0 -2 Z" />
    <ellipse cx="-10.5" cy="-4" rx="3.3" ry="4.3" transform="rotate(-22 -10.5 -4)" />
    <ellipse cx="-3.8" cy="-10" rx="3.3" ry="4.5" />
    <ellipse cx="3.8" cy="-10" rx="3.3" ry="4.5" />
    <ellipse cx="10.5" cy="-4" rx="3.3" ry="4.3" transform="rotate(22 10.5 -4)" />
  </g>
);

const milk: Art = () => (
  <>
    <Ground rx={26} />
    <MilkBottle />
  </>
);

const bread: Art = () => (
  <>
    <Ground rx={38} cy={86} />
    <path
      d="M18 82 H82 Q88 82 88 76 V53 Q92 49 92 43 Q92 28 76 28 H28 Q10 28 10 43 Q10 49 14 53 V76 Q14 82 18 82 Z"
      fill={P.wood}
    />
    <path
      d="M50 33.5 H75 Q85 33.5 87 43"
      fill="none"
      stroke={P.woodLight}
      strokeWidth="4"
      strokeLinecap="round"
    />
    <path d="M14 70 H88 V76 Q88 82 82 82 H18 Q14 82 14 76 Z" fill={P.woodDeep} opacity="0.3" />
    <path
      d="M22 77 Q19.5 77 19.5 74.5 V51 Q15.5 48 15.5 43.5 Q15.5 33.5 29 33.5 Q42.5 33.5 42.5 43.5 Q42.5 48 38.5 51 V74.5 Q38.5 77 36 77 Z"
      fill={P.cream}
    />
    <g stroke={P.woodDeep} strokeWidth="2.6" strokeLinecap="round" opacity="0.5">
      <path d="M54 40 V76" />
      <path d="M66 40 V76" />
      <path d="M78 40 V76" />
    </g>
  </>
);

const eggs: Art = () => (
  <>
    <Ground rx={40} />
    <rect x="12" y="22" width="76" height="44" rx="9" fill={P.wood} />
    <rect x="18" y="28" width="64" height="30" rx="6" fill={P.woodDeep} opacity="0.3" />
    <Egg x={27} y={50} s={1.15} />
    <Egg x={50} y={50} s={1.15} />
    <Egg x={73} y={50} s={1.15} />
    <path
      d="M10 62 Q10 58 14 58 H86 Q90 58 90 62 L86.5 80 Q85.5 86 79.5 86 H20.5 Q14.5 86 13.5 80 Z"
      fill={P.woodLight}
    />
    <rect x="35" y="52" width="7" height="12" rx="3.5" fill={P.woodLight} />
    <rect x="58" y="52" width="7" height="12" rx="3.5" fill={P.woodLight} />
    <path d="M12.7 76 H87.3 L86.5 80 Q85.5 86 79.5 86 H20.5 Q14.5 86 13.5 80 Z" fill={P.wood} opacity="0.7" />
  </>
);

const apple: Art = () => (
  <>
    <Ground rx={26} cy={90} />
    <path
      d="M50 36 C42 27 17 28 17 55 C17 75 31 89 42 89 C46 89 48 87.5 50 87.5 C52 87.5 54 89 58 89 C69 89 83 75 83 55 C83 28 58 27 50 36 Z"
      fill={P.red}
    />
    <path
      d="M77 50 C78 66 70 80 59 84"
      fill="none"
      stroke={P.redDeep}
      strokeWidth="6"
      strokeLinecap="round"
      opacity="0.5"
    />
    <ellipse cx="32" cy="50" rx="5" ry="9.5" fill={P.white} opacity="0.45" transform="rotate(20 32 50)" />
    <path d="M50 37 Q50 26 55 18" fill="none" stroke={P.woodDeep} strokeWidth="4.5" strokeLinecap="round" />
    <path d="M55 26 Q60 10 79 13 Q76 30 55 26 Z" fill={P.sage} />
    <path d="M60 22.5 Q66 17 73 16" fill="none" stroke={P.sageDeep} strokeWidth="2.4" strokeLinecap="round" />
  </>
);

/** One banana of the bunch: its shaded side, its skin, and the light along its top. */
const Banana = ({ d, light }: { d: string; light: string }) => (
  <>
    <path d={d} fill={P.honeyDeep} />
    <path d={d} fill={P.honey} transform="translate(-1.6 -2.4)" />
    <path d={light} fill="none" stroke={P.honeyLight} strokeWidth="3.2" strokeLinecap="round" />
  </>
);

const banana: Art = () => (
  <g transform="translate(7 1)">
    <Ground cx={43} cy={89} rx={30} />
    <Banana
      d="M62 22 L74 20 C84 50 60 84 26 85 Q19 85 19.5 81 Q20 78 24 78 C48 78 64 58 62 22 Z"
      light="M57.5 44 Q55 62 36 73"
    />
    <Banana
      d="M58 22 L68 20 C76 50 52 76 16 69 Q10 69 10 64.5 Q10 61 14 61 C40 64 60 48 58 22 Z"
      light="M54.5 40 Q50 53 30 60"
    />
    <Banana
      d="M54 22 L64 20 C66 46 44 62 12 49 Q7 48 8 44 Q9 41 13 42 C34 48 54 40 54 22 Z"
      light="M50.5 32 Q45 41 27 42.5"
    />
    <g fill={P.woodDeep}>
      <circle cx="20" cy="80" r="3" />
      <circle cx="10.5" cy="63.5" r="3" />
      <circle cx="8.5" cy="44" r="3" />
    </g>
    <path d="M52 24 L56 13.5 Q57 10.5 60.5 10.5 H66 Q69.5 10.5 70.5 13.5 L74.5 22 Z" fill={P.wood} />
    <rect x="57" y="7" width="12.5" height="6.5" rx="3.2" fill={P.woodDeep} />
  </g>
);

const Strawberry = (p: At) => (
  <g transform={at(p)}>
    <path
      d="M0 -9 C8 -13 15 -6 13 3 C11 11 4 16 0 18 C-4 16 -11 11 -13 3 C-15 -6 -8 -13 0 -9 Z"
      fill={P.red}
    />
    <path
      d="M9.5 -3 C11 4 7 11 1.5 14.5"
      fill="none"
      stroke={P.redDeep}
      strokeWidth="3"
      strokeLinecap="round"
      opacity="0.5"
    />
    <g fill={P.honeyLight}>
      <ellipse cx="-6" cy="0" rx="1.3" ry="1.9" />
      <ellipse cx="2" cy="-1" rx="1.3" ry="1.9" />
      <ellipse cx="-1.5" cy="8" rx="1.3" ry="1.9" />
    </g>
    <path d="M-10 -8 Q-5 -15 0 -11 Q5 -15 10 -8 Q5 -5 0 -6.5 Q-5 -5 -10 -8 Z" fill={P.sage} />
    <rect x="-1.7" y="-16" width="3.4" height="6" rx="1.7" fill={P.sageDeep} />
  </g>
);

const Blueberry = (p: At) => (
  <g transform={at(p)}>
    <circle r="8" fill={P.blueDeep} />
    <circle cx="2.2" cy="-3" r="2.6" fill={P.night} />
    <circle cx="-3.6" cy="-1.5" r="1.6" fill={P.blue} />
  </g>
);

const berries: Art = () => (
  <>
    <Ground rx={36} />
    <Strawberry x={34} y={39} s={1.35} r={-10} />
    <Strawberry x={65} y={38} s={1.35} r={12} />
    <Blueberry x={22} y={55} />
    <Blueberry x={50} y={54} s={1.1} />
    <Blueberry x={78} y={55} />
    <path d="M14 64 H86 L82 82 Q81 88 75 88 H25 Q19 88 18 82 Z" fill={P.teal} />
    <path d="M17 78 H83 L82 82 Q81 88 75 88 H25 Q19 88 18 82 Z" fill={P.tealDeep} opacity="0.35" />
    <g fill={P.tealDeep} opacity="0.6">
      <rect x="29" y="71" width="5" height="10" rx="2.5" />
      <rect x="47.5" y="71" width="5" height="10" rx="2.5" />
      <rect x="66" y="71" width="5" height="10" rx="2.5" />
    </g>
    <rect x="10" y="59" width="80" height="9" rx="4.5" fill={P.teal} />
    <rect x="15" y="61" width="46" height="3" rx="1.5" fill={P.tealLight} opacity="0.85" />
  </>
);

const Carrot = (p: At) => (
  <g transform={at(p)}>
    <path d="M-1 -22 Q-12 -28 -9 -42 Q1 -36 -1 -22 Z" fill={P.sage} />
    <path d="M1 -22 Q12 -28 9 -42 Q-1 -36 1 -22 Z" fill={P.sage} />
    <path d="M0 -20 Q-6 -36 0 -46 Q6 -36 0 -20 Z" fill={P.sageDeep} />
    <path d="M-10 -21 Q0 -28 10 -21 Q10 2 3 27 Q0 33 -3 27 Q-10 2 -10 -21 Z" fill={P.terra} />
    <path d="M-5.5 -18 Q-6 -4 -3 8" fill="none" stroke={P.terraLight} strokeWidth="3" strokeLinecap="round" />
    <path d="M1 -9 h6.5 M-1 4 h5" fill="none" stroke={P.terraDeep} strokeWidth="2.4" strokeLinecap="round" />
  </g>
);

const carrot: Art = () => (
  <>
    <Ground rx={20} cy={90} />
    <Carrot x={35} y={55} r={-15} />
    <Carrot x={65} y={55} r={15} />
  </>
);

const Tomato = (p: At) => (
  <g transform={at(p)}>
    <ellipse cx="0" cy="2" rx="23" ry="21" fill={P.red} />
    <path
      d="M16 4 C16 12 10 18 2 19.5"
      fill="none"
      stroke={P.redDeep}
      strokeWidth="4"
      strokeLinecap="round"
      opacity="0.5"
    />
    <ellipse cx="-11" cy="-5" rx="4" ry="6.5" fill={P.white} opacity="0.45" transform="rotate(28 -11 -5)" />
    <path
      d="M0 -19 Q-9 -24 -16 -15 Q-8 -15 -3.5 -12 Q-2 -7 0 -4 Q2 -7 3.5 -12 Q8 -15 16 -15 Q9 -24 0 -19 Z"
      fill={P.sageDeep}
    />
    <rect x="-2.2" y="-28" width="4.4" height="11" rx="2.2" fill={P.sageDeep} />
  </g>
);

const tomato: Art = () => (
  <>
    <Ground rx={36} />
    <Tomato x={33} y={52} />
    <path
      d="M38.3 72.7 A26.8 24.6 0 0 1 45.5 41.8"
      fill="none"
      stroke={P.redDeep}
      strokeWidth="3.5"
      strokeLinecap="round"
      opacity="0.55"
    />
    <Tomato x={62} y={59} s={1.1} />
  </>
);

const Potato = ({ fill, ...p }: At & { fill: string }) => (
  <g transform={at(p)}>
    <path
      d="M-22 1 C-24 -11 -10 -17 2 -15 C15 -13 24 -7 22 5 C20 15 8 17 -4 16 C-14 15 -21 10 -22 1 Z"
      fill={fill}
    />
    <path
      d="M-15 -4 C-12 -10 -4 -12 3 -11"
      fill="none"
      stroke={P.cream}
      strokeWidth="3.4"
      strokeLinecap="round"
      opacity="0.6"
    />
    <path
      d="M8 12 C14 11 18 8 18.5 2"
      fill="none"
      stroke={P.woodDeep}
      strokeWidth="3"
      strokeLinecap="round"
      opacity="0.3"
    />
    <g fill={P.woodDeep} opacity="0.55">
      <circle cx="-8" cy="3" r="1.8" />
      <circle cx="6" cy="-3" r="1.8" />
      <circle cx="-1" cy="9" r="1.8" />
    </g>
  </g>
);

const potato: Art = () => (
  <>
    <Ground rx={34} />
    <Potato x={32} y={41} r={-14} fill={P.wood} />
    <Potato x={67} y={43} r={20} s={0.95} fill={P.wood} />
    <Potato x={50} y={63} r={4} s={1.25} fill={P.woodLight} />
  </>
);

const cheese: Art = () => (
  <>
    <Ground rx={38} cy={88} />
    <CheeseWedge />
  </>
);

const yogurt: Art = () => (
  <>
    <Ground cx={47} rx={24} />
    <path d="M21 44 L26.5 82 Q27.5 88 33.5 88 H60.5 Q66.5 88 67.5 82 L73 44 Z" fill={P.rose} />
    <path d="M66 44 H73 L67.5 82 Q66.5 88 60.5 88 H55 Q60.5 87 61.5 81 Z" fill={P.roseDeep} opacity="0.35" />
    <path d="M23.3 60 H70.7 L68.7 75 H25.3 Z" fill={P.white} />
    <circle cx="47" cy="68" r="4.8" fill={P.red} />
    <ellipse cx="50" cy="63.4" rx="3.4" ry="1.8" fill={P.sageDeep} transform="rotate(-25 50 63.4)" />
    <ellipse cx="47" cy="44" rx="29" ry="7.5" fill={P.roseLight} />
    <ellipse cx="47" cy="43.6" rx="23.5" ry="5" fill={P.white} />
    <rect x="55.2" y="21" width="5.6" height="24" rx="2.8" fill={P.inkSoft} transform="rotate(26 58 45)" />
    <ellipse cx="71.6" cy="17.1" rx="6.5" ry="9" fill={P.inkSoft} transform="rotate(26 71.6 17.1)" />
    <ellipse
      cx="70.6"
      cy="15.4"
      rx="2.4"
      ry="4.4"
      fill={P.white}
      opacity="0.45"
      transform="rotate(26 70.6 15.4)"
    />
  </>
);

const butter: Art = () => (
  <>
    <Ground rx={40} cy={87} />
    <ellipse cx="50" cy="75" rx="42" ry="11" fill={P.blue} />
    <ellipse cx="50" cy="73.5" rx="35" ry="7.5" fill={P.blueLight} />
    <path
      d="M70 44 L81 30 V58 L70 72 Z"
      fill={P.honey}
      stroke={P.honey}
      strokeWidth="4"
      strokeLinejoin="round"
    />
    <path
      d="M70 44 L81 30 V58 L70 72 Z"
      fill={P.honeyDeep}
      stroke={P.honeyDeep}
      strokeWidth="4"
      strokeLinejoin="round"
      opacity="0.4"
    />
    <path
      d="M22 44 L33 30 H81 L70 44 Z"
      fill={P.honeyLight}
      stroke={P.honeyLight}
      strokeWidth="4"
      strokeLinejoin="round"
    />
    <rect x="20" y="42" width="52" height="32" rx="4" fill={P.honey} />
    <rect x="25" y="47" width="22" height="4" rx="2" fill={P.honeyLight} opacity="0.85" />
    <path
      d="M30 71 H54 L49 79 H25 Z"
      fill={P.honeyLight}
      stroke={P.honeyLight}
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <rect x="23.5" y="77.5" width="27" height="6" rx="2.5" fill={P.honey} />
  </>
);

const cereal: Art = () => (
  <>
    <Ground rx={32} />
    <path
      d="M70 16 L82 11 V80 L70 87 Z"
      fill={P.redDeep}
      stroke={P.redDeep}
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <rect x="18" y="13" width="54" height="76" rx="5" fill={P.red} />
    <path d="M18 18 Q18 13 23 13 H67 Q72 13 72 18 V30 Q58 38 45 32 Q32 26 18 33 Z" fill={P.honey} />
    <rect x="59" y="38" width="4.4" height="20" rx="2.2" fill={P.cream} transform="rotate(24 61 57)" />
    <ellipse cx="70.2" cy="35.6" rx="4.6" ry="6.4" fill={P.cream} transform="rotate(24 70.2 35.6)" />
    <ellipse cx="45" cy="57" rx="19" ry="5.5" fill={P.cream} />
    <g fill={P.honey}>
      <circle cx="35" cy="56" r="3" />
      <circle cx="43" cy="54.5" r="3" />
      <circle cx="52" cy="57" r="3" />
    </g>
    <path d="M26 57 Q26 79 45 79 Q64 79 64 57 Q45 64.5 26 57 Z" fill={P.blue} />
    <path
      d="M30.5 63 Q33 73 41 76"
      fill="none"
      stroke={P.blueLight}
      strokeWidth="3"
      strokeLinecap="round"
      opacity="0.7"
    />
    <rect x="37" y="77.5" width="16" height="5" rx="2.5" fill={P.blueDeep} />
  </>
);

const pasta: Art = () => (
  <>
    <Ground rx={36} cy={90} />
    <rect x="36" y="83" width="28" height="6" rx="3" fill={P.sageDeep} />
    <ellipse cx="50" cy="52" rx="40" ry="10" fill={P.honeyDeep} />
    <path d="M16 52 Q18 30 34 26 Q50 16 66 26 Q82 30 84 52 Q50 64 16 52 Z" fill={P.honey} />
    <g fill="none" stroke={P.honeyDeep} strokeWidth="2.6" strokeLinecap="round" opacity="0.65">
      <path d="M22 47 Q34 32 48 42 T76 41" />
      <path d="M27 54 Q40 43 54 52 T80 49" />
    </g>
    <path d="M23 41 Q26 33 32 30" fill="none" stroke={P.honeyLight} strokeWidth="3" strokeLinecap="round" />
    <path
      d="M32 36 Q30 26 42 23.5 Q51 17 60 23 Q71 25.5 69 36 Q66 41 61 37.5 Q55 44 49.5 38 Q43 44 38 39.5 Q33.5 40 32 36 Z"
      fill={P.red}
    />
    <path d="M44 30 Q48 23 55 25.5 Q52 32.5 44 30 Z" fill={P.sageDeep} />
    <path d="M10 52 Q10 86 50 86 Q90 86 90 52 Q50 66 10 52 Z" fill={P.sage} />
    <path
      d="M17 62 Q21 77 37 81.5"
      fill="none"
      stroke={P.sageLight}
      strokeWidth="4"
      strokeLinecap="round"
      opacity="0.8"
    />
    <path d="M70 57 Q73 65 68 70" fill="none" stroke={P.honey} strokeWidth="3.6" strokeLinecap="round" />
  </>
);

const rice: Art = () => (
  <>
    <Ground rx={32} cy={90} />
    <rect x="35" y="83" width="30" height="7" rx="3.5" fill={P.redDeep} />
    <ellipse cx="50" cy="52" rx="37" ry="8.5" fill={P.redDeep} />
    <path
      d="M19 52 Q19 18 50 18 Q81 18 81 52 Q50 61 19 52 Z"
      fill={P.white}
      stroke={P.line}
      strokeWidth="2.8"
    />
    <g stroke={P.line} strokeWidth="3.4" strokeLinecap="round">
      <path d="M36 31 l4.5 -2.5" />
      <path d="M54 27 l4.5 2.5" />
      <path d="M46 39 l4.5 -2" />
      <path d="M29 44 l4.5 2" />
      <path d="M64 40 l4.5 -2.5" />
      <path d="M41 50 l5 1" />
      <path d="M58 50 l5 -1" />
    </g>
    <path d="M13 52 Q50 65 87 52 Q87 80 65 86 H35 Q13 80 13 52 Z" fill={P.red} />
    <path d="M17 62 Q50 74 83 62" fill="none" stroke={P.honey} strokeWidth="3.2" strokeLinecap="round" />
    <path
      d="M21 70 Q25 78 35 82"
      fill="none"
      stroke={P.terraLight}
      strokeWidth="3.4"
      strokeLinecap="round"
      opacity="0.8"
    />
  </>
);

const chicken: Art = () => (
  <>
    <Ground rx={32} />
    <Drumstick x={40} y={45} r={38} s={1.12} />
  </>
);

const fish: Art = () => (
  <>
    <Ground rx={32} cy={88} />
    <path
      d="M70 52 L88 34 Q93 52 88 70 Z"
      fill={P.tealDeep}
      stroke={P.tealDeep}
      strokeWidth="4"
      strokeLinejoin="round"
    />
    <path
      d="M36 36 Q46 19 62 35 Z"
      fill={P.tealDeep}
      stroke={P.tealDeep}
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <path
      d="M40 68 Q48 81 56 66 Z"
      fill={P.tealDeep}
      stroke={P.tealDeep}
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <path d="M9 52 C21 28 54 26 74 47 V57 C54 78 21 76 9 52 Z" fill={P.teal} />
    <path d="M12 56 C26 74 54 74 72 58 C54 66 30 66 12 56 Z" fill={P.tealLight} />
    <path d="M31 40 Q38 52 31 64" fill="none" stroke={P.tealDeep} strokeWidth="2.6" strokeLinecap="round" />
    <path
      d="M45 44 q4 4 0 8 M56 44 q4 4 0 8"
      fill="none"
      stroke={P.tealDeep}
      strokeWidth="2.4"
      strokeLinecap="round"
      opacity="0.5"
    />
    <circle cx="21.5" cy="48" r="3" fill={P.ink} />
  </>
);

const juice: Art = () => (
  <>
    <Ground rx={28} cx={51} />
    <path
      d="M66 36 L79 30 V79 L66 87 Z"
      fill={P.honeyDeep}
      stroke={P.honeyDeep}
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <path
      d="M24 36 L37 30 H79 L66 36 Z"
      fill={P.honeyLight}
      stroke={P.honeyLight}
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <path
      d="M47 34 V17 L59 10"
      fill="none"
      stroke={P.red}
      strokeWidth="5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect x="22.5" y="34.5" width="45" height="54" rx="4" fill={P.honey} />
    <circle cx="45" cy="62" r="17" fill={P.white} />
    <circle cx="45" cy="62" r="13.5" fill={P.honeyDeep} />
    <circle cx="45" cy="62" r="10.5" fill={P.honey} />
    <g stroke={P.honeyLight} strokeWidth="2.4" strokeLinecap="round">
      <path d="M45 53.5 V70.5" />
      <path d="M37.6 57.8 L52.4 66.2" />
      <path d="M37.6 66.2 L52.4 57.8" />
    </g>
  </>
);

const water: Art = () => (
  <>
    <Ground rx={26} />
    <path
      d="M27 40 H73 L68.5 82 Q68 88 62 88 H38 Q32 88 31.5 82 Z"
      fill={P.blueLight}
      stroke={P.blue}
      strokeWidth="2.6"
      strokeLinejoin="round"
    />
    <path
      d="M30.5 53 H69.5 L66.5 81 Q66 85.5 61.5 85.5 H38.5 Q34 85.5 33.5 81 Z"
      fill={P.blue}
      opacity="0.85"
    />
    <path
      d="M36.5 59 L38.5 79"
      fill="none"
      stroke={P.white}
      strokeWidth="3.4"
      strokeLinecap="round"
      opacity="0.6"
    />
    <Drop x={50} y={22} s={1.7} />
    <Drop x={27} y={26} s={0.95} />
    <Drop x={73} y={26} s={0.95} />
  </>
);

const Cracker = (p: At) => (
  <g transform={at(p)}>
    <rect x="-17" y="-15" width="34" height="34" rx="7" fill={P.wood} />
    <rect x="-17" y="-18" width="34" height="34" rx="7" fill={P.woodLight} />
    <g fill={P.wood}>
      <circle cx="-8" cy="-9" r="2" />
      <circle cx="8" cy="-9" r="2" />
      <circle cx="0" cy="-1" r="2" />
      <circle cx="-8" cy="7" r="2" />
      <circle cx="8" cy="7" r="2" />
    </g>
  </g>
);

const crackers: Art = () => (
  <>
    <Ground rx={40} cy={88} />
    <ellipse cx="50" cy="76" rx="42" ry="11" fill={P.teal} />
    <ellipse cx="50" cy="74.5" rx="33" ry="7" fill={P.tealLight} />
    <Cracker x={31} y={47} r={-16} />
    <Cracker x={69} y={47} r={16} />
    <Cracker x={50} y={54} />
  </>
);

const diapers: Art = () => (
  <>
    <Ground rx={22} cy={90} />
    <path
      d="M12 27 Q12 20 19 20 H81 Q88 20 88 27 V45 Q88 51 82.5 53.5 Q70 60 67.5 78 Q66.5 88 56 88 H44 Q33.5 88 32.5 78 Q30 60 17.5 53.5 Q12 51 12 45 Z"
      fill={P.blueLight}
    />
    <path
      d="M17 34 H83 V44 Q83 47.5 79.5 49.5 Q64.5 57 62 77 Q61.3 83 55 83 H45 Q38.7 83 38 77 Q35.5 57 20.5 49.5 Q17 47.5 17 44 Z"
      fill={P.white}
    />
    <path d="M42 53 Q50 48.5 58 53 L56.5 75 Q50 79 43.5 75 Z" fill={P.blueLight} />
    <path d="M12 27 Q12 20 19 20 H81 Q88 20 88 27 V37 H12 Z" fill={P.tealLight} />
    <circle cx="40" cy="28.5" r="2.4" fill={P.honey} />
    <circle cx="50" cy="28.5" r="2.4" fill={P.rose} />
    <circle cx="60" cy="28.5" r="2.4" fill={P.lav} />
    <rect x="8" y="23" width="21" height="11" rx="4" fill={P.teal} />
    <rect x="71" y="23" width="21" height="11" rx="4" fill={P.teal} />
  </>
);

const wipes: Art = () => (
  <>
    <Ground rx={40} cy={88} />
    <rect x="10" y="44" width="80" height="42" rx="11" fill={P.teal} />
    <rect x="10" y="72" width="80" height="14" rx="7" fill={P.tealDeep} opacity="0.3" />
    <rect x="10" y="44" width="80" height="17" rx="8.5" fill={P.tealLight} />
    <ellipse cx="50" cy="52.5" rx="20" ry="4.6" fill={P.tealDeep} />
    <path
      d="M36 52.5 Q30 34 40 24 Q44 14 52 20 Q60 12 64 24 Q72 36 64 52.5 Z"
      fill={P.white}
      stroke={P.blueLight}
      strokeWidth="2.6"
      strokeLinejoin="round"
    />
    <path d="M51 22 Q46 36 50 49" fill="none" stroke={P.blueLight} strokeWidth="2.6" strokeLinecap="round" />
    <Drop x={50} y={73} s={1.1} fill={P.white} />
  </>
);

const soap: Art = () => (
  <>
    <Ground rx={24} />
    <path
      d="M34 12 H56 Q60 12 60 16 Q60 20 56 20 H37 V23 Q37 26 33.5 26 Q30 26 30 23 V16 Q30 12 34 12 Z"
      fill={P.lavDeep}
    />
    <rect x="47" y="18" width="6" height="18" rx="3" fill={P.lavDeep} />
    <rect x="41" y="32" width="18" height="11" rx="3.5" fill={P.lavDeep} />
    <path d="M30 51 Q30 40 41 40 H59 Q70 40 70 51 V78 Q70 88 60 88 H40 Q30 88 30 78 Z" fill={P.lav} />
    <path d="M63 41 Q70 43 70 51 V78 Q70 88 60 88 H55 Q64 87 64 78 Z" fill={P.lavDeep} opacity="0.35" />
    <rect x="33.5" y="50" width="4" height="22" rx="2" fill={P.lavLight} opacity="0.85" />
    <rect x="40" y="54" width="22" height="24" rx="7" fill={P.white} />
    <Drop x={51} y={66} s={0.95} fill={P.lav} />
    <Bubble x={19} y={38} r={6} />
    <Bubble x={14} y={56} r={3.6} />
    <Bubble x={81} y={30} r={5} />
    <Sparkle x={82} y={56} s={0.85} />
  </>
);

const toothpaste: Art = () => (
  <>
    <Ground rx={34} cy={90} />
    <g transform="rotate(-30 50 50)">
      <rect x="76" y="28" width="9" height="40" rx="3.5" fill={P.blueDeep} />
      <path d="M80 30 L32 37 Q28 37.6 28 42 V54 Q28 58.4 32 59 L80 66 Z" fill={P.blue} />
      <path d="M62 32.6 L46 35 V61 L62 63.4 Z" fill={P.white} />
      <path
        d="M72 35 L34 40.5"
        fill="none"
        stroke={P.blueLight}
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path
        d="M28 41 L21 44.5 V51.5 L28 55 Z"
        fill={P.blueLight}
        stroke={P.blueLight}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <rect x="14" y="44" width="8" height="8" rx="2.5" fill={P.blueDeep} />
    </g>
    <path
      d="M18 67 Q10 73 17 79 Q24 85 34 79 Q42 74 50 80 Q57 85 64 81"
      fill="none"
      stroke={P.sage}
      strokeWidth="7.5"
      strokeLinecap="round"
    />
    <path
      d="M18 67 Q10 73 17 79 Q24 85 34 79 Q42 74 50 80 Q57 85 64 81"
      fill="none"
      stroke={P.sageLight}
      strokeWidth="2.4"
      strokeLinecap="round"
    />
  </>
);

/** A roll of toilet paper, standing. */
const Roll = ({ x, y }: At) => (
  <g transform={`translate(${x} ${y})`}>
    <path d="M-22.5 -18 V18 Q-22.5 28.5 0 28.5 Q22.5 28.5 22.5 18 V-18 Z" fill={P.blueLight} />
    <path d="M10 -10 V27.6 Q22.5 26 22.5 18 V-10 Z" fill={P.blue} opacity="0.22" />
    <rect x="-17" y="-8" width="6" height="30" rx="3" fill={P.white} opacity="0.9" />
    <ellipse cx="0" cy="-18" rx="21" ry="8.5" fill={P.white} stroke={P.blueLight} strokeWidth="3" />
    <ellipse cx="0" cy="-18" rx="8" ry="3.4" fill={P.wood} />
    <ellipse cx="0" cy="-17.2" rx="4.6" ry="1.7" fill={P.woodDeep} />
  </g>
);

const paper: Art = () => (
  <>
    <Ground rx={34} cy={88} />
    <Roll x={38} y={38} />
    <Roll x={62} y={57} />
    <path
      d="M56 47 V85 Q59.5 89 63 85 Q66.5 81 70 85 V47"
      fill={P.white}
      stroke={P.blueLight}
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M59 68 H67.5"
      fill="none"
      stroke={P.blueLight}
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeDasharray="0.1 4.2"
    />
  </>
);

const petfood: Art = () => (
  <>
    <Ground rx={32} />
    <path d="M24 24 H76 L80 80 Q80 88 72 88 H28 Q20 88 20 80 Z" fill={P.terra} />
    <path d="M69 24 H76 L80 80 Q80 88 72 88 H66 Q73.5 87 73.5 80 Z" fill={P.terraDeep} opacity="0.4" />
    <path
      d="M27.5 32 L25 72"
      fill="none"
      stroke={P.terraLight}
      strokeWidth="4"
      strokeLinecap="round"
      opacity="0.8"
    />
    <rect x="21" y="12" width="58" height="14" rx="4" fill={P.terraDeep} />
    <circle cx="50" cy="57" r="20" fill={P.cream} />
    <Paw x={50} y={59} s={1.05} fill={P.woodDeep} />
    <circle cx="86" cy="85" r="3.6" fill={P.wood} />
    <circle cx="13" cy="85.5" r="3.6" fill={P.wood} />
  </>
);

const produce: Art = () => (
  <>
    <Ground rx={40} cy={88} />
    <path
      d="M56 13 C51 13 50 20 49 26 C47 34 41 38 41 48 C41 58 49 62 56 62 C63 62 71 58 71 48 C71 38 65 34 63 26 C62 20 61 13 56 13 Z"
      fill={P.honey}
    />
    <path d="M56 14 Q56 9 60 7" fill="none" stroke={P.woodDeep} strokeWidth="3.4" strokeLinecap="round" />
    <path d="M48 44 Q48 36 52 30" fill="none" stroke={P.honeyLight} strokeWidth="3.4" strokeLinecap="round" />
    <circle cx="30" cy="44" r="20" fill={P.sage} />
    <path
      d="M16 40 Q22 28 34 30 M22 52 Q28 40 40 42"
      fill="none"
      stroke={P.sageDeep}
      strokeWidth="2.8"
      strokeLinecap="round"
      opacity="0.7"
    />
    <path d="M16 36 Q20 28 28 26" fill="none" stroke={P.sageLight} strokeWidth="3.4" strokeLinecap="round" />
    <path d="M74 31 Q73 24 78 21" fill="none" stroke={P.sageDeep} strokeWidth="4.4" strokeLinecap="round" />
    <path
      d="M62 42 Q62 30 70 32 Q75 28 80 32 Q90 30 90 42 Q90 58 83 64 Q76 68 69 64 Q62 58 62 42 Z"
      fill={P.red}
    />
    <path
      d="M75.5 36 Q73.5 50 76 62"
      fill="none"
      stroke={P.redDeep}
      strokeWidth="2.6"
      strokeLinecap="round"
      opacity="0.55"
    />
    <path
      d="M66.5 40 Q66 46 67.5 51"
      fill="none"
      stroke={P.terraLight}
      strokeWidth="3"
      strokeLinecap="round"
      opacity="0.85"
    />
    <rect x="10" y="56" width="80" height="31" rx="6" fill={P.wood} />
    <rect x="10" y="56" width="80" height="10" rx="5" fill={P.woodLight} />
    <rect x="16" y="72" width="68" height="4" rx="2" fill={P.woodDeep} opacity="0.5" />
    <rect x="15" y="56" width="7" height="31" rx="3.5" fill={P.woodDeep} opacity="0.45" />
    <rect x="78" y="56" width="7" height="31" rx="3.5" fill={P.woodDeep} opacity="0.45" />
  </>
);

const dairy: Art = () => (
  <>
    <Ground rx={40} cy={88} />
    <g transform="translate(-9 20) scale(0.75)">
      <MilkBottle />
    </g>
    <g transform="translate(39 36) scale(0.6)">
      <CheeseWedge />
    </g>
    <Egg x={47} y={72} s={1.1} />
  </>
);

const bakery: Art = () => (
  <>
    <Ground rx={40} cy={88} />
    <path d="M38 46 Q38 16 64 16 Q90 16 90 46 Q90 54 82 54 H46 Q38 54 38 46 Z" fill={P.wood} />
    <path d="M38.6 43 H89.4 Q90 54 82 54 H46 Q38 54 38.6 43 Z" fill={P.woodDeep} opacity="0.35" />
    <path d="M46 34 Q50 23 61 21.5" fill="none" stroke={P.woodLight} strokeWidth="4" strokeLinecap="round" />
    <g fill={P.cream}>
      <ellipse cx="60" cy="29" rx="3" ry="1.8" transform="rotate(-20 60 29)" />
      <ellipse cx="72" cy="25" rx="3" ry="1.8" transform="rotate(15 72 25)" />
      <ellipse cx="79" cy="35" rx="3" ry="1.8" transform="rotate(-10 79 35)" />
      <ellipse cx="67" cy="37" rx="3" ry="1.8" transform="rotate(25 67 37)" />
    </g>
    <path
      d="M9 80 Q7 72 14 68 Q24 48 41 48 Q58 48 68 68 Q75 72 73 80 Q68 86 62 80 Q56 70 41 70 Q26 70 20 80 Q14 86 9 80 Z"
      fill={P.honey}
    />
    <g fill="none" stroke={P.honeyDeep} strokeWidth="2.8" strokeLinecap="round">
      <path d="M17 66 Q22 72 21 78" />
      <path d="M27 54 Q32 62 30 71" />
      <path d="M41 49 V70" />
      <path d="M55 54 Q50 62 52 71" />
      <path d="M65 66 Q60 72 61 78" />
    </g>
    <path
      d="M32 54 Q36 51.5 38 51 M46 51.5 Q49 52.5 51 54"
      fill="none"
      stroke={P.honeyLight}
      strokeWidth="3"
      strokeLinecap="round"
    />
  </>
);

/** A glass jar with a lid, and whatever is in it. */
const Jar = ({
  x,
  y,
  w,
  h,
  fill,
  lid,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  lid: string;
}) => (
  <>
    <rect x={x} y={y} width={w} height={h} rx="6" fill={P.blueLight} />
    <rect x={x + 3} y={y + 9} width={w - 6} height={h - 12} rx="4" fill={fill} />
    <rect x={x + 5.5} y={y + 12} width="3.6" height={h - 22} rx="1.8" fill={P.white} opacity="0.5" />
    <rect x={x + 1} y={y - 7} width={w - 2} height="10" rx="3.5" fill={lid} />
  </>
);

const pantry: Art = () => (
  <>
    <rect x="17" y="84" width="7" height="9" rx="2.5" fill={P.woodDeep} />
    <rect x="76" y="84" width="7" height="9" rx="2.5" fill={P.woodDeep} />
    <rect x="6" y="79" width="88" height="9" rx="4.5" fill={P.wood} />
    <rect x="10" y="80.5" width="60" height="3" rx="1.5" fill={P.woodLight} opacity="0.8" />
    <Jar x={10} y={21} w={25} h={58} fill={P.honey} lid={P.sageDeep} />
    <Jar x={38} y={43} w={27} h={36} fill={P.red} lid={P.honeyDeep} />
    <rect x="68" y="50" width="24" height="29" rx="4" fill={P.lav} />
    <rect x="68" y="56" width="24" height="16" fill={P.teal} />
    <circle cx="80" cy="64" r="5" fill={P.white} />
    <ellipse cx="80" cy="50.5" rx="12" ry="3.4" fill={P.lavLight} />
  </>
);

const Sausage = (p: At) => (
  <g transform={at(p)}>
    <circle cx="-15.5" cy="0" r="2.6" fill={P.terraDeep} />
    <circle cx="15.5" cy="0" r="2.6" fill={P.terraDeep} />
    <rect x="-14" y="-7" width="28" height="14" rx="7" fill={P.terra} />
    <rect x="-8" y="-4.4" width="13" height="3" rx="1.5" fill={P.terraLight} opacity="0.85" />
  </g>
);

const meat: Art = () => (
  <>
    <rect
      x="9"
      y="15"
      width="82"
      height="72"
      rx="8"
      fill={P.creamShade}
      stroke={P.line}
      strokeWidth="3"
      transform="rotate(-5 50 51)"
    />
    <Sausage x={25} y={40} r={-32} />
    <Sausage x={50} y={30} r={-6} />
    <Sausage x={76} y={39} r={36} />
    <Drumstick x={38} y={68} r={-8} s={0.82} bone={P.cream} />
  </>
);

const frozen: Art = () => (
  <>
    <Ground rx={40} cy={88} />
    <rect x="8" y="30" width="58" height="57" rx="7" fill={P.blue} />
    <rect x="8" y="73" width="58" height="14" rx="7" fill={P.blueDeep} opacity="0.35" />
    <path
      d="M8 37 Q8 30 15 30 H59 Q66 30 66 37 V43 Q61 49 56 43 Q51 37 46 43 Q41 49 36 43 Q31 37 26 43 Q21 49 16 43 Q12 39 8 43 Z"
      fill={P.blueLight}
    />
    <g stroke={P.white} strokeWidth="3.2" strokeLinecap="round">
      <path d="M37 52 V78" />
      <path d="M25.7 58.5 L48.3 71.5" />
      <path d="M25.7 71.5 L48.3 58.5" />
    </g>
    <g fill={P.white}>
      <circle cx="37" cy="51" r="2.6" />
      <circle cx="37" cy="79" r="2.6" />
      <circle cx="24.9" cy="58" r="2.6" />
      <circle cx="49.1" cy="72" r="2.6" />
      <circle cx="24.9" cy="72" r="2.6" />
      <circle cx="49.1" cy="58" r="2.6" />
    </g>
    <g transform="translate(77 46) rotate(9)">
      <rect x="-3.5" y="8" width="7" height="30" rx="3.5" fill={P.woodLight} />
      <path d="M-12 -18 Q-12 -31 0 -31 Q12 -31 12 -18 V12 Q12 17 7 17 H-7 Q-12 17 -12 12 Z" fill={P.rose} />
      <path
        d="M5 -30 Q12 -28 12 -18 V12 Q12 17 7 17 H3 Q6.5 16 6.5 12 V-22 Q6.5 -27 5 -30 Z"
        fill={P.roseDeep}
        opacity="0.4"
      />
      <rect x="-8" y="-22" width="4" height="22" rx="2" fill={P.roseLight} opacity="0.9" />
    </g>
  </>
);

const drinks: Art = () => (
  <>
    <Ground rx={40} cy={88} />
    <rect x="17" y="9" width="14" height="9" rx="3" fill={P.red} />
    <path
      d="M19 17 H29 V24 Q29 28 32 31 Q36 35 36 42 V80 Q36 87 29 87 H19 Q12 87 12 80 V42 Q12 35 16 31 Q19 28 19 24 Z"
      fill={P.honey}
    />
    <rect x="12" y="48" width="24" height="20" rx="2.5" fill={P.sage} />
    <rect x="15.5" y="38" width="3.6" height="40" rx="1.8" fill={P.honeyLight} opacity="0.9" />
    <rect x="41" y="38" width="22" height="49" rx="5.5" fill={P.teal} />
    <path d="M41 56 Q52 48 63 56 V68 Q52 60 41 68 Z" fill={P.tealLight} />
    <rect x="42.5" y="34" width="19" height="7.5" rx="3.5" fill={P.tealDeep} />
    <ellipse cx="52" cy="36.4" rx="4.6" ry="1.5" fill={P.tealLight} />
    <path d="M82 80 L88 24" fill="none" stroke={P.red} strokeWidth="4" strokeLinecap="round" />
    <path
      d="M66 50 H92 L89.4 82 Q89 87 84.5 87 H73.5 Q69 87 68.6 82 Z"
      fill={P.blueLight}
      stroke={P.blue}
      strokeWidth="2.4"
      strokeLinejoin="round"
    />
    <path d="M68.3 60 H89.7 L88 81.6 Q87.7 85 84.4 85 H73.6 Q70.3 85 70 81.6 Z" fill={P.rose} />
    <path
      d="M83.4 67 L84.5 57"
      fill="none"
      stroke={P.red}
      strokeWidth="4"
      strokeLinecap="round"
      opacity="0.6"
    />
  </>
);

const household: Art = () => (
  <>
    <Ground rx={40} cy={88} />
    <path
      d="M28 11 C40 11 46 21 46 29 C46 37 40 41 37 47 V51 H19 V47 C16 41 10 37 10 29 C10 21 16 11 28 11 Z"
      fill={P.honey}
    />
    <path d="M17 26 Q19 18 26 16" fill="none" stroke={P.honeyLight} strokeWidth="3.6" strokeLinecap="round" />
    <rect x="20" y="49" width="16" height="11" rx="3" fill={P.inkSoft} />
    <rect x="24" y="58" width="8" height="5" rx="2.5" fill={P.inkSoft} />
    <rect x="8" y="68" width="42" height="19" rx="5" fill={P.honey} />
    <rect x="8" y="68" width="42" height="8" rx="4" fill={P.sage} />
    <g fill={P.honeyDeep}>
      <circle cx="17" cy="81" r="1.8" />
      <circle cx="29" cy="82.5" r="1.8" />
      <circle cx="40" cy="80.5" r="1.8" />
    </g>
    <path d="M66 36 Q61 42 63 48" fill="none" stroke={P.tealDeep} strokeWidth="3.6" strokeLinecap="round" />
    <rect x="52" y="17" width="10" height="8" rx="2.5" fill={P.honeyDeep} />
    <path d="M62 13 H80 Q86 13 86 19 V35 H68 V27 H58 V17 Q58 13 62 13 Z" fill={P.tealDeep} />
    <rect x="68" y="32" width="14" height="12" rx="2.5" fill={P.tealDeep} />
    <path d="M58 52 Q58 43 67 43 H81 Q90 43 90 52 V80 Q90 87 83 87 H65 Q58 87 58 80 Z" fill={P.teal} />
    <rect x="61.5" y="52" width="4" height="22" rx="2" fill={P.tealLight} opacity="0.85" />
    <Sparkle x={76} y={66} s={1.1} fill={P.white} />
  </>
);

const baby: Art = () => (
  <>
    <Ground rx={40} cy={88} />
    <g transform="translate(33 57) rotate(-12)">
      <path
        d="M-6 -39 Q-6 -47 0 -47 Q6 -47 6 -39 V-35 Q12 -33 12 -28 H-12 Q-12 -33 -6 -35 Z"
        fill={P.honey}
      />
      <rect
        x="-13"
        y="-22"
        width="26"
        height="50"
        rx="8"
        fill={P.blueLight}
        stroke={P.blue}
        strokeWidth="2.4"
      />
      <path d="M-10 -5 H10 V20 Q10 25 5 25 H-5 Q-10 25 -10 20 Z" fill={P.white} />
      <path
        d="M2 2 h6 M2 10 h6 M2 18 h6"
        fill="none"
        stroke={P.blue}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <rect x="-15" y="-31" width="30" height="11" rx="4" fill={P.teal} />
    </g>
    <g transform="translate(71 49) rotate(16)">
      <rect x="-3.5" y="-10" width="7" height="30" rx="3.5" fill={P.honey} />
      <circle cx="0" cy="25" r="8" fill="none" stroke={P.lav} strokeWidth="5" />
      <circle cx="0" cy="-22" r="16" fill={P.rose} />
      <path
        d="M-15.5 -19 Q0 -13 15.5 -19 Q16 -24 15 -27 Q0 -21 -15 -27 Q-16 -24 -15.5 -19 Z"
        fill={P.roseLight}
      />
      <circle cx="-5" cy="-31" r="2.6" fill={P.honey} />
      <circle cx="6" cy="-12" r="2.6" fill={P.honey} />
    </g>
  </>
);

const pets: Art = () => (
  <>
    <Ground rx={40} cy={88} />
    <circle cx="76" cy="31" r="14" fill={P.sage} />
    <path
      d="M65 23 Q76 33 87 23 M65 39 Q76 29 87 39"
      fill="none"
      stroke={P.sageLight}
      strokeWidth="2.6"
      strokeLinecap="round"
    />
    <path d="M17 50 Q20 32 38 32 Q56 32 59 50 Z" fill={P.wood} />
    <g fill={P.woodDeep} opacity="0.6">
      <circle cx="30" cy="42" r="2.6" />
      <circle cx="40" cy="38" r="2.6" />
      <circle cx="48" cy="44" r="2.6" />
    </g>
    <path d="M14 52 H62 L68 80 Q69 87 62 87 H14 Q7 87 8 80 Z" fill={P.blue} />
    <path d="M9.3 76 H67.2 L68 80 Q69 87 62 87 H14 Q7 87 8 80 Z" fill={P.blueDeep} opacity="0.4" />
    <rect x="10" y="46" width="56" height="9" rx="4.5" fill={P.blueLight} />
    <Paw x={38} y={68} s={0.72} fill={P.white} />
    <g transform="translate(74 76) rotate(-20)">
      <rect x="-12" y="-4" width="24" height="8" rx="3" fill={P.creamShade} />
      <circle cx="-13" cy="-4.5" r="5.5" fill={P.creamShade} />
      <circle cx="-13" cy="4.5" r="5.5" fill={P.creamShade} />
      <circle cx="13" cy="-4.5" r="5.5" fill={P.creamShade} />
      <circle cx="13" cy="4.5" r="5.5" fill={P.creamShade} />
      <rect x="-9" y="-3" width="14" height="2.6" rx="1.3" fill={P.cream} />
    </g>
  </>
);

const other: Art = () => (
  <>
    <Ground rx={32} />
    <path
      d="M37 32 Q37 11 50 11 Q63 11 63 32"
      fill="none"
      stroke={P.woodDeep}
      strokeWidth="4"
      strokeLinecap="round"
    />
    <path d="M22 30 H78 L81 82 Q81 88 75 88 H25 Q19 88 19 82 Z" fill={P.woodLight} />
    <path d="M68 30 H78 L81 82 Q81 88 75 88 H69 L66 60 Z" fill={P.wood} />
    <rect x="22" y="30" width="56" height="8" rx="2.5" fill={P.wood} opacity="0.55" />
    <rect x="26" y="42" width="4" height="34" rx="2" fill={P.cream} opacity="0.6" />
    <path d="M40 34 Q40 22 46 21" fill="none" stroke={P.wood} strokeWidth="2.6" strokeLinecap="round" />
    <path d="M40 36 L47 60" fill="none" stroke={P.woodDeep} strokeWidth="2.4" strokeLinecap="round" />
    <g transform="rotate(-12 50 68)">
      <path
        d="M41 61 L46 55 H54 L59 61 V80 Q59 83 56 83 H44 Q41 83 41 80 Z"
        fill={P.white}
        stroke={P.line}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="61.5" r="2.4" fill={P.woodDeep} />
    </g>
  </>
);

export const SHOPPING: Partial<Record<ShoppingPictureId, Art>> = {
  milk,
  bread,
  eggs,
  apple,
  banana,
  berries,
  carrot,
  tomato,
  potato,
  cheese,
  yogurt,
  butter,
  cereal,
  pasta,
  rice,
  chicken,
  fish,
  juice,
  water,
  crackers,
  diapers,
  wipes,
  soap,
  toothpaste,
  paper,
  petfood,
  produce,
  dairy,
  bakery,
  pantry,
  meat,
  frozen,
  drinks,
  household,
  baby,
  pets,
  other,
};
