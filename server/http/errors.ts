/**
 * Things going wrong, said plainly. Every error the API returns has a short code for the program and a sentence
 * a grown-up can read. Nothing internal — a query, a stack, a secret — is ever in the sentence.
 */

export type ErrorCode =
  | 'bad_request'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'too_many'
  | 'payload_too_large'
  | 'unavailable'
  | 'internal';

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  too_many: 429,
  payload_too_large: 413,
  unavailable: 503,
  internal: 500,
};

export class HttpError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'HttpError';
    this.status = STATUS[code];
  }
}

export const badRequest = (message: string, extra?: Record<string, unknown>) =>
  new HttpError('bad_request', message, extra);
export const unauthenticated = (message = 'Please sign in.') => new HttpError('unauthenticated', message);
export const forbidden = (message = 'That is for a grown-up to do.') => new HttpError('forbidden', message);
export const notFound = (message = 'That is not here.') => new HttpError('not_found', message);
export const conflict = (message: string) => new HttpError('conflict', message);
export const tooMany = (retryAfter: number) =>
  new HttpError('too_many', 'Too many tries. Please wait a little and try again.', { retryAfter });
