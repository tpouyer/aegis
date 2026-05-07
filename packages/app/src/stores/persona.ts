import { create } from 'zustand';

export type PersonaRole = 'developer' | 'pm' | 'qa' | 'architect' | 'manager' | 'support';

export const PERSONA_LABELS: Record<PersonaRole, string> = {
  developer: 'Developer',
  pm: 'Product Manager',
  qa: 'Quality Assurance',
  architect: 'Architect',
  manager: 'Development Manager',
  support: 'Customer Support',
};

export const PERSONA_DESCRIPTIONS: Record<PersonaRole, string> = {
  developer: 'Implementation, code quality, and technical approach',
  pm: 'Scope, requirements, dependencies, and stakeholder communication',
  qa: 'Test coverage, edge cases, and regression risk',
  architect: 'Design patterns, system coupling, and cross-cutting concerns',
  manager: 'Team capacity, blockers, and progress tracking',
  support: 'Customer impact, workarounds, and fix timelines',
};

const STORAGE_KEY = 'aegis_persona';

function getInitialRole(): PersonaRole {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in PERSONA_LABELS) return stored as PersonaRole;
  } catch { /* noop */ }
  return 'developer';
}

interface PersonaStore {
  role: PersonaRole;
  setRole: (role: PersonaRole) => void;
}

export const usePersonaStore = create<PersonaStore>((set) => ({
  role: getInitialRole(),
  setRole: (role) => {
    set({ role });
    try { localStorage.setItem(STORAGE_KEY, role); } catch { /* noop */ }
  },
}));
