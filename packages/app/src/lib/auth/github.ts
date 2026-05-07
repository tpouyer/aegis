/**
 * GitHub OAuth 2.0 flow (standard, no PKCE).
 *
 * GitHub OAuth Apps don't support PKCE — only GitHub Apps do.
 * We use the standard Authorization Code flow with state parameter
 * for CSRF protection.
 *
 * Scopes: repo read:org read:user
 *
 * NOTE: GitHub's token exchange endpoint (POST /login/oauth/access_token)
 * does not support CORS from browser origins. A Cloudflare Worker proxy
 * handles the token exchange (configured via .well-known/aegis-configuration).
 */

import { getWellKnownConfig } from '@/lib/telemetry/config'
import { generateState } from './pkce'
import type { GitHubOAuthConfig, TokenSet } from './types'

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize'
const GITHUB_TOKEN_URL_DIRECT = 'https://github.com/login/oauth/access_token'

const SESSION_KEY_STATE = 'aegis_github_oauth_state'

export async function initiateGitHubAuth(config: GitHubOAuthConfig): Promise<void> {
  const state = generateState()
  localStorage.setItem(SESSION_KEY_STATE, state)

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scope || 'repo read:org read:user',
    state,
  })

  window.location.href = `${GITHUB_AUTH_URL}?${params.toString()}`
}

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

  const savedState = localStorage.getItem(SESSION_KEY_STATE)
  if (!state || state !== savedState) {
    throw new Error('GitHub OAuth state mismatch — possible CSRF attack')
  }

  localStorage.removeItem(SESSION_KEY_STATE)

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
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : Date.now() + 8 * 60 * 60 * 1000,
    provider: 'github',
  }
}
