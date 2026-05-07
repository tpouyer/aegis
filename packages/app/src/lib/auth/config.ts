import type { GitHubOAuthConfig, AtlassianOAuthConfig, RedHatSSOConfig, GoogleOAuthConfig } from './types';

const redirectUri = (provider: string) =>
  `${window.location.origin}/auth/callback?provider=${provider}`;

export function getGitHubConfig(): GitHubOAuthConfig {
  return {
    clientId: import.meta.env.VITE_GITHUB_CLIENT_ID || 'aegis-dev',
    redirectUri: redirectUri('github'),
    scope: 'repo read:org read:user',
  };
}

export function getAtlassianConfig(): AtlassianOAuthConfig {
  return {
    clientId: import.meta.env.VITE_ATLASSIAN_CLIENT_ID || 'aegis-dev',
    redirectUri: redirectUri('atlassian'),
    scope: 'read:jira-work write:jira-work read:jira-user offline_access',
  };
}

export function getRedHatConfig(): RedHatSSOConfig {
  return {
    clientId: import.meta.env.VITE_RHSSO_CLIENT_ID || 'aegis-dev',
    redirectUri: redirectUri('redhat-sso'),
    scope: 'openid profile email',
    issuerUrl: import.meta.env.VITE_RHSSO_ISSUER_URL || 'https://sso.redhat.com/auth/realms/redhat-external',
  };
}

export function getGoogleConfig(): GoogleOAuthConfig {
  return {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || 'aegis-dev',
    redirectUri: redirectUri('google'),
    scope: 'https://www.googleapis.com/auth/cloud-platform',
  };
}
