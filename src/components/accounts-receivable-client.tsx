
'use client';

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';
import { format } from 'date-fns';
import { CircleDollarSign, CheckCircle2, Hourglass } from 'lucide-react';

import { type Transaction, type Installment } from '@/lib/types';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';

export function AccountsReceivableClient() {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [paymentToConfirm, setPaymentToConfirm] = useState<{
    transactionId: string;
    installmentNumber: number;
  } | null>(null);

  useEffect(() => {
    const fetchData = async (id: string) => {
      setIsLoading(true);
      try {
        const transactionsRef = collection(db, 'transactions');
        const q = query(
          transactionsRef,
          where('companyId', '==', id),
          where('status', 'in', ['Pendente', 'Parcialmente Pago'])
        );
        const snapshot = await getDocs(q);
        const fetchedTransactions = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              date: (data.date as Timestamp).toDate(),
              installments: data.installments?.map((inst: any) => ({
                ...inst,
                dueDate: (inst.dueDate as Timestamp).toDate(),
              })),
            } as Transaction;
          })
          .sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
          );
        setTransactions(fetchedTransactions);
      } catch (error) {
        console.error('Failed to load accounts receivable:', error);
        toast({
          title: 'Erro!',
          description: 'Não foi possível carregar as contas a receber.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    const id = sessionStorage.getItem('current-user-company-id');
    if (id) {
      setCompanyId(id);
      fetchData(id);
    } else {
      setIsLoading(false);
    }
  }, [toast]);

  const handleConfirmPayment = async () => {
    if (!paymentToConfirm || !companyId) return;

    const { transactionId, installmentNumber } = paymentToConfirm;

    try {
      await runTransaction(db, async (dbTransaction) => {
        const transactionRef = doc(db, 'transactions', transactionId);
        const transactionDoc = await dbTransaction.get(transactionRef);

        if (!transactionDoc.exists()) {
          throw new Error('Lançamento não encontrado.');
        }

        const currentTransactionData = transactionDoc.data();
        const currentTransaction = {
            ...currentTransactionData,
            date: (currentTransactionData.date as Timestamp).toDate(),
            installments: currentTransactionData.installments?.map((inst: any) => ({
                ...inst,
                dueDate: (inst.dueDate as Timestamp).toDate(),
            })),
        } as Transaction;

        const installments =
          currentTransaction.installments?.map((inst) =>
            inst.installmentNumber === installmentNumber
              ? { ...inst, status: 'Paga' as const }
              : inst
          ) || [];

        const allPaid = installments.every((inst) => inst.status === 'Paga');
        const newStatus = allPaid ? 'Pago' : 'Parcialmente Pago';

        dbTransaction.update(transactionRef, {
          installments: installments.map(inst => ({...inst, dueDate: Timestamp.fromDate(inst.dueDate as Date)})),
          status: newStatus,
        });
      });

      // Optimistic update
      setTransactions((prev) =>
        prev
          .map((t) => {
            if (t.id === transactionId) {
              const updatedInstallments =
                t.installments?.map((inst) =>
                  inst.installmentNumber === installmentNumber
                    ? { ...inst, status: 'Paga' as const }
                    : inst
                ) || [];
              const allPaid = updatedInstallments.every(
                (inst) => inst.status === 'Paga'
              );
              return {
                ...t,
                installments: updatedInstallments,
                status: allPaid ? ('Pago' as const) : ('Parcialmente Pago' as const),
              };
            }
            return t;
          })
          .filter((t) => t.status !== 'Pago')
      );

      toast({
        title: 'Sucesso!',
        description: 'Pagamento da parcela confirmado.',
      });
    } catch (error: any) {
      console.error('Failed to confirm payment:', error);
      toast({
        title: 'Erro!',
        description:
          error.message || 'Não foi possível confirmar o pagamento.',
        variant: 'destructive',
      });
    } finally {
      setPaymentToConfirm(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm p-8 text-center h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <CheckCircle2 className="w-16 h-16 text-muted-foreground" />
          <h2 className="text-2xl font-semibold">Tudo em dia!</h2>
          <p className="max-w-md mt-2 text-sm text-muted-foreground">
            Você não possui nenhuma conta pendente de recebimento no momento.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Accordion type="multiple" className="w-full space-y-2">
        {transactions.map((transaction) => (
          <AccordionItem
            value={transaction.id}
            key={transaction.id}
            className="border rounded-lg bg-card"
          >
            <AccordionTrigger className="p-4 hover:no-underline">
              <div className="flex justify-between items-center w-full">
                <div className="flex flex-col items-start text-left gap-1">
                  <p className="font-semibold text-card-foreground">
                    {transaction.description}
                  </p>
                  <p className="text-sm text-muted-foreground font-normal">
                    {formatCurrency(transaction.amount)} em{' '}
                    {format(new Date(transaction.date), 'dd/MM/yyyy')}
                  </p>
                </div>
                <Badge
                  variant={
                    transaction.status === 'Pendente' ? 'destructive' : 'secondary'
                  }
                  className="mr-4"
                >
                  {transaction.status}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="p-0 border-t">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Parcela</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right w-48">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transaction.installments?.map((inst) => (
                    <TableRow key={inst.installmentNumber}>
                      <TableCell>{inst.installmentNumber}</TableCell>
                      <TableCell>
                        {format(new Date(inst.dueDate), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={inst.status === 'Paga' ? 'default' : 'outline'}
                          className={cn(inst.status === 'Paga' && "bg-emerald-500 hover:bg-emerald-600")}
                        >
                          {inst.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(inst.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {inst.status === 'Pendente' && (
                          <Button
                            size="sm"
                            onClick={() =>
                              setPaymentToConfirm({
                                transactionId: transaction.id,
                                installmentNumber: inst.installmentNumber,
                              })
                            }
                          >
                            <CircleDollarSign className="mr-2 h-4 w-4" />
                            Confirmar Pagamento
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!transaction.installments && (
                     <TableRow>
                        <TableCell>1/1</TableCell>
                        <TableCell>{format(new Date(transaction.date), 'dd/MM/yyyy')}</TableCell>
                        <TableCell><Badge variant="outline">{transaction.status}</Badge></TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(transaction.amount)}</TableCell>
                        <TableCell className="text-right">
                           <Button
                            size="sm"
                            onClick={() =>
                              setPaymentToConfirm({
                                transactionId: transaction.id,
                                installmentNumber: 1, // Placeholder for non-installment
                              })
                            }
                          >
                             <CircleDollarSign className="mr-2 h-4 w-4" />
                            Confirmar Pagamento
                          </Button>
                        </TableCell>
                     </TableRow>
                  )}
                </TableBody>
              </Table>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <AlertDialog
        open={!!paymentToConfirm}
        onOpenChange={() => setPaymentToConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Recebimento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação marcará a parcela como paga. Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmPayment}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
