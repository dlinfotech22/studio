'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AccessManagementClient } from '@/components/access-management-client';
import { SystemAdminClient } from '@/components/system-admin-client';
import { Skeleton } from '@/components/ui/skeleton';

export default function AccessManagementPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const role = sessionStorage.getItem('current-user-role');
      if (role === 'system_admin' || role === 'company_admin') {
        setUserRole(role);
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

  if (!userRole) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Gestão de Acessos</h1>
        <p className="text-muted-foreground">
          {userRole === 'system_admin'
            ? 'Gerencie empresas e todos os usuários do sistema.'
            : 'Adicione, edite e remova os acessos dos usuários da sua empresa.'}
        </p>
      </header>
      {userRole === 'system_admin' ? (
        <SystemAdminClient />
      ) : (
        <AccessManagementClient />
      )}
    </div>
  );
}
