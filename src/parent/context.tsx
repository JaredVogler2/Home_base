import { createContext, useContext } from 'react';
import type { AccessLevel, Member, Snapshot } from '../../shared/model';
import type { OpInput, OpType } from '../../shared/ops';

/**
 * What every grown-ups' screen is handed: the household as it stands, who is looking, and two ways to ask for a
 * change — `ask`, which waits to hear that it was done, and `tell`, which does not (for ticks and approvals,
 * shown at once and put right by the server if it disagrees).
 */
export interface ParentApi {
  view: Snapshot;
  /** The grown-up signed in on this phone. */
  me: Member | null;
  can: (level: AccessLevel) => boolean;
  ask: <T extends OpType>(type: T, input: OpInput<T>) => Promise<boolean>;
  tell: <T extends OpType>(type: T, input: OpInput<T>) => void;
  go: (section: string, ...rest: string[]) => void;
  online: boolean;
  pending: number;
  isSaving: (id: string) => boolean;
}

export const ParentContext = createContext<ParentApi | null>(null);

export function useParent(): ParentApi {
  const value = useContext(ParentContext);
  if (!value) throw new Error('useParent was used outside the grown-ups’ side');
  return value;
}
