import type { DirectoryRecipient } from '@/shared/schemas/directory'

// A recipient in the picker: either resolved from the directory (user/group) or
// a free-typed external email. All flatten to a plain email on save.
export interface RecipientOption {
  mail: string
  displayName: string
  type: DirectoryRecipient['type'] | 'freeform'
}

// Pragmatic gate for "offer to add this as a recipient". The stored recipients
// array is still validated with z.email on save, so this only decides whether
// the create affordance and Enter-to-add fire.
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function key(email: string): string {
  return email.trim().toLowerCase()
}

// Trims and drops case-insensitive duplicates, preserving first-seen order.
export function dedupeEmails(emails: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of emails) {
    const email = raw.trim()
    if (!email) continue
    const k = key(email)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(email)
  }
  return out
}

export function freeformRecipient(email: string): RecipientOption {
  const mail = email.trim()
  return { mail, displayName: mail, type: 'freeform' }
}

export function toRecipientOption(recipient: DirectoryRecipient): RecipientOption {
  return { mail: recipient.mail, displayName: recipient.displayName, type: recipient.type }
}

// Maps the stored emails to display options, preferring richer directory info
// picked earlier this session (keyed by email) over a bare freeform label.
export function emailsToOptions(
  emails: readonly string[],
  known: ReadonlyMap<string, RecipientOption>,
): RecipientOption[] {
  return emails.map((email) => known.get(key(email)) ?? freeformRecipient(email))
}

export function recipientKey(email: string): string {
  return key(email)
}
