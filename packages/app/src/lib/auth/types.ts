/**
 * Auth types for Aegis progressive authentication system.
 *
 * Three user classes with lazy auth acquisition:
 *   Guest       -> no auth, public content only
 *   GitHub      -> GitHub OAuth, public + github-gated content
 *   RedHatSSO   -> OIDC via Red Hat SSO, full access
 */

export enum AuthLevel {
  Guest = 'guest',
  GitHub = 'github',
  RedHatSSO = 'redhat-sso',
}

export type AuthProvider = 'github' | 'atlassian' | 'redhat-sso' | 'google'

export interface TokenSet {
  accessToken: string
  refreshToken?: string
  /** Unix timestamp in milliseconds when the token expires */
  expiresAt: number
  provider: AuthProvider
}

export interface OAuthConfig {
  clientId: string
  redirectUri: string
  scope: string
}

export interface GitHubOAuthConfig extends OAuthConfig {
  // GitHub-specific — no additional fields required
}

export interface AtlassianOAuthConfig extends OAuthConfig {
  /** Atlassian Cloud instance ID (resolved after initial auth) */
  cloudId?: string
}

export interface RedHatSSOConfig extends OAuthConfig {
  /** OIDC issuer URL for .well-known discovery */
  issuerUrl: string
}

export interface GoogleOAuthConfig extends OAuthConfig {
  // Google-specific — no additional fields required
}

export interface UserProfile {
  id: string
  displayName: string
  email?: string
  avatarUrl?: string
  authLevel: AuthLevel
  connectedProviders: AuthProvider[]
}

export interface AuthState {
  level: AuthLevel
  user: UserProfile | null
  tokens: Partial<Record<AuthProvider, TokenSet>>
  isAuthenticated: boolean
}

/**
 * OIDC Discovery Document (.well-known/openid-configuration)
 */
export interface OIDCDiscoveryDocument {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  userinfo_endpoint?: string
  jwks_uri?: string
  scopes_supported?: string[]
  response_types_supported?: string[]
  grant_types_supported?: string[]
  code_challenge_methods_supported?: string[]
}
