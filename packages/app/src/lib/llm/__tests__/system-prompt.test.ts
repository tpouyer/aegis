import { describe, expect, it } from 'vitest'
import { buildSystemPrompt } from '../system-prompt'

describe('buildSystemPrompt', () => {
  it('builds a prompt with issue key and summary', () => {
    const prompt = buildSystemPrompt({
      issueKey: 'AAP-1234',
      issueSummary: 'Add PATCH endpoint for labels',
      supportsToolUse: true,
    })

    expect(prompt).toContain('AAP-1234')
    expect(prompt).toContain('Add PATCH endpoint for labels')
    expect(prompt).toContain('## Issue')
  })

  it('includes acceptance criteria when present', () => {
    const prompt = buildSystemPrompt({
      issueKey: 'AAP-5678',
      issueSummary: 'Fix login flow',
      issueDescription: 'The login form fails on mobile.',
      acceptanceCriteria: '- Login works on iOS Safari\n- Login works on Android Chrome',
      supportsToolUse: true,
    })

    expect(prompt).toContain('## Acceptance Criteria')
    expect(prompt).toContain('Login works on iOS Safari')
    expect(prompt).toContain('Login works on Android Chrome')
  })

  it('inlines org context when tool use is not supported', () => {
    const prompt = buildSystemPrompt({
      issueKey: 'AAP-9999',
      issueSummary: 'Refactor auth module',
      orgContext: [
        { name: 'Coding Standards', body: 'Use TypeScript strict mode.' },
        { name: 'Testing Guidelines', body: 'Write unit tests for all exports.' },
      ],
      supportsToolUse: false,
    })

    expect(prompt).toContain('## Coding Standards')
    expect(prompt).toContain('Use TypeScript strict mode.')
    expect(prompt).toContain('## Testing Guidelines')
    expect(prompt).toContain('Write unit tests for all exports.')
    // Should NOT contain the tool use instruction
    expect(prompt).not.toContain('You have access to tools')
  })

  it('does not inline org context when tool use is supported', () => {
    const prompt = buildSystemPrompt({
      issueKey: 'AAP-9999',
      issueSummary: 'Refactor auth module',
      orgContext: [{ name: 'Coding Standards', body: 'Use TypeScript strict mode.' }],
      supportsToolUse: true,
    })

    // Org context should NOT be inlined
    expect(prompt).not.toContain('## Coding Standards')
    expect(prompt).not.toContain('Use TypeScript strict mode.')
    // Should contain the tool use instruction
    expect(prompt).toContain('You have access to tools')
  })

  it('uses a default description when none is provided', () => {
    const prompt = buildSystemPrompt({
      issueKey: 'AAP-0001',
      issueSummary: 'Something',
      supportsToolUse: false,
    })

    expect(prompt).toContain('No description provided.')
  })

  it('lists MCP tools when provided', () => {
    const prompt = buildSystemPrompt({
      issueKey: 'AAP-1000',
      issueSummary: 'Test MCP',
      supportsToolUse: true,
      mcpTools: [
        { name: 'search_issues', description: 'Search Jira issues', serverName: 'AAP SDLC' },
        { name: 'get_standards', description: 'Get coding standards', serverName: 'AAP SDLC' },
      ],
    })

    expect(prompt).toContain('## Available Tools')
    expect(prompt).toContain('**search_issues** (AAP SDLC)')
    expect(prompt).toContain('**get_standards** (AAP SDLC)')
  })

  it('omits Available Tools section when no MCP tools', () => {
    const prompt = buildSystemPrompt({
      issueKey: 'AAP-1001',
      issueSummary: 'No tools',
      supportsToolUse: true,
    })

    expect(prompt).not.toContain('## Available Tools')
  })

  it('omits Available Tools section when mcpTools is empty array', () => {
    const prompt = buildSystemPrompt({
      issueKey: 'AAP-1002',
      issueSummary: 'Empty tools',
      supportsToolUse: true,
      mcpTools: [],
    })

    expect(prompt).not.toContain('## Available Tools')
  })
})
