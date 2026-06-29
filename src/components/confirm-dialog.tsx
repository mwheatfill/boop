import type { ReactElement, ReactNode } from 'react'
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

// A confirmation gate for a single destructive (or otherwise weighty) action,
// triggered by `trigger`. The canonical AlertDialog (UI craft §1: destructive →
// AlertDialog); the action runs after the dialog closes so a toast can track it.
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  destructive = true,
  onConfirm,
}: {
  trigger: ReactElement
  title: string
  description: ReactNode
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => unknown
}) {
  const [open, setOpen] = useState(false)
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? 'destructive' : 'default'}
            onClick={() => {
              setOpen(false)
              void onConfirm()
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
