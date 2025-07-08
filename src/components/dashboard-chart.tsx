'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { formatCurrency } from '@/lib/utils';
import { ChartTooltipContent } from './ui/chart';

const chartData = [
  { month: 'Jan', revenue: 18600, expenses: 8000 },
  { month: 'Fev', revenue: 30500, expenses: 19800 },
  { month: 'Mar', revenue: 23700, expenses: 12000 },
  { month: 'Abr', revenue: 7300, expenses: 20000 },
  { month: 'Mai', revenue: 20900, expenses: 10800 },
  { month: 'Jun', revenue: 21400, expenses: 11400 },
];

export function DashboardChart() {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={chartData}>
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
          content={<ChartTooltipContent
            formatter={(value, name) => (
              <div className="flex flex-col">
                <span className="text-xs capitalize text-muted-foreground">{name}</span>
                <span className="font-bold">{formatCurrency(value as number)}</span>
              </div>
            )}
           />}
        />
        <Bar dataKey="revenue" name="Receita" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expenses" name="Despesa" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
