import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { SkyState, Snapshot } from '../../shared/model';
import type { OpInput, OpType } from '../../shared/ops';
import { instantOf, inWindow, isLocalTime, zonedParts } from '../../shared/time';
import type { TockPose } from '../art/guide/Tock';
import { useSync } from '../sync/hooks';
import { store } from '../sync/store';
import { StatusCloud } from './chrome/chrome';
import { WallContext, type Scene, type Wall as WallApi } from './context';
import { childById } from './derive';
import { Home } from './home/Home';
import type { Box } from './home/layout';
import { Pair } from './Pair';
import { Scenes } from './scenes/Scenes';
import { lookOfSky } from './sky';
import { configureSound, play, unlockSound, type Sound } from './sound';
import { configureVoice, say } from './speech';
import { Stage, useLayout } from './Stage';
import styles from './Wall.module.css';

/**
 * The wall: the picture-led side of HOMEBASE, for the screen in the kitchen and for a child's tablet.
 *
 * This file is the frame around the scenes. It keeps in step with the server, knows who is playing and which
 * room is open, sends the house home when nobody has touched it for a while, dims it at night, and gives every
 * scene the same few things to work with.
 */

/** For looking at a particular sky while drawing or testing: /wall?sky=rain&at=21:30 */
function skyOverride(): { weather: SkyState | null; at: string | null } {
  const params = new URLSearchParams(window.location.search);
  const sky = params.get('sky');
  const at = params.get('at');
  const states: SkyState[] = ['clear', 'partly', 'cloudy', 'fog', 'drizzle', 'rain', 'storm', 'snow', 'wind'];
  return {
    weather: states.includes(sky as SkyState) ? (sky as SkyState) : null,
    at: isLocalTime(at) ? at : null,
  };
}

export function Wall() {
  const sync = useSync();
  useEffect(() => {
    void store.start();
    return () => store.stop();
  }, []);

  if (sync.phase === 'stranger') return <Pair />;
  if (!sync.view) {
    return (
      <div className={styles.waiting} role="status">
        {sync.online ? null : <p>HOMEBASE cannot reach its server yet. It will keep trying.</p>}
      </div>
    );
  }
  return (
    <WallReady view={sync.view} online={sync.online} pending={sync.pending} pendingIds={sync.pendingIds} />
  );
}

function WallReady({
  view,
  online,
  pending,
  pendingIds,
}: {
  view: Snapshot;
  online: boolean;
  pending: number;
  pendingIds: ReadonlySet<string>;
}) {
  const layout = useLayout();
  const settings = view.household.settings;
  const [scene, setScene] = useState<Scene>('home');
  const [origin, setOrigin] = useState<Box | null>(null);
  const [chosen, setWhoState] = useState<string | null>(null);
  // A child who is no longer in the family (or was archived) is no longer "who is playing".
  const who = chosen && childById(view, chosen) ? chosen : null;
  const [said, setSaid] = useState<{ words: string; pose: TockPose }>({ words: '', pose: 'idle' });
  const [realNowMs, setNowMs] = useState(() => store.serverNow());
  const lastTouch = useRef(0);
  const [idle, setIdle] = useState(false);

  // The clock, by the minute: enough for a sky and for "is it bedtime".
  useEffect(() => {
    const tick = () => setNowMs(store.serverNow());
    const timer = setInterval(tick, 30_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  // In the demo, /wall?at=07:15 shows the house as it is at that time of day: sky, quiet hours, the day clock.
  const override = useMemo(() => skyOverride(), []);
  const realLocal = zonedParts(new Date(realNowMs), view.household.timeZone);
  const nowMs =
    view.household.demo && override.at
      ? instantOf(realLocal.date, override.at, view.household.timeZone).getTime()
      : realNowMs;
  const local = zonedParts(new Date(nowMs), view.household.timeZone);
  const quiet =
    settings.quietHours.enabled &&
    inWindow(local.minutes, settings.quietHours.start, settings.quietHours.end);
  const reducedMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const still = settings.calm || quiet || reducedMotion;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.motion = still ? 'still' : 'full';
    root.dataset.contrast = settings.contrast;
    return () => {
      delete root.dataset.motion;
      delete root.dataset.contrast;
    };
  }, [still, settings.contrast]);

  useEffect(() => {
    configureVoice(settings.voice, quiet);
    configureSound(settings.sounds && !quiet, settings.calm);
  }, [settings.voice, settings.sounds, settings.calm, quiet]);

  const tell = useCallback((words: string, pose: TockPose = 'point') => {
    setSaid({ words, pose });
    say(words);
  }, []);

  const home = useCallback(() => {
    setScene('home');
    setOrigin(null);
  }, []);

  // Nobody here: go home and forget who was playing, so the next child starts from the front door.
  useEffect(() => {
    lastTouch.current = Date.now();
    const touched = () => {
      lastTouch.current = Date.now();
      unlockSound();
      setIdle(false);
    };
    window.addEventListener('pointerdown', touched, { passive: true });
    window.addEventListener('keydown', touched);
    const timer = setInterval(() => {
      const away = Date.now() - lastTouch.current;
      if (away > settings.wall.idleHomeSeconds * 1000) {
        setIdle(true);
        setScene((current) => (current === 'memories' || current === 'home' ? current : 'home'));
        setWhoState(null);
        setSaid({ words: '', pose: 'idle' });
      }
      const slideshow = settings.wall.slideshowAfterMinutes;
      if (slideshow > 0 && away > slideshow * 60_000 && !settings.memories.hidden) {
        setScene((current) => (current === 'home' ? 'memories' : current));
      }
    }, 5_000);
    return () => {
      window.removeEventListener('pointerdown', touched);
      window.removeEventListener('keydown', touched);
      clearInterval(timer);
    };
  }, [settings.wall.idleHomeSeconds, settings.wall.slideshowAfterMinutes, settings.memories.hidden]);

  // Ask the server often while someone is here, seldom when nobody is, and hardly at all at night.
  useEffect(() => {
    store.setPace(quiet ? 'asleep' : idle ? 'idle' : 'active');
  }, [quiet, idle]);

  const look = useMemo(
    () =>
      lookOfSky({
        ms: nowMs,
        timeZone: view.household.timeZone,
        location: settings.location,
        daylight: settings.sky.daylight,
        weather: override.weather ?? (settings.sky.weather ? (view.weather?.state ?? null) : null),
        decor: settings.decor,
      }),
    [
      nowMs,
      view.household.timeZone,
      settings.location,
      settings.sky.daylight,
      settings.decor,
      override.weather,
      settings.sky.weather,
      view.weather?.state,
    ],
  );

  const api: WallApi = {
    view,
    layout,
    nowMs,
    minutes: local.minutes,
    who,
    setWho: setWhoState,
    scene,
    go: (next, from) => {
      setOrigin(from ?? null);
      setScene(next);
    },
    home,
    ask: <T extends OpType>(type: T, input: OpInput<T>) => store.dispatch(type, input),
    isSaving: (id) => pendingIds.has(id),
    tell,
    said,
    sound: (name: Sound) => play(name),
    quiet,
    still,
    online,
    pending,
    labels: settings.labels,
  };

  return (
    <WallContext.Provider value={api}>
      <Stage layout={layout} vars={look.vars}>
        <Home look={look} />
        {scene !== 'home' && <Scenes origin={origin} />}
        <StatusCloud online={online} pending={pending} />
        {quiet && settings.quietHours.dim && (
          <div className={styles.night} aria-hidden="true" style={{ '--shade': '0.3' } as CSSProperties} />
        )}
      </Stage>
    </WallContext.Provider>
  );
}
