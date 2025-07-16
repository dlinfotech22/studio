
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
} from 'firebase/firestore';
import {
  PlusCircle,
  Edit,
  Trash2,
  MoreHorizontal,
  Building,
  Users,
  Search,
} from 'lucide-react';
import { type User, type CompanyInfo } from '@/lib/types';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';

const companySchema = z.object({
  name: z.string().min(1, 'Nome da empresa é obrigatório.'),
  document: z.string().min(1, 'Documento é obrigatório.'),
});
const initialAdminSchema = z.object({
  adminName: z.string().min(1, 'Nome do administrador é obrigatório.'),
  adminUsername: z.string().min(1, 'Usuário do administrador é obrigatório.'),
  adminPassword: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres.'),
});
const newCompanySchema = companySchema.merge(initialAdminSchema);

const userSchema = z.object({
  name: z.string().min(1, 'O nome é obrigatório.'),
  username: z.string().min(1, 'O nome de usuário é obrigatório.'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.').or(z.literal('')).optional(),
  role: z.enum(['system_admin', 'company_admin', 'user']),
});

type CompanyFormValues = z.infer<typeof newCompanySchema>;
type UserFormValues = z.infer<typeof userSchema>;

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
              companyUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.name}</TableCell>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell>
                    {user.role === 'company_admin' && 'Admin. da Empresa'}
                    {user.role === 'user' && 'Usuário'}
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
                        <DropdownMenuItem onClick={() => onEditUser(user, company.document)}>
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
              ))
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
  const [editingCompany, setEditingCompany] = useState<CompanyInfo | null>(null);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [isDeleteCompanyAlertOpen, setIsDeleteCompanyAlertOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<CompanyInfo | null>(null);
  const [isDeleteUserAlertOpen, setIsDeleteUserAlertOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        setUsers(allUsers);

        const companiesSnapshot = await getDocs(collection(db, 'companies'));
        const allCompanies = companiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompanyInfo));
        setCompanies(allCompanies);

        const currentUsername = sessionStorage.getItem('current-user');
        setCurrentUser(allUsers.find((u: User) => u.username === currentUsername) || null);
      } catch (error) {
        console.error('Failed to load data from Firestore', error);
      }
    };
    fetchData();
  }, []);

  const companyForm = useForm<CompanyFormValues>({
    resolver: zodResolver(newCompanySchema),
    defaultValues: { name: '', document: '', adminName: '', adminUsername: '', adminPassword: '' },
  });

  const userForm = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: '', username: '', password: '', role: 'user' },
  });

  const handleCompanySubmit = async (data: CompanyFormValues) => {
    try {
      if (editingCompany) {
        const companyRef = doc(db, 'companies', editingCompany.id);
        await updateDoc(companyRef, { name: data.name.toUpperCase() });
        setCompanies(companies.map(c => c.id === editingCompany.id ? { ...c, name: data.name.toUpperCase() } : c));
        toast({ title: 'Sucesso!', description: 'Empresa atualizada.' });
      } else {
        const companiesRef = collection(db, 'companies');
        const qCompany = query(companiesRef, where('document', '==', data.document));
        if (!(await getDocs(qCompany)).empty) {
            companyForm.setError('document', { message: 'Este documento já está em uso.' });
            return;
        }

        const usersRef = collection(db, 'users');
        const qUser = query(usersRef, where('username', '==', data.adminUsername.toLowerCase()));
         if (!(await getDocs(qUser)).empty) {
            companyForm.setError('adminUsername', { message: 'Este nome de usuário já está em uso.' });
            return;
        }

        const newCompany: Omit<CompanyInfo, 'id'> = { name: data.name.toUpperCase(), document: data.document, logo: '' };
        const companyDocRef = await addDoc(companiesRef, newCompany);

        const newAdmin: Omit<User, 'id'> = {
            name: data.adminName.toUpperCase(),
            username: data.adminUsername.toLowerCase(),
            password: data.adminPassword,
            companyId: newCompany.document,
            role: 'company_admin',
        };
        const userDocRef = await addDoc(usersRef, newAdmin);

        setCompanies([...companies, { id: companyDocRef.id, ...newCompany }]);
        setUsers([...users, { id: userDocRef.id, ...newAdmin }]);
        toast({ title: 'Sucesso!', description: 'Empresa e administrador criados.' });
      }
      setIsCompanyDialogOpen(false);
      setEditingCompany(null);
      companyForm.reset();
    } catch (error: any) {
       console.error("Failed to save company", error);
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
    if (editingUser?.role !== 'system_admin' && !activeCompanyId) return;

    try {
      if (editingUser) {
         let updatedUser: Partial<User> = {};
        if (editingUser.role === 'system_admin') {
             updatedUser = { ...(data.password && { password: data.password }) };
        } else {
            const submittedData = { ...data, username: data.username.toLowerCase(), name: data.name.toUpperCase() };
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('username', '==', submittedData.username));
            const snapshot = await getDocs(q);
            if (!snapshot.empty && snapshot.docs[0].id !== editingUser.id) {
                userForm.setError('username', { message: 'Este nome de usuário já existe.' });
                return;
            }
            updatedUser = {
                name: submittedData.name,
                username: submittedData.username,
                role: submittedData.role as 'company_admin' | 'user',
                ...(submittedData.password && { password: submittedData.password }),
            };
        }
        await updateDoc(doc(db, 'users', editingUser.id), updatedUser);
        setUsers(users.map(u => u.id === editingUser.id ? { ...u, ...updatedUser } : u));
        toast({ title: 'Sucesso!', description: 'Usuário atualizado.' });
      } else {
        if (!activeCompanyId) return;
        const submittedData = { ...data, username: data.username.toLowerCase(), name: data.name.toUpperCase() };
        if (!submittedData.password) {
            userForm.setError('password', { message: 'A senha é obrigatória.' });
            return;
        }
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('username', '==', submittedData.username));
        if (!(await getDocs(q)).empty) {
            userForm.setError('username', { message: 'Este nome de usuário já existe.' });
            return;
        }
        const newUser: Omit<User, 'id'> = { ...submittedData, companyId: activeCompanyId, password: submittedData.password, role: data.role as 'company_admin' | 'user' };
        const docRef = await addDoc(usersRef, newUser);
        setUsers([...users, { id: docRef.id, ...newUser }]);
        toast({ title: 'Sucesso!', description: 'Usuário adicionado.' });
      }
      setIsUserDialogOpen(false);
      setEditingUser(null);
      userForm.reset();
    } catch(error: any) {
       console.error("Failed to save user", error);
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

  const openCompanyDialog = (company: CompanyInfo | null) => {
    setEditingCompany(company);
    if (company) {
      companyForm.reset({ name: company.name, document: company.document, adminName: '', adminUsername: '', adminPassword: '' });
    } else {
      companyForm.reset({ name: '', document: '', adminName: '', adminUsername: '', adminPassword: '' });
    }
    setIsCompanyDialogOpen(true);
  };
  
  const openUserDialog = (user: User | null, companyId: string | undefined) => {
    setActiveCompanyId(companyId || null);
    setEditingUser(user);
    if (user) {
      userForm.reset({ name: user.name, username: user.username, password: '', role: user.role });
    } else {
      userForm.reset({ name: '', username: '', password: '', role: 'user' });
    }
    setIsUserDialogOpen(true);
  };

  const confirmDeleteCompany = async () => {
    if (!companyToDelete) return;
    try {
        const batch = writeBatch(db);
        batch.delete(doc(db, "companies", companyToDelete.id));

        const usersQuery = query(collection(db, "users"), where("companyId", "==", companyToDelete.document));
        const usersSnapshot = await getDocs(usersQuery);
        usersSnapshot.forEach(doc => batch.delete(doc.ref));

        const transactionsQuery = query(collection(db, "transactions"), where("companyId", "==", companyToDelete.document));
        const transactionsSnapshot = await getDocs(transactionsQuery);
        transactionsSnapshot.forEach(doc => batch.delete(doc.ref));
        
        const categoriesQuery = query(collection(db, "categories"), where("companyId", "==", companyToDelete.document));
        const categoriesSnapshot = await getDocs(categoriesQuery);
        categoriesSnapshot.forEach(doc => batch.delete(doc.ref));
        
        await batch.commit();

        setCompanies(companies.filter(c => c.id !== companyToDelete.id));
        setUsers(users.filter(u => u.companyId !== companyToDelete.document));

        toast({ title: 'Sucesso!', description: `A empresa ${companyToDelete.name} e todos os seus dados foram removidos.` });
    } catch (error: any) {
        console.error("Failed to delete company and its data", error);
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
     try {
        await deleteDoc(doc(db, 'users', userToDelete.id));
        setUsers(users.filter(u => u.id !== userToDelete.id));
        toast({ title: 'Sucesso!', description: 'Usuário removido.' });
     } catch (error: any) {
        console.error("Failed to delete user", error);
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
  
  const systemAdmins = users.filter((u) => u.role === 'system_admin');
  
  const filteredCompanies = companies.filter(
    (company) =>
      company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      company.document.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

  const totalCompanies = filteredCompanies.length;
  const totalPages = itemsPerPage > 0 ? Math.ceil(totalCompanies / itemsPerPage) : 1;
  
  const paginatedCompanies = itemsPerPage > 0 
      ? filteredCompanies.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
      : filteredCompanies;


  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Pesquisar empresa por nome ou documento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button onClick={() => openCompanyDialog(null)} className="w-full md:w-auto">
          <Building className="mr-2 h-4 w-4" />
          Adicionar Nova Empresa
        </Button>
      </div>
      <Accordion type="single" collapsible className="w-full" defaultValue="system-admins">
        <AccordionItem value="system-admins">
          <AccordionTrigger>
            <div className="flex items-center gap-4">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-semibold">Administradores do Sistema</p>
                <p className="text-sm text-muted-foreground font-normal">
                  Usuários com acesso total ao sistema.
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="bg-muted/40 p-4 rounded-md">
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
                  {systemAdmins.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.name}</TableCell>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell>ADMINISTRADOR DO SISTEMA</TableCell>
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openUserDialog(user, user.companyId)}>
                              <Edit className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </AccordionContent>
        </AccordionItem>
        {paginatedCompanies.map((company) => (
          <AccordionItem value={company.document} key={company.document}>
            <AccordionTrigger>
              <div className="flex justify-between items-center w-full">
                <div className="flex items-center gap-4">
                  <Building className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-semibold">{company.name}</p>
                    <p className="text-sm text-muted-foreground font-normal">{company.document}</p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <span className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-8 w-8 mr-2')}>
                        <MoreHorizontal className="h-4 w-4" />
                    </span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => openCompanyDialog(company)}>
                      <Edit className="mr-2 h-4 w-4" /> Editar Empresa
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => { setCompanyToDelete(company); setIsDeleteCompanyAlertOpen(true); }}
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
                    onDeleteUser={(user) => { setUserToDelete(user); setIsDeleteUserAlertOpen(true); }}
                    onAddUser={(companyId) => openUserDialog(null, companyId)}
                />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {totalCompanies > 0 && itemsPerPage > 0 && (
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


      <Dialog open={isCompanyDialogOpen} onOpenChange={setIsCompanyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCompany ? 'Editar' : 'Adicionar'} Empresa</DialogTitle>
          </DialogHeader>
          <Form {...companyForm}>
            <form onSubmit={companyForm.handleSubmit(handleCompanySubmit)} className="space-y-4">
              <FormField control={companyForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nome da Empresa</FormLabel><FormControl><Input {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={companyForm.control} name="document" render={({ field }) => (<FormItem><FormLabel>Documento (CNPJ/CPF)</FormLabel><FormControl><Input {...field} disabled={!!editingCompany} /></FormControl><FormMessage /></FormItem>)} />
              {!editingCompany && (
                <>
                    <p className="text-sm font-medium text-muted-foreground pt-4 border-t">Administrador Inicial</p>
                    <FormField control={companyForm.control} name="adminName" render={({ field }) => (<FormItem><FormLabel>Nome Completo do Admin</FormLabel><FormControl><Input {...field} onChange={e => field.onChange(e.target.value.toUpperCase())} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={companyForm.control} name="adminUsername" render={({ field }) => (<FormItem><FormLabel>Usuário do Admin</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={companyForm.control} name="adminPassword" render={({ field }) => (<FormItem><FormLabel>Senha do Admin</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </>
              )}
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="ghost">Cancelar</Button></DialogClose>
                <Button type="submit">{editingCompany ? 'Salvar' : 'Criar'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Editar' : 'Adicionar'} Usuário</DialogTitle>
          </DialogHeader>
          <Form {...userForm}>
            <form onSubmit={userForm.handleSubmit(handleUserSubmit)} className="space-y-4">
                <FormField control={userForm.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Nome Completo</FormLabel><FormControl><Input {...field} disabled={editingUser?.role === 'system_admin'} onChange={e => field.onChange(e.target.value.toUpperCase())} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={userForm.control} name="username" render={({ field }) => ( <FormItem><FormLabel>Nome de Usuário</FormLabel><FormControl><Input {...field} disabled={editingUser?.role === 'system_admin'} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={userForm.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Senha</FormLabel><FormControl><Input type="password" placeholder={editingUser ? "Deixe em branco para manter a atual" : "••••••••" } {...field} /></FormControl><FormMessage /></FormItem> )} />
                {editingUser?.role !== 'system_admin' && <FormField control={userForm.control} name="role" render={({ field }) => ( <FormItem><FormLabel>Nível de Acesso</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4"><FormItem className="flex items-center space-x-2"><RadioGroupItem value="user" /><Label>Usuário</Label></FormItem><FormItem className="flex items-center space-x-2"><RadioGroupItem value="company_admin" /><Label>Admin. da Empresa</Label></FormItem></RadioGroup></FormControl><FormMessage /></FormItem> )} />}
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="ghost">Cancelar</Button></DialogClose>
                <Button type="submit">{editingUser ? 'Salvar' : 'Adicionar'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteCompanyAlertOpen} onOpenChange={setIsDeleteCompanyAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação é irreversível. Todos os dados da empresa, incluindo usuários, transações e categorias, serão permanentemente removidos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteCompany}>Continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteUserAlertOpen} onOpenChange={setIsDeleteUserAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita e removerá o usuário.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteUser}>Continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
