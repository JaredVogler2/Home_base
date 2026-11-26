import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { BADGES } from '../../shared/badges';
import type { SkyState, Snapshot, Weather } from '../../shared/model';
import type { OpInput, OpType } from '../../shared/ops';
import { instantOf, inWindow, isLocalTime, zonedParts } from '../../shared/time';
import type { TockPose } from '../art/guide/Tock';
import { useSync } from '../sync/hooks';
import { store } from '../sync/store';
import { Celebration } from './Celebration';
import { StatusCloud } from './chrome/chrome';
import { useWall, WallContext, type Scene, type Wall as WallApi } from './context';
import { childById, gladTidings, wearFor } from './derive';
import { Home } from './home/Home';
import { Tour, tourSeen } from './home/Tour';
import type { Box } from './home/layout';
import { keepsUp, sampleFrames } from './pace';
import { Pair } from './Pair';
import { cameBackFromAcademy } from './scenes/Academy';
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
  const [glad, setGlad] = useState({ count: 0, showing: false });
  const [touring, setTouring] = useState(false);

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

  // A display that cannot draw the ambient movement smoothly does without it (see ./pace). Judged once the
  // house has been up for a few seconds, and again later in case the first look was during start-up.
  const [light, setLight] = useState(false);
  useEffect(() => {
    if (still || light) return;
    let sample: ReturnType<typeof sampleFrames> | null = null;
    const look = () => {
      sample = sampleFrames(3_000);
      void sample.done.then((frames) => {
        if (keepsUp(frames) === false) setLight(true);
      });
    };
    const first = window.setTimeout(look, 5_000);
    const second = window.setTimeout(look, 60_000);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
      sample?.cancel();
    };
  }, [still, light]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.motion = still ? 'still' : light ? 'light' : 'full';
    root.dataset.contrast = settings.contrast;
    return () => {
      delete root.dataset.motion;
      delete root.dataset.contrast;
    };
  }, [still, light, settings.contrast]);

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

  // Ask the server often while someone is here (at any hour), seldom when nobody is, and only now and then when
  // nobody is and there is nothing to keep fresh: at night, or while the photos are showing.
  const resting = quiet || scene === 'memories';
  useEffect(() => {
    store.setPace(!idle ? 'active' : resting ? 'asleep' : 'idle');
  }, [resting, idle]);

  // The weather the wall goes by: what the server last heard, if the family has switched the weather on.
  const weather: Weather | null = override.weather
    ? {
        state: override.weather,
        temperature: null,
        units: 'metric',
        at: new Date(nowMs).toISOString(),
        stale: false,
      }
    : settings.sky.weather
      ? view.weather
      : null;

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
    celebrate: () => setGlad((value) => ({ count: value.count + 1, showing: true })),
    wear: wearFor(weather),
    tour: () => setTouring(true),
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
        {scene === 'home' && touring && !quiet && <Tour onDone={() => setTouring(false)} />}
        {glad.showing && (
          <Celebration key={glad.count} onDone={() => setGlad((value) => ({ ...value, showing: false }))} />
        )}
        <Watcher view={view} onFirstVisit={() => setTouring(true)} />
        <StatusCloud online={online} pending={pending} />
        {quiet && settings.quietHours.dim && (
          <div
            className={styles.night}
            aria-hidden="true"
            style={{ '--shade': '0.3' } as CSSProperties}
            data-testid="night"
          />
        )}
      </Stage>
    </WallContext.Provider>
  );
}

/**
 * Notices what has just happened and has Tock be glad about it: a grown-up said yes on their phone, a badge
 * was reached, a reward was agreed. It also greets a child coming home from the Academy, and starts the
 * showing-round the first time a screen is used.
 */
function Watcher({ view, onFirstVisit }: { view: Snapshot; onFirstVisit: () => void }) {
  const wall = useWall();
  const before = useRef<Snapshot | null>(null);

  useEffect(() => {
    if (cameBackFromAcademy()) wall.tell('Welcome home!', 'wave');
    else if (!tourSeen() && !wall.quiet) onFirstVisit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const earlier = before.current;
    before.current = view;
    if (!earlier || wall.quiet) return;
    const tidings = gladTidings(earlier, view, wall.who);
    const first = tidings[0];
    if (!first) return;
    wall.celebrate();
    wall.sound(first.kind === 'badge' ? 'star' : 'done');
    if (first.kind === 'badge') wall.tell(BADGES[first.badge].say, 'cheer');
    else if (first.kind === 'stars')
      wall.tell(
        first.stars === 1 ? 'A grown-up said yes. A star for you!' : 'A grown-up said yes. Stars for you!',
        'cheer',
      );
    else if (first.kind === 'reward-yes') wall.tell(`Yes! ${first.title}.`, 'cheer');
    else wall.tell(`${first.title}. Enjoy!`, 'cheer');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  return null;
}
