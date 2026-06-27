import { toast } from 'sonner'

export async function copyToClipboard(value: string, successMessage: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(successMessage)
  } catch {
    toast.error('Unable to copy. Check clipboard permissions.')
  }
}
