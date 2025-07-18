
'use client';

import { useState, useEffect, useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { format, getMonth, getYear, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import {
  CalendarIcon,
  PlusCircle,
  Edit,
  Trash2,
  MoreHorizontal,
  Search,
  X,
  Check,
  ChevronsUpDown,
} from 'lucide-react';
import { DateRange } from 'react-day-picker';

import { type Transaction, type Product, type TransactionSubtype, type TransactionType, type CompanyInfo, type PaymentMethod, type TransactionStatus, type Customer } from '@/lib/types';
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
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
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
import { db } from '@/lib/firebase';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { PrintableDocument } from './printable-document';

const transactionSchema = z.object({
  description: z.string().optional(),
  amount: z.coerce.number().positive('O valor deve ser positivo.'),
  date: z.date(),
  subtype: z.enum(['Prestação de Serviço', 'Venda', 'Serviço + Venda', 'Despesa']),
  customerId: z.string().optional(),
  productId: z.string().optional(),
  quantitySold: z.coerce.number().optional(),
  serviceAmount: z.coerce.number().optional(),
  productAmount: z.coerce.number().optional(),
  paymentMethod: z.enum(['À Vista', 'Parcelado', 'A Prazo']).optional(),
  installmentsCount: z.coerce.number().optional(),
  firstDueDate: z.date().optional(),
}).refine(data => {
  if (data.subtype === 'Serviço + Venda') {
    return (data.serviceAmount ?? 0) > 0 || (data.productAmount ?? 0) > 0;
  }
  return true;
}, {
  message: 'Para "Serviço + Venda", o valor do serviço ou do produto deve ser informado.',
  path: ['amount'],
}).refine(data => {
  if (data.paymentMethod === 'Parcelado' && (!data.installmentsCount || data.installmentsCount <= 1)) {
    return false;
  }
  return true;
}, {
  message: 'O número de parcelas deve ser maior que 1.',
  path: ['installmentsCount']
}).refine(data => {
    if ((data.paymentMethod === 'Parcelado' || data.paymentMethod === 'A Prazo') && !data.firstDueDate) {
        return false;
    }
    return true;
}, {
    message: 'A data de vencimento é obrigatória para esta forma de pagamento.',
    path: ['firstDueDate']
});


type TransactionFormValues = z.infer<typeof transactionSchema>;

const subtypeToTypeMap: Record<TransactionSubtype, TransactionType> = {
  'Prestação de Serviço': 'revenue',
  'Venda': 'revenue',
  'Serviço + Venda': 'revenue',
  'Despesa': 'expense',
};

export function TransactionsClient() {
  const { toast } = useToast();
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<
    Transaction[]
  >([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [activeTab, setActiveTab] = useState<'revenue' | 'expense'>('revenue');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isFirstDueDatePickerOpen, setIsFirstDueDatePickerOpen] = useState(false);
  const [isProductComboboxOpen, setIsProductComboboxOpen] = useState(false);
  const [isCustomerComboboxOpen, setIsCustomerComboboxOpen] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [transactionToPrint, setTransactionToPrint] = useState<Transaction | null>(null);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [amountFilter, setAmountFilter] = useState('');
  const [dateFilter, setDateFilter] = useState<DateRange | undefined>();
  const [isFilterDatePickerOpen, setIsFilterDatePickerOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [productSearchInput, setProductSearchInput] = useState('');
  const [customerSearchInput, setCustomerSearchInput] = useState('');


  useEffect(() => {
    const fetchData = async (id: string) => {
      try {
        const transactionsRef = collection(db, 'transactions');
        const qTransactions = query(
          transactionsRef,
          where('companyId', '==', id)
        );
        const transactionSnapshot = await getDocs(qTransactions);
        const transactions = transactionSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            date: (data.date as Timestamp).toDate(),
          } as Transaction;
        });
        setAllTransactions(transactions);

        const productsRef = collection(db, 'products');
        const qProducts = query(productsRef, where('companyId', '==', id));
        const productSnapshot = await getDocs(qProducts);
        const products = productSnapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Product)
        );
        setAllProducts(products);
        
        const customersRef = collection(db, 'customers');
        const qCustomers = query(customersRef, where('companyId', '==', id));
        const customerSnapshot = await getDocs(qCustomers);
        const customers = customerSnapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Customer)
        );
        setAllCustomers(customers);

        const companiesRef = collection(db, 'companies');
        const qCompany = query(companiesRef, where('document', '==', id));
        const companySnapshot = await getDocs(qCompany);
        if(!companySnapshot.empty) {
            setCompanyInfo({id: companySnapshot.docs[0].id, ...companySnapshot.docs[0].data()} as CompanyInfo);
        }

      } catch (error) {
        console.error('Failed to load data from Firestore', error);
        setAllTransactions([]);
      }
    };

    const id = sessionStorage.getItem('current-user-company-id');
    setCompanyId(id);
    if (id) {
      fetchData(id);
    }
  }, [companyId]);

  useEffect(() => {
    const hasActiveFilter = searchTerm || amountFilter || dateFilter;
    let transactionsToDisplay = allTransactions;

    if (hasActiveFilter) {
      transactionsToDisplay = allTransactions.filter((t) => {
        const searchTermLower = searchTerm.toLowerCase();
        const searchMatch =
          searchTerm === '' ||
          (t.description && t.description.toLowerCase().includes(searchTermLower));

        const amountValue = parseFloat(amountFilter);
        const amountMatch =
          amountFilter === '' ||
          isNaN(amountValue) ||
          Math.abs(t.amount) === amountValue;

        const dateMatch = !dateFilter?.from || (
            new Date(t.date as Date) >= dateFilter.from &&
            (!dateFilter.to || new Date(t.date as Date) <= dateFilter.to)
        );

        return searchMatch && amountMatch && dateMatch;
      });
    } else {
      const now = new Date();
      const currentMonth = getMonth(now);
      const currentYear = getYear(now);
      transactionsToDisplay = allTransactions.filter((t) => {
        const transactionDate = new Date(t.date as Date);
        return (
          getMonth(transactionDate) === currentMonth &&
          getYear(transactionDate) === currentYear
        );
      });
    }

    setFilteredTransactions(
      transactionsToDisplay.sort(
        (a, b) =>
          new Date(b.date as Date).getTime() -
          new Date(a.date as Date).getTime()
      )
    );
  }, [allTransactions, searchTerm, amountFilter, dateFilter]);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      description: '',
      amount: undefined,
      date: new Date(),
      subtype: companyInfo?.allowedSubtypes?.[0] || 'Prestação de Serviço',
      customerId: '',
      productId: '',
      quantitySold: undefined,
      serviceAmount: undefined,
      productAmount: undefined,
      paymentMethod: 'À Vista',
      installmentsCount: undefined,
      firstDueDate: undefined,
    },
  });

  const revenue = filteredTransactions.filter((t) => t.type === 'revenue');
  const expenses = filteredTransactions.filter((t) => t.type === 'expense');

  const onSubmit = async (data: TransactionFormValues) => {
    if (!companyId) return;
  
    let finalTransaction: Transaction | null = null;

    try {
      await runTransaction(db, async (transaction) => {
        let product: Product | undefined;
        let productRef;
        const transactionType = subtypeToTypeMap[data.subtype];
        
        let description = data.description ? data.description.toUpperCase() : data.subtype;
        if(data.customerId) {
            const customer = allCustomers.find(c => c.id === data.customerId);
            if (customer) {
                description = `${data.subtype} - ${customer.name}`
            }
        }
  
        let payload: Partial<Omit<Transaction, 'id' | 'date'> & { date: Timestamp; installments?: any[] }> = {
          type: transactionType,
          companyId,
          amount: Math.abs(data.amount || 0),
          description: description,
          date: Timestamp.fromDate(data.date),
          subtype: data.subtype,
          customerId: data.customerId,
          paymentMethod: data.paymentMethod,
          productId: data.productId,
          quantitySold: data.quantitySold,
          serviceAmount: data.serviceAmount,
          productAmount: data.productAmount,
        };
  
        if (transactionType === 'expense') {
          payload.amount = -Math.abs(data.amount || 0);
          payload.status = 'Pago';
        } else {
          payload.status = data.paymentMethod === 'À Vista' ? 'Pago' : 'Pendente';
        }

        if (data.paymentMethod === 'A Prazo' && data.firstDueDate && data.amount) {
            payload.installments = [{
                installmentNumber: 1,
                dueDate: Timestamp.fromDate(data.firstDueDate),
                amount: data.amount,
                status: 'Pendente'
            }];
        }

        if (data.paymentMethod === 'Parcelado' && data.installmentsCount && data.amount && data.firstDueDate) {
          payload.installments = [];
          const installmentAmount = data.amount / data.installmentsCount;
          for (let i = 0; i < data.installmentsCount; i++) {
            payload.installments.push({
              installmentNumber: i + 1,
              dueDate: Timestamp.fromDate(addMonths(data.firstDueDate, i)),
              amount: installmentAmount,
              status: 'Pendente',
            });
          }
        }
  
        if (data.productId && (data.subtype === 'Venda' || data.subtype === 'Serviço + Venda')) {
          productRef = doc(db, 'products', data.productId);
          const productDoc = await transaction.get(productRef);
          if (!productDoc.exists()) {
            throw new Error('Produto não encontrado.');
          }
          product = productDoc.data() as Product;
        }
  
        if (editingTransaction) {
          const transactionRef = doc(db, 'transactions', editingTransaction.id);
          const oldQuantity = editingTransaction.quantitySold || 0;
          const newQuantity = data.quantitySold || 0;
          const quantityDiff = newQuantity - oldQuantity;
  
          if (product && productRef) {
            if (product.quantity < quantityDiff) {
              throw new Error(`Estoque insuficiente. Disponível: ${product.quantity}`);
            }
            transaction.update(productRef, { quantity: product.quantity - quantityDiff });
          }

          Object.keys(payload).forEach(key => {
            const typedKey = key as keyof typeof payload;
            if (payload[typedKey] === undefined || payload[typedKey] === '') {
              delete payload[typedKey];
            }
          });
  
          transaction.update(transactionRef, payload as any);
          finalTransaction = { ...editingTransaction, ...data, date: data.date } as Transaction;

        } else {
           const quantitySold = data.quantitySold || 0;
            if (product && productRef) {
                if (product.quantity < quantitySold) {
                throw new Error(`Estoque insuficiente. Disponível: ${product.quantity}`);
                }
                transaction.update(productRef, { quantity: product.quantity - quantitySold });
            }

            Object.keys(payload).forEach(key => {
              const typedKey = key as keyof typeof payload;
              if (payload[typedKey] === undefined || payload[typedKey] === '') {
                delete payload[typedKey];
              }
            });
        
            const newTransactionRef = doc(collection(db, 'transactions'));
            transaction.set(newTransactionRef, payload as any);
            finalTransaction = { id: newTransactionRef.id, ...data, date: data.date } as Transaction;
        }
      });
  
      const productSnapshot = await getDocs(query(collection(db, 'products'), where('companyId', '==', companyId)));
      setAllProducts(productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      const transactionSnapshot = await getDocs(query(collection(db, 'transactions'), where('companyId', '==', companyId)));
      setAllTransactions(transactionSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), date: (doc.data().date as Timestamp).toDate() } as Transaction)));
  
      toast({ title: 'Sucesso!', description: `Lançamento ${editingTransaction ? 'atualizado' : 'adicionado'}.` });
      
      setEditingTransaction(null);
      setIsDialogOpen(false);
      form.reset({
        description: '',
        amount: undefined,
        date: new Date(),
        subtype: data.subtype,
        customerId: '',
        productId: '',
        quantitySold: undefined,
        serviceAmount: undefined,
        productAmount: undefined,
        paymentMethod: 'À Vista',
        installmentsCount: undefined,
        firstDueDate: undefined,
      });

      if (finalTransaction && finalTransaction.type === 'revenue' && finalTransaction.subtype !== 'Despesa') {
        setTransactionToPrint(finalTransaction);
        setIsPrintDialogOpen(true);
      }
  
    } catch (error: any) {
      console.error('Failed to save transaction', error);
      toast({
        title: 'Erro!',
        description: error.message || (error.code === 'permission-denied' ? 'Permissão negada.' : 'Não foi possível salvar.'),
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (transaction: Transaction) => {
    let firstDueDate: Date | undefined;
    if (transaction.installments && transaction.installments.length > 0) {
        const firstInstallmentDueDate = transaction.installments[0].dueDate;
        firstDueDate = (firstInstallmentDueDate as Timestamp).toDate();
    }

    setEditingTransaction(transaction);
    form.reset({
      ...transaction,
      date: new Date(transaction.date as Date),
      amount: Math.abs(transaction.amount),
      quantitySold: transaction.quantitySold || undefined,
      serviceAmount: transaction.serviceAmount || undefined,
      productAmount: transaction.productAmount || undefined,
      paymentMethod: transaction.paymentMethod || 'À Vista',
      installmentsCount: transaction.installments?.length || undefined,
      firstDueDate: firstDueDate,
    });
    setActiveTab(transaction.type);
    setIsDialogOpen(true);
  };

  const handleDelete = async (transactionToDelete: Transaction) => {
     if (!companyId) return;

    try {
        await runTransaction(db, async (dbTransaction) => {
            if (transactionToDelete.productId && transactionToDelete.quantitySold) {
                const productRef = doc(db, 'products', transactionToDelete.productId);
                const productDoc = await dbTransaction.get(productRef);
                if (productDoc.exists()) {
                    const currentQuantity = productDoc.data().quantity;
                    dbTransaction.update(productRef, { quantity: currentQuantity + transactionToDelete.quantitySold });
                }
            }
            dbTransaction.delete(doc(db, 'transactions', transactionToDelete.id));
        });

        // Manually refetch data to reflect changes
        const productSnapshot = await getDocs(query(collection(db, 'products'), where('companyId', '==', companyId)));
        setAllProducts(productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
        setAllTransactions(allTransactions.filter((t) => t.id !== transactionToDelete.id));

        toast({ title: 'Sucesso!', description: 'Lançamento removido.' });

    } catch (error: any) {
      console.error('Failed to delete transaction', error);
      toast({
        title: 'Erro!',
        description:
          error.code === 'permission-denied'
            ? 'Permissão negada para remover.'
            : 'Não foi possível remover o lançamento.',
        variant: 'destructive',
      });
    }
  };


  const openNewTransactionDialog = (type: 'revenue' | 'expense') => {
    setEditingTransaction(null);
    const defaultSubtype = companyInfo?.allowedSubtypes?.find(st => subtypeToTypeMap[st] === type) || 'Despesa';
    form.reset({
      description: '',
      amount: undefined,
      date: new Date(),
      subtype: defaultSubtype,
      customerId: '',
      productId: '',
      quantitySold: undefined,
      serviceAmount: undefined,
      productAmount: undefined,
      paymentMethod: 'À Vista',
      installmentsCount: undefined,
      firstDueDate: undefined,
    });
    setIsDialogOpen(true);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setAmountFilter('');
    setDateFilter(undefined);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm, amountFilter, dateFilter, itemsPerPage]);

  const renderTable = (data: Transaction[], type: 'revenue' | 'expense') => {
    const totalItems = data.length;
    const totalPages =
      itemsPerPage > 0 ? Math.ceil(totalItems / itemsPerPage) : 1;
    const paginatedData =
      itemsPerPage > 0
        ? data.slice(
            (currentPage - 1) * itemsPerPage,
            currentPage * itemsPerPage
          )
        : data;

    return (
      <div className="space-y-4">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Data</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.description}
                    </TableCell>
                    <TableCell>{item.subtype}</TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-mono',
                        type === 'revenue' ? 'text-emerald-600' : 'text-red-600'
                      )}
                    >
                      {formatCurrency(item.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {format(new Date(item.date as Date), 'dd/MM/yyyy')}
                    </TableCell>
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
                          <DropdownMenuItem
                            onClick={() => handleDelete(item)}
                            className="text-red-500"
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Deletar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    Nenhum lançamento encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {itemsPerPage > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Total de {totalItems} lançamento(s).
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
                  {[10, 30, 50].map((pageSize) => (
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
          </div>
        )}
      </div>
    );
  };

  const selectedProductId = form.watch('productId');
  const selectedSubtype = form.watch('subtype');
  const selectedProduct = allProducts.find(p => p.id === selectedProductId);
  const selectedPaymentMethod = form.watch('paymentMethod');

  const filteredProducts = allProducts.filter(p => p.name.toLowerCase().includes(productSearchInput.toLowerCase()));
  const filteredCustomers = allCustomers.filter(c => c.name.toLowerCase().includes(customerSearchInput.toLowerCase()));

  const watchedSubtype = form.watch('subtype');
  const watchedProductId = form.watch('productId');
  const watchedQuantitySold = form.watch('quantitySold');
  const watchedServiceAmount = form.watch('serviceAmount');

  useEffect(() => {
    const product = allProducts.find(p => p.id === watchedProductId);

    if (watchedSubtype === 'Venda' && product && watchedQuantitySold) {
        const total = (product.price || 0) * watchedQuantitySold;
        form.setValue('amount', total > 0 ? total : undefined);
        if(total > 0) form.clearErrors('amount');

    } else if (watchedSubtype === 'Serviço + Venda') {
        const prodAmt = product && watchedQuantitySold ? (product.price || 0) * watchedQuantitySold : 0;
        form.setValue('productAmount', prodAmt > 0 ? prodAmt : undefined);
        const total = (watchedServiceAmount || 0) + prodAmt;
        form.setValue('amount', total > 0 ? total : undefined);
        if(total > 0) form.clearErrors('amount');
    }
  }, [form, allProducts, watchedSubtype, watchedProductId, watchedQuantitySold, watchedServiceAmount]);


  return (
    <>
      <div className="flex flex-col gap-4 mb-4 md:flex-row md:items-center">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
            className="pl-8"
            autoComplete="off"
          />
        </div>
        <Input
          type="number"
          placeholder="Filtrar por valor (ex: 500)"
          value={amountFilter}
          onChange={(e) => setAmountFilter(e.target.value)}
          className="w-full md:w-52"
          autoComplete="off"
        />
        <Popover
          open={isFilterDatePickerOpen}
          onOpenChange={setIsFilterDatePickerOpen}
        >
          <PopoverTrigger asChild>
            <Button
              variant={'outline'}
              className={cn(
                'w-full justify-start text-left font-normal md:w-[240px]',
                !dateFilter && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFilter?.from ? (
                dateFilter.to ? (
                  <>
                    {format(dateFilter.from, "LLL dd, y")} -{" "}
                    {format(dateFilter.to, "LLL dd, y")}
                  </>
                ) : (
                  format(dateFilter.from, "LLL dd, y")
                )
              ) : (
                <span>Filtrar por período</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateFilter?.from}
              selected={dateFilter}
              onSelect={(range) => {
                setDateFilter(range);
                if(range?.from && range.to) {
                  setIsFilterDatePickerOpen(false);
                }
              }}
              numberOfMonths={2}
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
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'revenue' | 'expense')}
      >
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="revenue">Receitas</TabsTrigger>
            <TabsTrigger value="expense">Despesas</TabsTrigger>
          </TabsList>
          <Button onClick={() => openNewTransactionDialog(activeTab)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Adicionar Lançamento
          </Button>
        </div>
        <TabsContent value="revenue" className="mt-4">
          {renderTable(revenue, 'revenue')}
        </TabsContent>
        <TabsContent value="expense" className="mt-4">
          {renderTable(expenses, 'expense')}
        </TabsContent>
      </Tabs>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTransaction ? 'Editar' : 'Adicionar'} Lançamento
            </DialogTitle>
            <DialogDescription>
              Preencha os detalhes do seu lançamento financeiro.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="subtype"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Lançamento</FormLabel>
                    <Select
                      onValueChange={(value: TransactionSubtype) => {
                        field.onChange(value);
                        form.setValue('productId', '');
                        form.setValue('quantitySold', undefined);
                        form.setValue('serviceAmount', undefined);
                        form.setValue('productAmount', undefined);
                        form.setValue('amount', undefined);
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {companyInfo?.allowedSubtypes?.map(subtype => (
                            <SelectItem key={subtype} value={subtype}>{subtype}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedSubtype !== 'Despesa' && (
                  <FormField
                      control={form.control}
                      name="customerId"
                      render={({ field }) => (
                      <FormItem className="flex flex-col">
                          <FormLabel>Cliente</FormLabel>
                          <Popover open={isCustomerComboboxOpen} onOpenChange={setIsCustomerComboboxOpen}>
                          <PopoverTrigger asChild>
                              <FormControl>
                              <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
                                  {field.value ? allCustomers.find(c => c.id === field.value)?.name : "Selecione um cliente"}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                              </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                              <Command>
                              <CommandInput placeholder="Digite para filtrar" value={customerSearchInput} onValueChange={setCustomerSearchInput} autoComplete="off" />
                              <CommandList>
                                  <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                                  <CommandGroup>
                                  {filteredCustomers.map((cust) => (
                                      <CommandItem value={cust.name} key={cust.id} onSelect={() => { form.setValue("customerId", cust.id); setIsCustomerComboboxOpen(false); }}>
                                      <Check className={cn("mr-2 h-4 w-4", cust.id === field.value ? "opacity-100" : "opacity-0")} />
                                      {cust.name}
                                      </CommandItem>
                                  ))}
                                  </CommandGroup>
                              </CommandList>
                              </Command>
                          </PopoverContent>
                          </Popover>
                          <FormMessage />
                      </FormItem>
                      )}
                  />
              )}

              {(selectedSubtype === 'Venda' || selectedSubtype === 'Serviço + Venda') && (
                <FormField
                  control={form.control}
                  name="productId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Produto Vinculado</FormLabel>
                      <Popover open={isProductComboboxOpen} onOpenChange={setIsProductComboboxOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "w-full justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value
                                ? allProducts.find(
                                    (prod) => prod.id === field.value
                                  )?.name
                                : "Selecione um produto"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                          <Command>
                            <CommandInput 
                              placeholder="Digite para filtrar" 
                              value={productSearchInput}
                              onValueChange={setProductSearchInput}
                              autoComplete="off"
                            />
                            <CommandList>
                              <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                              <CommandGroup>
                                {filteredProducts.map((prod) => (
                                  <CommandItem
                                    value={prod.name}
                                    key={prod.id}
                                    onSelect={() => {
                                      form.setValue("productId", prod.id);
                                      setIsProductComboboxOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        prod.id === field.value
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
                                    {prod.name}
                                  </CommandItem>
                                ))}
                                </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {selectedProductId && (selectedSubtype === 'Venda' || selectedSubtype === 'Serviço + Venda') && (
                  <FormField
                    control={form.control}
                    name="quantitySold"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantidade Vendida</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
                            autoComplete="off"
                          />
                        </FormControl>
                        {selectedProduct && (
                          <FormDescription>
                            Estoque disponível: {selectedProduct.quantity}
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              )}
              {selectedSubtype === 'Serviço + Venda' && (
                  <FormField
                    control={form.control}
                    name="serviceAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor do Serviço</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0.00" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} autoComplete="off" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              )}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição (Opcional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: Pagamento de aluguel"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) =>
                          field.onChange(e.target.value.toUpperCase())
                        }
                        autoComplete="off"
                      />
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
                    <FormLabel>Valor Total</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0.00" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))} disabled={selectedSubtype === 'Serviço + Venda' || (selectedSubtype === 'Venda' && !!selectedProductId) } autoComplete="off" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedSubtype !== 'Despesa' && (
                <>
                  <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Forma de Pagamento</FormLabel>
                        <Select 
                          onValueChange={(value: PaymentMethod) => {
                            field.onChange(value);
                            form.setValue('installmentsCount', undefined);
                            form.setValue('firstDueDate', undefined);
                          }} 
                          value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a forma de pagamento" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="À Vista">À Vista</SelectItem>
                            <SelectItem value="A Prazo">A Prazo</SelectItem>
                            <SelectItem value="Parcelado">Parcelado</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {selectedPaymentMethod === 'Parcelado' && (
                    <FormField
                      control={form.control}
                      name="installmentsCount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número de Parcelas</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="2" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? undefined : parseInt(e.target.value, 10))} autoComplete="off" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  {(selectedPaymentMethod === 'Parcelado' || selectedPaymentMethod === 'A Prazo') && (
                    <FormField
                      control={form.control}
                      name="firstDueDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>{selectedPaymentMethod === 'Parcelado' ? 'Vencimento da 1ª Parcela' : 'Data de Vencimento'}</FormLabel>
                          <Popover open={isFirstDueDatePickerOpen} onOpenChange={setIsFirstDueDatePickerOpen}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={'outline'}
                                  className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}
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
                                  if (date) field.onChange(date);
                                  setIsFirstDueDatePickerOpen(false);
                                }}
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </>
              )}


              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data do Lançamento</FormLabel>
                    <Popover
                      open={isDatePickerOpen}
                      onOpenChange={setIsDatePickerOpen}
                    >
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
                            if (date) field.onChange(date);
                            setIsDatePickerOpen(false);
                          }}
                          disabled={(date) =>
                            date > new Date() || date < new Date('1900-01-01')
                          }
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
                <Button type="submit">
                  {editingTransaction ? 'Salvar Alterações' : 'Adicionar'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Gerar Documento</DialogTitle>
            <DialogDescription>
              Revise as informações e clique em imprimir para gerar o documento.
            </DialogDescription>
          </DialogHeader>
          <PrintableDocument
            transaction={transactionToPrint}
            customer={allCustomers.find(c => c.id === transactionToPrint?.customerId)}
            product={allProducts.find(p => p.id === transactionToPrint?.productId)}
            companyInfo={companyInfo}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPrintDialogOpen(false)}>Fechar</Button>
            <Button onClick={() => window.print()}>Imprimir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
