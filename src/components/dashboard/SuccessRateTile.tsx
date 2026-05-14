import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { Label, PolarGrid, PolarRadiusAxis, RadialBar, RadialBarChart } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { type ChartConfig, ChartContainer } from '@/components/ui/chart'

interface SuccessRateTileProps {
  label: string
  value: number
  delta: number
}

const chartConfig = {
  rate: { label: 'Success', color: 'var(--chart-1)' },
} satisfies ChartConfig

const deltaFmt = new Intl.NumberFormat('en-US', {
  signDisplay: 'exceptZero',
  maximumFractionDigits: 1,
})

export function SuccessRateTile({ label, value, delta }: SuccessRateTileProps) {
  const data = [{ name: 'rate', value, fill: 'var(--color-rate)' }]
  const TrendIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus
  const endAngle = 90 - (Math.min(Math.max(value, 0), 100) / 100) * 360

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardAction>
          <Badge variant="outline">
            <TrendIcon className="size-3" aria-hidden />
            {deltaFmt.format(delta)}%
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="pb-2">
        <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[160px]">
          <RadialBarChart
            data={data}
            startAngle={90}
            endAngle={endAngle}
            outerRadius={70}
            innerRadius={56}
          >
            <PolarGrid
              gridType="circle"
              radialLines={false}
              stroke="none"
              className="first:fill-muted last:fill-background"
              polarRadius={[70, 56]}
            />
            <RadialBar dataKey="value" background cornerRadius={8} />
            <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
              <Label
                content={({ viewBox }) => {
                  if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-2xl font-semibold tabular-nums"
                        >
                          {value.toFixed(1)}%
                        </tspan>
                      </text>
                    )
                  }
                }}
              />
            </PolarRadiusAxis>
          </RadialBarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
