
'use client';

import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminDashboard } from '@/components/admin-dashboard';
import { CompanyDashboard } from '@/components/company-dashboard';
import { type User } from '@/lib/types';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Lock } from 'lucide-react';

export default function Home({}: {}) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const username = sessionStorage.getItem('current-user');
      if (!username) {
        setIsLoading(false);
        return;
      }

      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('username', '==', username));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          setCurrentUser({ id: userDoc.id, ...userDoc.data() } as User);
        }
      } catch (error) {
        console.error('Failed to fetch user data', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
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

  const canViewDashboard = currentUser?.role === 'system_admin' || currentUser?.role === 'company_admin';

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          {currentUser?.role === 'system_admin'
            ? 'Visão geral do sistema.'
            : canViewDashboard
            ? 'Visão geral das finanças da sua empresa.'
            : 'Acesso restrito ao dashboard.'
            }
        </p>
      </header>

      {currentUser?.role === 'system_admin' ? (
        <AdminDashboard />
      ) : canViewDashboard ? (
        <CompanyDashboard />
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm p-8 text-center h-[400px]">
          <div className="flex flex-col items-center gap-2">
            <Lock className="w-16 h-16 text-muted-foreground" />
            <h2 className="text-2xl font-semibold">Acesso Restrito</h2>
            <p className="max-w-md mt-2 text-sm text-muted-foreground">
              Você não tem permissão para visualizar o dashboard. Entre em contato com o administrador da sua empresa para solicitar acesso.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
