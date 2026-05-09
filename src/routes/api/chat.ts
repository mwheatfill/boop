import { createFileRoute } from '@tanstack/react-router'
import { convertToModelMessages, streamText, type UIMessage } from 'ai'
import { getAIClient, getDefaultModelName } from '@/lib/ai/client'
import { z } from '@/shared/schemas/openapi'

const ChatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        parts: z.array(z.unknown()),
      }),
    )
    .min(1),
})

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = ChatRequestSchema.safeParse(await request.json())
        if (!parsed.success) {
          return Response.json(
            { error: 'Invalid chat request', details: parsed.error.issues },
            { status: 400 },
          )
        }

        const client = getAIClient()
        const result = streamText({
          model: client(getDefaultModelName()),
          messages: await convertToModelMessages(parsed.data.messages as UIMessage[]),
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
