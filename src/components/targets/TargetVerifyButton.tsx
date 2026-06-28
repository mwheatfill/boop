import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { verifyTargetFn } from '@/lib/targets/server-fns'

export function TargetVerifyButton({ targetId }: { targetId: string }) {
  const verify = useMutation({
    mutationFn: () => verifyTargetFn({ data: { targetId } }),
    onSuccess: (result) => {
      if (result.ok) toast.success(result.detail)
      else toast.error(result.detail)
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Verify failed'),
  })

  return (
    <Button variant="outline" size="xs" disabled={verify.isPending} onClick={() => verify.mutate()}>
      {verify.isPending ? 'Verifying…' : 'Verify'}
    </Button>
  )
}
