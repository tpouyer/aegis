/**
 * LLM provider abstraction types.
 *
 * These types define the common interface that all LLM providers implement,
 * allowing the chat UI to work with any provider (Vertex AI, Anthropic,
 * OpenAI, Ollama, or custom endpoints) through a single interface.
 */

export interface LLMProvider {
  id: string;
  name: string;
  models: ModelInfo[];
  supportsToolUse: boolean;
  supportsStreaming: boolean;
  maxContextWindow: number;
  chat(params: ChatParams): AsyncIterable<ChatChunk>;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  supportsToolUse: boolean;
}

export interface ChatParams {
  model: string;
  messages: ChatMessage[];
  systemPrompt?: string;
  tools?: ToolDefinition[];
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  timestamp: number;
}

export interface ChatChunk {
  type: 'text' | 'tool_call' | 'tool_result' | 'error' | 'done';
  content?: string;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  error?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ProviderConfig {
  providerId: string;
  apiKey?: string;
  endpoint?: string;
  model?: string;
}
