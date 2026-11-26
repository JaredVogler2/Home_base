import { useSyncExternalStore } from 'react';
import type { Snapshot } from '../../shared/model';
import { store, type SyncState } from './store';

export function useSync(): SyncState {
  return useSyncExternalStore(store.subscribe, store.getState);
}

/** The household as it should be drawn right now. Only for screens that are shown once there is one. */
export function useView(): Snapshot {
  const view = useSync().view;
  if (!view) throw new Error('useView was used before there was anything to show');
  return view;
}
