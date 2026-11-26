import { createContext, useContext } from 'react';
import type { Snapshot } from '../../shared/model';
import type { OpInput, OpType } from '../../shared/ops';
import type { ActionPictureId } from '../../shared/pictures';
import type { TockPose } from '../art/guide/Tock';
import type { Layout } from './home/layout';
import type { Sound } from './sound';

/**
 * What every screen on the wall can reach: the household as it should be drawn, who is playing, and the few
 * things a screen can do — go somewhere, ask for a change, have Tock say something, make a small sound.
 */

export type Scene =
  'home' | 'quest' | 'bank' | 'routines' | 'pantry' | 'calendar' | 'memories' | 'academy' | 'grownups';

export interface Wall {
  view: Snapshot;
  layout: Layout;
  /** The moment, by the server's clock, refreshed about once a minute. */
  nowMs: number;
  /** Minutes since midnight where the family lives. */
  minutes: number;
  /** The child who is playing, when one has said so. */
  who: string | null;
  setWho(profileId: string | null): void;
  scene: Scene;
  /** Go to a room. `from` is the room's place on the sheet, so the room can grow out of where it was tapped. */
  go(scene: Scene, from?: { x: number; y: number; w: number; h: number }): void;
  home(): void;
  /** Ask for a change; the screen shows the likely result at once. */
  ask<T extends OpType>(type: T, input: OpInput<T>): string;
  /** True while something this screen asked for, about this thing, has not been answered. */
  isSaving(id: string): boolean;
  /** Tock says it (aloud if the voice is on, and always in words). */
  tell(words: string, pose?: TockPose): void;
  /** What Tock last said, for "say it again". */
  said: { words: string; pose: TockPose };
  sound(name: Sound): void;
  /** A small gladness on the screen, gone in under two seconds. */
  celebrate(): void;
  /** Have Tock show a newcomer round the front of the house. */
  tour(): void;
  /** What the weather says to put on before going out, if it says anything. */
  wear: ActionPictureId | null;
  /** Quiet hours: dim, silent. */
  quiet: boolean;
  /** Nothing moves that does not have to. */
  still: boolean;
  online: boolean;
  pending: number;
  labels: boolean;
}

export const WallContext = createContext<Wall | null>(null);

export function useWall(): Wall {
  const wall = useContext(WallContext);
  if (!wall) throw new Error('useWall is for screens inside the wall');
  return wall;
}
