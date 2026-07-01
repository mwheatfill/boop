import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Plus, Trash2 } from 'lucide-react'
import { useReducer } from 'react'
import { toast } from 'sonner'
import { DateTime } from '@/components/DateTime'
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
import { copyToClipboard } from '@/lib/clipboard'
import {
  workspaceSecretKeys,
  workspaceSecretsQueryOptions,
} from '@/lib/workspace-secrets/query-options'
import {
  createWorkspaceSecretFn,
  revokeWorkspaceSecretFn,
} from '@/lib/workspace-secrets/server-fns'
import type { SecretRevealedResponse, SecretSummary } from '@/shared/schemas/workspace-secret'

interface WorkspaceSecretsPanelProps {
  workspaceSlug: string
  canEdit: boolean
}

interface WorkspaceSecretsState {
  creating: boolean
  newName: string
  newPlaintext: string
  justRevealed: SecretRevealedResponse | null
  pending: boolean
  revoking: SecretSummary | null
}

type WorkspaceSecretsAction =
  | { type: 'create-opened' }
  | { type: 'create-canceled' }
  | { type: 'create-name-changed'; value: string }
  | { type: 'create-plaintext-changed'; value: string }
  | { type: 'create-submitted' }
  | { type: 'create-succeeded'; revealed: SecretRevealedResponse }
  | { type: 'request-failed' }
  | { type: 'reveal-dismissed' }
  | { type: 'revoke-requested'; secret: SecretSummary }
  | { type: 'revoke-canceled' }
  | { type: 'revoke-submitted' }
  | { type: 'revoke-succeeded' }

const initialWorkspaceSecretsState: WorkspaceSecretsState = {
  creating: false,
  newName: '',
  newPlaintext: '',
  justRevealed: null,
  pending: false,
  revoking: null,
}

function workspaceSecretsReducer(
  state: WorkspaceSecretsState,
  action: WorkspaceSecretsAction,
): WorkspaceSecretsState {
  switch (action.type) {
    case 'create-opened':
      return { ...state, creating: true }
    case 'create-canceled':
      return { ...state, creating: false, newName: '', newPlaintext: '' }
    case 'create-name-changed':
      return { ...state, newName: action.value }
    case 'create-plaintext-changed':
      return { ...state, newPlaintext: action.value }
    case 'create-submitted':
    case 'revoke-submitted':
      return { ...state, pending: true }
    case 'create-succeeded':
      return {
        ...state,
        creating: false,
        newName: '',
        newPlaintext: '',
        justRevealed: action.revealed,
        pending: false,
      }
    case 'request-failed':
      return { ...state, pending: false }
    case 'reveal-dismissed':
      return { ...state, justRevealed: null }
    case 'revoke-requested':
      return { ...state, revoking: action.secret }
    case 'revoke-canceled':
      return { ...state, revoking: null }
    case 'revoke-succeeded':
      return { ...state, pending: false, revoking: null }
  }
}

export function WorkspaceSecretsPanel({ workspaceSlug, canEdit }: WorkspaceSecretsPanelProps) {
  const queryClient = useQueryClient()
  const { data } = useQuery(workspaceSecretsQueryOptions(workspaceSlug))
  const secrets = data?.secrets ?? []

  const [state, dispatch] = useReducer(workspaceSecretsReducer, initialWorkspaceSecretsState)
  const { creating, newName, newPlaintext, justRevealed, pending, revoking } = state

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: workspaceSecretKeys.all(workspaceSlug) })

  async function handleCreate() {
    if (!newName || !newPlaintext) return
    dispatch({ type: 'create-submitted' })
    try {
      const revealed = await createWorkspaceSecretFn({
        data: { workspaceSlug, name: newName, plaintext: newPlaintext },
      })
      await invalidate()
      dispatch({ type: 'create-succeeded', revealed })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create secret')
      dispatch({ type: 'request-failed' })
    }
  }

  async function handleRevoke() {
    if (!revoking) return
    dispatch({ type: 'revoke-submitted' })
    try {
      await revokeWorkspaceSecretFn({
        data: { workspaceSlug, name: revoking.name },
      })
      await invalidate()
      toast.success(`Revoked ${revoking.name}`)
      dispatch({ type: 'revoke-succeeded' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke')
      dispatch({ type: 'request-failed' })
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
        <ul className="flex flex-col gap-1.5" aria-label="Workspace secrets">
          {secrets.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-xs text-foreground">{s.name}</span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Created <DateTime value={s.createdAt} /> · last used{' '}
                  <DateTime value={s.lastUsedAt} fallback="never" />
                </span>
              </div>
              {canEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Revoke ${s.name}`}
                  onClick={() => dispatch({ type: 'revoke-requested', secret: s })}
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
          onClick={() => dispatch({ type: 'create-opened' })}
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
                onChange={(e) =>
                  dispatch({ type: 'create-name-changed', value: e.currentTarget.value })
                }
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
                onChange={(e) =>
                  dispatch({ type: 'create-plaintext-changed', value: e.currentTarget.value })
                }
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
              onClick={() => dispatch({ type: 'create-canceled' })}
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

      <AlertDialog
        open={justRevealed !== null}
        onOpenChange={(o) => !o && dispatch({ type: 'reveal-dismissed' })}
      >
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
                onClick={() =>
                  void copyToClipboard(justRevealed.plaintext, 'Secret value copied to clipboard')
                }
              >
                <Copy className="size-3.5" aria-hidden />
              </Button>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => dispatch({ type: 'reveal-dismissed' })}>
              I've saved it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={revoking !== null}
        onOpenChange={(o) => !o && dispatch({ type: 'revoke-canceled' })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke {revoking?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Templates that use this secret will fail when the Job runs until you create a new
              value with the same name.
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
