'use client'

import { type CSSProperties, createContext, type ReactNode, use, useId } from 'react'
import { Legend, ResponsiveContainer, Tooltip } from 'recharts'
import { cn } from '@/lib/utils'

export const ChartTooltip = Tooltip
export const ChartLegend = Legend
export function ChartLegendContent() {
  return null
}
export function ChartStyle() {
  return null
}

export interface ChartConfigItem {
  label: string
  color: string
}

export type ChartConfig = Record<string, ChartConfigItem>

const ChartContext = createContext<{ config: ChartConfig; id: string } | null>(null)

export function useChartConfig() {
  const ctx = use(ChartContext)
  if (!ctx) throw new Error('useChartConfig must be used inside <ChartContainer>')
  return ctx
}

interface ChartContainerProps {
  config: ChartConfig
  className?: string
  children: ReactNode
}

export function ChartContainer({ config, className, children }: ChartContainerProps) {
  const id = useId().replace(/:/g, '')
  const cssVars: CSSProperties = {}
  for (const [key, item] of Object.entries(config)) {
    ;(cssVars as Record<string, string>)[`--color-${key}`] = item.color
  }

  return (
    <ChartContext.Provider value={{ config, id }}>
      <div
        data-slot="chart"
        data-chart={id}
        className={cn('flex aspect-video justify-center text-xs', className)}
        style={cssVars}
      >
        <ResponsiveContainer width="100%" height="100%">
          {children as never}
        </ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

interface ChartTooltipContentProps {
  active?: boolean
  payload?: Array<{
    name?: string
    dataKey?: string | number
    value?: number | string
    color?: string
    payload?: Record<string, unknown>
  }>
  label?: string | number
  className?: string
  labelFormatter?: (label: string | number) => ReactNode
  formatter?: (value: number | string, name: string) => ReactNode
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  className,
  labelFormatter,
  formatter,
}: ChartTooltipContentProps) {
  const { config } = useChartConfig()
  if (!active || !payload?.length) return null

  return (
    <div
      className={cn(
        'rounded-md border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md ring-1 ring-foreground/10',
        className,
      )}
    >
      {label != null ? (
        <p className="mb-1 text-xs font-medium text-foreground">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      ) : null}
      <ul className="flex flex-col gap-1">
        {payload.map((item) => {
          const key = String(item.dataKey ?? item.name ?? '')
          const cfg = config[key]
          return (
            <li key={key} className="flex items-center gap-2 text-xs">
              <span
                aria-hidden
                className="inline-block size-2 rounded-[2px]"
                style={{ backgroundColor: item.color ?? cfg?.color }}
              />
              <span className="text-muted-foreground">{cfg?.label ?? item.name ?? key}</span>
              <span className="ml-auto font-mono text-foreground">
                {formatter ? formatter(item.value ?? 0, key) : String(item.value)}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
