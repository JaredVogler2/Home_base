import type { ReactNode } from 'react';
import type { ActionPictureId, DayPictureId, ShoppingPictureId } from '../../../shared/pictures';
import { P } from '../palette';
import { ACTION_ART, DAY_ART, SHOPPING_ART } from '../pictures';
import { Star } from '../pictures/kit';

/**
 * The rooms of the house, as pictures that say how things stand.
 *
 * Each room is one of the family's things — missions, the day, the stars, the shopping, the photos, the calendar —
 * and the picture of the room is its status: the cards pinned on the board are today's missions, the stars on
 * the tray are the stars in the bank, the things in the basket are the things on the list. A child reads the
 * house the way they read their own home: by looking.
 *
 * Every room is drawn on its own box and scaled to fit; nothing in a room is tappable on its own — the whole
 * room is the button.
 */

/** A drawing from the registry, set inside a room at a place and a size. */
function Inset({
  art,
  x,
  y,
  size,
}: {
  art: (() => ReactNode) | undefined;
  x: number;
  y: number;
  size: number;
}) {
  if (!art) return null;
  const Draw = art;
  return (
    <svg x={x} y={y} width={size} height={size} viewBox="0 0 100 100" overflow="visible">
      <Draw />
    </svg>
  );
}

const Floor = ({ y, w, h = 40 }: { y: number; w: number; h?: number }) => (
  <>
    <rect y={y} width={w} height={h} fill={P.woodLight} />
    <rect y={y} width={w} height={5} fill={P.wood} opacity="0.35" />
  </>
);

function Room({ w, h, label, children }: { w: number; h: number; label: string; children: ReactNode }) {
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid slice"
      width="100%"
      height="100%"
      role="img"
      aria-label={label}
      focusable="false"
    >
      {children}
    </svg>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// QUEST: the mission board
// ---------------------------------------------------------------------------------------------------------------------

export interface BoardCard {
  picture: ActionPictureId;
  /** `done`: finished; `sent`: waiting for a grown-up; `todo`: still to do. */
  state: 'todo' | 'sent' | 'done';
}

const PIN = [P.red, P.blueDeep, P.honeyDeep];
const TILT = [-4, 2, 5];

export function QuestRoom({ cards, done, total }: { cards: BoardCard[]; done: number; total: number }) {
  const shown = cards.slice(0, 3);
  const sockets = Math.min(Math.max(total, 0), 5);
  // The sockets share the width of the board: five fit as well as two.
  const gap = Math.min(42, 164 / Math.max(sockets, 1));
  const label = total === 0 ? 'Missions. None today.' : `Missions. ${done} of ${total} done today.`;
  return (
    <Room w={238} h={290} label={label}>
      <rect width="238" height="290" fill={P.sageLight} />
      <Floor y={250} w={238} />
      <rect x="10" y="14" width="218" height="222" rx="22" fill={P.woodDeep} />
      <rect x="10" y="14" width="218" height="12" rx="6" fill={P.wood} opacity="0.5" />
      <rect x="23" y="27" width="192" height="196" rx="11" fill="#ecc793" />
      <g fill="#dfb57c">
        <circle cx="40" cy="150" r="3" />
        <circle cx="200" cy="46" r="3" />
        <circle cx="120" cy="212" r="3" />
        <circle cx="34" cy="40" r="3" />
      </g>
      {shown.length === 0 ? (
        // Nothing to do today: the board is clear, with a leaf pinned on it.
        <g transform="translate(119 100)">
          <rect x="-34" y="-46" width="68" height="92" rx="10" fill={P.paper} />
          <path d="M0 22 Q-22 6 -12 -18 Q0 -30 12 -18 Q22 6 0 22 Z" fill={P.sage} />
          <path d="M0 22 V-12" stroke={P.sageDeep} strokeWidth="3" strokeLinecap="round" />
          <circle cx="0" cy="-36" r="5" fill={P.sageDeep} />
        </g>
      ) : (
        shown.map((card, index) => {
          const x = shown.length === 1 ? 119 : shown.length === 2 ? 86 + index * 66 : 58 + index * 62;
          return (
            <g key={index} transform={`translate(${x} ${94 + (index % 2) * 3}) rotate(${TILT[index] ?? 0})`}>
              <rect x="-30" y="-50" width="60" height="98" rx="10" fill={P.paper} />
              <rect x="-30" y="40" width="60" height="8" rx="4" fill={P.creamShade} opacity="0.7" />
              <Inset art={ACTION_ART[card.picture]} x={-26} y={-30} size={52} />
              <circle cx="0" cy="-40" r="5" fill={PIN[index]} />
              {card.state === 'done' && (
                <g transform="translate(19 36)">
                  <circle r="15" fill={P.sageDeep} stroke={P.paper} strokeWidth="3" />
                  <path
                    d="M-7 0 l5.5 5.5 l10 -11"
                    fill="none"
                    stroke={P.white}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              )}
              {card.state === 'sent' && (
                <g transform="translate(19 36)">
                  <circle r="15" fill={P.honey} stroke={P.paper} strokeWidth="3" />
                  <path d="M-6 -7 h12 l-6 7 l6 7 h-12 l6 -7 z" fill={P.ink} />
                </g>
              )}
            </g>
          );
        })
      )}
      {sockets > 0 && (
        <g transform="translate(119 188)">
          <rect
            x={-(sockets * gap) / 2 - 12}
            y="-21"
            width={sockets * gap + 24}
            height="42"
            rx="21"
            fill="#d9a468"
          />
          {Array.from({ length: sockets }, (_, index) => {
            const x = (index - (sockets - 1) / 2) * gap;
            return index < done ? (
              <Star key={index} x={x} y={0} s={gap / 28} />
            ) : (
              <circle
                key={index}
                cx={x}
                cy={0}
                r={gap * 0.26}
                fill="#f3d6a6"
                stroke="#c98f52"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
            );
          })}
        </g>
      )}
      <g transform="translate(40 268)">
        <rect x="-16" y="-14" width="22" height="22" rx="5" fill={P.blue} />
        <rect x="8" y="-8" width="18" height="18" rx="5" fill={P.red} />
      </g>
      <g transform="translate(200 270)">
        <circle r="13" fill={P.honey} />
        <path d="M-13 0 a13 13 0 0 1 26 0" fill={P.red} />
      </g>
    </Room>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// ROUTINES: the day clock, where Tock lives
// ---------------------------------------------------------------------------------------------------------------------

export function ClockRoom({
  turn,
  next,
  running,
}: {
  /** The day wheel: 0 at midnight, 0.5 at midday. */
  turn: number;
  /** The picture of what comes next, when there is something. */
  next: ActionPictureId | null;
  /** A routine is under way. */
  running: boolean;
}) {
  const angle = (turn - 0.5) * 360;
  return (
    <Room w={238} h={290} label={next ? 'The day clock. Something is next.' : 'The day clock.'}>
      <rect width="238" height="290" fill="#fdf0cc" />
      <g fill="#f9e3a8">
        <rect x="14" width="16" height="250" />
        <rect x="208" width="16" height="250" />
      </g>
      <Floor y={250} w={238} />
      <ellipse cx="119" cy="262" rx="84" ry="9" fill={P.ink} opacity="0.13" />
      <path
        d="M30 70 L119 8 L208 70 Z"
        fill={P.terra}
        stroke={P.terraDeep}
        strokeWidth="7"
        strokeLinejoin="round"
      />
      <path d="M52 62 L119 16" stroke={P.terraLight} strokeWidth="5" strokeLinecap="round" opacity="0.7" />
      <rect x="46" y="58" width="146" height="206" rx="24" fill={P.woodDeep} />
      <rect x="57" y="69" width="124" height="184" rx="15" fill={P.wood} />
      <rect x="57" y="69" width="124" height="14" rx="7" fill={P.woodLight} opacity="0.6" />
      {/* the day wheel: the sky turns once a day behind a fixed window */}
      <circle cx="119" cy="114" r="44" fill={P.paper} stroke={P.woodDeep} strokeWidth="6" />
      <clipPath id="clock-face">
        <circle cx="119" cy="114" r="38" />
      </clipPath>
      <g clipPath="url(#clock-face)">
        <g transform={`rotate(${angle} 119 114)`}>
          <path d="M81 114 a38 38 0 0 1 76 0 z" fill="#bfe6fb" />
          <path d="M81 114 a38 38 0 0 0 76 0 z" fill={P.lavDeep} />
          <circle cx="119" cy="90" r="13" fill={P.honey} />
          <g stroke={P.honeyDeep} strokeWidth="3.5" strokeLinecap="round">
            <path d="M119 72 v-4" />
            <path d="M103 80 l-3 -3" />
            <path d="M135 80 l3 -3" />
          </g>
          <path d="M113 130 a10 10 0 1 0 12 12 a8 8 0 0 1 -12 -12 z" fill="#f4f1ff" />
          <circle cx="100" cy="128" r="2.2" fill="#f4f1ff" />
          <circle cx="138" cy="126" r="2.2" fill="#f4f1ff" />
        </g>
      </g>
      {/* a fixed pointer at the top: "now" */}
      <path d="M119 72 l-7 -11 h14 z" fill={P.ink} />
      {/* Tock's door */}
      <path d="M103 202 v-20 a16 16 0 0 1 32 0 v20 z" fill="#5a3a25" />
      <rect x="97" y="199" width="44" height="7" rx="3.5" fill={P.woodDeep} />
      {/* what comes next */}
      <path
        d="M66 252 v-28 q0 -12 12 -12 h82 q12 0 12 12 v28 z"
        fill={P.paper}
        stroke={P.woodDeep}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      {next ? (
        <Inset art={ACTION_ART[next]} x={99} y={213} size={40} />
      ) : (
        <g fill={P.creamShade}>
          <circle cx="103" cy="233" r="5" />
          <circle cx="119" cy="233" r="5" />
          <circle cx="135" cy="233" r="5" />
        </g>
      )}
      {running && (
        <g transform="translate(160 216)">
          <circle r="13" fill={P.honey} stroke={P.paper} strokeWidth="3" />
          <path d="M-4 -6 l10 6 l-10 6 z" fill={P.ink} />
        </g>
      )}
    </Room>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// BANK: the piggy bank and the star tray
// ---------------------------------------------------------------------------------------------------------------------

/** Ten places, five and five — the way two hands hold ten. */
export function StarTray({
  stars,
  x = 0,
  y = 0,
  cell = 30,
}: {
  stars: number;
  x?: number;
  y?: number;
  cell?: number;
}) {
  const shown = Math.min(Math.max(stars, 0), 10);
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect
        x={-cell * 0.5}
        y={-cell * 0.55}
        width={cell * 5}
        height={cell * 2.1}
        rx={cell * 0.45}
        fill={P.night}
      />
      <rect
        x={-cell * 0.5}
        y={-cell * 0.55}
        width={cell * 5}
        height={cell * 0.5}
        rx={cell * 0.25}
        fill={P.white}
        opacity="0.08"
      />
      {Array.from({ length: 10 }, (_, index) => {
        const cx = (index % 5) * cell;
        const cy = Math.floor(index / 5) * cell;
        return index < shown ? (
          <Star key={index} x={cx} y={cy} s={cell / 26} />
        ) : (
          <circle key={index} cx={cx} cy={cy} r={cell * 0.2} fill={P.white} opacity="0.18" />
        );
      })}
    </g>
  );
}

export function Piggy({ happy = false }: { happy?: boolean }) {
  return (
    <g>
      <path
        d="M49 132 q-18 -8 -16 -24 q10 4 14 12"
        fill="none"
        stroke="#e77fa3"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <rect x="70" y="170" width="20" height="28" rx="9" fill="#e77fa3" />
      <rect x="146" y="170" width="20" height="28" rx="9" fill="#e77fa3" />
      <rect x="94" y="174" width="20" height="24" rx="9" fill="#ef8fb0" />
      <rect x="124" y="174" width="20" height="24" rx="9" fill="#ef8fb0" />
      <ellipse cx="117" cy="136" rx="74" ry="56" fill={P.rose} />
      <ellipse cx="100" cy="112" rx="40" ry="22" fill="#ffc6d6" opacity="0.75" />
      <path d="M132 92 q4 -24 26 -22 q4 16 -8 30 z" fill="#f28fb0" />
      <path d="M94 90 q-10 -20 8 -28 q14 10 12 26 z" fill="#f7a6c0" />
      <ellipse cx="184" cy="140" rx="22" ry="18" fill="#f7a6c0" />
      <ellipse cx="179" cy="140" rx="3.6" ry="6" fill={P.roseDeep} />
      <ellipse cx="190" cy="140" rx="3.6" ry="6" fill={P.roseDeep} />
      {happy ? (
        <path d="M148 120 q6 -7 12 0" fill="none" stroke={P.ink} strokeWidth="4.5" strokeLinecap="round" />
      ) : (
        <>
          <circle cx="154" cy="120" r="6.5" fill={P.ink} />
          <circle cx="156.2" cy="117.8" r="2.2" fill={P.white} />
        </>
      )}
      <ellipse cx="146" cy="146" rx="10" ry="6" fill="#ff9fbd" opacity="0.8" />
      <rect x="96" y="83" width="40" height="9" rx="4.5" fill="#b8456f" />
    </g>
  );
}

export function BankRoom({ stars, waiting }: { stars: number; waiting: boolean }) {
  // More than ten: every full tray is put by in a jar on the shelf, and the tray shows what is left over.
  const whole = Math.max(stars, 0);
  const onTray = whole > 10 && whole % 10 === 0 ? 10 : whole > 10 ? whole % 10 : whole;
  const tens = (whole - onTray) / 10;
  return (
    <Room w={238} h={290} label={`The star bank. ${stars} ${stars === 1 ? 'star' : 'stars'}.`}>
      <rect width="238" height="290" fill={P.roseLight} />
      <g fill="#f9d0dc">
        <circle cx="32" cy="34" r="9" />
        <circle cx="206" cy="58" r="7" />
        <circle cx="26" cy="150" r="7" />
        <circle cx="212" cy="168" r="9" />
      </g>
      <Floor y={250} w={238} />
      <rect x="20" y="196" width="198" height="14" rx="7" fill={P.woodDeep} />
      <ellipse cx="119" cy="197" rx="72" ry="8" fill={P.ink} opacity="0.14" />
      <g className="house-hover">
        <Star x={119} y={46} s={2.1} />
      </g>
      <Piggy />
      {/* each jar on the high shelves is a full tray put by: ten stars */}
      {tens > 0 && (
        <>
          <rect x="12" y="72" width={Math.min(tens, 3) * 26 + 8} height="8" rx="4" fill={P.woodDeep} />
          {tens > 3 && (
            <rect
              x={226 - (Math.min(tens, 6) - 3) * 26 - 8}
              y="72"
              width={(Math.min(tens, 6) - 3) * 26 + 8}
              height="8"
              rx="4"
              fill={P.woodDeep}
            />
          )}
          {Array.from({ length: Math.min(tens, 6) }, (_, index) => (
            <g
              key={index}
              transform={`translate(${index < 3 ? 29 + index * 26 : 209 - (index - 3) * 26} 72)`}
            >
              <rect
                x="-10"
                y="-30"
                width="20"
                height="30"
                rx="6"
                fill={P.blueLight}
                stroke={P.blue}
                strokeWidth="2.5"
              />
              <rect x="-8" y="-36" width="16" height="8" rx="3" fill={P.woodDeep} />
              <Star x={0} y={-14} s={0.72} />
            </g>
          ))}
        </>
      )}
      <StarTray stars={onTray} x={59} y={233} cell={30} />
      {waiting && (
        <g transform="translate(206 222)">
          <circle r="16" fill={P.honey} stroke={P.paper} strokeWidth="3" />
          <path d="M-6 -8 h12 l-6 8 l6 8 h-12 l6 -8 z" fill={P.ink} />
        </g>
      )}
    </Room>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// TO BUY: the pantry and its basket
// ---------------------------------------------------------------------------------------------------------------------

export function PantryRoom({
  pictures,
  count,
  asked,
}: {
  pictures: ShoppingPictureId[];
  count: number;
  asked: boolean;
}) {
  const shown = pictures.slice(0, 3);
  return (
    <Room
      w={238}
      h={290}
      label={count === 0 ? 'The shopping basket. Nothing to buy.' : `The shopping basket. ${count} to buy.`}
    >
      <rect width="238" height="290" fill={P.tealLight} />
      <Floor y={250} w={238} />
      <rect x="18" y="66" width="202" height="12" rx="6" fill={P.woodDeep} />
      <rect x="18" y="140" width="202" height="12" rx="6" fill={P.woodDeep} />
      <g>
        <rect x="34" y="22" width="40" height="44" rx="10" fill={P.honeyLight} />
        <rect x="38" y="14" width="32" height="12" rx="5" fill={P.honeyDeep} />
        <rect x="40" y="36" width="28" height="16" rx="5" fill={P.cream} />
      </g>
      <g>
        <rect x="98" y="16" width="40" height="50" rx="10" fill="#f6a58f" />
        <rect x="102" y="8" width="32" height="12" rx="5" fill={P.cream} />
        <circle cx="118" cy="42" r="9" fill={P.redDeep} />
      </g>
      <g>
        <rect x="162" y="26" width="40" height="40" rx="10" fill="#a9d6f5" />
        <rect x="166" y="18" width="32" height="12" rx="5" fill={P.blueDeep} />
      </g>
      <g>
        <rect x="40" y="100" width="46" height="40" rx="8" fill={P.sage} />
        <rect x="40" y="110" width="46" height="14" fill={P.cream} />
      </g>
      <rect x="176" y="96" width="30" height="44" rx="8" fill={P.lav} />
      {/* the basket: what is in it is what is on the list */}
      <ellipse cx="119" cy="264" rx="88" ry="9" fill={P.ink} opacity="0.13" />
      <path d="M62 196 q57 -84 114 0" fill="none" stroke="#b47a35" strokeWidth="10" strokeLinecap="round" />
      {shown.map((picture, index) => (
        <Inset
          key={`${picture}-${index}`}
          art={SHOPPING_ART[picture]}
          x={50 + index * 46 - (shown.length - 1) * 4}
          y={136 + (index % 2) * 8}
          size={64}
        />
      ))}
      <path d="M40 196 h158 l-14 62 q-2 8 -12 8 h-106 q-10 0 -12 -8 z" fill="#d99c4f" />
      <g stroke="#b47a35" strokeWidth="5" strokeLinecap="round">
        <path d="M48 216 h142" />
        <path d="M52 234 h134" />
        <path d="M57 252 h124" />
      </g>
      <rect x="34" y="188" width="170" height="16" rx="8" fill="#e8b26a" />
      {asked && (
        <g transform="translate(204 180)">
          <circle r="16" fill={P.honey} stroke={P.paper} strokeWidth="3" />
          <path d="M-6 -8 h12 l-6 8 l6 8 h-12 l6 -8 z" fill={P.ink} />
        </g>
      )}
    </Room>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// MEMORIES: the photo wall
// ---------------------------------------------------------------------------------------------------------------------

export function MemoriesRoom({ photos }: { photos: string[] }) {
  const [first, second, third] = photos;
  return (
    <Room w={492} h={244} label="Family photos.">
      <rect width="492" height="244" fill={P.lavLight} />
      <rect y="150" width="492" height="94" fill="#e0d8f6" />
      <rect y="146" width="492" height="8" fill="#cfc5ee" />
      <Floor y={212} w={492} h={32} />
      <path d="M0 20 Q123 62 246 26 T492 22" fill="none" stroke="#8d7cc9" strokeWidth="4" />
      {[
        [50, 38],
        [120, 50],
        [190, 42],
        [262, 30],
        [336, 36],
        [410, 34],
        [462, 28],
      ].map(([cx, cy], index) => (
        <g key={index}>
          <circle cx={cx} cy={cy} r="20" fill={P.honeyLight} className="house-lamp" />
          <circle cx={cx} cy={cy} r="9" fill={P.honey} />
        </g>
      ))}
      <g transform="rotate(-2 140 130)">
        <rect x="42" y="72" width="196" height="126" rx="14" fill={P.woodDeep} />
        <clipPath id="frame-a">
          <rect x="56" y="86" width="168" height="98" rx="6" />
        </clipPath>
        {first ? (
          <image
            href={first}
            x="56"
            y="86"
            width="168"
            height="98"
            preserveAspectRatio="xMidYMid slice"
            clipPath="url(#frame-a)"
          />
        ) : (
          <g clipPath="url(#frame-a)">
            <rect x="56" y="86" width="168" height="98" fill="#bfe6fb" />
            <circle cx="190" cy="112" r="15" fill={P.honey} />
            <path d="M56 160 q40 -44 84 -8 q40 -30 84 4 v28 h-168 z" fill={P.sage} />
            <path d="M56 172 q60 -22 168 2 v10 h-168 z" fill={P.sageDeep} opacity="0.7" />
            <g fill={P.ink}>
              <circle cx="108" cy="150" r="9" />
              <rect x="100" y="158" width="16" height="22" rx="7" />
              <circle cx="132" cy="158" r="6.5" />
              <rect x="126" y="164" width="12" height="16" rx="5.5" />
            </g>
          </g>
        )}
      </g>
      <ellipse cx="318" cy="128" rx="52" ry="64" fill={P.terra} />
      <clipPath id="frame-b">
        <ellipse cx="318" cy="128" rx="40" ry="52" />
      </clipPath>
      {second ? (
        <image
          href={second}
          x="278"
          y="76"
          width="80"
          height="104"
          preserveAspectRatio="xMidYMid slice"
          clipPath="url(#frame-b)"
        />
      ) : (
        <g clipPath="url(#frame-b)">
          <rect x="278" y="76" width="80" height="104" fill="#fff0d8" />
          <path d="M286 180 q32 -44 64 0 z" fill={P.teal} />
          <circle cx="318" cy="112" r="20" fill={P.skin} />
          <path d="M298 108 q4 -22 20 -20 q18 -2 22 20 q-8 -12 -22 -12 q-12 0 -20 12" fill={P.woodDeep} />
          <circle cx="311" cy="112" r="3" fill={P.ink} />
          <circle cx="325" cy="112" r="3" fill={P.ink} />
          <path d="M310 121 q8 7 16 0" fill="none" stroke={P.ink} strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
      <g transform="rotate(4 432 122)">
        <rect x="392" y="82" width="80" height="84" rx="12" fill={P.sageDeep} />
        <clipPath id="frame-c">
          <rect x="402" y="92" width="60" height="64" rx="5" />
        </clipPath>
        {third ? (
          <image
            href={third}
            x="402"
            y="92"
            width="60"
            height="64"
            preserveAspectRatio="xMidYMid slice"
            clipPath="url(#frame-c)"
          />
        ) : (
          <g clipPath="url(#frame-c)">
            <rect x="402" y="92" width="60" height="64" fill={P.cream} />
            <ellipse cx="432" cy="116" rx="15" ry="18" fill={P.red} />
            <path d="M432 134 q-6 10 2 20" fill="none" stroke={P.ink} strokeWidth="3" strokeLinecap="round" />
          </g>
        )}
      </g>
    </Room>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// CALENDAR
// ---------------------------------------------------------------------------------------------------------------------

export function CalendarRoom({
  weekday,
  weekStart,
  labels,
}: {
  weekday: number;
  weekStart: 0 | 1;
  labels: DayPictureId[];
}) {
  const position = (weekday - weekStart + 7) % 7;
  const shown = labels.slice(0, 2);
  return (
    <Room
      w={492}
      h={244}
      label={shown.length > 0 ? 'The family calendar. Something is on today.' : 'The family calendar.'}
    >
      <rect width="492" height="244" fill="#fdf3dc" />
      <rect y="150" width="492" height="94" fill="#f8e7c0" />
      <rect y="146" width="492" height="8" fill="#eed59c" />
      <Floor y={212} w={492} h={32} />
      {/* the window: the same sky as outside */}
      <rect x="296" y="34" width="156" height="150" rx="18" fill={P.woodDeep} />
      <rect x="308" y="46" width="132" height="126" rx="8" className="house-window" />
      <g className="house-cloud">
        <ellipse cx="350" cy="92" rx="26" ry="13" />
        <ellipse cx="372" cy="84" rx="20" ry="14" />
        <ellipse cx="398" cy="96" rx="22" ry="11" />
      </g>
      <path d="M308 172 q40 -40 76 -14 q30 -22 56 2 v12 z" className="house-hill" />
      <rect x="370" y="46" width="8" height="126" fill="#a26b40" />
      <rect x="308" y="104" width="132" height="8" fill="#a26b40" />
      <path d="M296 40 q30 60 6 130 l-14 0 v-130 z" fill="#f6a58f" />
      <path d="M452 40 q-30 60 -6 130 l14 0 v-130 z" fill="#f6a58f" />
      <rect x="282" y="26" width="184" height="14" rx="7" fill={P.woodDeep} />
      {/* the wall calendar: this week as seven dots, today the big one, and today's pictures */}
      <rect x="54" y="30" width="186" height="174" rx="18" fill={P.paper} stroke="#e7cf9b" strokeWidth="4" />
      <path d="M54 76 v-28 a18 18 0 0 1 18 -18 h150 a18 18 0 0 1 18 18 v28 z" fill={P.terra} />
      <path
        d="M62 52 a14 14 0 0 1 14 -14 h60"
        fill="none"
        stroke={P.terraLight}
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.7"
      />
      <g fill={P.cream} stroke={P.woodDeep} strokeWidth="4">
        <rect x="92" y="18" width="14" height="30" rx="7" />
        <rect x="188" y="18" width="14" height="30" rx="7" />
      </g>
      {Array.from({ length: 7 }, (_, index) => {
        const cx = 75 + index * 24;
        return index === position ? (
          <circle key={index} cx={cx} cy={98} r={12} fill={P.honey} stroke={P.honeyDeep} strokeWidth="3" />
        ) : (
          <circle key={index} cx={cx} cy={98} r={6.5} fill={index < position ? '#d9cdb4' : '#eadfc8'} />
        );
      })}
      {shown.length === 0 ? (
        <g fill="#eadfc8">
          <rect x="84" y="128" width="126" height="12" rx="6" />
          <rect x="84" y="152" width="90" height="12" rx="6" />
        </g>
      ) : (
        shown.map((label, index) => (
          <Inset
            key={label}
            art={DAY_ART[label]}
            x={shown.length === 1 ? 110 : 76 + index * 78}
            y={116}
            size={74}
          />
        ))
      )}
    </Room>
  );
}
