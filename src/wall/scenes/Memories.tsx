import { useEffect, useMemo, useState } from 'react';
import { zonedParts } from '../../../shared/time';
import { SAMPLE_COUNT, SamplePicture } from '../../art/samples';
import { useWall } from '../context';
import styles from './Memories.module.css';

/**
 * MEMORIES: the family's photographs, one at a time, slowly.
 *
 * This is HOMEBASE's own slideshow, for a family that would rather not use the display's built-in one (which is
 * the first choice: see docs/DEVICE-CHECKLIST.md). It shows only what a grown-up has put in it, fades gently
 * from one to the next, never plays anything, and goes back to the house at a touch.
 */
export function Memories() {
  const wall = useWall();
  const { view } = wall;
  const settings = view.household.settings.memories;
  const media = view.media;
  const count = media.length > 0 ? media.length : view.household.demo ? SAMPLE_COUNT : 0;
  const [index, setIndex] = useState(0);
  const width = useMemo(
    () =>
      Math.round(Math.max(window.innerWidth, window.innerHeight) * Math.min(window.devicePixelRatio || 1, 2)),
    [],
  );

  useEffect(() => {
    wall.tell('', 'idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (count < 2) return;
    const timer = setInterval(
      () => setIndex((current) => (current + 1) % count),
      settings.secondsPerPhoto * 1000,
    );
    return () => clearInterval(timer);
  }, [count, settings.secondsPerPhoto]);

  const srcOf = (i: number): string | null => {
    const item = media[i % Math.max(media.length, 1)];
    if (!item) return null;
    // The smallest copy that still fills the screen: a 4K wall gets the big one, a phone does not.
    const fit =
      item.widths.find((candidate) => candidate >= width) ?? item.widths[item.widths.length - 1] ?? 0;
    return `/api/media/${item.id}/${fit}`;
  };

  // The next photograph is fetched while this one is showing, so the fade never waits for the network.
  useEffect(() => {
    const next = srcOf((index + 1) % Math.max(count, 1));
    if (!next) return;
    const image = new Image();
    image.decoding = 'async';
    image.src = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, count]);

  const time = zonedParts(new Date(wall.nowMs), view.household.timeZone);
  const hour = Number(time.time.slice(0, 2));
  const clock = `${((hour + 11) % 12) + 1}:${time.time.slice(3)}`;

  return (
    <button
      type="button"
      className={styles.memories}
      onClick={wall.home}
      aria-label="Photographs. Tap to go back to the house."
      data-testid="scene-memories"
    >
      {count === 0 ? (
        <span className={styles.none} data-testid="memories-empty">
          No photographs yet. A grown-up can add some on their phone.
        </span>
      ) : (
        Array.from({ length: Math.min(count, 2) }, (_, layer) => {
          const i = (index + layer) % count;
          const src = srcOf(i);
          return (
            <span
              key={`${i}-${layer}`}
              className={styles.photo}
              data-front={layer === 0}
              data-fit={settings.fit}
            >
              {src ? (
                <img src={src} alt="" decoding="async" draggable={false} />
              ) : (
                <SamplePicture index={i} />
              )}
            </span>
          );
        }).reverse()
      )}
      {media.length === 0 && count > 0 && (
        <span className={styles.sample}>Sample pictures — not a real family</span>
      )}
      {settings.clock && count > 0 && (
        <span className={styles.clock} aria-hidden="true">
          {clock}
        </span>
      )}
    </button>
  );
}
