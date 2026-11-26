import type { DayPictureId } from '../../../shared/pictures';
import { P } from '../palette';
import { Drop, Face, Ground, Hand, Heart, type Art } from './kit';

/**
 * What kind of day it is. These sit small on the calendar, so each is one thing drawn big: the schoolhouse, the
 * cake, the suitcase. A child finds today, sees the picture, and knows what is coming.
 */

const school: Art = () => (
  <>
    <Ground rx={40} />
    <path
      d="M12 56 L50 32 L88 56 Z"
      fill={P.redDeep}
      stroke={P.redDeep}
      strokeWidth="4"
      strokeLinejoin="round"
    />
    <rect x="18" y="54" width="64" height="33" rx="5" fill={P.red} />
    {/* the bell on the roof */}
    <rect x="38" y="18" width="4.5" height="22" rx="2.25" fill={P.wood} />
    <rect x="57.5" y="18" width="4.5" height="22" rx="2.25" fill={P.wood} />
    <path
      d="M34 20 L50 9 L66 20 Z"
      fill={P.redDeep}
      stroke={P.redDeep}
      strokeWidth="3.5"
      strokeLinejoin="round"
    />
    <g className="pa-swing">
      <path
        d="M43.5 34 Q43.5 23 50 23 Q56.5 23 56.5 34 L58.5 37 H41.5 Z"
        fill={P.honey}
        stroke={P.honey}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="39.5" r="2.6" fill={P.honeyDeep} />
    </g>
    <path d="M42 87 V70 Q42 63 50 63 Q58 63 58 70 V87 Z" fill={P.honey} />
    <rect x="24" y="62" width="12" height="13" rx="3.5" fill={P.blueLight} />
    <rect x="64" y="62" width="12" height="13" rx="3.5" fill={P.blueLight} />
  </>
);

const Tyre = ({ x }: { x: number }) => (
  <>
    <circle cx={x} cy="78" r="9.5" fill={P.ink} />
    <circle cx={x} cy="78" r="3.8" fill={P.creamShade} />
  </>
);

const outing: Art = () => (
  <>
    <Ground rx={41} />
    <circle cx="23" cy="22" r="8.5" fill={P.honey} />
    <path
      d="M23 10.5 V8.5 M11.5 22 H9.5 M14.9 13.9 L13.4 12.4 M31.1 13.9 L32.6 12.4 M34.5 22 H36.5"
      stroke={P.honey}
      strokeWidth="3"
      strokeLinecap="round"
    />
    <g className="pa-bob">
      <rect x="9" y="34" width="82" height="44" rx="12" fill={P.teal} />
      <rect x="17" y="36.4" width="34" height="2.6" rx="1.3" fill={P.tealLight} opacity="0.8" />
      <rect x="9" y="60" width="82" height="6" fill={P.tealDeep} opacity="0.55" />
      <rect x="16" y="41" width="15" height="15" rx="4" fill={P.blueLight} />
      <rect x="35" y="41" width="15" height="15" rx="4" fill={P.blueLight} />
      <rect x="54" y="41" width="15" height="15" rx="4" fill={P.blueLight} />
      <rect x="72.5" y="41" width="13" height="15" rx="4" fill={P.blueLight} />
      <circle cx="86" cy="70.5" r="2.8" fill={P.honeyLight} />
    </g>
    <Tyre x={29} />
    <Tyre x={71} />
  </>
);

const visitor: Art = () => (
  <>
    <Ground rx={36} />
    <path d="M27 88 V22 Q27 17 32 17 H68 Q73 17 73 22 V88 Z" fill={P.honeyLight} />
    <path d="M27 17 L48 23.5 Q50 24.2 50 26.5 V80 Q50 82 48 82.5 L27 88 Z" fill={P.terra} />
    <path d="M50 27 V80" stroke={P.terraDeep} strokeWidth="2.6" strokeLinecap="round" />
    <circle cx="44" cy="55" r="3" fill={P.honey} />
    {/* somebody saying hello */}
    <g className="pa-wiggle">
      <g transform="translate(62 50) rotate(-35) scale(1.25)">
        <Hand x={0} y={0} />
      </g>
    </g>
    <path
      d="M23.5 88 V20 Q23.5 13.5 30 13.5 H70 Q76.5 13.5 76.5 20 V88"
      fill="none"
      stroke={P.woodDeep}
      strokeWidth="7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </>
);

const birthday: Art = () => (
  <>
    <Ground rx={40} />
    <ellipse cx="50" cy="83" rx="41" ry="5.5" fill={P.blueLight} />
    <rect x="15" y="46" width="70" height="38" rx="8" fill={P.woodLight} />
    <rect x="15" y="66" width="70" height="5" fill={P.red} opacity="0.7" />
    <path
      d="M15 54 Q15 44 25 44 H75 Q85 44 85 54 V57 Q80 64 75 57 Q70 51 65 57 Q60 64 55 57 Q50 51 45 57 Q40 64 35 57 Q30 51 25 57 Q20 64 15 57 Z"
      fill={P.rose}
    />
    <path d="M22 50 Q30 47.5 40 48" fill="none" stroke={P.roseLight} strokeWidth="3" strokeLinecap="round" />
    <rect x="29.5" y="28" width="5" height="18" rx="2.5" fill={P.blue} />
    <rect x="47.5" y="26" width="5" height="20" rx="2.5" fill={P.lav} />
    <rect x="65.5" y="28" width="5" height="18" rx="2.5" fill={P.sage} />
    <g className="pa-twinkle">
      <Drop x={32} y={22} s={0.65} fill={P.honey} />
      <Drop x={50} y={20} s={0.65} fill={P.honey} />
      <Drop x={68} y={22} s={0.65} fill={P.honey} />
    </g>
  </>
);

const sports: Art = () => (
  <>
    <Ground rx={38} cx={54} />
    {/* a swimming ring */}
    <g transform="rotate(-22.5 40 42)">
      <circle cx="40" cy="42" r="24" fill="none" stroke={P.red} strokeWidth="16" />
      <circle
        cx="40"
        cy="42"
        r="24"
        fill="none"
        stroke={P.white}
        strokeWidth="11.5"
        strokeDasharray="18.85 18.85"
      />
    </g>
    {/* and a ball */}
    <g className="pa-bob">
      <circle cx="66" cy="65" r="21" fill={P.white} stroke={P.blueLight} strokeWidth="2.5" />
      <g fill={P.ink} transform="translate(66 65)">
        <path d="M0 -7.5 L7.1 -2.3 L4.4 6.1 H-4.4 L-7.1 -2.3 Z" />
        {[0, 72, 144, 216, 288].map((turn) => (
          <path key={turn} d="M-6 -18.5 A19.5 19.5 0 0 1 6 -18.5 L0 -12.5 Z" transform={`rotate(${turn})`} />
        ))}
      </g>
    </g>
  </>
);

const lesson: Art = () => (
  <>
    <Ground rx={36} />
    <path
      d="M36 62 L24 88 M64 62 L76 88 M50 62 V86"
      stroke={P.woodDeep}
      strokeWidth="5"
      strokeLinecap="round"
    />
    <rect x="15" y="12" width="70" height="52" rx="7" fill={P.wood} />
    <rect x="20" y="17" width="60" height="42" rx="4" fill={P.paper} />
    <rect x="11" y="62" width="78" height="6.5" rx="3.25" fill={P.woodDeep} />
    <g className="pa-bob">
      <ellipse cx="38" cy="48" rx="6.5" ry="5" fill={P.lavDeep} transform="rotate(-20 38 48)" />
      <ellipse cx="59" cy="44" rx="6.5" ry="5" fill={P.lavDeep} transform="rotate(-20 59 44)" />
      <path
        d="M43.2 47 V27 L64.2 23 V43"
        fill="none"
        stroke={P.lavDeep}
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M43.2 30 L64.2 26" stroke={P.lavDeep} strokeWidth="6" strokeLinecap="round" />
    </g>
    {/* a paintbrush, waiting in the tray */}
    <g transform="translate(85 87) rotate(-18)">
      <rect x="-2.5" y="-27" width="5" height="27" rx="2.5" fill={P.blue} />
      <rect x="-3.2" y="-34" width="6.4" height="8.5" rx="2" fill={P.inkSoft} />
      <path d="M-3.2 -33 Q-3.2 -40 0 -45 Q3.2 -40 3.2 -33 Z" fill={P.red} />
    </g>
  </>
);

const playdate: Art = () => (
  <>
    <Ground rx={42} />
    {/* a bear */}
    <circle cx="19" cy="31" r="6.5" fill={P.wood} />
    <circle cx="43" cy="31" r="6.5" fill={P.wood} />
    <ellipse cx="23" cy="85" rx="6.5" ry="4.5" fill={P.wood} />
    <ellipse cx="39" cy="85" rx="6.5" ry="4.5" fill={P.wood} />
    <ellipse cx="44" cy="68" rx="8" ry="4.5" fill={P.wood} transform="rotate(-10 44 68)" />
    <ellipse cx="31" cy="73" rx="15" ry="14" fill={P.wood} />
    <ellipse cx="31" cy="76" rx="8.5" ry="8.5" fill={P.woodLight} />
    <circle cx="31" cy="45" r="17" fill={P.wood} />
    <ellipse cx="31" cy="50" rx="7" ry="5" fill={P.woodLight} />
    <Face x={31} y={45} s={0.85} />
    {/* and a bunny */}
    <ellipse cx="62" cy="24" rx="5.5" ry="14" fill={P.lav} transform="rotate(-8 62 24)" />
    <ellipse cx="76" cy="24" rx="5.5" ry="14" fill={P.lav} transform="rotate(8 76 24)" />
    <ellipse cx="62" cy="25" rx="2.4" ry="9" fill={P.lavLight} transform="rotate(-8 62 24)" />
    <ellipse cx="76" cy="25" rx="2.4" ry="9" fill={P.lavLight} transform="rotate(8 76 24)" />
    <ellipse cx="61" cy="85" rx="6.5" ry="4.5" fill={P.lav} />
    <ellipse cx="77" cy="85" rx="6.5" ry="4.5" fill={P.lav} />
    <ellipse cx="56" cy="68" rx="8" ry="4.5" fill={P.lav} transform="rotate(10 56 68)" />
    <ellipse cx="69" cy="74" rx="14" ry="13" fill={P.lav} />
    <ellipse cx="69" cy="77" rx="8" ry="8" fill={P.lavLight} />
    <circle cx="69" cy="48" r="16" fill={P.lav} />
    <Face x={69} y={48} s={0.85} />
    <g className="pa-pop">
      <Heart x={48} y={18} s={0.6} />
    </g>
  </>
);

const trip: Art = () => (
  <>
    <Ground rx={38} />
    <path
      d="M38 34 V26 Q38 20 44 20 H56 Q62 20 62 26 V34"
      fill="none"
      stroke={P.inkSoft}
      strokeWidth="5"
      strokeLinecap="round"
    />
    <rect x="22" y="82" width="11" height="6" rx="3" fill={P.inkSoft} />
    <rect x="67" y="82" width="11" height="6" rx="3" fill={P.inkSoft} />
    <rect x="13" y="32" width="74" height="52" rx="11" fill={P.terra} />
    <rect x="26" y="32" width="8" height="52" fill={P.terraDeep} opacity="0.7" />
    <rect x="66" y="32" width="8" height="52" fill={P.terraDeep} opacity="0.7" />
    <rect x="38" y="36.5" width="11" height="3" rx="1.5" fill={P.terraLight} opacity="0.8" />
    <rect x="39" y="76" width="22" height="3.5" rx="1.75" fill={P.terraDeep} opacity="0.5" />
    {/* the tag with our name on */}
    <g className="pa-swing">
      <path d="M60 33 L57 46" stroke={P.cream} strokeWidth="2.2" strokeLinecap="round" />
      <rect x="49" y="42" width="15" height="21" rx="4.5" fill={P.honey} transform="rotate(8 56.5 52)" />
      <circle cx="57" cy="47.5" r="2.4" fill={P.cream} />
    </g>
    <g className="pa-bob">
      <g transform="translate(79 16) rotate(-14)" fill={P.blue}>
        <path d="M-11 0 Q-11 -3.5 -7 -3.5 H7 Q12 -3.5 12 0 Q12 3.5 7 3.5 H-7 Q-11 3.5 -11 0 Z" />
        <path
          d="M-1 0 L-6 9 H-1.5 L5 0 Z M-10 -2 L-12.5 -8.5 H-8.5 L-5 -2 Z"
          stroke={P.blue}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </g>
    </g>
  </>
);

const Pennant = ({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) => (
  <path
    d="M-6 0 H6 L0 13 Z"
    transform={`translate(${x} ${y}) rotate(${r})`}
    fill={fill}
    stroke={fill}
    strokeWidth="2.4"
    strokeLinejoin="round"
  />
);

const holiday: Art = () => (
  <>
    <Ground rx={34} />
    <path d="M10 12 Q50 20 90 12" fill="none" stroke={P.inkSoft} strokeWidth="2.4" strokeLinecap="round" />
    <Pennant x={18} y={14.2} r={9} fill={P.red} />
    <Pennant x={34} y={16.2} r={4.5} fill={P.honey} />
    <Pennant x={50} y={16.8} r={0} fill={P.sage} />
    <Pennant x={66} y={16.2} r={-4.5} fill={P.blue} />
    <Pennant x={82} y={14.2} r={-9} fill={P.rose} />
    {/* a present */}
    <rect x="22" y="58" width="56" height="30" rx="6" fill={P.lav} />
    <rect x="22" y="58" width="56" height="7" fill={P.lavDeep} opacity="0.45" />
    <rect x="17" y="48" width="66" height="13" rx="5" fill={P.lav} />
    <rect x="44.5" y="48" width="11" height="40" fill={P.honey} />
    <g className="pa-wiggle">
      <path
        d="M50 48 Q41 33 33 38.5 Q28 45 50 48 Z M50 48 Q59 33 67 38.5 Q72 45 50 48 Z"
        fill={P.honey}
        stroke={P.honey}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="47" r="4.5" fill={P.honeyDeep} />
    </g>
  </>
);

const appointment: Art = () => (
  <>
    <circle cx="44" cy="44" r="32" fill={P.blue} />
    <path
      d="M17.2 34.3 Q21.85 21.85 34.3 17.2"
      fill="none"
      stroke={P.blueLight}
      strokeWidth="2.6"
      strokeLinecap="round"
      opacity="0.7"
    />
    <circle cx="44" cy="44" r="25" fill={P.white} />
    <g fill={P.blueDeep}>
      <circle cx="44" cy="24.5" r="2.2" />
      <circle cx="63.5" cy="44" r="2.2" />
      <circle cx="44" cy="63.5" r="2.2" />
      <circle cx="24.5" cy="44" r="2.2" />
    </g>
    <path d="M44 44 L35 37" stroke={P.ink} strokeWidth="4.5" strokeLinecap="round" />
    {/* the long hand, ticking; the empty ring keeps it turning about the middle */}
    <g className="pa-wiggle">
      <circle cx="44" cy="44" r="18" fill="none" />
      <path d="M44 44 L55 30" stroke={P.ink} strokeWidth="3.6" strokeLinecap="round" />
    </g>
    <circle cx="44" cy="44" r="3.4" fill={P.red} />
    {/* it is written down */}
    <g transform="rotate(8 75 70)">
      <rect x="61" y="52" width="28" height="37" rx="5" fill={P.wood} />
      <rect x="65" y="58" width="20" height="27" rx="3" fill={P.paper} />
      <rect x="69" y="49" width="12" height="7.5" rx="3" fill={P.inkSoft} />
      <path
        d="M69.5 72 l4.5 5 l7.5 -10"
        fill="none"
        stroke={P.sageDeep}
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  </>
);

const Tome = ({ x, y, w, fill }: { x: number; y: number; w: number; fill: string }) => (
  <>
    <rect x={x} y={y} width={w} height="17" rx="5" fill={fill} />
    <rect x={x + 8} y={y + 3.5} width={w - 9.5} height="10" rx="2.5" fill={P.cream} />
    <path
      d={`M${x + 13} ${y + 8.5} H${x + w - 5}`}
      stroke={P.creamShade}
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  </>
);

const library: Art = () => (
  <>
    <Ground rx={40} />
    <Tome x={14} y={70} w={72} fill={P.blue} />
    <Tome x={21} y={53} w={60} fill={P.red} />
    <Tome x={16} y={36} w={62} fill={P.sage} />
    <path d="M30 36 v-9 l3.5 3 l3.5 -3 v9 z" fill={P.honey} />
    {/* the library card */}
    <g transform="rotate(10 68.5 24.5)">
      <rect
        x="52"
        y="13"
        width="33"
        height="23"
        rx="4.5"
        fill={P.white}
        stroke={P.blueLight}
        strokeWidth="2.5"
      />
      <rect x="52" y="13" width="33" height="7.5" rx="3.75" fill={P.teal} />
      <circle cx="60.5" cy="27.5" r="4" fill={P.honey} />
      <path d="M68 25.5 H80 M68 30.5 H76" stroke={P.creamShade} strokeWidth="2.4" strokeLinecap="round" />
    </g>
  </>
);

const homeday: Art = () => (
  <>
    <Ground rx={40} />
    <rect x="62" y="18" width="11" height="22" rx="3" fill={P.terraDeep} />
    <g className="pa-float">
      <circle cx="68" cy="11" r="4" fill={P.creamShade} />
    </g>
    <rect x="17" y="46" width="66" height="41" rx="6" fill={P.honey} />
    <rect x="17" y="46" width="66" height="10.5" fill={P.honeyDeep} opacity="0.35" />
    <path d="M11 50 L50 17 L89 50 Z" fill={P.red} stroke={P.red} strokeWidth="5" strokeLinejoin="round" />
    <rect x="24" y="58" width="26" height="22" rx="5" fill={P.white} />
    <Heart x={37} y={69.5} s={0.95} />
    <path d="M58 87 V67 Q58 60 66 60 Q74 60 74 67 V87 Z" fill={P.woodDeep} />
    <circle cx="70" cy="75" r="1.8" fill={P.honeyLight} />
  </>
);

export const DAYS: Partial<Record<DayPictureId, Art>> = {
  school,
  outing,
  visitor,
  birthday,
  sports,
  lesson,
  playdate,
  trip,
  holiday,
  appointment,
  library,
  homeday,
};
