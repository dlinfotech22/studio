
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Wrench, CheckCircle, Search, MoreHorizontal, Edit } from 'lucide-react';
import { db } from '@/lib/firebase';
import { type Transaction, type ServiceStatus } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';

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
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const cId = sessionStorage.getItem('current-user-company-id');
    setCompanyId(cId);
    if (cId) {
        setIsLoading(true);
        const servicesRef = collection(db, 'transactions');
        const qServices = query(
            servicesRef,
            where('companyId', '==', cId),
            where('subtype', 'in', ['Prestação de Serviço', 'Serviço + Venda'])
        );

        const unsubscribe = onSnapshot(qServices, (snapshot) => {
            const fetchedServices = snapshot.docs
                .map((doc) => {
                    const data = doc.data();
                    return { id: doc.id, ...data, date: (data.date as Timestamp).toDate() } as Transaction;
                })
                .filter(service => 
                    service.serviceStatus && 
                    !['Agendado', 'Encerrada / Concluída', 'Cancelada'].includes(service.serviceStatus)
                );
            
            setActiveServices(fetchedServices.sort((a,b) => (a.date as Date).getTime() - (b.date as Date).getTime()));
            setIsLoading(false);
        }, (error) => {
            console.error('Failed to fetch active services:', error);
            toast({ title: 'Erro ao buscar dados', description: 'Não foi possível carregar as ordens de serviço. Tente novamente.', variant: 'destructive' });
            setIsLoading(false);
        });

        return () => unsubscribe();
    } else {
      setIsLoading(false);
    }
  }, [toast]);

  const handleStatusChange = async (transactionId: string, newStatus: ServiceStatus) => {
    try {
      const transactionRef = doc(db, 'transactions', transactionId);
      await updateDoc(transactionRef, { serviceStatus: newStatus });
      toast({ title: 'Status Atualizado!', description: `O serviço foi atualizado para "${newStatus}".` });
    } catch (error) {
      console.error('Failed to update service status:', error);
      toast({ title: 'Erro ao atualizar status', description: 'Não foi possível alterar o status do serviço.', variant: 'destructive' });
    }
  };

  const handleEdit = (transactionId: string) => {
    sessionStorage.setItem('transaction-to-edit', transactionId);
    router.push('/transactions');
  };

  const filteredServices = activeServices.filter(service => {
    const searchTermLower = searchTerm.toLowerCase();
    const customerNameMatch = service.customerName?.toLowerCase().includes(searchTermLower);
    const sequentialIdMatch = service.sequentialId?.toString().includes(searchTerm);
    return customerNameMatch || sequentialIdMatch;
  });

  if (isLoading) {
    return (
        <div className="space-y-6">
            <Skeleton className="h-10 w-full max-w-sm" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Skeleton className="h-[300px]" />
                <Skeleton className="h-[300px]" />
                <Skeleton className="h-[300px]" />
            </div>
        </div>
    );
  }

  return (
    <div className="space-y-6">
        <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
                type="search"
                placeholder="Buscar por cliente ou nº da OS..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
                autoComplete="off"
            />
        </div>
        
      {filteredServices.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm p-8 text-center h-[200px] mt-4">
            <div className="flex flex-col items-center gap-2">
                <CheckCircle className="w-16 h-16 text-muted-foreground" />
                <h2 className="text-2xl font-semibold">
                    {activeServices.length > 0 ? 'Nenhum serviço encontrado' : 'Nenhum serviço em andamento.'}
                </h2>
                <p className="max-w-md mt-2 text-sm text-muted-foreground">
                    {activeServices.length > 0 ? 'Tente um termo de busca diferente.' : 'Confirme um agendamento para que ele apareça aqui.'}
                </p>
            </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service) => (
            <Card key={service.id} className="flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{service.customerName}</CardTitle>
                    <CardDescription>
                       <span className="font-semibold capitalize text-base">{`OS: ${String(service.sequentialId).padStart(8, '0')}`}</span>
                       <br/>
                       <span className="font-semibold capitalize text-base">{format(new Date(service.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                    </CardDescription>
                  </div>
                   <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(service.id)}>
                                <Edit className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="flex-grow space-y-4">
                  <Badge variant="secondary">{service.serviceStatus}</Badge>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm flex items-center gap-2"><Wrench className="h-4 w-4"/>Serviços</h4>
                    <div className="pl-4">
                        {service.services?.map(s => (
                            <div key={s.serviceId} className="flex justify-between text-sm">
                                <p className="truncate pr-2">{s.serviceName}</p>
                                <p className="font-mono">{formatCurrency(s.price)}</p>
                            </div>
                        ))}
                    </div>
                  </div>
                  {service.items && service.items.length > 0 && (
                     <div className="space-y-2">
                        <h4 className="font-semibold text-sm flex items-center gap-2"><Wrench className="h-4 w-4"/>Produtos</h4>
                        <div className="pl-4">
                            {service.items.map(i => (
                                <div key={i.productId} className="flex justify-between text-sm">
                                    <p className="truncate pr-2">{i.quantity}x {i.productName}</p>
                                    <p className="font-mono">{formatCurrency(i.price * i.quantity)}</p>
                                </div>
                            ))}
                        </div>
                     </div>
                  )}
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
      )}
    </div>
  )
}
