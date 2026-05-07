/**
 * Google OAuth 2.0 flow with PKCE.
 *
 * Used by Red Hat employees to authenticate with Vertex AI.
 * Scope: https://www.googleapis.com/auth/cloud-platform
 * Access type: offline (to obtain a refresh token)
 *
 * RH employees sign in with their Red Hat Google Workspace account.
 * The token is stored in the Service Worker and injected into Vertex
 * AI API requests.
 */

import { generateCodeChallenge, generateCodeVerifier, generateState } from './pkce';
import type { GoogleOAuthConfig, TokenSet } from './types';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const SESSION_KEY_VERIFIER = 'aegis_google_pkce_verifier';
const SESSION_KEY_STATE = 'aegis_google_oauth_state';

/**
 * Initiate the Google OAuth flow by redirecting the user to Google's
 * authorization endpoint with PKCE and offline access.
 */
export async function initiateGoogleAuth(config: GoogleOAuthConfig): Promise<void> {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = generateState();

  sessionStorage.setItem(SESSION_KEY_VERIFIER, verifier);
  sessionStorage.setItem(SESSION_KEY_STATE, state);

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scope || 'https://www.googleapis.com/auth/cloud-platform',
    state,
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  });

  window.location.href = `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Handle the OAuth callback from Google. Validates state, exchanges the
 * authorization code for tokens using PKCE.
 *
 * @param params - URLSearchParams from the callback URL
 * @returns TokenSet with Google access and refresh tokens
 * @throws Error if state mismatch, missing code, or token exchange fails
 */
export async function handleGoogleCallback(
  params: URLSearchParams,
  config: GoogleOAuthConfig,
): Promise<TokenSet> {
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');

  if (error) {
    const description = params.get('error_description') || error;
    throw new Error(`Google OAuth error: ${description}`);
  }

  if (!code) {
    throw new Error('Google OAuth callback missing authorization code');
  }

  const savedState = sessionStorage.getItem(SESSION_KEY_STATE);
  if (!state || state !== savedState) {
    throw new Error('Google OAuth state mismatch — possible CSRF attack');
  }

  const verifier = sessionStorage.getItem(SESSION_KEY_VERIFIER);
  if (!verifier) {
    throw new Error('Google OAuth PKCE verifier not found in session');
  }

  sessionStorage.removeItem(SESSION_KEY_STATE);
  sessionStorage.removeItem(SESSION_KEY_VERIFIER);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    code,
    redirect_uri: config.redirectUri,
    code_verifier: verifier,
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(
      `Google token exchange failed: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(
      `Google token exchange error: ${data.error_description || data.error}`,
    );
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in
      ? Date.now() + data.expires_in * 1000
      : Date.now() + 3600 * 1000, // Default 1 hour
    provider: 'google',
  };
}
