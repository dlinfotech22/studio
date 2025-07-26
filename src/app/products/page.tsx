
'use client';

import { useState, useEffect } from 'react';
import { ProductsClient } from '@/components/products-client';
import { Skeleton } from '@/components/ui/skeleton';
import { Book } from 'lucide-react';

export default function ProductsPage({}: {}) {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const role = sessionStorage.getItem('current-user-role');
    setUserRole(role);
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <Skeleton className="h-9 w-[400px]" />
          <Skeleton className="h-5 w-[500px] mt-2" />
        </header>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Catálogo de Produtos</h1>
        <p className="text-muted-foreground">
          {userRole === 'system_admin'
            ? 'Esta seção é para usuários de empresas gerenciarem seu catálogo.'
            : 'Adicione, edite e gerencie os produtos da sua empresa.'}
        </p>
      </header>
      {userRole === 'system_admin' ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm p-8 text-center h-[400px]">
          <div className="flex flex-col items-center gap-2">
            <Book className="w-16 h-16 text-muted-foreground" />
            <h2 className="text-2xl font-semibold">Função exclusiva para empresas</h2>
            <p className="max-w-md mt-2 text-sm text-muted-foreground">
              A tela de catálogo de produtos é utilizada para gerenciar os itens de uma empresa específica. Como administrador do sistema, seu foco está na gestão de empresas e usuários globais.
            </p>
          </div>
        </div>
      ) : (
        <ProductsClient />
      )}
    </div>
  );
}
