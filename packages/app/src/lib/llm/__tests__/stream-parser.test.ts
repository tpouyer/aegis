import { describe, expect, it } from 'vitest'
import { parseAnthropicStream, parseOllamaStream, parseOpenAIStream } from '../stream-parser'
import type { ChatChunk } from '../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a mock Response with an SSE body from an array of lines.
 */
function mockSSEResponse(lines: string[]): Response {
  const text = `${lines.join('\n')}\n`
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

/**
 * Collect all chunks from an async iterable into an array.
 */
async function collectChunks(iterable: AsyncIterable<ChatChunk>): Promise<ChatChunk[]> {
  const chunks: ChatChunk[] = []
  for await (const chunk of iterable) {
    chunks.push(chunk)
  }
  return chunks
}

// ---------------------------------------------------------------------------
// Anthropic stream parser
// ---------------------------------------------------------------------------

describe('parseAnthropicStream', () => {
  it('parses content_block_delta text events into text chunks', async () => {
    const response = mockSSEResponse([
      'event: content_block_start',
      'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" world"}}',
      '',
      'event: message_stop',
      'data: {"type":"message_stop"}',
      '',
    ])

    const chunks = await collectChunks(parseAnthropicStream(response))

    const textChunks = chunks.filter((c) => c.type === 'text')
    expect(textChunks).toHaveLength(2)
    expect(textChunks[0].content).toBe('Hello')
    expect(textChunks[1].content).toBe(' world')

    const doneChunks = chunks.filter((c) => c.type === 'done')
    expect(doneChunks).toHaveLength(1)
  })

  it('parses tool_use events into tool call chunks', async () => {
    const response = mockSSEResponse([
      'event: content_block_start',
      'data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"call_123","name":"coding_standards"}}',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"repo\\""}}',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":": \\"awx\\"}"}}',
      '',
      'event: content_block_stop',
      'data: {"type":"content_block_stop","index":0}',
      '',
      'event: message_stop',
      'data: {"type":"message_stop"}',
      '',
    ])

    const chunks = await collectChunks(parseAnthropicStream(response))

    const toolCallChunks = chunks.filter((c) => c.type === 'tool_call')
    expect(toolCallChunks).toHaveLength(1)
    expect(toolCallChunks[0].toolCall).toEqual({
      id: 'call_123',
      name: 'coding_standards',
      arguments: { repo: 'awx' },
    })
  })

  it('emits an error chunk on API error events', async () => {
    const response = mockSSEResponse([
      'event: error',
      'data: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}',
      '',
    ])

    const chunks = await collectChunks(parseAnthropicStream(response))

    const errorChunks = chunks.filter((c) => c.type === 'error')
    expect(errorChunks).toHaveLength(1)
    expect(errorChunks[0].error).toBe('Overloaded')
  })
})

// ---------------------------------------------------------------------------
// OpenAI stream parser
// ---------------------------------------------------------------------------

describe('parseOpenAIStream', () => {
  it('parses delta content into text chunks', async () => {
    const response = mockSSEResponse([
      'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}',
      '',
      'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}',
      '',
      'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":" there"},"finish_reason":null}]}',
      '',
      'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
      '',
      'data: [DONE]',
      '',
    ])

    const chunks = await collectChunks(parseOpenAIStream(response))

    const textChunks = chunks.filter((c) => c.type === 'text')
    expect(textChunks).toHaveLength(2)
    expect(textChunks[0].content).toBe('Hello')
    expect(textChunks[1].content).toBe(' there')

    const doneChunks = chunks.filter((c) => c.type === 'done')
    expect(doneChunks).toHaveLength(1)
  })

  it('handles [DONE] sentinel correctly', async () => {
    const response = mockSSEResponse([
      'data: {"id":"x","choices":[{"index":0,"delta":{"content":"A"},"finish_reason":null}]}',
      '',
      'data: {"id":"x","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
      '',
      'data: [DONE]',
      '',
    ])

    const chunks = await collectChunks(parseOpenAIStream(response))

    // [DONE] should be silently consumed, not produce a chunk
    const textChunks = chunks.filter((c) => c.type === 'text')
    expect(textChunks).toHaveLength(1)
    expect(textChunks[0].content).toBe('A')

    // The done chunk comes from finish_reason: stop
    expect(chunks.filter((c) => c.type === 'done')).toHaveLength(1)
  })

  it('handles malformed SSE lines gracefully (skip, do not crash)', async () => {
    const response = mockSSEResponse([
      'this is not valid SSE',
      '',
      'data: not valid json',
      '',
      'data: {"id":"x","choices":[{"index":0,"delta":{"content":"OK"},"finish_reason":null}]}',
      '',
      ': this is a comment',
      '',
      'data: {"id":"x","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
      '',
    ])

    const chunks = await collectChunks(parseOpenAIStream(response))

    // Only the valid content line should produce a chunk
    const textChunks = chunks.filter((c) => c.type === 'text')
    expect(textChunks).toHaveLength(1)
    expect(textChunks[0].content).toBe('OK')

    // No error chunks from malformed lines
    const errorChunks = chunks.filter((c) => c.type === 'error')
    expect(errorChunks).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Ollama stream parser
// ---------------------------------------------------------------------------

describe('parseOllamaStream', () => {
  it('parses NDJSON messages with content into text chunks', async () => {
    const response = mockSSEResponse([
      '{"model":"llama3","message":{"role":"assistant","content":"Hi"},"done":false}',
      '{"model":"llama3","message":{"role":"assistant","content":" there"},"done":false}',
      '{"model":"llama3","message":{"role":"assistant","content":""},"done":true}',
    ])

    const chunks = await collectChunks(parseOllamaStream(response))

    const textChunks = chunks.filter((c) => c.type === 'text')
    expect(textChunks).toHaveLength(2)
    expect(textChunks[0].content).toBe('Hi')
    expect(textChunks[1].content).toBe(' there')

    const doneChunks = chunks.filter((c) => c.type === 'done')
    expect(doneChunks).toHaveLength(1)
  })

  it('emits error chunk on Ollama error response', async () => {
    const response = mockSSEResponse(['{"error":"model not found"}'])

    const chunks = await collectChunks(parseOllamaStream(response))

    expect(chunks).toHaveLength(1)
    expect(chunks[0].type).toBe('error')
    expect(chunks[0].error).toBe('model not found')
  })
})
