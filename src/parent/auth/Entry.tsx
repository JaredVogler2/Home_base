import { ToastHost } from '../ui/kit';
import { Auth, type AuthMode } from './Auth';

/** The ways in that have an address of their own: an invitation link and a reset link. */
export function Entry({ start, code }: { start: AuthMode; code: string | null }) {
  return (
    <ToastHost>
      <Auth start={start} code={code} />
    </ToastHost>
  );
}
