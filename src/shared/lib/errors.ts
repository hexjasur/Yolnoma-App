export class AppError extends Error {
  readonly status?: number;
  readonly code?: string;
  readonly cause?: unknown;

  constructor(message: string, options: { status?: number; code?: string; cause?: unknown } = {}) {
    super(message);
    this.name = 'AppError';
    this.status = options.status;
    this.code = options.code;
    this.cause = options.cause;
  }
}

export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof AppError || error instanceof Error) {
    return error.message || fallback;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return fallback;
}

export function isUnauthorizedError(error: unknown): boolean {
  if (error instanceof AppError && error.status === 401) return true;
  const message = getErrorMessage(error, '').toLowerCase();
  return ['unauthorized', 'invalid token', 'expired', 'session terminated'].some((term) => message.includes(term));
}

/**
 * One structured boundary for operational logs. UI layers display friendly
 * messages through the toast system; logs retain a precise, searchable scope.
 */
export function reportError(scope: string, error: unknown): void {
  console.error(`[${scope}]`, error);
}
