/**
 * Resilient fetch wrapper with exponential backoff, retry, deduplication,
 * and rate-limit awareness.
 *
 * Drop-in replacement for native fetch() used by the Jira and GitHub clients.
 * See arch/enhancements/cycle-1/platform-resilient-api-fetch.md for the full
 * design rationale.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3). */
  maxRetries: number;
  /** Base delay in milliseconds before the first retry (default: 1000). */
  baseDelay: number;
  /** Maximum delay cap in milliseconds (default: 10000). */
  maxDelay: number;
  /** HTTP status codes that are eligible for retry. */
  retryOn: Set<number>;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10_000,
  retryOn: new Set([429, 500, 502, 503, 504]),
};

// ---------------------------------------------------------------------------
// In-flight GET deduplication map
// ---------------------------------------------------------------------------

const inflightGETs = new Map<string, Promise<Response>>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute the backoff delay for a given attempt (0-indexed).
 *
 * Uses exponential backoff: baseDelay * 2^attempt, capped at maxDelay,
 * plus random jitter in [0, 300ms).
 */
export function computeDelay(
  attempt: number,
  config: RetryConfig,
): number {
  const exponential = config.baseDelay * Math.pow(2, attempt);
  const capped = Math.min(exponential, config.maxDelay);
  const jitter = Math.random() * 300;
  return capped + jitter;
}

/**
 * Parse a `Retry-After` header value into a delay in milliseconds.
 *
 * The header can be either:
 *   - An integer (seconds to wait), or
 *   - An HTTP-date (absolute timestamp).
 *
 * Returns `null` if the header is missing or unparseable.
 */
function parseRetryAfter(header: string | null): number | null {
  if (header === null) return null;

  // Try integer seconds first.
  const seconds = Number(header);
  if (!Number.isNaN(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  // Try as HTTP-date.
  const date = new Date(header);
  if (!Number.isNaN(date.getTime())) {
    return Math.max(0, date.getTime() - Date.now());
  }

  return null;
}

/**
 * Returns true if the request method is (or defaults to) GET.
 */
function isGET(options?: RequestInit): boolean {
  const method = options?.method?.toUpperCase() ?? 'GET';
  return method === 'GET';
}

/**
 * Wait for the specified number of milliseconds.
 * If an AbortSignal is provided, the wait will reject early when aborted.
 */
function wait(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      return;
    }

    const timer = setTimeout(resolve, ms);

    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
      // Clean up listener when timer fires normally.
      const originalResolve = resolve;
      resolve = () => {
        signal.removeEventListener('abort', onAbort);
        originalResolve();
      };
    }
  });
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Perform a fetch with automatic retry, exponential backoff, rate-limit
 * header awareness, and GET request deduplication.
 *
 * @param url      - The resource URL.
 * @param options  - Standard `RequestInit` passed through to `fetch()`.
 * @param retryConfig - Optional override for retry behavior.
 * @returns The fetch `Response` on success.
 * @throws On non-retryable errors, after max retries, or if the AbortSignal fires.
 */
export async function resilientFetch(
  url: string,
  options?: RequestInit,
  retryConfig?: Partial<RetryConfig>,
): Promise<Response> {
  const config: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...retryConfig,
    retryOn: retryConfig?.retryOn ?? DEFAULT_RETRY_CONFIG.retryOn,
  };

  // GET deduplication: if an identical GET is already in-flight, share it.
  if (isGET(options)) {
    const existing = inflightGETs.get(url);
    if (existing) {
      // Return a clone so each consumer can independently read the body.
      return existing.then((r) => r.clone());
    }
  }

  const execute = async (): Promise<Response> => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      // Check for abort before each attempt.
      if (options?.signal?.aborted) {
        throw (
          options.signal.reason ??
          new DOMException('Aborted', 'AbortError')
        );
      }

      try {
        const response = await fetch(url, options);

        // Success -- return immediately.
        if (response.ok) {
          return response;
        }

        // Non-retryable status -- throw immediately.
        if (!config.retryOn.has(response.status)) {
          return response;
        }

        // Retryable status -- decide how long to wait.
        if (attempt < config.maxRetries) {
          let delay: number;

          if (response.status === 429) {
            const retryAfter = parseRetryAfter(
              response.headers.get('Retry-After'),
            );
            delay = retryAfter ?? computeDelay(attempt, config);
          } else {
            delay = computeDelay(attempt, config);
          }

          console.debug(
            `[resilientFetch] Retry ${attempt + 1}/${config.maxRetries} for ${url} ` +
              `(status ${response.status}, waiting ${Math.round(delay)}ms)`,
          );

          await wait(delay, options?.signal);
          continue;
        }

        // Max retries exceeded -- return the last response so the caller
        // can inspect the status.
        return response;
      } catch (error: unknown) {
        // Network errors (TypeError) are retryable.
        if (error instanceof TypeError && attempt < config.maxRetries) {
          const delay = computeDelay(attempt, config);

          console.debug(
            `[resilientFetch] Retry ${attempt + 1}/${config.maxRetries} for ${url} ` +
              `(network error: ${(error as Error).message}, waiting ${Math.round(delay)}ms)`,
          );

          await wait(delay, options?.signal);
          lastError = error;
          continue;
        }

        // Abort errors and non-retryable errors propagate immediately.
        throw error;
      }
    }

    // Should only be reached if all retries failed with network errors.
    throw lastError;
  };

  // For GET requests, store the in-flight promise for deduplication.
  if (isGET(options)) {
    const promise = execute();
    // Suppress unhandled rejection on auxiliary chains -- the rejection
    // still propagates to callers via the .then() chain returned below.
    promise.catch(() => {});
    promise.finally(() => inflightGETs.delete(url)).catch(() => {});
    inflightGETs.set(url, promise);
    // Return a clone so the original stays consumable for other dedup callers.
    return promise.then((r) => r.clone());
  }

  return execute();
}
