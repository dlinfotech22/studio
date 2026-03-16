'use client';

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DashboardChart } from '@/components/dashboard-chart';
import { formatCurrency } from '@/lib/utils';
import { DollarSign, TrendingDown, TrendingUp, Building } from 'lucide-react';
import { type Transaction } from '@/lib/types';
import {
  subMonths,
  startOfMonth,
  endOfMonth,
  format as formatDate,
  startOfYear,
  endOfYear,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from './ui/skeleton';
import { db } from '@/lib/firebase';

export function CompanyDashboard() {
  const [kpis, setKpis] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    const companyId = sessionStorage.getItem('current-user-company-id');
    if (!companyId) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const transactionsRef = collection(db, 'transactions');
        const q = query(transactionsRef, where('companyId', '==', companyId));
        const querySnapshot = await getDocs(q);
        const allTransactions = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            date: (data.date as Timestamp).toDate(),
          } as Transaction;
        });
        
        const financiallyRelevantTransactions = allTransactions.filter(t => {
            if (t.type === 'expense') {
                return true;
            }
            if (t.type === 'revenue') {
                if (t.subtype === 'Prestação de Serviço' || t.subtype === 'Serviço + Venda') {
                    return t.serviceStatus === 'Aguardando Pagamento' || t.serviceStatus === 'Finalizado';
                }
                return true; // Includes 'Venda' and 'Receita Avulsa'
            }
            return false;
        });

        if (allTransactions.length > 0) {
          setHasData(true);
        }

        const now = new Date();

        const calculateMetrics = (transactions: Transaction[]) => {
          const revenue = transactions
            .filter((t) => t.type === 'revenue')
            .reduce((acc, t) => acc + Math.abs(t.amount), 0);
          const expenses = transactions
            .filter((t) => t.type === 'expense')
            .reduce((acc, t) => acc + Math.abs(t.amount), 0);
          return { revenue, expenses, profit: revenue - expenses };
        };

        const currentMonthStart = startOfMonth(now);
        const currentMonthEnd = endOfMonth(now);
        const currentMonthTransactions = financiallyRelevantTransactions.filter(
          (t) => new Date(t.date) >= currentMonthStart && new Date(t.date) <= currentMonthEnd
        );
        const currentMonthMetrics = calculateMetrics(currentMonthTransactions);

        const prevMonth = subMonths(now, 1);
        const prevMonthStart = startOfMonth(prevMonth);
        const prevMonthEnd = endOfMonth(prevMonth);
        const prevMonthTransactions = financiallyRelevantTransactions.filter(
          (t) => new Date(t.date) >= prevMonthStart && new Date(t.date) <= prevMonthEnd
        );
        const prevMonthMetrics = calculateMetrics(prevMonthTransactions);

        const currentYearStart = startOfYear(now);
        const currentYearEnd = endOfYear(now);
        const annualTransactions = financiallyRelevantTransactions.filter(
          (t) => new Date(t.date) >= currentYearStart && new Date(t.date) <= currentYearEnd
        );
        const annualMetrics = calculateMetrics(annualTransactions);

        const prevYear = subMonths(now, 12);
        const prevYearStart = startOfYear(prevYear);
        const prevYearEnd = endOfYear(prevYear);
        const prevAnnualTransactions = financiallyRelevantTransactions.filter(
          (t) => new Date(t.date) >= prevYearStart && new Date(t.date) <= prevYearEnd
        );
        const prevAnnualMetrics = calculateMetrics(prevAnnualTransactions);

        const newKpis = [
          {
            title: 'Faturamento Mensal',
            value: currentMonthMetrics.revenue,
            previousValue: prevMonthMetrics.revenue,
            icon: TrendingUp,
            iconColor: 'text-emerald-500',
          },
          {
            title: 'Despesas Mensais',
            value: currentMonthMetrics.expenses,
            previousValue: prevMonthMetrics.expenses,
            icon: TrendingDown,
            iconColor: 'text-red-500',
            invertComparison: true,
          },
          {
            title: 'Lucro Mensal',
            value: currentMonthMetrics.profit,
            previousValue: prevMonthMetrics.profit,
            icon: DollarSign,
            iconColor: 'text-primary',
          },
          {
            title: 'Faturamento Anual',
            value: annualMetrics.revenue,
            previousValue: prevAnnualMetrics.revenue,
            icon: TrendingUp,
            iconColor: 'text-emerald-500',
          },
          {
            title: 'Despesas Anuais',
            value: annualMetrics.expenses,
            previousValue: prevAnnualMetrics.expenses,
            icon: TrendingDown,
            iconColor: 'text-red-500',
            invertComparison: true,
          },
          {
            title: 'Lucro Anual',
            value: annualMetrics.profit,
            previousValue: prevAnnualMetrics.profit,
            icon: DollarSign,
            iconColor: 'text-primary',
          },
        ];
        setKpis(newKpis);

        const last6MonthsData: any[] = [];
        for (let i = 5; i >= 0; i--) {
          const date = subMonths(now, i);
          const monthStart = startOfMonth(date);
          const monthEnd = endOfMonth(date);

          const monthTransactions = financiallyRelevantTransactions.filter(
            (t) => new Date(t.date) >= monthStart && new Date(t.date) <= monthEnd
          );
          const { revenue, expenses } = calculateMetrics(monthTransactions);

          last6MonthsData.push({
            month: formatDate(date, 'MMM', { locale: ptBR }),
            revenue: revenue,
            expenses: expenses,
          });
        }
        setChartData(last6MonthsData);
      } catch (error) {
        console.error('Failed to process dashboard data', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-[125px]" />
          <Skeleton className="h-[125px]" />
          <Skeleton className="h-[125px]" />
          <Skeleton className="h-[125px]" />
          <Skeleton className="h-[125px]" />
          <Skeleton className="h-[125px]" />
        </div>
        <Skeleton className="h-[450px]" />
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm p-8 text-center h-full">
        <div className="flex flex-col items-center gap-2">
          <Building className="w-16 h-16 text-muted-foreground" />
          <h2 className="text-2xl font-semibold">Nenhum dado para exibir.</h2>
          <p className="text-muted-foreground">
            Comece adicionando lançamentos para ver seu dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi) => {
          const percentageChange =
            kpi.previousValue !== 0
              ? ((kpi.value - kpi.previousValue) / kpi.previousValue) * 100
              : kpi.value !== 0
              ? 100
              : 0;

          let isPositive = percentageChange >= 0;
          if (kpi.invertComparison) {
            isPositive = percentageChange <= 0;
          }

          const hasPreviousValue = kpi.previousValue !== undefined;
          const periodText = kpi.title.includes('Anual')
            ? 'ano anterior'
            : 'mês anterior';

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
                {hasPreviousValue && (
                  <p className="text-xs text-muted-foreground">
                    <>
                      <span
                        className={
                          isPositive ? 'text-emerald-500' : 'text-red-500'
                        }
                      >
                        {isPositive &&
                        kpi.value > kpi.previousValue &&
                        !kpi.invertComparison
                          ? '+'
                          : ''}
                        {isFinite(percentageChange)
                          ? percentageChange.toFixed(2)
                          : '0.00'}
                        %
                      </span>{' '}
                      em relação ao {periodText}
                    </>
                  </p>
                )}
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
          <DashboardChart data={chartData} />
        </CardContent>
      </Card>
    </>
  );
}
