/**
 * Red Hat SSO (OIDC) Authorization Code flow with PKCE.
 *
 * Red Hat SSO is the primary identity provider for RH employees.
 * It uses standard OpenID Connect, so we discover endpoints via
 * .well-known/openid-configuration.
 *
 * Scopes: openid profile email
 *
 * Federation: RH SSO federates to Atlassian Cloud, so Jira access
 * is seamless for authenticated RH employees. GitHub (ansible org)
 * and Google (Vertex AI) require separate OAuth flows.
 */

import { generateCodeChallenge, generateCodeVerifier, generateState } from './pkce'
import type { OIDCDiscoveryDocument, RedHatSSOConfig, TokenSet } from './types'

const SESSION_KEY_VERIFIER = 'aegis_rhsso_pkce_verifier'
const SESSION_KEY_STATE = 'aegis_rhsso_oauth_state'

/** Cache for OIDC discovery documents by issuer URL */
const discoveryCache = new Map<string, OIDCDiscoveryDocument>()

/**
 * Fetch and cache the OIDC discovery document from the issuer's
 * .well-known/openid-configuration endpoint.
 */
export async function discoverOIDCConfig(issuerUrl: string): Promise<OIDCDiscoveryDocument> {
  const cached = discoveryCache.get(issuerUrl)
  if (cached) {
    return cached
  }

  const wellKnownUrl = `${issuerUrl.replace(/\/$/, '')}/.well-known/openid-configuration`

  const response = await fetch(wellKnownUrl)
  if (!response.ok) {
    throw new Error(`OIDC discovery failed for ${issuerUrl}: ${response.status} ${response.statusText}`)
  }

  const doc: OIDCDiscoveryDocument = await response.json()

  if (!doc.authorization_endpoint || !doc.token_endpoint) {
    throw new Error(`OIDC discovery document for ${issuerUrl} missing required endpoints`)
  }

  discoveryCache.set(issuerUrl, doc)
  return doc
}

/**
 * Initiate the Red Hat SSO OIDC flow by discovering endpoints and
 * redirecting the user to the authorization endpoint with PKCE.
 */
export async function initiateRedHatAuth(config: RedHatSSOConfig): Promise<void> {
  const oidcConfig = await discoverOIDCConfig(config.issuerUrl)

  const verifier = generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)
  const state = generateState()

  sessionStorage.setItem(SESSION_KEY_VERIFIER, verifier)
  sessionStorage.setItem(SESSION_KEY_STATE, state)

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scope || 'openid profile email',
    state,
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })

  window.location.href = `${oidcConfig.authorization_endpoint}?${params.toString()}`
}

/**
 * Handle the OAuth callback from Red Hat SSO. Validates state, exchanges
 * the authorization code for tokens using the discovered token endpoint.
 *
 * @param params - URLSearchParams from the callback URL
 * @param config - Red Hat SSO config (needed for issuerUrl to find token endpoint)
 * @returns TokenSet with OIDC access and refresh tokens
 * @throws Error if state mismatch, missing code, or token exchange fails
 */
export async function handleRedHatCallback(params: URLSearchParams, config: RedHatSSOConfig): Promise<TokenSet> {
  const code = params.get('code')
  const state = params.get('state')
  const error = params.get('error')

  if (error) {
    const description = params.get('error_description') || error
    throw new Error(`Red Hat SSO error: ${description}`)
  }

  if (!code) {
    throw new Error('Red Hat SSO callback missing authorization code')
  }

  const savedState = sessionStorage.getItem(SESSION_KEY_STATE)
  if (!state || state !== savedState) {
    throw new Error('Red Hat SSO state mismatch — possible CSRF attack')
  }

  const verifier = sessionStorage.getItem(SESSION_KEY_VERIFIER)
  if (!verifier) {
    throw new Error('Red Hat SSO PKCE verifier not found in session')
  }

  sessionStorage.removeItem(SESSION_KEY_STATE)
  sessionStorage.removeItem(SESSION_KEY_VERIFIER)

  const oidcConfig = await discoverOIDCConfig(config.issuerUrl)

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    code,
    redirect_uri: config.redirectUri,
    code_verifier: verifier,
  })

  const response = await fetch(oidcConfig.token_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })

  if (!response.ok) {
    throw new Error(`Red Hat SSO token exchange failed: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(`Red Hat SSO token exchange error: ${data.error_description || data.error}`)
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : Date.now() + 3600 * 1000, // Default 1 hour
    provider: 'redhat-sso',
  }
}
