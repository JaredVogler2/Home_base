import { openDB, type IDBPDatabase } from 'idb';
import type { Snapshot } from '../../shared/model';
import type { OpEnvelope } from '../../shared/ops';

/**
 * What a screen keeps for itself, in the browser's own database:
 *   - the last snapshot, so that a wall that restarts with no signal still shows the family's day;
 *   - the outbox: requests made but not yet answered, so that a tap made offline is not lost — not by a reload,
 *     not by an update of the app, not by the power going off.
 * Nothing else is kept. All of it is wiped the moment the screen is unpaired or signed out.
 */

const DB_NAME = 'homebase';
const DB_VERSION = 1;

export interface Cache {
  loadSnapshot(): Promise<Snapshot | null>;
  saveSnapshot(snapshot: Snapshot): Promise<void>;
  loadOutbox(): Promise<OpEnvelope[]>;
  addToOutbox(op: OpEnvelope, seq: number): Promise<void>;
  removeFromOutbox(ids: readonly string[]): Promise<void>;
  wipe(): Promise<void>;
}

interface StoredOp {
  id: string;
  seq: number;
  op: OpEnvelope;
}

export function openCache(): Cache {
  let handle: Promise<IDBPDatabase> | null = null;
  const db = () =>
    (handle ??= openDB(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('kv')) database.createObjectStore('kv');
        if (!database.objectStoreNames.contains('outbox')) {
          database.createObjectStore('outbox', { keyPath: 'id' }).createIndex('seq', 'seq');
        }
      },
    }));
  return {
    async loadSnapshot() {
      return ((await (await db()).get('kv', 'snapshot')) as Snapshot | undefined) ?? null;
    },
    async saveSnapshot(snapshot) {
      await (await db()).put('kv', snapshot, 'snapshot');
    },
    async loadOutbox() {
      const rows = (await (await db()).getAllFromIndex('outbox', 'seq')) as StoredOp[];
      return rows.map((row) => row.op);
    },
    async addToOutbox(op, seq) {
      await (await db()).put('outbox', { id: op.id, seq, op } satisfies StoredOp);
    },
    async removeFromOutbox(ids) {
      const tx = (await db()).transaction('outbox', 'readwrite');
      await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
    },
    async wipe() {
      const database = await db();
      const tx = database.transaction(['kv', 'outbox'], 'readwrite');
      await Promise.all([tx.objectStore('kv').clear(), tx.objectStore('outbox').clear(), tx.done]);
    },
  };
}

/** For browsers that refuse a database (private windows on some phones): everything works, nothing is kept. */
export function memoryCache(): Cache {
  let snapshot: Snapshot | null = null;
  const outbox = new Map<string, StoredOp>();
  return {
    loadSnapshot: async () => snapshot,
    saveSnapshot: async (next) => {
      snapshot = next;
    },
    loadOutbox: async () => [...outbox.values()].sort((a, b) => a.seq - b.seq).map((row) => row.op),
    addToOutbox: async (op, seq) => {
      outbox.set(op.id, { id: op.id, seq, op });
    },
    removeFromOutbox: async (ids) => {
      for (const id of ids) outbox.delete(id);
    },
    wipe: async () => {
      snapshot = null;
      outbox.clear();
    },
  };
}
