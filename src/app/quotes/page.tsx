'use client';

import { useState, useEffect } from 'react';
import { QuotesClient } from '@/components/quotes-client';
import { Skeleton } from '@/components/ui/skeleton';
import { FileClock } from 'lucide-react';
import { type CompanyInfo } from '@/lib/types';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function QuotesPage({}: {}) {
  const [isLoading, setIsLoading] = useState(true);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const companyId = sessionStorage.getItem('current-user-company-id');
    const role = sessionStorage.getItem('current-user-role');
    setUserRole(role);

    if (companyId) {
      const fetchCompanyInfo = async () => {
        try {
          const companiesRef = collection(db, 'companies');
          const q = query(companiesRef, where('document', '==', companyId));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            setCompanyInfo({ id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as CompanyInfo);
          }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
      };
      fetchCompanyInfo();
    } else {
        setIsLoading(false);
    }
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

  const canViewPage = userRole === 'system_admin' ? false : companyInfo?.allowedSubtypes?.some(
    (st) => st === 'Prestação de Serviço' || st === 'Serviço + Venda'
  );

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Orçamentos</h1>
        <p className="text-muted-foreground">
          Crie, gerencie e aprove orçamentos antes de iniciar os serviços.
        </p>
      </header>
      {userRole === 'system_admin' ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm p-8 text-center h-[400px]">
          <div className="flex flex-col items-center gap-2">
            <FileClock className="w-16 h-16 text-muted-foreground" />
            <h2 className="text-2xl font-semibold">Função exclusiva para empresas</h2>
            <p className="max-w-md mt-2 text-sm text-muted-foreground">
              A tela de orçamentos é utilizada para gerenciar as propostas de uma empresa específica.
            </p>
          </div>
        </div>
      ) : canViewPage ? (
        <QuotesClient />
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm p-8 text-center h-[400px]">
          <div className="flex flex-col items-center gap-2">
            <FileClock className="w-16 h-16 text-muted-foreground" />
            <h2 className="text-2xl font-semibold">Função exclusiva para prestadores de serviço</h2>
            <p className="max-w-md mt-2 text-sm text-muted-foreground">
              Esta tela é designada para empresas que oferecem serviços. Para ativá-la, habilite 'Prestação de Serviço' ou 'Serviço + Venda' nas configurações da empresa.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
