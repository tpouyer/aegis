/**
 * GitHub OAuth 2.0 flow with PKCE.
 *
 * Scopes: repo read:org read:user
 *
 * NOTE: GitHub's token exchange endpoint (POST /login/oauth/access_token)
 * does not support CORS from browser origins. In production, this requires
 * either:
 *   1. A thin CORS proxy (e.g. Cloudflare Worker)
 *   2. A serverless function that performs the exchange
 *
 * The code below is structured for the full flow; the fetch to the token
 * endpoint will need to be routed through such a proxy.
 */

import { generateCodeChallenge, generateCodeVerifier, generateState } from './pkce'
import { getWellKnownConfig } from '@/lib/telemetry/config'
import type { GitHubOAuthConfig, TokenSet } from './types'

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize'
const GITHUB_TOKEN_URL_DIRECT = 'https://github.com/login/oauth/access_token'

const SESSION_KEY_VERIFIER = 'aegis_github_pkce_verifier'
const SESSION_KEY_STATE = 'aegis_github_oauth_state'

/**
 * Initiate the GitHub OAuth flow by redirecting the user to GitHub's
 * authorization endpoint with PKCE parameters.
 */
export async function initiateGitHubAuth(config: GitHubOAuthConfig): Promise<void> {
  const verifier = generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)
  const state = generateState()

  // Store PKCE verifier and state in sessionStorage for the callback
  sessionStorage.setItem(SESSION_KEY_VERIFIER, verifier)
  sessionStorage.setItem(SESSION_KEY_STATE, state)

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scope || 'repo read:org read:user',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    response_type: 'code',
  })

  window.location.href = `${GITHUB_AUTH_URL}?${params.toString()}`
}

/**
 * Handle the OAuth callback from GitHub. Validates state, exchanges the
 * authorization code for tokens using PKCE.
 *
 * @param params - URLSearchParams from the callback URL
 * @returns TokenSet with the GitHub access token
 * @throws Error if state mismatch, missing code, or token exchange fails
 */
export async function handleGitHubCallback(params: URLSearchParams, config: GitHubOAuthConfig): Promise<TokenSet> {
  const code = params.get('code')
  const state = params.get('state')
  const error = params.get('error')

  if (error) {
    const description = params.get('error_description') || error
    throw new Error(`GitHub OAuth error: ${description}`)
  }

  if (!code) {
    throw new Error('GitHub OAuth callback missing authorization code')
  }

  // Validate state parameter to prevent CSRF
  const savedState = sessionStorage.getItem(SESSION_KEY_STATE)
  if (!state || state !== savedState) {
    throw new Error('GitHub OAuth state mismatch — possible CSRF attack')
  }

  const verifier = sessionStorage.getItem(SESSION_KEY_VERIFIER)
  if (!verifier) {
    throw new Error('GitHub OAuth PKCE verifier not found in session')
  }

  // Clean up session storage
  sessionStorage.removeItem(SESSION_KEY_STATE)
  sessionStorage.removeItem(SESSION_KEY_VERIFIER)

  const proxyUrl = getWellKnownConfig().auth?.githubTokenProxyUrl
  const tokenUrl = proxyUrl || GITHUB_TOKEN_URL_DIRECT
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: config.clientId,
      code,
      code_verifier: verifier,
      redirect_uri: config.redirectUri,
    }),
  })

  if (!response.ok) {
    throw new Error(`GitHub token exchange failed: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(`GitHub token exchange error: ${data.error_description || data.error}`)
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : Date.now() + 8 * 60 * 60 * 1000, // Default 8 hours if not specified
    provider: 'github',
  }
}
