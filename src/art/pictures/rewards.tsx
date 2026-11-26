import type { RewardPictureId } from '../../../shared/pictures';
import { P } from '../palette';
import { BasketBack, BasketFront, Bubble, Face, Ground, Hand, Heart, Sparkle, type Art } from './kit';

/**
 * Things to choose in the reward shop. Each drawing is the treat itself — the cone, the tent, the bike — drawn
 * big and plain, so a child can point at the one they are saving for without being read to.
 */

const Pawn = ({ x, y, fill }: { x: number; y: number; fill: string }) => (
  <g transform={`translate(${x} ${y})`}>
    <path d="M-9 1 Q-9 -4 -5 -6 L-3 -15 H3 L5 -6 Q9 -4 9 1 Q9 4 6 4 H-6 Q-9 4 -9 1 Z" fill={fill} />
    <circle cx="0" cy="-19" r="7" fill={fill} />
    <circle cx="-2.4" cy="-21.4" r="2.4" fill={P.white} opacity="0.5" />
  </g>
);

const BOARD =
  'M25 34 H75 Q80 34 81.5 38.5 L91 68 Q92.5 75 85.5 75 H14.5 Q7.5 75 9 68 L18.5 38.5 Q20 34 25 34 Z';
const TRACK = 'M22 62 Q42 68 51 56 Q59 45 77 47';

const game: Art = () => (
  <>
    <Ground rx={41} />
    <path d={BOARD} fill={P.sageDeep} transform="translate(0 7)" />
    <path d={BOARD} fill={P.sage} />
    <path
      d="M28 40 H72 Q75 40 76 43 L83 65 Q84 69 80 69 H20 Q16 69 17 65 L24 43 Q25 40 28 40 Z"
      fill={P.sageLight}
    />
    {/* the path the pawns walk */}
    <path d={TRACK} fill="none" stroke={P.white} strokeWidth="9.5" strokeLinecap="round" />
    <path
      d={TRACK}
      fill="none"
      stroke={P.honey}
      strokeWidth="5.5"
      strokeLinecap="round"
      strokeDasharray="0.1 10.2"
    />
    <g className="pa-bob">
      <Pawn x={34} y={62} fill={P.blue} />
    </g>
    <Pawn x={62} y={46.5} fill={P.rose} />
    <g className="pa-wiggle">
      <g transform="rotate(10 76 72)">
        <rect
          x="63"
          y="59"
          width="26"
          height="26"
          rx="6.5"
          fill={P.white}
          stroke={P.blueLight}
          strokeWidth="2.5"
        />
        <g fill={P.ink}>
          <circle cx="69.5" cy="65.5" r="2.5" />
          <circle cx="82.5" cy="65.5" r="2.5" />
          <circle cx="76" cy="72" r="2.5" />
          <circle cx="69.5" cy="78.5" r="2.5" />
          <circle cx="82.5" cy="78.5" r="2.5" />
        </g>
      </g>
    </g>
  </>
);

const Spine = ({ x, y, h, fill, band }: { x: number; y: number; h: number; fill: string; band: string }) => (
  <>
    <rect x={x} y={y} width="20" height={h} rx="4.5" fill={fill} />
    <rect x={x + 3} y={y + 6} width="14" height="5" rx="2.5" fill={band} />
    <rect x={x + 3} y={y + h - 10} width="14" height="3" rx="1.5" fill={band} opacity="0.7" />
  </>
);

const storypick: Art = () => (
  <>
    <rect x="11" y="80" width="78" height="8" rx="4" fill={P.wood} />
    <rect x="11" y="80" width="78" height="3.5" rx="1.75" fill={P.woodLight} />
    <Spine x={16} y={38} h={42} fill={P.teal} band={P.tealLight} />
    <Spine x={64} y={44} h={36} fill={P.lav} band={P.lavLight} />
    {/* the one that was chosen */}
    <g className="pa-bob">
      <Spine x={40} y={30} h={42} fill={P.red} band={P.honeyLight} />
      <path d="M70 21 L78 13" stroke={P.blue} strokeWidth="12" strokeLinecap="round" />
      <Hand x={60} y={31} r={-135} />
    </g>
    <g className="pa-twinkle">
      <Sparkle x={25} y={23} />
    </g>
    <g className="pa-twinkle pa-d2">
      <Sparkle x={83} y={33} s={0.7} />
    </g>
  </>
);

const park: Art = () => (
  <>
    <ellipse cx="50" cy="83" rx="41" ry="6" fill={P.sage} />
    <circle cx="26" cy="26" r="8.5" fill={P.honey} />
    <path
      d="M26 14 V11 M14 26 H11 M17.5 17.5 L15.4 15.4 M34.5 17.5 L36.6 15.4 M17.5 34.5 L15.4 36.6"
      stroke={P.honey}
      strokeWidth="3"
      strokeLinecap="round"
    />
    {/* the slide */}
    <path
      d="M47 53 Q34 54 28 68 Q24 79 14 80"
      fill="none"
      stroke={P.red}
      strokeWidth="8"
      strokeLinecap="round"
    />
    <path
      d="M45 51.5 Q33 53 27 66"
      fill="none"
      stroke={P.terraLight}
      strokeWidth="2.4"
      strokeLinecap="round"
      opacity="0.8"
    />
    <path d="M51 64 H63 M51 74 H63" stroke={P.woodDeep} strokeWidth="3" strokeLinecap="round" />
    <rect x="46" y="32" width="5" height="52" rx="2.5" fill={P.wood} />
    <rect x="63" y="32" width="5" height="52" rx="2.5" fill={P.wood} />
    <rect x="43" y="50" width="28" height="6" rx="3" fill={P.woodDeep} />
    <path d="M42 33 L57 19 L72 33 Z" fill={P.teal} stroke={P.teal} strokeWidth="4" strokeLinejoin="round" />
    {/* the swing */}
    <rect x="66" y="37" width="25" height="5" rx="2.5" fill={P.wood} />
    <rect x="86" y="37" width="5" height="47" rx="2.5" fill={P.wood} />
    <g className="pa-swing">
      <path d="M73 42 V63 M82 42 V63" stroke={P.woodDeep} strokeWidth="2.4" strokeLinecap="round" />
      <rect x="69.5" y="62" width="16" height="5.5" rx="2.75" fill={P.blue} />
    </g>
  </>
);

const movie: Art = () => (
  <>
    <Ground rx={41} />
    <path
      d="M31 22 L24 12 M41 22 L48 12 M21 64 L17 86 M45 64 L48 86"
      stroke={P.inkSoft}
      strokeWidth="3.4"
      strokeLinecap="round"
    />
    <circle cx="24" cy="12" r="3" fill={P.inkSoft} />
    <circle cx="48" cy="12" r="3" fill={P.inkSoft} />
    <rect x="8" y="20" width="64" height="47" rx="10" fill={P.teal} />
    <path d="M17 23.2 H38" stroke={P.tealLight} strokeWidth="2.4" strokeLinecap="round" opacity="0.8" />
    <rect x="14" y="26" width="42" height="35" rx="7" fill={P.blue} />
    <circle cx="44" cy="37" r="5.5" fill={P.honey} />
    <path d="M14 51 Q25 43 35 49 Q46 55 56 47 V54 Q56 61 49 61 H21 Q14 61 14 54 Z" fill={P.sage} />
    <path d="M19 40 L29 30" stroke={P.white} strokeWidth="3" strokeLinecap="round" opacity="0.5" />
    <circle cx="64" cy="33" r="3.2" fill={P.honey} />
    <circle cx="64" cy="43" r="3.2" fill={P.tealDeep} />
    {/* popcorn */}
    <g fill={P.honey}>
      <circle cx="62" cy="50" r="7" />
      <circle cx="76" cy="47" r="7.5" />
    </g>
    <g fill={P.honeyLight}>
      <circle cx="56" cy="55" r="6.5" />
      <circle cx="68" cy="53" r="7.5" />
      <circle cx="80" cy="54" r="7" />
      <circle cx="86" cy="56.5" r="4.5" />
    </g>
    <g className="pa-bob">
      <circle cx="85" cy="35" r="5.5" fill={P.honeyLight} />
    </g>
    <path d="M51 59 H89 L84.5 85 Q84 88.5 80.5 88.5 H59.5 Q56 88.5 55.5 85 Z" fill={P.red} />
    <path d="M58.6 59 H66.2 L67.1 88.5 H61.3 Z M73.8 59 H81.4 L78.7 88.5 H72.9 Z" fill={P.white} />
    <rect x="49" y="56" width="42" height="6" rx="3" fill={P.redDeep} />
  </>
);

const baking: Art = () => (
  <>
    <Ground rx={41} />
    <ellipse cx="38" cy="54" rx="29" ry="8" fill={P.honeyLight} />
    <g className="pa-wiggle">
      <g transform="translate(40 53) rotate(26)">
        <ellipse cx="0" cy="-11" rx="8.5" ry="12" fill="none" stroke={P.inkSoft} strokeWidth="2.6" />
        <path d="M0 -23 V1" stroke={P.inkSoft} strokeWidth="2.6" strokeLinecap="round" />
        <rect x="-3.5" y="-44" width="7" height="23" rx="3.5" fill={P.red} />
      </g>
    </g>
    <path d="M9 54 Q9 84 38 84 Q67 84 67 54 Q38 66 9 54 Z" fill={P.terra} />
    <path
      d="M15 62 Q18 74 29 79"
      fill="none"
      stroke={P.terraLight}
      strokeWidth="4"
      strokeLinecap="round"
      opacity="0.7"
    />
    <rect x="25" y="81" width="26" height="6.5" rx="3.25" fill={P.terraDeep} />
    {/* a cupcake, already made */}
    <path d="M62 67 H90 L87 85 Q86.5 88 83.5 88 H68.5 Q65.5 88 65 85 Z" fill={P.blue} />
    <path
      d="M71 70 L72 85 M81 70 L80 85"
      stroke={P.blueDeep}
      strokeWidth="2.4"
      strokeLinecap="round"
      opacity="0.6"
    />
    <path d="M60 68 Q59 59 67 57 Q68 48 76 48 Q84 48 85 57 Q93 59 92 68 Q76 73 60 68 Z" fill={P.rose} />
    <path d="M65 61 Q67 54 74 53" fill="none" stroke={P.roseLight} strokeWidth="3" strokeLinecap="round" />
    <circle cx="76" cy="46" r="4.5" fill={P.red} />
  </>
);

const dinner: Art = () => (
  <>
    <circle cx="58" cy="52" r="31" fill={P.white} stroke={P.blueLight} strokeWidth="2.5" />
    <circle cx="58" cy="52" r="22.5" fill={P.cream} stroke={P.blueLight} strokeWidth="2.2" />
    <path d="M38 41 Q58 29 78 41 L60.5 77 Q58 81 55.5 77 Z" fill={P.honey} />
    <path d="M38 41 Q58 29 78 41" fill="none" stroke={P.wood} strokeWidth="8" strokeLinecap="round" />
    <path
      d="M40 38.5 Q57 28.5 73 37"
      fill="none"
      stroke={P.woodLight}
      strokeWidth="2.6"
      strokeLinecap="round"
    />
    <g fill={P.red}>
      <circle cx="50" cy="50" r="4.6" />
      <circle cx="64" cy="51" r="4.6" />
      <circle cx="57" cy="64" r="4.4" />
    </g>
    <circle cx="57" cy="56" r="2.2" fill={P.sageDeep} />
    <circle cx="66" cy="60" r="2.2" fill={P.sageDeep} />
    <g className="pa-slide">
      <rect x="13.5" y="46" width="5" height="28" rx="2.5" fill={P.inkSoft} />
      <path
        d="M9.5 30 v12 q0 5 6.5 5 q6.5 0 6.5 -5 v-12"
        fill="none"
        stroke={P.inkSoft}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M16 30 v12" stroke={P.inkSoft} strokeWidth="3" strokeLinecap="round" />
    </g>
    <g className="pa-pop">
      <Heart x={85} y={18} s={0.7} />
    </g>
  </>
);

const toy: Art = () => (
  <>
    <Ground rx={30} />
    <circle cx="33" cy="22" r="8" fill={P.wood} />
    <circle cx="67" cy="22" r="8" fill={P.wood} />
    <circle cx="33" cy="22" r="4" fill={P.terraLight} />
    <circle cx="67" cy="22" r="4" fill={P.terraLight} />
    <ellipse cx="35" cy="81" rx="10" ry="7" fill={P.wood} />
    <ellipse cx="65" cy="81" rx="10" ry="7" fill={P.wood} />
    <circle cx="33" cy="81.5" r="3.8" fill={P.terraLight} />
    <circle cx="67" cy="81.5" r="3.8" fill={P.terraLight} />
    <ellipse cx="29" cy="65" rx="6.5" ry="11" fill={P.wood} transform="rotate(25 29 65)" />
    <g className="pa-wiggle">
      <ellipse cx="72" cy="55" rx="6.5" ry="11" fill={P.wood} transform="rotate(45 72 55)" />
    </g>
    <ellipse cx="50" cy="68" rx="19" ry="18" fill={P.wood} />
    <ellipse cx="50" cy="72" rx="11" ry="11" fill={P.woodLight} />
    <circle cx="50" cy="37" r="21" fill={P.wood} />
    <path
      d="M34 31 Q38 21 48 19"
      fill="none"
      stroke={P.woodLight}
      strokeWidth="3.5"
      strokeLinecap="round"
      opacity="0.7"
    />
    <ellipse cx="50" cy="42" rx="8" ry="6" fill={P.woodLight} />
    <Face x={50} y={36} />
    <ellipse cx="50" cy="39" rx="3.2" ry="2.4" fill={P.ink} />
    {/* the bow */}
    <path
      d="M50 58 L37 51 Q35 58 37 65 Z M50 58 L63 51 Q65 58 63 65 Z"
      fill={P.red}
      stroke={P.red}
      strokeWidth="2.4"
      strokeLinejoin="round"
    />
    <circle cx="50" cy="58" r="3.8" fill={P.redDeep} />
  </>
);

const stickers: Art = () => (
  <>
    <g transform="rotate(-4 50 50)">
      <rect x="13" y="12" width="74" height="76" rx="10" fill={P.lavLight} stroke={P.lav} strokeWidth="2.5" />
      <Heart x={33} y={34} s={1.35} />
      <g fill={P.rose}>
        <circle cx="67" cy="23.5" r="6" />
        <circle cx="75.1" cy="29.4" r="6" />
        <circle cx="72" cy="38.9" r="6" />
        <circle cx="62" cy="38.9" r="6" />
        <circle cx="58.9" cy="29.4" r="6" />
      </g>
      <circle cx="67" cy="32" r="5.5" fill={P.honey} />
      <circle cx="33" cy="67" r="13" fill={P.honey} />
      <Face x={33} y={66} s={0.8} />
      {/* the one that is peeling off */}
      <path d="M79 62 A13 13 0 0 1 62 79 Z" fill={P.white} opacity="0.75" />
      <path d="M79 62 A13 13 0 1 0 62 79 Z" fill={P.teal} />
      <path d="M60 77 A13 13 0 0 1 77 60 Z" fill={P.tealDeep} opacity="0.45" />
      <path d="M62 79 A13 13 0 0 1 79 62 Z" fill={P.tealLight} />
    </g>
    <g className="pa-twinkle">
      <Sparkle x={84} y={84} s={0.8} />
    </g>
  </>
);

const Wheel = ({ x, y }: { x: number; y: number }) => (
  <g className="pa-spin">
    <path
      d={`M${x - 14} ${y} H${x + 14} M${x} ${y - 14} V${y + 14}`}
      stroke={P.inkSoft}
      strokeWidth="2.2"
      strokeLinecap="round"
      opacity="0.45"
    />
    <circle cx={x} cy={y} r="15" fill="none" stroke={P.ink} strokeWidth="5.5" />
    <circle cx={x} cy={y} r="3.4" fill={P.inkSoft} />
  </g>
);

const bike: Art = () => (
  <>
    <Ground rx={41} cy={88} />
    <Wheel x={26} y={67} />
    <Wheel x={74} y={67} />
    {/* the little wheel that keeps it steady */}
    <path d="M26 67 L31 78" stroke={P.inkSoft} strokeWidth="2.6" strokeLinecap="round" />
    <circle cx="31" cy="78.5" r="4.6" fill={P.honey} stroke={P.ink} strokeWidth="2.4" />
    <path
      d="M26 67 L40 45 H63 L47 67 Z M40 45 L47 67"
      fill="none"
      stroke={P.red}
      strokeWidth="5.5"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    <path d="M74 67 L57.2 33.4" fill="none" stroke={P.red} strokeWidth="5.5" strokeLinecap="round" />
    <path d="M42.5 43.5 H61" stroke={P.terraLight} strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />
    <path d="M48 31.5 L60 33.5" stroke={P.ink} strokeWidth="5.5" strokeLinecap="round" />
    <path d="M40 45 L37.6 37.4" stroke={P.inkSoft} strokeWidth="4" strokeLinecap="round" />
    <rect x="28.5" y="31" width="17" height="6.5" rx="3.25" fill={P.ink} />
    <circle cx="47" cy="67" r="5" fill={P.honey} />
    <path d="M47 67 L53 75" stroke={P.inkSoft} strokeWidth="3" strokeLinecap="round" />
    <rect x="49" y="74" width="10" height="4" rx="2" fill={P.ink} />
  </>
);

const picnic: Art = () => (
  <>
    <ellipse cx="50" cy="74" rx="42" ry="15" fill={P.sageLight} />
    <path
      d="M24 58 H76 Q79 58 80.2 61 L90 84 Q91.5 88 87.5 88 H12.5 Q8.5 88 10 84 L19.8 61 Q21 58 24 58 Z"
      fill={P.red}
    />
    <g fill={P.white} opacity="0.5">
      <path d="M29.1 58 H37.2 L32.2 88 H20.8 Z" />
      <path d="M45.9 58 H54.1 L55.7 88 H44.3 Z" />
      <path d="M62.8 58 H70.9 L79.2 88 H67.8 Z" />
      <path d="M18.3 65 H81.7 L84 71 H16 Z" />
      <path d="M13.3 78 H86.7 L89 84 H11 Z" />
    </g>
    <path
      d="M30 42 Q30 15 50 15 Q70 15 70 42"
      fill="none"
      stroke={P.wood}
      strokeWidth="4.5"
      strokeLinecap="round"
    />
    <BasketBack x={50} y={42} w={48} />
    <rect x="53" y="22" width="9" height="30" rx="4.5" fill={P.woodLight} transform="rotate(16 57 40)" />
    <circle cx="40" cy="39" r="7" fill={P.honey} />
    <BasketFront x={50} y={42} w={48} h={26} />
    {/* a sandwich and an apple, out on the blanket */}
    <path d="M16 82 H42 L29 65 Z" fill={P.woodLight} stroke={P.wood} strokeWidth="3" strokeLinejoin="round" />
    <path d="M21 78 H37" stroke={P.sage} strokeWidth="3.2" strokeLinecap="round" />
    <g className="pa-wiggle">
      <circle cx="75" cy="73" r="9.5" fill={P.red} />
      <path
        d="M69 70 Q70 66 74 65.5"
        fill="none"
        stroke={P.terraLight}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path d="M75 64 q1 -4 4 -5" fill="none" stroke={P.woodDeep} strokeWidth="2.4" strokeLinecap="round" />
    </g>
  </>
);

const Pillow = ({
  x,
  y,
  fill,
  r = 0,
  s = 1,
}: {
  x: number;
  y: number;
  fill: string;
  r?: number;
  s?: number;
}) => (
  <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
    <path
      d="M1 5 Q-1 -1 5 0.5 Q14 2.5 23 0.5 Q29 -1 27 5 Q25.5 10 27 15 Q29 21 23 19.5 Q14 17.5 5 19.5 Q-1 21 1 15 Q2.5 10 1 5 Z"
      fill={fill}
    />
    <path
      d="M5.5 5.5 Q10 4 15 4.5"
      fill="none"
      stroke={P.white}
      strokeWidth="2.4"
      strokeLinecap="round"
      opacity="0.5"
    />
  </g>
);

const fort: Art = () => (
  <>
    <Ground rx={42} />
    {/* the way in, and the light inside */}
    <rect x="33" y="40" width="34" height="47" fill={P.honey} />
    <path d="M39 87 V63 Q39 53 50 53 Q61 53 61 63 V87 Z" fill={P.honeyLight} />
    <g className="pa-twinkle">
      <Sparkle x={50} y={71} fill={P.white} />
    </g>
    <Pillow x={8.5} y={67} fill={P.rose} />
    <Pillow x={63.5} y={67} fill={P.teal} />
    <Pillow x={10.5} y={48} fill={P.teal} />
    <Pillow x={61.5} y={48} fill={P.rose} />
    {/* the blanket over the top */}
    <path
      d="M8 50 Q8 27 24 25 Q50 38 76 25 Q92 27 92 50 Q92 55 88.5 53 Q80 47 72 52 Q66 56 62 50 Q50 43 38 50 Q34 56 28 52 Q20 47 11.5 53 Q8 55 8 50 Z"
      fill={P.lav}
    />
    <path
      d="M14.5 44 Q14.5 33 23 30"
      fill="none"
      stroke={P.lavLight}
      strokeWidth="3"
      strokeLinecap="round"
      opacity="0.8"
    />
    <g fill={P.lavLight}>
      <circle cx="33" cy="39" r="2.6" />
      <circle cx="50" cy="38" r="2.6" />
      <circle cx="67" cy="39" r="2.6" />
      <circle cx="82" cy="42" r="2.6" />
    </g>
  </>
);

const late: Art = () => (
  <>
    <rect x="6" y="10" width="88" height="78" rx="14" fill={P.lavLight} />
    <circle cx="75" cy="49" r="17" fill={P.honeyLight} />
    <rect x="11" y="17" width="50" height="52" rx="8" fill={P.cream} />
    <rect x="16" y="22" width="40" height="42" rx="4.5" fill={P.night} />
    <path d="M47 26 a7 7 0 1 0 6 10.5 a5.8 5.8 0 0 1 -6 -10.5 z" fill={P.honey} />
    <g fill={P.honeyLight}>
      <circle className="pa-twinkle" cx="25" cy="31" r="1.6" />
      <circle className="pa-twinkle pa-d2" cx="28" cy="54" r="1.6" />
      <circle className="pa-twinkle pa-d1" cx="47" cy="55" r="1.6" />
    </g>
    <path d="M36 22 V64 M16 43 H56" stroke={P.cream} strokeWidth="3.5" />
    <rect x="10" y="70" width="80" height="7" rx="3.5" fill={P.wood} />
    {/* the lamp, still on */}
    <rect x="73.25" y="56" width="3.5" height="12" fill={P.woodDeep} />
    <rect x="66" y="66" width="18" height="5" rx="2.5" fill={P.terra} />
    <path
      d="M68 38 H82 Q84 38 84.6 40 L89 56 Q89.5 58.5 87 58.5 H63 Q60.5 58.5 61 56 L65.4 40 Q66 38 68 38 Z"
      fill={P.honey}
    />
    <path d="M68 43 L65.5 53" stroke={P.white} strokeWidth="2.6" strokeLinecap="round" opacity="0.55" />
  </>
);

const bubbles: Art = () => (
  <>
    <path d="M26 71 L14 88" stroke={P.rose} strokeWidth="6" strokeLinecap="round" />
    <path d="M19 81 L14 88" stroke={P.roseDeep} strokeWidth="6" strokeLinecap="round" />
    <circle cx="33" cy="60" r="12.5" fill="none" stroke={P.rose} strokeWidth="5" />
    <path
      d="M24.5 52.5 Q27.5 49 32 48.2"
      fill="none"
      stroke={P.roseLight}
      strokeWidth="2.2"
      strokeLinecap="round"
    />
    {/* one just leaving the wand */}
    <Bubble x={41} y={51} r={11} className="pa-bob" />
    <Bubble x={65} y={32} r={13} className="pa-bob pa-d1" />
    <Bubble x={84} y={53} r={8} className="pa-bob pa-d2" />
    <Bubble x={64} y={66} r={5.5} className="pa-bob pa-d3" />
    <Bubble x={40} y={21} r={6} />
    <Bubble x={86} y={20} r={4.5} />
    <Bubble x={80} y={78} r={4} />
  </>
);

const icecream: Art = () => (
  <>
    <path d="M32 57 H68 L52.8 86 Q50 90.5 47.2 86 Z" fill={P.wood} />
    <path
      d="M38 59 L52 80 M49 59 L58.5 73 M62 59 L48 80 M51 59 L41.5 73"
      stroke={P.woodDeep}
      strokeWidth="2.4"
      strokeLinecap="round"
      opacity="0.5"
    />
    <g fill={P.rose}>
      <circle cx="50" cy="45" r="18" />
      <circle cx="35.5" cy="56" r="6" />
      <circle cx="45.5" cy="59.5" r="6" />
      <circle cx="55.5" cy="59.5" r="6" />
      <circle cx="64.5" cy="56" r="6" />
    </g>
    <path
      d="M36.5 46 Q37.5 38.5 44 35"
      fill="none"
      stroke={P.roseLight}
      strokeWidth="3.4"
      strokeLinecap="round"
    />
    <g className="pa-wiggle">
      <g fill={P.teal}>
        <circle cx="50" cy="25" r="14" />
        <circle cx="40" cy="34" r="5" />
        <circle cx="50" cy="37" r="5" />
        <circle cx="60" cy="34" r="5" />
      </g>
      <path
        d="M40.5 22 Q42.5 15.5 49 14"
        fill="none"
        stroke={P.tealLight}
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <rect
        x="52.5"
        y="19.5"
        width="6.5"
        height="2.8"
        rx="1.4"
        fill={P.honey}
        transform="rotate(30 55.75 20.9)"
      />
      <rect
        x="44.5"
        y="27"
        width="6.5"
        height="2.8"
        rx="1.4"
        fill={P.white}
        transform="rotate(-25 47.75 28.4)"
      />
      <rect
        x="55"
        y="28"
        width="6.5"
        height="2.8"
        rx="1.4"
        fill={P.rose}
        transform="rotate(-50 58.25 29.4)"
      />
    </g>
  </>
);

const craft: Art = () => (
  <>
    <Ground rx={40} />
    <circle cx="15" cy="42" r="8" fill={P.honey} />
    <path d="M34 20 L40 10 L46 20 Z" fill={P.sage} stroke={P.sage} strokeWidth="3" strokeLinejoin="round" />
    <Heart x={79} y={21} s={1.1} fill={P.rose} />
    {/* round-nosed scissors */}
    <path d="M40 52 L51.5 26.5" stroke={P.inkSoft} strokeWidth="8" strokeLinecap="round" />
    <path d="M40 52 L31 68" stroke={P.teal} strokeWidth="6" strokeLinecap="round" />
    <circle cx="27" cy="76" r="8.5" fill="none" stroke={P.teal} strokeWidth="5.5" />
    <g className="pa-wiggle">
      <path d="M40 52 L28.5 26.5" stroke={P.inkSoft} strokeWidth="8" strokeLinecap="round" />
      <path d="M40 52 L49 68" stroke={P.teal} strokeWidth="6" strokeLinecap="round" />
      <circle cx="53" cy="76" r="8.5" fill="none" stroke={P.teal} strokeWidth="5.5" />
    </g>
    <circle cx="40" cy="52" r="2.8" fill={P.cream} />
    {/* the glue stick */}
    <rect x="73.5" y="36" width="13" height="16" rx="4.5" fill={P.honeyLight} />
    <rect x="70" y="47" width="20" height="40" rx="5.5" fill={P.lav} />
    <rect x="70" y="47" width="20" height="8" rx="4" fill={P.lavDeep} />
    <rect x="73.5" y="62" width="13" height="13" rx="3.5" fill={P.lavLight} />
  </>
);

const TICKET =
  'M0 4.5 Q0 0 4.5 0 H45.5 Q50 0 50 4.5 V9 A4.5 4.5 0 0 0 50 18 V22.5 Q50 27 45.5 27 H4.5 Q0 27 0 22.5 V18 A4.5 4.5 0 0 0 0 9 Z';

const Ticket = ({ x, y, r, fill, deep }: { x: number; y: number; r: number; fill: string; deep: string }) => (
  <g transform={`translate(${x} ${y}) rotate(${r})`}>
    <path d={TICKET} fill={fill} />
    <path
      d="M14 4.5 V23"
      stroke={P.white}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeDasharray="0.1 4.6"
      opacity="0.85"
    />
    <rect x="21" y="7.5" width="21" height="4.5" rx="2.25" fill={deep} opacity="0.6" />
    <rect x="21" y="15.5" width="13" height="4.5" rx="2.25" fill={deep} opacity="0.6" />
  </g>
);

const outing: Art = () => (
  <>
    <Ground rx={36} cx={44} />
    <g className="pa-bob">
      <path
        d="M72 46 Q77 55 71 61 Q66 66 69 73"
        fill="none"
        stroke={P.inkSoft}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <ellipse cx="72" cy="28" rx="14.5" ry="17" fill={P.red} />
      <path
        d="M72 44 L68.5 49 H75.5 Z"
        fill={P.red}
        stroke={P.red}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M62.5 24 Q64 16 70 14"
        fill="none"
        stroke={P.terraLight}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </g>
    <Ticket x={11} y={47} r={-16} fill={P.honey} deep={P.honeyDeep} />
    <Ticket x={19} y={57} r={-4} fill={P.teal} deep={P.tealDeep} />
    <g className="pa-twinkle">
      <Sparkle x={26} y={24} s={0.9} />
    </g>
  </>
);

const Note = ({ x, y, fill }: { x: number; y: number; fill: string }) => (
  <g transform={`translate(${x} ${y})`}>
    <ellipse cx="0" cy="0" rx="5.4" ry="4.2" fill={fill} transform="rotate(-20)" />
    <path
      d="M4.4 -1 V-19 Q11.5 -17 11.5 -10"
      fill="none"
      stroke={fill}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </g>
);

const dance: Art = () => (
  <>
    <Ground rx={38} />
    {/* a ribbon, dancing */}
    <g className="pa-wiggle">
      <path
        d="M10 31 Q15 12 25 22 Q33 30 39 17 Q42 9 49 12"
        fill="none"
        stroke={P.rose}
        strokeWidth="4.2"
        strokeLinecap="round"
      />
    </g>
    <g className="pa-float">
      <Note x={56} y={30} fill={P.honeyDeep} />
    </g>
    <g className="pa-float pa-d2">
      <ellipse cx="71" cy="31" rx="5.4" ry="4.2" fill={P.lavDeep} transform="rotate(-20 71 31)" />
      <ellipse cx="85" cy="28" rx="5.4" ry="4.2" fill={P.lavDeep} transform="rotate(-20 85 28)" />
      <path
        d="M75.4 30 V13 L89.4 10 V27"
        fill="none"
        stroke={P.lavDeep}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M75.4 15 L89.4 12" stroke={P.lavDeep} strokeWidth="5" strokeLinecap="round" />
    </g>
    {/* the radio */}
    <path
      d="M30 50 V44 Q30 38 36 38 H64 Q70 38 70 44 V50"
      fill="none"
      stroke={P.tealDeep}
      strokeWidth="4.5"
      strokeLinecap="round"
    />
    <rect x="14" y="48" width="72" height="39" rx="10" fill={P.teal} />
    <rect x="21" y="52" width="26" height="3" rx="1.5" fill={P.tealLight} opacity="0.8" />
    <circle cx="33" cy="69" r="12" fill={P.tealDeep} />
    <circle cx="67" cy="69" r="12" fill={P.tealDeep} />
    <circle cx="33" cy="69" r="6.5" fill={P.ink} />
    <circle cx="67" cy="69" r="6.5" fill={P.ink} />
    <circle cx="33" cy="69" r="2.4" fill={P.tealLight} />
    <circle cx="67" cy="69" r="2.4" fill={P.tealLight} />
    <rect x="45" y="58" width="10" height="7" rx="2.5" fill={P.honeyLight} />
    <circle cx="50" cy="75" r="3" fill={P.honey} />
  </>
);

const camp: Art = () => (
  <>
    <Ground rx={42} />
    <path d="M44 17 L80 85 H9 Z" fill={P.sage} stroke={P.sage} strokeWidth="4" strokeLinejoin="round" />
    <path
      d="M44 17 L9 85 H24 Z"
      fill={P.sageDeep}
      stroke={P.sageDeep}
      strokeWidth="4"
      strokeLinejoin="round"
      opacity="0.3"
    />
    <path d="M44 36 L63 86 H25 Z" fill={P.sageDeep} />
    <path d="M44 36 L25 86 H32 Q37 62 44 36 Z M44 36 L63 86 H56 Q51 62 44 36 Z" fill={P.sageLight} />
    <Pillow x={32} y={70} fill={P.cream} s={0.9} />
    {/* the lantern */}
    <g className="pa-twinkle">
      <circle cx="80" cy="70" r="12.5" fill={P.honeyLight} />
    </g>
    <path
      d="M74 60 Q74 52 80 52 Q86 52 86 60"
      fill="none"
      stroke={P.inkSoft}
      strokeWidth="2.4"
      strokeLinecap="round"
    />
    <rect x="73.5" y="62" width="13" height="18" rx="4" fill={P.honey} />
    <rect x="72" y="59" width="16" height="6" rx="3" fill={P.red} />
    <rect x="72" y="79" width="16" height="7" rx="3" fill={P.red} />
    <path d="M77 67 V76" stroke={P.white} strokeWidth="2.4" strokeLinecap="round" opacity="0.6" />
  </>
);

export const REWARDS: Partial<Record<RewardPictureId, Art>> = {
  game,
  storypick,
  park,
  movie,
  baking,
  dinner,
  toy,
  stickers,
  bike,
  picnic,
  fort,
  late,
  bubbles,
  icecream,
  craft,
  outing,
  dance,
  camp,
};
