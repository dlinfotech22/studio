'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AccessManagementClient } from '@/components/access-management-client';
import { Skeleton } from '@/components/ui/skeleton';

export default function AccessManagementPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const username = localStorage.getItem('current-user');
      if (username === 'admin') {
        setIsAuthorized(true);
      } else {
        router.replace('/');
      }
    } catch (error) {
      console.error('Failed to check authorization:', error);
      router.replace('/');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <header className="space-y-1.5">
          <Skeleton className="h-9 w-[300px]" />
          <Skeleton className="h-5 w-[450px]" />
        </header>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Gestão de Acessos</h1>
        <p className="text-muted-foreground">
          Adicione, edite e remova os acessos dos usuários ao sistema.
        </p>
      </header>
      <AccessManagementClient />
    </div>
  );
}
