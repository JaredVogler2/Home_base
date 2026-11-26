import { STRONG_COST } from './auth/crypto.js';
import { createApp } from './app.js';
import { readConfig, type Config } from './config.js';
import { sharedDatabase, type Database } from './db/client.js';
import type { Deps } from './deps.js';
import { seedDemo } from './domain/seed.js';
import { demoAcademyUrl } from './http/routes/demo.js';

/**
 * The server as it really runs: the real clock, the real network, and the database the environment names.
 * Made once for each process (or each warm serverless instance) and kept.
 */

const HOLDER = Symbol.for('homebase.runtime');
type Holder = { [HOLDER]?: { deps: Deps; ready: Promise<Database> | null } };

export function runtimeDeps(config: Config = readConfig()): Deps {
  const holder = globalThis as Holder;
  if (holder[HOLDER]) return holder[HOLDER].deps;
  const state: { deps: Deps; ready: Promise<Database> | null } = {
    deps: null as unknown as Deps,
    ready: null,
  };
  const deps: Deps = {
    config,
    now: () => new Date(),
    hashCost: STRONG_COST,
    fetch: (...args) => fetch(...args),
    database: () => {
      state.ready ??= sharedDatabase(config)
        .then(async (database) => {
          if (config.demo) {
            // A demo with nobody in it is no demo: the Maple Street family moves in on first start.
            const made = await seedDemo(database, {
              now: new Date(),
              hashCost: STRONG_COST,
              secretKey: config.secretKey,
              academyUrl: demoAcademyUrl(),
            });
            if (made) console.info('[demo] The Maple Street family (made-up data) has been set up.');
          }
          return database;
        })
        .catch((error: unknown) => {
          state.ready = null;
          throw error;
        });
      return state.ready;
    },
  };
  state.deps = deps;
  holder[HOLDER] = state;
  return deps;
}

export function runtimeApp() {
  return createApp(runtimeDeps());
}
