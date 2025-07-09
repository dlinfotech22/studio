'use client';

import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminDashboard } from '@/components/admin-dashboard';
import { CompanyDashboard } from '@/components/company-dashboard';

export default function Home() {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const role = localStorage.getItem('current-user-role');
    setUserRole(role);
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <Skeleton className="h-9 w-[200px]" />
          <Skeleton className="h-5 w-[350px] mt-2" />
        </header>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-[125px]" />
          <Skeleton className="h-[125px]" />
          <Skeleton className="h-[125px]" />
          <Skeleton className="h-[125px]" />
        </div>
        <Skeleton className="h-[450px]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          {userRole === 'system_admin'
            ? 'Visão geral do sistema.'
            : 'Visão geral das finanças da sua empresa.'}
        </p>
      </header>

      {userRole === 'system_admin' ? <AdminDashboard /> : <CompanyDashboard />}
    </div>
  );
}
