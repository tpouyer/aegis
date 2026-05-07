/**
 * Typed caching layer for Jira API data.
 *
 * Wraps the generic CacheStore (IndexedDB) with Jira-specific key
 * prefixes and TTL tiers from the design doc (section 5.5):
 *
 *   Board configurations:        1 hour
 *   Workflow/status metadata:    24 hours
 *   User/team/component lists:   1 hour
 *   Issue snapshots:             60 seconds
 */

import { CacheStore } from '@/lib/cache/indexeddb';
import type {
  JiraBoardConfig,
  JiraIssue,
  JiraSearchResponse,
  JiraStatus,
  JiraUser,
  JiraBoard,
  JiraTransition,
} from './types';

// ---------------------------------------------------------------------------
// TTL constants (milliseconds)
// ---------------------------------------------------------------------------

const TTL = {
  BOARD_CONFIG: 60 * 60 * 1000,        // 1 hour
  WORKFLOW_METADATA: 24 * 60 * 60 * 1000, // 24 hours
  USER_LIST: 60 * 60 * 1000,           // 1 hour
  ISSUE_SNAPSHOT: 60 * 1000,           // 60 seconds
} as const;

// ---------------------------------------------------------------------------
// Key prefixes
// ---------------------------------------------------------------------------

const KEY = {
  boards: () => 'jira:boards',
  boardConfig: (boardId: number) => `jira:board-config:${boardId}`,
  boardIssues: (boardId: number, jql?: string) =>
    `jira:board-issues:${boardId}:${jql ?? 'default'}`,
  issue: (issueKey: string) => `jira:issue:${issueKey}`,
  transitions: (issueKey: string) => `jira:transitions:${issueKey}`,
  statuses: () => 'jira:statuses',
  currentUser: () => 'jira:current-user',
  searchResults: (jql: string) => `jira:search:${jql}`,
} as const;

// ---------------------------------------------------------------------------
// JiraCache
// ---------------------------------------------------------------------------

export class JiraCache {
  private store: CacheStore;

  constructor() {
    this.store = new CacheStore('aegis-jira-cache', 'jira');
  }

  // -----------------------------------------------------------------------
  // Boards (TTL: 1 hour)
  // -----------------------------------------------------------------------

  async getBoards(): Promise<JiraBoard[] | null> {
    return this.store.get<JiraBoard[]>(KEY.boards());
  }

  async setBoards(boards: JiraBoard[]): Promise<void> {
    await this.store.set(KEY.boards(), boards, TTL.BOARD_CONFIG);
  }

  // -----------------------------------------------------------------------
  // Board config (TTL: 1 hour)
  // -----------------------------------------------------------------------

  async getBoardConfig(boardId: number): Promise<JiraBoardConfig | null> {
    return this.store.get<JiraBoardConfig>(KEY.boardConfig(boardId));
  }

  async setBoardConfig(
    boardId: number,
    config: JiraBoardConfig,
  ): Promise<void> {
    await this.store.set(KEY.boardConfig(boardId), config, TTL.BOARD_CONFIG);
  }

  // -----------------------------------------------------------------------
  // Board issues (TTL: 60 seconds)
  // -----------------------------------------------------------------------

  async getBoardIssues(
    boardId: number,
    jql?: string,
  ): Promise<JiraSearchResponse | null> {
    return this.store.get<JiraSearchResponse>(KEY.boardIssues(boardId, jql));
  }

  async setBoardIssues(
    boardId: number,
    response: JiraSearchResponse,
    jql?: string,
  ): Promise<void> {
    await this.store.set(
      KEY.boardIssues(boardId, jql),
      response,
      TTL.ISSUE_SNAPSHOT,
    );
  }

  // -----------------------------------------------------------------------
  // Single issue (TTL: 60 seconds)
  // -----------------------------------------------------------------------

  async getIssue(issueKey: string): Promise<JiraIssue | null> {
    return this.store.get<JiraIssue>(KEY.issue(issueKey));
  }

  async setIssue(issueKey: string, issue: JiraIssue): Promise<void> {
    await this.store.set(KEY.issue(issueKey), issue, TTL.ISSUE_SNAPSHOT);
  }

  // -----------------------------------------------------------------------
  // Transitions (TTL: 60 seconds — can change based on issue state)
  // -----------------------------------------------------------------------

  async getTransitions(issueKey: string): Promise<JiraTransition[] | null> {
    return this.store.get<JiraTransition[]>(KEY.transitions(issueKey));
  }

  async setTransitions(
    issueKey: string,
    transitions: JiraTransition[],
  ): Promise<void> {
    await this.store.set(
      KEY.transitions(issueKey),
      transitions,
      TTL.ISSUE_SNAPSHOT,
    );
  }

  // -----------------------------------------------------------------------
  // Workflow / status metadata (TTL: 24 hours)
  // -----------------------------------------------------------------------

  async getStatuses(): Promise<JiraStatus[] | null> {
    return this.store.get<JiraStatus[]>(KEY.statuses());
  }

  async setStatuses(statuses: JiraStatus[]): Promise<void> {
    await this.store.set(KEY.statuses(), statuses, TTL.WORKFLOW_METADATA);
  }

  // -----------------------------------------------------------------------
  // Current user (TTL: 1 hour)
  // -----------------------------------------------------------------------

  async getCurrentUser(): Promise<JiraUser | null> {
    return this.store.get<JiraUser>(KEY.currentUser());
  }

  async setCurrentUser(user: JiraUser): Promise<void> {
    await this.store.set(KEY.currentUser(), user, TTL.USER_LIST);
  }

  // -----------------------------------------------------------------------
  // Search results (TTL: 60 seconds)
  // -----------------------------------------------------------------------

  async getSearchResults(jql: string): Promise<JiraSearchResponse | null> {
    return this.store.get<JiraSearchResponse>(KEY.searchResults(jql));
  }

  async setSearchResults(
    jql: string,
    response: JiraSearchResponse,
  ): Promise<void> {
    await this.store.set(KEY.searchResults(jql), response, TTL.ISSUE_SNAPSHOT);
  }

  // -----------------------------------------------------------------------
  // Utilities
  // -----------------------------------------------------------------------

  /** Invalidate all cached issues for a board (e.g. after a transition). */
  async invalidateBoardIssues(boardId: number): Promise<void> {
    // Delete the default board issues cache entry.
    // Additional JQL-filtered entries will expire via TTL.
    await this.store.delete(KEY.boardIssues(boardId));
  }

  /** Invalidate a single issue cache entry. */
  async invalidateIssue(issueKey: string): Promise<void> {
    await this.store.delete(KEY.issue(issueKey));
    await this.store.delete(KEY.transitions(issueKey));
  }

  /** Clear the entire Jira cache. */
  async clearAll(): Promise<void> {
    await this.store.clear();
  }

  /** Evict expired entries to reclaim storage. */
  async evictExpired(): Promise<number> {
    return this.store.evictExpired();
  }
}

// Singleton
let cacheInstance: JiraCache | null = null;

export function getJiraCache(): JiraCache {
  if (!cacheInstance) {
    cacheInstance = new JiraCache();
  }
  return cacheInstance;
}
