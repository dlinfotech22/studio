
'use client';

import { useState, useEffect } from 'react';
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
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import {
  PlusCircle,
  Edit,
  Trash2,
  MoreHorizontal,
  Building,
  Users,
  Search,
  CalendarIcon,
  RefreshCw,
} from 'lucide-react';
import { type User, type CompanyInfo, type TransactionSubtype, type Transaction } from '@/lib/types';
import { Button, buttonVariants } from '@/components/ui/button';
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
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn, formatCurrency, formatDocument, maskDocument } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { format, addMonths, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Textarea } from './ui/textarea';

const availableSubtypes: TransactionSubtype[] = [
  'Prestação de Serviço',
  'Venda',
  'Serviço + Venda',
  'Receita Avulsa',
  'Despesa',
];

const companySchema = z.object({
  name: z.string().min(1, 'Nome da empresa é obrigatório.'),
  allowedSubtypes: z.array(z.string()).refine(value => value.some(item => item), {
    message: 'Você deve selecionar pelo menos um tipo de lançamento.',
  }),
  expiryDate: z.date().nullable().optional(),
  paymentNotification: z.string().optional(),
  monthlyFee: z.coerce.number().min(0, 'O valor não pode ser negativo.').optional(),
});

const editCompanySchema = companySchema;

const newCompanySchema = companySchema.extend({
    document: z.string().min(1, 'Documento é obrigatório.'),
    adminName: z.string().min(1, 'Nome do administrador é obrigatório.'),
    adminUsername: z.string().min(1, 'Usuário do administrador é obrigatório.'),
    adminPassword: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres.'),
});

const userSchema = z.object({
  name: z.string().min(1, 'O nome é obrigatório.'),
  username: z.string().min(1, 'O nome de usuário é obrigatório.'),
  password: z
    .string()
    .min(6, 'A senha deve ter pelo menos 6 caracteres.')
    .or(z.literal(''))
    .optional(),
  role: z.enum(['system_admin', 'company_admin', 'user']),
  hasDashboardAccess: z.boolean().default(false).optional(),
});

const renewalSchema = z.object({
  months: z.coerce.number().int().min(1, 'Deve ser pelo menos 1 mês.'),
  amount: z.coerce.number().positive('O valor deve ser positivo.'),
});

type NewCompanyFormValues = z.infer<typeof newCompanySchema>;
type EditCompanyFormValues = z.infer<typeof editCompanySchema>;
type UserFormValues = z.infer<typeof userSchema>;
type RenewalFormValues = z.infer<typeof renewalSchema>;

// Sub-component to manage user list within each accordion
function CompanyUserList({
  company,
  allUsers,
  currentUser,
  onEditUser,
  onDeleteUser,
  onAddUser,
}: {
  company: CompanyInfo;
  allUsers: User[];
  currentUser: User | null;
  onEditUser: (user: User, companyId: string) => void;
  onDeleteUser: (user: User) => void;
  onAddUser: (companyId: string) => void;
}) {
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const companyUsers = allUsers
    .filter((u) => u.companyId === company.document)
    .filter(
      (u) =>
        u.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        u.username.toLowerCase().includes(userSearchTerm.toLowerCase())
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Pesquisar usuário por nome..."
            value={userSearchTerm}
            onChange={(e) => setUserSearchTerm(e.target.value)}
            className="pl-8"
            onClick={(e) => e.stopPropagation()}
            autoComplete="off"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onAddUser(company.document);
          }}
        >
          <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Usuário
        </Button>
      </div>

      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome Completo</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Nível</TableHead>
              <TableHead className="w-24 text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companyUsers.length > 0 ? (
              companyUsers.map((user) => {
                const isAdmin = user.role === 'company_admin';
                return (
                  <TableRow key={user.id}>
                    <TableCell className={cn(isAdmin && 'font-semibold text-primary')}>{user.name}</TableCell>
                    <TableCell className={cn("font-medium", isAdmin && 'font-semibold text-primary')}>{user.username}</TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <Badge variant="outline">Admin. da Empresa</Badge>
                      ) : (
                        'Usuário'
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => onEditUser(user, company.document)}
                          >
                            <Edit className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onDeleteUser(user)}
                            className="text-red-500"
                            disabled={user.id === currentUser?.id}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Deletar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  Nenhum usuário encontrado para esta empresa.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function SystemAdminClient() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<CompanyInfo[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [isCompanyDialogOpen, setIsCompanyDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyInfo | null>(
    null
  );
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [isDeleteCompanyAlertOpen, setIsDeleteCompanyAlertOpen] =
    useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<CompanyInfo | null>(
    null
  );
  const [isDeleteUserAlertOpen, setIsDeleteUserAlertOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [companySearchTerm, setCompanySearchTerm] = useState('');
  const [adminSearchTerm, setAdminSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('companies');

  const [isRenewalDialogOpen, setIsRenewalDialogOpen] = useState(false);
  const [companyToRenew, setCompanyToRenew] = useState<CompanyInfo | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const allUsers = usersSnapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as User)
        );
        setUsers(allUsers);

        const companiesSnapshot = await getDocs(collection(db, 'companies'));
        const allCompanies = companiesSnapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as CompanyInfo)
        );
        setCompanies(allCompanies);

        const currentUsername = sessionStorage.getItem('current-user');
        setCurrentUser(
          allUsers.find((u: User) => u.username === currentUsername) || null
        );
      } catch (error) {
        console.error('Failed to load data from Firestore', error);
      }
    };
    fetchData();
  }, []);

  const companyForm = useForm<NewCompanyFormValues>({
    resolver: zodResolver(editingCompany ? editCompanySchema : newCompanySchema),
  });

  const userForm = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: '', username: '', password: '', role: 'user', hasDashboardAccess: false },
  });

  const renewalForm = useForm<RenewalFormValues>({
    resolver: zodResolver(renewalSchema),
    defaultValues: { months: 1, amount: 0 },
  });

  useEffect(() => {
    if (isCompanyDialogOpen) {
        const resolver = zodResolver(editingCompany ? editCompanySchema : newCompanySchema);
        const defaultValues = editingCompany
            ? {
                name: editingCompany.name,
                document: formatDocument(editingCompany.document),
                allowedSubtypes: editingCompany.allowedSubtypes || [],
                expiryDate: editingCompany.expiryDate ? (editingCompany.expiryDate as Timestamp).toDate() : undefined,
                paymentNotification: editingCompany.paymentNotification || '',
                monthlyFee: editingCompany.monthlyFee || undefined,
              }
            : {
                name: '',
                document: '',
                adminName: '',
                adminUsername: '',
                adminPassword: '',
                allowedSubtypes: [],
                expiryDate: undefined,
                paymentNotification: '',
                monthlyFee: undefined,
              };
        companyForm.reset(defaultValues, {
            // @ts-ignore
            resolver,
        });
    }
  }, [isCompanyDialogOpen, editingCompany, companyForm]);

  useEffect(() => {
    if (companyToRenew) {
      renewalForm.reset({ months: 1, amount: companyToRenew.monthlyFee || 0 });
    }
  }, [companyToRenew, renewalForm]);


  const handleCompanySubmit = async (data: NewCompanyFormValues | EditCompanyFormValues) => {
    try {
      if (editingCompany) {
         const validatedData = editCompanySchema.parse(data);
        const companyRef = doc(db, 'companies', editingCompany.id);
        const payload: Partial<CompanyInfo> = {
          name: validatedData.name,
          allowedSubtypes: validatedData.allowedSubtypes,
          expiryDate: validatedData.expiryDate ? Timestamp.fromDate(validatedData.expiryDate) : undefined,
          paymentNotification: validatedData.paymentNotification,
          monthlyFee: validatedData.monthlyFee,
        };
        await updateDoc(companyRef, payload);
        setCompanies(
          companies.map((c) =>
            c.id === editingCompany.id
              ? ({ ...c, ...payload, expiryDate: payload.expiryDate } as CompanyInfo)
              : c
          )
        );
        toast({ title: 'Sucesso!', description: 'Empresa atualizada.' });
      } else {
        const validatedData = newCompanySchema.parse(data);
        const document = validatedData.document.replace(/\D/g, '');
        const companiesRef = collection(db, 'companies');
        const qCompany = query(
          companiesRef,
          where('document', '==', document)
        );
        if (!(await getDocs(qCompany)).empty) {
          companyForm.setError('document', {
            message: 'Este documento já está em uso.',
          });
          return;
        }

        const usersRef = collection(db, 'users');
        const qUser = query(
          usersRef,
          where('username', '==', validatedData.adminUsername.toLowerCase())
        );
        if (!(await getDocs(qUser)).empty) {
          companyForm.setError('adminUsername', {
            message: 'Este nome de usuário já está em uso.',
          });
          return;
        }

        const newCompany: Omit<CompanyInfo, 'id'> = {
          name: validatedData.name,
          document: document,
          logo: '',
          allowedSubtypes: validatedData.allowedSubtypes,
          transactionCounter: 0,
          expiryDate: validatedData.expiryDate ? Timestamp.fromDate(validatedData.expiryDate) : undefined,
          paymentNotification: validatedData.paymentNotification,
          monthlyFee: validatedData.monthlyFee,
        };
        const companyDocRef = await addDoc(companiesRef, newCompany);

        const newAdmin: Omit<User, 'id'> = {
          name: validatedData.adminName,
          username: validatedData.adminUsername.toLowerCase(),
          password: validatedData.adminPassword,
          companyId: newCompany.document,
          role: 'company_admin',
          hasDashboardAccess: true, // Company admin always has dashboard access
        };
        const userDocRef = await addDoc(usersRef, newAdmin);

        setCompanies([...companies, { id: companyDocRef.id, ...newCompany }]);
        setUsers([...users, { id: userDocRef.id, ...newAdmin }]);
        toast({
          title: 'Sucesso!',
          description: 'Empresa e administrador criados.',
        });
      }
      setIsCompanyDialogOpen(false);
      setEditingCompany(null);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        console.error("Validation error:", error.flatten().fieldErrors);
        toast({
          title: 'Erro de Validação',
          description: 'Por favor, verifique os campos do formulário.',
          variant: 'destructive',
        });
        return;
      }
      console.error('Failed to save company', error);
      toast({
        title: 'Erro!',
        description:
          error.code === 'permission-denied'
            ? 'Permissão negada para salvar a empresa.'
            : 'Não foi possível salvar a empresa.',
        variant: 'destructive',
      });
    }
  };

  const handleUserSubmit = async (data: UserFormValues) => {
    const isNewSysAdmin = !editingUser && data.role === 'system_admin';
    const hasDashboardAccess = data.role === 'company_admin' || data.role === 'system_admin' ? true : data.hasDashboardAccess;

    if (!isNewSysAdmin && !activeCompanyId && !editingUser) {
      toast({
        title: 'Erro de validação',
        description: 'ID da empresa é necessário para novos usuários.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const submittedData = {
        ...data,
        username: data.username.toLowerCase(),
        name: data.name,
        hasDashboardAccess: hasDashboardAccess,
      };
      
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', submittedData.username));
      const querySnapshot = await getDocs(q);
      const isUsernameTaken = !querySnapshot.empty && (editingUser ? querySnapshot.docs[0].id !== editingUser.id : true);

      if (isUsernameTaken) {
        userForm.setError('username', { message: 'Este nome de usuário já existe.' });
        return;
      }
      
      if (editingUser) {
        let payload: Partial<User> = {
          name: submittedData.name,
          username: submittedData.username,
          role: submittedData.role,
          hasDashboardAccess: submittedData.hasDashboardAccess,
        };
        if (submittedData.password) {
          payload.password = submittedData.password;
        }
        if (editingUser.role === 'system_admin') {
           delete payload.role;
           delete payload.hasDashboardAccess;
        }
        await updateDoc(doc(db, 'users', editingUser.id), payload);
        setUsers(
          users.map((u) => (u.id === editingUser.id ? { ...u, ...payload } : u))
        );
        toast({ title: 'Sucesso!', description: 'Usuário atualizado.' });
      } else {
        if (!submittedData.password) {
          userForm.setError('password', { message: 'A senha é obrigatória.' });
          return;
        }

        let newUserPayload: Omit<User, 'id'>;
        if (isNewSysAdmin) {
          newUserPayload = {
            name: submittedData.name,
            username: submittedData.username,
            password: submittedData.password,
            role: 'system_admin',
            hasDashboardAccess: true,
          };
        } else {
          newUserPayload = {
            name: submittedData.name,
            username: submittedData.username,
            password: submittedData.password,
            companyId: activeCompanyId!,
            role: submittedData.role as 'company_admin' | 'user',
            hasDashboardAccess: submittedData.hasDashboardAccess,
          };
        }

        const docRef = await addDoc(collection(db, 'users'), newUserPayload);
        setUsers([...users, { id: docRef.id, ...newUserPayload }]);
        toast({ title: 'Sucesso!', description: 'Usuário adicionado.' });
      }
      setIsUserDialogOpen(false);
      setEditingUser(null);
      userForm.reset();
      setActiveCompanyId(null);
    } catch (error: any) {
      console.error('Failed to save user', error);
      toast({
        title: 'Erro!',
        description:
          error.code === 'permission-denied'
            ? 'Permissão negada para salvar o usuário.'
            : 'Não foi possível salvar o usuário.',
        variant: 'destructive',
      });
    }
  };

  const handleRenewalSubmit = async (data: RenewalFormValues) => {
    if (!companyToRenew || !currentUser?.companyId) return;

    try {
        const batch = writeBatch(db);

        // 1. Update company expiry date
        const companyRef = doc(db, 'companies', companyToRenew.id);
        const currentExpiry = companyToRenew.expiryDate ? (companyToRenew.expiryDate as Timestamp).toDate() : new Date();
        const newExpiryDate = addMonths(currentExpiry > new Date() ? currentExpiry : new Date(), data.months);
        batch.update(companyRef, { expiryDate: Timestamp.fromDate(newExpiryDate) });
        
        // 2. Create revenue transaction for system admin's company
        const sysAdminCompanyId = currentUser.companyId; // Assuming admin is linked to a company
        const transactionsRef = collection(db, 'transactions');
        const revenuePayload: Omit<Transaction, 'id'> = {
            amount: data.amount,
            companyId: sysAdminCompanyId,
            date: Timestamp.now(),
            description: `RENOVAÇÃO DE ASSINATURA - ${companyToRenew.name}`,
            status: 'Pago',
            subtype: 'Receita Avulsa',
            type: 'revenue',
        };
        const newTransactionRef = doc(transactionsRef);
        batch.set(newTransactionRef, revenuePayload);

        await batch.commit();

        setCompanies(companies.map(c => c.id === companyToRenew.id ? { ...c, expiryDate: newExpiryDate } : c));
        toast({ title: 'Sucesso!', description: `Assinatura de ${companyToRenew.name} renovada por ${data.months} mes(es).`});
    } catch(e: any) {
        console.error("Failed to renew subscription", e);
        toast({title: 'Erro!', description: 'Não foi possível renovar a assinatura.', variant: 'destructive'});
    } finally {
        setIsRenewalDialogOpen(false);
        setCompanyToRenew(null);
    }
  };
  
  const openCompanyDialog = (company: CompanyInfo | null) => {
    setEditingCompany(company);
    setIsCompanyDialogOpen(true);
  };
  
  const openRenewalDialog = (company: CompanyInfo) => {
    setCompanyToRenew(company);
    setIsRenewalDialogOpen(true);
  }
  
  const openNewSysAdminDialog = () => {
    setActiveCompanyId(null);
    setEditingUser(null);
    userForm.reset({ name: '', username: '', password: '', role: 'system_admin', hasDashboardAccess: true });
    setIsUserDialogOpen(true);
  }

  const openUserDialog = (
    user: User | null,
    companyId: string | undefined
  ) => {
    setActiveCompanyId(companyId || null);
    setEditingUser(user);
    if (user) {
      userForm.reset({
        name: user.name,
        username: user.username,
        password: '',
        role: user.role,
        hasDashboardAccess: user.hasDashboardAccess || user.role === 'company_admin' || user.role === 'system_admin'
      });
    } else {
      userForm.reset({ name: '', username: '', password: '', role: 'user', hasDashboardAccess: false });
    }
    setIsUserDialogOpen(true);
  };
  
  const confirmDeleteCompany = async () => {
    if (!companyToDelete) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'companies', companyToDelete.id));

      const usersQuery = query(
        collection(db, 'users'),
        where('companyId', '==', companyToDelete.document)
      );
      const usersSnapshot = await getDocs(usersQuery);
      usersSnapshot.forEach((doc) => batch.delete(doc.ref));

      const transactionsQuery = query(
        collection(db, 'transactions'),
        where('companyId', '==', companyToDelete.document)
      );
      const transactionsSnapshot = await getDocs(transactionsQuery);
      transactionsSnapshot.forEach((doc) => batch.delete(doc.ref));

      const productsQuery = query(
        collection(db, 'products'),
        where('companyId', '==', companyToDelete.document)
      );
      const productsSnapshot = await getDocs(productsQuery);
      productsSnapshot.forEach((doc) => batch.delete(doc.ref));


      await batch.commit();

      setCompanies(companies.filter((c) => c.id !== companyToDelete.id));
      setUsers(users.filter((u) => u.companyId !== companyToDelete.document));

      toast({
        title: 'Sucesso!',
        description: `A empresa ${companyToDelete.name} e todos os seus dados foram removidos.`,
      });
    } catch (error: any) {
      console.error('Failed to delete company and its data', error);
      toast({
        title: 'Erro!',
        description:
          error.code === 'permission-denied'
            ? 'Permissão negada para remover a empresa.'
            : 'Não foi possível remover a empresa.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleteCompanyAlertOpen(false);
      setCompanyToDelete(null);
    }
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    if (userToDelete.role === 'system_admin') {
         toast({ title: 'Ação não permitida', description: 'O administrador do sistema não pode ser removido por aqui.', variant: 'destructive'});
         setIsDeleteUserAlertOpen(false);
         setUserToDelete(null);
         return;
    }
    try {
      await deleteDoc(doc(db, 'users', userToDelete.id));
      setUsers(users.filter((u) => u.id !== userToDelete.id));
      toast({ title: 'Sucesso!', description: 'Usuário removido.' });
    } catch (error: any) {
      console.error('Failed to delete user', error);
      toast({
        title: 'Erro!',
        description:
          error.code === 'permission-denied'
            ? 'Permissão negada para remover o usuário.'
            : 'Não foi possível remover o usuário.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleteUserAlertOpen(false);
      setUserToDelete(null);
    }
  };

  const filteredSystemAdmins = users
    .filter((u) => u.role === 'system_admin')
    .filter(
      (u) =>
        u.name.toLowerCase().includes(adminSearchTerm.toLowerCase()) ||
        u.username.toLowerCase().includes(adminSearchTerm.toLowerCase())
    );

  const filteredCompanies = companies.filter(
    (company) =>
      company.name.toLowerCase().includes(companySearchTerm.toLowerCase()) ||
      company.document.toLowerCase().includes(companySearchTerm.toLowerCase())
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [companySearchTerm, itemsPerPage]);

  const totalCompanies = filteredCompanies.length;
  const totalPages =
    itemsPerPage > 0 ? Math.ceil(totalCompanies / itemsPerPage) : 1;

  const paginatedCompanies =
    itemsPerPage > 0
      ? filteredCompanies.slice(
          (currentPage - 1) * itemsPerPage,
          currentPage * itemsPerPage
        )
      : filteredCompanies;
  
  const selectedRole = userForm.watch('role');

  return (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
        <TabsList>
          <TabsTrigger value="companies">Empresas</TabsTrigger>
          <TabsTrigger value="admins">Administradores</TabsTrigger>
        </TabsList>
        <TabsContent value="companies" className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Pesquisar empresa por nome ou documento..."
                value={companySearchTerm}
                onChange={(e) => setCompanySearchTerm(e.target.value)}
                className="pl-8"
                autoComplete="off"
              />
            </div>
            <Button
              onClick={() => openCompanyDialog(null)}
              className="w-full md:w-auto"
            >
              <Building className="mr-2 h-4 w-4" />
              Adicionar Nova Empresa
            </Button>
          </div>

          <Accordion type="single" collapsible className="w-full">
            {paginatedCompanies.map((company) => (
              <AccordionItem value={company.document} key={company.document}>
                <AccordionTrigger>
                  <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-4 text-left">
                      <Building className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-semibold">{company.name}</p>
                        <p className="text-sm text-muted-foreground font-normal">
                          {maskDocument(company.document)}
                          {company.monthlyFee && ` | Mensalidade: ${formatCurrency(company.monthlyFee)}`}
                        </p>
                        {company.expiryDate && (
                            <p className={cn(
                                "text-xs font-normal mt-1",
                                (company.expiryDate as Timestamp).toDate() < startOfDay(new Date()) 
                                    ? "font-semibold text-red-500" 
                                    : "text-muted-foreground"
                            )}>
                                Vence em: {format((company.expiryDate as Timestamp).toDate(), 'dd/MM/yyyy')}
                            </p>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        asChild
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span
                          className={cn(
                            buttonVariants({ variant: 'ghost', size: 'icon' }),
                            'h-8 w-8 mr-2'
                          )}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
                          onClick={() => openCompanyDialog(company)}
                        >
                          <Edit className="mr-2 h-4 w-4" /> Editar Empresa
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openRenewalDialog(company)}>
                            <RefreshCw className="mr-2 h-4 w-4" /> Renovar Assinatura
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setCompanyToDelete(company);
                            setIsDeleteCompanyAlertOpen(true);
                          }}
                          className="text-red-500"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Deletar Empresa
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="bg-muted/40 p-4 rounded-md">
                  <CompanyUserList
                    company={company}
                    allUsers={users}
                    currentUser={currentUser}
                    onEditUser={openUserDialog}
                    onDeleteUser={(user) => {
                      setUserToDelete(user);
                      setIsDeleteUserAlertOpen(true);
                    }}
                    onAddUser={(companyId) => openUserDialog(null, companyId)}
                  />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {totalCompanies > 0 && itemsPerPage > 0 && totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Total de {totalCompanies} empresa(s).
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
        </TabsContent>

        <TabsContent value="admins" className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Pesquisar administrador..."
                value={adminSearchTerm}
                onChange={(e) => setAdminSearchTerm(e.target.value)}
                className="pl-8"
                autoComplete="off"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={openNewSysAdminDialog}
            >
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Administrador
            </Button>
          </div>
          <div className="rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome Completo</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Nível</TableHead>
                  <TableHead className="w-24 text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSystemAdmins.length > 0 ? (
                  filteredSystemAdmins.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.name}</TableCell>
                      <TableCell className="font-medium">
                        {user.username}
                      </TableCell>
                      <TableCell>ADMINISTRADOR DO SISTEMA</TableCell>
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => openUserDialog(user, undefined)}
                            >
                              <Edit className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      Nenhum administrador encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isCompanyDialogOpen} onOpenChange={(isOpen) => {
          if (!isOpen) setEditingCompany(null);
          setIsCompanyDialogOpen(isOpen);
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCompany ? 'Editar' : 'Adicionar'} Empresa
            </DialogTitle>
          </DialogHeader>
          <Form {...companyForm}>
            <form
              onSubmit={companyForm.handleSubmit(handleCompanySubmit)}
              className="space-y-4"
            >
              <FormField
                control={companyForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Empresa</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
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
                control={companyForm.control}
                name="document"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Documento (CNPJ/CPF)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={!!editingCompany}
                        onChange={(e) => field.onChange(formatDocument(e.target.value))}
                        autoComplete="off"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={companyForm.control}
                name="monthlyFee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor da Mensalidade (R$)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="100.00"
                        autoComplete="off"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={companyForm.control}
                name="allowedSubtypes"
                render={() => (
                  <FormItem>
                    <div className="mb-4">
                      <FormLabel className="text-base">
                        Tipos de Lançamento Permitidos
                      </FormLabel>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {availableSubtypes.map((item) => (
                        <FormField
                          key={item}
                          control={companyForm.control}
                          name="allowedSubtypes"
                          render={({ field }) => (
                            <FormItem
                              key={item}
                              className="flex flex-row items-start space-x-3 space-y-0"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(item)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...(field.value || []), item])
                                      : field.onChange(
                                          (field.value || []).filter(
                                            (value) => value !== item
                                          )
                                        );
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal">
                                {item}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={companyForm.control}
                name="expiryDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data de Vencimento</FormLabel>
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
                              <span>Selecione uma data</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[51]" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={(date) => field.onChange(date || null)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={companyForm.control}
                name="paymentNotification"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mensagem de Pagamento/Bloqueio</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Ex: Sua assinatura venceu. Para renovar, acesse: link.pagamento.com"
                        {...field}
                        autoComplete="off"
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!editingCompany && (
                <>
                  <p className="text-sm font-medium text-muted-foreground pt-4 border-t">
                    Administrador Inicial
                  </p>
                  <FormField
                    control={companyForm.control}
                    name="adminName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo do Admin</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
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
                    control={companyForm.control}
                    name="adminUsername"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Usuário do Admin</FormLabel>
                        <FormControl>
                          <Input {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} autoComplete="off" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={companyForm.control}
                    name="adminPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha do Admin</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} autoComplete="off" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">
                    Cancelar
                  </Button>
                </DialogClose>
                <Button type="submit">
                  {editingCompany ? 'Salvar' : 'Criar'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isRenewalDialogOpen} onOpenChange={(isOpen) => {
        if (!isOpen) setCompanyToRenew(null);
        setIsRenewalDialogOpen(isOpen);
      }}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Renovar Assinatura</DialogTitle>
                <DialogDescription>
                    Confirme o pagamento para renovar a assinatura da empresa <span className='font-bold'>{companyToRenew?.name}</span>.
                </DialogDescription>
            </DialogHeader>
            <Form {...renewalForm}>
                <form onSubmit={renewalForm.handleSubmit(handleRenewalSubmit)} className="space-y-4">
                    <FormField control={renewalForm.control} name="months" render={({field}) => (
                        <FormItem>
                            <FormLabel>Meses Pagos</FormLabel>
                            <FormControl>
                                <Input type="number" min="1" {...field} autoComplete="off" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={renewalForm.control} name="amount" render={({field}) => (
                        <FormItem>
                            <FormLabel>Valor Recebido (R$)</FormLabel>
                            <FormControl>
                                <Input type="number" {...field} autoComplete="off" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="ghost">Cancelar</Button></DialogClose>
                        <Button type="submit">Confirmar Renovação</Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Editar' : 'Adicionar'} Usuário
            </DialogTitle>
          </DialogHeader>
          <Form {...userForm}>
            <form
              onSubmit={userForm.handleSubmit(handleUserSubmit)}
              className="space-y-4"
            >
              <FormField
                control={userForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
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
                control={userForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome de Usuário</FormLabel>
                    <FormControl>
                      <Input {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} autoComplete="off" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={userForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={
                          editingUser
                            ? 'Deixe em branco para manter a atual'
                            : '••••••••'
                        }
                        {...field}
                        autoComplete="off"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={userForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nível de Acesso</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex gap-4"
                        disabled={editingUser?.role === 'system_admin'}
                      >
                         {userForm.getValues('role') === 'system_admin' ? (
                          <FormItem className="flex items-center space-x-2">
                              <RadioGroupItem value="system_admin" />
                              <Label>Admin. do Sistema</Label>
                          </FormItem>
                         ) : (
                          <>
                              <FormItem className="flex items-center space-x-2">
                              <RadioGroupItem value="user" />
                              <Label>Usuário</Label>
                              </FormItem>
                              <FormItem className="flex items-center space-x-2">
                              <RadioGroupItem value="company_admin" />
                              <Label>Admin. da Empresa</Label>
                              </FormItem>
                          </>
                         )}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {selectedRole !== 'system_admin' && (
                <FormField
                  control={userForm.control}
                  name="hasDashboardAccess"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={selectedRole === 'company_admin'}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Acesso ao Dashboard
                        </FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              )}
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">
                    Cancelar
                  </Button>
                </DialogClose>
                <Button type="submit">
                  {editingUser ? 'Salvar' : 'Adicionar'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={isDeleteCompanyAlertOpen}
        onOpenChange={setIsDeleteCompanyAlertOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Todos os dados da empresa, incluindo
              usuários, transações, e produtos, serão permanentemente
              removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteCompany}>
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isDeleteUserAlertOpen}
        onOpenChange={setIsDeleteUserAlertOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita e removerá o usuário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteUser}>
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
