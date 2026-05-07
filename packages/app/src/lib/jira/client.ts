/**
 * Jira REST API v3 client.
 *
 * All requests are routed through resilientFetch() which adds automatic
 * retry with exponential backoff, rate-limit awareness, and GET
 * deduplication. The Service Worker still intercepts outbound requests
 * and injects the appropriate Authorization header (see ADR-004).
 */

import { authManager } from '../auth/manager';
import { resilientFetch } from '../fetch/resilient-fetch';
import type {
  JiraBoard,
  JiraBoardConfig,
  JiraConfig,
  JiraIssue,
  JiraPaginatedResponse,
  JiraSearchResponse,
  JiraTransition,
  JiraTransitionsResponse,
  JiraUser,
} from './types';

export class JiraClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public statusText: string,
  ) {
    super(message);
    this.name = 'JiraClientError';
  }
}

export class JiraClient {
  private baseUrl: string;
  private cloudId: string;

  constructor(config: JiraConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.cloudId = config.cloudId;
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private apiUrl(path: string): string {
    return `${this.baseUrl}/ex/jira/${this.cloudId}/rest${path}`;
  }

  private agileUrl(path: string): string {
    return `${this.baseUrl}/ex/jira/${this.cloudId}/rest/agile/1.0${path}`;
  }

  private async request<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await resilientFetch(url, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(init?.headers as Record<string, string>),
      },
      ...init,
    });

    if (!response.ok) {
      // On 401, clear the Atlassian token so the UI shows re-auth state
      if (response.status === 401) {
        authManager.disconnect('atlassian').catch(() => {});
      }

      const text = await response.text().catch(() => '');
      throw new JiraClientError(
        `Jira API error: ${response.status} ${response.statusText} — ${text}`,
        response.status,
        response.statusText,
      );
    }

    // Some endpoints (e.g. 204 No Content) return no body
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  // -----------------------------------------------------------------------
  // Boards
  // -----------------------------------------------------------------------

  /** List all boards visible to the authenticated user. */
  async getBoards(
    startAt = 0,
    maxResults = 50,
  ): Promise<JiraPaginatedResponse<JiraBoard>> {
    const params = new URLSearchParams({
      startAt: String(startAt),
      maxResults: String(maxResults),
    });
    return this.request<JiraPaginatedResponse<JiraBoard>>(
      this.agileUrl(`/board?${params}`),
    );
  }

  /** Get board column configuration with status mappings. */
  async getBoardConfig(boardId: number): Promise<JiraBoardConfig> {
    return this.request<JiraBoardConfig>(
      this.agileUrl(`/board/${boardId}/configuration`),
    );
  }

  // -----------------------------------------------------------------------
  // Issues
  // -----------------------------------------------------------------------

  /**
   * Get issues for a board via JQL search.
   * Uses the board's filter as the base query, with optional additional JQL.
   */
  async getIssuesForBoard(
    boardId: number,
    jql?: string,
    startAt = 0,
    maxResults = 100,
  ): Promise<JiraSearchResponse> {
    const params = new URLSearchParams({
      startAt: String(startAt),
      maxResults: String(maxResults),
    });
    if (jql) {
      params.set('jql', jql);
    }
    return this.request<JiraSearchResponse>(
      this.agileUrl(`/board/${boardId}/issue?${params}`),
    );
  }

  /** Get a single issue with all fields. */
  async getIssue(issueKey: string): Promise<JiraIssue> {
    return this.request<JiraIssue>(
      this.apiUrl(`/api/3/issue/${issueKey}`),
    );
  }

  /**
   * Search issues using JQL.
   * Allows specifying which fields to return for efficiency.
   */
  async searchIssues(
    jql: string,
    fields?: string[],
    maxResults = 100,
    startAt = 0,
  ): Promise<JiraSearchResponse> {
    return this.request<JiraSearchResponse>(
      this.apiUrl('/api/3/search'),
      {
        method: 'POST',
        body: JSON.stringify({
          jql,
          fields: fields ?? [
            'summary',
            'status',
            'priority',
            'issuetype',
            'assignee',
            'reporter',
            'components',
            'labels',
            'created',
            'updated',
          ],
          maxResults,
          startAt,
        }),
      },
    );
  }

  // -----------------------------------------------------------------------
  // Transitions
  // -----------------------------------------------------------------------

  /** Get available transitions for an issue. */
  async getTransitions(issueKey: string): Promise<JiraTransition[]> {
    const result = await this.request<JiraTransitionsResponse>(
      this.apiUrl(`/api/3/issue/${issueKey}/transitions`),
    );
    return result.transitions;
  }

  /**
   * Execute a transition on an issue.
   * Optionally pass field values required by the transition screen.
   */
  async doTransition(
    issueKey: string,
    transitionId: string,
    fields?: Record<string, unknown>,
  ): Promise<void> {
    const body: Record<string, unknown> = {
      transition: { id: transitionId },
    };
    if (fields) {
      body.fields = fields;
    }

    await this.request<void>(
      this.apiUrl(`/api/3/issue/${issueKey}/transitions`),
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    );
  }

  // -----------------------------------------------------------------------
  // Issue mutations
  // -----------------------------------------------------------------------

  /** Update fields on an existing issue. */
  async updateIssue(
    issueKey: string,
    fields: Record<string, unknown>,
  ): Promise<void> {
    await this.request<void>(
      this.apiUrl(`/api/3/issue/${issueKey}`),
      {
        method: 'PUT',
        body: JSON.stringify({ fields }),
      },
    );
  }

  /** Add a comment to an issue (ADF body). */
  async addComment(
    issueKey: string,
    body: unknown,
  ): Promise<void> {
    await this.request<void>(
      this.apiUrl(`/api/3/issue/${issueKey}/comment`),
      {
        method: 'POST',
        body: JSON.stringify({ body }),
      },
    );
  }

  // -----------------------------------------------------------------------
  // User
  // -----------------------------------------------------------------------

  /** Get the currently authenticated user. */
  async getCurrentUser(): Promise<JiraUser> {
    return this.request<JiraUser>(
      this.apiUrl('/api/3/myself'),
    );
  }
}

// ---------------------------------------------------------------------------
// Singleton instance — initialized lazily when Jira config is available
// ---------------------------------------------------------------------------

let clientInstance: JiraClient | null = null;

export function getJiraClient(): JiraClient {
  if (!clientInstance) {
    throw new Error(
      'JiraClient not initialized. Call initJiraClient(config) first.',
    );
  }
  return clientInstance;
}

export function initJiraClient(config: JiraConfig): JiraClient {
  clientInstance = new JiraClient(config);
  return clientInstance;
}
