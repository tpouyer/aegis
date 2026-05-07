/**
 * OpenAI-compatible provider.
 *
 * Uses the Chat Completions API with SSE streaming.
 * Works with OpenAI, Azure OpenAI, OpenRouter, Together AI,
 * and any other OpenAI-compatible API.
 */

import type {
  ChatChunk,
  ChatMessage,
  ChatParams,
  LLMProvider,
  ModelInfo,
} from '../types';
import { parseOpenAIStream } from '../stream-parser';

const OPENAI_MODELS: ModelInfo[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    contextWindow: 128_000,
    supportsToolUse: true,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    contextWindow: 128_000,
    supportsToolUse: true,
  },
];

/**
 * Convert our ChatMessage format to OpenAI Chat Completions format.
 */
function toOpenAIMessages(
  messages: ChatMessage[],
  systemPrompt?: string,
): Array<Record<string, unknown>> {
  const result: Array<Record<string, unknown>> = [];

  if (systemPrompt) {
    result.push({ role: 'system', content: systemPrompt });
  }

  for (const m of messages) {
    if (m.role === 'system') continue;

    if (m.toolResults) {
      // Tool results are sent as separate messages in OpenAI format
      for (const tr of m.toolResults) {
        result.push({
          role: 'tool',
          tool_call_id: tr.toolCallId,
          content: tr.content,
        });
      }
      continue;
    }

    const msg: Record<string, unknown> = {
      role: m.role,
      content: m.content || null,
    };

    if (m.toolCalls && m.toolCalls.length > 0) {
      msg.tool_calls = m.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.arguments),
        },
      }));
    }

    result.push(msg);
  }

  return result;
}

export class OpenAIProvider implements LLMProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI';
  readonly models = OPENAI_MODELS;
  readonly supportsToolUse = true;
  readonly supportsStreaming = true;
  readonly maxContextWindow = 128_000;

  private relayUrl: string;

  constructor(config: { apiKey?: string; baseUrl?: string }) {
    this.relayUrl = '/_aegis/llm/openai';
  }

  async *chat(params: ChatParams): AsyncIterable<ChatChunk> {
    const body: Record<string, unknown> = {
      model: params.model,
      messages: toOpenAIMessages(params.messages, params.systemPrompt),
      max_tokens: params.maxTokens ?? 4096,
      stream: params.stream !== false,
    };

    if (params.temperature !== undefined) {
      body.temperature = params.temperature;
    }

    if (params.tools && params.tools.length > 0) {
      body.tools = params.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }));
    }

    const response = await fetch(`${this.relayUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: params.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      yield {
        type: 'error',
        error: `OpenAI API error ${response.status}: ${errorText}`,
      };
      return;
    }

    yield* parseOpenAIStream(response);
  }
}
