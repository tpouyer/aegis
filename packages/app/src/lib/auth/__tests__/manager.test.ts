import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthLevel } from '../types';
import type { AuthProvider, AuthState, TokenSet } from '../types';

// Polyfill localStorage for Node.js 22+ (has a basic Storage without .clear())
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = String(value); },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const key of Object.keys(store)) delete store[key]; },
  get length() { return Object.keys(store).length; },
  key: (index: number) => Object.keys(store)[index] ?? null,
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// Mock the sw-bridge module so tests don't need a real Service Worker
vi.mock('../sw-bridge', () => ({
  sendTokenToSW: vi.fn().mockResolvedValue(undefined),
  clearTokenInSW: vi.fn().mockResolvedValue(undefined),
}));

// Import after mocking
import { AuthManager } from '../manager';

function makeToken(
  provider: AuthProvider,
  overrides?: Partial<TokenSet>,
): TokenSet {
  return {
    accessToken: `test-access-token-${provider}`,
    refreshToken: `test-refresh-token-${provider}`,
    expiresAt: Date.now() + 3600 * 1000, // 1 hour from now
    provider,
    ...overrides,
  };
}

function makeExpiredToken(provider: AuthProvider): TokenSet {
  return makeToken(provider, {
    expiresAt: Date.now() - 1000, // Already expired
  });
}

describe('AuthManager', () => {
  let manager: AuthManager;

  beforeEach(() => {
    localStorage.clear();
    manager = new AuthManager();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('initial state', () => {
    it('starts at Guest level with no connections', () => {
      expect(manager.getAuthLevel()).toBe(AuthLevel.Guest);
      expect(manager.getUser()).toBeNull();
      expect(manager.getState().isAuthenticated).toBe(false);
      expect(manager.getState().tokens).toEqual({});
    });
  });

  describe('setToken', () => {
    it('sets a GitHub token and upgrades level to GitHub', async () => {
      const token = makeToken('github');
      await manager.setToken('github', token);

      expect(manager.getAuthLevel()).toBe(AuthLevel.GitHub);
      expect(manager.isConnected('github')).toBe(true);
      expect(manager.getState().isAuthenticated).toBe(true);
    });

    it('sets a RedHatSSO token and upgrades level to RedHatSSO', async () => {
      const token = makeToken('redhat-sso');
      await manager.setToken('redhat-sso', token);

      expect(manager.getAuthLevel()).toBe(AuthLevel.RedHatSSO);
      expect(manager.isConnected('redhat-sso')).toBe(true);
      expect(manager.getState().isAuthenticated).toBe(true);
    });

    it('persists token metadata to localStorage', async () => {
      const token = makeToken('github');
      await manager.setToken('github', token);

      const stored = localStorage.getItem('aegis_token_metadata');
      expect(stored).not.toBeNull();

      const metadata = JSON.parse(stored!);
      expect(metadata).toHaveLength(1);
      expect(metadata[0].provider).toBe('github');
      expect(metadata[0].expiresAt).toBe(token.expiresAt);
    });
  });

  describe('isTokenExpired', () => {
    it('returns true for past timestamps', () => {
      const token = makeExpiredToken('github');
      expect(manager.isTokenExpired(token)).toBe(true);
    });

    it('returns false for future timestamps', () => {
      const token = makeToken('github');
      expect(manager.isTokenExpired(token)).toBe(false);
    });

    it('returns true when within 60-second buffer of expiry', () => {
      const token = makeToken('github', {
        expiresAt: Date.now() + 30_000, // 30 seconds from now (within 60s buffer)
      });
      expect(manager.isTokenExpired(token)).toBe(true);
    });
  });

  describe('isConnected', () => {
    it('returns false for unconnected providers', () => {
      expect(manager.isConnected('github')).toBe(false);
      expect(manager.isConnected('atlassian')).toBe(false);
    });

    it('returns true for connected providers with valid tokens', async () => {
      await manager.setToken('github', makeToken('github'));
      expect(manager.isConnected('github')).toBe(true);
    });

    it('returns false for connected providers with expired tokens', async () => {
      await manager.setToken('github', makeExpiredToken('github'));
      expect(manager.isConnected('github')).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('removes the provider and downgrades auth level', async () => {
      await manager.setToken('github', makeToken('github'));
      expect(manager.getAuthLevel()).toBe(AuthLevel.GitHub);

      await manager.disconnect('github');
      expect(manager.getAuthLevel()).toBe(AuthLevel.Guest);
      expect(manager.isConnected('github')).toBe(false);
      expect(manager.getState().isAuthenticated).toBe(false);
    });

    it('downgrades from RedHatSSO to GitHub if GitHub remains', async () => {
      await manager.setToken('github', makeToken('github'));
      await manager.setToken('redhat-sso', makeToken('redhat-sso'));
      expect(manager.getAuthLevel()).toBe(AuthLevel.RedHatSSO);

      await manager.disconnect('redhat-sso');
      expect(manager.getAuthLevel()).toBe(AuthLevel.GitHub);
      expect(manager.getState().isAuthenticated).toBe(true);
    });
  });

  describe('logout', () => {
    it('clears all tokens and returns to Guest level', async () => {
      await manager.setToken('github', makeToken('github'));
      await manager.setToken('atlassian', makeToken('atlassian'));
      await manager.setToken('redhat-sso', makeToken('redhat-sso'));

      await manager.logout();

      expect(manager.getAuthLevel()).toBe(AuthLevel.Guest);
      expect(manager.getState().isAuthenticated).toBe(false);
      expect(manager.getState().tokens).toEqual({});
      expect(manager.getUser()).toBeNull();
      expect(localStorage.getItem('aegis_token_metadata')).toBeNull();
    });
  });

  describe('onAuthChange', () => {
    it('fires listeners on token changes', async () => {
      const listener = vi.fn();
      manager.onAuthChange(listener);

      await manager.setToken('github', makeToken('github'));

      expect(listener).toHaveBeenCalledTimes(1);
      const state: AuthState = listener.mock.calls[0][0];
      expect(state.level).toBe(AuthLevel.GitHub);
      expect(state.isAuthenticated).toBe(true);
    });

    it('fires listeners on disconnect', async () => {
      const listener = vi.fn();
      await manager.setToken('github', makeToken('github'));

      manager.onAuthChange(listener);
      await manager.disconnect('github');

      expect(listener).toHaveBeenCalledTimes(1);
      const state: AuthState = listener.mock.calls[0][0];
      expect(state.level).toBe(AuthLevel.Guest);
    });

    it('fires listeners on logout', async () => {
      const listener = vi.fn();
      await manager.setToken('github', makeToken('github'));

      manager.onAuthChange(listener);
      await manager.logout();

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('returns an unsubscribe function', async () => {
      const listener = vi.fn();
      const unsubscribe = manager.onAuthChange(listener);

      await manager.setToken('github', makeToken('github'));
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      await manager.setToken('atlassian', makeToken('atlassian'));
      expect(listener).toHaveBeenCalledTimes(1); // Not called again
    });
  });

  describe('auth level precedence', () => {
    it('RedHatSSO takes precedence over GitHub', async () => {
      await manager.setToken('github', makeToken('github'));
      expect(manager.getAuthLevel()).toBe(AuthLevel.GitHub);

      await manager.setToken('redhat-sso', makeToken('redhat-sso'));
      expect(manager.getAuthLevel()).toBe(AuthLevel.RedHatSSO);
    });

    it('falls back to GitHub when RedHatSSO is disconnected', async () => {
      await manager.setToken('github', makeToken('github'));
      await manager.setToken('redhat-sso', makeToken('redhat-sso'));

      await manager.disconnect('redhat-sso');
      expect(manager.getAuthLevel()).toBe(AuthLevel.GitHub);
    });

    it('falls back to Guest when all identity providers are disconnected', async () => {
      await manager.setToken('github', makeToken('github'));
      await manager.setToken('redhat-sso', makeToken('redhat-sso'));

      await manager.disconnect('github');
      await manager.disconnect('redhat-sso');
      expect(manager.getAuthLevel()).toBe(AuthLevel.Guest);
    });

    it('non-identity providers (atlassian, google) do not affect auth level', async () => {
      await manager.setToken('atlassian', makeToken('atlassian'));
      await manager.setToken('google', makeToken('google'));
      expect(manager.getAuthLevel()).toBe(AuthLevel.Guest);
    });
  });

  describe('requireAuth', () => {
    it('returns the token when provider is connected', async () => {
      const token = makeToken('github');
      await manager.setToken('github', token);

      const result = await manager.requireAuth('github');
      expect(result.accessToken).toBe(token.accessToken);
    });

    it('throws when provider is not connected', async () => {
      await expect(manager.requireAuth('github')).rejects.toThrow(
        'not connected',
      );
    });

    it('throws when token is expired and no refresh token', async () => {
      const expiredToken = makeExpiredToken('github');
      expiredToken.refreshToken = undefined;
      await manager.setToken('github', expiredToken);

      await expect(manager.requireAuth('github')).rejects.toThrow('expired');
    });
  });
});
