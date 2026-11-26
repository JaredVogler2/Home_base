import { useWall } from '../context';
import type { Box } from '../home/layout';
import { Academy } from './Academy';
import { Bank } from './Bank';
import { Calendar } from './Calendar';
import { GrownUps } from './GrownUps';
import { Memories } from './Memories';
import { Pantry } from './Pantry';
import { Quest } from './Quest';
import { Routines } from './Routines';

/** Whichever room is open. */
export function Scenes({ origin }: { origin: Box | null }) {
  const wall = useWall();
  switch (wall.scene) {
    case 'quest':
      return <Quest origin={origin} />;
    case 'bank':
      return <Bank origin={origin} />;
    case 'routines':
      return <Routines origin={origin} />;
    case 'pantry':
      return <Pantry origin={origin} />;
    case 'calendar':
      return <Calendar origin={origin} />;
    case 'academy':
      return <Academy origin={origin} />;
    case 'memories':
      return <Memories />;
    case 'grownups':
      return <GrownUps origin={origin} />;
    case 'home':
      return null;
  }
}
