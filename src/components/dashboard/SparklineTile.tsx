import { TrendingDown, TrendingUp } from 'lucide-react'
import { useId } from 'react'
import { Area, AreaChart } from 'recharts'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { type ChartConfig, ChartContainer } from '@/components/ui/chart'

interface SparkPoint {
  t: number
  v: number
}

interface SparklineTileProps {
  label: string
  value: number | string
  sparkline: SparkPoint[]
  delta?: number | null
  deltaSuffix?: string
}

const chartConfig = {
  v: { label: 'Value', color: 'var(--chart-1)' },
} satisfies ChartConfig

const deltaFmt = new Intl.NumberFormat('en-US', { signDisplay: 'exceptZero' })

export function SparklineTile({ label, value, sparkline, delta, deltaSuffix }: SparklineTileProps) {
  const gradientId = `spark-${useId().replace(/:/g, '')}`
  const hasDelta = delta != null && delta !== 0
  const TrendIcon = !hasDelta ? null : delta > 0 ? TrendingUp : TrendingDown

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2 pb-2">
        <p className="text-3xl font-semibold tabular-nums">{value}</p>
        <div className="h-12 w-full">
          <ChartContainer config={chartConfig} className="aspect-auto h-12 w-full">
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
      </CardContent>
      {hasDelta && TrendIcon ? (
        <CardFooter className="pt-0 pb-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 tabular-nums">
            <TrendIcon className="size-3" aria-hidden />
            {deltaFmt.format(delta)}
            {deltaSuffix}
          </span>
        </CardFooter>
      ) : null}
    </Card>
  )
}
