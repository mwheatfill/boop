import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface KpiCardProps {
  label: string
  value: number | string
  delta?: number | null
  deltaSuffix?: string
  footerPrimary?: ReactNode
  footerSecondary?: ReactNode
}

const deltaFmt = new Intl.NumberFormat('en-US', { signDisplay: 'exceptZero' })

export function KpiCard({
  label,
  value,
  delta,
  deltaSuffix,
  footerPrimary,
  footerSecondary,
}: KpiCardProps) {
  const hasDelta = delta != null
  const TrendIcon = !hasDelta ? null : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {value}
        </CardTitle>
        {hasDelta && TrendIcon ? (
          <CardAction>
            <Badge variant="outline">
              <TrendIcon className="size-3" aria-hidden />
              {deltaFmt.format(delta)}
              {deltaSuffix ?? ''}
            </Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      {footerPrimary || footerSecondary ? (
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          {footerPrimary ? (
            <div className="line-clamp-1 flex gap-2 font-medium">{footerPrimary}</div>
          ) : null}
          {footerSecondary ? <div className="text-muted-foreground">{footerSecondary}</div> : null}
        </CardFooter>
      ) : null}
    </Card>
  )
}
