import type { SkyState } from '../../../shared/model';
import type { Layout } from '../../wall/home/layout';
import type { Season, SkyLook } from '../../wall/sky';
import { P } from '../palette';

/**
 * Everything behind the rooms: the sky the family is really under, the hills, the pond, the garden, and the
 * shell of the house itself — roof, attic, frame and beams.
 *
 * It is one picture, drawn on the layout's sheet. The sky and the lawn are drawn far wider than the sheet, so
 * that on a screen of another shape there is more sky and more lawn rather than black bars.
 */

const BLEED = 3000;

function Cloud({ x, y, s = 1, className }: { x: number; y: number; s?: number; className?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} className={className}>
      <g className="house-cloud">
        <ellipse cx="0" cy="20" rx="90" ry="34" />
        <ellipse cx="70" cy="0" rx="70" ry="40" />
        <ellipse cx="140" cy="26" rx="80" ry="30" />
      </g>
    </g>
  );
}

/** The moon as it is tonight: a disc with the dark part of it shaded away. */
function Moon({ r, phase }: { r: number; phase: number }) {
  // 0 new … 0.5 full … 1 new. The lit edge is an ellipse whose width follows the phase.
  const waxing = phase < 0.5;
  const k = Math.cos(phase * 2 * Math.PI); // 1 at new, -1 at full
  const rx = Math.abs(k) * r;
  const lit = P.paper;
  const dark = '#5a5f9e';
  // Start from a dark disc, light one half, then add or remove the middle with the terminator ellipse.
  return (
    <g>
      <circle r={r} fill={dark} />
      <path
        d={waxing ? `M0 ${-r} A${r} ${r} 0 0 1 0 ${r} Z` : `M0 ${-r} A${r} ${r} 0 0 0 0 ${r} Z`}
        fill={lit}
      />
      <ellipse rx={rx} ry={r} fill={k > 0 ? dark : lit} />
      <circle cx={-r * 0.25} cy={-r * 0.2} r={r * 0.14} fill={dark} opacity="0.18" />
      <circle cx={r * 0.2} cy={r * 0.3} r={r * 0.1} fill={dark} opacity="0.18" />
    </g>
  );
}

const LEAVES: Record<Season, { a: string; b: string; c: string; fruit: string | null }> = {
  spring: { a: '#9ddc9a', b: '#8fd08a', c: '#7cc77d', fruit: '#f7a6c0' },
  summer: { a: '#7cc77d', b: '#69b872', c: '#5aa866', fruit: P.red },
  autumn: { a: '#f5b85e', b: '#ee9a4d', c: '#e07f45', fruit: P.redDeep },
  winter: { a: '#cfe0e8', b: '#b9cfda', c: '#a9c2cf', fruit: null },
};

function Weather({ state, layout }: { state: SkyState; layout: Layout }) {
  const { w, h } = layout.sheet;
  if (state === 'rain' || state === 'drizzle' || state === 'storm') {
    const count = state === 'drizzle' ? 26 : 46;
    return (
      <g
        className="house-rain"
        stroke="#8fbfe6"
        strokeWidth={state === 'drizzle' ? 4 : 5}
        strokeLinecap="round"
        opacity="0.75"
      >
        {Array.from({ length: count }, (_, index) => {
          const x = ((index * 137) % 100) / 100;
          const y = ((index * 61) % 100) / 100;
          return (
            <path
              key={index}
              className={`house-drop house-drop-${index % 4}`}
              d={`M${x * w} ${y * h * 0.8} l-10 30`}
            />
          );
        })}
      </g>
    );
  }
  if (state === 'snow') {
    return (
      <g fill={P.white} opacity="0.95">
        {Array.from({ length: 42 }, (_, index) => {
          const x = ((index * 149) % 100) / 100;
          const y = ((index * 67) % 100) / 100;
          return (
            <circle
              key={index}
              className={`house-flake house-flake-${index % 4}`}
              cx={x * w}
              cy={y * h * 0.82}
              r={5 + (index % 3) * 2}
            />
          );
        })}
      </g>
    );
  }
  if (state === 'fog') {
    return (
      <g fill={P.white}>
        <rect
          x={-BLEED}
          y={h * 0.34}
          width={w + BLEED * 2}
          height={h * 0.2}
          opacity="0.35"
          className="house-fog"
        />
        <rect
          x={-BLEED}
          y={h * 0.5}
          width={w + BLEED * 2}
          height={h * 0.24}
          opacity="0.3"
          className="house-fog house-fog-2"
        />
      </g>
    );
  }
  return null;
}

export function Backdrop({ layout, look }: { layout: Layout; look: SkyLook }) {
  const { w, h } = layout.sheet;
  const wide = layout.shape === 'wide';
  const { frame, roof, attic, chimney, ground, sun } = layout;
  const leaves = LEAVES[look.season];
  const body = look.body;
  const bodyX = body ? sun.left + (sun.right - sun.left) * body.x : 0;
  const bodyY = body ? sun.low - (sun.low - sun.top) * body.y : 0;
  const clouds = look.cloud;
  const snowy = look.weather === 'snow' || (look.season === 'winter' && look.weather !== 'rain');

  return (
    <svg
      className="house-backdrop"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="hb-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="house-stop-sky-top" />
          <stop offset="1" className="house-stop-sky-low" />
        </linearGradient>
        <linearGradient id="hb-lawn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="house-stop-lawn-top" />
          <stop offset="1" className="house-stop-lawn-low" />
        </linearGradient>
        <linearGradient id="hb-pond" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="house-stop-pond-a" />
          <stop offset="1" className="house-stop-pond-b" />
        </linearGradient>
        <radialGradient id="hb-halo">
          <stop offset="0.42" stopColor={P.honeyLight} stopOpacity="0.8" />
          <stop offset="1" stopColor={P.honeyLight} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="hb-moonhalo">
          <stop offset="0.42" stopColor="#b9b5ee" stopOpacity="0.7" />
          <stop offset="1" stopColor="#b9b5ee" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hb-roof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f59a72" />
          <stop offset="1" stopColor="#d9673f" />
        </linearGradient>
        <linearGradient id="hb-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9a877" />
          <stop offset="1" stopColor="#b47d4d" />
        </linearGradient>
        <linearGradient id="hb-wood-dark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b9814f" />
          <stop offset="1" stopColor={P.woodDeep} />
        </linearGradient>
      </defs>

      {/* sky */}
      {/* The gradient is as tall as the sky you can see; above the sheet it carries on in the top colour. */}
      <rect x={-BLEED} y={0} width={w + BLEED * 2} height={ground} fill="url(#hb-sky)" />
      <rect x={-BLEED} y={-BLEED} width={w + BLEED * 2} height={BLEED + 1} className="house-sky-top" />
      <g className="house-stars" fill={P.white}>
        {Array.from({ length: wide ? 26 : 16 }, (_, index) => (
          <circle
            key={index}
            className={index % 3 === 0 ? 'house-twinkle' : undefined}
            cx={((index * 211) % 100) * 0.01 * w}
            cy={((index * 83) % 100) * 0.01 * ground * 0.62}
            r={2.2 + (index % 3) * 0.8}
          />
        ))}
      </g>
      {body && (
        <g transform={`translate(${bodyX} ${bodyY})`} style={{ opacity: Math.max(0.25, 1 - clouds * 0.75) }}>
          <circle r={sun.r * 2.4} fill={body.kind === 'sun' ? 'url(#hb-halo)' : 'url(#hb-moonhalo)'} />
          {body.kind === 'sun' ? (
            <circle r={sun.r} fill="#ffd45e" />
          ) : (
            <Moon r={sun.r * 0.86} phase={look.now.moon} />
          )}
        </g>
      )}
      {clouds > 0.05 && <Cloud x={w * 0.27} y={wide ? 150 : 96} s={wide ? 1 : 0.7} className="house-drift" />}
      {clouds > 0.3 && (
        <Cloud x={w * 0.8} y={wide ? 200 : 230} s={wide ? 1.1 : 0.6} className="house-drift-back" />
      )}
      {clouds > 0.6 && (
        <>
          <Cloud x={w * 0.02} y={wide ? 250 : 180} s={wide ? 1.4 : 0.8} className="house-drift-back" />
          <Cloud x={w * 0.52} y={wide ? 40 : 30} s={wide ? 1.5 : 0.9} className="house-drift" />
          <Cloud x={w * 0.66} y={wide ? 300 : 140} s={wide ? 1.2 : 0.7} />
        </>
      )}

      {/* land */}
      {wide ? (
        <>
          <path
            d={`M${-BLEED} 640 H0 Q260 520 560 610 T1100 600 T1920 560 H${w + BLEED} V1080 H${-BLEED} Z`}
            className="house-hill-far"
          />
          {/* far over the water: the lighthouse island the boat sails to */}
          <g opacity="0.85" transform="translate(70 600) scale(1.5)">
            <ellipse cx="60" cy="30" rx="70" ry="12" fill="#f3e3b5" />
            <path d="M20 28 q40 -34 80 0 z" fill="#9fd9a4" />
            <rect x="52" y="-22" width="16" height="40" rx="4" fill={P.cream} />
            <rect x="52" y="-8" width="16" height="9" fill={P.terra} />
            <path d="M48 -22 h24 l-12 -14 z" fill={P.terra} />
            <circle cx="60" cy="-16" r="3.4" fill={P.honey} className="house-lamp-solid" />
          </g>
          <path
            d={`M${-BLEED} 760 H0 Q300 660 640 740 T1280 730 T1920 700 H${w + BLEED} V1080 H${-BLEED} Z`}
            className="house-hill"
          />
        </>
      ) : (
        <path
          d={`M${-BLEED} 1320 H0 Q200 1250 420 1300 T780 1280 H${w + BLEED} V1688 H${-BLEED} Z`}
          className="house-hill"
        />
      )}
      <rect x={-BLEED} y={ground} width={w + BLEED * 2} height={BLEED} fill="url(#hb-lawn)" />
      <rect x={-BLEED} y={h - 2} width={w + BLEED * 2} height={BLEED} className="house-lawn-low" />
      {snowy && (
        <path
          d={`M${-BLEED} ${ground} H${w + BLEED} v26 q-${w / 2} 22 -${w + BLEED * 2} 0 z`}
          fill={P.white}
          opacity="0.85"
        />
      )}

      {/* the pond */}
      {wide && (
        <g transform="translate(0 16)">
          <ellipse cx="226" cy="900" rx="232" ry="74" fill="#e9dcae" />
          <ellipse cx="226" cy="898" rx="212" ry="62" fill="url(#hb-pond)" />
          <ellipse cx="170" cy="884" rx="90" ry="12" fill={P.white} opacity="0.28" />
          <g fill={P.sageDeep}>
            <path d="M30 880 q4 -44 14 -4 z" />
            <path d="M48 890 q6 -56 16 -6 z" />
            <path d="M404 876 q6 -50 16 -4 z" />
          </g>
        </g>
      )}

      {/* the garden: the tree wears the season */}
      {wide && (
        <g>
          <rect x="1770" y="700" width="34" height="200" rx="14" fill="url(#hb-wood-dark)" />
          <g className="house-sway">
            {look.season === 'winter' ? (
              <g fill="none" stroke="url(#hb-wood-dark)" strokeWidth="16" strokeLinecap="round">
                <path d="M1787 720 Q1760 640 1700 610" />
                <path d="M1787 720 Q1810 620 1880 600" />
                <path d="M1787 700 Q1790 600 1780 540" />
              </g>
            ) : (
              <>
                <circle cx="1790" cy="640" r="128" fill={leaves.b} />
                <circle cx="1740" cy="590" r="70" fill={leaves.a} opacity="0.8" />
                <circle cx="1700" cy="690" r="70" fill={leaves.a} />
                <circle cx="1866" cy="700" r="66" fill={leaves.c} />
              </>
            )}
            {leaves.fruit && (
              <g fill={leaves.fruit}>
                <circle cx="1740" cy="620" r="15" />
                <circle cx="1830" cy="596" r="15" />
                <circle cx="1800" cy="690" r="15" />
                <circle cx="1700" cy="700" r="13" />
                <circle cx="1872" cy="680" r="13" />
              </g>
            )}
            {look.season === 'winter' && (
              <g fill={P.white}>
                <ellipse cx="1700" cy="604" rx="26" ry="9" />
                <ellipse cx="1880" cy="594" rx="26" ry="9" />
                <ellipse cx="1780" cy="534" rx="20" ry="8" />
              </g>
            )}
          </g>
          <g fill={P.paper} stroke="#e7d3ab" strokeWidth="4">
            {[1680, 1728, 1776, 1824, 1872].map((x) => (
              <rect key={x} x={x} y="830" width="30" height="86" rx="12" />
            ))}
            <rect x="1668" y="856" width="244" height="16" rx="8" />
          </g>
        </g>
      )}

      {/* the house */}
      <ellipse
        cx={frame.x + frame.w / 2}
        cy={frame.y + frame.h + 4}
        rx={frame.w * 0.58}
        ry={wide ? 24 : 18}
        fill={P.ink}
        opacity="0.16"
      />
      <g fill={P.white} opacity="0.85">
        <circle
          className="house-puff"
          cx={chimney.x + chimney.w / 2}
          cy={chimney.y - 26}
          r={chimney.w * 0.26}
        />
        <circle
          className="house-puff house-puff-2"
          cx={chimney.x + chimney.w / 2 + 10}
          cy={chimney.y - 30}
          r={chimney.w * 0.2}
        />
        <circle
          className="house-puff house-puff-3"
          cx={chimney.x + chimney.w / 2 - 6}
          cy={chimney.y - 34}
          r={chimney.w * 0.23}
        />
      </g>
      <rect x={chimney.x} y={chimney.y} width={chimney.w} height={chimney.h} rx="10" fill="#e89473" />
      <rect
        x={chimney.x - 10}
        y={chimney.y - 12}
        width={chimney.w + 20}
        height="26"
        rx="10"
        fill={P.terraDeep}
      />
      {/* the attic's gable */}
      <path
        d={`M${frame.x + 30} ${frame.y + 6} L${roof.apex[0]} ${roof.apex[1] + 24} L${frame.x + frame.w - 30} ${frame.y + 6} Z`}
        className="house-wall"
      />
      <circle cx={attic.cx} cy={attic.cy} r={attic.r} fill="url(#hb-wood-dark)" />
      <circle cx={attic.cx} cy={attic.cy} r={attic.r - 12} className="house-window" />
      <circle cx={attic.cx} cy={attic.cy} r={attic.r - 12} fill="#ffe08a" className="house-lamp-solid" />
      {/* the frame the rooms sit in */}
      <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} rx="14" fill="url(#hb-wood-dark)" />
      <g fill="url(#hb-wood)">
        {layout.beams.map((beam, index) => (
          <rect key={index} x={beam.x} y={beam.y} width={beam.w} height={beam.h} />
        ))}
      </g>
      <rect
        x={frame.x - 12}
        y={frame.y + frame.h - 38}
        width={frame.w + 24}
        height="40"
        rx="12"
        fill="#cdbfae"
      />
      <rect
        x={frame.x - 12}
        y={frame.y + frame.h - 38}
        width={frame.w + 24}
        height="12"
        rx="6"
        fill="#e3d8c8"
      />
      {/* the roof */}
      <path
        d={`M${roof.left[0]} ${roof.left[1]} L${roof.apex[0]} ${roof.apex[1]} L${roof.right[0]} ${roof.right[1]}`}
        fill="none"
        stroke={P.terraDeep}
        strokeWidth={roof.width}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={`M${roof.left[0]} ${roof.left[1] - 6} L${roof.apex[0]} ${roof.apex[1] - 6} L${roof.right[0]} ${roof.right[1] - 6}`}
        fill="none"
        stroke="url(#hb-roof)"
        strokeWidth={roof.width - 14}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={`M${roof.left[0] + 42} ${roof.left[1] - 32} L${roof.apex[0]} ${roof.apex[1] - 14} L${roof.right[0] - 42} ${roof.right[1] - 32}`}
        fill="none"
        stroke="#ffb999"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
      {snowy && (
        <path
          d={`M${roof.left[0] + 30} ${roof.left[1] - 30} L${roof.apex[0]} ${roof.apex[1] - 22} L${roof.right[0] - 30} ${roof.right[1] - 30}`}
          fill="none"
          stroke={P.white}
          strokeWidth="20"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.92"
        />
      )}
      {/* the front path */}
      {wide ? (
        <>
          <path d="M850 946 h220 l90 134 h-400 z" fill="#f3e2bd" />
          <path d="M850 946 h220 l12 18 h-244 z" fill="#e4cd9d" />
        </>
      ) : (
        <path d={`M280 ${frame.y + frame.h} h220 l60 ${h - frame.y - frame.h} h-340 z`} fill="#f3e2bd" />
      )}
      <Weather state={look.weather} layout={layout} />
    </svg>
  );
}

/** The boat that sails to the Academy: a button's picture. */
export function Boat({ resting }: { resting: boolean }) {
  return (
    <svg
      viewBox="0 0 240 280"
      width="100%"
      height="100%"
      aria-hidden="true"
      focusable="false"
      overflow="visible"
    >
      <ellipse cx="120" cy="268" rx="120" ry="12" fill={P.white} opacity="0.35" />
      <g className={resting ? undefined : 'house-bob'}>
        <rect x="114" y="18" width="10" height="200" rx="5" fill={P.woodDeep} />
        <g className="house-sway">
          <path d="M124 22 l40 14 l-40 14 z" fill={P.blue} />
        </g>
        {resting ? (
          // The sails are down: the boat is not going anywhere today.
          <>
            <rect
              x="60"
              y="190"
              width="120"
              height="20"
              rx="10"
              fill={P.cream}
              stroke="#ecd9b4"
              strokeWidth="4"
            />
            <path d="M70 200 h100" stroke="#ecd9b4" strokeWidth="4" strokeLinecap="round" />
          </>
        ) : (
          <>
            <path
              d="M130 44 q78 70 84 160 h-84 z"
              fill={P.paper}
              stroke="#ecd9b4"
              strokeWidth="4"
              strokeLinejoin="round"
            />
            <path
              d="M108 70 q-62 60 -76 134 h76 z"
              fill="#ffd98a"
              stroke={P.honeyDeep}
              strokeWidth="4"
              strokeLinejoin="round"
            />
            <g transform="translate(168 146)">
              <path d="M-13 30 l5 -52 h16 l5 52 z" fill={P.cream} stroke="#d9c7a3" strokeWidth="2" />
              <path d="M-10.6 4 h21.2 l1.2 12 h-23.6 z" fill={P.terra} />
              <rect x="-11" y="-34" width="22" height="14" rx="3" fill={P.honey} />
              <path d="M-14 -34 h28 l-14 -14 z" fill={P.terra} />
              <rect x="-20" y="28" width="40" height="8" rx="4" fill={P.sage} />
            </g>
          </>
        )}
        <path d="M14 214 h212 q-8 44 -50 50 h-112 q-42 -6 -50 -50 z" fill={P.red} />
        <path d="M22 232 q98 26 196 0 q-8 28 -42 32 h-112 q-34 -4 -42 -32 z" fill={P.redDeep} opacity="0.6" />
        <rect x="10" y="206" width="220" height="16" rx="8" fill={P.cream} />
        <circle cx="78" cy="240" r="9" fill={P.cream} />
        <circle cx="120" cy="240" r="9" fill={P.cream} />
        <circle cx="162" cy="240" r="9" fill={P.cream} />
      </g>
    </svg>
  );
}
