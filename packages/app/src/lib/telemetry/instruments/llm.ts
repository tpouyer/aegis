import type { ChatChunk } from '@/lib/llm/types'
import { getLlmMeter } from '../meters'

const operationDuration = getLlmMeter().createHistogram('gen_ai.client.operation.duration', {
  description: 'Total LLM chat operation duration',
  unit: 'ms',
})

const ttft = getLlmMeter().createHistogram('gen_ai.client.time_to_first_token', {
  description: 'Time from request to first text token',
  unit: 'ms',
})

const tokenUsage = getLlmMeter().createCounter('gen_ai.client.token.usage', {
  description: 'Approximate token usage',
  unit: '{token}',
})

const errorCount = getLlmMeter().createCounter('gen_ai.client.request.error.count', {
  description: 'LLM request errors',
  unit: '{error}',
})

export async function* instrumentedChat(
  providerId: string,
  modelId: string,
  stream: AsyncIterable<ChatChunk>,
): AsyncIterable<ChatChunk> {
  const startTime = performance.now()
  let firstTokenTime: number | null = null
  let outputChars = 0
  const attrs = { 'gen_ai.system': providerId, 'gen_ai.request.model': modelId }

  try {
    for await (const chunk of stream) {
      if (chunk.type === 'text' && chunk.content) {
        if (firstTokenTime === null) {
          firstTokenTime = performance.now()
          ttft.record(firstTokenTime - startTime, attrs)
        }
        outputChars += chunk.content.length
      }

      if (chunk.type === 'error') {
        errorCount.add(1, { ...attrs, 'error.type': chunk.error ?? 'unknown' })
      }

      yield chunk
    }
  } finally {
    operationDuration.record(performance.now() - startTime, attrs)
    if (outputChars > 0) {
      tokenUsage.add(Math.ceil(outputChars / 4), { ...attrs, 'gen_ai.token.type': 'output' })
    }
  }
}
