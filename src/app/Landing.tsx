import { useEffect, useState } from 'react';
import { Tock } from '../art/guide/Tock';
import { api } from '../sync/api';
import { navigate } from './navigation';
import styles from './Landing.module.css';

/**
 * The front door. A screen that is already the wall goes to the house; a grown-up who is signed in goes to
 * their side; anybody else is asked which they are. Nothing about any family is shown here.
 */
export function Landing() {
  const [ready, setReady] = useState(false);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    let current = true;
    api<{ signedIn: boolean; kind?: string }>('GET', '/auth/me')
      .then((me) => {
        if (!current) return;
        if (me.signedIn && me.kind === 'device') navigate({ name: 'wall' }, { replace: true });
        else if (me.signedIn) navigate({ name: 'parent', section: 'today', rest: [] }, { replace: true });
        else setReady(true);
      })
      .catch(() => {
        if (current) setReady(true);
      });
    api<{ mode?: string }>('GET', '/health')
      .then((health) => {
        if (current) setDemo(health.mode === 'demo');
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, []);

  if (!ready) return <div className={styles.page} role="status" aria-label="HOMEBASE is starting" />;
  return (
    <main className={styles.page}>
      <div className={styles.tock} aria-hidden="true">
        <Tock pose="wave" />
      </div>
      <h1>HOMEBASE</h1>
      <p className={styles.lead}>A family’s home screen. Pictures first, for children who cannot read yet.</p>
      <div className={styles.choices}>
        <a
          className={styles.choice}
          href="/wall"
          onClick={(event) => {
            event.preventDefault();
            navigate({ name: 'wall' });
          }}
          data-testid="go-wall"
        >
          <strong>This is the screen on the wall</strong>
          <span>It will show a code to pair it with your family.</span>
        </a>
        <a
          className={styles.choice}
          href="/parent"
          onClick={(event) => {
            event.preventDefault();
            navigate({ name: 'parent', section: 'today', rest: [] });
          }}
          data-testid="go-parent"
        >
          <strong>I am a grown-up, on my own phone</strong>
          <span>Sign in, or start a household.</span>
        </a>
      </div>
      {demo && <p className={styles.small}>This is a demo with a made-up family. Nothing in it is real.</p>}
    </main>
  );
}
