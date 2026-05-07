/**
 * Atlassian OAuth 2.0 (3LO) flow with PKCE.
 *
 * Audience: api.atlassian.com
 * Scopes: read:jira-work write:jira-work read:jira-user offline_access
 *
 * Red Hat SSO federates to Atlassian, so RH employees may get a seamless
 * experience if already signed into their Atlassian Cloud instance.
 * Outside contributors authenticate directly with Atlassian.
 */

import { generateCodeChallenge, generateCodeVerifier, generateState } from './pkce';
import type { AtlassianOAuthConfig, TokenSet } from './types';

const ATLASSIAN_AUTH_URL = 'https://auth.atlassian.com/authorize';
const ATLASSIAN_TOKEN_URL = 'https://auth.atlassian.com/oauth/token';

const SESSION_KEY_VERIFIER = 'aegis_atlassian_pkce_verifier';
const SESSION_KEY_STATE = 'aegis_atlassian_oauth_state';

/**
 * Initiate the Atlassian OAuth 3LO flow by redirecting the user to
 * Atlassian's authorization endpoint with PKCE parameters.
 */
export async function initiateAtlassianAuth(
  config: AtlassianOAuthConfig,
): Promise<void> {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = generateState();

  sessionStorage.setItem(SESSION_KEY_VERIFIER, verifier);
  sessionStorage.setItem(SESSION_KEY_STATE, state);

  const params = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: config.clientId,
    scope: config.scope || 'read:jira-work write:jira-work read:jira-user offline_access',
    redirect_uri: config.redirectUri,
    state,
    response_type: 'code',
    prompt: 'consent',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  window.location.href = `${ATLASSIAN_AUTH_URL}?${params.toString()}`;
}

/**
 * Handle the OAuth callback from Atlassian. Validates state, exchanges the
 * authorization code for tokens using PKCE.
 *
 * @param params - URLSearchParams from the callback URL
 * @returns TokenSet with Atlassian access and refresh tokens
 * @throws Error if state mismatch, missing code, or token exchange fails
 */
export async function handleAtlassianCallback(
  params: URLSearchParams,
): Promise<TokenSet> {
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');

  if (error) {
    const description = params.get('error_description') || error;
    throw new Error(`Atlassian OAuth error: ${description}`);
  }

  if (!code) {
    throw new Error('Atlassian OAuth callback missing authorization code');
  }

  const savedState = sessionStorage.getItem(SESSION_KEY_STATE);
  if (!state || state !== savedState) {
    throw new Error('Atlassian OAuth state mismatch — possible CSRF attack');
  }

  const verifier = sessionStorage.getItem(SESSION_KEY_VERIFIER);
  if (!verifier) {
    throw new Error('Atlassian OAuth PKCE verifier not found in session');
  }

  sessionStorage.removeItem(SESSION_KEY_STATE);
  sessionStorage.removeItem(SESSION_KEY_VERIFIER);

  const response = await fetch(ATLASSIAN_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: params.get('client_id') || '',
      code,
      redirect_uri: params.get('redirect_uri') || '',
      code_verifier: verifier,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Atlassian token exchange failed: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(
      `Atlassian token exchange error: ${data.error_description || data.error}`,
    );
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in
      ? Date.now() + data.expires_in * 1000
      : Date.now() + 3600 * 1000, // Default 1 hour
    provider: 'atlassian',
  };
}
