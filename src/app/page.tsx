import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DashboardChart } from '@/components/dashboard-chart';
import { formatCurrency } from '@/lib/utils';
import { DollarSign, TrendingDown, TrendingUp } from 'lucide-react';

const kpis = [
  {
    title: 'Faturamento Mensal',
    value: 45231.89,
    previousValue: 42100.5,
    icon: TrendingUp,
    iconColor: 'text-emerald-500',
  },
  {
    title: 'Despesas Mensais',
    value: 21840.34,
    previousValue: 23400.0,
    icon: TrendingDown,
    iconColor: 'text-red-500',
  },
  {
    title: 'Lucro Mensal',
    value: 23391.55,
    previousValue: 18700.5,
    icon: DollarSign,
    iconColor: 'text-primary',
  },
  {
    title: 'Faturamento Anual',
    value: 542782.68,
    previousValue: 498500.0,
    icon: TrendingUp,
    iconColor: 'text-emerald-500',
  },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral das finanças da sua empresa.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const percentageChange =
            ((kpi.value - kpi.previousValue) / kpi.previousValue) * 100;
          const isPositive = percentageChange >= 0;

          return (
            <Card key={kpi.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {kpi.title}
                </CardTitle>
                <kpi.icon className={`h-4 w-4 ${kpi.iconColor}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(kpi.value)}
                </div>
                <p className="text-xs text-muted-foreground">
                  <span
                    className={
                      isPositive ? 'text-emerald-500' : 'text-red-500'
                    }
                  >
                    {isPositive ? '+' : ''}
                    {percentageChange.toFixed(2)}%
                  </span>{' '}
                  em relação ao mês anterior
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Card className="col-span-1 lg:col-span-2 xl:col-span-3">
        <CardHeader>
          <CardTitle>Visão Geral Financeira</CardTitle>
          <CardDescription>
            Comparativo de receitas e despesas nos últimos 6 meses.
          </CardDescription>
        </CardHeader>
        <CardContent className="pl-2">
          <DashboardChart />
        </CardContent>
      </Card>
    </div>
  );
}
