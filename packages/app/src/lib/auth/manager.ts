/**
 * Auth Manager — central coordinator for Aegis authentication state.
 *
 * Responsibilities:
 *   - Track which OAuth providers are connected
 *   - Compute the current auth level (Guest < GitHub < RedHatSSO)
 *   - Store token metadata in localStorage for UI state rendering
 *   - Sync actual tokens to the Service Worker via postMessage
 *   - Provide a reactive subscription model for auth state changes
 *
 * Security model:
 *   - Actual tokens live ONLY in the Service Worker's memory Map
 *   - localStorage holds metadata only (provider names, expiry timestamps)
 *   - This protects against XSS exfiltration of tokens from page JS
 */

import { clearTokenInSW, sendTokenToSW } from './sw-bridge';
import { AuthLevel, type AuthProvider, type AuthState, type TokenSet, type UserProfile } from './types';

type AuthChangeCallback = (state: AuthState) => void;

const TOKEN_META_STORAGE_KEY = 'aegis_token_metadata';

interface TokenMetadata {
  provider: AuthProvider;
  expiresAt: number;
  hasRefreshToken: boolean;
}

export class AuthManager {
  private state: AuthState;
  private listeners: Set<AuthChangeCallback>;

  constructor() {
    this.listeners = new Set();
    this.state = {
      level: AuthLevel.Guest,
      user: null,
      tokens: {},
      isAuthenticated: false,
    };

    // Restore token metadata from localStorage (not actual tokens)
    this.restoreTokenMetadata();
  }

  /**
   * Lazy auth acquisition — only prompt when a feature requires a specific
   * provider. Returns the token if already connected, otherwise throws to
   * signal that the caller should initiate the OAuth flow.
   */
  async requireAuth(provider: AuthProvider): Promise<TokenSet> {
    const token = this.state.tokens[provider];

    if (!token || !token.accessToken) {
      throw new Error(
        `Provider "${provider}" not connected. Initiate OAuth flow first.`,
      );
    }

    if (this.isTokenExpired(token)) {
      // Attempt refresh if we have a refresh token
      if (token.refreshToken) {
        return this.refreshToken(provider);
      }
      throw new Error(
        `Token for "${provider}" has expired and no refresh token is available.`,
      );
    }

    return token;
  }

  /**
   * Check if a provider is already authenticated (has a non-expired token).
   */
  isConnected(provider: AuthProvider): boolean {
    const token = this.state.tokens[provider];
    return !!token && !!token.accessToken && !this.isTokenExpired(token);
  }

  /**
   * Get the current auth level based on connected providers.
   */
  getAuthLevel(): AuthLevel {
    return this.state.level;
  }

  /**
   * Get the current user profile, or null if not authenticated.
   */
  getUser(): UserProfile | null {
    return this.state.user;
  }

  /**
   * Get a snapshot of the current auth state.
   */
  getState(): AuthState {
    return { ...this.state };
  }

  /**
   * Store a token after a successful OAuth callback.
   * Sends the actual token to the Service Worker and stores
   * metadata in localStorage.
   */
  async setToken(provider: AuthProvider, token: TokenSet): Promise<void> {
    this.state.tokens[provider] = token;
    this.state.level = this.computeAuthLevel();
    this.state.isAuthenticated = this.state.level !== AuthLevel.Guest;

    // Update user profile with connected providers
    this.updateUserProviders();

    // Persist token metadata (NOT the actual token) to localStorage
    this.persistTokenMetadata();

    // Send the actual token to the Service Worker
    await this.syncTokenToSW(provider, token);

    this.notifyListeners();
  }

  /**
   * Refresh an expired token using the refresh token.
   * This is a placeholder — actual refresh logic depends on the provider.
   */
  async refreshToken(provider: AuthProvider): Promise<TokenSet> {
    const currentToken = this.state.tokens[provider];
    if (!currentToken?.refreshToken) {
      throw new Error(`No refresh token available for "${provider}"`);
    }

    // Provider-specific refresh logic would go here.
    // For now, throw to indicate the caller should re-initiate OAuth.
    throw new Error(
      `Token refresh for "${provider}" not yet implemented. Re-initiate OAuth flow.`,
    );
  }

  /**
   * Check if a token has expired. Adds a 60-second buffer to account
   * for clock skew and network latency.
   */
  isTokenExpired(token: TokenSet): boolean {
    const BUFFER_MS = 60_000;
    return Date.now() >= token.expiresAt - BUFFER_MS;
  }

  /**
   * Send a token to the Service Worker for header injection.
   */
  private async syncTokenToSW(
    provider: AuthProvider,
    token: TokenSet,
  ): Promise<void> {
    try {
      await sendTokenToSW(provider, token);
    } catch (error) {
      // SW may not be active yet — log but don't fail
      console.warn(`[AuthManager] Failed to sync token to SW for ${provider}:`, error);
    }
  }

  /**
   * Disconnect a specific provider. Clears the token from memory,
   * localStorage metadata, and Service Worker.
   */
  async disconnect(provider: AuthProvider): Promise<void> {
    delete this.state.tokens[provider];
    this.state.level = this.computeAuthLevel();
    this.state.isAuthenticated = this.state.level !== AuthLevel.Guest;

    this.updateUserProviders();
    this.persistTokenMetadata();

    try {
      await clearTokenInSW(provider);
    } catch (error) {
      console.warn(`[AuthManager] Failed to clear token in SW for ${provider}:`, error);
    }

    this.notifyListeners();
  }

  /**
   * Proactively clean up expired token metadata from localStorage
   * and in-memory state. Call this on app startup to remove stale
   * entries from previous sessions so isConnected() immediately
   * reflects the correct state and the UI shows re-auth prompts.
   */
  async clearExpiredTokens(): Promise<void> {
    const providers = Object.keys(this.state.tokens) as AuthProvider[];
    let changed = false;

    for (const provider of providers) {
      const token = this.state.tokens[provider];
      if (token && this.isTokenExpired(token)) {
        delete this.state.tokens[provider];
        changed = true;

        // Also clear from SW in case it still has the token
        try {
          await clearTokenInSW(provider);
        } catch {
          // SW may not be active yet — safe to ignore
        }
      }
    }

    if (changed) {
      this.state.level = this.computeAuthLevel();
      this.state.isAuthenticated = this.state.level !== AuthLevel.Guest;
      this.updateUserProviders();
      this.persistTokenMetadata();
      this.notifyListeners();
    }
  }

  /**
   * Clear all auth state and return to Guest level.
   */
  async logout(): Promise<void> {
    const providers = Object.keys(this.state.tokens) as AuthProvider[];

    this.state.tokens = {};
    this.state.level = AuthLevel.Guest;
    this.state.isAuthenticated = false;
    this.state.user = null;

    localStorage.removeItem(TOKEN_META_STORAGE_KEY);

    // Clear all tokens from Service Worker
    for (const provider of providers) {
      try {
        await clearTokenInSW(provider);
      } catch (error) {
        console.warn(`[AuthManager] Failed to clear token in SW for ${provider}:`, error);
      }
    }

    this.notifyListeners();
  }

  /**
   * Subscribe to auth state changes. Returns an unsubscribe function.
   */
  onAuthChange(callback: AuthChangeCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Determine the auth level from connected (non-expired) providers.
   *
   * Precedence: RedHatSSO > GitHub > Guest
   *
   * RedHatSSO connected (even if expired but refresh available) → RedHatSSO
   * GitHub connected → GitHub
   * Otherwise → Guest
   */

  private computeAuthLevel(): AuthLevel {
    const rhToken = this.state.tokens['redhat-sso'];
    if (rhToken && !this.isTokenExpired(rhToken)) {
      return AuthLevel.RedHatSSO;
    }

    const ghToken = this.state.tokens['github'];
    if (ghToken && !this.isTokenExpired(ghToken)) {
      return AuthLevel.GitHub;
    }

    return AuthLevel.Guest;
  }

  /**
   * Notify all subscribed listeners of the current auth state.
   */
  private notifyListeners(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        console.error('[AuthManager] Listener threw:', error);
      }
    }
  }

  /**
   * Update the user profile's connected providers list.
   */
  private updateUserProviders(): void {
    const connectedProviders = (Object.keys(this.state.tokens) as AuthProvider[]).filter(
      (p) => {
        const token = this.state.tokens[p];
        return token && !this.isTokenExpired(token);
      },
    );

    if (this.state.user) {
      this.state.user.connectedProviders = connectedProviders;
      this.state.user.authLevel = this.state.level;
    }
  }

  /**
   * Persist token metadata (NOT actual tokens) to localStorage.
   * This allows the UI to render auth state on page reload before
   * tokens are re-synced to the Service Worker.
   */
  private persistTokenMetadata(): void {
    const metadata: TokenMetadata[] = [];

    for (const [provider, token] of Object.entries(this.state.tokens)) {
      if (token) {
        metadata.push({
          provider: provider as AuthProvider,
          expiresAt: token.expiresAt,
          hasRefreshToken: !!token.refreshToken,
        });
      }
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TOKEN_META_STORAGE_KEY, JSON.stringify(metadata));
    }
  }

  /**
   * Restore token metadata from localStorage on construction.
   * This gives the UI an initial auth state without waiting for
   * the Service Worker to respond. Actual tokens remain in the SW.
   */
  private restoreTokenMetadata(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(TOKEN_META_STORAGE_KEY);
      if (!raw) return;

      const metadata: TokenMetadata[] = JSON.parse(raw);

      for (const meta of metadata) {
        this.state.tokens[meta.provider] = {
          accessToken: '',
          refreshToken: meta.hasRefreshToken ? '' : undefined,
          expiresAt: meta.expiresAt,
          provider: meta.provider,
        };
      }

      this.state.level = this.computeAuthLevel();
      this.state.isAuthenticated = this.state.level !== AuthLevel.Guest;
    } catch {
      try { localStorage.removeItem(TOKEN_META_STORAGE_KEY); } catch { /* noop */ }
    }
  }
}

/**
 * Singleton AuthManager instance for the application.
 */
export const authManager = new AuthManager();
