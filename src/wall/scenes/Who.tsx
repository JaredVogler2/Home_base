import { Face } from '../chrome/chrome';
import { useWall } from '../context';
import { childrenOf } from '../derive';
import styles from './Who.module.css';

/**
 * "Who is here?" — asked the first time a room needs to know, with faces to tap and nothing to read. A child
 * who has no missions of their own yet (a baby) is not asked.
 */
export function Who({ onlyIndependent = true }: { onlyIndependent?: boolean }) {
  const wall = useWall();
  const children = childrenOf(wall.view).filter((child) => !onlyIndependent || child.independent);
  if (children.length === 0) {
    return (
      <div className={styles.none} data-testid="who-none">
        <p>There are no children here yet. A grown-up can add one on their phone.</p>
      </div>
    );
  }
  return (
    <div className={styles.who} data-testid="who" role="group" aria-label="Who is here?">
      {children.map((child) => (
        <div key={child.id} className={styles.choice}>
          <Face
            profile={child}
            onTap={() => {
              wall.sound('tap');
              wall.setWho(child.id);
            }}
          />
          {wall.labels && <span className={styles.name}>{child.nickname}</span>}
        </div>
      ))}
    </div>
  );
}
