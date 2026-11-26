import type { ActionPictureId } from '../../../shared/pictures';
import { P } from '../palette';
import { Bubble, Drop, Face, Ground, Hand, Heart, Sparkle, type Art } from './kit';

/**
 * Things to do, third sheet: out of the door, around the kitchen, and the quiet and kind things. As on the first
 * sheet, each drawing shows the doing — the cup on its way to the sink, the crumbs on their way to the pan.
 *
 * A part that moves is always a plain <g> with the verb on it and nothing else, so the verb's own transform
 * never has to fight a transform that places the part.
 */

const Boot = ({ x, y }: { x: number; y: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <path d="M0 3 Q0 0 3 0 H11 Q14 0 14 3 V15 Q22 15.5 25 20 Q26.5 22.5 26 27 H0 Z" fill={P.red} />
    <rect x="-1" y="25" width="28.5" height="5.5" rx="2.75" fill={P.redDeep} />
    <rect x="-1.5" y="-1" width="17" height="5.5" rx="2.75" fill={P.redDeep} />
    <path d="M4.5 9 V17" stroke={P.terraLight} strokeWidth="2.6" strokeLinecap="round" opacity="0.7" />
  </g>
);

const umbrella: Art = () => (
  <>
    <Ground rx={38} />
    <rect x="48" y="6.5" width="4" height="9" rx="2" fill={P.inkSoft} />
    <path
      d="M50 38 V60 Q50 67 44 67 Q38.5 67 38.5 62"
      fill="none"
      stroke={P.inkSoft}
      strokeWidth="4"
      strokeLinecap="round"
    />
    <path
      d="M16 42 C16 22 31 12 50 12 C69 12 84 22 84 42 Q72.7 35 61.3 42 Q50 35 38.7 42 Q27.3 35 16 42 Z"
      fill={P.honey}
    />
    <path
      d="M50 12 C31 12 16 22 16 42 Q27.3 35 38.7 42 C38.7 30 43 19 50 12 Z"
      fill={P.honeyLight}
      opacity="0.75"
    />
    <path
      d="M50 12 C69 12 84 22 84 42 Q72.7 35 61.3 42 C61.3 30 57 19 50 12 Z"
      fill={P.honeyDeep}
      opacity="0.5"
    />
    <Boot x={15} y={57} />
    <Boot x={57} y={57} />
    <g className="pa-drop">
      <Drop x={10} y={24} s={0.8} />
    </g>
    <g className="pa-drop pa-d1">
      <Drop x={90} y={17} s={0.75} />
    </g>
    <g className="pa-drop pa-d2">
      <Drop x={90} y={46} s={0.8} />
    </g>
  </>
);

const LUGS: readonly (readonly [number, number])[] = [
  [0, -3.4],
  [3.2, -1.1],
  [2, 2.7],
  [-2, 2.7],
  [-3.2, -1.1],
];

const Wheel = ({ x }: { x: number }) => (
  <g className="pa-spin">
    <circle cx={x} cy="74" r="11" fill={P.ink} />
    <circle cx={x} cy="74" r="5.8" fill={P.creamShade} />
    {LUGS.map(([dx, dy]) => (
      <circle key={`${dx}:${dy}`} cx={x + dx} cy={74 + dy} r="1.15" fill={P.inkSoft} />
    ))}
  </g>
);

const car: Art = () => (
  <>
    <Ground rx={40} cy={87} />
    <path
      d="M14 49 L18 31 Q20 22 29 22 H55 Q61.5 22 65.5 27.5 L78 49 Z"
      fill={P.red}
      stroke={P.red}
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path d="M8 59 Q8 46 20 46 H78 Q91 47 91 60 V68 Q91 74 85 74 H14 Q8 74 8 68 Z" fill={P.red} />
    <path d="M8 65 H91 V68 Q91 74 85 74 H14 Q8 74 8 68 Z" fill={P.redDeep} opacity="0.55" />
    <g fill={P.blueLight} stroke={P.blueLight} strokeWidth="2" strokeLinejoin="round">
      <path d="M23 43 L25.5 31.5 Q26.3 28 30 28 H39 V43 Z" />
      <path d="M47 28 H54 Q58.5 28 61.2 32 L68.5 43 H47 Z" />
    </g>
    <path d="M51 40 L56 32" stroke={P.white} strokeWidth="3" strokeLinecap="round" opacity="0.85" />
    <path d="M28 24 H50" stroke={P.terraLight} strokeWidth="2.6" strokeLinecap="round" opacity="0.7" />
    <rect x="50" y="50" width="8" height="3" rx="1.5" fill={P.redDeep} />
    <ellipse cx="87" cy="56" rx="3" ry="4.2" fill={P.honeyLight} />
    <rect x="8" y="52" width="4" height="7.5" rx="2" fill={P.honey} />
    <rect x="84" y="63.5" width="10" height="6" rx="3" fill={P.creamShade} />
    <rect x="6" y="63.5" width="9" height="6" rx="3" fill={P.creamShade} />
    <Wheel x={28} />
    <Wheel x={71} />
  </>
);

const cup: Art = () => (
  <>
    <Ground rx={41} cy={88} />
    {/* the sink: a white tub with water in it */}
    <path
      d="M7 53 Q7 42 18 42 H82 Q93 42 93 53 V70 H7 Z"
      fill={P.white}
      stroke={P.blueLight}
      strokeWidth="2.5"
    />
    <rect x="13.5" y="47" width="73" height="24" rx="8" fill={P.blue} />
    {/* the tap, reaching in from the right */}
    <rect x="72" y="9.5" width="17" height="6" rx="3" fill={P.teal} />
    <rect x="78" y="14" width="5" height="5" fill={P.inkSoft} />
    <path
      d="M89 21.5 H77 Q66 21.5 66 30"
      fill="none"
      stroke={P.inkSoft}
      strokeWidth="9"
      strokeLinecap="round"
    />
    <rect x="59.5" y="27" width="13" height="6" rx="2.5" fill={P.inkSoft} />
    <path d="M87 19.5 H78" stroke={P.white} strokeWidth="2.4" strokeLinecap="round" opacity="0.4" />
    <g className="pa-drop pa-d2">
      <Drop x={66} y={41} s={0.7} />
    </g>
    {/* the cup, on its way in */}
    <g className="pa-drop">
      <path
        d="M22 39 Q10 39 10 47 Q10 55 23 54"
        fill="none"
        stroke={P.terra}
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path d="M19 33 H51 L48 61 Q47.5 66 42 66 H28 Q22.5 66 22 61 Z" fill={P.terra} />
      <path d="M20.8 48 H49.2" stroke={P.honey} strokeWidth="5" />
      <ellipse cx="35" cy="33" rx="16" ry="4" fill={P.terraDeep} />
      <path d="M24.5 39.5 L26 57" stroke={P.terraLight} strokeWidth="3" strokeLinecap="round" opacity="0.8" />
    </g>
    <path
      d="M7 63 H93 V78 Q93 87 84 87 H16 Q7 87 7 78 Z"
      fill={P.white}
      stroke={P.blueLight}
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    <rect x="8.2" y="64.2" width="83.6" height="6" fill={P.blueLight} />
    <path
      d="M9.5 79 Q50 83.5 90.5 79 Q89.5 85.5 84 85.5 H16 Q10.5 85.5 9.5 79 Z"
      fill={P.blueLight}
      opacity="0.7"
    />
  </>
);

const Plate = ({ x }: { x: number }) => (
  <g transform={`rotate(-9 ${x} 66)`}>
    <ellipse cx={x} cy="43" rx="13" ry="23" fill={P.white} stroke={P.blue} strokeWidth="3" />
    <ellipse cx={x} cy="43" rx="6.5" ry="13.5" fill={P.blueLight} />
  </g>
);

const dishes: Art = () => (
  <>
    <Ground rx={40} cy={87} ry={4} />
    <rect x="15" y="58" width="72" height="14" rx="5" fill={P.woodDeep} />
    <Plate x={34} />
    <Plate x={54} />
    <Plate x={74} />
    <g fill={P.wood}>
      <rect x="21.5" y="52" width="5" height="18" rx="2.5" />
      <rect x="41.5" y="52" width="5" height="18" rx="2.5" />
      <rect x="61.5" y="52" width="5" height="18" rx="2.5" />
      <rect x="81.5" y="52" width="5" height="18" rx="2.5" />
    </g>
    <rect x="10" y="66" width="80" height="18" rx="7" fill={P.wood} />
    <rect x="10" y="66" width="80" height="6.5" rx="3.25" fill={P.woodLight} />
    <Bubble x={12} y={22} r={5.5} className="pa-float" />
    <Bubble x={88} y={31} r={4} className="pa-float pa-d2" />
    <g className="pa-twinkle">
      <Sparkle x={85} y={14} s={0.85} />
    </g>
  </>
);

const wipe: Art = () => (
  <>
    <Ground rx={42} cy={88} />
    <rect x="13" y="62" width="8" height="25" rx="3.5" fill={P.woodDeep} />
    <rect x="79" y="62" width="8" height="25" rx="3.5" fill={P.woodDeep} />
    <path
      d="M19 38 H81 Q84.5 38 86 41 L93 56 Q94.5 60 91 60 H9 Q5.5 60 7 56 L14 41 Q15.5 38 19 38 Z"
      fill={P.woodLight}
    />
    <rect x="6.5" y="58" width="87" height="8.5" rx="4" fill={P.wood} />
    {/* clean where the cloth has been */}
    <path
      d="M20 52.5 Q32 42.5 46 47"
      fill="none"
      stroke={P.white}
      strokeWidth="8"
      strokeLinecap="round"
      opacity="0.55"
    />
    <g className="pa-twinkle">
      <Sparkle x={22} y={30} s={1.15} />
    </g>
    <g className="pa-twinkle pa-d2">
      <Sparkle x={37} y={18} s={0.7} />
    </g>
    {/* crumbs still to go */}
    <circle cx="77" cy="46.5" r="2.2" fill={P.woodDeep} />
    <circle cx="84" cy="52" r="1.8" fill={P.terraDeep} />
    <circle cx="72.5" cy="53" r="1.6" fill={P.woodDeep} />
    <g className="pa-scrub">
      <path
        d="M35 49 Q42 42 55 43.5 Q66 45 66.5 51 Q66 58 53 58 Q40 58.5 35.5 54 Q33.5 51 35 49 Z"
        fill={P.sage}
      />
      <path
        d="M39.5 52 Q44 54.5 50 54"
        fill="none"
        stroke={P.sageDeep}
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.5"
      />
      <g transform="translate(60 42) rotate(215) scale(1.2)">
        <Hand x={0} y={0} />
      </g>
    </g>
  </>
);

const sweep: Art = () => (
  <>
    <Ground rx={42} />
    {/* the dustpan */}
    <path d="M84 66 L89.5 50" stroke={P.tealDeep} strokeWidth="5.5" strokeLinecap="round" />
    <path
      d="M58 86 Q54.5 86 56.5 82.5 L66 67 Q67.5 64 71 64 H87 Q91 64 91 68 V82 Q91 86 87 86 Z"
      fill={P.teal}
    />
    <path d="M62.5 79 L69 68.5" stroke={P.tealLight} strokeWidth="2.6" strokeLinecap="round" opacity="0.9" />
    {/* crumbs */}
    <circle cx="47.5" cy="82" r="2.2" fill={P.woodDeep} />
    <circle cx="52" cy="85.5" r="1.9" fill={P.honeyDeep} />
    <circle cx="45" cy="86.5" r="1.6" fill={P.terraDeep} />
    {/* the broom */}
    <g className="pa-swing">
      <g transform="translate(40 52) rotate(24)">
        <path d="M0 2 V-46" stroke={P.wood} strokeWidth="5" strokeLinecap="round" />
        <path
          d="M-9 7 L-14.5 29 Q0 33.5 14.5 29 L9 7 Z"
          fill={P.honey}
          stroke={P.honey}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="M-5 15 L-7 29 M5 15 L7 29"
          stroke={P.honeyDeep}
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.6"
        />
        <rect x="-11" y="0" width="22" height="9" rx="4" fill={P.red} />
      </g>
    </g>
  </>
);

const Bin = ({ x, fill, deep, light }: { x: number; fill: string; deep: string; light: string }) => (
  <g transform={`translate(${x} 0)`}>
    {/* the lid, standing open */}
    <ellipse cx="0" cy="37" rx="16" ry="11.5" fill={fill} />
    <ellipse cx="0" cy="38" rx="11.5" ry="7.5" fill={deep} opacity="0.35" />
    <ellipse cx="0" cy="48" rx="16.5" ry="4.8" fill={deep} />
    <path
      d="M-16.5 48 L-13.8 82 Q-13.3 87 -8.3 87 H8.3 Q13.3 87 13.8 82 L16.5 48 Q0 56 -16.5 48 Z"
      fill={fill}
    />
    <path d="M-10.5 61 L-9.3 79" stroke={light} strokeWidth="3" strokeLinecap="round" opacity="0.6" />
    <rect x="-5.5" y="84.5" width="11" height="5" rx="2.5" fill={deep} />
    <path d="M-16.5 48 Q0 56 16.5 48" fill="none" stroke={light} strokeWidth="4" strokeLinecap="round" />
  </g>
);

const bins: Art = () => (
  <>
    <Ground rx={42} cy={90} ry={4} />
    <Bin x={29} fill={P.sage} deep={P.sageDeep} light={P.sageLight} />
    <Bin x={71} fill={P.inkSoft} deep={P.ink} light={P.lavLight} />
    {/* a bottle for one */}
    <g className="pa-drop">
      <g transform="rotate(18 29 22)">
        <rect x="23.5" y="16" width="11" height="18" rx="4" fill={P.blue} />
        <rect x="26.5" y="9.5" width="5" height="9" rx="2" fill={P.blue} />
        <rect x="25.5" y="7" width="7" height="4.5" rx="2.2" fill={P.blueDeep} />
        <rect x="25.8" y="20" width="2.6" height="9" rx="1.3" fill={P.blueLight} opacity="0.8" />
      </g>
    </g>
    {/* an apple core for the other */}
    <g className="pa-drop pa-d2">
      <g transform="rotate(-14 71 22)">
        <path
          d="M71 11 Q71.5 8 74 6.5"
          fill="none"
          stroke={P.woodDeep}
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <path d="M65 15 Q71 12 77 15 Q73 22 77 29 Q71 32 65 29 Q69 22 65 15 Z" fill={P.honeyLight} />
        <path
          d="M61.5 14 Q71 6.5 80.5 14 Q80.5 17.5 77 18 Q71 14.5 65 18 Q61.5 17.5 61.5 14 Z"
          fill={P.red}
        />
        <path
          d="M61.5 30.5 Q71 37.5 80.5 30.5 Q80.5 27 77 26.5 Q71 30 65 26.5 Q61.5 27 61.5 30.5 Z"
          fill={P.red}
        />
        <ellipse cx="71" cy="22.5" rx="1.4" ry="2.1" fill={P.woodDeep} />
      </g>
    </g>
  </>
);

const plant: Art = () => (
  <>
    <Ground cx={32} rx={24} />
    {/* the plant */}
    <path d="M30 66 V50" stroke={P.sageDeep} strokeWidth="3.5" strokeLinecap="round" />
    <path d="M30 60 Q45 61 51 48 Q36 43 30 60 Z" fill={P.sageDeep} />
    <path d="M30 62 Q16 64 9 51 Q24 45 30 62 Z" fill={P.sage} />
    <path d="M30 54 Q22 46 26 35 Q36 42 30 54 Z" fill={P.sage} />
    <rect x="13" y="64" width="34" height="9" rx="4" fill={P.terra} />
    <path d="M16 70 H44 L41 84 Q40.5 88 36.5 88 H23.5 Q19.5 88 19 84 Z" fill={P.terra} />
    <path d="M16.3 73 H43.7 L43 76 H17 Z" fill={P.terraDeep} opacity="0.55" />
    <path d="M23 78 L24 84" stroke={P.terraLight} strokeWidth="3" strokeLinecap="round" opacity="0.85" />
    {/* the watering can */}
    <g className="pa-tilt">
      <g transform="translate(50 22) rotate(-30)">
        <path
          d="M27 5 Q37 4 37 12 Q37 20 27 19"
          fill="none"
          stroke={P.honeyDeep}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path d="M3 11 L-17.5 6.5 L-19 12.5 L3 21 Z" fill={P.honey} />
        <rect x="0" y="0" width="28" height="23" rx="6" fill={P.honey} />
        <path d="M-20.3 15.5 L-16.7 4" stroke={P.honeyDeep} strokeWidth="5.5" strokeLinecap="round" />
        <rect x="5" y="4.5" width="4" height="11" rx="2" fill={P.honeyLight} opacity="0.9" />
      </g>
    </g>
    <g className="pa-drop">
      <Drop x={32.5} y={45} s={0.65} />
    </g>
    <g className="pa-drop pa-d1">
      <Drop x={27.5} y={53} s={0.75} />
    </g>
    <g className="pa-drop pa-d2">
      <Drop x={34.5} y={60} s={0.65} />
    </g>
  </>
);

const pet: Art = () => (
  <>
    <Ground rx={41} />
    <ellipse cx="48" cy="58" rx="31" ry="7" fill={P.redDeep} />
    <g fill={P.woodDeep}>
      <circle cx="37" cy="52.5" r="5" />
      <circle cx="49" cy="51" r="5.5" />
      <circle cx="60" cy="54" r="5" />
    </g>
    <g fill={P.wood}>
      <circle cx="31" cy="57.5" r="5" />
      <circle cx="42.5" cy="56.5" r="5.5" />
      <circle cx="54" cy="57" r="5.5" />
      <circle cx="64.5" cy="58.5" r="4.5" />
    </g>
    <path d="M17 58 Q48 70 79 58 L85 82 Q86 88 80 88 H16 Q10 88 11 82 Z" fill={P.red} />
    <path d="M11.5 80 H84.5 L85 82 Q86 88 80 88 H16 Q10 88 11 82 Z" fill={P.redDeep} opacity="0.5" />
    <path d="M17 58 Q48 70 79 58" fill="none" stroke={P.terraLight} strokeWidth="4" strokeLinecap="round" />
    <g fill={P.cream}>
      <ellipse cx="48" cy="80" rx="6" ry="4.8" />
      <circle cx="39.5" cy="76" r="2.5" />
      <circle cx="45" cy="72" r="2.6" />
      <circle cx="51" cy="72" r="2.6" />
      <circle cx="56.5" cy="76" r="2.5" />
    </g>
    {/* the scoop */}
    <g transform="translate(62 30) rotate(-38)">
      <rect x="19" y="-3.2" width="13" height="6.4" rx="3.2" fill={P.tealDeep} />
      <path d="M0 -9 H14 Q21 -9 21 -2 V2 Q21 9 14 9 H0 Z" fill={P.teal} />
      <rect x="-2.5" y="-10.5" width="5" height="21" rx="2.5" fill={P.tealDeep} />
      <rect x="6" y="-6" width="10" height="2.6" rx="1.3" fill={P.tealLight} opacity="0.85" />
    </g>
    <g className="pa-drop" fill={P.wood}>
      <circle cx="55" cy="37.5" r="3" />
      <circle cx="50" cy="42" r="3.4" />
      <circle cx="58" cy="45" r="2.8" />
    </g>
  </>
);

const Cracker = ({ x, y, r }: { x: number; y: number; r: number }) => (
  <g transform={`translate(${x} ${y}) rotate(${r})`}>
    <rect x="-8" y="-6.5" width="16" height="16" rx="3.5" fill={P.wood} />
    <rect x="-8" y="-8.5" width="16" height="16" rx="3.5" fill={P.woodLight} />
    <g fill={P.wood}>
      <circle cx="-3.2" cy="-3.7" r="1.3" />
      <circle cx="3.2" cy="-3.7" r="1.3" />
      <circle cx="-3.2" cy="2.7" r="1.3" />
      <circle cx="3.2" cy="2.7" r="1.3" />
    </g>
  </g>
);

const snack: Art = () => (
  <>
    <Ground rx={40} cy={88} ry={4} />
    <ellipse cx="50" cy="72" rx="42" ry="13.5" fill={P.teal} />
    <ellipse cx="50" cy="70.5" rx="33" ry="9" fill={P.tealLight} />
    <Cracker x={67} y={52} r={-12} />
    <Cracker x={78} y={61} r={12} />
    <g className="pa-wiggle">
      <path d="M38 27 Q39 19 44 15" fill="none" stroke={P.woodDeep} strokeWidth="3.2" strokeLinecap="round" />
      <path d="M41 23 Q48 12 58 16 Q52 27 41 23 Z" fill={P.sage} />
      <path
        d="M38 29 C29 22 14 29 16 46 C18 61 30 70 38 66 C46 70 58 61 60 46 C62 29 47 22 38 29 Z"
        fill={P.red}
      />
      <path
        d="M38 66 C46 70 58 61 60 46 C61 37 56 30 50 27.5 C54 34 55 44 52 53 C49 61 43 65 38 66 Z"
        fill={P.redDeep}
        opacity="0.45"
      />
      <path
        d="M22 45 Q22 35 30 31.5"
        fill="none"
        stroke={P.terraLight}
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.85"
      />
    </g>
  </>
);

const BARS: [x: number, h: number, fill: string][] = [
  [13, 46, P.red],
  [27.5, 41, P.honey],
  [42, 36, P.sage],
  [56.5, 31, P.blue],
  [71, 26, P.lav],
];

const Mallet = ({ d, cx, cy }: { d: string; cx: number; cy: number }) => (
  <>
    <path d={d} stroke={P.wood} strokeWidth="3.2" strokeLinecap="round" />
    <circle cx={cx} cy={cy} r="5.5" fill={P.woodDeep} />
    <circle cx={cx - 1.6} cy={cy - 1.8} r="1.6" fill={P.woodLight} opacity="0.8" />
  </>
);

const music: Art = () => (
  <>
    <path d="M9 50 L87 57 M9 80 L87 73" stroke={P.wood} strokeWidth="5.5" strokeLinecap="round" />
    {BARS.map(([x, h, fill]) => (
      <g key={x}>
        <rect x={x} y={65 - h / 2} width="11" height={h} rx="4.5" fill={fill} />
        <circle cx={x + 5.5} cy={50.5 + (x - 13) * 0.09} r="1.5" fill={P.white} opacity="0.75" />
        <circle cx={x + 5.5} cy={79.5 - (x - 13) * 0.09} r="1.5" fill={P.white} opacity="0.75" />
      </g>
    ))}
    {/* two notes */}
    <g className="pa-bob" fill={P.lavDeep}>
      <ellipse cx="41" cy="30" rx="5.2" ry="4" transform="rotate(-20 41 30)" />
      <ellipse cx="58" cy="26" rx="5.2" ry="4" transform="rotate(-20 58 26)" />
      <path
        d="M45 29 V11.5 L62 7.5 V25"
        fill="none"
        stroke={P.lavDeep}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M45 15.5 L62 11.5" stroke={P.lavDeep} strokeWidth="3" strokeLinecap="round" />
    </g>
    <g className="pa-wiggle">
      <Mallet d="M12 20 L31 43" cx={32.5} cy={45} />
    </g>
    <g className="pa-wiggle pa-d2">
      <Mallet d="M88 22 L66 47" cx={64.5} cy={49} />
    </g>
  </>
);

const Crayon = ({ x, y, r, fill, deep }: { x: number; y: number; r: number; fill: string; deep: string }) => (
  <g transform={`translate(${x} ${y}) rotate(${r})`}>
    <path d="M0 0 Q0 -1.5 1.5 -2 L8 -4.2 V4.2 L1.5 2 Q0 1.5 0 0 Z" fill={fill} />
    <rect x="7" y="-4.6" width="25" height="9.2" rx="2.6" fill={fill} />
    <rect x="13" y="-4.6" width="13" height="9.2" fill={deep} />
    <rect x="9" y="-3" width="21" height="2.4" rx="1.2" fill={P.white} opacity="0.35" />
  </g>
);

const drawing: Art = () => (
  <>
    <g transform="rotate(-5 41 49)">
      <rect x="14" y="18.5" width="60" height="68" rx="5" fill={P.creamShade} />
      <rect
        x="11"
        y="15"
        width="60"
        height="68"
        rx="5"
        fill={P.paper}
        stroke={P.creamShade}
        strokeWidth="2.5"
      />
    </g>
    {/* what has been drawn so far */}
    <circle cx="34" cy="35" r="8.5" fill={P.honey} />
    <path
      d="M34 22.5 V18.5 M42.8 26.2 L45.7 23.3 M46.5 35 H50.5 M42.8 43.8 L45.7 46.7 M34 47.5 V51.5 M25.2 43.8 L22.3 46.7 M21.5 35 H17.5 M25.2 26.2 L22.3 23.3"
      stroke={P.honey}
      strokeWidth="3"
      strokeLinecap="round"
    />
    <path
      d="M19 64 q5.5 -9 11 0 t11 0 t11 0"
      fill="none"
      stroke={P.blue}
      strokeWidth="3.5"
      strokeLinecap="round"
    />
    <g className="pa-wiggle">
      <Crayon x={52} y={64} r={-48} fill={P.blue} deep={P.blueDeep} />
    </g>
    <Crayon x={82} y={52} r={80} fill={P.honey} deep={P.honeyDeep} />
  </>
);

const outside: Art = () => (
  <>
    <rect x="6" y="10" width="88" height="78" rx="14" fill={P.blueLight} />
    <g className="pa-spin">
      <path
        d="M24 16 V12.5 M32.5 19.5 L35 17 M36 28 H39.5 M32.5 36.5 L35 39 M24 40 V43.5 M15.5 36.5 L13 39 M12 28 H8.5 M15.5 19.5 L13 17"
        stroke={P.honey}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </g>
    <circle cx="24" cy="28" r="8.5" fill={P.honey} />
    <path
      d="M18.5 26 Q20 21.5 24.5 21"
      fill="none"
      stroke={P.honeyLight}
      strokeWidth="2.6"
      strokeLinecap="round"
    />
    <path
      d="M62 37 a6.5 6.5 0 0 1 1 -12.9 a9.5 9.5 0 0 1 17.5 -1.5 a7.5 7.5 0 0 1 3.5 14.4 Z"
      fill={P.white}
    />
    <path d="M6 70 Q28 62 50 68 Q74 75 94 66 V78 Q94 88 84 88 H16 Q6 88 6 78 Z" fill={P.sage} />
    <path
      d="M6 79 Q34 72 58 80 Q76 85 94 78 Q94 88 84 88 H16 Q6 88 6 78 Z"
      fill={P.sageDeep}
      opacity="0.55"
    />
    <Ground cx={51} cy={81} rx={17} ry={3.5} />
    <g className="pa-bob">
      <g transform="rotate(-22 50 60)">
        <circle cx="50" cy="60" r="21" fill={P.red} />
        <path d="M50 39 A21 21 0 0 1 50 81 Z" fill={P.blue} />
        <path d="M50 39 Q65 60 50 81 Q35 60 50 39 Z" fill={P.honey} />
      </g>
      <ellipse
        cx="39.5"
        cy="50"
        rx="5.5"
        ry="3.4"
        fill={P.white}
        opacity="0.55"
        transform="rotate(-40 39.5 50)"
      />
    </g>
  </>
);

const tidy: Art = () => (
  <>
    <Ground rx={40} />
    <rect x="14" y="24" width="72" height="64" rx="8" fill={P.wood} />
    <rect x="14" y="24" width="72" height="6.5" rx="3.25" fill={P.woodLight} />
    <g fill={P.woodDeep}>
      <rect x="20" y="31" width="27" height="24" rx="4" />
      <rect x="53" y="31" width="27" height="24" rx="4" />
      <rect x="20" y="60" width="27" height="22" rx="4" />
      <rect x="53" y="60" width="27" height="22" rx="4" />
    </g>
    {/* a ball, a ring stack, and two boxes, each in its own place */}
    <circle cx="33.5" cy="45.5" r="9" fill={P.red} />
    <path
      d="M27.5 43.5 Q28.5 39 33 38.5"
      fill="none"
      stroke={P.terraLight}
      strokeWidth="2.6"
      strokeLinecap="round"
      opacity="0.85"
    />
    <rect x="57.5" y="48" width="18" height="7" rx="3.5" fill={P.blue} />
    <rect x="60" y="41.5" width="13" height="7" rx="3.5" fill={P.sage} />
    <rect x="62.5" y="35" width="8" height="7" rx="3.5" fill={P.honey} />
    <rect x="22.5" y="64" width="22" height="18" rx="4" fill={P.teal} />
    <rect x="22.5" y="64" width="22" height="5" rx="2.5" fill={P.tealLight} />
    <rect x="29.5" y="72" width="8" height="3.5" rx="1.75" fill={P.tealDeep} />
    <rect x="55.5" y="64" width="22" height="18" rx="4" fill={P.lav} />
    <rect x="55.5" y="64" width="22" height="5" rx="2.5" fill={P.lavLight} />
    <rect x="62.5" y="72" width="8" height="3.5" rx="1.75" fill={P.lavDeep} />
    <g className="pa-twinkle">
      <Sparkle x={24} y={14.5} s={0.85} />
    </g>
    <g className="pa-twinkle pa-d1">
      <Sparkle x={78} y={14} s={1.1} />
    </g>
    <g className="pa-twinkle pa-d2">
      <Sparkle x={52} y={12} s={0.6} />
    </g>
  </>
);

/** The kit's mitten, for the other person: the same hand in a different sleeve. */
const Mitt = ({ x, y, r, sleeve }: { x: number; y: number; r: number; sleeve: string }) => (
  <g transform={`translate(${x} ${y}) rotate(${r}) scale(-1.3 1.3)`}>
    <rect x="-6" y="2" width="12" height="16" rx="5" fill={sleeve} />
    <ellipse cx="0" cy="-3" rx="8.5" ry="8" fill={P.skin} />
    <ellipse cx="-8" cy="-2" rx="3.4" ry="4.2" fill={P.skin} />
    <ellipse cx="-2" cy="-5" rx="3" ry="2" fill={P.white} opacity="0.35" />
  </g>
);

const kind: Art = () => (
  <>
    <g className="pa-float">
      <Heart x={13.5} y={19} s={0.6} fill={P.rose} />
    </g>
    <g className="pa-float pa-d2">
      <Heart x={86} y={25} s={0.5} fill={P.rose} />
    </g>
    <g className="pa-bob">
      <Heart x={50} y={40} s={2.6} fill={P.redDeep} />
      <Heart x={49.2} y={39.2} s={2.45} fill={P.red} />
      <path
        d="M33.5 33 Q34 25 41 24"
        fill="none"
        stroke={P.terraLight}
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.8"
      />
    </g>
    <g transform="translate(33 66) rotate(28) scale(1.3)">
      <Hand x={0} y={0} />
    </g>
    <Mitt x={67} y={66} r={-28} sleeve={P.honey} />
  </>
);

const rest: Art = () => (
  <>
    <Ground rx={42} cy={87} />
    {/* the beanbag */}
    <path d="M9 63 Q6 39 30 34 Q50 28 70 34 Q94 39 91 63 Q89 85 50 85 Q11 85 9 63 Z" fill={P.lav} />
    <path d="M9.3 66 Q50 79 90.7 66 Q88 85 50 85 Q12 85 9.3 66 Z" fill={P.lavDeep} opacity="0.4" />
    <path
      d="M15.5 53 Q17 42.5 28.5 38.5"
      fill="none"
      stroke={P.lavLight}
      strokeWidth="3.5"
      strokeLinecap="round"
      opacity="0.9"
    />
    {/* a book for later */}
    <g transform="rotate(12 74 43)">
      <rect x="63" y="29" width="22" height="28" rx="3.5" fill={P.blue} />
      <rect x="63" y="29" width="5.5" height="28" rx="2.75" fill={P.blueDeep} />
      <circle cx="77" cy="40" r="4.5" fill={P.honeyLight} />
    </g>
    {/* a sleepy bear */}
    <g className="pa-bob">
      <circle cx="26" cy="29" r="6.5" fill={P.woodLight} />
      <circle cx="52" cy="29" r="6.5" fill={P.woodLight} />
      <circle cx="26" cy="29" r="3" fill={P.wood} />
      <circle cx="52" cy="29" r="3" fill={P.wood} />
      <ellipse cx="39" cy="41" rx="16" ry="14" fill={P.woodLight} />
      <Face x={39} y={41} sleepy />
    </g>
    {/* the blanket */}
    <path
      d="M22 59 Q34 52 47 56 Q63 61 81 53 Q86 65 84 82.5 Q78.5 87.5 73 82.5 Q67.5 87.5 62 82.5 Q56.5 87.5 51 82.5 Q45.5 87.5 40 82.5 Q34.5 87.5 29 82.5 Q24.5 87.5 21 82.5 Q18 69 22 59 Z"
      fill={P.roseLight}
    />
    <g fill={P.rose}>
      <circle cx="31" cy="68" r="2.4" />
      <circle cx="45" cy="74" r="2.4" />
      <circle cx="58" cy="68" r="2.4" />
      <circle cx="72" cy="73" r="2.4" />
    </g>
    <path
      d="M22 59 Q34 52 47 56 Q63 61 81 53"
      fill="none"
      stroke={P.rose}
      strokeWidth="5"
      strokeLinecap="round"
    />
  </>
);

export const ACTIONS_C: Partial<Record<ActionPictureId, Art>> = {
  umbrella,
  car,
  cup,
  dishes,
  wipe,
  sweep,
  bins,
  plant,
  pet,
  snack,
  music,
  drawing,
  outside,
  tidy,
  kind,
  rest,
};
