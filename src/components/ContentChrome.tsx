interface ContentChromeProps {
  filter?: React.ReactNode
}

export function ContentChrome({ filter }: ContentChromeProps) {
  if (!filter) return null
  return (
    <div
      data-slot="content-chrome"
      className="inline-flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5"
    >
      {filter}
    </div>
  )
}
