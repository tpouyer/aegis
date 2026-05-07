import type { GitHubOAuthConfig, AtlassianOAuthConfig, RedHatSSOConfig, GoogleOAuthConfig } from './types';
import { getWellKnownConfig } from '@/lib/telemetry/config';

const redirectUri = (provider: string) =>
  `${window.location.origin}/auth/callback?provider=${provider}`;

export function getGitHubConfig(): GitHubOAuthConfig {
  const wk = getWellKnownConfig().auth;
  return {
    clientId: wk?.githubClientId || (import.meta.env.VITE_GITHUB_CLIENT_ID as string) || 'aegis-dev',
    redirectUri: redirectUri('github'),
    scope: 'repo read:org read:user',
  };
}

export function getAtlassianConfig(): AtlassianOAuthConfig {
  const wk = getWellKnownConfig().auth;
  return {
    clientId: wk?.atlassianClientId || (import.meta.env.VITE_ATLASSIAN_CLIENT_ID as string) || 'aegis-dev',
    redirectUri: redirectUri('atlassian'),
    scope: 'read:jira-work write:jira-work read:jira-user offline_access',
  };
}

export function getRedHatConfig(): RedHatSSOConfig {
  const wk = getWellKnownConfig().auth;
  return {
    clientId: wk?.rhSsoClientId || (import.meta.env.VITE_RHSSO_CLIENT_ID as string) || 'aegis-dev',
    redirectUri: redirectUri('redhat-sso'),
    scope: 'openid profile email',
    issuerUrl: wk?.rhSsoIssuerUrl || (import.meta.env.VITE_RHSSO_ISSUER_URL as string) || 'https://sso.redhat.com/auth/realms/redhat-external',
  };
}

export function getGoogleConfig(): GoogleOAuthConfig {
  const wk = getWellKnownConfig().auth;
  return {
    clientId: wk?.googleClientId || (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || 'aegis-dev',
    redirectUri: redirectUri('google'),
    scope: 'https://www.googleapis.com/auth/cloud-platform',
  };
}
