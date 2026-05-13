import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart'
import type { RunsDailyBucket } from '@/shared/schemas/dashboard'

interface RunsAreaChartProps {
  series: RunsDailyBucket[]
}

const config = {
  success: { label: 'Success', color: 'var(--chart-1)' },
  failure: { label: 'Failure', color: 'var(--destructive)' },
} as const

export function RunsAreaChart({ series }: RunsAreaChartProps) {
  const total = series.reduce((sum, b) => sum + b.success + b.failure, 0)
  if (total === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        No completed Runs in the last 7 days.
      </div>
    )
  }
  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="2 2" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(d: string) => d.slice(5)}
        />
        <YAxis
          tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <Tooltip content={<ChartTooltipContent />} cursor={{ fill: 'var(--muted)' }} />
        <Area
          type="monotone"
          dataKey="success"
          stackId="1"
          stroke="var(--color-success)"
          fill="var(--color-success)"
          fillOpacity={0.45}
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="failure"
          stackId="1"
          stroke="var(--color-failure)"
          fill="var(--color-failure)"
          fillOpacity={0.45}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}
