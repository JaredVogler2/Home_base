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
