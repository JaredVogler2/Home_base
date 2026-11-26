import { P } from './palette';

/**
 * Four drawings that stand in for a family's photographs in the demo, where there is no family. They are
 * plainly drawings and are labelled as samples: nobody's picture is used, and nothing is fetched.
 */
export const SAMPLE_COUNT = 4;

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
      {which === 0 && (
        <>
          <rect width="1600" height="900" fill="#bfe6fb" />
          <circle cx="1280" cy="210" r="110" fill={P.honey} />
          <path d="M0 620 Q380 380 800 560 T1600 500 V900 H0 Z" fill={P.sage} />
          <path d="M0 720 Q500 600 1000 720 T1600 700 V900 H0 Z" fill={P.sageDeep} opacity="0.75" />
          <rect
            x="560"
            y="640"
            width="420"
            height="150"
            rx="20"
            fill={P.red}
            transform="rotate(-4 770 715)"
          />
          <g fill={P.cream} opacity="0.85" transform="rotate(-4 770 715)">
            <rect x="640" y="640" width="60" height="150" />
            <rect x="780" y="640" width="60" height="150" />
            <rect x="920" y="640" width="60" height="150" />
          </g>
          <circle cx="700" cy="610" r="52" fill={P.wood} />
          <path
            d="M650 600 q50 -80 100 0"
            fill="none"
            stroke={P.woodDeep}
            strokeWidth="14"
            strokeLinecap="round"
          />
        </>
      )}
      {which === 1 && (
        <>
          <rect width="1600" height="900" fill="#cfeefa" />
          <rect y="520" width="1600" height="200" fill={P.teal} />
          <path
            d="M0 560 q100 -30 200 0 t200 0 t200 0 t200 0 t200 0 t200 0 t200 0 t200 0"
            fill="none"
            stroke={P.white}
            strokeWidth="12"
            opacity="0.6"
          />
          <rect y="700" width="1600" height="200" fill="#f6dfa6" />
          <path d="M620 720 h360 v-110 h-70 v-60 h-60 v60 h-100 v-60 h-60 v60 h-70 z" fill="#e9c98a" />
          <path
            d="M800 480 v70 M800 480 l70 26 l-70 24"
            fill={P.red}
            stroke={P.woodDeep}
            strokeWidth="10"
            strokeLinejoin="round"
          />
          <circle cx="1180" cy="760" r="60" fill={P.red} />
          <path d="M1120 760 a60 60 0 0 1 120 0" fill={P.honey} />
          <circle cx="300" cy="200" r="90" fill={P.honey} />
        </>
      )}
      {which === 2 && (
        <>
          <rect width="1600" height="900" fill="#dbe7f5" />
          <path d="M0 640 Q400 480 800 620 T1600 560 V900 H0 Z" fill={P.white} />
          <g fill={P.white}>
            <circle cx="260" cy="220" r="12" />
            <circle cx="520" cy="120" r="10" />
            <circle cx="900" cy="260" r="12" />
            <circle cx="1240" cy="140" r="10" />
            <circle cx="1440" cy="320" r="12" />
            <circle cx="700" cy="400" r="9" />
          </g>
          <circle cx="1080" cy="640" r="110" fill={P.white} stroke="#c9d6e6" strokeWidth="8" />
          <circle cx="1080" cy="490" r="76" fill={P.white} stroke="#c9d6e6" strokeWidth="8" />
          <circle cx="1056" cy="476" r="9" fill={P.ink} />
          <circle cx="1104" cy="476" r="9" fill={P.ink} />
          <path d="M1080 494 l44 12 l-44 10 z" fill={P.terra} />
          <path d="M1010 432 h140 v-20 h-30 v-70 h-80 v70 h-30 z" fill={P.ink} />
          <path d="M380 700 l220 -60 l60 60 z" fill={P.red} />
          <path d="M360 716 h340" stroke={P.woodDeep} strokeWidth="14" strokeLinecap="round" />
        </>
      )}
      {which === 3 && (
        <>
          <rect width="1600" height="900" fill="#fde2ea" />
          <path d="M100 150 q350 110 700 0 t700 0" fill="none" stroke={P.woodDeep} strokeWidth="8" />
          {[200, 380, 560, 740, 920, 1100, 1280, 1420].map((x, i) => (
            <path
              key={x}
              d={`M${x - 46} ${188 + (i % 2) * 14} h92 l-46 86 z`}
              fill={[P.red, P.honey, P.teal, P.lav][i % 4]}
            />
          ))}
          <rect x="560" y="600" width="480" height="180" rx="22" fill={P.cream} />
          <rect x="560" y="600" width="480" height="46" rx="22" fill={P.rose} />
          <rect x="640" y="500" width="320" height="110" rx="20" fill="#f7a6c0" />
          <g fill={P.honey}>
            <rect x="700" y="430" width="18" height="74" rx="9" />
            <rect x="792" y="430" width="18" height="74" rx="9" />
            <rect x="884" y="430" width="18" height="74" rx="9" />
          </g>
          <g fill={P.terra}>
            <ellipse cx="709" cy="412" rx="13" ry="20" />
            <ellipse cx="801" cy="412" rx="13" ry="20" />
            <ellipse cx="893" cy="412" rx="13" ry="20" />
          </g>
          <ellipse cx="1300" cy="430" rx="80" ry="96" fill={P.blue} />
          <path d="M1300 526 q-30 90 20 190" fill="none" stroke={P.ink} strokeWidth="6" />
        </>
      )}
    </svg>
  );
}
