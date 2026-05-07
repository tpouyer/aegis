/**
 * System prompt builder.
 *
 * Assembles the system prompt that gives the LLM context about the Jira
 * issue being worked on and, when tool use is not available, inlines
 * organizational context (coding standards, architecture docs, etc.).
 */

export interface SystemPromptParams {
  issueKey: string;
  issueSummary: string;
  issueDescription?: string;
  acceptanceCriteria?: string;
  orgContext?: Array<{ name: string; body: string }>;
  supportsToolUse: boolean;
}

export function buildSystemPrompt(params: SystemPromptParams): string {
  const parts: string[] = [];

  parts.push(
    `You are an AI assistant helping with ${params.issueKey}: ${params.issueSummary}`,
  );
  parts.push('');

  parts.push('## Issue');
  parts.push(params.issueDescription ?? 'No description provided.');
  parts.push('');

  if (params.acceptanceCriteria) {
    parts.push('## Acceptance Criteria');
    parts.push(params.acceptanceCriteria);
    parts.push('');
  }

  if (!params.supportsToolUse && params.orgContext && params.orgContext.length > 0) {
    // When the provider does not support tool use, inline all org context
    // so the LLM still has access to coding standards, guidelines, etc.
    for (const ctx of params.orgContext) {
      parts.push(`## ${ctx.name}`);
      parts.push(ctx.body);
      parts.push('');
    }
  }

  if (params.supportsToolUse) {
    parts.push(
      'You have access to tools for looking up coding standards, testing guidelines, and other organizational knowledge. Use them when relevant to give advice that follows the team\'s conventions.',
    );
    parts.push('');
  }

  return parts.join('\n').trim();
}
