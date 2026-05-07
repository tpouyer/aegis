import type { PersonaRole } from '@/stores/persona'

const PROMPTS: Record<PersonaRole, string[]> = {
  developer: [
    'What are the acceptance criteria for this issue?',
    'Suggest an implementation approach for this issue',
    'What files in the codebase are most relevant?',
    'Are there any potential edge cases I should consider?',
  ],
  pm: [
    'Is this issue well-scoped? Are the requirements clear?',
    'What are the dependencies for this issue?',
    'Draft a brief status update for stakeholders',
    'Does the acceptance criteria cover all edge cases?',
  ],
  qa: [
    'Generate test cases from the acceptance criteria',
    'What is the regression risk of this change?',
    'What should the test plan cover?',
    'Are there untested scenarios or edge cases?',
  ],
  architect: [
    'Does this approach follow our architectural patterns?',
    'What is the coupling impact of this change?',
    'Are there security implications to consider?',
    'What alternative approaches were considered?',
  ],
  manager: [
    'What is blocking this issue?',
    'How does this affect the current sprint?',
    'Who else is working in this area?',
    'What is the estimated effort remaining?',
  ],
  support: [
    'Has this issue been fixed? In which version?',
    'What is the customer workaround?',
    'How many customers are affected by this?',
    'What is the expected fix timeline?',
  ],
}

const GENERAL_PROMPTS: Record<PersonaRole, string[]> = {
  developer: [
    'Explain how our authentication architecture works',
    'What coding standards should I follow?',
    'Help me understand the caching strategy',
    'What testing patterns does the team use?',
  ],
  pm: [
    'Summarize the current sprint progress',
    'What features are at risk this sprint?',
    'Help me draft a release update',
    'What items need refinement for next sprint?',
  ],
  qa: [
    'What areas have the weakest test coverage?',
    'Help me write a regression test plan',
    'What changed recently that needs testing?',
    'Are there any known flaky tests?',
  ],
  architect: [
    'Explain the system architecture overview',
    'What technical debt should we prioritize?',
    'Review the cross-service data flow',
    'What scalability concerns exist?',
  ],
  manager: [
    'Give me a team velocity summary',
    'What are the current blockers across the team?',
    'Which issues have been in progress the longest?',
    'Help me prepare for the sprint retrospective',
  ],
  support: [
    'Search for issues related to a customer problem',
    'What are the most common recent bug reports?',
    'Check the status of a customer escalation',
    'What was fixed in the latest release?',
  ],
}

export function getSuggestedPrompts(role: PersonaRole, issueKey?: string): string[] {
  return issueKey ? PROMPTS[role] : GENERAL_PROMPTS[role]
}

export const PERSONA_SYSTEM_DESCRIPTIONS: Record<PersonaRole, string> = {
  developer: 'Focus on implementation, code quality, and technical approach.',
  pm: 'Focus on scope, requirements clarity, dependencies, and stakeholder communication.',
  qa: 'Focus on test coverage, edge cases, acceptance criteria validation, and regression risk.',
  architect: 'Focus on design patterns, system coupling, scalability, and cross-cutting concerns.',
  manager: 'Focus on team capacity, blockers, progress tracking, and risk assessment.',
  support: 'Focus on customer impact, workarounds, fix timelines, and communication.',
}
