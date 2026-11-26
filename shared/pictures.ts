/**
 * The picture registry: every drawing a household can attach to a mission, a routine step, a reward, a shopping
 * item or a calendar day. A picture is named here once; the art for each name lives with the client
 * (src/art/pictures), and a test fails if a name here has no drawing or a drawing has no name.
 *
 * `say` is what the guide says aloud, and what a screen reader reads, when nothing more specific was written.
 * It is short on purpose: a child hears it many times.
 */

export interface PictureInfo {
  /** A grown-up's name for it, in pickers. */
  label: string;
  /** What is said aloud for it. */
  say: string;
}

const pic = (label: string, say: string): PictureInfo => ({ label, say });

/** Things to do: missions and the steps of routines. Each drawing shows the action, not a symbol for it. */
export const ACTION_PICTURES = {
  blocks: pic('Blocks away', 'Put the blocks away.'),
  toys: pic('Toys in the box', 'Put the toys in the box.'),
  shoes: pic('Shoes in the basket', 'Shoes go in the basket.'),
  table: pic('Set the table', 'Help set the table.'),
  toothbrush: pic('Brush teeth', 'Time to brush teeth.'),
  laundry: pic('Laundry', 'Bring the laundry.'),
  bed: pic('Make the bed', 'Make the bed.'),
  books: pic('Books on the shelf', 'Put the books back.'),
  hands: pic('Wash hands', 'Wash your hands.'),
  dress: pic('Get dressed', 'Time to get dressed.'),
  socks: pic('Socks on', 'Socks on.'),
  pajamas: pic('Pajamas', 'Pajamas on.'),
  bath: pic('Bath', 'Bath time.'),
  hair: pic('Brush hair', 'Brush your hair.'),
  potty: pic('Potty', 'Try the potty.'),
  story: pic('Story', 'Story time.'),
  lightsout: pic('Lights out', 'Lights out. Good night.'),
  wake: pic('Wake up', 'Good morning!'),
  breakfast: pic('Breakfast', 'Breakfast time.'),
  backpack: pic('Backpack', 'Get your backpack.'),
  lunchbox: pic('Lunch box', 'Pack the lunch box.'),
  bottle: pic('Water bottle', 'Fill the water bottle.'),
  coat: pic('Coat', 'Coat on.'),
  hat: pic('Sun hat', 'Hat on.'),
  umbrella: pic('Rain gear', 'Rain gear today.'),
  car: pic('To the car', 'Off we go.'),
  cup: pic('Cup to the sink', 'Take your cup to the sink.'),
  dishes: pic('Dishes', 'Help with the dishes.'),
  wipe: pic('Wipe the table', 'Wipe the table.'),
  sweep: pic('Sweep', 'Sweep the floor.'),
  bins: pic('Bins', 'Help with the bins.'),
  plant: pic('Water the plant', 'Water the plant.'),
  pet: pic('Feed the pet', 'Feed the pet.'),
  snack: pic('Snack', 'Snack time.'),
  music: pic('Music', 'Music time.'),
  drawing: pic('Drawing', 'Time to draw.'),
  outside: pic('Play outside', 'Play outside.'),
  tidy: pic('Tidy up', 'Tidy up time.'),
  kind: pic('A kind thing', 'Do something kind.'),
  rest: pic('Quiet time', 'Quiet time.'),
} as const satisfies Record<string, PictureInfo>;

/** Things to choose in the reward shop. Activities and small treats a grown-up has agreed to. */
export const REWARD_PICTURES = {
  game: pic('Family game', 'Choose a family game.'),
  storypick: pic('Pick the story', 'Pick tonight’s story.'),
  park: pic('Playground', 'A trip to the playground.'),
  movie: pic('Movie night', 'Movie night.'),
  baking: pic('Bake together', 'Bake something together.'),
  dinner: pic('Choose dinner', 'Choose what’s for dinner.'),
  toy: pic('Small toy', 'A small toy.'),
  stickers: pic('Stickers', 'New stickers.'),
  bike: pic('Bike ride', 'A bike ride.'),
  picnic: pic('Picnic', 'A picnic.'),
  fort: pic('Pillow fort', 'Build a pillow fort.'),
  late: pic('Stay up a little', 'Stay up a little later.'),
  bubbles: pic('Bubbles', 'Bubble time.'),
  icecream: pic('Ice cream', 'An ice cream.'),
  craft: pic('Craft time', 'Craft time together.'),
  outing: pic('Special outing', 'A special outing.'),
  dance: pic('Dance party', 'A dance party.'),
  camp: pic('Camp indoors', 'Camp in the living room.'),
} as const satisfies Record<string, PictureInfo>;

/** Things to buy. A child asks for one by its picture; a grown-up's typed item is matched to one where it can be. */
export const SHOPPING_PICTURES = {
  milk: pic('Milk', 'Milk.'),
  bread: pic('Bread', 'Bread.'),
  eggs: pic('Eggs', 'Eggs.'),
  apple: pic('Apples', 'Apples.'),
  banana: pic('Bananas', 'Bananas.'),
  berries: pic('Berries', 'Berries.'),
  carrot: pic('Carrots', 'Carrots.'),
  tomato: pic('Tomatoes', 'Tomatoes.'),
  potato: pic('Potatoes', 'Potatoes.'),
  cheese: pic('Cheese', 'Cheese.'),
  yogurt: pic('Yogurt', 'Yogurt.'),
  butter: pic('Butter', 'Butter.'),
  cereal: pic('Cereal', 'Cereal.'),
  pasta: pic('Pasta', 'Pasta.'),
  rice: pic('Rice', 'Rice.'),
  chicken: pic('Chicken', 'Chicken.'),
  fish: pic('Fish', 'Fish.'),
  juice: pic('Juice', 'Juice.'),
  water: pic('Water', 'Water.'),
  crackers: pic('Crackers', 'Crackers.'),
  diapers: pic('Diapers', 'Diapers.'),
  wipes: pic('Wipes', 'Wipes.'),
  soap: pic('Soap', 'Soap.'),
  toothpaste: pic('Toothpaste', 'Toothpaste.'),
  paper: pic('Toilet paper', 'Toilet paper.'),
  petfood: pic('Pet food', 'Pet food.'),
  // One for each aisle, for whatever has no picture of its own.
  produce: pic('Fruit and vegetables', 'Fruit and vegetables.'),
  dairy: pic('Dairy', 'From the fridge.'),
  bakery: pic('Bakery', 'From the bakery.'),
  pantry: pic('Pantry', 'For the pantry.'),
  meat: pic('Meat and fish', 'Meat and fish.'),
  frozen: pic('Frozen', 'From the freezer.'),
  drinks: pic('Drinks', 'Drinks.'),
  household: pic('Household', 'For the house.'),
  baby: pic('Baby', 'For the baby.'),
  pets: pic('Pets', 'For the pets.'),
  other: pic('Something else', 'Something else.'),
} as const satisfies Record<string, PictureInfo>;

/** What kind of day it is, for a child: a parent-approved coarse label, never the event itself. */
export const DAY_PICTURES = {
  school: pic('School or daycare', 'A school day.'),
  outing: pic('Family outing', 'We are going out.'),
  visitor: pic('A visitor', 'Someone is visiting.'),
  birthday: pic('Birthday', 'A birthday!'),
  sports: pic('Sport or swimming', 'Sport today.'),
  lesson: pic('A class', 'A class today.'),
  playdate: pic('Playdate', 'A friend to play with.'),
  trip: pic('A trip', 'We are going on a trip.'),
  holiday: pic('Holiday', 'A holiday.'),
  appointment: pic('An appointment', 'An appointment today.'),
  library: pic('Library', 'Library day.'),
  homeday: pic('Home day', 'A day at home.'),
} as const satisfies Record<string, PictureInfo>;

/** Who is who. Each has its own outline — ears, a beak, a shell — so nobody is told apart by colour alone. */
export const AVATARS = {
  fox: pic('Fox', 'Fox'),
  bunny: pic('Bunny', 'Bunny'),
  bear: pic('Bear', 'Bear'),
  owl: pic('Owl', 'Owl'),
  cat: pic('Cat', 'Cat'),
  frog: pic('Frog', 'Frog'),
  hedgehog: pic('Hedgehog', 'Hedgehog'),
  otter: pic('Otter', 'Otter'),
  panda: pic('Panda', 'Panda'),
  whale: pic('Whale', 'Whale'),
  penguin: pic('Penguin', 'Penguin'),
  turtle: pic('Turtle', 'Turtle'),
} as const satisfies Record<string, PictureInfo>;

export type ActionPictureId = keyof typeof ACTION_PICTURES;
export type RewardPictureId = keyof typeof REWARD_PICTURES;
export type ShoppingPictureId = keyof typeof SHOPPING_PICTURES;
export type DayPictureId = keyof typeof DAY_PICTURES;
export type AvatarId = keyof typeof AVATARS;

export const ACTION_PICTURE_IDS = Object.keys(ACTION_PICTURES) as ActionPictureId[];
export const REWARD_PICTURE_IDS = Object.keys(REWARD_PICTURES) as RewardPictureId[];
export const SHOPPING_PICTURE_IDS = Object.keys(SHOPPING_PICTURES) as ShoppingPictureId[];
export const DAY_PICTURE_IDS = Object.keys(DAY_PICTURES) as DayPictureId[];
export const AVATAR_IDS = Object.keys(AVATARS) as AvatarId[];

/** The aisles, in the order a list is grouped. */
export const SHOPPING_CATEGORIES = [
  'produce',
  'dairy',
  'bakery',
  'pantry',
  'meat',
  'frozen',
  'drinks',
  'household',
  'baby',
  'pets',
  'other',
] as const;
export type ShoppingCategory = (typeof SHOPPING_CATEGORIES)[number];

/** The things a child may ask for by tapping a picture, in the order they are offered. */
export const CHILD_REQUEST_PICTURES: readonly ShoppingPictureId[] = [
  'milk',
  'bread',
  'eggs',
  'apple',
  'banana',
  'berries',
  'carrot',
  'cheese',
  'yogurt',
  'cereal',
  'pasta',
  'juice',
  'crackers',
  'toothpaste',
  'soap',
  'petfood',
];
