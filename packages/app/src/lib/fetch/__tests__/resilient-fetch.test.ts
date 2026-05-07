import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resilientFetch } from '../resilient-fetch';

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Silence console.debug during tests.
vi.spyOn(console, 'debug').mockImplementation(() => {});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResponse(
  status: number,
  body: unknown = {},
  headers: Record<string, string> = {},
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : `Status ${status}`,
    headers: new Headers(headers),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    clone() {
      return makeResponse(status, body, headers);
    },
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resilientFetch', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    mockFetch.mockReset();
    // Deterministic jitter for backoff tests.
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Passthrough
  // -----------------------------------------------------------------------

  it('successful fetch passes through unchanged', async () => {
    const expected = makeResponse(200, { ok: true });
    mockFetch.mockResolvedValue(expected);

    const response = await resilientFetch('https://api.example.com/data');

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const data = await response.json();
    expect(data).toEqual({ ok: true });
  });

  // -----------------------------------------------------------------------
  // Exponential backoff on 500
  // -----------------------------------------------------------------------

  it('retries on 500 with exponential backoff', async () => {
    const fail = makeResponse(500, { error: 'Internal Server Error' });
    const success = makeResponse(200, { ok: true });

    // Fail twice, then succeed on third retry.
    mockFetch
      .mockResolvedValueOnce(fail)
      .mockResolvedValueOnce(fail)
      .mockResolvedValueOnce(success);

    const fetchPromise = resilientFetch('https://api.example.com/data', undefined, {
      baseDelay: 1000,
    });

    // First retry: 1000 * 2^0 + 0 jitter = 1000ms
    await vi.advanceTimersByTimeAsync(1000);

    // Second retry: 1000 * 2^1 + 0 jitter = 2000ms
    await vi.advanceTimersByTimeAsync(2000);

    const response = await fetchPromise;
    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  // -----------------------------------------------------------------------
  // Retry-After header
  // -----------------------------------------------------------------------

  it('respects Retry-After header on 429', async () => {
    const rateLimited = makeResponse(429, { error: 'Rate Limited' }, {
      'Retry-After': '5',
    });
    const success = makeResponse(200, { ok: true });

    mockFetch
      .mockResolvedValueOnce(rateLimited)
      .mockResolvedValueOnce(success);

    const fetchPromise = resilientFetch('https://api.example.com/data');

    // Retry-After says 5 seconds = 5000ms.
    await vi.advanceTimersByTimeAsync(5000);

    const response = await fetchPromise;
    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  // -----------------------------------------------------------------------
  // Non-retryable status codes
  // -----------------------------------------------------------------------

  it.each([400, 401, 403, 404])(
    'does not retry on %i',
    async (status) => {
      const errorResponse = makeResponse(status, { error: 'Client error' });
      mockFetch.mockResolvedValue(errorResponse);

      const response = await resilientFetch('https://api.example.com/data');

      expect(response.status).toBe(status);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    },
  );

  // -----------------------------------------------------------------------
  // GET deduplication
  // -----------------------------------------------------------------------

  it('GET deduplication: concurrent identical GETs share one fetch', async () => {
    const expected = makeResponse(200, { shared: true });
    mockFetch.mockResolvedValue(expected);

    const url = 'https://api.example.com/shared-resource';

    const [r1, r2, r3] = await Promise.all([
      resilientFetch(url),
      resilientFetch(url),
      resilientFetch(url),
    ]);

    // Only one actual fetch should have been made.
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // All three should get the data.
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(200);
  });

  it('does not deduplicate POST requests', async () => {
    const expected = makeResponse(200, { ok: true });
    mockFetch.mockResolvedValue(expected);

    const url = 'https://api.example.com/action';
    const options: RequestInit = { method: 'POST', body: '{}' };

    await Promise.all([
      resilientFetch(url, options),
      resilientFetch(url, options),
    ]);

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  // -----------------------------------------------------------------------
  // AbortSignal
  // -----------------------------------------------------------------------

  it('AbortSignal cancels retries', async () => {
    const fail = makeResponse(500, { error: 'fail' });
    mockFetch.mockResolvedValue(fail);

    const controller = new AbortController();

    const fetchPromise = resilientFetch(
      'https://api.example.com/data',
      { signal: controller.signal },
    );

    // Allow the first fetch to complete and start waiting for retry.
    await vi.advanceTimersByTimeAsync(100);

    // Abort before the retry delay elapses.
    controller.abort();

    await expect(fetchPromise).rejects.toThrow();
  });

  // -----------------------------------------------------------------------
  // Max retries exceeded
  // -----------------------------------------------------------------------

  it('max retries exceeded returns last error response', async () => {
    const fail = makeResponse(503, { error: 'Service Unavailable' });
    mockFetch.mockResolvedValue(fail);

    const fetchPromise = resilientFetch('https://api.example.com/data', undefined, {
      maxRetries: 2,
      baseDelay: 100,
    });

    // First retry: 100ms
    await vi.advanceTimersByTimeAsync(100);
    // Second retry: 200ms
    await vi.advanceTimersByTimeAsync(200);

    const response = await fetchPromise;
    // Should have attempted 3 times total (initial + 2 retries).
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(response.status).toBe(503);
  });

  it('max retries exceeded on network errors throws', async () => {
    // Use real timers with very short delays to avoid fake-timer
    // microtask ordering issues with rejected promises.
    vi.useRealTimers();

    mockFetch.mockImplementation(async () => {
      throw new TypeError('Failed to fetch');
    });

    await expect(
      resilientFetch(
        'https://api.example.com/data',
        { method: 'POST' },
        { maxRetries: 2, baseDelay: 1, maxDelay: 5 },
      ),
    ).rejects.toThrow('Failed to fetch');

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
