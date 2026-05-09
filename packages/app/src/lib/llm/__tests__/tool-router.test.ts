import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mcpManager } from '@/lib/mcp/manager'
import { skillManager } from '@/lib/skills/manager'
import { routeToolCall } from '../tool-router'
import type { ToolCall } from '../types'

vi.mock('@/lib/mcp/manager', () => ({
  mcpManager: {
    findServerForTool: vi.fn(),
    callTool: vi.fn(),
  },
}))

vi.mock('@/lib/skills/manager', () => ({
  skillManager: {
    readSkillFile: vi.fn(),
    listSkillFiles: vi.fn(),
  },
}))

function makeToolCall(name: string, args: Record<string, unknown> = {}): ToolCall {
  return { id: `call-${name}`, name, arguments: args }
}

describe('routeToolCall', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('routes org_context tool to local handler', async () => {
    const result = await routeToolCall(makeToolCall('org_context', { topic: 'coding_standards' }))
    expect(result.toolCallId).toBe('call-org_context')
    expect(result.isError).toBeFalsy()
    expect(result.content).toContain('Coding Standards')
  })

  it('routes content tools to local handler', async () => {
    const result = await routeToolCall(makeToolCall('coding_standards', { repo: 'test' }))
    expect(result.toolCallId).toBe('call-coding_standards')
    expect(result.isError).toBeFalsy()
  })

  it('routes MCP tools to mcpManager when server is found', async () => {
    vi.mocked(mcpManager.findServerForTool).mockReturnValue({
      serverId: 'test-server',
      serverName: 'Test',
      sessionId: 's1',
      tools: [{ name: 'remote_tool', inputSchema: {} }],
      status: 'connected',
    })
    vi.mocked(mcpManager.callTool).mockResolvedValue({
      toolCallId: '',
      content: 'MCP result',
    })

    const result = await routeToolCall(makeToolCall('remote_tool', { query: 'test' }))

    expect(result.toolCallId).toBe('call-remote_tool')
    expect(result.content).toBe('MCP result')
    expect(mcpManager.callTool).toHaveBeenCalledWith('remote_tool', { query: 'test' })
  })

  it('returns error for unknown tools when no MCP server matches', async () => {
    vi.mocked(mcpManager.findServerForTool).mockReturnValue(undefined)

    const result = await routeToolCall(makeToolCall('totally_unknown'))

    expect(result.toolCallId).toBe('call-totally_unknown')
    expect(result.isError).toBe(true)
    expect(result.content).toContain('Unknown tool')
  })

  it('catches errors from MCP tool calls', async () => {
    vi.mocked(mcpManager.findServerForTool).mockReturnValue({
      serverId: 'err-server',
      serverName: 'Err',
      sessionId: 's2',
      tools: [{ name: 'failing_tool', inputSchema: {} }],
      status: 'connected',
    })
    vi.mocked(mcpManager.callTool).mockRejectedValue(new Error('Connection lost'))

    const result = await routeToolCall(makeToolCall('failing_tool'))

    expect(result.isError).toBe(true)
    expect(result.content).toContain('Connection lost')
  })

  it('returns all org context when no topic specified', async () => {
    const result = await routeToolCall(makeToolCall('org_context'))
    expect(result.isError).toBeFalsy()
    expect(result.content).toContain('Coding Standards')
    expect(result.content).toContain('Testing Guidelines')
  })

  it('returns error for unknown org_context topic', async () => {
    const result = await routeToolCall(makeToolCall('org_context', { topic: 'nonexistent' }))
    expect(result.isError).toBe(true)
    expect(result.content).toContain('not found')
  })

  it('routes read_skill_file to skill manager', async () => {
    vi.mocked(skillManager.readSkillFile).mockResolvedValue('# Skill Instructions\nDo things.')

    const result = await routeToolCall(makeToolCall('read_skill_file', { skillId: 'p:review', path: 'SKILL.md' }))

    expect(result.toolCallId).toBe('call-read_skill_file')
    expect(result.content).toContain('Skill Instructions')
    expect(skillManager.readSkillFile).toHaveBeenCalledWith('p:review', 'SKILL.md')
  })

  it('routes list_skill_files to skill manager', async () => {
    vi.mocked(skillManager.listSkillFiles).mockResolvedValue([
      { path: 'SKILL.md', size: 100 },
      { path: 'script.py', size: 50 },
    ])

    const result = await routeToolCall(makeToolCall('list_skill_files', { skillId: 'p:review' }))

    expect(result.toolCallId).toBe('call-list_skill_files')
    expect(result.content).toContain('SKILL.md')
    expect(result.content).toContain('script.py')
  })

  it('returns error for read_skill_file without skillId', async () => {
    const result = await routeToolCall(makeToolCall('read_skill_file'))
    expect(result.isError).toBe(true)
    expect(result.content).toContain('Missing required argument: skillId')
  })

  it('routes add_repo_to_workspace and returns proposal', async () => {
    const result = await routeToolCall(
      makeToolCall('add_repo_to_workspace', { owner: 'ansible', repo: 'awx', reason: 'API changes' }),
    )
    expect(result.toolCallId).toBe('call-add_repo_to_workspace')
    const parsed = JSON.parse(result.content)
    expect(parsed.type).toBe('workspace_proposal')
    expect(parsed.repos[0].owner).toBe('ansible')
  })
})
