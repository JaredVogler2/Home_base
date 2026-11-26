import type { ShoppingCategory, ShoppingPictureId } from './pictures.js';

/**
 * Making sense of what somebody typed on a shopping list — without a model, on the phone and on the server alike.
 *
 * Three small jobs: fold two spellings of the same thing together ("Tomatoes" and "tomato"), pull a quantity
 * off the front ("2 milk"), and guess the aisle and the picture. All of it is a guess a grown-up can overrule,
 * and none of it ever replaces the words that were typed.
 */

const UNITS = new Set([
  'lb',
  'lbs',
  'kg',
  'g',
  'oz',
  'l',
  'ml',
  'pack',
  'packs',
  'box',
  'boxes',
  'bag',
  'bags',
  'bottle',
  'bottles',
  'can',
  'cans',
  'jar',
  'jars',
  'dozen',
  'bunch',
  'loaf',
  'loaves',
  'carton',
  'cartons',
  'tub',
  'tubs',
]);

function singular(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (/(?:oes|ses|xes|ches|shes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us')) return word.slice(0, -1);
  return word;
}

/** The form two entries are compared in. "Tomatoes!", " tomato " and "TOMATO" are the same thing to buy. */
export function normalizeItem(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((word) => word !== '')
    .map(singular)
    .join(' ');
}

export interface ParsedLine {
  text: string;
  quantity: number | null;
  unit: string | null;
}

/** "2 milk", "3 lbs apples", "eggs x12", "bananas" → what, how many, of what unit. */
export function parseLine(line: string): ParsedLine | null {
  let text = line
    .replace(/^\s*(?:[-*•·]|\[\s?[xX]?\s?\]|\d+[.)])\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text === '') return null;
  let quantity: number | null = null;
  let unit: string | null = null;

  const trailing = /^(.*\S)\s*[x×]\s*(\d{1,3})$/i.exec(text);
  const leading = /^(\d{1,3})\s*[x×]?\s+(.*)$/i.exec(text);
  if (trailing?.[1] && trailing[2]) {
    quantity = Number(trailing[2]);
    text = trailing[1];
  } else if (leading?.[1] && leading[2]) {
    quantity = Number(leading[1]);
    text = leading[2];
    const [first, ...rest] = text.split(' ');
    if (first && rest.length > 0 && UNITS.has(first.toLowerCase())) {
      unit = first.toLowerCase();
      text = rest.join(' ').replace(/^of\s+/i, '');
    }
  }
  if (quantity !== null && (quantity < 1 || quantity > 999)) quantity = null;
  text = text.slice(0, 120).trim();
  return text === '' ? null : { text, quantity, unit };
}

/** A pasted note, a dictated sentence, a list from a message: one thing per line (or per comma on one line). */
export function parseLines(input: string, max = 40): ParsedLine[] {
  const lines = input.includes('\n') ? input.split(/\r?\n/) : input.split(/,|;|\band\b/i);
  const out: ParsedLine[] = [];
  for (const line of lines) {
    const parsed = parseLine(line);
    if (parsed) out.push(parsed);
    if (out.length >= max) break;
  }
  return out;
}

interface Guess {
  picture: ShoppingPictureId;
  category: ShoppingCategory;
}

/** Words to look for, most particular first. The first that is found decides. */
const LEXICON: readonly [words: readonly string[], guess: Guess][] = [
  [
    ['dog food', 'cat food', 'pet food', 'kibble', 'bird seed', 'fish food'],
    { picture: 'petfood', category: 'pets' },
  ],
  [['cat litter', 'litter', 'dog treat', 'pet'], { picture: 'pets', category: 'pets' }],
  [
    ['toilet paper', 'toilet roll', 'loo roll', 'paper towel', 'tissue', 'kitchen roll'],
    { picture: 'paper', category: 'household' },
  ],
  [['toothpaste', 'toothbrush', 'floss', 'mouthwash'], { picture: 'toothpaste', category: 'household' }],
  [['diaper', 'nappy', 'nappie', 'pull up'], { picture: 'diapers', category: 'baby' }],
  [['wipe'], { picture: 'wipes', category: 'baby' }],
  [['formula', 'baby food', 'pacifier', 'baby'], { picture: 'baby', category: 'baby' }],
  [
    ['soap', 'shampoo', 'conditioner', 'body wash', 'hand wash', 'detergent', 'dish soap'],
    { picture: 'soap', category: 'household' },
  ],
  [
    [
      'sponge',
      'trash bag',
      'bin bag',
      'bin liner',
      'foil',
      'cling',
      'battery',
      'bulb',
      'cleaner',
      'bleach',
      'laundry',
      'sunscreen',
      'bandage',
      'plaster',
    ],
    { picture: 'household', category: 'household' },
  ],
  [
    ['ice cream', 'frozen', 'popsicle', 'ice lolly', 'fish finger', 'fish stick', 'waffle'],
    { picture: 'frozen', category: 'frozen' },
  ],
  [['juice', 'smoothie'], { picture: 'juice', category: 'drinks' }],
  [['water', 'seltzer', 'sparkling'], { picture: 'water', category: 'drinks' }],
  [
    ['coffee', 'tea', 'soda', 'cola', 'lemonade', 'squash', 'beer', 'wine', 'drink'],
    { picture: 'drinks', category: 'drinks' },
  ],
  [['milk', 'oat milk', 'almond milk', 'soy milk'], { picture: 'milk', category: 'dairy' }],
  [['yogurt', 'yoghurt', 'kefir'], { picture: 'yogurt', category: 'dairy' }],
  [['cheese', 'cheddar', 'mozzarella', 'parmesan', 'feta'], { picture: 'cheese', category: 'dairy' }],
  [['butter', 'margarine'], { picture: 'butter', category: 'dairy' }],
  [['egg'], { picture: 'eggs', category: 'dairy' }],
  [['cream', 'sour cream', 'creme fraiche'], { picture: 'dairy', category: 'dairy' }],
  [
    ['bread', 'bagel', 'bun', 'roll', 'baguette', 'toast', 'pita', 'tortilla', 'wrap', 'muffin', 'croissant'],
    { picture: 'bread', category: 'bakery' },
  ],
  [['cake', 'pastry', 'donut', 'doughnut', 'pie'], { picture: 'bakery', category: 'bakery' }],
  [['apple'], { picture: 'apple', category: 'produce' }],
  [['banana'], { picture: 'banana', category: 'produce' }],
  [
    ['berry', 'strawberry', 'blueberry', 'raspberry', 'blackberry', 'grape', 'cherry'],
    { picture: 'berries', category: 'produce' },
  ],
  [['carrot'], { picture: 'carrot', category: 'produce' }],
  [['tomato'], { picture: 'tomato', category: 'produce' }],
  [['potato', 'sweet potato'], { picture: 'potato', category: 'produce' }],
  [
    [
      'lettuce',
      'spinach',
      'kale',
      'salad',
      'onion',
      'garlic',
      'pepper',
      'cucumber',
      'orange',
      'lemon',
      'lime',
      'avocado',
      'broccoli',
      'cauliflower',
      'zucchini',
      'courgette',
      'mushroom',
      'pea',
      'bean sprout',
      'corn',
      'celery',
      'pear',
      'peach',
      'plum',
      'melon',
      'mango',
      'pineapple',
      'kiwi',
      'herb',
      'basil',
      'cilantro',
      'parsley',
      'ginger',
      'fruit',
      'vegetable',
      'veg',
      'squash',
      'pumpkin',
      'cabbage',
      'leek',
      'beet',
    ],
    { picture: 'produce', category: 'produce' },
  ],
  [['chicken', 'turkey'], { picture: 'chicken', category: 'meat' }],
  [['fish', 'salmon', 'tuna', 'cod', 'shrimp', 'prawn'], { picture: 'fish', category: 'meat' }],
  [
    [
      'beef',
      'pork',
      'lamb',
      'sausage',
      'bacon',
      'ham',
      'mince',
      'steak',
      'meatball',
      'burger',
      'hot dog',
      'salami',
      'tofu',
    ],
    { picture: 'meat', category: 'meat' },
  ],
  [['cereal', 'oatmeal', 'oat', 'granola', 'porridge', 'muesli'], { picture: 'cereal', category: 'pantry' }],
  [
    ['pasta', 'spaghetti', 'noodle', 'macaroni', 'penne', 'lasagna', 'lasagne'],
    { picture: 'pasta', category: 'pantry' },
  ],
  [['rice', 'quinoa', 'couscous'], { picture: 'rice', category: 'pantry' }],
  [
    [
      'cracker',
      'cookie',
      'biscuit',
      'chip',
      'crisp',
      'pretzel',
      'popcorn',
      'snack',
      'granola bar',
      'raisin',
      'nut',
    ],
    { picture: 'crackers', category: 'pantry' },
  ],
  [
    [
      'flour',
      'sugar',
      'salt',
      'oil',
      'vinegar',
      'bean',
      'lentil',
      'sauce',
      'ketchup',
      'mustard',
      'mayo',
      'soup',
      'stock',
      'broth',
      'honey',
      'jam',
      'peanut butter',
      'spice',
      'cinnamon',
      'yeast',
      'baking',
      'chocolate',
      'syrup',
      'tin',
      'canned',
    ],
    { picture: 'pantry', category: 'pantry' },
  ],
];

/** The aisle and the picture for something to buy; "something else" where nothing fits. */
export function classifyItem(text: string): Guess {
  const normalized = ` ${normalizeItem(text)} `;
  for (const [words, guess] of LEXICON) {
    for (const word of words) {
      if (normalized.includes(` ${normalizeItem(word)} `)) return guess;
    }
  }
  return { picture: 'other', category: 'other' };
}

/** How an item reads on a list: "Milk", "2 × milk", "3 lbs apples". */
export function describeItem(item: { text: string; quantity: number | null; unit: string | null }): string {
  if (item.quantity === null) return item.text;
  return item.unit ? `${item.quantity} ${item.unit} ${item.text}` : `${item.quantity} × ${item.text}`;
}

/** A list as plain text, for pasting into a note or a message. */
export function listAsText(
  name: string,
  items: readonly {
    text: string;
    quantity: number | null;
    unit: string | null;
    status: string;
    note: string | null;
  }[],
): string {
  const lines = items
    .filter((item) => item.status === 'needed')
    .map((item) => `- ${describeItem(item)}${item.note ? ` (${item.note})` : ''}`);
  return [`${name}`, ...lines].join('\n');
}
