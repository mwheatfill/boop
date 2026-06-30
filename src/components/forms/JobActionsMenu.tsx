import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Job } from '@/shared/schemas/job'

interface JobActionsMenuProps {
  status: Job['status']
  onPause: () => void
  onResume: () => void
  onArchive: () => void
  onRestore: () => void
  onSaveAsTemplate: () => void
}

export function JobActionsMenu({
  status,
  onPause,
  onResume,
  onArchive,
  onRestore,
  onSaveAsTemplate,
}: JobActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="icon-sm" aria-label="Actions" />}
      >
        <MoreHorizontal aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {status !== 'archived' ? (
          <DropdownMenuItem onClick={onSaveAsTemplate}>Save as template…</DropdownMenuItem>
        ) : null}
        {status === 'active' ? <DropdownMenuItem onClick={onPause}>Pause</DropdownMenuItem> : null}
        {status === 'paused' ? (
          <DropdownMenuItem onClick={onResume}>Resume</DropdownMenuItem>
        ) : null}
        {status !== 'archived' ? (
          <DropdownMenuItem variant="destructive" onClick={onArchive}>
            Delete
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={onRestore}>Restore</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
