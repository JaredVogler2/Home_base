/**
 * Saying things aloud, with the wall's own voice.
 *
 * The words are spoken by the device itself (the browser's built-in speech), so nothing a child hears or does
 * is sent anywhere, and nothing is ever listened to: this file only talks. Every sentence it says is also shown
 * as words beside Tock, so the house works the same with the sound off.
 *
 * It is quiet when the family has switched the voice off and during quiet hours, and it never talks over
 * itself: a new sentence replaces the one being said.
 */

export interface VoiceSettings {
  enabled: boolean;
  voiceName: string | null;
  rate: number;
  pitch: number;
}

let settings: VoiceSettings = { enabled: true, voiceName: null, rate: 0.92, pitch: 1.05 };
let hushed = false;
let voices: SpeechSynthesisVoice[] = [];

const synth = (): SpeechSynthesis | null =>
  typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;

function loadVoices(): void {
  const engine = synth();
  if (!engine) return;
  voices = engine.getVoices();
}

if (synth()) {
  loadVoices();
  synth()?.addEventListener?.('voiceschanged', loadVoices);
}

export function configureVoice(next: VoiceSettings, quiet: boolean): void {
  settings = next;
  hushed = quiet;
  if (quiet || !next.enabled) synth()?.cancel();
}

/** Whether this device can speak at all (some wall displays ship without a voice installed). */
export function canSpeak(): boolean {
  return synth() !== null;
}

export function voiceNames(): string[] {
  loadVoices();
  return voices.filter((voice) => voice.lang.toLowerCase().startsWith('en')).map((voice) => voice.name);
}

function pick(): SpeechSynthesisVoice | null {
  if (voices.length === 0) loadVoices();
  if (settings.voiceName) {
    const chosen = voices.find((voice) => voice.name === settings.voiceName);
    if (chosen) return chosen;
  }
  const english = voices.filter((voice) => voice.lang.toLowerCase().startsWith('en'));
  // A voice that lives on the device is preferred to one that needs the network.
  return (
    english.find((voice) => voice.localService && voice.default) ??
    english.find((voice) => voice.localService) ??
    english[0] ??
    null
  );
}

export function say(text: string): void {
  const engine = synth();
  if (!engine || !settings.enabled || hushed || text.trim() === '') return;
  try {
    engine.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pick();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = 'en-US';
    }
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;
    engine.speak(utterance);
  } catch {
    // A device that cannot speak stays silent; the words are on the screen.
  }
}

export function hush(): void {
  synth()?.cancel();
}
