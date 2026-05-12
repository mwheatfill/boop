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
import { Button } from '@/components/ui/button'

interface ArchiveDialogProps {
  entityNoun: 'Customer' | 'Target' | 'Job'
  entityName: string
  onArchive: () => Promise<void> | void
  blockReason?: string | null
  onOpenChange?: (open: boolean) => void
}

export function ArchiveDialog({
  entityNoun,
  entityName,
  onArchive,
  blockReason,
  onOpenChange,
}: ArchiveDialogProps) {
  const [submitting, setSubmitting] = useState(false)

  return (
    <AlertDialog onOpenChange={onOpenChange}>
      <AlertDialogTrigger render={<Button variant="outline" size="sm" />}>
        Archive
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive {entityNoun}?</AlertDialogTitle>
          <AlertDialogDescription>
            {blockReason
              ? blockReason
              : `Archiving ${entityName} hides it from default lists. You can restore it later.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {!blockReason ? (
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault()
                setSubmitting(true)
                try {
                  await onArchive()
                } finally {
                  setSubmitting(false)
                }
              }}
              disabled={submitting}
            >
              {submitting ? 'Archiving…' : 'Archive'}
            </AlertDialogAction>
          ) : null}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
