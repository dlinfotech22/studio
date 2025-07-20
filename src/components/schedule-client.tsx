
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
  writeBatch,
} from 'firebase/firestore';
import { format, subHours, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarClock, Wrench, MoreVertical, PlusCircle, PlayCircle } from 'lucide-react';
import { db } from '@/lib/firebase';
import { type Transaction, type ServiceStatus } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from './ui/separator';
import { Button } from './ui/button';
import { TransactionsClient } from './transactions-client'; // Re-using the form logic

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

export function ScheduleClient() {
  const [scheduledServices, setScheduledServices] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { toast } = useToast();

  const fetchScheduledServices = async (companyId: string) => {
    setIsLoading(true);
    try {
      const transactionsRef = collection(db, 'transactions');
      const q = query(
        transactionsRef,
        where('companyId', '==', companyId),
        where('subtype', 'in', ['Prestação de Serviço', 'Serviço + Venda'])
      );
      const snapshot = await getDocs(q);
      const services = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            date: (data.date as Timestamp).toDate(),
            scheduledDate: data.scheduledDate
              ? (data.scheduledDate as Timestamp).toDate()
              : null,
          } as Transaction;
        })
        .filter(
          (service) =>
            service.serviceStatus !== 'Encerrada / Concluída' &&
            service.serviceStatus !== 'Cancelada'
        )
        .sort(
          (a, b) =>
            (a.scheduledDate?.getTime() ?? 0) - (b.scheduledDate?.getTime() ?? 0)
        );

      // Auto-cleanup logic
      const now = new Date();
      const cutoffDate = subHours(now, 24);
      const servicesToCleanup = services.filter(
        (s) =>
          s.serviceStatus === 'Aberta' &&
          s.scheduledDate &&
          s.scheduledDate < cutoffDate
      );
      
      if (servicesToCleanup.length > 0) {
        const batch = writeBatch(db);
        servicesToCleanup.forEach((s) => batch.delete(doc(db, 'transactions', s.id)));
        await batch.commit();
        toast({
            title: "Limpeza Automática",
            description: `${servicesToCleanup.length} agendamento(s) não comparecidos foram removidos.`,
        });
        // Filter out cleaned services from the list to be displayed
        const cleanedServiceIds = new Set(servicesToCleanup.map(s => s.id));
        setScheduledServices(services.filter(s => !cleanedServiceIds.has(s.id)));
      } else {
        setScheduledServices(services);
      }

    } catch (error) {
      console.error('Failed to fetch scheduled services:', error);
      toast({
        title: 'Erro ao buscar agendamentos',
        description:
          'Não foi possível carregar os serviços agendados. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const companyId = sessionStorage.getItem('current-user-company-id');
    if (companyId) {
      fetchScheduledServices(companyId);
    } else {
      setIsLoading(false);
    }
  }, []);

  const handleStatusChange = async (
    transactionId: string,
    newStatus: ServiceStatus
  ) => {
    try {
      const transactionRef = doc(db, 'transactions', transactionId);
      await updateDoc(transactionRef, { serviceStatus: newStatus });
      toast({
        title: 'Status Atualizado!',
        description: `O serviço foi atualizado para "${newStatus}".`,
      });
      // If status is final, remove it from the list after update
      if (newStatus === 'Encerrada / Concluída' || newStatus === 'Cancelada') {
        setScheduledServices((prev) =>
          prev.filter((s) => s.id !== transactionId)
        );
      } else {
        // Otherwise, just update the status in the local state
         setScheduledServices((prev) =>
          prev.map((s) =>
            s.id === transactionId ? { ...s, serviceStatus: newStatus } : s
          )
        );
      }
    } catch (error) {
      console.error('Failed to update service status:', error);
      toast({
        title: 'Erro ao atualizar status',
        description: 'Não foi possível alterar o status do serviço.',
        variant: 'destructive',
      });
    }
  };

  const handleStartService = (transactionId: string) => {
    handleStatusChange(transactionId, 'Em Execução');
  }

  if (isFormOpen) {
    // A better implementation would be a separate component for the form dialog
    // but for simplicity, we reuse TransactionsClient and hide the schedule part
    return (
       <div className="fixed inset-0 bg-background z-50 overflow-y-auto">
            <div className="p-6">
                <Button onClick={() => {
                    setIsFormOpen(false);
                    const companyId = sessionStorage.getItem('current-user-company-id');
                    if (companyId) fetchScheduledServices(companyId);
                }}>Voltar para Agenda</Button>
                <TransactionsClient />
            </div>
        </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Skeleton className="h-[250px]" />
        <Skeleton className="h-[250px]" />
        <Skeleton className="h-[250px]" />
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setIsFormOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Agendar Serviço
        </Button>
      </div>
      {scheduledServices.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm p-8 text-center h-[400px]">
          <div className="flex flex-col items-center gap-2">
            <CalendarClock className="w-16 h-16 text-muted-foreground" />
            <h2 className="text-2xl font-semibold">Nenhum serviço ativo!</h2>
            <p className="max-w-md mt-2 text-sm text-muted-foreground">
              Todos os seus serviços estão finalizados ou não há serviços agendados no momento. Clique em "Agendar Serviço" para começar.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scheduledServices.map((service) => (
            <Card key={service.id} className="flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{service.customerName}</CardTitle>
                    <CardDescription>
                      {service.scheduledDate ? (
                         <span className="capitalize">{format(new Date(service.scheduledDate), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                      ) : (
                        'Data não agendada'
                      )}
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
                  {service.items && service.items.length > 0 && (
                    <>
                    <Separator />
                    <div className="space-y-2">
                      <h4 className="font-semibold text-sm">Produtos</h4>
                       <div className="pl-4">
                        {service.items.map(item => (
                           <div key={item.productId} className="flex justify-between text-sm">
                            <p>{item.quantity}x {item.productName}</p>
                            <p className="font-mono">{formatCurrency(item.price * item.quantity)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    </>
                  )}
              </CardContent>
              <CardFooter className="flex-col items-stretch gap-4 !pt-4">
                 <div className="flex justify-between items-center pt-2 border-t">
                    <span className="font-bold">Valor Total:</span>
                    <span className="font-bold text-lg">{formatCurrency(service.amount)}</span>
                 </div>
                 <div className="flex items-center gap-2">
                    {(service.serviceStatus === 'Aberta' || service.serviceStatus === 'Aprovada') && (
                       <Button size="sm" onClick={() => handleStartService(service.id)}>
                         <PlayCircle className="mr-2 h-4 w-4" />
                         Iniciar Serviço
                       </Button>
                    )}
                 </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Mudar Status:</span>
                  <Select
                    value={service.serviceStatus}
                    onValueChange={(newStatus: ServiceStatus) =>
                      handleStatusChange(service.id, newStatus)
                    }
                  >
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
      )}
    </>
  );
}
