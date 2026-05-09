import { useChat } from '@ai-sdk/react'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/chat')({
  component: ChatPage,
})

function ChatPage() {
  const { messages, sendMessage, status } = useChat()
  const [input, setInput] = useState('')

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!input.trim()) return
    sendMessage({ text: input })
    setInput('')
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Streaming chat
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">AI chat</h1>
        <p className="text-sm text-muted-foreground">
          Powered by Vercel AI SDK. Provider via env (default: Microsoft Foundry via Cloudflare AI
          Gateway). Remove this route and the <code className="font-mono">@ai-sdk/*</code> deps if
          your app does not need AI.
        </p>
      </header>

      <ol className="flex flex-col gap-3" aria-live="polite">
        {messages.map((message) => (
          <li
            key={message.id}
            className="rounded-lg border border-border bg-card p-3 text-card-foreground"
          >
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {message.role}
            </p>
            <div className="space-y-2 text-sm">
              {message.parts.map((part, index) =>
                part.type === 'text' ? (
                  // biome-ignore lint/suspicious/noArrayIndexKey: parts within a single message are append-only and stable
                  <p key={index}>{part.text}</p>
                ) : null,
              )}
            </div>
          </li>
        ))}
      </ol>

      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          aria-label="Message"
          className="flex h-9 flex-1 rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Say something..."
          disabled={status === 'streaming' || status === 'submitted'}
        />
        <button
          type="submit"
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          disabled={status === 'streaming' || status === 'submitted' || !input.trim()}
        >
          Send
        </button>
      </form>
    </div>
  )
}
