/**
 * The house's small sounds: a soft tap, a chirp from Tock, a bell for a star. Each is made on the spot from a
 * few numbers — nothing is recorded, downloaded or licensed — and all of them are quiet, short, and never
 * sudden. With sounds off, during quiet hours, or before anyone has touched the screen, there are none.
 * Nothing in the house depends on hearing one.
 */

export type Sound = 'tap' | 'open' | 'back' | 'chirp' | 'step' | 'star' | 'done' | 'sent' | 'oops';

let context: AudioContext | null = null;
let enabled = true;
let soft = false;

export function configureSound(on: boolean, calm: boolean): void {
  enabled = on;
  soft = calm;
}

/** Browsers only let sound start from a touch. Call this from the first one. */
export function unlockSound(): void {
  if (context || typeof window === 'undefined') return;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  try {
    context = new Ctor();
  } catch {
    context = null;
  }
}

interface Note {
  /** Hertz at the start, and at the end if it slides. */
  from: number;
  to?: number;
  /** Seconds after the sound begins. */
  at: number;
  length: number;
  gain: number;
  wave?: OscillatorType;
}

const C6 = 1046.5;
const E6 = 1318.5;
const G6 = 1568;
const C7 = 2093;

const SCORES: Record<Sound, Note[]> = {
  tap: [{ from: 520, to: 420, at: 0, length: 0.07, gain: 0.1, wave: 'sine' }],
  open: [
    { from: 440, to: 660, at: 0, length: 0.16, gain: 0.09 },
    { from: 660, to: 880, at: 0.1, length: 0.18, gain: 0.07 },
  ],
  back: [{ from: 660, to: 440, at: 0, length: 0.18, gain: 0.08 }],
  chirp: [
    { from: 2200, to: 3200, at: 0, length: 0.07, gain: 0.06 },
    { from: 2600, to: 3600, at: 0.11, length: 0.08, gain: 0.06 },
  ],
  step: [{ from: E6, at: 0, length: 0.28, gain: 0.09, wave: 'triangle' }],
  star: [
    { from: C6, at: 0, length: 0.35, gain: 0.1, wave: 'triangle' },
    { from: E6, at: 0.12, length: 0.45, gain: 0.1, wave: 'triangle' },
  ],
  done: [
    { from: C6, at: 0, length: 0.3, gain: 0.09, wave: 'triangle' },
    { from: E6, at: 0.14, length: 0.3, gain: 0.09, wave: 'triangle' },
    { from: G6, at: 0.28, length: 0.3, gain: 0.09, wave: 'triangle' },
    { from: C7, at: 0.42, length: 0.6, gain: 0.08, wave: 'triangle' },
  ],
  sent: [
    { from: G6, at: 0, length: 0.25, gain: 0.08, wave: 'triangle' },
    { from: E6, at: 0.15, length: 0.4, gain: 0.08, wave: 'triangle' },
  ],
  // "Hm, not that": two soft notes going gently down. Never a buzzer.
  oops: [
    { from: 520, at: 0, length: 0.16, gain: 0.07 },
    { from: 440, at: 0.14, length: 0.24, gain: 0.07 },
  ],
};

export function play(sound: Sound): void {
  if (!enabled || !context) return;
  const audio = context;
  if (audio.state === 'suspended') void audio.resume().catch(() => undefined);
  const start = audio.currentTime + 0.01;
  for (const note of SCORES[sound]) {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = note.wave ?? 'sine';
    oscillator.frequency.setValueAtTime(note.from, start + note.at);
    if (note.to) oscillator.frequency.exponentialRampToValueAtTime(note.to, start + note.at + note.length);
    const loud = note.gain * (soft ? 0.5 : 1);
    // In gently, out gently: no clicks.
    gain.gain.setValueAtTime(0.0001, start + note.at);
    gain.gain.exponentialRampToValueAtTime(loud, start + note.at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + note.at + note.length);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start + note.at);
    oscillator.stop(start + note.at + note.length + 0.05);
  }
}
