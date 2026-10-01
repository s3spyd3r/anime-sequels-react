export type MalErrorCode =
  | 'auth'
  | 'config'
  | 'not_found'
  | 'private'
  | 'rate_limit'
  | 'server'
  | 'network'
  | 'unsupported'
  | 'unknown';

export class MalError extends Error {
  readonly code: MalErrorCode;
  readonly status?: number;
  readonly serverMessage?: string;

  constructor(code: MalErrorCode, serverMessage?: string, status?: number) {
    super(serverMessage ?? code);
    this.name = 'MalError';
    this.code = code;
    this.status = status;
    this.serverMessage = serverMessage;
  }
}

/** Thrown when MyAnimeList rejects the app's client authentication. */
export class MalAuthError extends MalError {
  constructor(serverMessage = 'MyAnimeList client authentication failed') {
    super('auth', serverMessage);
  }
}
