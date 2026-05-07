import { describe, expect, it } from 'vitest';
import { generateCodeChallenge, generateCodeVerifier, generateState } from '../pkce';

describe('generateCodeVerifier', () => {
  it('produces a string of default length 64', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toHaveLength(64);
  });

  it('produces a string of custom valid length', () => {
    const verifier43 = generateCodeVerifier(43);
    expect(verifier43).toHaveLength(43);

    const verifier128 = generateCodeVerifier(128);
    expect(verifier128).toHaveLength(128);
  });

  it('throws for length below 43', () => {
    expect(() => generateCodeVerifier(42)).toThrow('between 43 and 128');
  });

  it('throws for length above 128', () => {
    expect(() => generateCodeVerifier(129)).toThrow('between 43 and 128');
  });

  it('produces URL-safe characters only (RFC 7636 unreserved)', () => {
    const verifier = generateCodeVerifier(128);
    // RFC 7636 allows: [A-Z] [a-z] [0-9] - . _ ~
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });

  it('produces different values on each call', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });
});

describe('generateCodeChallenge', () => {
  it('produces a base64url-encoded string without padding', async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);

    // Base64url: only [A-Za-z0-9\-_], no padding '='
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(challenge).not.toContain('=');
    expect(challenge).not.toContain('+');
    expect(challenge).not.toContain('/');
  });

  it('produces a 43-character string (SHA-256 -> 32 bytes -> base64url)', async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    // SHA-256 produces 32 bytes, base64url of 32 bytes = 43 chars (no padding)
    expect(challenge).toHaveLength(43);
  });

  it('produces the same challenge for the same verifier', async () => {
    const verifier = generateCodeVerifier();
    const challenge1 = await generateCodeChallenge(verifier);
    const challenge2 = await generateCodeChallenge(verifier);
    expect(challenge1).toBe(challenge2);
  });

  it('produces different challenges for different verifiers', async () => {
    const challenge1 = await generateCodeChallenge(generateCodeVerifier());
    const challenge2 = await generateCodeChallenge(generateCodeVerifier());
    expect(challenge1).not.toBe(challenge2);
  });
});

describe('generateState', () => {
  it('produces a 32-character hex string', () => {
    const state = generateState();
    expect(state).toHaveLength(32);
    expect(state).toMatch(/^[0-9a-f]+$/);
  });

  it('produces unique values on each call', () => {
    const states = new Set(Array.from({ length: 10 }, () => generateState()));
    expect(states.size).toBe(10);
  });
});
