import { useRef, useState } from 'react';
import { newId } from '../../../shared/ids';
import { preparePhoto, uploadPhoto } from '../../lib/photos';
import { store } from '../../sync/store';
import { useParent } from '../context';
import { PageHead } from '../ui/Page';
import {
  Button,
  Card,
  ConfirmButton,
  Empty,
  Section,
  Segmented,
  Stack,
  Stepper,
  Toggle,
  useToast,
} from '../ui/kit';
import styles from './pages.module.css';
import { useSettings } from './Settings';

/**
 * Photos: the family's own pictures for the wall's slideshow.
 *
 * The first choice is the display's own Google Photos screensaver, set up on the device (see the device guide).
 * This is the fallback that needs no account: a parent picks photos here; this phone shrinks them — which also
 * takes out where and when they were taken — and only then sends them, to the family's own private storage.
 */
export function Photos() {
  const parent = useParent();
  const toast = useToast();
  const [settings, set, guardian] = useSettings();
  const { view } = parent;
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const add = async (files: FileList) => {
    setProblem(null);
    const list = [...files].slice(0, 20);
    setProgress({ done: 0, total: list.length });
    let added = 0;
    for (const file of list) {
      try {
        const prepared = await preparePhoto(file);
        await uploadPhoto(prepared, newId());
        added += 1;
      } catch (error) {
        setProblem(error instanceof Error ? error.message : 'A photo could not be added.');
        break;
      }
      setProgress({ done: added, total: list.length });
    }
    setProgress(null);
    if (input.current) input.current.value = '';
    await store.sync();
    if (added > 0) toast(`Added ${added} ${added === 1 ? 'photo' : 'photos'}.`);
  };

  return (
    <>
      <PageHead title="Photos" onBack={() => parent.go('more')} />
      <Card tone="blue">
        Prefer the display’s own screensaver if you use Google Photos: set it up on the device itself. The
        photos here are only for HOMEBASE’s own slideshow.
      </Card>

      <Section title="The slideshow">
        <Card>
          <Stack>
            <Toggle
              label="Hide the photos for now"
              hint="For when there are visitors: the photo room shows nothing, and the pictures stay safe."
              checked={settings.memories.hidden}
              onChange={(hidden) => set({ memories: { hidden } })}
              testId="set-photos-hidden"
            />
            <Stepper
              label="Each photo stays for"
              value={settings.memories.secondsPerPhoto}
              min={10}
              max={120}
              step={5}
              onChange={(secondsPerPhoto) => set({ memories: { secondsPerPhoto } })}
              show={(value) => `${value} s`}
            />
            <Segmented
              label="How a photo fills the screen"
              value={settings.memories.fit}
              onChange={(fit) => set({ memories: { fit } })}
              options={[
                { value: 'cover', label: 'Fill it (edges may be cut)' },
                { value: 'contain', label: 'Show all of it' },
              ]}
            />
            <Toggle
              label="Show the time"
              checked={settings.memories.clock}
              onChange={(clock) => set({ memories: { clock } })}
            />
          </Stack>
        </Card>
      </Section>

      <Section
        title="Your photos"
        hint="Shrunk on this phone before they are sent, which removes the place and time stored inside them."
        action={
          guardian ? (
            <Button
              tone="primary"
              size="s"
              busy={progress !== null}
              onClick={() => input.current?.click()}
              testId="add-photos"
            >
              Add photos
            </Button>
          ) : undefined
        }
      >
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/*"
          multiple
          className="visually-hidden"
          aria-label="Choose photos"
          data-testid="photo-file"
          onChange={(event) => {
            if (event.target.files && event.target.files.length > 0) void add(event.target.files);
          }}
        />
        {progress && (
          <p role="status">
            Adding {progress.done + 1} of {progress.total}…
          </p>
        )}
        {problem && (
          <p className={styles.warning} role="alert">
            {problem}
          </p>
        )}
        {view.media.length === 0 ? (
          <Card>
            <Empty title="No photos yet">
              <p>Until you add some, the demo shows a few drawings instead.</p>
            </Empty>
          </Card>
        ) : (
          <ul className={styles.photoGrid} data-testid="photo-grid">
            {view.media.map((item) => (
              <li key={item.id} className={styles.photo} data-hidden={!item.inSlideshow}>
                <img
                  src={`/api/media/${item.id}/${item.widths[0] ?? 480}`}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                {guardian && (
                  <div className={styles.photoButtons}>
                    <button
                      type="button"
                      className={styles.photoButton}
                      aria-pressed={item.inSlideshow}
                      onClick={() =>
                        parent.tell('media.update', { mediaId: item.id, inSlideshow: !item.inSlideshow })
                      }
                    >
                      {item.inSlideshow ? 'Shown' : 'Hidden'}
                    </button>
                    <ConfirmButton
                      size="s"
                      label="Delete"
                      confirmLabel="Delete it"
                      onConfirm={() => parent.tell('media.remove', { mediaId: item.id })}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <p className={styles.itemNote}>
        Nothing here looks at faces, and no photo is sent to any other service. Deleting a photo removes it
        from the storage at once.
      </p>
    </>
  );
}
