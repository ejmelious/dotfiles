export interface RetryOptions {
  /** Total number of calls to make, including the first one. Must be >= 1. */
  attempts: number;
  /** Delay before the first retry; doubles after each further failure. */
  baseDelayMs: number;
  /** Errors for which this returns false are rethrown immediately, without retrying. */
  isRetryable?: (error: unknown) => boolean;
  /** Injected so callers (and tests) control waiting. */
  sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Calls `fn` until it succeeds or `attempts` calls have failed, waiting
 * baseDelayMs, 2*baseDelayMs, 4*baseDelayMs… between calls. When every
 * attempt fails, rejects with the error from the last attempt.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { attempts, baseDelayMs, isRetryable = () => true, sleep = realSleep } = options;
  if (!Number.isInteger(attempts) || attempts < 1) throw new RangeError('attempts must be an integer >= 1');

  let lastError: unknown;
  for (let attempt = 0; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRetryable(error)) throw error;
      if (attempt < attempts) await sleep(baseDelayMs * 2 ** attempt);
    }
  }
  throw lastError;
}
