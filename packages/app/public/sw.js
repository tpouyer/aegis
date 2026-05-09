/**
 * Aegis Service Worker
 *
 * Responsibilities:
 *   1. Static asset caching (SPA shell, WASM binary, manifest)
 *   2. Auth token management (store in memory, inject into API requests)
 *   3. API proxy: inject Authorization headers for Jira, GitHub, Vertex AI
 *   4. LLM API relay: rewrite /_aegis/llm/ URLs to actual provider endpoints
 *   5. Cache strategies: cache-first for static, network-first for dynamic
 *
 * Security:
 *   - Tokens stored in a Map in SW memory scope — not accessible to page JS
 *   - Immune to XSS attacks that can read localStorage/sessionStorage
 *   - Tokens communicated to SW via postMessage from main thread
 */

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `aegis-static-${CACHE_VERSION}`;

/**
 * URL patterns for API endpoints that need auth header injection.
 */
const API_PATTERNS = {
  jira: /\.atlassian\.net\/rest\/api/,
  github: /api\.github\.com/,
  vertex: /-aiplatform\.googleapis\.com/,
  llmRelay: /\/_aegis\/llm\//,  // matches both /_aegis/llm/ and /aegis/_aegis/llm/
};

/**
 * Static assets to precache on install (app shell).
 * These are the minimum files needed for the SPA to render.
 */
const PRECACHE_URLS = [
  '/',
  '/index.html',
];

/**
 * Token storage — lives in Service Worker memory scope.
 * Not accessible to page JavaScript (XSS protection).
 * Key: provider name (string), Value: token object
 */
const tokens = new Map();

// ─── Install ────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

// ─── Activate ───────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('aegis-') && name !== STATIC_CACHE)
            .map((name) => caches.delete(name)),
        );
      })
      .then(() => self.clients.claim()),
  );
});

// ─── Fetch ──────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // LLM relay: rewrite /_aegis/llm/ URLs to actual provider endpoints
  if (API_PATTERNS.llmRelay.test(url.pathname)) {
    event.respondWith(handleLLMRelay(event.request, url));
    return;
  }

  // Jira API: inject Atlassian token
  if (API_PATTERNS.jira.test(url.href)) {
    event.respondWith(handleApiRequest(event.request, 'atlassian'));
    return;
  }

  // GitHub API: inject GitHub token
  if (API_PATTERNS.github.test(url.href)) {
    event.respondWith(handleApiRequest(event.request, 'github'));
    return;
  }

  // Vertex AI: inject Google token
  if (API_PATTERNS.vertex.test(url.href)) {
    event.respondWith(handleApiRequest(event.request, 'google'));
    return;
  }

  // Same-origin static assets: cache-first
  if (url.origin === self.location.origin && !isApiPath(url.pathname)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Everything else: network-first
  event.respondWith(networkFirst(event.request));
});

// ─── Message ────────────────────────────────────────────────────────────────

self.addEventListener('message', (event) => {
  if (event.source && event.source.type !== 'window') {
    return;
  }

  const { data } = event;
  const port = event.ports[0];

  switch (data?.type) {
    case 'SET_TOKEN': {
      tokens.set(data.provider, data.token);
      respond(port, { success: true });
      break;
    }

    case 'CLEAR_TOKEN': {
      tokens.delete(data.provider);
      respond(port, { success: true });
      break;
    }

    case 'GET_TOKEN_STATUS': {
      const status = {
        github: tokens.has('github'),
        atlassian: tokens.has('atlassian'),
        'redhat-sso': tokens.has('redhat-sso'),
        google: tokens.has('google'),
      };
      respond(port, { payload: status });
      break;
    }

    default:
      respond(port, { error: `Unknown message type: ${data?.type}` });
  }
});

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Check if a token has expired. Adds a 60-second buffer to account
 * for clock skew and network latency — mirrors AuthManager.isTokenExpired().
 */
function isTokenExpired(token) {
  const BUFFER_MS = 60_000;
  return Date.now() >= token.expiresAt - BUFFER_MS;
}

/**
 * Handle an API request by injecting the appropriate auth token.
 * Falls through to network if no token is available or if the token
 * has expired. On expiry the token is removed from the SW map and
 * the main thread is notified so it can update UI auth state.
 */
async function handleApiRequest(request, provider) {
  const token = tokens.get(provider);

  if (!token) {
    // No token available — pass through without auth
    return fetch(request);
  }

  if (isTokenExpired(token)) {
    // Token has expired — remove it and notify all clients
    tokens.delete(provider);
    notifyClientsTokenExpired(provider);
    // Let the request go through unauthenticated so the caller
    // receives a 401 it can handle (e.g. show re-auth UI)
    return fetch(request);
  }

  const headers = new Headers(request.headers);
  headers.set('Authorization', `Bearer ${token.accessToken}`);

  const authedRequest = new Request(request, { headers });
  return fetch(authedRequest);
}

/**
 * Notify all controlled clients that a token has expired.
 * The main thread can listen for this to update auth state.
 */
async function notifyClientsTokenExpired(provider) {
  const clientList = await self.clients.matchAll({ type: 'window' });
  for (const client of clientList) {
    client.postMessage({
      type: 'TOKEN_EXPIRED',
      provider,
    });
  }
}

/**
 * Handle LLM relay requests.
 *
 * URL format: /_aegis/llm/{provider}/{...path}
 *
 * The relay rewrites the URL to the actual provider endpoint and
 * injects the appropriate auth token. This allows the SPA to make
 * requests to a single origin while the SW routes to the correct
 * provider.
 */
async function handleLLMRelay(request, url) {
  const relayIndex = url.pathname.indexOf('/_aegis/llm/');
  const pathAfterRelay = url.pathname.substring(relayIndex + '/_aegis/llm/'.length);
  const pathParts = pathAfterRelay.split('/');
  const provider = pathParts[0];
  const remainingPath = pathParts.slice(1).join('/');

  let targetUrl;
  let authProvider;

  switch (provider) {
    case 'vertex': {
      const vertexUrl = `https://${remainingPath}`;
      if (!vertexUrl.match(/^https:\/\/[a-z0-9-]+-aiplatform\.googleapis\.com\//)) {
        return new Response(
          JSON.stringify({ error: 'Vertex AI relay restricted to *-aiplatform.googleapis.com' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        );
      }
      targetUrl = vertexUrl;
      authProvider = 'google';
      break;
    }
    case 'anthropic': {
      targetUrl = `https://api.anthropic.com/${remainingPath}`;
      authProvider = 'anthropic';
      break;
    }
    case 'openai': {
      targetUrl = `https://api.openai.com/${remainingPath}`;
      authProvider = 'openai';
      break;
    }
    case 'custom': {
      const customConfig = tokens.get('custom');
      const decoded = decodeURIComponent(remainingPath);
      if (!customConfig?.endpoint || !decoded.startsWith(customConfig.endpoint)) {
        return new Response(
          JSON.stringify({ error: 'Relay URL does not match configured custom endpoint' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        );
      }
      targetUrl = decoded;
      authProvider = 'custom';
      break;
    }
    default: {
      return new Response(
        JSON.stringify({ error: `Unknown LLM provider: ${provider}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }
  }

  const headers = new Headers(request.headers);

  if (authProvider) {
    const token = tokens.get(authProvider);
    if (token) {
      if (authProvider === 'anthropic') {
        headers.set('x-api-key', token.accessToken);
      } else {
        headers.set('Authorization', `Bearer ${token.accessToken}`);
      }
    }
  }

  // Remove the host header to avoid CORS issues
  headers.delete('host');

  const relayedRequest = new Request(targetUrl, {
    method: request.method,
    headers,
    body: request.body,
    redirect: 'follow',
  });

  return fetch(relayedRequest);
}

/**
 * Cache-first strategy for static assets.
 * Returns cached response if available, otherwise fetches from network
 * and updates the cache.
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
      return response;
    }
    // Non-OK response for navigation → serve index.html (SPA routing)
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/index.html');
      if (fallback) return fallback;
    }
    return response;
  } catch {
    // Offline fallback — return the cached index.html for navigation requests
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/index.html');
      if (fallback) return fallback;
    }
    throw new Error('Network unavailable and no cached response');
  }
}

/**
 * Network-first strategy for dynamic content.
 * Tries network first, falls back to cache on failure.
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    throw new Error('Network unavailable and no cached response');
  }
}

/**
 * Send a response back through a MessageChannel port.
 */
function respond(port, data) {
  if (port) {
    port.postMessage(data);
  }
}

/**
 * Check if a pathname is an API path (should not be cached as static).
 */
function isApiPath(pathname) {
  return (
    pathname.includes('/api/') ||
    pathname.includes('/_aegis/') ||
    pathname.includes('/rest/')
  );
}
