import { newId } from '../../shared/ids';
import type { Snapshot } from '../../shared/model';
import {
  MAX_OPS_PER_REQUEST,
  type OpEnvelope,
  type OpInput,
  type OpOutcome,
  type OpType,
  type Rejection,
} from '../../shared/ops';
import { api, ApiError } from './api';
import { memoryCache, openCache, type Cache } from './cache';
import { applyAll, touchedBy } from './optimistic';

/**
 * The screen's side of keeping in step.
 *
 * It holds two things: what the server last said (the snapshot) and what this screen has asked for that has not
 * been answered yet (the outbox). What is drawn is the first with the second laid over it. A request goes into
 * the outbox the instant it is made — saved to the browser's database before it is sent — and leaves only when
 * the server has answered it, yes or no. In between it may be sent any number of times; the server does it once.
 *
 * The screen always says where things stand: in step, saving, or out of touch. It never claims the server has
 * agreed to something it has not.
 */

export type Pace = 'active' | 'idle' | 'asleep';

const PACE_MS: Record<Pace, number> = {
  /** Someone is using the screen. */
  active: 4_000,
  /** The screen is on and nobody is touching it. */
  idle: 30_000,
  /** Quiet hours, or the photos are showing. */
  asleep: 180_000,
};

const BACKOFF_MS = [2_000, 4_000, 8_000, 16_000, 30_000];

export interface Notice {
  id: string;
  type: OpType;
  reason: Rejection;
  message: string;
  at: number;
}

export interface SyncState {
  /** `starting` until the first look at the cache and the server; `stranger` when this browser is not signed in. */
  phase: 'starting' | 'ready' | 'stranger';
  /** What the server last said. */
  snapshot: Snapshot | null;
  /** What to draw: the snapshot with this screen's unanswered requests laid over it. */
  view: Snapshot | null;
  /** Requests made and not yet answered. */
  pending: number;
  /** The things those requests are about. */
  pendingIds: ReadonlySet<string>;
  /** False when the last attempt to reach the server failed. */
  online: boolean;
  /** When the server last answered, by this device's clock. */
  lastContact: number | null;
  /** Requests the server turned down, to be said gently and then forgotten. */
  notices: Notice[];
}

export interface StoreOptions {
  cache?: Cache;
  /** For tests: a clock and timers that can be held. */
  now?: () => number;
}

const NO_IDS: ReadonlySet<string> = new Set();

export class SyncStore {
  private state: SyncState = {
    phase: 'starting',
    snapshot: null,
    view: null,
    pending: 0,
    pendingIds: NO_IDS,
    online: true,
    lastContact: null,
    notices: [],
  };
  private listeners = new Set<() => void>();
  private outbox: OpEnvelope[] = [];
  private seq = 0;
  private cache: Cache;
  private now: () => number;
  private pace: Pace = 'active';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private failures = 0;
  private busy: Promise<void> | null = null;
  private started = false;
  /** How far this device's clock is from the server's. */
  private skew = 0;

  constructor(options: StoreOptions = {}) {
    let cache = options.cache;
    if (!cache) {
      try {
        cache = typeof indexedDB === 'undefined' ? memoryCache() : openCache();
      } catch {
        cache = memoryCache();
      }
    }
    this.cache = cache;
    this.now = options.now ?? (() => Date.now());
  }

  // --- reading ----------------------------------------------------------------------------------------------------

  getState = (): SyncState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** The time by the server's clock: what "today" and "a little while" are measured by. */
  serverNow(): number {
    return this.now() + this.skew;
  }

  private set(patch: Partial<SyncState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  private redraw(snapshot: Snapshot | null = this.state.snapshot, extra: Partial<SyncState> = {}): void {
    const ids = new Set<string>();
    for (const op of this.outbox) for (const id of touchedBy(op)) ids.add(id);
    this.set({
      snapshot,
      view: snapshot ? applyAll(snapshot, this.outbox) : null,
      pending: this.outbox.length,
      pendingIds: ids.size > 0 ? ids : NO_IDS,
      ...extra,
    });
  }

  // --- starting and stopping -----------------------------------------------------------------------------------------

  /** Begin: show what was kept from last time at once, then ask the server. */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    try {
      const [snapshot, outbox] = await Promise.all([this.cache.loadSnapshot(), this.cache.loadOutbox()]);
      this.outbox = outbox;
      this.seq = outbox.length;
      if (snapshot) this.redraw(snapshot, { phase: 'ready' });
    } catch {
      this.cache = memoryCache();
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.wake);
      window.addEventListener('focus', this.wake);
      document.addEventListener('visibilitychange', this.wake);
    }
    await this.sync();
  }

  stop(): void {
    this.started = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.wake);
      window.removeEventListener('focus', this.wake);
      document.removeEventListener('visibilitychange', this.wake);
    }
  }

  private wake = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    void this.sync();
  };

  /** How often to ask: quickly while someone is here, slowly when nobody is, hardly at all at night. */
  setPace(pace: Pace): void {
    if (pace === this.pace) return;
    const faster = PACE_MS[pace] < PACE_MS[this.pace];
    this.pace = pace;
    if (faster) void this.sync();
    else this.schedule();
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.started || this.state.phase === 'stranger') return;
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    // A screen nobody can see has nothing to ask (and a phone in a pocket should not run its battery down).
    if (hidden && this.outbox.length === 0) return;
    const wait =
      this.failures > 0
        ? (BACKOFF_MS[Math.min(this.failures - 1, BACKOFF_MS.length - 1)] ?? 30_000) *
          (0.8 + Math.random() * 0.4)
        : PACE_MS[this.pace];
    this.timer = setTimeout(() => void this.sync(), wait);
  }

  // --- asking for changes ----------------------------------------------------------------------------------------------

  /** Ask for a change. Returns at once; the screen shows the likely result straight away. */
  dispatch<T extends OpType>(type: T, input: OpInput<T>): string {
    const op: OpEnvelope<T> = { id: newId(), type, at: new Date(this.serverNow()).toISOString(), input };
    this.outbox = [...this.outbox, op as OpEnvelope];
    void this.cache.addToOutbox(op as OpEnvelope, ++this.seq).catch(() => undefined);
    this.redraw();
    void this.sync();
    return op.id;
  }

  /** Ask for a change and wait to hear how it went. For a grown-up's screen, where "saved" should mean saved. */
  async request<T extends OpType>(type: T, input: OpInput<T>): Promise<OpOutcome> {
    const id = this.dispatch(type, input);
    return new Promise((resolve) => {
      this.waiting.set(id, resolve);
    });
  }

  private waiting = new Map<string, (outcome: OpOutcome) => void>();

  dismissNotice(id: string): void {
    this.set({ notices: this.state.notices.filter((notice) => notice.id !== id) });
  }

  // --- the exchange ------------------------------------------------------------------------------------------------------

  /** Send what is waiting, then find out what is new. One at a time: a second call joins the first. */
  sync(): Promise<void> {
    if (this.busy) {
      this.again = true;
      return this.busy;
    }
    this.busy = this.exchange().finally(() => {
      this.busy = null;
      if (this.again) {
        this.again = false;
        void this.sync();
      } else {
        this.schedule();
      }
    });
    return this.busy;
  }

  private again = false;

  private async exchange(): Promise<void> {
    try {
      if (this.outbox.length > 0) {
        await this.push();
      } else {
        await this.pull();
      }
      this.failures = 0;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await this.becomeStranger();
        return;
      }
      // No signal, or the server is unwell. Nothing is lost: what is waiting keeps waiting.
      this.failures += 1;
      if (this.state.phase === 'starting' && !this.state.snapshot) {
        // Never been in touch from this browser and cannot be now: say so rather than spin for ever.
        this.set({ online: false });
      } else if (this.state.online) {
        this.set({ online: false });
      }
    }
  }

  private accept(snapshot: Snapshot): void {
    this.skew = new Date(snapshot.serverTime).getTime() - this.now();
    void this.cache.saveSnapshot(snapshot).catch(() => undefined);
    this.redraw(snapshot, { phase: 'ready', online: true, lastContact: this.now() });
  }

  private async pull(): Promise<void> {
    const have = this.state.snapshot;
    const query = have ? `?since=${have.rev}&access=${have.viewer.access}&today=${have.today}` : '';
    const snapshot = await api<Snapshot | undefined>('GET', `/sync${query}`);
    if (snapshot) this.accept(snapshot);
    else this.set({ online: true, lastContact: this.now(), phase: 'ready' });
  }

  private async push(): Promise<void> {
    const batch = this.outbox.slice(0, MAX_OPS_PER_REQUEST);
    const reply = await api<{ outcomes: OpOutcome[]; snapshot: Snapshot }>('POST', '/sync/ops', {
      ops: batch,
    });
    const answered: string[] = [];
    const notices: Notice[] = [];
    for (const outcome of reply.outcomes) {
      if (outcome.status === 'retry') continue;
      answered.push(outcome.id);
      const op = batch.find((candidate) => candidate.id === outcome.id);
      if (outcome.status === 'rejected' && op) {
        notices.push({
          id: outcome.id,
          type: op.type,
          reason: outcome.reason,
          message: outcome.message,
          at: this.now(),
        });
      }
      const waiter = this.waiting.get(outcome.id);
      if (waiter) {
        this.waiting.delete(outcome.id);
        waiter(outcome);
      }
    }
    this.outbox = this.outbox.filter((op) => !answered.includes(op.id));
    void this.cache.removeFromOutbox(answered).catch(() => undefined);
    if (notices.length > 0) this.set({ notices: [...this.state.notices, ...notices].slice(-5) });
    this.accept(reply.snapshot);
    if (this.outbox.length > 0) {
      if (answered.length === 0) throw new ApiError(503, 'retry', 'The server asked to try again.');
      this.again = true;
    }
  }

  /** This browser is not signed in (any more): forget everything it had kept. */
  private async becomeStranger(): Promise<void> {
    this.outbox = [];
    for (const waiter of this.waiting.values()) waiter({ id: '', status: 'retry' });
    this.waiting.clear();
    await this.cache.wipe().catch(() => undefined);
    this.set({ phase: 'stranger', snapshot: null, view: null, pending: 0, pendingIds: NO_IDS, online: true });
  }

  /** After signing in or pairing: start afresh as whoever this browser now is. */
  async reset(): Promise<void> {
    this.outbox = [];
    await this.cache.wipe().catch(() => undefined);
    this.set({ phase: 'starting', snapshot: null, view: null, pending: 0, pendingIds: NO_IDS });
    this.failures = 0;
    await this.sync();
  }

  async signOut(): Promise<void> {
    try {
      await api('POST', '/auth/logout', {});
    } catch {
      // Out of touch: the cookie stays, but nothing of the family stays on this device.
    }
    await this.becomeStranger();
  }
}

/** The one store of this page. */
export const store = new SyncStore();
