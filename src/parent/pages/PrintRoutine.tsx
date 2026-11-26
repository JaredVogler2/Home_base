import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Routine } from '../../../shared/model';
import { ActionPicture } from '../../art/pictures';
import { Button } from '../ui/kit';
import styles from './PrintRoutine.module.css';

/**
 * A routine as a sheet of paper: the same pictures as on the wall, in order, each with a row of rings to tick
 * with a pencil through the week. For the bathroom mirror or the bedroom door — a routine that needs no screen
 * at all. Nothing on the sheet says who the family is: a first name is added only if a grown-up types one.
 */

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function PrintRoutine({ routine, onClose }: { routine: Routine; onClose: () => void }) {
  // Escape puts the paper away.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className={`${styles.paper} print-sheet`}
      role="dialog"
      aria-modal="true"
      aria-label={`${routine.title}, to print`}
      data-testid="print-routine"
    >
      <div className={`${styles.bar} no-print`}>
        <Button tone="primary" onClick={() => window.print()} testId="print-now">
          Print
        </Button>
        <Button onClick={onClose} testId="print-close">
          Close
        </Button>
        <span className={styles.tip}>
          One page, upright. Pictures only need one colour of ink to be clear.
        </span>
      </div>
      <div className={styles.sheet}>
        <header className={styles.head}>
          <span className={styles.headPicture}>
            <ActionPicture id={routine.picture} />
          </span>
          <h1>{routine.title}</h1>
          <span className={styles.name} aria-hidden="true" />
        </header>
        <ol className={styles.steps}>
          {routine.steps.map((step, index) => (
            <li key={step.id} className={styles.step}>
              <span className={styles.number} aria-hidden="true">
                {index + 1}
              </span>
              <span className={styles.picture}>
                <ActionPicture id={step.picture} />
              </span>
              <span className={styles.words}>
                <strong>{step.title}</strong>
                {step.needsAdult && <em>with a grown-up</em>}
              </span>
              <span className={styles.rings} aria-hidden="true">
                {DAYS.map((day, at) => (
                  <span key={at} className={styles.ring}>
                    {day}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>,
    document.body,
  );
}
