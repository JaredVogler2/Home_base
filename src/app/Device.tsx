import { useEffect, useState } from 'react';
import styles from './Studio.module.css';

/**
 * What this screen says about itself: its size, its sharpness, its browser, its voices. For the day HOMEBASE is
 * first opened on the real wall display — read it, write it down in docs/DEVICE-CHECKLIST.md. Nothing here is
 * sent anywhere; it is only shown.
 */

interface Facts {
  [name: string]: string;
}

function gather(): Facts {
  const nav = navigator as Navigator & { deviceMemory?: number; standalone?: boolean };
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    'The page is (CSS pixels)': `${window.innerWidth} × ${window.innerHeight}`,
    'Sharpness (device pixel ratio)': String(window.devicePixelRatio),
    'So the page draws at (real pixels)': `${Math.round(window.innerWidth * window.devicePixelRatio)} × ${Math.round(
      window.innerHeight * window.devicePixelRatio,
    )}`,
    'The whole screen is (CSS pixels)': `${window.screen.width} × ${window.screen.height}`,
    'Which way up': window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait',
    'Fingers it can feel at once': String(navigator.maxTouchPoints),
    'Memory it reports (GB)': nav.deviceMemory ? String(nav.deviceMemory) : 'does not say',
    'Processor threads': String(navigator.hardwareConcurrency ?? 'does not say'),
    'Opened as an installed app':
      window.matchMedia('(display-mode: standalone)').matches || nav.standalone ? 'yes' : 'no',
    'Asks for less motion': motion ? 'yes' : 'no',
    'Can keep the screen awake (wake lock)': 'wakeLock' in navigator ? 'yes' : 'no',
    'Can keep the app for offline use': 'serviceWorker' in navigator ? 'yes' : 'no',
    'Can speak': 'speechSynthesis' in window ? 'yes' : 'no',
    'Is online, by its own account': navigator.onLine ? 'yes' : 'no',
    Browser: navigator.userAgent,
  };
}

export function Device() {
  const [facts, setFacts] = useState<Facts>(() => gather());
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [shell, setShell] = useState('looking…');
  const [frames, setFrames] = useState<string>('measuring…');

  useEffect(() => {
    const again = () => setFacts(gather());
    window.addEventListener('resize', again);
    return () => window.removeEventListener('resize', again);
  }, []);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const read = () => setVoices(window.speechSynthesis.getVoices());
    read();
    window.speechSynthesis.addEventListener('voiceschanged', read);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', read);
  }, []);

  useEffect(() => {
    let current = true;
    if (!('caches' in window)) {
      setShell('this browser keeps nothing');
      return;
    }
    void caches
      .keys()
      .then(async (names) => {
        const mine = names.filter((name) => name.startsWith('homebase-shell-'));
        const first = mine[0];
        const count = first ? (await (await caches.open(first)).keys()).length : 0;
        if (current)
          setShell(
            first
              ? `${count} files kept (${first})`
              : 'not installed (it is only installed from the built app, over https)',
          );
      })
      .catch(() => {
        if (current) setShell('could not look');
      });
    return () => {
      current = false;
    };
  }, []);

  // How evenly this screen can draw: sixty frames, timed.
  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const gaps: number[] = [];
    let handle = requestAnimationFrame(function tick(now) {
      gaps.push(now - last);
      last = now;
      frame += 1;
      if (frame < 90) handle = requestAnimationFrame(tick);
      else {
        const used = gaps.slice(10).sort((a, b) => a - b);
        const middle = used[Math.floor(used.length / 2)] ?? 0;
        const slow = used[Math.floor(used.length * 0.95)] ?? 0;
        setFrames(
          `${(1000 / middle).toFixed(0)} frames a second; slowest of twenty takes ${slow.toFixed(1)} ms`,
        );
      }
    });
    return () => cancelAnimationFrame(handle);
  }, []);

  const speak = (voice: SpeechSynthesisVoice) => {
    window.speechSynthesis.cancel();
    const words = new SpeechSynthesisUtterance('Hello! I am Tock. Shoes go in the basket.');
    words.voice = voice;
    words.rate = 0.92;
    words.pitch = 1.05;
    window.speechSynthesis.speak(words);
  };

  return (
    <section className={styles.sheet} data-sheet="device">
      <h2>This screen</h2>
      <p>Nothing on this page is sent anywhere. Copy what you need into the device checklist.</p>
      <table className={styles.facts} data-testid="device-facts">
        <tbody>
          {Object.entries({ ...facts, 'Kept for offline use': shell, 'Drawing speed, at rest': frames }).map(
            ([name, value]) => (
              <tr key={name}>
                <th scope="row">{name}</th>
                <td>{value}</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
      <h2 style={{ marginTop: 24 }}>Voices this screen has</h2>
      {voices.length === 0 ? (
        <p>None reported (some browsers list them only after a tap, or have none).</p>
      ) : (
        <ul className={styles.voices}>
          {voices.map((voice) => (
            <li key={`${voice.name}-${voice.lang}`}>
              <button type="button" className={styles.toggle} onClick={() => speak(voice)}>
                Try
              </button>
              <span>
                <strong>{voice.name}</strong> · {voice.lang}
                {voice.localService ? ' · on this device' : ' · needs the internet'}
                {voice.default ? ' · the default' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p>
        To use one on the wall: on your phone, <em>Family → The wall → The wall’s voice</em>, and type its
        name exactly.
      </p>
    </section>
  );
}
