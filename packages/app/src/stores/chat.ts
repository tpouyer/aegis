/**
 * Chat store — Zustand store for AI chat sessions.
 *
 * Each chat session is scoped to a Jira issue key. Sessions persist
 * across page reloads via IndexedDB (using the existing CacheStore).
 *
 * Session TTL: 7 days.
 */

import { create } from 'zustand';
import type { ChatMessage } from '@/lib/llm/types';
import { CacheStore } from '@/lib/cache/indexeddb';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatSession {
  issueKey: string;
  messages: ChatMessage[];
  isStreaming: boolean;
  currentModel: string;
  providerId: string;
}

interface ChatState {
  sessions: Map<string, ChatSession>;
  activeSession: string | null;

  // Actions
  createSession: (
    issueKey: string,
    providerId: string,
    model: string,
  ) => void;
  setActiveSession: (issueKey: string | null) => void;
  addMessage: (issueKey: string, message: ChatMessage) => void;
  appendStreamChunk: (issueKey: string, content: string) => void;
  setStreaming: (issueKey: string, streaming: boolean) => void;
  switchModel: (issueKey: string, model: string) => void;
  switchProvider: (issueKey: string, providerId: string) => void;
  clearSession: (issueKey: string) => void;
  getSession: (issueKey: string) => ChatSession | undefined;

  // Persistence
  loadSession: (issueKey: string) => Promise<void>;
  persistSession: (issueKey: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const CACHE_DB = 'aegis-chat';
const CACHE_STORE = 'sessions';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const chatCache = new CacheStore(CACHE_DB, CACHE_STORE);

/**
 * Serializable representation of a ChatSession for IndexedDB storage.
 */
interface PersistedSession {
  issueKey: string;
  messages: ChatMessage[];
  currentModel: string;
  providerId: string;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: new Map(),
  activeSession: null,

  createSession(issueKey, providerId, model) {
    const { sessions } = get();
    if (sessions.has(issueKey)) return;

    const session: ChatSession = {
      issueKey,
      messages: [],
      isStreaming: false,
      currentModel: model,
      providerId,
    };

    const next = new Map(sessions);
    next.set(issueKey, session);
    set({ sessions: next, activeSession: issueKey });
  },

  setActiveSession(issueKey) {
    set({ activeSession: issueKey });
  },

  addMessage(issueKey, message) {
    const { sessions } = get();
    const session = sessions.get(issueKey);
    if (!session) return;

    const updated: ChatSession = {
      ...session,
      messages: [...session.messages, message],
    };

    const next = new Map(sessions);
    next.set(issueKey, updated);
    set({ sessions: next });

    // Persist asynchronously
    get().persistSession(issueKey);
  },

  appendStreamChunk(issueKey, content) {
    const { sessions } = get();
    const session = sessions.get(issueKey);
    if (!session || session.messages.length === 0) return;

    const messages = [...session.messages];
    const lastMsg = messages[messages.length - 1];

    if (lastMsg.role !== 'assistant') return;

    messages[messages.length - 1] = {
      ...lastMsg,
      content: lastMsg.content + content,
    };

    const next = new Map(sessions);
    next.set(issueKey, { ...session, messages });
    set({ sessions: next });
  },

  setStreaming(issueKey, streaming) {
    const { sessions } = get();
    const session = sessions.get(issueKey);
    if (!session) return;

    const next = new Map(sessions);
    next.set(issueKey, { ...session, isStreaming: streaming });
    set({ sessions: next });

    // Persist when streaming ends
    if (!streaming) {
      get().persistSession(issueKey);
    }
  },

  switchModel(issueKey, model) {
    const { sessions } = get();
    const session = sessions.get(issueKey);
    if (!session) return;

    const next = new Map(sessions);
    next.set(issueKey, { ...session, currentModel: model });
    set({ sessions: next });

    get().persistSession(issueKey);
  },

  switchProvider(issueKey, providerId) {
    const { sessions } = get();
    const session = sessions.get(issueKey);
    if (!session) return;

    const next = new Map(sessions);
    next.set(issueKey, { ...session, providerId });
    set({ sessions: next });

    get().persistSession(issueKey);
  },

  clearSession(issueKey) {
    const { sessions, activeSession } = get();
    const next = new Map(sessions);
    next.delete(issueKey);
    set({
      sessions: next,
      activeSession: activeSession === issueKey ? null : activeSession,
    });

    chatCache.delete(`session:${issueKey}`).catch(() => {
      // Ignore cache deletion errors
    });
  },

  getSession(issueKey) {
    return get().sessions.get(issueKey);
  },

  async loadSession(issueKey) {
    const { sessions } = get();
    if (sessions.has(issueKey)) return;

    try {
      const persisted = await chatCache.get<PersistedSession>(
        `session:${issueKey}`,
      );
      if (!persisted) return;

      const session: ChatSession = {
        issueKey: persisted.issueKey,
        messages: persisted.messages,
        isStreaming: false,
        currentModel: persisted.currentModel,
        providerId: persisted.providerId,
      };

      const next = new Map(get().sessions);
      next.set(issueKey, session);
      set({ sessions: next });
    } catch {
      // Failed to load from cache — start fresh
    }
  },

  async persistSession(issueKey) {
    const session = get().sessions.get(issueKey);
    if (!session) return;

    const persisted: PersistedSession = {
      issueKey: session.issueKey,
      messages: session.messages,
      currentModel: session.currentModel,
      providerId: session.providerId,
    };

    try {
      await chatCache.set(`session:${issueKey}`, persisted, SESSION_TTL_MS);
    } catch {
      // Ignore persistence errors — session is still in memory
    }
  },
}));
