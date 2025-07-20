
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
  getDoc,
} from 'firebase/firestore';
import { format, subHours, isSameDay, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, Wrench, MoreVertical, PlusCircle, PlayCircle, CheckCircle } from 'lucide-react';
import { db } from '@/lib/firebase';
import { type Transaction, type ServiceStatus, type CompanyInfo } from '@/lib/types';
import { formatCurrency, cn } from '@/lib/utils';
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
import { TransactionsClient } from './transactions-client';
import { Calendar } from './ui/calendar';

const serviceStatusOptions: ServiceStatus[] = [
    'Agendado',
    'Aberta',
    'Em Execução',
    'Finalizado',
    'Cancelado',
];

export function ScheduleClient() {
  const [allServices, setAllServices] = useState<Transaction[]>([]);
  const [selectedDayServices, setSelectedDayServices] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const { toast } = useToast();
  const [companyId, setCompanyId] = useState<string | null>(null);

  const fetchScheduledServices = async (cId: string) => {
    setIsLoading(true);
    try {
      const transactionsRef = collection(db, 'transactions');
      const q = query(
        transactionsRef,
        where('companyId', '==', cId),
        where('subtype', 'in', ['Prestação de Serviço', 'Serviço + Venda']),
        where('serviceStatus', 'in', ['Agendado', 'Aberta', 'Em Execução'])
      );
      const snapshot = await getDocs(q);
      const services = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: (data.date as Timestamp).toDate(),
          scheduledDate: data.scheduledDate
            ? (data.scheduledDate as Timestamp).toDate()
            : null,
        } as Transaction;
      });

      const now = new Date();
      const cutoffDate = subHours(now, 24);
      const servicesToCleanup = services.filter(
        (s) =>
          s.serviceStatus === 'Agendado' &&
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
        const cleanedServiceIds = new Set(servicesToCleanup.map(s => s.id));
        setAllServices(services.filter(s => !cleanedServiceIds.has(s.id)));
      } else {
        setAllServices(services);
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
    const cId = sessionStorage.getItem('current-user-company-id');
    setCompanyId(cId);
    if (cId) {
      fetchScheduledServices(cId);
    } else {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDate) {
        const servicesForDay = allServices
        .filter(s => s.scheduledDate && isSameDay(s.scheduledDate, selectedDate))
        .sort((a,b) => (a.scheduledDate?.getTime() ?? 0) - (b.scheduledDate?.getTime() ?? 0));
      setSelectedDayServices(servicesForDay);
    } else {
      setSelectedDayServices([]);
    }
  }, [selectedDate, allServices]);

  const handleStatusChange = async (
    transactionId: string,
    newStatus: ServiceStatus
  ) => {
    try {
      const transactionRef = doc(db, 'transactions', transactionId);
      const payload: {serviceStatus: ServiceStatus, date?: Timestamp} = { serviceStatus: newStatus };

      // When confirming, set the transaction date to today
      if (newStatus === 'Aberta') {
        payload.date = Timestamp.fromDate(new Date());
      }
      
      await updateDoc(transactionRef, payload);
      toast({
        title: 'Status Atualizado!',
        description: `O serviço foi atualizado para "${newStatus}".`,
      });
      if (companyId) {
          fetchScheduledServices(companyId);
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
  
  const handleDaySelect = (day: Date | undefined) => {
      setSelectedDate(day ? startOfDay(day) : undefined);
  }

  const renderServiceCards = (services: Transaction[]) => {
      if(services.length === 0) {
          return (
             <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm p-8 text-center h-[200px] mt-4">
                <div className="flex flex-col items-center gap-2">
                    <CalendarIcon className="w-16 h-16 text-muted-foreground" />
                    <h2 className="text-2xl font-semibold">Nenhum agendamento para este dia.</h2>
                </div>
            </div>
          )
      }

      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
          {services.map((service) => (
            <Card key={service.id} className="flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{service.customerName}</CardTitle>
                    <CardDescription>
                      {service.scheduledDate ? (
                         <span className="capitalize">{format(new Date(service.scheduledDate), "HH:mm", { locale: ptBR })}</span>
                      ) : (
                        'Horário não definido'
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
                    {service.serviceStatus === 'Agendado' && (
                       <Button size="sm" className="w-full" onClick={() => handleStatusChange(service.id, 'Aberta')}>
                         <CheckCircle className="mr-2 h-4 w-4" />
                         Confirmar e Iniciar
                       </Button>
                    )}
                 </div>
                {service.serviceStatus !== 'Agendado' && (
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
                            <SelectItem key={status} value={status} disabled={status === 'Agendado'}>
                            {status}
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    </div>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )
  }

  if (isFormOpen) {
    return (
       <div className="fixed inset-0 bg-background z-50 overflow-y-auto">
            <div className="p-6">
                <Button onClick={() => {
                    setIsFormOpen(false);
                    if (companyId) fetchScheduledServices(companyId);
                }}>Voltar para Agenda</Button>
                <TransactionsClient />
            </div>
        </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
          <Skeleton className="h-10 w-40 ml-auto" />
          <div className="flex justify-center">
            <Skeleton className="h-[360px] w-full max-w-sm" />
          </div>
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

      <div className="flex flex-col items-center">
        <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDaySelect}
            className="rounded-md border"
            locale={ptBR}
            modifiers={{
                scheduled: allServices.map(s => s.scheduledDate).filter((d): d is Date => !!d),
                inProgress: allServices.filter(s => s.serviceStatus === 'Em Execução').map(s => s.scheduledDate).filter((d): d is Date => !!d),
            }}
            modifiersClassNames={{
                scheduled: 'bg-primary/20 text-primary-foreground rounded-full',
                inProgress: 'bg-amber-400 text-amber-900 rounded-full',
            }}
        />
        {selectedDate && renderServiceCards(selectedDayServices)}
      </div>

    </>
  );
}

    