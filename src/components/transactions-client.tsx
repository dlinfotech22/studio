
'use client';

import { useState, useEffect, useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { format, getMonth, getYear, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  runTransaction,
  getDoc,
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
  Printer,
} from 'lucide-react';
import { DateRange } from 'react-day-picker';

import { type Transaction, type Product, type TransactionSubtype, type TransactionType, type CompanyInfo, type PaymentMethod, type TransactionStatus, type Customer, type TransactionItem, type Service, type TransactionServiceItem, type ServiceStatus } from '@/lib/types';
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
import { Separator } from './ui/separator';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';

const transactionItemSchema = z.object({
    productId: z.string().min(1),
    productName: z.string(),
    quantity: z.coerce.number().min(1, "A quantidade deve ser pelo menos 1."),
    price: z.coerce.number(),
    basePrice: z.coerce.number(), // Original price without interest
    financeInterestRate: z.coerce.number().optional(),
});

const transactionServiceItemSchema = z.object({
    serviceId: z.string().min(1),
    serviceName: z.string(),
    price: z.coerce.number(),
});

const serviceStatusEnum = z.enum([
    'Agendado',
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
]);

const transactionSchema = z.object({
  description: z.string().optional(),
  amount: z.coerce.number().optional(),
  date: z.date(),
  subtype: z.enum(['Prestação de Serviço', 'Venda', 'Serviço + Venda', 'Despesa']),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  paymentMethod: z.enum(['À Vista', 'Parcelado', 'A Prazo']).optional(),
  installmentsCount: z.coerce.number().optional(),
  firstDueDate: z.date().optional(),
  items: z.array(transactionItemSchema).optional(),
  services: z.array(transactionServiceItemSchema).optional(),
  serviceStatus: serviceStatusEnum.optional(),
}).refine(data => {
    if (data.subtype === 'Despesa') {
      return data.amount !== undefined && data.amount > 0;
    }
    return true;
  }, {
    message: 'O valor é obrigatório para despesas.',
    path: ['amount'],
  })
  .refine(data => {
  if (data.subtype === 'Venda') {
    return data.items && data.items.length > 0;
  }
   if (data.subtype === 'Serviço + Venda') {
    return (data.items && data.items.length > 0) || (data.services && data.services.length > 0);
  }
  if (data.subtype === 'Prestação de Serviço') {
    return data.services && data.services.length > 0;
  }
  return true;
}, {
    message: 'Você deve adicionar pelo menos um item ou serviço para este tipo de lançamento.',
    path: ['items'],
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
}).refine(data => {
    if (data.subtype !== 'Despesa') {
        return data.customerName && data.customerName.trim().length > 0;
    }
    return true;
}, {
    message: 'O campo cliente é obrigatório para receitas.',
    path: ['customerName'],
});


type TransactionFormValues = z.infer<typeof transactionSchema>;

const subtypeToTypeMap: Record<TransactionSubtype, TransactionType> = {
  'Prestação de Serviço': 'revenue',
  'Venda': 'revenue',
  'Serviço + Venda': 'revenue',
  'Despesa': 'expense',
};

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

export function TransactionsClient({}: {}) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<
    Transaction[]
  >([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [activeTab, setActiveTab] = useState<'revenue' | 'expense'>('revenue');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [transactionToPrint, setTransactionToPrint] = useState<Transaction | null>(null);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);

  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [currentQuantity, setCurrentQuantity] = useState<number | ''>(1);
  const [currentService, setCurrentService] = useState<Service | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [amountFilter, setAmountFilter] = useState('');
  const [dateFilter, setDateFilter] = useState<DateRange | undefined>();
  const [isFilterDatePickerOpen, setIsFilterDatePickerOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const hasHandledInitialTransaction = useRef(false);


  useEffect(() => {
    const id = sessionStorage.getItem('current-user-company-id');
    setCompanyId(id);
    if (!id) {
        setIsLoading(false);
        return;
    }

    const transactionsQuery = query(collection(db, 'transactions'), where('companyId', '==', id));
    const productsQuery = query(collection(db, 'products'), where('companyId', '==', id));
    const servicesQuery = query(collection(db, 'services'), where('companyId', '==', id));
    const customersQuery = query(collection(db, 'customers'), where('companyId', '==', id));
    const companyQuery = query(collection(db, 'companies'), where('document', '==', id));

    const unsubTransactions = onSnapshot(transactionsQuery, (snapshot) => {
        const transactions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            date: (doc.data().date as Timestamp).toDate(),
        } as Transaction));
        setAllTransactions(transactions);
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching transactions:", error);
        setIsLoading(false);
    });

    const unsubProducts = onSnapshot(productsQuery, (snapshot) => {
        setAllProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (error) => console.error("Error fetching products:", error));

    const unsubServices = onSnapshot(servicesQuery, (snapshot) => {
        setAllServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service)));
    }, (error) => console.error("Error fetching services:", error));

    const unsubCustomers = onSnapshot(customersQuery, (snapshot) => {
        setAllCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    }, (error) => console.error("Error fetching customers:", error));
    
    const unsubCompany = onSnapshot(companyQuery, (snapshot) => {
        if(!snapshot.empty) {
            setCompanyInfo({id: snapshot.docs[0].id, ...snapshot.docs[0].data()} as CompanyInfo);
        }
    }, (error) => console.error("Error fetching company info:", error));


    return () => { 
        unsubTransactions();
        unsubProducts();
        unsubServices();
        unsubCustomers();
        unsubCompany();
    };
  }, []);

  const handleEdit = (transaction: Transaction) => {
    let firstDueDate: Date | undefined;
    if (transaction.installments && transaction.installments.length > 0) {
        const firstInstallmentDueDate = transaction.installments[0].dueDate;
        firstDueDate = (firstInstallmentDueDate as Timestamp).toDate();
    }
    
    let scheduledDate: Date | undefined;
    if (transaction.scheduledDate) {
        scheduledDate = (transaction.scheduledDate as Timestamp).toDate();
    }

    const isServiceRelated = transaction.subtype === 'Prestação de Serviço' || transaction.subtype === 'Serviço + Venda';

    setEditingTransaction(transaction);
    form.reset({
      ...transaction,
      date: new Date(transaction.date as Date),
      amount: Math.abs(transaction.amount),
      customerId: transaction.customerId || undefined,
      customerName: transaction.customerName || undefined,
      paymentMethod: transaction.paymentMethod || 'À Vista',
      installmentsCount: transaction.installmentsCount || transaction.installments?.length || undefined,
      firstDueDate: firstDueDate,
      items: transaction.items || [],
      services: transaction.services || [],
      serviceStatus: isServiceRelated ? (transaction.serviceStatus || 'Aberta') : undefined,
    });
    setActiveTab(transaction.type);
    setIsDialogOpen(true);
  };
  
  useEffect(() => {
    if (!isLoading && allTransactions.length > 0 && !hasHandledInitialTransaction.current) {
      const transactionId = sessionStorage.getItem('transaction-to-edit');
      if (transactionId) {
        const transactionToEdit = allTransactions.find(t => t.id === transactionId);
        if (transactionToEdit) {
          handleEdit(transactionToEdit);
          sessionStorage.removeItem('transaction-to-edit');
        }
        hasHandledInitialTransaction.current = true;
      }
    }
  }, [allTransactions, isLoading]);

  useEffect(() => {
    const hasActiveFilter = searchTerm || amountFilter || dateFilter;
    let transactionsToDisplay = allTransactions.filter(t => t.serviceStatus !== 'Agendado');

    if (hasActiveFilter) {
      transactionsToDisplay = transactionsToDisplay.filter((t) => {
        const searchTermLower = searchTerm.toLowerCase();
        const searchMatch =
          searchTerm === '' ||
          (t.description && t.description.toLowerCase().includes(searchTermLower)) ||
          (t.customerName && t.customerName.toLowerCase().includes(searchTermLower));

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
      transactionsToDisplay = transactionsToDisplay.filter((t) => {
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
      customerId: undefined,
      customerName: undefined,
      paymentMethod: 'À Vista',
      installmentsCount: undefined,
      firstDueDate: undefined,
      items: [],
      services: [],
      serviceStatus: 'Aberta',
    },
  });

  const { fields: items, append: appendProduct, remove: removeProduct, update: updateProduct } = useFieldArray({
    control: form.control,
    name: "items",
  });
  
  const { fields: services, append: appendService, remove: removeService } = useFieldArray({
    control: form.control,
    name: "services",
  });

  useEffect(() => {
    if (companyInfo?.allowedSubtypes) {
      form.reset({
        ...form.getValues(),
        subtype: companyInfo.allowedSubtypes[0] || 'Prestação de Serviço',
      });
    }
  }, [companyInfo, form]);
  
  const paymentMethod = form.watch('paymentMethod');

  useEffect(() => {
    const currentItems = form.getValues('items') || [];
    const isFinanced = paymentMethod === 'A Prazo' || paymentMethod === 'Parcelado';

    currentItems.forEach((item, index) => {
        let newPrice = item.basePrice;
        if (isFinanced && item.financeInterestRate) {
            newPrice = item.basePrice * (1 + item.financeInterestRate / 100);
        }
        if (item.price !== newPrice) {
            updateProduct(index, { ...item, price: newPrice });
        }
    });

  }, [paymentMethod, form, updateProduct]);

  const revenue = filteredTransactions.filter((t) => t.type === 'revenue');
  const expenses = filteredTransactions.filter((t) => t.type === 'expense');

  const onSubmit = async (data: TransactionFormValues) => {
    if (!companyId || !companyInfo) return;
  
    let finalTransaction: Transaction | null = null;
    
    try {
      await runTransaction(db, async (transaction) => {
        const companyRef = doc(db, 'companies', companyInfo.id);
        const companyDocPromise = transaction.get(companyRef);
  
        const oldItems = editingTransaction?.items || [];
        const newItems = data.items || [];
        const itemChanges: { [productId: string]: number } = {};
        
        oldItems.forEach(item => {
          itemChanges[item.productId] = (itemChanges[item.productId] || 0) + item.quantity;
        });
        newItems.forEach(item => {
          itemChanges[item.productId] = (itemChanges[item.productId] || 0) - item.quantity;
        });
  
        const productRefs = Object.keys(itemChanges).map(productId => doc(db, 'products', productId));
        const productDocsPromise = productRefs.length > 0 ? Promise.all(productRefs.map(ref => transaction.get(ref))) : Promise.resolve([]);
  
        // Perform all reads first
        const [companyDoc, productDocs] = await Promise.all([companyDocPromise, productDocsPromise]);
        
        if (!companyDoc.exists()) {
          throw new Error("Dados da empresa não encontrados.");
        }
  
        for (let i = 0; i < productDocs.length; i++) {
          const productDoc = productDocs[i];
          const productId = productRefs[i].id;
          const quantityChange = itemChanges[productId];
  
          if (!productDoc.exists()) throw new Error(`Produto com ID ${productId} não encontrado.`);
          const currentQuantity = productDoc.data().quantity;
          if (currentQuantity < -quantityChange) throw new Error(`Estoque insuficiente para ${productDoc.data().name}.`);
        }
        
        // Now perform writes
        let currentCounter = companyDoc.data().transactionCounter || 0;
        let nextSequentialId = editingTransaction ? editingTransaction.sequentialId : currentCounter + 1;
        if (!editingTransaction && nextSequentialId > 99999999) {
          nextSequentialId = 1;
        }
  
        const transactionType = subtypeToTypeMap[data.subtype];
        const itemsTotal = data.items?.reduce((sum, item) => sum + (item.price ?? 0) * (item.quantity ?? 0), 0) || 0;
        const servicesTotal = data.services?.reduce((sum, service) => sum + (service.price ?? 0), 0) || 0;
        
        let totalAmount: number;
        if (transactionType === 'expense') {
          if (data.amount === undefined || data.amount <= 0) {
            throw new Error("O valor da despesa deve ser um número positivo.");
          }
          totalAmount = data.amount;
        } else {
          totalAmount = itemsTotal + servicesTotal;
        }
        
        const finalDescription = (data.description || '');
        
        const isServiceRelated = data.subtype === 'Prestação de Serviço' || data.subtype === 'Serviço + Venda';

        const payload: Partial<Omit<Transaction, 'id' | 'date'> & { date: Timestamp; installments?: any[] }> = {
          type: transactionType,
          companyId,
          sequentialId: nextSequentialId,
          amount: Math.abs(totalAmount),
          description: finalDescription,
          date: Timestamp.fromDate(data.date),
          subtype: data.subtype,
          customerId: data.customerId,
          customerName: data.customerName ? data.customerName.toUpperCase() : '',
          paymentMethod: data.paymentMethod,
          items: data.items,
          services: data.services,
          serviceStatus: isServiceRelated ? data.serviceStatus : undefined,
        };
  
        if (transactionType === 'expense') {
          payload.status = 'Pago';
        } else {
          payload.status = data.paymentMethod === 'À Vista' ? 'Pago' : 'Pendente';
        }
  
        if (data.paymentMethod === 'A Prazo' && data.firstDueDate) {
          payload.installments = [{
            installmentNumber: 1,
            dueDate: Timestamp.fromDate(data.firstDueDate),
            amount: totalAmount,
            status: 'Pendente'
          }];
          payload.installmentsCount = 1;
        }
  
        if (data.paymentMethod === 'Parcelado' && data.installmentsCount && data.firstDueDate) {
          payload.installments = [];
          const installmentAmount = totalAmount / data.installmentsCount;
          for (let i = 0; i < data.installmentsCount; i++) {
            payload.installments.push({
              installmentNumber: i + 1,
              dueDate: Timestamp.fromDate(addMonths(data.firstDueDate, i)),
              amount: installmentAmount,
              status: 'Pendente',
            });
          }
          payload.installmentsCount = data.installmentsCount;
        }
  
        for (let i = 0; i < productDocs.length; i++) {
          const productId = productRefs[i].id;
          const quantityChange = itemChanges[productId];
          if (quantityChange !== 0) {
            const currentQuantity = productDocs[i].data().quantity;
            transaction.update(productRefs[i], { quantity: currentQuantity + quantityChange });
          }
        }
  
        if (editingTransaction) {
          const transactionRef = doc(db, 'transactions', editingTransaction.id);
          const updatePayload = { ...payload };
          
          Object.keys(updatePayload).forEach(key => {
            const typedKey = key as keyof typeof updatePayload;
            if (updatePayload[typedKey] === undefined || (typeof updatePayload[typedKey] === 'number' && isNaN(updatePayload[typedKey] as number))) {
              delete (updatePayload as any)[typedKey];
            }
          });
          transaction.update(transactionRef, updatePayload as any);
          finalTransaction = { ...editingTransaction, ...payload, date: data.date } as Transaction;
        } else {
          const newTransactionRef = doc(collection(db, 'transactions'));
          transaction.set(newTransactionRef, payload as any);
          transaction.update(companyRef, { transactionCounter: nextSequentialId });
          finalTransaction = { id: newTransactionRef.id, ...payload, date: data.date } as Transaction;
        }
      });
  
      
      toast({ title: 'Sucesso!', description: `Lançamento ${editingTransaction ? 'atualizado' : 'adicionado'}.` });
      
      setEditingTransaction(null);
      setIsDialogOpen(false);
      form.reset({
        description: '', amount: undefined, date: new Date(), subtype: data.subtype,
        customerId: undefined, customerName: undefined, paymentMethod: 'À Vista', installmentsCount: undefined,
        firstDueDate: undefined, items: [], services: [], serviceStatus: 'Aberta'
      });

      if (finalTransaction && finalTransaction.type === 'revenue' && finalTransaction.subtype !== 'Despesa') {
        handlePrint(finalTransaction);
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


  const handleDelete = async (transactionToDelete: Transaction) => {
     if (!companyId) return;

    try {
        await runTransaction(db, async (dbTransaction) => {
            if (transactionToDelete.items && transactionToDelete.items.length > 0) {
                for (const item of transactionToDelete.items) {
                    const productRef = doc(db, 'products', item.productId);
                    const productDoc = await dbTransaction.get(productRef);
                    if (productDoc.exists()) {
                        const currentQuantity = productDoc.data().quantity;
                        dbTransaction.update(productRef, { quantity: currentQuantity + item.quantity });
                    }
                }
            }
            dbTransaction.delete(doc(db, 'transactions', transactionToDelete.id));
        });

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

  const handlePrint = (transactionToPrint: Transaction) => {
    setTransactionToPrint(transactionToPrint);
    setIsPrintDialogOpen(true);
  }

  const openNewTransactionDialog = (type: 'revenue' | 'expense') => {
    setEditingTransaction(null);
    const defaultSubtype = companyInfo?.allowedSubtypes?.find(st => subtypeToTypeMap[st] === type) || (type === 'revenue' ? 'Prestação de Serviço' : 'Despesa');
    form.reset({
      description: '', amount: undefined, date: new Date(), subtype: defaultSubtype,
      customerId: undefined, customerName: undefined, paymentMethod: 'À Vista', installmentsCount: undefined,
      firstDueDate: undefined, items: [], services: [], serviceStatus: 'Aberta'
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
                {type === 'revenue' && <TableHead>Status do Serviço</TableHead>}
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
                     {type === 'revenue' && (
                        <TableCell>
                            {(item.subtype === 'Prestação de Serviço' || item.subtype === 'Serviço + Venda') && item.serviceStatus ? (
                                <Badge variant="secondary">{item.serviceStatus}</Badge>
                            ) : (
                                '-'
                            )}
                        </TableCell>
                    )}
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
                          {item.type === 'revenue' && (
                            <DropdownMenuItem onClick={() => handlePrint(item)}>
                                <Printer className="mr-2 h-4 w-4" /> Reimprimir
                            </DropdownMenuItem>
                          )}
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
                  <TableCell colSpan={type === 'revenue' ? 6 : 5} className="h-24 text-center">
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
  
  const selectedSubtype = form.watch('subtype');
  const selectedPaymentMethod = form.watch('paymentMethod');
  const isServiceRelated = selectedSubtype === 'Prestação de Serviço' || selectedSubtype === 'Serviço + Venda';

  const handleAddProduct = () => {
    if (currentProduct && currentQuantity) {
        const qty = Number(currentQuantity);
        if (qty > 0) {
            appendProduct({
                productId: currentProduct.id,
                productName: currentProduct.name,
                quantity: qty,
                price: currentProduct.price,
                basePrice: currentProduct.price,
                financeInterestRate: currentProduct.financeInterestRate,
            });
            setCurrentProduct(null);
            setCurrentQuantity(1);
        }
    }
  };
  
  const handleAddService = () => {
    if (currentService) {
        appendService({
            serviceId: currentService.id,
            serviceName: currentService.name,
            price: currentService.price,
        });
        setCurrentService(null);
    }
  };

  const ProductCombobox = () => {
    const [open, setOpen] = useState(false);
    return (
       <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className={cn("w-full justify-between", !currentProduct && "text-muted-foreground")}>
              {currentProduct ? currentProduct.name : "Selecione um produto"}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
              <CommandInput placeholder="Digite para filtrar..." autoComplete="off" />
              <CommandList>
              <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
              <CommandGroup>
                  {allProducts.map((prod) => (
                  <CommandItem
                      value={prod.name}
                      key={prod.id}
                      onSelect={() => {
                          setCurrentProduct(prod);
                          setOpen(false);
                      }}
                  >
                      <Check className={cn("mr-2 h-4 w-4", currentProduct?.id === prod.id ? "opacity-100" : "opacity-0")} />
                      {prod.name}
                  </CommandItem>
                  ))}
              </CommandGroup>
              </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    )
  }

  const ServiceCombobox = () => {
    const [open, setOpen] = useState(false);
    return (
       <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className={cn("w-full justify-between", !currentService && "text-muted-foreground")}>
              {currentService ? currentService.name : "Selecione um serviço"}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
              <CommandInput placeholder="Digite para filtrar..." autoComplete="off" />
              <CommandList>
              <CommandEmpty>Nenhum serviço encontrado.</CommandEmpty>
              <CommandGroup>
                  {allServices.map((serv) => (
                  <CommandItem
                      value={serv.name}
                      key={serv.id}
                      onSelect={() => {
                          setCurrentService(serv);
                          setOpen(false);
                      }}
                  >
                      <Check className={cn("mr-2 h-4 w-4", currentService?.id === serv.id ? "opacity-100" : "opacity-0")} />
                      {serv.name}
                  </CommandItem>
                  ))}
              </CommandGroup>
              </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    )
  }

  const CustomerCombobox = () => {
    const [open, setOpen] = useState(false);
    const customerNameValue = form.watch('customerName');

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                >
                    {customerNameValue || "Selecione ou digite um cliente"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent 
                className="w-[--radix-popover-trigger-width] p-0"
                onCloseAutoFocus={(e) => {
                    const target = e.target as HTMLElement;
                    if (target && target.closest('[cmdk-item]')) {
                        e.preventDefault();
                    } else {
                         const currentInput = form.getValues('customerName');
                        if (currentInput && !allCustomers.some(c => c.name.toLowerCase() === currentInput.toLowerCase())) {
                            form.setValue('customerId', undefined);
                        }
                    }
                }}
            >
                <Command
                  filter={(value, search) => {
                    if (value.toLowerCase().includes(search.toLowerCase())) return 1
                    return 0
                  }}
                >
                    <CommandInput 
                      placeholder="Buscar cliente..."
                      value={customerNameValue}
                      onValueChange={(search) => {
                          form.setValue('customerName', search.toUpperCase());
                          if (!allCustomers.some(c => c.name === search.toUpperCase())) {
                              form.setValue('customerId', undefined);
                          }
                      }}
                      autoComplete="off"
                    />
                    <CommandList>
                        <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                        <CommandGroup>
                            {allCustomers.map((client) => (
                                <CommandItem
                                    key={client.id}
                                    value={client.name}
                                    onSelect={(currentValue) => {
                                        const selectedClient = allCustomers.find(c => c.name.toLowerCase() === currentValue.toLowerCase());
                                        if(selectedClient) {
                                            form.setValue('customerId', selectedClient.id);
                                            form.setValue('customerName', selectedClient.name);
                                            form.clearErrors('customerName');
                                        }
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            client.id === form.getValues("customerId") ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {client.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
  };
  
  const DatePicker = ({fieldName}: {fieldName: "date" | "firstDueDate"}) => {
    const getLabel = () => {
        switch(fieldName) {
            case 'date': return 'Data do Lançamento';
            case 'firstDueDate': return selectedPaymentMethod === 'Parcelado' ? 'Vencimento da 1ª Parcela' : 'Data de Vencimento';
            default: return 'Data';
        }
    }
    
    return (
       <FormField
        control={form.control}
        name={fieldName}
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel>{getLabel()}</FormLabel>
            <Popover modal={true}>
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
              <PopoverContent className="w-auto p-0 z-[51]" align="start">
                <Calendar
                  mode="single"
                  selected={field.value}
                  onSelect={field.onChange}
                  disabled={(date) =>
                    fieldName === 'date' ? (date > new Date() || date < new Date('1900-01-01')) : false
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        )}
      />
    )
  }

  const getPrintDialogTitle = () => {
    if (!transactionToPrint) return 'Gerar Documento';
    switch (transactionToPrint.subtype) {
      case 'Prestação de Serviço':
      case 'Serviço + Venda':
        return 'Gerar Ordem de Serviço';
      case 'Venda':
        return 'Gerar Comprovante de Venda';
      default:
        return 'Gerar Documento';
    }
  };

  const renderLoadingSkeleton = () => {
    const skeletonRows = Array.from({ length: 5 });
    const tableCols = activeTab === 'revenue' ? 6 : 5;
    
    return (
        <div className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <Skeleton className="h-10 w-full md:max-w-sm" />
            <Skeleton className="h-10 w-full md:w-52" />
            <Skeleton className="h-10 w-full md:w-60" />
            <Skeleton className="h-10 w-full md:w-36" />
          </div>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'revenue' | 'expense')}>
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="revenue">Receitas</TabsTrigger>
                <TabsTrigger value="expense">Despesas</TabsTrigger>
              </TabsList>
              <Skeleton className="h-10 w-44" />
            </div>
          </Tabs>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  {activeTab === 'revenue' && <TableHead>Status do Serviço</TableHead>}
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Data</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {skeletonRows.map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-5 w-[200px]" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-[100px]" /></TableCell>
                    {activeTab === 'revenue' && <TableCell><Skeleton className="h-5 w-[120px]" /></TableCell>}
                    <TableCell className="text-right"><Skeleton className="h-5 w-[80px] ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-[80px] ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      );
  }

  return (
    <>
    {isLoading ? (
        renderLoadingSkeleton()
      ) : (
        <>
          <div className="flex flex-col gap-4 mb-4 md:flex-row md:items-center">
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por descrição ou cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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
        </>
      )}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="subtype"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Lançamento</FormLabel>
                        <Select
                          onValueChange={(value: TransactionSubtype) => {
                            field.onChange(value);
                            form.setValue('items', []);
                            form.setValue('services', []);
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
                      name="customerName"
                      render={() => (
                        <FormItem className="flex flex-col pt-2">
                           <FormLabel>Cliente</FormLabel>
                           <CustomerCombobox />
                           <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
              </div>
              
              {(selectedSubtype === 'Prestação de Serviço' || selectedSubtype === 'Serviço + Venda') && (
                <Card>
                  <CardHeader className="px-6 pt-4 pb-2">
                      <CardTitle className="text-lg">Serviços do Lançamento</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                      <div className="flex flex-col md:flex-row gap-2 items-end">
                            <div className="flex-1 w-full">
                              <Label>Serviço</Label>
                              <ServiceCombobox />
                            </div>
                          <Button type="button" onClick={handleAddService}>Adicionar</Button>
                      </div>
                      <Separator />
                      <div className="space-y-2">
                          {services.map((service, index) => (
                              <div key={service.id} className="flex items-center justify-between p-2 rounded-md bg-muted">
                                  <p className="font-medium">{service.serviceName}</p>
                                  <div className='flex items-center'>
                                      <p className="font-mono">{formatCurrency(service.price)}</p>
                                      <Button type="button" variant="ghost" size="icon" className="ml-2 h-8 w-8" onClick={() => removeService(index)}>
                                          <Trash2 className="h-4 w-4 text-red-500" />
                                      </Button>
                                  </div>
                              </div>
                          ))}
                          {services.length === 0 && <p className="text-sm text-center text-muted-foreground">Nenhum serviço adicionado.</p>}
                      </div>
                  </CardContent>
                </Card>
              )}

              {(selectedSubtype === 'Venda' || selectedSubtype === 'Serviço + Venda') && (
                <Card>
                    <CardHeader className="px-6 pt-4 pb-2">
                        <CardTitle className="text-lg">Itens do Lançamento</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex flex-col md:flex-row gap-2 items-end">
                             <div className="flex-1 w-full">
                                <Label>Produto</Label>
                                <ProductCombobox />
                             </div>
                            <div className="w-full md:w-24">
                                <Label>Qtde.</Label>
                                <Input type="number" value={currentQuantity} onChange={e => setCurrentQuantity(e.target.value === '' ? '' : Number(e.target.value))} min="1" autoComplete="off"/>
                            </div>
                            <Button type="button" onClick={handleAddProduct}>Adicionar</Button>
                        </div>
                        <Separator />
                        <div className="space-y-2">
                            {items.map((item, index) => (
                                <div key={item.id} className="flex items-center justify-between p-2 rounded-md bg-muted">
                                    <div className="flex-1">
                                        <p className="font-medium">{item.productName}</p>
                                        <p className="text-sm text-muted-foreground">{item.quantity} x {formatCurrency(item.price)}</p>
                                    </div>
                                    <p className="font-mono">{formatCurrency(item.quantity * item.price)}</p>
                                    <Button type="button" variant="ghost" size="icon" className="ml-2 h-8 w-8" onClick={() => removeProduct(index)}>
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                </div>
                            ))}
                            {items.length === 0 && <p className="text-sm text-center text-muted-foreground">Nenhum produto adicionado.</p>}
                        </div>
                        <FormField control={form.control} name="items" render={({ fieldState }) => <FormMessage>{fieldState.error?.message || fieldState.error?.root?.message}</FormMessage>} />
                    </CardContent>
                </Card>
              )}
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Informação Adicional (Opcional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: Pagamento de aluguel ou detalhes do serviço"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        autoComplete="off"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedSubtype === 'Despesa' && (
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor Total</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={field.value === undefined ? '' : field.value}
                          onChange={(e) => field.onChange(e.target.valueAsNumber)}
                          autoComplete="off"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                  <DatePicker fieldName="date" />

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
                                  <Input
                                  type="number"
                                  placeholder="2"
                                  value={field.value === undefined ? '' : field.value}
                                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                                  autoComplete="off"
                                  />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      {(selectedPaymentMethod === 'Parcelado' || selectedPaymentMethod === 'A Prazo') && (
                        <DatePicker fieldName="firstDueDate" />
                      )}
                    </>
                  )}
                  {isServiceRelated && (
                    <FormField
                      control={form.control}
                      name="serviceStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status do Serviço</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione um status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {serviceStatusOptions.map(status => (
                                <SelectItem key={status} value={status}>{status}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
              </div>
              
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
            <DialogTitle>{getPrintDialogTitle()}</DialogTitle>
            <DialogDescription>
              Revise as informações e clique em imprimir para gerar o documento.
            </DialogDescription>
          </DialogHeader>
          <PrintableDocument
            transaction={transactionToPrint}
            customer={allCustomers.find(c => c.id === transactionToPrint?.customerId)}
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
