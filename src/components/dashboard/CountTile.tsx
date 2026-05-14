import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface CountTileProps {
  label: string
  value: number | string
}

export function CountTile({ label, value }: CountTileProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 items-center">
        <p className="text-3xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}
