/** Mixing two colours, for a sky that changes by the minute rather than by the switch. */

function parse(colour: string): [number, number, number] {
  if (colour.startsWith('rgb')) {
    // What `mix` itself returns, so that a mix can be mixed again.
    const parts = colour.match(/-?\d+(\.\d+)?/g) ?? [];
    return [Number(parts[0] ?? 0), Number(parts[1] ?? 0), Number(parts[2] ?? 0)];
  }
  const value = colour.replace('#', '');
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

/** `t` of the way from `a` to `b` (0 gives a, 1 gives b). */
export function mix(a: string, b: string, t: number): string {
  const amount = Math.min(1, Math.max(0, t));
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const channel = (from: number, to: number) => Math.round(from + (to - from) * amount);
  return `rgb(${channel(ar, br)} ${channel(ag, bg)} ${channel(ab, bb)})`;
}

/** Through three colours: a at 0, b at 0.5, c at 1. */
export function mix3(a: string, b: string, c: string, t: number): string {
  return t < 0.5 ? mix(a, b, t * 2) : mix(b, c, (t - 0.5) * 2);
}

/**
 * Through any number of colours, each at its own place between 0 and 1 (places in rising order). Before the
 * first place it is the first colour; after the last, the last.
 */
export function ramp(stops: readonly (readonly [number, string])[], t: number): string {
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (!first || !last) return 'rgb(0 0 0)';
  if (t <= first[0]) return mix(first[1], first[1], 0);
  for (let index = 1; index < stops.length; index += 1) {
    const from = stops[index - 1]!;
    const to = stops[index]!;
    if (t <= to[0]) return mix(from[1], to[1], (t - from[0]) / (to[0] - from[0] || 1));
  }
  return mix(last[1], last[1], 0);
}
