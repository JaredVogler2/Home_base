import type { ReactNode } from 'react';
import { P } from './palette';

/**
 * Four drawings that stand in for a family's photographs in the demo, where there is no family. They are
 * plainly drawings and are labelled as samples: nobody's picture is used, and nothing is fetched. Each is a day
 * a family might have had — a picnic, the beach, the snow, a birthday — with nobody in it.
 */
export const SAMPLE_COUNT = 4;

const Cloud = ({ x, y, s = 1, fill = P.white }: { x: number; y: number; s?: number; fill?: string }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} fill={fill}>
    <ellipse cx="0" cy="0" rx="90" ry="34" />
    <ellipse cx="-46" cy="-22" rx="52" ry="36" />
    <ellipse cx="26" cy="-34" rx="62" ry="44" />
    <ellipse cx="84" cy="-10" rx="44" ry="28" />
  </g>
);

const Sun = ({ x, y, r = 96 }: { x: number; y: number; r?: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <circle r={r * 1.7} fill={P.honeyLight} opacity="0.45" />
    <circle r={r} fill={P.honey} />
  </g>
);

const Flower = ({ x, y, fill }: { x: number; y: number; fill: string }) => (
  <g transform={`translate(${x} ${y})`}>
    <path d="M0 0 v34" stroke={P.sageDeep} strokeWidth="6" strokeLinecap="round" />
    <g fill={fill}>
      <circle cx="0" cy="-12" r="9" />
      <circle cx="11" cy="-3" r="9" />
      <circle cx="7" cy="10" r="9" />
      <circle cx="-7" cy="10" r="9" />
      <circle cx="-11" cy="-3" r="9" />
    </g>
    <circle r="7" fill={P.honey} />
  </g>
);

function Picnic() {
  return (
    <>
      <rect width="1600" height="900" fill="#bfe6fb" />
      <rect y="380" width="1600" height="220" fill="#dff3fd" />
      <Sun x={1010} y={170} />
      <Cloud x={420} y={210} />
      <Cloud x={700} y={120} s={0.6} />
      <path d="M0 560 Q360 400 760 520 T1600 470 V900 H0 Z" fill="#b9e3a6" />
      {/* a tree on the far hill */}
      <g transform="translate(196 44)">
        <rect x="1206" y="330" width="34" height="170" rx="12" fill={P.woodDeep} />
        <circle cx="1222" cy="300" r="104" fill={P.sageDeep} />
        <circle cx="1150" cy="350" r="70" fill={P.sageDeep} />
        <circle cx="1296" cy="352" r="74" fill={P.sageDeep} />
        <circle cx="1190" cy="270" r="50" fill={P.sage} opacity="0.5" />
      </g>
      <path d="M0 660 Q420 540 860 640 T1600 610 V900 H0 Z" fill={P.sage} />
      <path d="M0 800 Q520 720 1020 800 T1600 780 V900 H0 Z" fill={P.sageDeep} opacity="0.5" />
      {/* a kite, and its string down to the hill */}
      <path
        d="M330 150 C420 330 520 470 700 640"
        fill="none"
        stroke={P.white}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <g transform="translate(300 96) rotate(-18)">
        <path d="M0 -84 L62 0 L0 110 L-62 0 Z" fill={P.red} />
        <path d="M0 -84 L62 0 L0 0 Z" fill={P.honey} />
        <path d="M0 0 L0 110 L-62 0 Z" fill={P.terra} />
        <path d="M0 -84 V110 M-62 0 H62" stroke={P.cream} strokeWidth="5" />
      </g>
      <g fill={P.lav}>
        <path d="M352 232 l22 -16 l4 26 z" />
        <path d="M408 322 l24 -12 l0 26 z" />
        <path d="M476 424 l24 -10 l-2 26 z" />
      </g>
      {/* the blanket, laid on the slope */}
      <path d="M560 648 L1040 600 L1150 738 L640 800 Z" fill={P.red} />
      <g fill={P.cream} opacity="0.9">
        <path d="M656 638 L752 629 L845 775 L743 788 Z" />
        <path d="M848 619 L944 610 L1050 750 L948 763 Z" />
      </g>
      <g fill={P.cream} opacity="0.5">
        <path d="M586 682 L1067 634 L1094 668 L604 718 Z" />
        <path d="M622 754 L1121 702 L1150 738 L640 800 Z" />
      </g>
      {/* the basket */}
      <path
        d="M736 628 Q800 500 864 628"
        fill="none"
        stroke={P.woodDeep}
        strokeWidth="16"
        strokeLinecap="round"
      />
      <path d="M716 624 H884 L866 724 Q864 738 850 738 H750 Q736 738 734 724 Z" fill={P.wood} />
      <rect x="706" y="610" width="188" height="30" rx="15" fill={P.woodLight} />
      <g stroke={P.woodDeep} strokeWidth="6" strokeLinecap="round" opacity="0.5">
        <path d="M740 664 H860" />
        <path d="M746 698 H854" />
      </g>
      <path d="M760 612 q30 -44 70 0 z" fill={P.cream} />
      {/* apples, a bottle, a plate */}
      <circle cx="952" cy="690" r="34" fill={P.red} />
      <circle cx="1008" cy="704" r="30" fill={P.redDeep} />
      <path
        d="M952 660 q6 -22 22 -24"
        fill="none"
        stroke={P.woodDeep}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path d="M966 646 q20 -12 30 4 q-18 10 -30 -4 z" fill={P.sageDeep} />
      <ellipse cx="640" cy="722" rx="58" ry="20" fill={P.white} />
      <path d="M604 716 l40 -44 l34 44 z" fill={P.honeyLight} />
      <path d="M604 716 h74" stroke={P.honeyDeep} strokeWidth="6" strokeLinecap="round" />
      <rect x="1058" y="636" width="40" height="82" rx="14" fill={P.teal} />
      <rect x="1068" y="616" width="20" height="28" rx="6" fill={P.tealDeep} />
      <Flower x={300} y={720} fill={P.white} />
      <Flower x={410} y={780} fill={P.rose} />
      <Flower x={1330} y={760} fill={P.white} />
      <Flower x={1440} y={690} fill={P.lav} />
      <Flower x={170} y={800} fill={P.honeyLight} />
    </>
  );
}

function Beach() {
  return (
    <>
      <rect width="1600" height="900" fill="#c9ecfb" />
      <Sun x={300} y={190} />
      <Cloud x={1180} y={170} />
      <Cloud x={760} y={110} s={0.6} />
      {/* the sea, and a boat far out */}
      <rect y="430" width="1600" height="250" fill={P.teal} />
      <rect y="430" width="1600" height="60" fill={P.tealDeep} opacity="0.45" />
      <g transform="translate(1090 400)">
        <path d="M0 30 h150 l-24 34 h-102 z" fill={P.red} />
        <path d="M70 26 V-78 L138 14 Z" fill={P.white} />
        <path d="M60 26 V-56 L8 18 Z" fill={P.honeyLight} />
      </g>
      <g fill="none" stroke={P.white} strokeWidth="10" strokeLinecap="round" opacity="0.7">
        <path d="M120 540 q50 -24 100 0 t100 0" />
        <path d="M640 590 q50 -24 100 0 t100 0" />
        <path d="M1240 560 q50 -24 100 0 t100 0" />
      </g>
      <path d="M0 660 Q400 620 800 652 T1600 640 V900 H0 Z" fill="#f8e3ad" />
      <path
        d="M0 660 Q400 620 800 652 T1600 640"
        fill="none"
        stroke={P.white}
        strokeWidth="16"
        opacity="0.8"
      />
      <path d="M0 810 Q500 760 1000 812 T1600 790 V900 H0 Z" fill="#efd28d" opacity="0.7" />
      {/* the sandcastle */}
      <g fill="#e9c680">
        <rect x="640" y="560" width="320" height="170" rx="10" />
        <rect x="610" y="500" width="96" height="230" rx="10" />
        <rect x="894" y="500" width="96" height="230" rx="10" />
        <rect x="748" y="450" width="104" height="140" rx="10" />
      </g>
      <g fill="#f8e3ad">
        <rect x="604" y="486" width="26" height="34" rx="5" />
        <rect x="645" y="486" width="26" height="34" rx="5" />
        <rect x="686" y="486" width="26" height="34" rx="5" />
        <rect x="888" y="486" width="26" height="34" rx="5" />
        <rect x="929" y="486" width="26" height="34" rx="5" />
        <rect x="970" y="486" width="26" height="34" rx="5" />
        <rect x="742" y="436" width="26" height="34" rx="5" />
        <rect x="787" y="436" width="26" height="34" rx="5" />
        <rect x="832" y="436" width="26" height="34" rx="5" />
      </g>
      <path d="M760 730 v-70 a40 40 0 0 1 80 0 v70 z" fill={P.woodDeep} opacity="0.75" />
      <rect x="642" y="560" width="30" height="46" rx="15" fill={P.woodDeep} opacity="0.55" />
      <rect x="928" y="560" width="30" height="46" rx="15" fill={P.woodDeep} opacity="0.55" />
      <path d="M800 440 V330" stroke={P.woodDeep} strokeWidth="10" strokeLinecap="round" />
      <path d="M804 334 l92 30 l-92 34 z" fill={P.red} />
      {/* bucket and spade */}
      <path d="M318 640 h170 l-24 150 q-2 14 -16 14 h-90 q-14 0 -16 -14 z" fill={P.red} />
      <rect x="306" y="626" width="194" height="32" rx="16" fill={P.redDeep} />
      <path
        d="M324 632 Q403 520 482 632"
        fill="none"
        stroke={P.honeyDeep}
        strokeWidth="12"
        strokeLinecap="round"
      />
      <path d="M346 690 l8 70" stroke={P.terraLight} strokeWidth="14" strokeLinecap="round" opacity="0.7" />
      <g transform="translate(540 770) rotate(-58)">
        <rect x="-8" y="-150" width="16" height="130" rx="8" fill={P.woodDeep} />
        <rect x="-30" y="-176" width="60" height="26" rx="13" fill={P.woodDeep} />
        <path d="M-36 -30 h72 v50 q0 46 -36 46 q-36 0 -36 -46 z" fill={P.blue} />
      </g>
      {/* the ball, a starfish, shells */}
      <g transform="translate(1210 738)">
        <circle r="96" fill={P.white} />
        <path d="M0 -96 A96 96 0 0 1 83 -48 L0 0 Z" fill={P.red} />
        <path d="M83 48 A96 96 0 0 1 0 96 L0 0 Z" fill={P.honey} />
        <path d="M-83 48 A96 96 0 0 1 -83 -48 L0 0 Z" fill={P.blue} />
        <circle r="18" fill={P.white} />
        <circle r="96" fill="none" stroke={P.creamShade} strokeWidth="6" />
      </g>
      <path
        d="M1440 800 l14 -42 l14 42 l44 2 l-34 27 l12 43 l-36 -25 l-36 25 l12 -43 l-34 -27 z"
        fill={P.terra}
      />
      <g fill={P.roseLight} stroke={P.rose} strokeWidth="5">
        <path d="M150 800 q30 -50 60 0 q-30 16 -60 0 z" />
        <path d="M980 826 q24 -40 48 0 q-24 13 -48 0 z" />
      </g>
    </>
  );
}

const Pine = ({ x, y, s = 1 }: { x: number; y: number; s?: number }): ReactNode => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x="-14" y="150" width="28" height="56" rx="8" fill={P.woodDeep} />
    <path d="M0 -40 L96 170 H-96 Z" fill={P.sageDeep} />
    <path d="M0 -130 L74 60 H-74 Z" fill={P.sageDeep} />
    <path d="M0 -130 L38 -32 Q18 -20 0 -34 Q-18 -20 -38 -32 Z" fill={P.white} />
    <path d="M-58 20 Q-30 44 0 26 Q30 44 58 20 L74 60 H-74 Z" fill={P.white} opacity="0.9" />
  </g>
);

function Snow() {
  const flakes: [number, number, number][] = [
    [140, 120, 11],
    [330, 250, 8],
    [520, 90, 10],
    [690, 300, 8],
    [860, 150, 11],
    [1010, 60, 8],
    [1190, 230, 10],
    [1370, 110, 11],
    [1500, 300, 8],
    [240, 420, 9],
    [760, 470, 8],
    [1440, 470, 9],
    [70, 300, 8],
    [1280, 380, 8],
  ];
  return (
    <>
      <rect width="1600" height="900" fill="#d5e5f6" />
      <rect y="380" width="1600" height="240" fill="#e8f1fb" />
      <g fill={P.white}>
        {flakes.map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
        ))}
      </g>
      <path d="M0 600 Q380 460 800 570 T1600 520 V900 H0 Z" fill="#f2f7fd" />
      <Pine x={230} y={390} s={1.15} />
      <Pine x={420} y={450} s={0.8} />
      <Pine x={1400} y={400} s={1.1} />
      <path d="M0 700 Q440 600 900 690 T1600 660 V900 H0 Z" fill={P.white} />
      <path d="M0 830 Q520 770 1040 836 T1600 810 V900 H0 Z" fill="#e3edf8" />
      {/* the snowman */}
      <ellipse cx="800" cy="806" rx="190" ry="26" fill="#c7d7ea" opacity="0.7" />
      <circle cx="800" cy="690" r="128" fill={P.white} stroke="#c7d7ea" strokeWidth="8" />
      <circle cx="800" cy="500" r="92" fill={P.white} stroke="#c7d7ea" strokeWidth="8" />
      <g stroke={P.woodDeep} strokeWidth="12" strokeLinecap="round" fill="none">
        <path d="M690 650 L570 580 m36 21 l-8 -46 m-12 34 l-44 8" />
        <path d="M910 650 L1030 580 m-36 21 l8 -46 m12 34 l44 8" />
      </g>
      <path d="M716 556 Q800 604 884 556 L890 592 Q800 640 710 592 Z" fill={P.red} />
      <path d="M842 590 l40 96 l-46 12 l-22 -98 z" fill={P.red} />
      <path d="M842 662 l34 -8 M836 640 l34 -8" stroke={P.redDeep} strokeWidth="8" strokeLinecap="round" />
      <circle cx="768" cy="482" r="11" fill={P.ink} />
      <circle cx="832" cy="482" r="11" fill={P.ink} />
      <path d="M800 504 l78 20 l-78 16 z" fill={P.terra} />
      <path d="M764 536 q36 26 72 0" fill="none" stroke={P.ink} strokeWidth="8" strokeLinecap="round" />
      <g fill={P.ink}>
        <circle cx="800" cy="640" r="10" />
        <circle cx="800" cy="690" r="10" />
        <circle cx="800" cy="740" r="10" />
      </g>
      <rect x="716" y="408" width="168" height="24" rx="12" fill={P.night} />
      <rect x="746" y="318" width="108" height="102" rx="14" fill={P.night} />
      <rect x="746" y="386" width="108" height="20" fill={P.honey} />
      {/* the sledge */}
      <g transform="translate(1130 760)">
        <path
          d="M-10 60 H250 q40 0 40 -40"
          fill="none"
          stroke={P.woodDeep}
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path d="M30 60 V10 M210 60 V10" stroke={P.woodDeep} strokeWidth="12" strokeLinecap="round" />
        <rect x="0" y="-16" width="250" height="34" rx="14" fill={P.red} />
        <path
          d="M250 0 q60 -10 70 -60"
          fill="none"
          stroke={P.honeyDeep}
          strokeWidth="8"
          strokeLinecap="round"
        />
      </g>
      {/* a pair of mittens left in the snow */}
      <g transform="translate(420 790) rotate(-14)">
        <rect x="0" y="0" width="64" height="84" rx="28" fill={P.teal} />
        <rect x="-22" y="26" width="40" height="34" rx="17" fill={P.teal} />
        <rect x="2" y="64" width="60" height="26" rx="10" fill={P.tealDeep} />
      </g>
    </>
  );
}

function Birthday() {
  const flags = [150, 330, 510, 690, 870, 1050, 1230, 1410];
  const dots: [number, number, string][] = [
    [240, 420, P.honey],
    [420, 330, P.teal],
    [560, 470, P.lav],
    [1040, 360, P.honey],
    [1180, 470, P.rose],
    [1470, 380, P.teal],
    [110, 560, P.rose],
    [1360, 560, P.lav],
    [690, 330, P.rose],
    [930, 440, P.teal],
  ];
  return (
    <>
      <rect width="1600" height="900" fill={P.roseLight} />
      <path d="M60 120 Q430 250 800 130 T1540 120" fill="none" stroke={P.woodDeep} strokeWidth="8" />
      {flags.map((x, index) => {
        const y = 150 + Math.sin(((x - 60) / 1480) * Math.PI * 2) * 34 + (index % 2) * 6;
        return (
          <path
            key={x}
            d={`M${x - 50} ${y} h100 l-50 96 z`}
            fill={[P.red, P.honey, P.teal, P.lav][index % 4]}
          />
        );
      })}
      <g>
        {dots.map(([x, y, fill], index) => (
          <rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width="26"
            height="14"
            rx="7"
            fill={fill}
            transform={`rotate(${index * 37} ${x + 13} ${y + 7})`}
          />
        ))}
      </g>
      {/* balloons */}
      <g fill="none" stroke={P.inkSoft} strokeWidth="5" strokeLinecap="round">
        <path d="M1248 520 q-30 120 22 280" />
        <path d="M1380 470 q10 150 -100 330" />
        <path d="M1312 400 q-20 200 -40 400" />
      </g>
      <path d="M1238 800 h64 l-10 -40 h-44 z" fill={P.honeyDeep} />
      <ellipse cx="1248" cy="420" rx="82" ry="100" fill={P.blue} />
      <ellipse cx="1384" cy="370" rx="82" ry="100" fill={P.honey} />
      <ellipse cx="1312" cy="296" rx="86" ry="104" fill={P.red} />
      <g fill={P.white} opacity="0.5">
        <ellipse cx="1216" cy="380" rx="16" ry="28" />
        <ellipse cx="1352" cy="330" rx="16" ry="28" />
        <ellipse cx="1280" cy="254" rx="16" ry="28" />
      </g>
      {/* the table, with its cloth, and the cake */}
      <rect y="700" width="1600" height="200" fill={P.paper} />
      <rect y="700" width="1600" height="12" fill="#f3c5d3" opacity="0.7" />
      <path
        d="M0 852 q50 34 100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 t100 0 V900 H0 Z"
        fill={P.creamShade}
      />
      <ellipse cx="800" cy="742" rx="270" ry="32" fill={P.white} stroke={P.creamShade} strokeWidth="8" />
      <rect x="590" y="590" width="420" height="150" rx="26" fill={P.woodLight} />
      <path
        d="M590 620 q0 -30 30 -30 h360 q30 0 30 30 v24 q-35 44 -70 0 t-70 0 t-70 0 t-70 0 t-70 0 t-70 0 z"
        fill={P.rose}
      />
      <rect x="670" y="480" width="260" height="120" rx="24" fill={P.creamShade} />
      <path
        d="M670 506 q0 -26 26 -26 h208 q26 0 26 26 v22 q-33 40 -65 0 t-65 0 t-65 0 t-65 0 z"
        fill={P.white}
      />
      <g fill={P.red}>
        <circle cx="640" cy="596" r="14" />
        <circle cx="720" cy="590" r="14" />
        <circle cx="880" cy="590" r="14" />
        <circle cx="960" cy="596" r="14" />
      </g>
      {[720, 800, 880].map((x, index) => (
        <g key={x}>
          <rect x={x - 9} y="404" width="18" height="84" rx="9" fill={[P.teal, P.honey, P.lav][index]} />
          <path d={`M${x} 350 q22 30 0 50 q-22 -20 0 -50 z`} fill={P.terra} />
          <path d={`M${x} 372 q10 14 0 24 q-10 -10 0 -24 z`} fill={P.honeyLight} />
        </g>
      ))}
      {/* presents */}
      <rect x="150" y="640" width="210" height="170" rx="18" fill={P.lav} />
      <rect x="236" y="640" width="38" height="170" fill={P.honey} />
      <rect x="138" y="616" width="234" height="48" rx="16" fill={P.lavDeep} />
      <rect x="236" y="616" width="38" height="48" fill={P.honeyDeep} />
      <path
        d="M255 616 q-70 -80 -86 -22 q-6 26 86 22 z M255 616 q70 -80 86 -22 q6 26 -86 22 z"
        fill={P.honey}
      />
      <rect x="392" y="700" width="140" height="110" rx="14" fill={P.teal} />
      <rect x="448" y="700" width="28" height="110" fill={P.red} />
      <rect x="392" y="740" width="140" height="28" fill={P.red} />
      {/* a party hat */}
      <path d="M1420 800 l70 -190 l76 190 z" fill={P.teal} />
      <path d="M1447 728 l96 0 l14 36 l-124 0 z" fill={P.honey} />
      <circle cx="1490" cy="604" r="22" fill={P.red} />
    </>
  );
}

export function SamplePicture({ index }: { index: number }) {
  const which = ((index % SAMPLE_COUNT) + SAMPLE_COUNT) % SAMPLE_COUNT;
  return (
    <svg
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      width="100%"
      height="100%"
      role="img"
      aria-label="A sample picture"
      focusable="false"
    >
      {which === 0 && <Picnic />}
      {which === 1 && <Beach />}
      {which === 2 && <Snow />}
      {which === 3 && <Birthday />}
    </svg>
  );
}
