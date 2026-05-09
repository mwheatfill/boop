import { createFileRoute } from '@tanstack/react-router'
import { convertToModelMessages, streamText, type UIMessage } from 'ai'
import { getAIClient, getDefaultModelName } from '@/lib/ai/client'

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as { messages: UIMessage[] }

        const client = getAIClient()
        const result = streamText({
          model: client(getDefaultModelName()),
          messages: await convertToModelMessages(messages),
        })

        const response = result.toUIMessageStreamResponse()
        // Workers' default response compression buffers SSE chunks, making the
        // chat appear to hang. Setting Content-Encoding: identity disables it.
        response.headers.set('Content-Encoding', 'identity')
        return response
      },
    },
  },
})
