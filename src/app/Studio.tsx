import { useState } from 'react';
import {
  ACTION_PICTURE_IDS,
  ACTION_PICTURES,
  AVATAR_IDS,
  AVATARS,
  DAY_PICTURE_IDS,
  DAY_PICTURES,
  REWARD_PICTURE_IDS,
  REWARD_PICTURES,
  SHOPPING_PICTURE_IDS,
  SHOPPING_PICTURES,
} from '../../shared/pictures';
import { ActionPicture, Avatar, DayPicture, RewardPicture, ShoppingPicture } from '../art/pictures';
import styles from './Studio.module.css';

/**
 * The art studio: every drawing on one sheet, at the sizes it is used. Linked from nowhere; it is for whoever
 * is drawing, and for the review screenshots. (/studio, /studio/actions, …)
 */
export function Studio({ view }: { view: string }) {
  const [play, setPlay] = useState(false);
  const sheets = [
    {
      key: 'actions',
      title: 'Things to do',
      ids: ACTION_PICTURE_IDS,
      names: ACTION_PICTURES,
      Draw: ActionPicture,
    },
    {
      key: 'rewards',
      title: 'Rewards',
      ids: REWARD_PICTURE_IDS,
      names: REWARD_PICTURES,
      Draw: RewardPicture,
    },
    {
      key: 'shopping',
      title: 'Things to buy',
      ids: SHOPPING_PICTURE_IDS,
      names: SHOPPING_PICTURES,
      Draw: ShoppingPicture,
    },
    { key: 'days', title: 'Kinds of day', ids: DAY_PICTURE_IDS, names: DAY_PICTURES, Draw: DayPicture },
    { key: 'avatars', title: 'Who is who', ids: AVATAR_IDS, names: AVATARS, Draw: Avatar },
  ] as const;
  const shown = sheets.filter((sheet) => view === 'all' || view === sheet.key);
  return (
    <main className={styles.studio}>
      <header className={styles.header}>
        <h1>Studio</h1>
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setPlay((value) => !value)}
          aria-pressed={play}
        >
          {play ? 'Moving' : 'Still'}
        </button>
      </header>
      {shown.map((sheet) => (
        <section key={sheet.key} className={styles.sheet} data-sheet={sheet.key}>
          <h2>{sheet.title}</h2>
          <ul className={styles.grid}>
            {sheet.ids.map((id) => {
              const Draw = sheet.Draw as (props: { id: string; play?: boolean }) => React.ReactNode;
              const names = sheet.names as Record<string, { label: string }>;
              return (
                <li key={id} className={styles.cell}>
                  <div className={styles.card}>
                    <Draw id={id} play={play} />
                  </div>
                  <div className={styles.small}>
                    <Draw id={id} />
                  </div>
                  <span className={styles.name}>{names[id]?.label}</span>
                  <code className={styles.id}>{id}</code>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </main>
  );
}
