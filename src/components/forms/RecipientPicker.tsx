import { useQuery } from '@tanstack/react-query'
import { Plus, User, Users } from 'lucide-react'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from '@/components/ui/combobox'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { directorySearchQueryOptions } from '@/lib/directory/query-options'
import {
  dedupeEmails,
  emailsToOptions,
  isValidEmail,
  type RecipientOption,
  recipientKey,
  toRecipientOption,
} from './recipient-utils'

const DEBOUNCE_MS = 250

interface RecipientPickerProps {
  workspaceSlug: string
  value: string[]
  onChange: (emails: string[]) => void
  errors?: Array<{ message?: string }>
}

// Fuzzy-search multi-select over Entra users and mail-enabled groups, resolving
// each pick to its email. Free-typed valid emails are added as chips too, so
// external addresses work. Degrades to plain email entry when the directory
// search returns `available: false` (no creds). See DESIGN.md § 6 (Combobox).
export function RecipientPicker({ workspaceSlug, value, onChange, errors }: RecipientPickerProps) {
  const anchor = useComboboxAnchor()
  const highlightedRef = useRef<RecipientOption | null>(null)
  const [known, setKnown] = useState<Map<string, RecipientOption>>(new Map())
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  const search = useQuery(directorySearchQueryOptions(workspaceSlug, debouncedQuery))
  const directoryOff = search.data?.available === false

  const selected = emailsToOptions(value, known)
  const results = (search.data?.results ?? []).map(toRecipientOption)

  const trimmed = query.trim()
  const isNewEmail =
    isValidEmail(trimmed) &&
    !value.some((email) => recipientKey(email) === recipientKey(trimmed)) &&
    !results.some((r) => recipientKey(r.mail) === recipientKey(trimmed))
  const createOption: RecipientOption | null = isNewEmail
    ? { mail: trimmed, displayName: trimmed, type: 'freeform' }
    : null

  const items = createOption ? [...results, createOption] : results

  const invalid = (errors?.length ?? 0) > 0

  function commitEmails(emails: string[], picks: readonly RecipientOption[]) {
    if (picks.length > 0) {
      setKnown((prev) => {
        const next = new Map(prev)
        for (const opt of picks) {
          if (opt.type !== 'freeform') next.set(recipientKey(opt.mail), opt)
        }
        return next
      })
    }
    onChange(dedupeEmails(emails))
    setQuery('')
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' || highlightedRef.current) return
    if (!isValidEmail(trimmed)) return
    event.preventDefault()
    commitEmails([...value, trimmed], [])
  }

  const emptyMessage = search.isFetching
    ? 'Searching…'
    : directoryOff
      ? 'Type a full email address to add it.'
      : trimmed === ''
        ? 'Type to search people and groups.'
        : 'No matches. Type a full email address to add it.'

  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel>Recipients</FieldLabel>
      <Combobox
        items={items}
        multiple
        filter={null}
        value={selected}
        inputValue={query}
        onInputValueChange={(next) => setQuery(next)}
        onItemHighlighted={(item: RecipientOption | undefined) => {
          highlightedRef.current = item ?? null
        }}
        onValueChange={(next: RecipientOption[]) =>
          commitEmails(
            next.map((o) => o.mail),
            next,
          )
        }
        itemToStringLabel={(o: RecipientOption) => o.displayName || o.mail}
        isItemEqualToValue={(a: RecipientOption, b: RecipientOption) =>
          recipientKey(a.mail) === recipientKey(b.mail)
        }
      >
        <ComboboxChips ref={anchor} aria-invalid={invalid || undefined}>
          <ComboboxValue>
            {(vals: RecipientOption[]) => (
              <>
                {vals.map((o) => (
                  <ComboboxChip key={recipientKey(o.mail)} aria-label={o.mail}>
                    {o.type === 'group' ? (
                      <Users className="text-muted-foreground" aria-hidden />
                    ) : o.type === 'user' ? (
                      <User className="text-muted-foreground" aria-hidden />
                    ) : null}
                    <span className="truncate">{o.displayName || o.mail}</span>
                  </ComboboxChip>
                ))}
                <ComboboxChipsInput
                  placeholder={vals.length > 0 ? '' : 'Search people and groups, or type an email…'}
                  onKeyDown={handleInputKeyDown}
                />
              </>
            )}
          </ComboboxValue>
        </ComboboxChips>
        <ComboboxContent anchor={anchor}>
          <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
          <ComboboxList>
            {(o: RecipientOption) =>
              o.type === 'freeform' ? (
                <ComboboxItem key={`create-${recipientKey(o.mail)}`} value={o}>
                  <Plus className="text-muted-foreground" aria-hidden />
                  <span className="truncate">Add “{o.mail}”</span>
                </ComboboxItem>
              ) : (
                <ComboboxItem key={o.mail} value={o}>
                  {o.type === 'group' ? (
                    <Users className="text-muted-foreground" aria-hidden />
                  ) : (
                    <User className="text-muted-foreground" aria-hidden />
                  )}
                  <span className="truncate">{o.displayName}</span>
                  <span className="ml-auto truncate text-xs text-muted-foreground">{o.mail}</span>
                </ComboboxItem>
              )
            }
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <FieldDescription>
        {directoryOff
          ? 'Directory search is off; type email addresses.'
          : 'Search your directory, or type an email address and press Enter.'}
      </FieldDescription>
      <FieldError errors={errors ?? []} />
    </Field>
  )
}
