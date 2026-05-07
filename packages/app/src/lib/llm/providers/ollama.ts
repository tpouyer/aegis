/**
 * Ollama provider — local LLM inference.
 *
 * Uses the Ollama REST API at http://localhost:11434.
 * Supports streaming via NDJSON. Tool use support is limited
 * (depends on the loaded model).
 *
 * Auto-detects available models via GET /api/tags.
 */

import type {
  ChatChunk,
  ChatMessage,
  ChatParams,
  LLMProvider,
  ModelInfo,
} from '../types';
import { parseOllamaStream } from '../stream-parser';

/**
 * Convert our ChatMessage format to Ollama /api/chat format.
 */
function toOllamaMessages(
  messages: ChatMessage[],
  systemPrompt?: string,
): Array<Record<string, unknown>> {
  const result: Array<Record<string, unknown>> = [];

  if (systemPrompt) {
    result.push({ role: 'system', content: systemPrompt });
  }

  for (const m of messages) {
    if (m.role === 'system') continue;
    result.push({
      role: m.role,
      content: m.content,
    });
  }

  return result;
}

export class OllamaProvider implements LLMProvider {
  readonly id = 'ollama';
  readonly name = 'Ollama (Local)';
  models: ModelInfo[] = [];
  readonly supportsToolUse = false;
  readonly supportsStreaming = true;
  readonly maxContextWindow = 32_000;

  private endpoint: string;

  constructor(config?: { endpoint?: string }) {
    this.endpoint = config?.endpoint ?? 'http://localhost:11434';
  }

  /**
   * Fetch available models from the Ollama instance and populate
   * the `models` array. Safe to call multiple times.
   */
  async detectModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`${this.endpoint}/api/tags`);
      if (!response.ok) {
        return this.models;
      }

      const data = (await response.json()) as {
        models?: Array<{ name: string; details?: Record<string, unknown> }>;
      };

      this.models = (data.models ?? []).map((m) => ({
        id: m.name,
        name: m.name,
        contextWindow: 32_000,
        supportsToolUse: false,
      }));

      return this.models;
    } catch {
      // Ollama not running or unreachable — return empty
      return this.models;
    }
  }

  async *chat(params: ChatParams): AsyncIterable<ChatChunk> {
    const body: Record<string, unknown> = {
      model: params.model,
      messages: toOllamaMessages(params.messages, params.systemPrompt),
      stream: params.stream !== false,
    };

    if (params.temperature !== undefined) {
      body.options = { temperature: params.temperature };
    }

    let response: Response;
    try {
      response = await fetch(`${this.endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      yield {
        type: 'error',
        error: `Cannot connect to Ollama at ${this.endpoint}. Is it running?`,
      };
      return;
    }

    if (!response.ok) {
      const errorText = await response.text();
      yield {
        type: 'error',
        error: `Ollama error ${response.status}: ${errorText}`,
      };
      return;
    }

    yield* parseOllamaStream(response);
  }
}
