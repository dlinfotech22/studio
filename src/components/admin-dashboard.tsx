
'use client';

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { Building, Users, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { db } from '@/lib/firebase';
import { type CompanyInfo, type Transaction } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';
import {
  subMonths,
  startOfMonth,
  endOfMonth,
  format as formatDate,
  startOfYear,
  endOfYear,
  subYears,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DashboardChart } from './dashboard-chart';

export function AdminDashboard() {
  const [userName, setUserName] = useState('');
  const [stats, setStats] = useState({
    totalCompanies: 0,
    activeCompanies: 0,
  });
  const [kpis, setKpis] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const name = sessionStorage.getItem('current-user-name');
    setUserName(name || 'Administrador');

    const adminCompanyId = 'GESTOR-DL-ADMIN-COMPANY';

    const companiesQuery = collection(db, 'companies');
    const unsubCompanies = onSnapshot(companiesQuery, (snapshot) => {
      const allCompanies = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as CompanyInfo)
      );

      const now = new Date();
      const activeCompanies = allCompanies.filter(
        c => !c.expiryDate || (c.expiryDate as Timestamp).toDate() >= now
      );

      setStats({
        totalCompanies: allCompanies.length,
        activeCompanies: activeCompanies.length,
      });
    });

    const transactionsRef = collection(db, 'transactions');
    const q = query(transactionsRef, where('companyId', '==', adminCompanyId));
    const unsubTransactions = onSnapshot(q, (snapshot) => {
        const allTransactions = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              date: (data.date as Timestamp).toDate(),
            } as Transaction;
        });

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
        const currentMonthTransactions = allTransactions.filter(
          (t) => new Date(t.date) >= currentMonthStart && new Date(t.date) <= currentMonthEnd
        );
        const currentMonthMetrics = calculateMetrics(currentMonthTransactions);

        const prevMonth = subMonths(now, 1);
        const prevMonthStart = startOfMonth(prevMonth);
        const prevMonthEnd = endOfMonth(prevMonth);
        const prevMonthTransactions = allTransactions.filter(
          (t) => new Date(t.date) >= prevMonthStart && new Date(t.date) <= prevMonthEnd
        );
        const prevMonthMetrics = calculateMetrics(prevMonthTransactions);

        const currentYearStart = startOfYear(now);
        const currentYearEnd = endOfYear(now);
        const annualTransactions = allTransactions.filter(
          (t) => new Date(t.date) >= currentYearStart && new Date(t.date) <= currentYearEnd
        );
        const annualMetrics = calculateMetrics(annualTransactions);

        const prevYear = subYears(now, 1);
        const prevYearStart = startOfYear(prevYear);
        const prevYearEnd = endOfYear(prevYear);
        const prevAnnualTransactions = allTransactions.filter(
            (t) => new Date(t.date) >= prevYearStart && new Date(t.date) <= prevYearEnd
        );
        const prevAnnualMetrics = calculateMetrics(prevAnnualTransactions);
        
        const newKpis = [
          {
            title: 'Faturamento do Mês',
            value: currentMonthMetrics.revenue,
            previousValue: prevMonthMetrics.revenue,
            icon: TrendingUp,
            iconColor: 'text-emerald-500',
          },
          {
            title: 'Faturamento Anual',
            value: annualMetrics.revenue,
            previousValue: prevAnnualMetrics.revenue,
            icon: TrendingUp,
            iconColor: 'text-emerald-500',
          },
        ];
        setKpis(newKpis);

        const last6MonthsData: any[] = [];
        for (let i = 5; i >= 0; i--) {
          const date = subMonths(now, i);
          const monthStart = startOfMonth(date);
          const monthEnd = endOfMonth(date);

          const monthTransactions = allTransactions.filter(
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
        setIsLoading(false);
    });


    return () => {
      unsubCompanies();
      unsubTransactions();
    };
  }, []);

  if (isLoading) {
    return (
       <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-[125px]" />
          <Skeleton className="h-[125px]" />
          <Skeleton className="h-[125px]" />
          <Skeleton className="h-[125px]" />
        </div>
        <Skeleton className="h-[450px]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Empresas
            </CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCompanies}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Empresas Ativas
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCompanies}</div>
            <p className="text-xs text-muted-foreground">
              Com assinatura válida
            </p>
          </CardContent>
        </Card>
        {kpis.map((kpi, index) => {
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

          return (
            <Card key={index}>
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
                {kpi.previousValue !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    <>
                      <span
                        className={
                          isPositive ? 'text-emerald-500' : 'text-red-500'
                        }
                      >
                        {isPositive && kpi.value > kpi.previousValue && !kpi.invertComparison ? '+' : ''}
                        {isFinite(percentageChange) ? percentageChange.toFixed(2) : '0.00'}%
                      </span> em relação ao {kpi.title.includes('Anual') ? 'ano anterior' : 'mês anterior'}
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
          <CardTitle>Visão Geral Financeira do Sistema</CardTitle>
          <CardDescription>
            Receitas (renovações) e Despesas nos últimos 6 meses.
          </CardDescription>
        </CardHeader>
        <CardContent className="pl-2">
          <DashboardChart data={chartData} />
        </CardContent>
      </Card>
    </div>
  );
}
