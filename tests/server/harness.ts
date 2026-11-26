import type { Hono } from 'hono';
import pg from 'pg';
import { newId } from '../../shared/ids.js';
import type { Snapshot } from '../../shared/model.js';
import type { OpInput, OpOutcome, OpType } from '../../shared/ops.js';
import { createApp } from '../../server/app.js';
import { TEST_COST } from '../../server/auth/crypto.js';
import { readConfig, type Config } from '../../server/config.js';
import { openDatabase, type Database } from '../../server/db/client.js';
import type { Deps } from '../../server/deps.js';
import type { AppEnv } from '../../server/http/env.js';

/**
 * A whole HOMEBASE server for a test, with nothing real in it: a database of its own (PGlite in memory, or a
 * fresh database on a local PostgreSQL when HOMEBASE_TEST_PG=1), a clock the test holds, and a network that
 * refuses to exist. Requests are handed straight to the app — no ports, no sockets.
 */

export const ORIGIN = 'http://homebase.test';
const PG_ADMIN =
  process.env.HOMEBASE_TEST_PG_URL ?? 'postgres://hb_owner:local-test-only@127.0.0.1:54329/postgres';
export const USING_POSTGRES = process.env.HOMEBASE_TEST_PG === '1';

export interface TestClock {
  now(): Date;
  set(iso: string): void;
  advance(ms: number): void;
}

export interface TestServer {
  app: Hono<AppEnv>;
  deps: Deps;
  database: Database;
  clock: TestClock;
  /** Every request the server tried to make to the outside world. */
  outbound: { url: string; init?: RequestInit }[];
  /** What the outside world says back; by default, nothing is reachable. */
  respond: (handler: (url: string, init?: RequestInit) => Response | Promise<Response>) => void;
  close(): Promise<void>;
}

export async function startServer(
  overrides: Partial<Config> = {},
  startAt = '2026-03-03T15:00:00Z',
): Promise<TestServer> {
  let current = new Date(startAt).getTime();
  const clock: TestClock = {
    now: () => new Date(current),
    set: (iso) => {
      current = new Date(iso).getTime();
    },
    advance: (ms) => {
      current += ms;
    },
  };

  let databaseUrl: string | null = null;
  let dropName: string | null = null;
  if (USING_POSTGRES) {
    dropName = `hb_test_${Math.random().toString(36).slice(2, 12)}`;
    const admin = new pg.Client({ connectionString: PG_ADMIN });
    await admin.connect();
    await admin.query(`create database ${dropName}`);
    await admin.end();
    const url = new URL(PG_ADMIN);
    url.pathname = `/${dropName}`;
    databaseUrl = url.toString();
  }

  const config: Config = {
    ...readConfig({}),
    databaseUrl,
    localData: 'memory://',
    openSignup: true,
    secretKey: 'test-secret-key-test-secret-key-test-secret-key',
    offline: false,
    ...overrides,
  };
  const database = await openDatabase(config);
  const outbound: TestServer['outbound'] = [];
  let responder: (url: string, init?: RequestInit) => Response | Promise<Response> = () => {
    throw new TypeError('fetch failed (tests have no network)');
  };
  const deps: Deps = {
    config,
    database: async () => database,
    now: clock.now,
    hashCost: TEST_COST,
    fetch: async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      outbound.push({ url, init });
      return responder(url, init);
    },
  };
  return {
    app: createApp(deps),
    deps,
    database,
    clock,
    outbound,
    respond: (handler) => {
      responder = handler;
    },
    close: async () => {
      await database.close();
      if (dropName) {
        const admin = new pg.Client({ connectionString: PG_ADMIN });
        await admin.connect();
        await admin.query(`drop database if exists ${dropName} with (force)`);
        await admin.end();
      }
    },
  };
}

export interface Reply<T = unknown> {
  status: number;
  body: T;
  headers: Headers;
}

/** A browser, more or less: it keeps its cookie and says where it is from. */
let addresses = 0;

export class Browser {
  cookie: string | null = null;
  snapshot: Snapshot | null = null;
  /** Each browser is somewhere of its own on the network, as real ones are. */
  address = `10.${(++addresses >> 16) & 255}.${(addresses >> 8) & 255}.${addresses & 255}`;

  constructor(
    readonly server: TestServer,
    readonly origin: string = ORIGIN,
  ) {}

  async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<Reply<T>> {
    const init: RequestInit = { method, headers: { ...headers } };
    const h = init.headers as Record<string, string>;
    if (this.cookie) h.cookie = this.cookie;
    h['x-forwarded-for'] ??= this.address;
    if (method !== 'GET' && h.origin === undefined) h.origin = this.origin;
    if (h.origin === '') delete h.origin;
    if (body !== undefined) {
      h['content-type'] ??= 'application/json';
      init.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
    const response = await this.server.app.request(`${ORIGIN}/api${path}`, init);
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      const pair = setCookie.split(';')[0] ?? '';
      this.cookie = pair.endsWith('=') ? null : pair;
    }
    const text = await response.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    return { status: response.status, body: parsed as T, headers: response.headers };
  }

  get<T = unknown>(path: string) {
    return this.request<T>('GET', path);
  }

  post<T = unknown>(path: string, body: unknown = {}) {
    return this.request<T>('POST', path, body);
  }

  /** Ask for everything, as a screen does when it starts. */
  async pull(): Promise<Snapshot> {
    const reply = await this.get<Snapshot>('/sync');
    if (reply.status !== 200) throw new Error(`pull failed: ${reply.status} ${JSON.stringify(reply.body)}`);
    this.snapshot = reply.body;
    return reply.body;
  }

  /** Ask "anything new?" as a screen does while it waits. */
  async poll(): Promise<number> {
    const s = this.snapshot;
    const query = s ? `?since=${s.rev}&access=${s.viewer.access}&today=${s.today}` : '';
    const reply = await this.get<Snapshot>(`/sync${query}`);
    if (reply.status === 200) this.snapshot = reply.body;
    return reply.status;
  }

  /** Make one request for a change, with a fresh id, and return its answer. */
  async op<T extends OpType>(type: T, input: OpInput<T>, id: string = newId()): Promise<OpOutcome> {
    const outcomes = await this.ops([{ id, type, input }]);
    const outcome = outcomes[0];
    if (!outcome) throw new Error('no outcome');
    return outcome;
  }

  async ops(envelopes: { id: string; type: string; input: unknown }[]): Promise<OpOutcome[]> {
    const reply = await this.post<{ outcomes: OpOutcome[]; snapshot: Snapshot }>('/sync/ops', {
      ops: envelopes.map((envelope) => ({ ...envelope, at: this.server.clock.now().toISOString() })),
    });
    if (reply.status !== 200) throw new Error(`ops failed: ${reply.status} ${JSON.stringify(reply.body)}`);
    this.snapshot = reply.body.snapshot;
    return reply.body.outcomes;
  }

  /** The same, expecting it to be done. */
  async do<T extends OpType>(type: T, input: OpInput<T>): Promise<Record<string, unknown>> {
    const outcome = await this.op(type, input);
    if (outcome.status !== 'applied' && outcome.status !== 'noop') {
      throw new Error(`${type} was ${outcome.status}: ${'message' in outcome ? outcome.message : ''}`);
    }
    return outcome.data;
  }
}

let people = 0;

export interface Family {
  parent: Browser;
  householdId: string;
  email: string;
  password: string;
  recoveryCodes: string[];
}

/** A new family with one grown-up, signed in. */
export async function newFamily(
  server: TestServer,
  options: { timeZone?: string; name?: string } = {},
): Promise<Family> {
  const parent = new Browser(server);
  const email = `parent${++people}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const password = 'correct horse battery';
  const reply = await parent.post<{ householdId: string; recoveryCodes: string[] }>('/auth/signup', {
    email,
    password,
    displayName: options.name ?? 'Alex',
    householdName: 'Test Family',
    timeZone: options.timeZone ?? 'America/Chicago',
  });
  if (reply.status !== 201) throw new Error(`signup failed: ${reply.status} ${JSON.stringify(reply.body)}`);
  return {
    parent,
    householdId: reply.body.householdId,
    email,
    password,
    recoveryCodes: reply.body.recoveryCodes,
  };
}

/** A wall screen, paired by that grown-up. */
export async function pairWall(family: Family, name = 'Kitchen'): Promise<Browser> {
  const wall = new Browser(family.parent.server);
  const start = await wall.post<{ code: string; secret: string }>('/pair/start');
  const claim = await family.parent.post('/pair/claim', { code: start.body.code, name });
  if (claim.status !== 200) throw new Error(`claim failed: ${JSON.stringify(claim.body)}`);
  const collect = await wall.post<{ status: string }>('/pair/collect', {
    code: start.body.code,
    secret: start.body.secret,
  });
  if (collect.body.status !== 'paired') throw new Error(`collect: ${collect.body.status}`);
  return wall;
}

export async function addChild(
  family: Family,
  nickname: string,
  options: { ageBand?: 'toddler' | 'preschool' | 'early' | 'baby'; avatar?: string } = {},
): Promise<string> {
  const profileId = newId();
  await family.parent.do('profile.create', {
    profileId,
    nickname,
    avatar: (options.avatar ?? 'fox') as 'fox',
    ageBand: options.ageBand ?? 'preschool',
    independent: true,
  });
  return profileId;
}

export interface TaskOptions {
  stars?: number;
  verification?: 'auto' | 'guardian';
  assignees?: string[];
  shared?: boolean;
  schedule?: OpInput<'task.create'>['schedule'];
  kind?: 'core' | 'bonus';
  skip?: 'child' | 'grownup' | 'off';
  title?: string;
}

export async function addTask(family: Family, options: TaskOptions = {}): Promise<string> {
  const templateId = newId();
  await family.parent.do('task.create', taskInput(templateId, options));
  return templateId;
}

export function taskInput(templateId: string, options: TaskOptions = {}): OpInput<'task.create'> {
  return {
    templateId,
    kind: options.kind ?? 'core',
    title: options.title ?? 'Blocks away',
    picture: 'blocks',
    say: null,
    steps: [],
    schedule: options.schedule ?? { kind: 'daily' },
    assignees: options.assignees ?? [],
    shared: options.shared ?? false,
    stars: options.stars ?? 2,
    effort: 1,
    verification: options.verification ?? 'auto',
    skip: options.skip ?? 'child',
    needsAdult: false,
    timerSeconds: null,
  };
}

export async function addReward(
  family: Family,
  price = 5,
  options: { stock?: number | null; title?: string } = {},
): Promise<string> {
  const rewardId = newId();
  await family.parent.do('reward.create', {
    rewardId,
    title: options.title ?? 'Family game',
    picture: 'game',
    say: null,
    price,
    stock: options.stock ?? null,
    profiles: [],
  });
  return rewardId;
}

export function walletOf(snapshot: Snapshot, profileId: string) {
  return (
    snapshot.wallets.find((wallet) => wallet.profileId === profileId) ?? {
      profileId,
      available: 0,
      reserved: 0,
      lifetime: 0,
    }
  );
}

export function occurrenceOf(snapshot: Snapshot, templateId: string, profileId: string | null) {
  const found = snapshot.occurrences.find((o) => o.templateId === templateId && o.profileId === profileId);
  if (!found) throw new Error('no such occurrence in the snapshot');
  return found;
}
