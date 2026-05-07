/**
 * MSW (Mock Service Worker) request handlers for Jira and GitHub REST APIs.
 *
 * These handlers intercept fetch requests during integration tests and
 * return realistic mock data without hitting real API endpoints.
 */

import { http, HttpResponse } from 'msw';

// ---------------------------------------------------------------------------
// Mock data — Jira
// ---------------------------------------------------------------------------

const jiraBaseUrl = 'https://test.atlassian.net';
const cloudId = 'test-cloud-id';

const mockBoards = {
  startAt: 0,
  maxResults: 50,
  total: 1,
  values: [
    {
      id: 1,
      name: 'AEGIS Board',
      type: 'kanban' as const,
      self: `${jiraBaseUrl}/ex/jira/${cloudId}/rest/agile/1.0/board/1`,
      location: {
        projectId: 10000,
        projectKey: 'AEGIS',
        projectName: 'Aegis',
      },
    },
  ],
};

const mockBoardConfig = {
  id: 1,
  name: 'AEGIS Board',
  columnConfig: {
    columns: [
      {
        name: 'To Do',
        statuses: [{ id: '1', self: `${jiraBaseUrl}/rest/api/3/status/1` }],
      },
      {
        name: 'In Progress',
        statuses: [{ id: '2', self: `${jiraBaseUrl}/rest/api/3/status/2` }],
      },
      {
        name: 'Done',
        statuses: [{ id: '3', self: `${jiraBaseUrl}/rest/api/3/status/3` }],
      },
    ],
  },
};

const mockIssues = {
  startAt: 0,
  maxResults: 100,
  total: 3,
  issues: [
    {
      id: '10001',
      key: 'AEGIS-1',
      self: `${jiraBaseUrl}/rest/api/3/issue/AEGIS-1`,
      fields: {
        summary: 'Implement authentication flow',
        description: null,
        status: {
          id: '1',
          name: 'To Do',
          statusCategory: { id: 2, key: 'new', name: 'To Do', colorName: 'blue-gray' },
        },
        priority: { id: '3', name: 'Medium', iconUrl: '' },
        issuetype: { id: '10001', name: 'Story', iconUrl: '', subtask: false },
        assignee: {
          accountId: 'user-1',
          displayName: 'Alice Developer',
          avatarUrls: {
            '48x48': 'https://avatar.example.com/48.png',
            '32x32': 'https://avatar.example.com/32.png',
            '24x24': 'https://avatar.example.com/24.png',
            '16x16': 'https://avatar.example.com/16.png',
          },
          active: true,
        },
        reporter: null,
        components: [{ id: '10100', name: 'Auth', description: 'Authentication module' }],
        labels: ['security'],
        created: '2025-01-01T00:00:00.000Z',
        updated: '2025-01-02T00:00:00.000Z',
      },
    },
    {
      id: '10002',
      key: 'AEGIS-2',
      self: `${jiraBaseUrl}/rest/api/3/issue/AEGIS-2`,
      fields: {
        summary: 'Fix dashboard rendering bug',
        description: 'The dashboard fails to render when there are no issues.',
        status: {
          id: '2',
          name: 'In Progress',
          statusCategory: { id: 4, key: 'indeterminate', name: 'In Progress', colorName: 'yellow' },
        },
        priority: { id: '2', name: 'High', iconUrl: '' },
        issuetype: { id: '10002', name: 'Bug', iconUrl: '', subtask: false },
        assignee: null,
        reporter: null,
        components: [{ id: '10101', name: 'UI', description: 'User interface' }],
        labels: [],
        created: '2025-01-03T00:00:00.000Z',
        updated: '2025-01-04T00:00:00.000Z',
      },
    },
    {
      id: '10003',
      key: 'AEGIS-3',
      self: `${jiraBaseUrl}/rest/api/3/issue/AEGIS-3`,
      fields: {
        summary: 'Add unit tests for auth module',
        description: null,
        status: {
          id: '3',
          name: 'Done',
          statusCategory: { id: 3, key: 'done', name: 'Done', colorName: 'green' },
        },
        priority: { id: '4', name: 'Low', iconUrl: '' },
        issuetype: { id: '10001', name: 'Story', iconUrl: '', subtask: false },
        assignee: null,
        reporter: null,
        components: [],
        labels: ['testing'],
        created: '2025-01-05T00:00:00.000Z',
        updated: '2025-01-06T00:00:00.000Z',
      },
    },
  ],
};

const mockTransitions = {
  transitions: [
    {
      id: '11',
      name: 'Start Progress',
      to: {
        id: '2',
        name: 'In Progress',
        statusCategory: { id: 4, key: 'indeterminate', name: 'In Progress', colorName: 'yellow' },
      },
      hasScreen: false,
      isGlobal: true,
      isInitial: false,
      isConditional: false,
    },
    {
      id: '21',
      name: 'Done',
      to: {
        id: '3',
        name: 'Done',
        statusCategory: { id: 3, key: 'done', name: 'Done', colorName: 'green' },
      },
      hasScreen: false,
      isGlobal: true,
      isInitial: false,
      isConditional: false,
    },
    {
      id: '31',
      name: 'Reopen',
      to: {
        id: '1',
        name: 'To Do',
        statusCategory: { id: 2, key: 'new', name: 'To Do', colorName: 'blue-gray' },
      },
      hasScreen: false,
      isGlobal: true,
      isInitial: false,
      isConditional: false,
    },
  ],
};

// ---------------------------------------------------------------------------
// Mock data — GitHub
// ---------------------------------------------------------------------------

const mockTree = {
  sha: 'abc123tree',
  tree: [
    { path: 'README.md', mode: '100644', type: 'blob', sha: 'blob1', size: 256 },
    { path: 'src', mode: '040000', type: 'tree', sha: 'tree1' },
    { path: 'src/index.ts', mode: '100644', type: 'blob', sha: 'blob2', size: 128 },
    { path: 'src/utils.ts', mode: '100644', type: 'blob', sha: 'blob3', size: 512 },
    { path: 'package.json', mode: '100644', type: 'blob', sha: 'blob4', size: 1024 },
  ],
  truncated: false,
};

const mockRef = {
  ref: 'refs/heads/main',
  object: { sha: 'commit-sha-main-head' },
};

const mockCommit = {
  sha: 'commit-sha-main-head',
  message: 'feat: initial commit',
  author: { name: 'Alice', email: 'alice@example.com', date: '2025-01-01T00:00:00Z' },
  tree: { sha: 'abc123tree' },
  parents: [],
};

const mockFileContent = {
  path: 'src/index.ts',
  content: btoa('export const hello = "world";'),
  sha: 'blob2',
  encoding: 'base64',
  size: 128,
};

const mockCreatedBlob = { sha: 'new-blob-sha' };
const mockCreatedTree = { sha: 'new-tree-sha' };
const mockCreatedCommit = { sha: 'new-commit-sha' };

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const handlers = [
  // ── Jira: Boards ─────────────────────────────────────────────────
  http.get(`${jiraBaseUrl}/ex/jira/${cloudId}/rest/agile/1.0/board`, () => {
    return HttpResponse.json(mockBoards);
  }),

  http.get(
    `${jiraBaseUrl}/ex/jira/${cloudId}/rest/agile/1.0/board/:boardId/configuration`,
    () => {
      return HttpResponse.json(mockBoardConfig);
    },
  ),

  // ── Jira: Issues ─────────────────────────────────────────────────
  http.get(
    `${jiraBaseUrl}/ex/jira/${cloudId}/rest/agile/1.0/board/:boardId/issue`,
    () => {
      return HttpResponse.json(mockIssues);
    },
  ),

  http.get(
    `${jiraBaseUrl}/ex/jira/${cloudId}/rest/api/3/issue/:issueKey`,
    ({ params }) => {
      const issue = mockIssues.issues.find((i) => i.key === params.issueKey);
      if (!issue) {
        return HttpResponse.json(
          { errorMessages: ['Issue not found'] },
          { status: 404 },
        );
      }
      return HttpResponse.json(issue);
    },
  ),

  http.post(
    `${jiraBaseUrl}/ex/jira/${cloudId}/rest/api/3/search`,
    () => {
      return HttpResponse.json(mockIssues);
    },
  ),

  // ── Jira: Transitions ────────────────────────────────────────────
  http.get(
    `${jiraBaseUrl}/ex/jira/${cloudId}/rest/api/3/issue/:issueKey/transitions`,
    () => {
      return HttpResponse.json(mockTransitions);
    },
  ),

  http.post(
    `${jiraBaseUrl}/ex/jira/${cloudId}/rest/api/3/issue/:issueKey/transitions`,
    () => {
      return new HttpResponse(null, { status: 204 });
    },
  ),

  // ── GitHub: Trees ────────────────────────────────────────────────
  http.get('https://api.github.com/repos/:owner/:repo/git/trees/:sha', () => {
    return HttpResponse.json(mockTree);
  }),

  // ── GitHub: Refs ─────────────────────────────────────────────────
  http.get('https://api.github.com/repos/:owner/:repo/git/ref/:ref', () => {
    return HttpResponse.json(mockRef);
  }),

  http.post('https://api.github.com/repos/:owner/:repo/git/refs', () => {
    return HttpResponse.json({
      ref: 'refs/heads/feature-branch',
      object: { sha: 'new-branch-sha' },
    });
  }),

  http.patch(
    'https://api.github.com/repos/:owner/:repo/git/refs/:ref',
    () => {
      return HttpResponse.json(mockRef);
    },
  ),

  // ── GitHub: Commits ──────────────────────────────────────────────
  http.get(
    'https://api.github.com/repos/:owner/:repo/git/commits/:sha',
    () => {
      return HttpResponse.json(mockCommit);
    },
  ),

  http.post(
    'https://api.github.com/repos/:owner/:repo/git/commits',
    () => {
      return HttpResponse.json(mockCreatedCommit);
    },
  ),

  // ── GitHub: Contents ─────────────────────────────────────────────
  http.get(
    'https://api.github.com/repos/:owner/:repo/contents/:path',
    () => {
      return HttpResponse.json(mockFileContent);
    },
  ),

  // ── GitHub: Blobs ────────────────────────────────────────────────
  http.get(
    'https://api.github.com/repos/:owner/:repo/git/blobs/:sha',
    () => {
      return HttpResponse.json({
        content: btoa('file content here'),
        encoding: 'base64',
      });
    },
  ),

  http.post(
    'https://api.github.com/repos/:owner/:repo/git/blobs',
    () => {
      return HttpResponse.json(mockCreatedBlob);
    },
  ),

  // ── GitHub: Trees (create) ───────────────────────────────────────
  http.post(
    'https://api.github.com/repos/:owner/:repo/git/trees',
    () => {
      return HttpResponse.json(mockCreatedTree);
    },
  ),

  // ── GitHub: Pull Requests ────────────────────────────────────────
  http.post(
    'https://api.github.com/repos/:owner/:repo/pulls',
    () => {
      return HttpResponse.json({
        number: 42,
        title: 'Test PR',
        body: 'Test PR body',
        html_url: 'https://github.com/test/repo/pull/42',
        state: 'open',
        head: { ref: 'feature-branch', sha: 'head-sha' },
        base: { ref: 'main', sha: 'base-sha' },
      });
    },
  ),
];

// Re-export mock data for use in integration tests
export {
  mockBoards,
  mockBoardConfig,
  mockIssues,
  mockTransitions,
  mockTree,
  mockRef,
  mockCommit,
  mockFileContent,
};
