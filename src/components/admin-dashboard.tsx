
'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot, Timestamp } from 'firebase/firestore';
import { Building, Users, DollarSign, TrendingUp } from 'lucide-react';
import { db } from '@/lib/firebase';
import { type CompanyInfo } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';

export function AdminDashboard() {
  const [userName, setUserName] = useState('');
  const [stats, setStats] = useState({
    totalCompanies: 0,
    activeCompanies: 0,
    monthlyRecurringRevenue: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const name = sessionStorage.getItem('current-user-name');
    setUserName(name || 'Administrador');

    const companiesQuery = collection(db, 'companies');
    const unsubscribe = onSnapshot(companiesQuery, (snapshot) => {
      const allCompanies = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as CompanyInfo)
      );

      const now = new Date();
      const activeCompanies = allCompanies.filter(
        c => c.expiryDate && (c.expiryDate as Timestamp).toDate() >= now
      );

      const mrr = activeCompanies.reduce(
        (acc, company) => acc + (company.monthlyFee || 0),
        0
      );

      setStats({
        totalCompanies: allCompanies.length,
        activeCompanies: activeCompanies.length,
        monthlyRecurringRevenue: mrr,
      });
      setIsLoading(false);
    }, (error) => {
      console.error("Failed to load company stats:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return (
       <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
             <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Receita Mensal Recorrente</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.monthlyRecurringRevenue)}</div>
                 <p className="text-xs text-muted-foreground">
                  Estimativa com base nas empresas ativas
                </p>
              </CardContent>
            </Card>
        </div>

        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm p-8 text-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
            <TrendingUp className="w-16 h-16 text-muted-foreground" />
            <h2 className="text-2xl font-semibold">Bem-vindo, {userName}!</h2>
            <p className="text-muted-foreground">
            Você está no painel de administração do sistema.
            </p>
            <p className="max-w-md mt-2 text-sm text-muted-foreground">
            Use o menu lateral para gerenciar empresas e usuários.
            </p>
        </div>
        </div>
    </div>
  );
}
