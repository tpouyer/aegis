/**
 * Jira REST API v3 domain types.
 *
 * These types model the Jira Cloud REST v3 response shapes used by the
 * Aegis kanban board. They are intentionally kept lean — only fields
 * the board actually consumes are included.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface JiraConfig {
  /** Base URL for the Jira Cloud instance, e.g. https://your-domain.atlassian.net */
  baseUrl: string
  /** Atlassian Cloud site ID (for OAuth auth) */
  cloudId?: string
  /** API token auth: user email */
  email?: string
  /** API token auth: personal API token from id.atlassian.com */
  apiToken?: string
}

// ---------------------------------------------------------------------------
// Core entities
// ---------------------------------------------------------------------------

export interface JiraUser {
  accountId: string
  displayName: string
  emailAddress?: string
  avatarUrls: {
    '48x48': string
    '32x32': string
    '24x24': string
    '16x16': string
  }
  active: boolean
}

export interface JiraStatus {
  id: string
  name: string
  description?: string
  statusCategory: {
    id: number
    key: string // 'new' | 'indeterminate' | 'done'
    name: string
    colorName: string
  }
}

export interface JiraPriority {
  id: string
  name: string
  iconUrl: string
}

export interface JiraIssueType {
  id: string
  name: string
  description?: string
  iconUrl: string
  subtask: boolean
}

export interface JiraComponent {
  id: string
  name: string
  description?: string
}

export interface JiraSprint {
  id: number
  name: string
  state: 'active' | 'closed' | 'future'
  startDate?: string
  endDate?: string
  completeDate?: string
  goal?: string
}

// ---------------------------------------------------------------------------
// Issue
// ---------------------------------------------------------------------------

export interface JiraIssueLink {
  id: string
  type: {
    id: string
    name: string
    inward: string
    outward: string
  }
  inwardIssue?: JiraIssueSummary
  outwardIssue?: JiraIssueSummary
}

export interface JiraIssueSummary {
  id: string
  key: string
  fields: {
    summary: string
    status: JiraStatus
    priority: JiraPriority
    issuetype: JiraIssueType
  }
}

export interface JiraComment {
  id: string
  author: JiraUser
  body: unknown // Atlassian Document Format (ADF)
  created: string
  updated: string
}

export interface JiraIssue {
  id: string
  key: string
  self: string
  fields: {
    summary: string
    description: unknown | null // ADF or null
    status: JiraStatus
    priority: JiraPriority
    issuetype: JiraIssueType
    assignee: JiraUser | null
    reporter: JiraUser | null
    components: JiraComponent[]
    labels: string[]
    created: string
    updated: string
    /** Story points — custom field, varies by instance */
    [storyPointField: `customfield_${string}`]: number | null | undefined
    fixVersions?: Array<{ id: string; name: string; released: boolean }>
    sprint?: JiraSprint | null
    subtasks?: JiraIssueSummary[]
    issuelinks?: JiraIssueLink[]
    comment?: {
      comments: JiraComment[]
      total: number
    }
    /** Acceptance criteria — often a custom field or stored in description */
    [acceptanceCriteriaField: string]: unknown
  }
}

// ---------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------

export interface JiraBoard {
  id: number
  name: string
  type: 'kanban' | 'scrum' | 'simple'
  self: string
  location?: {
    projectId: number
    projectKey: string
    projectName: string
    displayName?: string
    projectTypeKey?: string
    avatarURI?: string
  }
}

export interface JiraBoardColumn {
  name: string
  statuses: Array<{ id: string; self: string }>
}

export interface JiraBoardConfig {
  id: number
  name: string
  columnConfig: {
    columns: JiraBoardColumn[]
  }
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

export interface JiraTransition {
  id: string
  name: string
  to: JiraStatus
  hasScreen: boolean
  isGlobal: boolean
  isInitial: boolean
  isConditional: boolean
  fields?: Record<string, JiraTransitionField>
}

export interface JiraTransitionField {
  required: boolean
  name: string
  fieldId: string
  allowedValues?: Array<{ id: string; name: string }>
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export interface JiraProject {
  id: string
  key: string
  name: string
  projectTypeKey?: string
  avatarUrls?: Record<string, string>
}

// ---------------------------------------------------------------------------
// API response wrappers
// ---------------------------------------------------------------------------

export interface JiraPaginatedResponse<T> {
  startAt: number
  maxResults: number
  total: number
  values: T[]
}

export interface JiraSearchResponse {
  startAt: number
  maxResults: number
  total: number
  issues: JiraIssue[]
}

export interface JiraTransitionsResponse {
  transitions: JiraTransition[]
}

// ---------------------------------------------------------------------------
// Board UI types (derived, not from API)
// ---------------------------------------------------------------------------

export interface BoardColumn {
  name: string
  statusIds: string[]
  issues: JiraIssue[]
}

export interface BoardFilters {
  assignee: string | null
  component: string | null
  priority: string | null
  text: string | null
  issueType: string | null
}
