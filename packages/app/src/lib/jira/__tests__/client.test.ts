import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { JiraConfig } from '../types'

// ---------------------------------------------------------------------------
// Mock resilientFetch (clients now use this instead of bare fetch)
// ---------------------------------------------------------------------------

const mockFetch = vi.hoisted(() => vi.fn())
vi.mock('../../fetch/resilient-fetch', () => ({
  resilientFetch: (...args: unknown[]) => mockFetch(...args),
}))

import { JiraClient, JiraClientError } from '../client'

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  })
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const config: JiraConfig = {
  baseUrl: 'https://test.atlassian.net',
  cloudId: 'test-cloud-id',
}

describe('JiraClient', () => {
  let client: JiraClient

  beforeEach(() => {
    client = new JiraClient(config)
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // -----------------------------------------------------------------------
  // getBoards
  // -----------------------------------------------------------------------

  it('getBoards builds correct URL with pagination params', async () => {
    mockFetch.mockReturnValue(
      jsonResponse({
        startAt: 0,
        maxResults: 50,
        total: 1,
        values: [{ id: 1, name: 'Test Board', type: 'kanban' }],
      }),
    )

    await client.getBoards(0, 25)

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toBe(
      'https://test.atlassian.net/ex/jira/test-cloud-id/rest/agile/1.0/board?startAt=0&maxResults=25',
    )
  })

  // -----------------------------------------------------------------------
  // getIssuesForBoard
  // -----------------------------------------------------------------------

  it('getIssuesForBoard includes JQL parameter in the URL', async () => {
    mockFetch.mockReturnValue(
      jsonResponse({
        startAt: 0,
        maxResults: 100,
        total: 0,
        issues: [],
      }),
    )

    const jql = 'assignee = currentUser()'
    await client.getIssuesForBoard(42, jql)

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('jql=assignee+%3D+currentUser%28%29')
    expect(calledUrl).toContain('/board/42/issue')
  })

  // -----------------------------------------------------------------------
  // doTransition
  // -----------------------------------------------------------------------

  it('doTransition sends correct POST body with transition id and optional fields', async () => {
    mockFetch.mockReturnValue(
      Promise.resolve({
        ok: true,
        status: 204,
        statusText: 'No Content',
        json: () => Promise.resolve(undefined),
        text: () => Promise.resolve(''),
      }),
    )

    await client.doTransition('AAP-123', '31', { resolution: { name: 'Done' } })

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/3/issue/AAP-123/transitions')
    expect(init.method).toBe('POST')

    const body = JSON.parse(init.body)
    expect(body.transition).toEqual({ id: '31' })
    expect(body.fields).toEqual({ resolution: { name: 'Done' } })
  })

  // -----------------------------------------------------------------------
  // searchIssues
  // -----------------------------------------------------------------------

  it('searchIssues sends POST with JQL, fields, and pagination', async () => {
    mockFetch.mockReturnValue(
      jsonResponse({
        startAt: 10,
        maxResults: 25,
        total: 100,
        issues: [],
      }),
    )

    await client.searchIssues('project = AAP ORDER BY rank', ['summary', 'status'], 25, 10)

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/3/search')
    expect(init.method).toBe('POST')

    const body = JSON.parse(init.body)
    expect(body.jql).toBe('project = AAP ORDER BY rank')
    expect(body.fields).toEqual(['summary', 'status'])
    expect(body.maxResults).toBe(25)
    expect(body.startAt).toBe(10)
  })

  // -----------------------------------------------------------------------
  // getIssue
  // -----------------------------------------------------------------------

  it('getIssue fetches with correct issue key in URL', async () => {
    const mockIssue = {
      id: '10001',
      key: 'AAP-456',
      self: 'https://test.atlassian.net/rest/api/3/issue/10001',
      fields: { summary: 'Test issue' },
    }

    mockFetch.mockReturnValue(jsonResponse(mockIssue))

    const issue = await client.getIssue('AAP-456')

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toBe('https://test.atlassian.net/ex/jira/test-cloud-id/rest/api/3/issue/AAP-456')
    expect(issue.key).toBe('AAP-456')
  })

  // -----------------------------------------------------------------------
  // Error handling
  // -----------------------------------------------------------------------

  it('throws JiraClientError on non-OK responses', async () => {
    mockFetch.mockReturnValue(
      Promise.resolve({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('Issue not found'),
      }),
    )

    await expect(client.getIssue('NOPE-999')).rejects.toThrow(JiraClientError)
    await expect(client.getIssue('NOPE-999')).rejects.toThrow('404')
  })

  // -----------------------------------------------------------------------
  // getCurrentUser
  // -----------------------------------------------------------------------

  it('getCurrentUser calls the correct /myself endpoint', async () => {
    const mockUser = {
      accountId: 'abc123',
      displayName: 'Test User',
      emailAddress: 'test@example.com',
      active: true,
      avatarUrls: {
        '48x48': 'https://avatar.example.com/48',
        '32x32': 'https://avatar.example.com/32',
        '24x24': 'https://avatar.example.com/24',
        '16x16': 'https://avatar.example.com/16',
      },
    }

    mockFetch.mockReturnValue(jsonResponse(mockUser))

    const user = await client.getCurrentUser()

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('/api/3/myself')
    expect(user.accountId).toBe('abc123')
    expect(user.displayName).toBe('Test User')
  })
})
