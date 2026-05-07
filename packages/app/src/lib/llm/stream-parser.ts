/**
 * SSE stream parsers for LLM providers.
 *
 * All parsers accept a `Response` from `fetch()` and yield `ChatChunk`
 * values as they arrive. We use `ReadableStream` + `TextDecoder` rather
 * than `EventSource` because:
 *   1. EventSource only supports GET — LLM APIs require POST.
 *   2. ReadableStream works identically across all providers.
 *   3. We can handle partial lines and connection drops ourselves.
 */

import type { ChatChunk, ToolCall } from './types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Yields individual SSE lines from a `Response` body.
 * Handles partial chunks that may arrive split across reads.
 */
async function* readSSELines(response: Response): AsyncIterable<string> {
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('Response body is not readable')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Split on newlines; the last segment is a possibly-incomplete line
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        yield line
      }
    }

    // Flush remaining buffer
    if (buffer.length > 0) {
      yield buffer
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Extract the JSON payload from an SSE `data: …` line.
 * Returns null for non-data lines, empty data, or the [DONE] sentinel.
 */
function parseSSEData(line: string): unknown | null {
  const trimmed = line.trim()

  if (!trimmed.startsWith('data:')) return null

  const payload = trimmed.slice(5).trim()

  if (payload === '' || payload === '[DONE]') return null

  try {
    return JSON.parse(payload)
  } catch {
    // Malformed JSON — skip the line silently
    return null
  }
}

// ---------------------------------------------------------------------------
// Anthropic Messages API (direct + Vertex)
// ---------------------------------------------------------------------------

/**
 * Parse an SSE stream from the Anthropic Messages API.
 *
 * Event types we care about:
 *   - `content_block_delta` with `delta.type === "text_delta"` → text
 *   - `content_block_start` with `content_block.type === "tool_use"` → tool call start
 *   - `content_block_delta` with `delta.type === "input_json_delta"` → tool call args
 *   - `content_block_stop` → finalize current tool call
 *   - `message_stop` → done
 */
export async function* parseAnthropicStream(response: Response): AsyncIterable<ChatChunk> {
  let currentToolCall: Partial<ToolCall> | null = null
  let toolArgsJson = ''

  for await (const line of readSSELines(response)) {
    // Anthropic sends `event: <type>` lines followed by `data: <json>`.
    // We only process data lines.
    const data = parseSSEData(line)
    if (data === null) continue

    const event = data as Record<string, unknown>
    const eventType = event.type as string | undefined

    if (eventType === 'content_block_start') {
      const block = event.content_block as Record<string, unknown> | undefined
      if (block?.type === 'tool_use') {
        currentToolCall = {
          id: block.id as string,
          name: block.name as string,
        }
        toolArgsJson = ''
      }
    } else if (eventType === 'content_block_delta') {
      const delta = event.delta as Record<string, unknown> | undefined
      if (!delta) continue

      if (delta.type === 'text_delta') {
        yield { type: 'text', content: delta.text as string }
      } else if (delta.type === 'input_json_delta') {
        toolArgsJson += delta.partial_json as string
      }
    } else if (eventType === 'content_block_stop') {
      if (currentToolCall) {
        let args: Record<string, unknown> = {}
        try {
          args = toolArgsJson ? JSON.parse(toolArgsJson) : {}
        } catch {
          // malformed tool args — emit with empty args
        }
        yield {
          type: 'tool_call',
          toolCall: {
            id: currentToolCall.id!,
            name: currentToolCall.name!,
            arguments: args,
          },
        }
        currentToolCall = null
        toolArgsJson = ''
      }
    } else if (eventType === 'message_stop') {
      yield { type: 'done' }
    } else if (eventType === 'error') {
      const error = event.error as Record<string, unknown> | undefined
      yield {
        type: 'error',
        error: (error?.message as string) ?? 'Unknown Anthropic API error',
      }
    }
  }
}

// ---------------------------------------------------------------------------
// OpenAI Chat Completions API
// ---------------------------------------------------------------------------

/**
 * Parse an SSE stream from the OpenAI Chat Completions API.
 *
 * Each `data:` payload contains a `choices[0].delta` object:
 *   - `delta.content` → text
 *   - `delta.tool_calls` → tool call chunks
 *   - `[DONE]` → end of stream
 */
export async function* parseOpenAIStream(response: Response): AsyncIterable<ChatChunk> {
  const pendingToolCalls = new Map<number, { id: string; name: string; args: string }>()

  for await (const line of readSSELines(response)) {
    const data = parseSSEData(line)
    if (data === null) continue

    const payload = data as Record<string, unknown>
    const choices = payload.choices as Array<Record<string, unknown>> | undefined
    if (!choices || choices.length === 0) continue

    const choice = choices[0]
    const finishReason = choice.finish_reason as string | null
    const delta = choice.delta as Record<string, unknown> | undefined

    if (delta) {
      // Text content
      if (typeof delta.content === 'string' && delta.content.length > 0) {
        yield { type: 'text', content: delta.content }
      }

      // Tool calls (streamed incrementally)
      const toolCalls = delta.tool_calls as Array<Record<string, unknown>> | undefined
      if (toolCalls) {
        for (const tc of toolCalls) {
          const index = tc.index as number
          const fn = tc.function as Record<string, unknown> | undefined

          if (!pendingToolCalls.has(index)) {
            pendingToolCalls.set(index, {
              id: (tc.id as string) ?? '',
              name: (fn?.name as string) ?? '',
              args: '',
            })
          }

          const pending = pendingToolCalls.get(index)!
          if (tc.id) pending.id = tc.id as string
          if (fn?.name) pending.name = fn.name as string
          if (fn?.arguments) pending.args += fn.arguments as string
        }
      }
    }

    if (finishReason === 'tool_calls' || finishReason === 'stop') {
      // Flush any accumulated tool calls
      for (const [, tc] of pendingToolCalls) {
        let args: Record<string, unknown> = {}
        try {
          args = tc.args ? JSON.parse(tc.args) : {}
        } catch {
          // malformed args
        }
        yield {
          type: 'tool_call',
          toolCall: { id: tc.id, name: tc.name, arguments: args },
        }
      }
      pendingToolCalls.clear()

      if (finishReason === 'stop') {
        yield { type: 'done' }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Ollama /api/chat (NDJSON, not SSE)
// ---------------------------------------------------------------------------

/**
 * Parse a streaming response from the Ollama /api/chat endpoint.
 *
 * Ollama uses newline-delimited JSON (NDJSON) — each line is a complete
 * JSON object with a `message.content` field.
 */
export async function* parseOllamaStream(response: Response): AsyncIterable<ChatChunk> {
  for await (const line of readSSELines(response)) {
    const trimmed = line.trim()
    if (trimmed === '') continue

    let data: Record<string, unknown>
    try {
      data = JSON.parse(trimmed)
    } catch {
      // Malformed line — skip
      continue
    }

    if (data.error) {
      yield { type: 'error', error: data.error as string }
      continue
    }

    const message = data.message as Record<string, unknown> | undefined
    if (message?.content && typeof message.content === 'string') {
      yield { type: 'text', content: message.content }
    }

    // Ollama signals completion with `done: true`
    if (data.done === true) {
      yield { type: 'done' }
    }
  }
}
