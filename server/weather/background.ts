import { waitUntil } from '@vercel/functions';

/**
 * Work that should happen after a screen has had its answer, without making it wait.
 *
 * On Vercel a function is frozen as soon as it has responded, so the platform is told about the work
 * (`waitUntil`) and keeps the function alive until it is done. Anywhere else `waitUntil` does nothing at all, and
 * the work simply carries on in the running process. Either way a failure is logged and goes no further.
 *
 * `settled()` is for tests: it resolves once everything started so far has finished, so a test can wait for the
 * weather to be fetched instead of guessing how long that takes.
 */

const running = new Set<Promise<void>>();

export function afterResponse(label: string, work: () => Promise<unknown>): void {
  const promise: Promise<void> = Promise.resolve()
    .then(work)
    .then(
      () => undefined,
      (error: unknown) => console.error(`[${label}] background work failed:`, error),
    )
    .finally(() => running.delete(promise));
  running.add(promise);
  try {
    waitUntil(promise);
  } catch {
    // Not inside a request the platform knows about: the work still runs, it is just not waited for.
  }
}

/** Resolves when all background work started so far (and anything it started) has finished. */
export async function settled(): Promise<void> {
  while (running.size > 0) await Promise.all([...running]);
}
