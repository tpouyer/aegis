/**
 * Anthropic direct API provider.
 *
 * Uses the Messages API at https://api.anthropic.com/v1/messages.
 * Supports SSE streaming and full tool use.
 *
 * API key is stored in the Service Worker scope and injected into
 * requests via the SW's fetch handler at /_aegis/llm/anthropic/...
 */

import type {
  ChatChunk,
  ChatMessage,
  ChatParams,
  LLMProvider,
  ModelInfo,
} from '../types';
import { parseAnthropicStream } from '../stream-parser';

const ANTHROPIC_MODELS: ModelInfo[] = [
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    contextWindow: 200_000,
    supportsToolUse: true,
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    contextWindow: 200_000,
    supportsToolUse: true,
  },
];

/**
 * Convert our ChatMessage format to Anthropic Messages API format.
 */
function toAnthropicMessages(
  messages: ChatMessage[],
): Array<Record<string, unknown>> {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      const content: Array<Record<string, unknown>> = [];

      if (m.content) {
        content.push({ type: 'text', text: m.content });
      }

      if (m.toolCalls) {
        for (const tc of m.toolCalls) {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.arguments,
          });
        }
      }

      if (m.toolResults) {
        for (const tr of m.toolResults) {
          content.push({
            type: 'tool_result',
            tool_use_id: tr.toolCallId,
            content: tr.content,
            is_error: tr.isError ?? false,
          });
        }
      }

      return {
        role: m.role,
        content: content.length === 1 && content[0].type === 'text'
          ? m.content
          : content,
      };
    });
}

export class AnthropicProvider implements LLMProvider {
  readonly id = 'anthropic';
  readonly name = 'Anthropic';
  readonly models = ANTHROPIC_MODELS;
  readonly supportsToolUse = true;
  readonly supportsStreaming = true;
  readonly maxContextWindow = 200_000;

  private relayUrl: string;

  constructor(config: { apiKey?: string; baseUrl?: string }) {
    // Route through Service Worker relay — SW injects the API key
    // The key is sent to SW via sendTokenToSW() at registration time
    this.relayUrl = '/_aegis/llm/anthropic';
  }

  async *chat(params: ChatParams): AsyncIterable<ChatChunk> {
    const body: Record<string, unknown> = {
      model: params.model,
      messages: toAnthropicMessages(params.messages),
      max_tokens: params.maxTokens ?? 4096,
      stream: params.stream !== false,
    };

    if (params.systemPrompt) {
      body.system = params.systemPrompt;
    }

    if (params.temperature !== undefined) {
      body.temperature = params.temperature;
    }

    if (params.tools && params.tools.length > 0) {
      body.tools = params.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
      }));
    }

    const response = await fetch(`${this.relayUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: params.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      yield {
        type: 'error',
        error: `Anthropic API error ${response.status}: ${errorText}`,
      };
      return;
    }

    yield* parseAnthropicStream(response);
  }
}
