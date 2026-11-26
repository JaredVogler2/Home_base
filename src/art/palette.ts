/**
 * The palette, for drawings. The same colours as src/styles/tokens.css, by the same names.
 *
 * A drawing uses these and nothing else. That is what makes a toothbrush drawn in March and a lunch box drawn
 * in June look like they belong to the same house. Each colour has a light, a middle and a deep: fill with the
 * middle, catch the light with the light, shade with the deep.
 */
export const P = {
  ink: '#3a2e4d',
  inkSoft: '#6b5f80',
  white: '#ffffff',
  paper: '#fffaf0',
  cream: '#fff6e6',
  creamShade: '#f3e2c2',
  line: '#ead9b8',

  honeyLight: '#ffe9a8',
  honey: '#ffc94d',
  honeyDeep: '#e39a1c',

  terraLight: '#ffd9c7',
  terra: '#f08a62',
  terraDeep: '#c9573a',

  sageLight: '#e2f1d6',
  sage: '#8fd08a',
  sageDeep: '#3f8a55',

  tealLight: '#d6efec',
  teal: '#62bfc4',
  tealDeep: '#2b7f8f',

  blueLight: '#dff0ff',
  blue: '#58a8e8',
  blueDeep: '#2f78c4',

  roseLight: '#fde2ea',
  rose: '#f594b4',
  roseDeep: '#c9517e',

  lavLight: '#ebe5fb',
  lav: '#b3a2f2',
  lavDeep: '#6b5bb5',

  woodLight: '#e8c79b',
  wood: '#c9976b',
  woodDeep: '#8d5b36',

  red: '#ef6f5e',
  redDeep: '#c8483f',
  skin: '#f6c59a',
  skinDeep: '#e0a274',
  night: '#2f3470',
} as const;

export type PaletteColour = keyof typeof P;
