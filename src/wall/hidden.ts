import { useEffect, useState } from 'react';

/**
 * Whether the wall can be seen at all. A display's screen saver, its own Calendar Mode, or another app in front
 * all leave the page running with nobody able to see it; the browser says so, and the wall then holds still —
 * no animation, no talking, no turning of photographs — until it is back in front.
 */
export function useHidden(): boolean {
  const [hidden, setHidden] = useState(
    () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
  );
  useEffect(() => {
    const look = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', look);
    return () => document.removeEventListener('visibilitychange', look);
  }, []);
  return hidden;
}
