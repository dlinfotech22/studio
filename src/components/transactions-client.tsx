'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarIcon,
  PlusCircle,
  Edit,
  Trash2,
  MoreHorizontal,
} from 'lucide-react';

import { type Transaction } from '@/lib/types';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

const initialTransactions: Transaction[] = [
  { id: '1', date: new Date(), description: 'Prestação de Serviço - Cliente A', amount: 5000, type: 'revenue', category: 'Serviços' },
  { id: '2', date: new Date(new Date().setDate(new Date().getDate() - 1)), description: 'Pagamento de Salários', amount: 12000, type: 'expense', category: 'Salários' },
  { id: '3', date: new Date(new Date().setDate(new Date().getDate() - 2)), description: 'Conta de Luz', amount: 450.75, type: 'expense', category: 'Luz' },
  { id: '4', date: new Date(new Date().setDate(new Date().getDate() - 3)), description: 'Prestação de Serviço - Cliente B', amount: 7500, type: 'revenue', category: 'Serviços' },
];

const transactionSchema = z.object({
  description: z.string().min(3, 'A descrição deve ter no mínimo 3 caracteres.'),
  amount: z.coerce.number().positive('O valor deve ser positivo.'),
  date: z.date(),
  category: z.string().min(1, 'Selecione uma categoria.'),
  type: z.enum(['revenue', 'expense']),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

export function TransactionsClient() {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      description: '',
      amount: 0,
      date: new Date(),
      type: 'revenue',
    },
  });

  const revenue = transactions.filter((t) => t.type === 'revenue');
  const expenses = transactions.filter((t) => t.type === 'expense');

  const revenueCategories = ['Serviços', 'Venda de Produtos', 'Outros'];
  const expenseCategories = ['Salários', 'Fornecedores', 'Água', 'Luz', 'Internet', 'Aluguel', 'Outros'];

  const onSubmit = (data: TransactionFormValues) => {
    if (editingTransaction) {
      setTransactions(
        transactions.map((t) =>
          t.id === editingTransaction.id ? { ...editingTransaction, ...data } : t
        )
      );
      toast({ title: "Sucesso!", description: "Lançamento atualizado." });
    } else {
      setTransactions([
        ...transactions,
        { id: new Date().toISOString(), ...data },
      ]);
      toast({ title: "Sucesso!", description: "Lançamento adicionado." });
    }
    form.reset();
    setEditingTransaction(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    form.reset(transaction);
    setIsDialogOpen(true);
  };
  
  const handleDelete = (id: string) => {
    setTransactions(transactions.filter(t => t.id !== id));
    toast({ title: "Sucesso!", description: "Lançamento removido.", variant: 'destructive' });
  };

  const openNewTransactionDialog = (type: 'revenue' | 'expense') => {
    setEditingTransaction(null);
    form.reset({
      description: '',
      amount: 0,
      date: new Date(),
      type: type,
      category: '',
    });
    setIsDialogOpen(true);
  };

  const renderTable = (data: Transaction[], type: 'revenue' | 'expense') => (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Descrição</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-right">Data</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.description}</TableCell>
              <TableCell>{item.category}</TableCell>
              <TableCell className={cn("text-right font-mono", type === 'revenue' ? 'text-emerald-600' : 'text-red-600')}>
                {formatCurrency(item.amount)}
              </TableCell>
              <TableCell className="text-right">{format(item.date, 'dd/MM/yyyy')}</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(item)}>
                      <Edit className="mr-2 h-4 w-4" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDelete(item.id)} className="text-red-500">
                      <Trash2 className="mr-2 h-4 w-4" /> Deletar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <Tabs defaultValue="revenue">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="revenue">Receitas</TabsTrigger>
            <TabsTrigger value="expense">Despesas</TabsTrigger>
          </TabsList>
          <DialogTrigger asChild>
            <Button onClick={() => openNewTransactionDialog(form.getValues('type'))}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Adicionar Lançamento
            </Button>
          </DialogTrigger>
        </div>
        <TabsContent value="revenue" className="mt-4">
          {renderTable(revenue, 'revenue')}
        </TabsContent>
        <TabsContent value="expense" className="mt-4">
          {renderTable(expenses, 'expense')}
        </TabsContent>
      </Tabs>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingTransaction ? 'Editar' : 'Adicionar'} Lançamento</DialogTitle>
          <DialogDescription>
            Preencha os detalhes do seu lançamento financeiro.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Lançamento</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="revenue">Receita</SelectItem>
                      <SelectItem value="expense">Despesa</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Pagamento de aluguel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(form.watch('type') === 'revenue' ? revenueCategories : expenseCategories).map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={'outline'}
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            format(field.value, 'PPP', { locale: ptBR })
                          ) : (
                            <span>Escolha uma data</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit">{editingTransaction ? 'Salvar Alterações' : 'Adicionar'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
