/**
 * TanStack Query hooks for Jira data.
 *
 * These hooks implement the stale-while-revalidate pattern described in
 * the design doc (section 5.5). Issue data refreshes on window focus;
 * board configs and user data use longer stale times matching their
 * IndexedDB TTLs.
 */

import { type UseQueryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getJiraCache } from './cache'
import { getJiraClient } from './client'
import type {
  BoardFilters,
  JiraBoard,
  JiraBoardConfig,
  JiraIssue,
  JiraSearchResponse,
  JiraTransition,
  JiraUser,
} from './types'

// ---------------------------------------------------------------------------
// Query key factories
// ---------------------------------------------------------------------------

export const jiraKeys = {
  all: ['jira'] as const,
  boards: () => [...jiraKeys.all, 'boards'] as const,
  board: (boardId: number) => [...jiraKeys.all, 'board', boardId] as const,
  issues: (boardId: number, filters?: BoardFilters) => [...jiraKeys.all, 'issues', boardId, filters] as const,
  issue: (issueKey: string) => [...jiraKeys.all, 'issue', issueKey] as const,
  transitions: (issueKey: string) => [...jiraKeys.all, 'transitions', issueKey] as const,
  currentUser: () => [...jiraKeys.all, 'currentUser'] as const,
  search: (jql: string) => [...jiraKeys.all, 'search', jql] as const,
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

/**
 * Fetch board configuration (columns and status mappings).
 * Stale time: 1 hour (matches IndexedDB TTL for board configs).
 */
export function useBoard(boardId: number, options?: Partial<UseQueryOptions<JiraBoardConfig>>) {
  const cache = getJiraCache()

  return useQuery<JiraBoardConfig>({
    queryKey: jiraKeys.board(boardId),
    queryFn: async () => {
      // Try IndexedDB cache first
      const cached = await cache.getBoardConfig(boardId)
      if (cached) return cached

      const client = getJiraClient()
      const config = await client.getBoardConfig(boardId)
      await cache.setBoardConfig(boardId, config)
      return config
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    ...options,
  })
}

/**
 * Fetch issues for a board, optionally filtered.
 * Refetches on window focus (TanStack Query default).
 * Stale time: 60 seconds (matches issue snapshot TTL).
 */
export function useIssues(
  boardId: number,
  filters?: BoardFilters,
  options?: Partial<UseQueryOptions<JiraSearchResponse>>,
) {
  const cache = getJiraCache()

  // Build JQL from filters
  const jql = buildFilterJql(filters)

  return useQuery<JiraSearchResponse>({
    queryKey: jiraKeys.issues(boardId, filters),
    queryFn: async () => {
      const cached = await cache.getBoardIssues(boardId, jql)
      if (cached) return cached

      const client = getJiraClient()
      const response = await client.getIssuesForBoard(boardId, jql)
      await cache.setBoardIssues(boardId, response, jql)
      return response
    },
    staleTime: 60 * 1000, // 60 seconds
    refetchOnWindowFocus: true,
    ...options,
  })
}

/**
 * Fetch a single issue with all fields.
 * Stale time: 60 seconds.
 */
export function useIssue(issueKey: string, options?: Partial<UseQueryOptions<JiraIssue>>) {
  const cache = getJiraCache()

  return useQuery<JiraIssue>({
    queryKey: jiraKeys.issue(issueKey),
    queryFn: async () => {
      const cached = await cache.getIssue(issueKey)
      if (cached) return cached

      const client = getJiraClient()
      const issue = await client.getIssue(issueKey)
      await cache.setIssue(issueKey, issue)
      return issue
    },
    staleTime: 60 * 1000,
    enabled: !!issueKey,
    ...options,
  })
}

/**
 * Fetch available transitions for an issue.
 * Short stale time since transitions depend on current status.
 */
export function useTransitions(issueKey: string, options?: Partial<UseQueryOptions<JiraTransition[]>>) {
  return useQuery<JiraTransition[]>({
    queryKey: jiraKeys.transitions(issueKey),
    queryFn: async () => {
      const client = getJiraClient()
      return client.getTransitions(issueKey)
    },
    staleTime: 30 * 1000, // 30 seconds
    enabled: !!issueKey,
    ...options,
  })
}

/**
 * Fetch the authenticated Jira user.
 * Stale time: 1 hour.
 */
export function useCurrentUser(options?: Partial<UseQueryOptions<JiraUser>>) {
  const cache = getJiraCache()

  return useQuery<JiraUser>({
    queryKey: jiraKeys.currentUser(),
    queryFn: async () => {
      const cached = await cache.getCurrentUser()
      if (cached) return cached

      const client = getJiraClient()
      const user = await client.getCurrentUser()
      await cache.setCurrentUser(user)
      return user
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    ...options,
  })
}

/**
 * Fetch all visible boards.
 * Stale time: 1 hour.
 */
export function useBoards(options?: Partial<UseQueryOptions<JiraBoard[]>>) {
  const cache = getJiraCache()

  return useQuery<JiraBoard[]>({
    queryKey: jiraKeys.boards(),
    queryFn: async () => {
      const cached = await cache.getBoards()
      if (cached) return cached

      const client = getJiraClient()
      const response = await client.getBoards()
      await cache.setBoards(response.values)
      return response.values
    },
    staleTime: 60 * 60 * 1000,
    ...options,
  })
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

/**
 * Mutation hook for transitioning an issue to a new status.
 *
 * On success, invalidates the issue's query cache and the parent board's
 * issue list so the UI reflects the new state.
 */
export function useTransitionMutation(boardId: number) {
  const queryClient = useQueryClient()
  const cache = getJiraCache()

  return useMutation({
    mutationFn: async ({
      issueKey,
      transitionId,
      fields,
    }: {
      issueKey: string
      transitionId: string
      fields?: Record<string, unknown>
    }) => {
      const client = getJiraClient()
      await client.doTransition(issueKey, transitionId, fields)
    },
    onSuccess: async (_data, variables) => {
      // Invalidate caches so fresh data is fetched
      await cache.invalidateIssue(variables.issueKey)
      await cache.invalidateBoardIssues(boardId)

      // Invalidate TanStack Query caches
      await queryClient.invalidateQueries({
        queryKey: jiraKeys.issue(variables.issueKey),
      })
      await queryClient.invalidateQueries({
        queryKey: jiraKeys.issues(boardId),
      })
      await queryClient.invalidateQueries({
        queryKey: jiraKeys.transitions(variables.issueKey),
      })
    },
  })
}

/**
 * Mutation hook for updating issue fields.
 */
export function useUpdateIssueMutation(boardId: number) {
  const queryClient = useQueryClient()
  const cache = getJiraCache()

  return useMutation({
    mutationFn: async ({ issueKey, fields }: { issueKey: string; fields: Record<string, unknown> }) => {
      const client = getJiraClient()
      await client.updateIssue(issueKey, fields)
    },
    onSuccess: async (_data, variables) => {
      await cache.invalidateIssue(variables.issueKey)

      await queryClient.invalidateQueries({
        queryKey: jiraKeys.issue(variables.issueKey),
      })
      await queryClient.invalidateQueries({
        queryKey: jiraKeys.issues(boardId),
      })
    },
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a JQL clause string from board filters.
 * Returns undefined if no filters are active.
 */
function escapeJql(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function buildFilterJql(filters?: BoardFilters): string | undefined {
  if (!filters) return undefined

  const clauses: string[] = []

  if (filters.assignee) {
    clauses.push(`assignee = "${escapeJql(filters.assignee)}"`)
  }
  if (filters.component) {
    clauses.push(`component = "${escapeJql(filters.component)}"`)
  }
  if (filters.priority) {
    clauses.push(`priority = "${escapeJql(filters.priority)}"`)
  }
  if (filters.issueType) {
    clauses.push(`issuetype = "${escapeJql(filters.issueType)}"`)
  }
  if (filters.text) {
    clauses.push(`text ~ "${escapeJql(filters.text)}"`)
  }

  return clauses.length > 0 ? clauses.join(' AND ') : undefined
}
