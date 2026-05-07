/**
 * Service Worker communication bridge.
 *
 * The main thread sends tokens to the SW via postMessage so the SW
 * can inject Authorization headers into API requests. Tokens never
 * appear in localStorage — only token metadata (provider name, expiry)
 * is stored there for UI state rendering.
 *
 * Uses MessageChannel for request/response semantics over postMessage.
 */

import type { AuthProvider, TokenSet } from './types'

/** Timeout for SW message responses (ms) */
const SW_MESSAGE_TIMEOUT = 5_000

/**
 * Send a token to the Service Worker for storage in its memory-scoped Map.
 * The SW will use this token to inject Authorization headers on matching requests.
 */
export async function sendTokenToSW(provider: AuthProvider, token: TokenSet): Promise<void> {
  await postMessageToSW({
    type: 'SET_TOKEN',
    provider,
    token: {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt,
      provider: token.provider,
    },
  })
}

/**
 * Clear a token from the Service Worker's memory.
 */
export async function clearTokenInSW(provider: AuthProvider): Promise<void> {
  await postMessageToSW({
    type: 'CLEAR_TOKEN',
    provider,
  })
}

/**
 * Query the Service Worker for which providers currently have tokens stored.
 */
export async function getTokenStatusFromSW(): Promise<Record<AuthProvider, boolean>> {
  const response = await postMessageToSW({ type: 'GET_TOKEN_STATUS' })

  return (
    (response as Record<AuthProvider, boolean>) ?? {
      github: false,
      atlassian: false,
      'redhat-sso': false,
      google: false,
    }
  )
}

/**
 * Get a reference to the active Service Worker. Tries `controller` first
 * (set after the SW claims the page), then falls back to the registration's
 * `active` worker (available once the SW finishes activation, even before
 * it claims clients).
 */
async function getActiveWorker(): Promise<ServiceWorker | null> {
  if (navigator.serviceWorker?.controller) {
    return navigator.serviceWorker.controller
  }

  try {
    const reg = await Promise.race([navigator.serviceWorker?.ready, new Promise<undefined>((r) => setTimeout(r, 3000))])
    return reg?.active ?? null
  } catch {
    return null
  }
}

/**
 * Post a message to the active Service Worker and wait for a response
 * via a MessageChannel.
 */
async function postMessageToSW(message: unknown): Promise<unknown> {
  const sw = await getActiveWorker()
  if (!sw) {
    console.warn('[auth/sw-bridge] No active Service Worker available')
    return undefined
  }

  return new Promise((resolve, reject) => {
    const channel = new MessageChannel()

    const timeout = setTimeout(() => {
      reject(new Error('[auth/sw-bridge] Service Worker response timed out'))
    }, SW_MESSAGE_TIMEOUT)

    channel.port1.onmessage = (event: MessageEvent) => {
      clearTimeout(timeout)
      if (event.data?.error) {
        reject(new Error(event.data.error))
      } else {
        resolve(event.data?.payload)
      }
    }

    sw.postMessage(message, [channel.port2])
  })
}
