/**
 * Vertex AI provider — Claude via Google Cloud.
 *
 * Uses the streamRawPredict endpoint which accepts the standard
 * Anthropic Messages API format. Auth is via a Google OAuth token
 * managed by the Service Worker.
 *
 * Endpoint pattern:
 *   https://{region}-aiplatform.googleapis.com/v1/projects/{project}
 *     /locations/{region}/publishers/anthropic/models/{model}:streamRawPredict
 */

import type {
  ChatChunk,
  ChatMessage,
  ChatParams,
  LLMProvider,
  ModelInfo,
} from '../types';
import { parseAnthropicStream } from '../stream-parser';

const VERTEX_MODELS: ModelInfo[] = [
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6 (Vertex)',
    contextWindow: 200_000,
    supportsToolUse: true,
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5 (Vertex)',
    contextWindow: 200_000,
    supportsToolUse: true,
  },
];

/**
 * Convert our ChatMessage format to Anthropic Messages API format
 * (same format as direct Anthropic, since Vertex streamRawPredict
 * accepts the Anthropic body).
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

export interface VertexConfig {
  project: string;
  region: string;
  /** Google OAuth access token. In production, obtained from SW. */
  accessToken: string;
}

export class VertexProvider implements LLMProvider {
  readonly id = 'vertex';
  readonly name = 'Vertex AI (Claude)';
  readonly models = VERTEX_MODELS;
  readonly supportsToolUse = true;
  readonly supportsStreaming = true;
  readonly maxContextWindow = 200_000;

  private project: string;
  private region: string;
  private accessToken: string;

  constructor(config: VertexConfig) {
    this.project = config.project;
    this.region = config.region;
    this.accessToken = config.accessToken;
  }

  async *chat(params: ChatParams): AsyncIterable<ChatChunk> {
    const model = params.model;
    const url =
      `https://${this.region}-aiplatform.googleapis.com/v1/` +
      `projects/${this.project}/locations/${this.region}/` +
      `publishers/anthropic/models/${model}:streamRawPredict`;

    const body: Record<string, unknown> = {
      anthropic_version: 'vertex-2023-10-16',
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

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      yield {
        type: 'error',
        error: `Vertex AI error ${response.status}: ${errorText}`,
      };
      return;
    }

    yield* parseAnthropicStream(response);
  }
}
