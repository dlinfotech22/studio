'use client';

import { useState, useEffect } from 'react';
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
  Search,
  X,
} from 'lucide-react';

import { type Transaction, type Category } from '@/lib/types';
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

const TRANSACTIONS_STORAGE_KEY = 'app-transactions';
const CATEGORIES_STORAGE_KEY = 'app-categories';

const initialTransactions: Transaction[] = [
  { id: '1', date: new Date(), description: 'Prestação de Serviço - Cliente A', amount: 5000, type: 'revenue', category: 'Prestação de Serviço' },
  { id: '2', date: new Date(new Date().setDate(new Date().getDate() - 1)), description: 'Pagamento de Salários', amount: -12000, type: 'expense', category: 'Salários' },
  { id: '3', date: new Date(new Date().setDate(new Date().getDate() - 2)), description: 'Conta de Luz', amount: -450.75, type: 'expense', category: 'Luz' },
  { id: '4', date: new Date(new Date().setDate(new Date().getDate() - 3)), description: 'Prestação de Serviço - Cliente B', amount: 7500, type: 'revenue', category: 'Prestação de Serviço' },
];

const defaultCategories: Category[] = [
    { id: 'cat-rev-1', name: 'Prestação de Serviço', type: 'revenue' },
    { id: 'cat-rev-2', name: 'Venda de Produtos', type: 'revenue' },
    { id: 'cat-exp-1', name: 'Salários', type: 'expense' },
    { id: 'cat-exp-2', name: 'Fornecedores', type: 'expense' },
    { id: 'cat-exp-3', name: 'Aluguel', type: 'expense' },
  ];

const transactionSchema = z.object({
  description: z.string().optional(),
  amount: z.coerce.number().positive('O valor deve ser positivo.'),
  date: z.date(),
  category: z.string().min(1, 'Selecione uma categoria.'),
  type: z.enum(['revenue', 'expense']),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

export function TransactionsClient() {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [activeTab, setActiveTab] = useState<'revenue' | 'expense'>('revenue');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [amountFilter, setAmountFilter] = useState('');
  const [dateFilter, setDateFilter] = useState<Date | undefined>();
  const [isFilterDatePickerOpen, setIsFilterDatePickerOpen] = useState(false);

  useEffect(() => {
    try {
      const storedTransactions = localStorage.getItem(TRANSACTIONS_STORAGE_KEY);
      setTransactions(storedTransactions ? JSON.parse(storedTransactions, (key, value) => key === 'date' ? new Date(value) : value) : initialTransactions);

      const storedCategories = localStorage.getItem(CATEGORIES_STORAGE_KEY);
      const categories = storedCategories ? JSON.parse(storedCategories) : defaultCategories;
      setAllCategories(categories);
      if (!storedCategories) {
        localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(defaultCategories));
      }
    } catch (error) {
      console.error("Failed to load data from localStorage", error);
      setTransactions(initialTransactions);
      setAllCategories(defaultCategories);
    }
  }, []);

  useEffect(() => {
    if (transactions.length) {
      localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(transactions));
    }
  }, [transactions]);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      description: '',
      amount: 0,
      date: new Date(),
      type: 'revenue',
    },
  });

  const filteredTransactions = transactions.filter(t => {
      const searchTermLower = searchTerm.toLowerCase();

      const searchMatch =
        searchTerm === '' ||
        t.description.toLowerCase().includes(searchTermLower) ||
        t.category.toLowerCase().includes(searchTermLower);

      const amountValue = parseFloat(amountFilter);
      const amountMatch =
        amountFilter === '' ||
        isNaN(amountValue) ||
        Math.abs(t.amount) === amountValue;

      const dateMatch =
        !dateFilter ||
        format(new Date(t.date), 'yyyy-MM-dd') ===
          format(dateFilter, 'yyyy-MM-dd');

      return searchMatch && amountMatch && dateMatch;
    });

  const revenue = filteredTransactions.filter((t) => t.type === 'revenue');
  const expenses = filteredTransactions.filter((t) => t.type === 'expense');

  const revenueCategories = allCategories.filter(c => c.type === 'revenue').map(c => c.name);
  const expenseCategories = allCategories.filter(c => c.type === 'expense').map(c => c.name);


  const onSubmit = (data: TransactionFormValues) => {
    const amount = data.type === 'expense' ? -Math.abs(data.amount) : data.amount;
    const payload = { ...data, amount, description: data.description || data.category };

    if (editingTransaction) {
      setTransactions(
        transactions.map((t) =>
          t.id === editingTransaction.id ? { ...t, ...payload } : t
        )
      );
      toast({ title: "Sucesso!", description: "Lançamento atualizado." });
      setEditingTransaction(null);
      form.reset();
      setIsDialogOpen(false);
    } else {
      setTransactions([
        ...transactions,
        { id: new Date().toISOString(), ...payload },
      ]);
      toast({ title: "Sucesso!", description: "Lançamento adicionado." });
      form.reset({
        description: '',
        amount: 0,
        date: new Date(),
        type: data.type,
        category: '',
      });
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    form.reset({ ...transaction, date: new Date(transaction.date), amount: Math.abs(transaction.amount) });
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
  
  const clearFilters = () => {
    setSearchTerm('');
    setAmountFilter('');
    setDateFilter(undefined);
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
          {data.length > 0 ? data.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.description}</TableCell>
              <TableCell>{item.category}</TableCell>
              <TableCell className={cn("text-right font-mono", type === 'revenue' ? 'text-emerald-600' : 'text-red-600')}>
                {formatCurrency(item.amount)}
              </TableCell>
              <TableCell className="text-right">{format(new Date(item.date), 'dd/MM/yyyy')}</TableCell>
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
          )) : (
             <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  Nenhum lançamento encontrado.
                </TableCell>
              </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <div className="flex flex-col gap-4 mb-4 md:flex-row md:items-center">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
                placeholder="Pesquisar por descrição ou categoria..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
            />
          </div>
          <Input
              type="number"
              placeholder="Filtrar por valor (ex: 500)"
              value={amountFilter}
              onChange={(e) => setAmountFilter(e.target.value)}
              className="w-full md:w-52"
          />
           <Popover open={isFilterDatePickerOpen} onOpenChange={setIsFilterDatePickerOpen}>
              <PopoverTrigger asChild>
                  <Button
                      variant={'outline'}
                      className={cn(
                          'w-full justify-start text-left font-normal md:w-auto',
                          !dateFilter && 'text-muted-foreground'
                      )}
                  >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFilter ? format(dateFilter, 'PPP', { locale: ptBR }) : <span>Filtrar por data</span>}
                  </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                  <Calendar
                      mode="single"
                      selected={dateFilter}
                      onSelect={(date) => {
                          setDateFilter(date);
                          setIsFilterDatePickerOpen(false);
                      }}
                      initialFocus
                  />
              </PopoverContent>
          </Popover>
          {(searchTerm || amountFilter || dateFilter) && (
            <Button variant="ghost" onClick={clearFilters} className="w-full md:w-auto">
                <X className="mr-2 h-4 w-4" />
                Limpar Filtros
            </Button>
          )}
      </div>
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'revenue' | 'expense')}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="revenue">Receitas</TabsTrigger>
            <TabsTrigger value="expense">Despesas</TabsTrigger>
          </TabsList>
          <DialogTrigger asChild>
            <Button onClick={() => openNewTransactionDialog(activeTab)}>
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
                  <FormLabel>Descrição (Opcional)</FormLabel>
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
                  <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
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
                        onSelect={(date) => {
                          field.onChange(date);
                          setIsDatePickerOpen(false);
                        }}
                        disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
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
