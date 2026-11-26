/**
 * Whether this display can keep up with the house's ambient movement.
 *
 * The drawings drift, sway and blink a little while nobody is doing anything. On a display that cannot draw
 * that smoothly it is worse than nothing: it looks broken, warms the device, and makes every tap feel slow. So
 * the wall watches how evenly its own frames arrive for a few seconds, and if the display is not keeping up it
 * stops the ambient movement by itself ("light" motion). What a tap does — a room opening, a tick appearing —
 * still moves; nothing a child needs is carried by the ambient movement alone.
 */

export interface FrameSample {
  frames: number;
  /** The middle frame's length, in milliseconds. */
  median: number;
  /** The average frame's length, in milliseconds: frames a second, turned upside down. */
  mean: number;
}

/** Slower than this (about 30 frames a second) and the ambient movement goes. */
export const KEEPING_UP_MS = 34;
const MIN_FRAMES = 20;

/**
 * Both the middle frame and the average must be quick enough. The middle alone is fooled by a display that
 * draws most frames on time and a good many late — twenty-two frames a second with a perfectly respectable
 * middle frame, which is what a 4K wall drawn without a graphics card looked like when this was measured. The
 * average alone would be fooled by nothing much, but a handful of long hiccups among many good frames is not a
 * display that cannot keep up, and the middle frame says so.
 */
export function keepsUp(sample: FrameSample): boolean | null {
  // Too few frames to judge: the page was in the background, or the browser was busy starting.
  if (sample.frames < MIN_FRAMES) return null;
  return sample.median <= KEEPING_UP_MS && sample.mean <= KEEPING_UP_MS;
}

export function summarise(deltas: readonly number[]): FrameSample {
  const sorted = [...deltas].sort((a, b) => a - b);
  const total = sorted.reduce((sum, delta) => sum + delta, 0);
  return {
    frames: sorted.length,
    median: sorted[Math.floor(sorted.length / 2)] ?? 0,
    mean: sorted.length > 0 ? total / sorted.length : 0,
  };
}

/** Count frames for a while. Resolves with nothing to go on if the page cannot be seen. */
export function sampleFrames(ms: number): { done: Promise<FrameSample>; cancel: () => void } {
  let handle = 0;
  let cancelled = false;
  const done = new Promise<FrameSample>((resolve) => {
    if (typeof requestAnimationFrame !== 'function' || document.visibilityState === 'hidden') {
      resolve({ frames: 0, median: 0, mean: 0 });
      return;
    }
    const deltas: number[] = [];
    const start = performance.now();
    let last = start;
    const tick = (now: number) => {
      if (cancelled) return;
      deltas.push(now - last);
      last = now;
      if (now - start < ms) handle = requestAnimationFrame(tick);
      else resolve(summarise(deltas.slice(1)));
    };
    handle = requestAnimationFrame(tick);
  });
  return {
    done,
    cancel: () => {
      cancelled = true;
      if (handle) cancelAnimationFrame(handle);
    },
  };
}
