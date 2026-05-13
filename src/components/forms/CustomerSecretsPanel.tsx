import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  createCustomerSecretFn,
  listCustomerSecretsFn,
  revokeCustomerSecretFn,
} from '@/lib/customer-secrets/server-fns'
import type { SecretRevealedResponse, SecretSummary } from '@/shared/schemas/customer-secret'

const customerSecretsOptions = (customerSlug: string) =>
  queryOptions({
    queryKey: ['customers', customerSlug, 'secrets'],
    queryFn: () => listCustomerSecretsFn({ data: { customerSlug } }),
  })

async function copyToClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success('Secret value copied to clipboard')
  } catch {
    toast.error('Clipboard not available')
  }
}

interface CustomerSecretsPanelProps {
  customerSlug: string
  canEdit: boolean
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString()
}

export function CustomerSecretsPanel({ customerSlug, canEdit }: CustomerSecretsPanelProps) {
  const queryClient = useQueryClient()
  const { data } = useQuery(customerSecretsOptions(customerSlug))
  const secrets = data?.secrets ?? []

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPlaintext, setNewPlaintext] = useState('')
  const [justRevealed, setJustRevealed] = useState<SecretRevealedResponse | null>(null)
  const [pending, setPending] = useState(false)
  const [revoking, setRevoking] = useState<SecretSummary | null>(null)

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['customers', customerSlug, 'secrets'] })

  async function handleCreate() {
    if (!newName || !newPlaintext) return
    setPending(true)
    try {
      const revealed = await createCustomerSecretFn({
        data: { customerSlug, name: newName, plaintext: newPlaintext },
      })
      setJustRevealed(revealed)
      setNewName('')
      setNewPlaintext('')
      setCreating(false)
      await invalidate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create secret')
    } finally {
      setPending(false)
    }
  }

  async function handleRevoke() {
    if (!revoking) return
    setPending(true)
    try {
      await revokeCustomerSecretFn({
        data: { customerSlug, name: revoking.name },
      })
      setRevoking(null)
      await invalidate()
      toast.success(`Revoked ${revoking.name}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {secrets.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No secrets yet. Reference one in a template with{' '}
          <code className="font-mono">{'{% boop_secret "name" %}'}</code>.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5" aria-label="Customer secrets">
          {secrets.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-xs text-foreground">{s.name}</span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Created {formatTimestamp(s.createdAt)} ·{' '}
                  {s.lastUsedAt ? `last used ${formatTimestamp(s.lastUsedAt)}` : 'Never used'}
                </span>
              </div>
              {canEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Revoke ${s.name}`}
                  onClick={() => setRevoking(s)}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit && !creating ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => setCreating(true)}
        >
          <Plus className="size-3.5" aria-hidden /> New secret
        </Button>
      ) : null}

      {canEdit && creating ? (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="new-secret-name" className="text-xs">
                Name
              </Label>
              <Input
                id="new-secret-name"
                value={newName}
                onChange={(e) => setNewName(e.currentTarget.value)}
                placeholder="stripe_api_key"
                className="h-7 font-mono text-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="new-secret-value" className="text-xs">
                Plaintext value
              </Label>
              <Input
                id="new-secret-value"
                value={newPlaintext}
                type="password"
                onChange={(e) => setNewPlaintext(e.currentTarget.value)}
                placeholder="sk_live_…"
                className="h-7 font-mono text-xs"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setCreating(false)
                setNewName('')
                setNewPlaintext('')
              }}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleCreate()}
              disabled={pending || !newName || !newPlaintext}
            >
              {pending ? 'Storing…' : 'Store secret'}
            </Button>
          </div>
        </div>
      ) : null}

      <AlertDialog open={justRevealed !== null} onOpenChange={(o) => !o && setJustRevealed(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Secret stored. Save it now.</AlertDialogTitle>
            <AlertDialogDescription>
              boop won't show this plaintext again. Copy it to your password manager before closing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {justRevealed ? (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
              <code className="flex-1 truncate font-mono text-xs">{justRevealed.plaintext}</code>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Copy plaintext"
                onClick={() => void copyToClipboard(justRevealed.plaintext)}
              >
                <Copy className="size-3.5" aria-hidden />
              </Button>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setJustRevealed(null)}>
              I've saved it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={revoking !== null} onOpenChange={(o) => !o && setRevoking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke {revoking?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Templates referencing this secret will fail at fire time until you create a new value
              with the same name.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleRevoke()} disabled={pending}>
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!canEdit && secrets.length === 0 ? (
        <p className="text-xs text-muted-foreground/70">Only Admins can add or revoke secrets.</p>
      ) : null}
    </div>
  )
}
