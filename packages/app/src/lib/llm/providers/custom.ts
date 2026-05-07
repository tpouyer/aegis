/**
 * Custom OpenAI-compatible endpoint provider.
 *
 * Accepts any user-provided URL that exposes an OpenAI-compatible
 * chat completions API. Useful for self-hosted LLMs (vLLM, text-generation-inference),
 * enterprise gateways, or less common providers.
 */

import type {
  ChatChunk,
  ChatMessage,
  ChatParams,
  LLMProvider,
  ModelInfo,
} from '../types';
import { parseOpenAIStream } from '../stream-parser';

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

export interface CustomProviderConfig {
  name?: string;
  endpoint: string;
  apiKey?: string;
  model: string;
  supportsToolUse?: boolean;
}

export class CustomProvider implements LLMProvider {
  readonly id = 'custom';
  readonly name: string;
  readonly models: ModelInfo[];
  readonly supportsToolUse: boolean;
  readonly supportsStreaming = true;
  readonly maxContextWindow = 128_000;

  private relayUrl: string;

  constructor(config: CustomProviderConfig) {
    this.name = config.name ?? 'Custom Endpoint';
    // Route through SW relay — SW injects API key from secure storage
    this.relayUrl = `/_aegis/llm/custom/${encodeURIComponent(config.endpoint)}`;
    this.supportsToolUse = config.supportsToolUse ?? false;
    this.models = [
      {
        id: config.model,
        name: config.model,
        contextWindow: 128_000,
        supportsToolUse: this.supportsToolUse,
      },
    ];
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

    if (params.tools && params.tools.length > 0 && this.supportsToolUse) {
      body.tools = params.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }));
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    let response: Response;
    try {
      response = await fetch(this.relayUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    } catch (err) {
      yield {
        type: 'error',
        error: `Cannot connect to ${this.endpoint}. Check the URL and try again.`,
      };
      return;
    }

    if (!response.ok) {
      const errorText = await response.text();
      yield {
        type: 'error',
        error: `Custom endpoint error ${response.status}: ${errorText}`,
      };
      return;
    }

    yield* parseOpenAIStream(response);
  }
}
