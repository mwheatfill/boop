import { useId } from 'react'
import { Area, AreaChart } from 'recharts'
import { ChartContainer } from '@/components/ui/chart'
import { cn } from '@/lib/utils'

interface SparkPoint {
  t: number
  v: number
}

interface StatTileProps {
  label: string
  value: string | number
  sparkline: SparkPoint[]
  /** Numeric trend delta. Positive renders success, negative renders destructive. */
  trend?: number
  trendSuffix?: string
}

const trendFormatter = new Intl.NumberFormat('en-US', { signDisplay: 'exceptZero' })

export function StatTile({ label, value, sparkline, trend, trendSuffix }: StatTileProps) {
  const gradientId = `spark-${useId().replace(/:/g, '')}`
  const hasTrend = trend != null && trend !== 0
  const trendColor = hasTrend && trend > 0 ? 'text-success' : 'text-destructive'

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-3xl font-semibold tabular-nums">{value}</p>
      {hasTrend ? (
        <span className={cn('text-xs font-medium tabular-nums', trendColor)}>
          {trendFormatter.format(trend)}
          {trendSuffix}
        </span>
      ) : null}
      <div className="h-12 w-full">
        <ChartContainer
          config={{ v: { label, color: 'var(--chart-1)' } }}
          className="aspect-auto h-12 w-full"
        >
          <AreaChart data={sparkline} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-v)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--color-v)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke="var(--color-v)"
              strokeWidth={1.5}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ChartContainer>
      </div>
    </div>
  )
}
