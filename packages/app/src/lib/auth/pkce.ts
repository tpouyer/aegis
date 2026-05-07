/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth 2.0.
 *
 * All OAuth flows in Aegis use PKCE with S256 because the browser
 * is a public client (no client secret).
 *
 * Uses the Web Crypto API (crypto.subtle) for SHA-256 hashing.
 */

const VERIFIER_CHARSET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

/**
 * Generate a cryptographically random code verifier (43-128 characters).
 * Uses only unreserved URI characters per RFC 7636 appendix B.
 */
export function generateCodeVerifier(length = 64): string {
  if (length < 43 || length > 128) {
    throw new RangeError('Code verifier length must be between 43 and 128');
  }

  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);

  return Array.from(randomValues)
    .map((byte) => VERIFIER_CHARSET[byte % VERIFIER_CHARSET.length])
    .join('');
}

/**
 * Generate a code challenge from a code verifier using the S256 method.
 *
 * code_challenge = BASE64URL(SHA256(code_verifier))
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);

  return base64UrlEncode(digest);
}

/**
 * Generate a random state parameter for CSRF protection.
 * Returns a 32-character hex string.
 */
export function generateState(): string {
  const randomValues = new Uint8Array(16);
  crypto.getRandomValues(randomValues);

  return Array.from(randomValues)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Base64url-encode an ArrayBuffer (no padding, URL-safe alphabet).
 */
function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
