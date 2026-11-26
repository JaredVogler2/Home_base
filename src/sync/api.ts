/**
 * Talking to the server. One function, same-origin only, cookies included, JSON both ways — and one kind of
 * error, which always has a sentence fit to show a person.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** The request never reached the server (no signal, server down). Nothing was changed; it can be tried again. */
  get offline(): boolean {
    return this.status === 0;
  }
}

export async function api<T = unknown>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal,
    });
  } catch {
    throw new ApiError(0, 'network', 'HOMEBASE cannot reach the server just now.');
  }
  if (response.status === 204) return undefined as T;
  let parsed: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }
  if (!response.ok) {
    const error = (parsed as { error?: { code?: string; message?: string } } | null)?.error;
    // A page of HTML where JSON was expected means something in between answered (a proxy, a sign-in wall).
    throw new ApiError(
      error ? response.status : response.status >= 500 || !text ? response.status : 0,
      error?.code ?? 'unexpected',
      error?.message ?? 'Something went wrong. Nothing was changed.',
      (error as Record<string, unknown> | undefined) ?? {},
    );
  }
  return parsed as T;
}
