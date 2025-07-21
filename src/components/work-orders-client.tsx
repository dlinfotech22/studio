
'use client';

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Wrench, CheckCircle } from 'lucide-react';
import { db } from '@/lib/firebase';
import { type Transaction, type ServiceStatus } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

const serviceStatusOptions: ServiceStatus[] = [
    'Aberta',
    'Aguardando Aprovação',
    'Aprovada',
    'Aguardando Peça / Material',
    'Em Execução',
    'Pausada',
    'Finalizada',
    'Aguardando Pagamento',
    'Encerrada / Concluída',
    'Cancelada',
];

export function WorkOrdersClient() {
  const [activeServices, setActiveServices] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchActiveServices = async (cId: string) => {
    setIsLoading(true);
    try {
        const servicesRef = collection(db, 'transactions');
        const qServices = query(
            servicesRef,
            where('companyId', '==', cId),
            where('subtype', 'in', ['Prestação de Serviço', 'Serviço + Venda'])
        );

        const servicesSnapshot = await getDocs(qServices);
        const fetchedServices = servicesSnapshot.docs
            .map((doc) => {
                const data = doc.data();
                return { id: doc.id, ...data, date: (data.date as Timestamp).toDate() } as Transaction;
            })
            .filter(service => 
                service.serviceStatus && 
                !['Agendado', 'Encerrada / Concluída', 'Cancelada'].includes(service.serviceStatus)
            );
        
        setActiveServices(fetchedServices.sort((a,b) => (a.date as Date).getTime() - (b.date as Date).getTime()));

    } catch (error) {
        console.error('Failed to fetch active services:', error);
        toast({ title: 'Erro ao buscar dados', description: 'Não foi possível carregar as ordens de serviço. Tente novamente.', variant: 'destructive' });
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    const cId = sessionStorage.getItem('current-user-company-id');
    setCompanyId(cId);
    if (cId) {
      fetchActiveServices(cId);
    } else {
      setIsLoading(false);
    }
  }, []);

  const handleStatusChange = async (transactionId: string, newStatus: ServiceStatus) => {
    try {
      const transactionRef = doc(db, 'transactions', transactionId);
      await updateDoc(transactionRef, { serviceStatus: newStatus });
      toast({ title: 'Status Atualizado!', description: `O serviço foi atualizado para "${newStatus}".` });
      if (companyId) {
          fetchActiveServices(companyId);
      }
    } catch (error) {
      console.error('Failed to update service status:', error);
      toast({ title: 'Erro ao atualizar status', description: 'Não foi possível alterar o status do serviço.', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Skeleton className="h-[300px]" />
        <Skeleton className="h-[300px]" />
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  if(activeServices.length === 0) {
      return (
         <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm p-8 text-center h-[200px] mt-4">
            <div className="flex flex-col items-center gap-2">
                <CheckCircle className="w-16 h-16 text-muted-foreground" />
                <h2 className="text-2xl font-semibold">
                  Nenhum serviço em andamento.
                </h2>
                <p className="max-w-md mt-2 text-sm text-muted-foreground">
                  Confirme um agendamento para que ele apareça aqui.
                </p>
            </div>
        </div>
      )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {activeServices.map((service) => (
        <Card key={service.id} className="flex flex-col">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg">{service.customerName}</CardTitle>
                <CardDescription>
                   <span className="font-semibold capitalize text-base">{format(new Date(service.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                </CardDescription>
              </div>
               <Badge variant="secondary">{service.serviceStatus}</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-grow space-y-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2"><Wrench className="h-4 w-4"/>Serviços</h4>
                <div className="pl-4">
                    {service.services?.map(s => (
                        <div key={s.serviceId} className="flex justify-between text-sm">
                            <p>{s.serviceName}</p>
                            <p className="font-mono">{formatCurrency(s.price)}</p>
                        </div>
                    ))}
                </div>
              </div>
          </CardContent>
          <CardFooter className="flex-col items-stretch gap-4 !pt-4">
             <div className="flex justify-between items-center pt-2 border-t">
                <span className="font-bold">Valor Total:</span>
                <span className="font-bold text-lg">{formatCurrency(service.amount)}</span>
             </div>
             <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Mudar Status:</span>
                <Select value={service.serviceStatus} onValueChange={(newStatus: ServiceStatus) => handleStatusChange(service.id, newStatus)}>
                    <SelectTrigger>
                        <SelectValue placeholder="Alterar status" />
                    </SelectTrigger>
                    <SelectContent>
                    {serviceStatusOptions.map((status) => (
                        <SelectItem key={status} value={status}>
                        {status}
                        </SelectItem>
                    ))}
                    </SelectContent>
                </Select>
             </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
