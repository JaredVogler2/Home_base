import type { CSSProperties } from 'react';

/**
 * Where everything is, as arithmetic.
 *
 * The house is drawn on a sheet of a fixed size — wide for a wall, tall for a phone or an upright tablet — and
 * the sheet is scaled to fit whatever screen there is. Every position below is in the sheet's own units, so the
 * picture, the buttons laid over it and the tests that check them all agree about where a room is.
 */

export type Shape = 'wide' | 'tall';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const ROOMS = ['memories', 'calendar', 'quest', 'routines', 'bank', 'pantry'] as const;
export type RoomId = (typeof ROOMS)[number];

export interface Layout {
  shape: Shape;
  sheet: { w: number; h: number };
  /** The outside of the house's wooden frame. */
  frame: Box;
  rooms: Record<RoomId, Box>;
  /** The beams between rooms. */
  beams: Box[];
  roof: { left: [number, number]; apex: [number, number]; right: [number, number]; width: number };
  attic: { cx: number; cy: number; r: number };
  chimney: Box;
  boat: Box;
  guide: Box;
  /** Where the row of faces is centred, how big one is, and the gap between two. */
  faces: { cx: number; cy: number; size: number; gap: number };
  sayAgain: Box;
  /** Where the lawn begins. */
  ground: number;
  sun: { left: number; right: number; top: number; low: number; r: number };
  labels: Record<RoomId | 'academy', { cx: number; cy: number }>;
}

export const WIDE: Layout = {
  shape: 'wide',
  sheet: { w: 1920, h: 1080 },
  frame: { x: 440, y: 324, w: 1040, h: 622 },
  rooms: {
    memories: { x: 460, y: 340, w: 492, h: 244 },
    calendar: { x: 968, y: 340, w: 492, h: 244 },
    quest: { x: 460, y: 618, w: 238, h: 290 },
    routines: { x: 714, y: 618, w: 238, h: 290 },
    bank: { x: 968, y: 618, w: 238, h: 290 },
    pantry: { x: 1222, y: 618, w: 238, h: 290 },
  },
  beams: [
    { x: 440, y: 584, w: 1040, h: 34 },
    { x: 952, y: 340, w: 16, h: 244 },
    { x: 698, y: 618, w: 16, h: 290 },
    { x: 952, y: 618, w: 16, h: 290 },
    { x: 1206, y: 618, w: 16, h: 290 },
  ],
  roof: { left: [388, 344], apex: [960, 100], right: [1532, 344], width: 54 },
  attic: { cx: 960, cy: 236, r: 52 },
  chimney: { x: 1222, y: 130, w: 78, h: 150 },
  boat: { x: 70, y: 640, w: 320, h: 330 },
  guide: { x: 1470, y: 850, w: 200, h: 210 },
  faces: { cx: 960, cy: 1004, size: 122, gap: 22 },
  sayAgain: { x: 1774, y: 936, w: 120, h: 120 },
  ground: 880,
  sun: { left: 120, right: 1800, top: 96, low: 420, r: 70 },
  labels: {
    memories: { cx: 706, cy: 601 },
    calendar: { cx: 1214, cy: 601 },
    quest: { cx: 579, cy: 929 },
    routines: { cx: 833, cy: 929 },
    bank: { cx: 1087, cy: 929 },
    pantry: { cx: 1341, cy: 929 },
    academy: { cx: 226, cy: 1006 },
  },
};

export const TALL: Layout = {
  shape: 'tall',
  sheet: { w: 780, h: 1688 },
  frame: { x: 50, y: 366, w: 680, h: 1066 },
  rooms: {
    memories: { x: 66, y: 382, w: 316, h: 320 },
    calendar: { x: 398, y: 382, w: 316, h: 320 },
    quest: { x: 66, y: 736, w: 316, h: 320 },
    routines: { x: 398, y: 736, w: 316, h: 320 },
    bank: { x: 66, y: 1090, w: 316, h: 320 },
    pantry: { x: 398, y: 1090, w: 316, h: 320 },
  },
  beams: [
    { x: 50, y: 702, w: 680, h: 34 },
    { x: 50, y: 1056, w: 680, h: 34 },
    { x: 382, y: 382, w: 16, h: 320 },
    { x: 382, y: 736, w: 16, h: 320 },
    { x: 382, y: 1090, w: 16, h: 320 },
  ],
  roof: { left: [30, 384], apex: [390, 164], right: [750, 384], width: 46 },
  attic: { cx: 390, cy: 292, r: 46 },
  chimney: { x: 560, y: 200, w: 60, h: 120 },
  boat: { x: 22, y: 1452, w: 170, h: 190 },
  guide: { x: 610, y: 1456, w: 156, h: 164 },
  faces: { cx: 400, cy: 1560, size: 112, gap: 14 },
  sayAgain: { x: 648, y: 28, w: 104, h: 104 },
  ground: 1420,
  sun: { left: 70, right: 520, top: 70, low: 300, r: 52 },
  labels: {
    memories: { cx: 224, cy: 719 },
    calendar: { cx: 556, cy: 719 },
    quest: { cx: 224, cy: 1073 },
    routines: { cx: 556, cy: 1073 },
    bank: { cx: 224, cy: 1421 },
    pantry: { cx: 556, cy: 1421 },
    academy: { cx: 107, cy: 1660 },
  },
};

export function layoutFor(width: number, height: number): Layout {
  return width / height < 0.85 ? TALL : WIDE;
}

/** A box on the sheet, as CSS percentages of the stage. */
export function place(layout: Layout, box: Box): CSSProperties {
  return {
    left: `${(box.x / layout.sheet.w) * 100}%`,
    top: `${(box.y / layout.sheet.h) * 100}%`,
    width: `${(box.w / layout.sheet.w) * 100}%`,
    height: `${(box.h / layout.sheet.h) * 100}%`,
  };
}

export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
