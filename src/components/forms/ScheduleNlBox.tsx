import { useMutation } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { proposeScheduleFn } from '@/lib/schedule/server-fns'

interface ScheduleNlBoxProps {
  timezone: string
  onApply: (next: {
    triggerKind: 'cron' | 'interval'
    cronExpression: string
    intervalSeconds: number
    summary: string
    request: string
  }) => void
}

export function ScheduleNlBox({ timezone, onApply }: ScheduleNlBoxProps) {
  const [text, setText] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const propose = useMutation({
    mutationFn: () => proposeScheduleFn({ data: { text, timezone } }),
    onSuccess: (result) => {
      if (result.ok) {
        const p = result.proposal
        onApply({
          triggerKind: p.kind,
          cronExpression: p.cronExpression,
          intervalSeconds: p.intervalSeconds,
          summary: p.summary,
          request: text.trim(),
        })
        setText('')
        setMessage(null)
        return
      }
      setMessage(
        result.reason === 'ai_unavailable'
          ? "Schedule suggestions aren't available right now. Set it manually below."
          : "Couldn't read that one. Try rephrasing, or set it manually below.",
      )
    },
    onError: () => setMessage("Couldn't reach the suggestion service. Set it manually below."),
  })

  const submit = () => {
    if (text.trim()) propose.mutate()
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Input
          value={text}
          placeholder="Describe a schedule — e.g. every weekday at 9am"
          onChange={(e) => setText(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!text.trim() || propose.isPending}
          onClick={submit}
        >
          {propose.isPending ? <Spinner /> : <Sparkles aria-hidden />}{' '}
          {propose.isPending ? 'Thinking…' : 'Propose'}
        </Button>
      </div>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  )
}
