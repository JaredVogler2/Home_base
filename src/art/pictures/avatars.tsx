import type { AvatarId } from '../../../shared/pictures';
import { P } from '../palette';
import type { Art } from './kit';

/**
 * Who is who. Twelve animals, one for each person to be.
 *
 * A child who cannot read finds their own face on the wall and taps it, so each animal is told from the others
 * by its outline — tall ears, tufts, a spout, a shell — and never by its colour alone. They are one family all
 * the same: every one has the same eyes on the same line, the same small smile, the same rose cheeks, and the
 * light comes from the upper left on all of them. They are drawn still; the badge around them is what moves.
 *
 * The badge is round, so every drawing keeps inside the circle that fits the square (46 from the middle at
 * most), not only inside the square.
 */

/** The eye line, and half the gap between the eyes: the same on every face whose anatomy allows it. */
const EYE_Y = 60;
const EYE_GAP = 14;

/** Two ink ovals with a glint. Every animal looks out of the same eyes. */
function Eyes({ x = 50, y = EYE_Y, gap = EYE_GAP }: { x?: number; y?: number; gap?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx={-gap} cy="0" rx="2.7" ry="3.3" fill={P.ink} />
      <ellipse cx={gap} cy="0" rx="2.7" ry="3.3" fill={P.ink} />
      <circle cx={-gap - 0.8} cy="-1.2" r="1.1" fill={P.white} />
      <circle cx={gap - 0.8} cy="-1.2" r="1.1" fill={P.white} />
    </g>
  );
}

/** The small smile. */
function Smile({ x = 50, y }: { x?: number; y: number }) {
  return (
    <path
      transform={`translate(${x} ${y})`}
      d="M-4.2 0 Q0 3.8 4.2 0"
      fill="none"
      stroke={P.ink}
      strokeWidth="2.4"
      strokeLinecap="round"
    />
  );
}

/** A soft nose with the little line down to the same small smile, for every animal that has a muzzle. */
function Snout({ y, s = 1, fill = P.ink }: { y: number; s?: number; fill?: string }) {
  return (
    <g transform={`translate(50 ${y})`}>
      <path
        d="M0 2 V8.4 M-4.2 6.6 Q0 10.4 4.2 6.6"
        fill="none"
        stroke={P.ink}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        transform={`scale(${s})`}
        d="M0 -3.4 C2.8 -3.4 5.2 -2.6 5.2 -0.8 C5.2 1.2 2.2 3.6 0 3.6 C-2.2 3.6 -5.2 1.2 -5.2 -0.8 C-5.2 -2.6 -2.8 -3.4 0 -3.4 Z"
        fill={fill}
      />
    </g>
  );
}

/** Two rose cheeks. */
function Cheeks({
  x = 50,
  y = 68,
  gap = 23,
  s = 1,
  o = 0.65,
}: {
  x?: number;
  y?: number;
  gap?: number;
  s?: number;
  o?: number;
}) {
  return (
    <g transform={`translate(${x} ${y})`} fill={P.rose} opacity={o}>
      <ellipse cx={-gap} cy="0" rx={4.8 * s} ry={3.1 * s} />
      <ellipse cx={gap} cy="0" rx={4.8 * s} ry={3.1 * s} />
    </g>
  );
}

/** Where the light catches: one soft stroke on the upper left. */
function Shine({ d, stroke, w = 3.4, o = 0.65 }: { d: string; stroke: string; w?: number; o?: number }) {
  return <path d={d} fill="none" stroke={stroke} strokeWidth={w} strokeLinecap="round" opacity={o} />;
}

/** The beak both birds share: a small honey shield with the line of a smile across it. */
function Beak() {
  return (
    <>
      <path
        d="M44.5 65.5 Q50 62.5 55.5 65.5 Q55 71.5 50 75 Q45 71.5 44.5 65.5 Z"
        fill={P.honey}
        stroke={P.honey}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M45.6 68.4 Q50 70.8 54.4 68.4"
        fill="none"
        stroke={P.honeyDeep}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </>
  );
}

/* Fox: the tallest pointed ears in the family, cheek tufts out to the sides, a narrow chin. */
const fox: Art = () => (
  <>
    <path
      d="M21.5 52 C20.5 40 21.5 25 24.5 16.5 Q25.5 13 29 15 C36 20 43 28.5 48 39 Z M78.5 52 C79.5 40 78.5 25 75.5 16.5 Q74.5 13 71 15 C64 20 57 28.5 52 39 Z"
      fill={P.terra}
      stroke={P.terra}
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <path
      d="M26 50 C25 38 25.5 29 27.5 22.5 C33 26.5 39 33 43.5 41 Z M74 50 C75 38 74.5 29 72.5 22.5 C67 26.5 61 33 56.5 41 Z"
      fill={P.terraDeep}
      stroke={P.terraDeep}
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path
      d="M11.5 61 C20 55 28 34.5 50 34.5 C72 34.5 80 55 88.5 61 C80 67 70 88 50 89.5 C30 88 20 67 11.5 61 Z"
      fill={P.terra}
      stroke={P.terra}
      strokeWidth="5"
      strokeLinejoin="round"
    />
    <path
      d="M11.5 61 C21 63.5 33 63.5 41 70 Q46 74 50 74 Q54 74 59 70 C67 63.5 79 63.5 88.5 61 C80 67 70 88 50 89.5 C30 88 20 67 11.5 61 Z"
      fill={P.cream}
    />
    <Shine d="M24 56 Q29 46.5 40 42.5" stroke={P.terraLight} />
    <Cheeks y={71.5} gap={20.5} />
    <Eyes />
    <Snout y={72} />
  </>
);

/* Bunny: two long upright ears, nothing else like them. */
const bunny: Art = () => (
  <>
    <g fill={P.lavLight} stroke={P.lav} strokeWidth="2.4">
      <rect x="28" y="9.5" width="16" height="52" rx="8" transform="rotate(-4 36 56)" />
      <rect x="56" y="9.5" width="16" height="52" rx="8" transform="rotate(4 64 56)" />
    </g>
    <rect x="32.7" y="17" width="6.6" height="29" rx="3.3" transform="rotate(-4 36 56)" fill={P.rose} />
    <rect x="60.7" y="17" width="6.6" height="29" rx="3.3" transform="rotate(4 64 56)" fill={P.rose} />
    <ellipse cx="50" cy="64.5" rx="33" ry="27.5" fill={P.lavLight} stroke={P.lav} strokeWidth="2.4" />
    <ellipse cx="50" cy="72.5" rx="12.5" ry="8.5" fill={P.white} />
    <Shine d="M25.5 57 Q29.5 48 40 44" stroke={P.white} o={0.9} />
    <Cheeks y={69.5} />
    <Eyes />
    <Snout y={67} s={0.75} fill={P.rose} />
  </>
);

/* Bear: a round head with two small round ears on top. */
const bear: Art = () => (
  <>
    <circle cx="26" cy="28.5" r="9" fill={P.wood} />
    <circle cx="74" cy="28.5" r="9" fill={P.wood} />
    <circle cx="26.3" cy="29" r="4.6" fill={P.woodLight} />
    <circle cx="73.7" cy="29" r="4.6" fill={P.woodLight} />
    <ellipse cx="50" cy="59.5" rx="35.5" ry="32.5" fill={P.wood} />
    <path d="M85.4 62.3 A35.5 32.5 0 0 1 37.9 90 A44 42 0 0 0 85.4 62.3 Z" fill={P.woodDeep} opacity="0.35" />
    <ellipse cx="50" cy="71.5" rx="15.5" ry="11.5" fill={P.creamShade} />
    <Shine d="M21.5 52 Q25.5 40 38 34.5" stroke={P.woodLight} />
    <Cheeks y={68.5} gap={24.5} />
    <Eyes />
    <Snout y={66.5} />
  </>
);

/* Owl: ear tufts at the corners, two round eye discs, a beak. */
const owl: Art = () => (
  <>
    <path
      d="M50 28.5 C41 28.5 30 25.5 22 17 C20 25 16.5 33 15 44 C13.5 54 13.5 66 19 76 C25 86.5 37 91 50 91 C63 91 75 86.5 81 76 C86.5 66 86.5 54 85 44 C83.5 33 80 25 78 17 C70 25.5 59 28.5 50 28.5 Z"
      fill={P.woodDeep}
      stroke={P.woodDeep}
      strokeWidth="4"
      strokeLinejoin="round"
    />
    <ellipse cx="50" cy="80" rx="18" ry="9.5" fill={P.wood} />
    <g fill={P.woodLight}>
      <circle cx="42" cy="82" r="1.3" />
      <circle cx="46" cy="85.5" r="1.3" />
      <circle cx="50" cy="82" r="1.3" />
      <circle cx="54" cy="85.5" r="1.3" />
      <circle cx="58" cy="82" r="1.3" />
    </g>
    <circle cx="34" cy="58" r="18.5" fill={P.woodLight} />
    <circle cx="66" cy="58" r="18.5" fill={P.woodLight} />
    <circle cx="34" cy="58" r="15.5" fill={P.cream} />
    <circle cx="66" cy="58" r="15.5" fill={P.cream} />
    <Shine d="M19 42 Q20 33.5 23.5 27" stroke={P.wood} o={0.8} />
    <Cheeks y={68} gap={24.5} />
    <Eyes />
    <Beak />
  </>
);

/* Cat: short triangle ears set wide apart, a round head, whiskers out past the cheeks. */
const cat: Art = () => (
  <>
    <path
      d="M19 50 C17 40 18.5 31 22 23.5 C29.5 26 36.5 30.5 42.5 37 Z M81 50 C83 40 81.5 31 78 23.5 C70.5 26 63.5 30.5 57.5 37 Z"
      fill={P.honey}
      stroke={P.honey}
      strokeWidth="4"
      strokeLinejoin="round"
    />
    <path
      d="M23.5 46 C22.8 39.5 23.5 34 25.5 29.5 C30 31.8 34 35 37.5 39.5 Z M76.5 46 C77.2 39.5 76.5 34 74.5 29.5 C70 31.8 66 35 62.5 39.5 Z"
      fill={P.rose}
      stroke={P.rose}
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <ellipse cx="50" cy="61" rx="34.5" ry="29" fill={P.honey} />
    <path
      d="M84.4 63.5 A34.5 29 0 0 1 38.2 88.3 A43 38 0 0 0 84.4 63.5 Z"
      fill={P.honeyDeep}
      opacity="0.35"
    />
    <path
      d="M50 33.5 V41.5 M41.5 35 L43 42 M58.5 35 L57 42"
      fill="none"
      stroke={P.honeyDeep}
      strokeWidth="3.4"
      strokeLinecap="round"
    />
    <ellipse cx="50" cy="71.5" rx="12" ry="8.5" fill={P.cream} />
    <Shine d="M22 53 Q26 43 36 38" stroke={P.honeyLight} o={0.9} />
    <path
      d="M22 66.5 L8 63.5 M22 71 L12.5 73.5 M78 66.5 L92 63.5 M78 71 L87.5 73.5"
      fill="none"
      stroke={P.inkSoft}
      strokeWidth="2.4"
      strokeLinecap="round"
    />
    <Cheeks y={68.5} gap={22} />
    <Eyes />
    <Snout y={66.5} s={0.75} fill={P.roseDeep} />
  </>
);

/* Frog: two eye bumps on top of a wide flat head, and a wide mouth. */
const frog: Art = () => (
  <>
    <circle cx="32" cy="36.5" r="15.5" fill={P.sage} />
    <circle cx="68" cy="36.5" r="15.5" fill={P.sage} />
    <ellipse cx="50" cy="65" rx="40.5" ry="24.5" fill={P.sage} />
    <path d="M90.3 67.1 A40.5 24.5 0 0 1 36.2 88 A52 34 0 0 0 90.3 67.1 Z" fill={P.sageDeep} opacity="0.3" />
    <circle cx="32" cy="36.5" r="9.5" fill={P.sageLight} />
    <circle cx="68" cy="36.5" r="9.5" fill={P.sageLight} />
    <Shine d="M13.5 62 Q15.5 53.5 22.5 49.5" stroke={P.sageLight} />
    <circle cx="46" cy="57.5" r="1.3" fill={P.sageDeep} />
    <circle cx="54" cy="57.5" r="1.3" fill={P.sageDeep} />
    <circle cx="79.5" cy="55.5" r="2.4" fill={P.sageDeep} opacity="0.45" />
    <circle cx="84" cy="61.5" r="1.7" fill={P.sageDeep} opacity="0.45" />
    <Cheeks y={67.5} gap={29.5} o={0.8} />
    <Eyes y={37} gap={18} />
    <path d="M30 69.5 Q50 81.5 70 69.5" fill="none" stroke={P.ink} strokeWidth="2.6" strokeLinecap="round" />
  </>
);

/* Hedgehog: a crown of soft spikes all round the top, and a small pointed face poking out below. */
const hedgehog: Art = () => (
  <>
    <path
      d="M23.9 69.7 Q16.2 69.7 11 68.2 Q14 63.7 19.9 58.8 Q12.7 55.9 8.5 52.6 Q13 49.5 20.3 47.1 Q14.7 41.8 12.1 37.1 Q17.3 35.9 25 36.5 Q21.9 29.5 21.2 24.1 Q26.5 25 33.4 28.4 Q33.1 20.7 34.5 15.5 Q39.1 18.3 44.2 24.1 Q46.8 16.8 50 12.5 Q53.2 16.8 55.8 24.1 Q60.9 18.3 65.5 15.5 Q66.9 20.7 66.6 28.4 Q73.5 25 78.8 24.1 Q78.1 29.5 75 36.5 Q82.7 35.9 87.9 37.1 Q85.3 41.8 79.7 47.1 Q87 49.5 91.5 52.6 Q87.3 55.9 80.1 58.8 Q86 63.7 89 68.2 Q83.8 69.7 76.1 69.7 Z"
      fill={P.woodDeep}
      stroke={P.woodDeep}
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <path
      d="M26.5 62.6 Q20.9 61.2 17.4 59.2 Q20.1 56.1 25 53.1 Q20.3 49.8 17.8 46.6 Q21.5 44.8 27.2 43.8 Q24.1 39 23 35.1 Q27 34.8 32.6 36 Q31.6 30.4 32 26.3 Q35.9 27.6 40.6 30.8 Q41.8 25.2 43.7 21.6 Q46.8 24.2 50 29 Q53.2 24.2 56.3 21.6 Q58.2 25.2 59.4 30.8 Q64.1 27.6 68 26.3 Q68.4 30.4 67.4 36 Q73 34.8 77 35.1 Q75.9 39 72.8 43.8 Q78.5 44.8 82.2 46.6 Q79.7 49.8 75 53.1 Q79.9 56.1 82.6 59.2 Q79.1 61.2 73.5 62.6 Z"
      fill={P.wood}
      stroke={P.wood}
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path
      d="M50 45 C46.5 40.5 38 39.5 32.5 43.5 C26 48 23.5 56 25 64 C26.5 72 33 77 37 83 C40 88 45 91.5 50 91.5 C55 91.5 60 88 63 83 C67 77 73.5 72 75 64 C76.5 56 74 48 67.5 43.5 C62 39.5 53.5 40.5 50 45 Z"
      fill={P.woodLight}
    />
    <circle cx="25" cy="52" r="4.6" fill={P.woodLight} />
    <circle cx="75" cy="52" r="4.6" fill={P.woodLight} />
    <circle cx="25" cy="52" r="2.2" fill={P.wood} />
    <circle cx="75" cy="52" r="2.2" fill={P.wood} />
    <ellipse cx="50" cy="81" rx="9.5" ry="7.8" fill={P.cream} />
    <Cheeks y={69} gap={17.5} s={0.85} />
    <Eyes />
    <Snout y={76.5} s={1.1} />
  </>
);

/* Otter: a wide flat head, tiny ears low on the sides, a big pale muzzle with a big nose and whiskers. */
const otter: Art = () => (
  <>
    <circle cx="12.5" cy="50" r="4.8" fill={P.woodDeep} />
    <circle cx="87.5" cy="50" r="4.8" fill={P.woodDeep} />
    <circle cx="12.5" cy="50" r="2.2" fill={P.ink} opacity="0.3" />
    <circle cx="87.5" cy="50" r="2.2" fill={P.ink} opacity="0.3" />
    <path
      d="M50 30 C65 30 78 32.5 84 42.5 C88.5 50 90.5 59 89 67 C86.5 80 73 89.5 50 89.5 C27 89.5 13.5 80 11 67 C9.5 59 11.5 50 16 42.5 C22 32.5 35 30 50 30 Z"
      fill={P.woodDeep}
    />
    <path
      d="M24 72.5 L10.5 69.8 M25 78 L17 79.5 M76 72.5 L89.5 69.8 M75 78 L83 79.5"
      fill="none"
      stroke={P.woodLight}
      strokeWidth="2.4"
      strokeLinecap="round"
    />
    <path
      d="M50 67.5 C44 63 32 63.5 25.5 69 C19.5 74 21.5 81.5 29 84.5 C36 87 43 87 50 87 C57 87 64 87 71 84.5 C78.5 81.5 80.5 74 74.5 69 C68 63.5 56 63 50 67.5 Z"
      fill={P.cream}
    />
    <Shine d="M18.5 52 Q22 40.5 36.5 34.5" stroke={P.wood} o={0.8} />
    <g fill={P.wood}>
      <circle cx="37.5" cy="79" r="1.3" />
      <circle cx="33.5" cy="81.5" r="1.3" />
      <circle cx="40.5" cy="83" r="1.3" />
      <circle cx="62.5" cy="79" r="1.3" />
      <circle cx="66.5" cy="81.5" r="1.3" />
      <circle cx="59.5" cy="83" r="1.3" />
    </g>
    <Cheeks y={73} gap={18.5} s={0.85} />
    <Eyes />
    <Snout y={69.5} s={1.3} />
  </>
);

/* Panda: big round dark ears, a wide white face, a dark patch round each eye. */
const panda: Art = () => (
  <>
    <ellipse cx="50" cy="61" rx="39.5" ry="31.5" fill={P.inkSoft} opacity="0.5" />
    <circle cx="22" cy="31.5" r="12" fill={P.ink} />
    <circle cx="78" cy="31.5" r="12" fill={P.ink} />
    <ellipse cx="50" cy="61" rx="37.1" ry="29.1" fill={P.white} />
    <path d="M87 63.5 A37.1 29.1 0 0 1 37.3 88.3 A46 39 0 0 0 87 63.5 Z" fill={P.lavLight} />
    <ellipse cx="34.5" cy="61.5" rx="8.6" ry="10.4" transform="rotate(20 34.5 61.5)" fill={P.inkSoft} />
    <ellipse cx="65.5" cy="61.5" rx="8.6" ry="10.4" transform="rotate(-20 65.5 61.5)" fill={P.inkSoft} />
    <Cheeks y={74} gap={24} />
    <Eyes />
    <Snout y={69} s={0.9} />
  </>
);

/* Whale: the whole animal is the face. A spout on top, a tail fluke curling up behind. */
const whale: Art = () => (
  <>
    <path
      d="M31 37 C31 27 28 21 23 21 C19.5 21 18 24 18 27 M31 37 C31 27 34 21 39 21 C42.5 21 44 24 44 27"
      fill="none"
      stroke={P.teal}
      strokeWidth="3.4"
      strokeLinecap="round"
    />
    <circle cx="31" cy="15" r="2.2" fill={P.teal} />
    <path
      d="M69.5 32 C64 30 59 24 58.5 15.5 C63.5 15.5 67.5 18.5 69 22.5 C71 18.5 75 16.5 79.5 17.5 C79 25 75 30.5 69.5 32 Z"
      fill={P.blue}
      stroke={P.blue}
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <path
      d="M12.5 63 C12.5 47 26 37.5 44 37.5 C53 37.5 60 40 65.5 44 C66.5 40 66.5 35.5 65.5 31 L74 29.5 C77.5 38 80.5 50 78.5 63 C75.5 78.5 61.5 88 44 88 C26 88 12.5 79.5 12.5 63 Z"
      fill={P.blue}
      stroke={P.blue}
      strokeWidth="5"
      strokeLinejoin="round"
    />
    <path
      d="M14.5 71.5 C26 78.5 58 79.5 78 65.5 C74.5 79 61 88 44 88 C28.5 88 17.5 81.5 14.5 71.5 Z"
      fill={P.blueLight}
    />
    <path
      d="M60 74 C64 75 68.5 78.5 70 84 C65.5 84.5 61.5 82 59.5 78 Z"
      fill={P.blueDeep}
      stroke={P.blueDeep}
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <Shine d="M18 55 Q22 45 33.5 42" stroke={P.blueLight} />
    <Cheeks x={44} y={68} gap={22} o={0.8} />
    <Eyes x={44} />
    <Smile x={44} y={68.5} />
  </>
);

/* Penguin: a smooth egg with nothing on top, a white face, a beak. */
const penguin: Art = () => (
  <>
    <path
      d="M50 14 C70 14 84 34 84 58 C84 80 70 93 50 93 C30 93 16 80 16 58 C16 34 30 14 50 14 Z"
      fill={P.night}
    />
    <path
      d="M50 42 C46 35 37 33 31 37 C23 42 21 54 23 64 C26 78 37 88.5 50 88.5 C63 88.5 74 78 77 64 C79 54 77 42 69 37 C63 33 54 35 50 42 Z"
      fill={P.white}
    />
    <path d="M75.5 71 C71 81.5 61.5 88.5 50 88.5 C60.5 85.5 68.5 79.5 72.5 71 Z" fill={P.lavLight} />
    <Shine d="M22.5 46 Q25 30.5 38 21.5" stroke={P.lavDeep} o={0.6} />
    <Cheeks y={68.5} gap={20.5} />
    <Eyes />
    <Beak />
  </>
);

/* Turtle: a domed shell, and the head poking out of the front of it to look at you. */
const turtle: Art = () => (
  <>
    <path
      d="M15 71 C11.5 71.5 9.3 69.2 9.7 65.5 C12.5 65.5 15.5 67 17.5 69.5 Z"
      fill={P.sage}
      stroke={P.sage}
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <rect x="19" y="70" width="13" height="17" rx="6" fill={P.sage} />
    <rect x="42" y="70" width="13" height="17" rx="6" fill={P.sage} />
    <path d="M13 72 C13 45 23.5 24 41 24 C58.5 24 69 45 69 72 Z" fill={P.sageDeep} />
    <path d="M28 44.5 L36.5 40 L45 44.5 V54 L36.5 58.5 L28 54 Z" fill={P.sage} opacity="0.4" />
    <path
      d="M28 44.5 L36.5 40 L45 44.5 V54 L36.5 58.5 L28 54 Z M36.5 40 V30 M28 44.5 L20.5 39 M45 44.5 L52 39.5 M28 54 L18.5 59 M36.5 58.5 V66 M45 54 L52 58"
      fill="none"
      stroke={P.sage}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect x="11" y="67" width="60" height="8.5" rx="4.25" fill={P.sage} />
    <circle cx="71.5" cy="57.5" r="19.5" fill={P.sage} />
    <Shine d="M57 51 Q59.5 44 67 41" stroke={P.sageLight} w={3.2} o={0.8} />
    <Cheeks x={71.5} y={66.5} gap={12.5} s={0.75} o={0.8} />
    <Eyes x={71.5} gap={8.5} />
    <Smile x={71.5} y={66} />
  </>
);

export const AVATAR_FACES: Partial<Record<AvatarId, Art>> = {
  fox,
  bunny,
  bear,
  owl,
  cat,
  frog,
  hedgehog,
  otter,
  panda,
  whale,
  penguin,
  turtle,
};
