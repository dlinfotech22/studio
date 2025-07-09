'use client';

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';

import { formatCurrency } from '@/lib/utils';
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

const chartConfig = {
  revenue: {
    label: 'Receita',
    color: 'hsl(var(--primary))',
  },
  expenses: {
    label: 'Despesa',
    color: 'hsl(var(--destructive))',
  },
} satisfies ChartConfig;

export function DashboardChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[350px] w-full items-center justify-center text-muted-foreground">
        <p>Não há dados suficientes para exibir o gráfico.</p>
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-[350px] w-full">
      <BarChart accessibilityLayer data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="month"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => formatCurrency(value as number)}
        />
        <Tooltip
          cursor={{ fill: 'hsl(var(--accent) / 0.2)' }}
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <div className="flex flex-col">
                  <span className="text-xs capitalize text-muted-foreground">
                    {name}
                  </span>
                  <span className="font-bold">
                    {formatCurrency(value as number)}
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar
          dataKey="revenue"
          name="Receita"
          fill="var(--color-revenue)"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="expenses"
          name="Despesa"
          fill="var(--color-expenses)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}
