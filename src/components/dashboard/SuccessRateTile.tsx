import { TrendingDown, TrendingUp } from 'lucide-react'
import { Label, PolarGrid, PolarRadiusAxis, RadialBar, RadialBarChart } from 'recharts'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
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
  const TrendIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : null
  const endAngle = 90 - (Math.min(Math.max(value, 0), 100) / 100) * 360

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-0">
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[180px]">
          <RadialBarChart
            data={data}
            startAngle={90}
            endAngle={endAngle}
            outerRadius={80}
            innerRadius={64}
          >
            <PolarGrid
              gridType="circle"
              radialLines={false}
              stroke="none"
              className="first:fill-muted last:fill-background"
              polarRadius={[80, 64]}
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
      {TrendIcon ? (
        <CardFooter className="justify-center pt-0 pb-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 tabular-nums">
            <TrendIcon className="size-3" aria-hidden />
            {deltaFmt.format(delta)}% vs. yesterday
          </span>
        </CardFooter>
      ) : null}
    </Card>
  )
}
