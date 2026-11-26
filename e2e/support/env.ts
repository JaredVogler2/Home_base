/** Where the tests' own server runs, and the screens they pretend to be. Shared by the config and the specs. */

export const PORT = 5190;
export const BASE = `http://127.0.0.1:${PORT}`;

/** The wall: a 27-inch 4K display that reports a 1920×1080 CSS viewport (drawn here at DPR 1 to keep it quick). */
export const WALL_1080 = {
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  hasTouch: true,
} as const;

/** A grown-up's phone. */
export const PHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  hasTouch: true,
  isMobile: true,
} as const;
