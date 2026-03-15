
'use client';

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { format } from 'date-fns';
import { Search, Droplets } from 'lucide-react';
import { db } from '@/lib/firebase';
import { type Transaction } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

export function OilChangeNotificationsClient() {
  const [oilChangeServices, setOilChangeServices] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const { toast } = useToast();

  useEffect(() => {
    const cId = sessionStorage.getItem('current-user-company-id');
    setCompanyId(cId);
    if (cId) {
      setIsLoading(true);
      const servicesRef = collection(db, 'transactions');
      // Query for all service-related transactions for the company
      const qServices = query(
        servicesRef,
        where('companyId', '==', cId),
        where('subtype', 'in', ['Prestação de Serviço', 'Serviço + Venda'])
      );

      const unsubscribe = onSnapshot(
        qServices,
        (snapshot) => {
          // Filter for services with mileage on the client-side to avoid complex indexes
          const fetchedServices = snapshot.docs
            .map((doc) => {
              const data = doc.data();
              return {
                id: doc.id,
                ...data,
                date: (data.date as Timestamp).toDate(),
              } as Transaction;
            })
            .filter((service) => service.kmAtual && service.kmAtual > 0);

          setOilChangeServices(
            fetchedServices.sort(
              (a, b) => (b.date as Date).getTime() - (a.date as Date).getTime()
            )
          );
          setIsLoading(false);
        },
        (error) => {
          console.error('Failed to fetch oil change services:', error);
          toast({
            title: 'Erro ao buscar dados',
            description:
              'Não foi possível carregar os serviços. Tente novamente.',
            variant: 'destructive',
          });
          setIsLoading(false);
        }
      );

      return () => unsubscribe();
    } else {
      setIsLoading(false);
    }
  }, [toast]);

  const filteredServices = oilChangeServices.filter((service) => {
    const term = searchTerm.toLowerCase();
    const customerMatch = service.customerName?.toLowerCase().includes(term);
    const idMatch = service.sequentialId?.toString().includes(term);
    return customerMatch || idMatch;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

  const totalServices = filteredServices.length;
  const totalPages =
    itemsPerPage > 0 ? Math.ceil(totalServices / itemsPerPage) : 1;
  const paginatedServices =
    itemsPerPage > 0
      ? filteredServices.slice(
          (currentPage - 1) * itemsPerPage,
          currentPage * itemsPerPage
        )
      : filteredServices;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full md:w-auto md:max-w-sm" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
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

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data do Serviço</TableHead>
                  <TableHead className="text-right">KM Atual</TableHead>
                  <TableHead className="text-right">KM Próxima Troca</TableHead>
                  <TableHead>Descrição</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedServices.length > 0 ? (
                  paginatedServices.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell className="font-medium">
                        {service.customerName}
                      </TableCell>
                      <TableCell>
                        {format(service.date as Date, 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {service.kmAtual?.toLocaleString('pt-BR')} km
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {service.kmProximaTroca?.toLocaleString('pt-BR')} km
                      </TableCell>
                      <TableCell>{service.description}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <Droplets className="h-16 w-16 text-muted-foreground" />
                        <h3 className="text-xl font-semibold">
                          Nenhum serviço de troca de óleo registrado
                        </h3>
                        <p className="text-muted-foreground">
                          Adicione o KM atual e o KM da próxima troca ao criar
                          um lançamento de serviço.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        {itemsPerPage > 0 && totalPages > 1 && (
          <CardFooter className="flex items-center justify-between pt-4">
            <div className="text-sm text-muted-foreground">
              Total de {totalServices} registro(s).
            </div>
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium">Itens por página</p>
              <Select
                value={`${itemsPerPage}`}
                onValueChange={(value) => {
                  setItemsPerPage(Number(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={itemsPerPage} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[20, 50, 100].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                  <SelectItem value="0">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Próximo
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
