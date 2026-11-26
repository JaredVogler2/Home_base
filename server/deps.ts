import type { HashCost } from './auth/crypto.js';
import type { Config } from './config.js';
import type { Database } from './db/client.js';

/**
 * Everything the server needs from outside itself, handed in rather than reached for. In production these are
 * the real database, the real clock and the real network; a test hands in its own, and can then make it any
 * moment it likes and watch every request that would have left the building.
 */
export interface Deps {
  config: Config;
  database: () => Promise<Database>;
  now: () => Date;
  hashCost: HashCost;
  /** For the few calls that leave: the weather, a calendar's link, a model. */
  fetch: typeof fetch;
}
