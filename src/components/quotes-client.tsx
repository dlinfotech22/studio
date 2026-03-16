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
  deleteDoc,
} from 'firebase/firestore';
import { format, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Wrench, CheckCircle, Search, MoreHorizontal, Edit, Trash2, FileClock, Check, CircleAlert, PlusCircle, Printer } from 'lucide-react';
import { db } from '@/lib/firebase';
import { type Transaction } from '@/lib/types';
import { formatCurrency, cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';

export function QuotesClient() {
  const [quotes, setQuotes] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const router = useRouter();

  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<Transaction | null>(null);

  useEffect(() => {
    const cId = sessionStorage.getItem('current-user-company-id');
    setCompanyId(cId);
    if (cId) {
        setIsLoading(true);
        const quotesRef = collection(db, 'transactions');
        const qQuotes = query(
            quotesRef,
            where('companyId', '==', cId),
            where('serviceStatus', '==', 'Orçamento')
        );

        const unsubscribe = onSnapshot(qQuotes, (snapshot) => {
            const fetchedQuotes = snapshot.docs.map((doc) => {
                const data = doc.data();
                return { 
                    id: doc.id, 
                    ...data, 
                    date: (data.date as Timestamp).toDate(),
                    quoteExpiryDate: data.quoteExpiryDate ? (data.quoteExpiryDate as Timestamp).toDate() : null 
                } as Transaction;
            });
            
            setQuotes(fetchedQuotes.sort((a,b) => (a.date as Date).getTime() - (b.date as Date).getTime()));
            setIsLoading(false);
        }, (error) => {
            console.error('Failed to fetch quotes:', error);
            toast({ title: 'Erro ao buscar dados', description: 'Não foi possível carregar os orçamentos. Tente novamente.', variant: 'destructive' });
            setIsLoading(false);
        });

        return () => unsubscribe();
    } else {
      setIsLoading(false);
    }
  }, [toast]);

  const handleApprove = async (quoteId: string) => {
    try {
      const quoteRef = doc(db, 'transactions', quoteId);
      // Here, you could also deduct stock if the business logic requires it upon approval.
      // For now, we just change the status. Stock will be handled at completion.
      await updateDoc(quoteRef, { 
          serviceStatus: 'Aprovada'
      });
      toast({ title: 'Orçamento Aprovado!', description: 'O orçamento foi convertido em uma Ordem de Serviço.' });
    } catch (error) {
      console.error('Failed to approve quote:', error);
      toast({ title: 'Erro ao aprovar', description: 'Não foi possível aprovar o orçamento.', variant: 'destructive' });
    }
  };

  const handleEdit = (transactionId: string) => {
    sessionStorage.setItem('transaction-to-edit', transactionId);
    router.push('/transactions');
  };

  const handleNewQuote = () => {
    sessionStorage.setItem('new-transaction-mode', 'quote');
    router.push('/transactions');
  };

  const handleReprint = (quoteId: string) => {
      sessionStorage.setItem('transaction-to-reprint', quoteId);
      router.push('/transactions');
  }

  const handleDelete = (quote: Transaction) => {
    setQuoteToDelete(quote);
    setIsDeleteAlertOpen(true);
  };
  
  const handleConfirmDelete = async () => {
    if (!quoteToDelete) return;
    try {
      await deleteDoc(doc(db, 'transactions', quoteToDelete.id));
      toast({ title: 'Sucesso!', description: 'Orçamento removido permanentemente.' });
    } catch (error) {
      console.error('Failed to delete quote:', error);
      toast({ title: 'Erro!', description: 'Não foi possível remover o orçamento.', variant: 'destructive' });
    } finally {
      setIsDeleteAlertOpen(false);
      setQuoteToDelete(null);
    }
  }

  const filteredQuotes = quotes.filter(service => {
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
    <>
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Buscar por cliente ou nº do orçamento..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                    autoComplete="off"
                />
            </div>
            <Button onClick={handleNewQuote}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Novo Orçamento
            </Button>
        </div>
        
      {filteredQuotes.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm p-8 text-center h-[200px] mt-4">
            <div className="flex flex-col items-center gap-2">
                <FileClock className="w-16 h-16 text-muted-foreground" />
                <h2 className="text-2xl font-semibold">
                    Nenhum orçamento encontrado.
                </h2>
                <p className="max-w-md mt-2 text-sm text-muted-foreground">
                    Crie um novo lançamento com o status "Orçamento" para que ele apareça aqui.
                </p>
            </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredQuotes.map((quote) => {
            const isExpired = quote.quoteExpiryDate ? isBefore(new Date(quote.quoteExpiryDate), startOfDay(new Date())) : false;
            return (
                <Card key={quote.id} className={cn("flex flex-col", isExpired && "bg-muted/50 border-dashed")}>
                <CardHeader>
                    <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-lg">{quote.customerName}</CardTitle>
                        <CardDescription>
                        <span className="font-semibold capitalize text-base">{`Orçamento: ${String(quote.sequentialId).padStart(8, '0')}`}</span>
                        </CardDescription>
                    </div>
                    <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(quote.id)}>
                                    <Edit className="mr-2 h-4 w-4" /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleReprint(quote.id)}>
                                    <Printer className="mr-2 h-4 w-4" /> Reimprimir
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDelete(quote)} className="text-red-500">
                                    <Trash2 className="mr-2 h-4 w-4" /> Excluir
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardHeader>
                <CardContent className="flex-grow space-y-4">
                    <Badge variant={isExpired ? "destructive" : "secondary"}>
                        {isExpired ? (
                            <><CircleAlert className="mr-1 h-3 w-3" /> Expirado</>
                        ) : (
                            <><Check className="mr-1 h-3 w-3" /> Ativo</>
                        )}
                    </Badge>
                    {quote.quoteExpiryDate && <p className="text-xs text-muted-foreground">Válido até: {format(new Date(quote.quoteExpiryDate), 'dd/MM/yyyy')}</p>}

                    <div className="space-y-2">
                        <h4 className="font-semibold text-sm flex items-center gap-2"><Wrench className="h-4 w-4"/>Serviços e Produtos</h4>
                        <div className="pl-4">
                            {quote.services?.map(s => (
                                <div key={s.serviceId} className="flex justify-between text-sm">
                                    <p className="truncate pr-2">{s.serviceName}</p>
                                    <p className="font-mono">{formatCurrency(s.price)}</p>
                                </div>
                            ))}
                            {quote.items?.map(i => (
                                <div key={i.productId} className="flex justify-between text-sm">
                                    <p className="truncate pr-2">{i.quantity}x {i.productName}</p>
                                    <p className="font-mono">{formatCurrency(i.price * i.quantity)}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex-col items-stretch gap-4 !pt-4">
                    <div className="flex justify-between items-center pt-2 border-t">
                        <span className="font-bold">Valor Total:</span>
                        <span className="font-bold text-lg">{formatCurrency(quote.amount)}</span>
                    </div>
                    {!isExpired && (
                        <Button size="sm" className="w-full" onClick={() => handleApprove(quote.id)}>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Aprovar Orçamento
                        </Button>
                    )}
                </CardFooter>
                </Card>
            )
          })}
        </div>
      )}
    </div>
    <AlertDialog
        open={isDeleteAlertOpen}
        onOpenChange={setIsDeleteAlertOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Isso removerá permanentemente o orçamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setQuoteToDelete(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
