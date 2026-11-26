import type { ReactNode } from 'react';
import styles from '../Parent.module.css';
import { Glyph, IconButton } from './kit';

/** A screen's heading: its name, the way back when it is inside another, and at most one thing to do. */
export function PageHead({
  title,
  onBack,
  action,
}: {
  title: string;
  onBack?: () => void;
  action?: ReactNode;
}) {
  return (
    <header className={styles.pageHead} data-back={Boolean(onBack)}>
      {onBack && (
        <IconButton label="Back" onClick={onBack} testId="page-back">
          {Glyph.back}
        </IconButton>
      )}
      <h1>{title}</h1>
      {action && <div className={styles.pageAction}>{action}</div>}
    </header>
  );
}
