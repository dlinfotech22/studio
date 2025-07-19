
'use client';

import { useState, useEffect, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
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
} from 'firebase/firestore';
import {
  PlusCircle,
  Edit,
  Trash2,
  MoreHorizontal,
  Search,
  Users,
  UserX,
} from 'lucide-react';

import { type Customer, type Transaction, type Installment } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { db } from '@/lib/firebase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './ui/card';
import { Badge } from './ui/badge';
import { format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

const customerSchema = z.object({
  name: z.string().min(1, 'O nome é obrigatório.'),
  document: z.string().optional(),
  email: z.string().email('Email inválido.').optional().or(z.literal('')),
  phone: z.string().optional(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

type DelinquentCustomer = Customer & {
  lateTransactions: (Transaction & {
    lateInstallments: Installment[]
  })[];
  totalOwed: number;
}

const formatPhone = (value: string) => {
    if (!value) return "";
    value = value.replace(/\D/g, ''); 
    value = value.substring(0, 11); 
    if (value.length > 6) {
      value = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
    } else if (value.length > 2) {
      value = value.replace(/^(\d{2})(\d*)/, '($1) $2');
    } else if (value.length > 0) {
      value = value.replace(/^(\d*)/, '($1');
    }
    return value;
}

export function CustomersClient() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [delinquentCustomers, setDelinquentCustomers] = useState<DelinquentCustomer[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: '', document: '', email: '', phone: '' },
  });

  useEffect(() => {
    const currentCompanyId = sessionStorage.getItem('current-user-company-id');
    if (currentCompanyId) {
      setCompanyId(currentCompanyId);
      const fetchCustomers = async () => {
        const q = query(collection(db, 'customers'), where('companyId', '==', currentCompanyId));
        const snapshot = await getDocs(q);
        setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
      };
      const fetchTransactions = async () => {
        const q = query(collection(db, 'transactions'), where('companyId', '==', currentCompanyId), where('status', 'in', ['Pendente', 'Parcialmente Pago']));
        const snapshot = await getDocs(q);
        setTransactions(snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              date: (data.date as Timestamp).toDate(),
              installments: data.installments?.map((inst: any) => ({
                ...inst,
                dueDate: (inst.dueDate as Timestamp).toDate(),
              })),
            } as Transaction
        }));
      };
      fetchCustomers();
      fetchTransactions();
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'delinquent') {
      const today = new Date();
      today.setHours(0,0,0,0);
      
      const delinquents = customers.map(customer => {
        const lateTransactions = transactions
          .map(t => {
            const lateInstallments = (t.installments || []).filter(i => 
              i.status === 'Pendente' && new Date(i.dueDate as Date) < today
            );
            return { ...t, lateInstallments };
          })
          .filter(t => t.lateInstallments.length > 0);

        if (lateTransactions.length > 0) {
          const totalOwed = lateTransactions.reduce((acc, t) => acc + t.lateInstallments.reduce((sum, i) => sum + i.amount, 0), 0);
          return { ...customer, lateTransactions, totalOwed };
        }
        return null;
      }).filter((c): c is DelinquentCustomer => c !== null);

      setDelinquentCustomers(delinquents.sort((a,b) => b.totalOwed - a.totalOwed));
    }
  }, [customers, transactions, activeTab]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.document || '').includes(searchTerm)
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

  const totalCustomers = filteredCustomers.length;
  const totalPages = itemsPerPage > 0 ? Math.ceil(totalCustomers / itemsPerPage) : 1;
  const paginatedCustomers =
    itemsPerPage > 0
      ? filteredCustomers.slice(
          (currentPage - 1) * itemsPerPage,
          currentPage * itemsPerPage
        )
      : filteredCustomers;

  const onSubmit = async (data: CustomerFormValues) => {
    if (!companyId) return;
    const payload = { 
        ...data, 
        companyId, 
        name: data.name, 
        phone: data.phone?.replace(/\D/g, '') || '' 
    };
    try {
      if (editingCustomer) {
        await updateDoc(doc(db, 'customers', editingCustomer.id), payload);
        setCustomers(customers.map(c => c.id === editingCustomer.id ? { ...c, ...payload } : c));
        toast({ title: 'Sucesso!', description: 'Cliente atualizado.' });
      } else {
        const docRef = await addDoc(collection(db, 'customers'), payload);
        setCustomers([...customers, { id: docRef.id, ...payload }]);
        toast({ title: 'Sucesso!', description: 'Cliente adicionado.' });
      }
      setIsDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast({ title: 'Erro!', description: 'Não foi possível salvar o cliente.', variant: 'destructive' });
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    form.reset({
      ...customer,
      phone: formatPhone(customer.phone || ''),
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (customer: Customer) => {
    setCustomerToDelete(customer);
    setIsDeleteAlertOpen(true);
  };

  const confirmDelete = async () => {
    if (customerToDelete) {
      try {
          await deleteDoc(doc(db, 'customers', customerToDelete.id));
          setCustomers(customers.filter(c => c.id !== customerToDelete.id));
          toast({ title: 'Sucesso!', description: 'Cliente removido.' });
      } catch (error) {
          console.error(error);
          toast({ title: 'Erro!', description: 'Não foi possível remover o cliente.', variant: 'destructive' });
      }
    }
    setIsDeleteAlertOpen(false);
  };

  return (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="all"><Users className="mr-2 h-4 w-4" />Todos os Clientes</TabsTrigger>
          <TabsTrigger value="delinquent"><UserX className="mr-2 h-4 w-4" />Inadimplentes</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardContent className="p-0">
              <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
                <div className="relative w-full md:w-auto md:flex-grow md:max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Pesquisar por nome ou documento..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                    autoComplete="off"
                  />
                </div>
                <Button onClick={() => { setEditingCustomer(null); form.reset({ name: '', document: '', email: '', phone: '' }); setIsDialogOpen(true); }} className="w-full md:w-auto">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Adicionar Cliente
                </Button>
              </div>
              <div className="border-t">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead className="w-24 text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedCustomers.length > 0 ? (
                      paginatedCustomers.map((customer) => (
                        <TableRow key={customer.id}>
                          <TableCell className="font-medium">{customer.name}</TableCell>
                          <TableCell>{customer.document || '-'}</TableCell>
                          <TableCell>{customer.email || '-'}</TableCell>
                          <TableCell>{customer.phone ? formatPhone(customer.phone) : '-'}</TableCell>
                          <TableCell className="text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(customer)}>
                                  <Edit className="mr-2 h-4 w-4" /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDelete(customer)} className="text-red-500">
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
                          Nenhum cliente encontrado.
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
                Total de {totalCustomers} cliente(s).
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
            </CardFooter>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="delinquent">
            <div className="space-y-4">
            {delinquentCustomers.length > 0 ? (
                delinquentCustomers.map(customer => (
                    <Card key={customer.id}>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{customer.name}</CardTitle>
                            <Badge variant="destructive">Dívida Total: {formatCurrency(customer.totalOwed)}</Badge>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground mb-4">
                                {customer.document && `${customer.document} | `}
                                {customer.email && `${customer.email} | `}
                                {customer.phone}
                            </p>
                            <h4 className="font-semibold mb-2">Transações com Pendências:</h4>
                            <div className="space-y-2">
                            {customer.lateTransactions.map(transaction => (
                                <div key={transaction.id} className="p-3 border rounded-md bg-muted/50">
                                    <p className="font-medium">{transaction.description}</p>
                                    <Table className="mt-2">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Parcela</TableHead>
                                                <TableHead>Vencimento</TableHead>
                                                <TableHead className="text-right">Valor</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                        {transaction.lateInstallments.map(inst => (
                                            <TableRow key={inst.installmentNumber}>
                                                <TableCell>{inst.installmentNumber}</TableCell>
                                                <TableCell>{format(new Date(inst.dueDate as Date), 'dd/MM/yyyy')}</TableCell>
                                                <TableCell className="text-right font-mono">{formatCurrency(inst.amount)}</TableCell>
                                            </TableRow>
                                        ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ))}
                            </div>
                        </CardContent>
                    </Card>
                ))
            ) : (
                <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm p-8 text-center h-[400px]">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="w-16 h-16 text-muted-foreground" />
                    <h2 className="text-2xl font-semibold">Nenhum cliente inadimplente!</h2>
                    <p className="max-w-md mt-2 text-sm text-muted-foreground">
                      Todos os seus clientes estão com os pagamentos em dia.
                    </p>
                  </div>
                </div>
            )}
            </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCustomer ? 'Editar' : 'Adicionar'} Cliente</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo / Razão Social</FormLabel>
                  <FormControl><Input {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} autoComplete="off" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="document" render={({ field }) => (
                <FormItem>
                  <FormLabel>Documento (CPF/CNPJ) <span className="text-xs text-muted-foreground">(Opcional)</span></FormLabel>
                  <FormControl><Input {...field} autoComplete="off" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email <span className="text-xs text-muted-foreground">(Opcional)</span></FormLabel>
                  <FormControl><Input type="email" {...field} autoComplete="off" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone <span className="text-xs text-muted-foreground">(Opcional)</span></FormLabel>
                  <FormControl><Input {...field} onChange={(e) => field.onChange(formatPhone(e.target.value))} autoComplete="off" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="ghost">Cancelar</Button></DialogClose>
                <Button type="submit">{editingCustomer ? 'Salvar' : 'Adicionar'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita. O cliente será removido permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
