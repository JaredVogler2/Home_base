/**
 * A second look at a mission a grown-up has written.
 *
 * HOMEBASE cannot know what is safe in a particular house for a particular child, and does not pretend to. It
 * does notice words that usually mean heat, blades, chemicals, heights, water or traffic, and asks the grown-up
 * to look again — and to switch on "with a grown-up" — before such a mission reaches a small child's board. The
 * decision stays the grown-up's.
 */

const HAZARDS: readonly (readonly [RegExp, string])[] = [
  [
    /\b(stove|oven|hob|cooker|grill|kettle|boil(?:ing)?|fry(?:ing)?|toaster|microwave|iron(?:ing)?)\b/i,
    'heat',
  ],
  [/\b(knife|knives|blade|razor|scissors|saw|axe|chop(?:ping)?|peeler|grater)\b/i, 'sharp things'],
  [
    /\b(bleach|chemical|detergent pods?|poison|pesticide|medicine|medication|pills?|tablets?|vitamins?)\b/i,
    'chemicals or medicine',
  ],
  [/\b(ladder|roof|gutter|climb(?:ing)?|window ledge|balcony)\b/i, 'heights'],
  [/\b(pool|pond|lake|river|bathe? (?:alone|the baby)|bath (?:alone|the baby))\b/i, 'water'],
  [
    /\b(road|street|traffic|car park|parking lot|drive(?:way)?|mow(?:ing|er)?|lawnmower)\b/i,
    'traffic or machines',
  ],
  [/\b(matches|lighter|candle|fire(?:place|pit)?|bonfire|fireworks?)\b/i, 'fire'],
  [/\b(drill|power tool|hammer|nails?|socket|plug in|electric(?:al|ity)?)\b/i, 'tools or electricity'],
  [
    /\b(baby ?sit|mind the baby|carry the baby|watch (?:your|the) (?:brother|sister|baby))\b/i,
    'looking after another child',
  ],
];

/** The kinds of hazard a mission's words suggest; empty when none do. */
export function hazardsIn(...words: (string | null | undefined)[]): string[] {
  const text = words.filter(Boolean).join(' ');
  const found = new Set<string>();
  for (const [pattern, kind] of HAZARDS) if (pattern.test(text)) found.add(kind);
  return [...found];
}

/**
 * A second look at a reward a grown-up has written.
 *
 * Some things a child should never have to earn: food, sleep, comfort, a grown-up's company. A reward whose
 * words sound like one of those gets a quiet note asking the grown-up to make sure it is an extra — a treat on
 * top, a little later than usual — and never the only way to have it. The decision stays the grown-up's.
 */
const NECESSITIES: readonly (readonly [RegExp, string])[] = [
  [
    /\b(dinner|supper|lunch|breakfast|meals?|food|snacks?|dessert|pudding|sweets?|candy|chocolate|ice ?cream|treats?)\b/i,
    'food',
  ],
  [/\b(sleep|bed ?time|naps?|rest|stay(?:ing)? up|late nights?)\b/i, 'sleep'],
  [/\b(hugs?|cuddles?|kiss(?:es)?|comfort)\b/i, 'comfort'],
  [
    /\b(time with (?:mum|mom|mam|dad|mummy|mommy|daddy|you|me|us|a grown-?up)|one[- ]on[- ]one|attention)\b/i,
    'time with you',
  ],
];

/** The needs a reward's words touch on; empty when none do. */
export function necessitiesIn(...words: (string | null | undefined)[]): string[] {
  const text = words.filter(Boolean).join(' ');
  const found = new Set<string>();
  for (const [pattern, kind] of NECESSITIES) if (pattern.test(text)) found.add(kind);
  return [...found];
}
