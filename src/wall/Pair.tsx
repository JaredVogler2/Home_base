import { encode } from 'uqr';
import { useEffect, useState } from 'react';
import { Tock } from '../art/guide/Tock';
import { api, ApiError } from '../sync/api';
import { store } from '../sync/store';
import styles from './Pair.module.css';

/**
 * A screen that does not belong to a family yet.
 *
 * It shows a code — as letters to type and as a square to scan — and waits. A grown-up signs in on their own
 * phone, scans or types the code and gives the screen a name; a moment later this screen becomes the wall. The
 * screen is never given a password, and the code is good once, for ten minutes; when it runs out a new one
 * appears by itself.
 */

interface Started {
  code: string;
  secret: string;
  expiresAt: string;
}

function QrCode({ text }: { text: string }) {
  const { size, data } = encode(text, { ecc: 'M', border: 2 });
  const cells: string[] = [];
  data.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) cells.push(`M${x} ${y}h1v1h-1z`);
    });
  });
  return (
    <svg
      className={styles.qr}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="A square code to scan with a phone's camera"
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="#fff" />
      <path d={cells.join('')} fill="#3a2e4d" />
    </svg>
  );
}

export function Pair() {
  const [started, setStarted] = useState<Started | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  /** Counting up asks for a fresh code: at the start, when one runs out, and again after a failure. */
  const [round, setRound] = useState(0);

  useEffect(() => {
    let current = true;
    api<Started>('POST', '/pair/start', {})
      .then((reply) => {
        if (!current) return;
        setStarted(reply);
        setProblem(null);
      })
      .catch((error: unknown) => {
        if (!current) return;
        setStarted(null);
        setProblem(
          error instanceof ApiError && !error.offline
            ? error.message
            : 'HOMEBASE cannot reach its server yet. It will keep trying.',
        );
      });
    return () => {
      current = false;
    };
  }, [round]);

  useEffect(() => {
    let current = true;
    api<{ mode?: string }>('GET', '/health')
      .then((health) => {
        if (current) setDemo(health.mode === 'demo');
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, []);

  // Ask "has anyone claimed me?" every few seconds, and fetch a new code when this one runs out.
  useEffect(() => {
    if (!started) {
      const retry = setTimeout(() => setRound((value) => value + 1), 6_000);
      return () => clearTimeout(retry);
    }
    const another = () => {
      setStarted(null);
      setRound((value) => value + 1);
    };
    const timer = setInterval(async () => {
      if (new Date(started.expiresAt).getTime() < Date.now()) {
        another();
        return;
      }
      try {
        const reply = await api<{ status: string }>('POST', '/pair/collect', {
          code: started.code,
          secret: started.secret,
        });
        if (reply.status === 'paired') await store.reset();
        else if (reply.status !== 'waiting') another();
      } catch (error) {
        if (error instanceof ApiError && !error.offline) another();
      }
    }, 3_000);
    return () => clearInterval(timer);
  }, [started]);

  const enterDemo = async () => {
    try {
      await api('POST', '/demo/enter', { as: 'wall' });
      await store.reset();
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : 'The demo could not be opened.');
    }
  };

  const link = started ? `${window.location.origin}/pair?code=${encodeURIComponent(started.code)}` : '';
  return (
    <main className={styles.pair}>
      <div className={styles.card}>
        <div className={styles.tock} aria-hidden="true">
          <Tock pose="wave" />
        </div>
        <h1>This screen is not part of a family yet</h1>
        {started ? (
          <>
            <p className={styles.lead}>
              On your own phone, sign in to HOMEBASE, choose{' '}
              <strong>Settings → Screens → Add a screen</strong>, and scan this square or type this code.
            </p>
            <div className={styles.codeRow}>
              <QrCode text={link} />
              <div>
                <p
                  className={styles.code}
                  data-testid="pair-code"
                  aria-label={`Pairing code ${started.code.split('').join(' ')}`}
                >
                  {started.code}
                </p>
                <p className={styles.small}>
                  The code works once and lasts ten minutes. A new one appears by itself.
                </p>
              </div>
            </div>
          </>
        ) : (
          <p className={styles.lead} role="status">
            {problem ?? 'Getting a code…'}
          </p>
        )}
        {problem && started && <p className={styles.problem}>{problem}</p>}
        {demo && (
          <div className={styles.demo}>
            <p>This is a demo with a made-up family. Nothing in it is real.</p>
            <button
              type="button"
              className={styles.demoButton}
              onClick={() => void enterDemo()}
              data-testid="demo-wall"
            >
              Open the demo wall
            </button>
          </div>
        )}
        <p className={styles.small}>
          Are you a grown-up on your own phone? <a href="/parent">Go to the grown-ups’ side.</a>
        </p>
      </div>
    </main>
  );
}
