'use client';

import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  PlusCircle,
  Edit,
  Trash2,
  MoreHorizontal,
  Building,
  Users,
} from 'lucide-react';
import { type User, type CompanyInfo } from '@/lib/types';
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
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';

const USERS_STORAGE_KEY = 'app-users';
const COMPANIES_STORAGE_KEY = 'app-companies';
const getTransactionsStorageKey = (id: string) => `app-transactions-${id}`;
const getCategoriesStorageKey = (id: string) => `app-categories-${id}`;


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
  role: z.enum(['company_admin', 'user']),
});

type CompanyFormValues = z.infer<typeof newCompanySchema>;
type UserFormValues = z.infer<typeof userSchema>;

export function SystemAdminClient() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<CompanyInfo[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Dialog states
  const [isCompanyDialogOpen, setIsCompanyDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyInfo | null>(null);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [isDeleteCompanyAlertOpen, setIsDeleteCompanyAlertOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<CompanyInfo | null>(null);
  const [isDeleteUserAlertOpen, setIsDeleteUserAlertOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  useEffect(() => {
    try {
      const storedUsers = localStorage.getItem(USERS_STORAGE_KEY);
      const storedCompanies = localStorage.getItem(COMPANIES_STORAGE_KEY);
      const currentUsername = localStorage.getItem('current-user');

      const allUsers = storedUsers ? JSON.parse(storedUsers) : [];
      setUsers(allUsers);
      setCompanies(storedCompanies ? JSON.parse(storedCompanies) : []);
      setCurrentUser(allUsers.find((u: User) => u.username === currentUsername) || null);
    } catch (error) {
      console.error('Failed to load data from localStorage', error);
    }
  }, []);

  const companyForm = useForm<CompanyFormValues>({
    resolver: zodResolver(newCompanySchema),
    defaultValues: {
      name: '',
      document: '',
      adminName: '',
      adminUsername: '',
      adminPassword: '',
    },
  });

  const userForm = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: '', username: '', password: '', role: 'user' },
  });

  const handleCompanySubmit = (data: CompanyFormValues) => {
    if (editingCompany) {
      // Edit logic
      const updatedCompanies = companies.map(c =>
        c.document === editingCompany.document ? { ...c, name: data.name } : c
      );
      setCompanies(updatedCompanies);
      localStorage.setItem(COMPANIES_STORAGE_KEY, JSON.stringify(updatedCompanies));
      toast({ title: 'Sucesso!', description: 'Empresa atualizada.' });
    } else {
      // Add logic
      if (companies.some(c => c.document === data.document)) {
        companyForm.setError('document', { message: 'Este documento já está em uso.' });
        return;
      }
      if (users.some(u => u.username.toLowerCase() === data.adminUsername.toLowerCase())) {
        companyForm.setError('adminUsername', { message: 'Este nome de usuário já está em uso.' });
        return;
      }

      const newCompany: CompanyInfo = {
        name: data.name,
        document: data.document,
        logo: '',
      };
      const newAdmin: User = {
        id: new Date().toISOString(),
        name: data.adminName.toUpperCase(),
        username: data.adminUsername.toLowerCase(),
        password: data.adminPassword,
        companyId: newCompany.document,
        role: 'company_admin',
      };

      const updatedCompanies = [...companies, newCompany];
      const updatedUsers = [...users, newAdmin];
      setCompanies(updatedCompanies);
      setUsers(updatedUsers);
      localStorage.setItem(COMPANIES_STORAGE_KEY, JSON.stringify(updatedCompanies));
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers));
      toast({ title: 'Sucesso!', description: 'Empresa e administrador criados.' });
    }
    setIsCompanyDialogOpen(false);
    setEditingCompany(null);
  };
  
  const handleUserSubmit = (data: UserFormValues) => {
    if (!activeCompanyId) return;

     const submittedData = {
      ...data,
      username: data.username.toLowerCase(),
      name: data.name.toUpperCase(),
    };

    if (editingUser) {
        if (editingUser.username.toLowerCase() !== submittedData.username.toLowerCase()) {
            if (users.some(u => u.username.toLowerCase() === submittedData.username.toLowerCase())) {
                userForm.setError('username', { message: 'Este nome de usuário já existe.' });
                return;
            }
        }
        const updatedUsers = users.map(u => u.id === editingUser.id ? { ...editingUser, name: submittedData.name, username: submittedData.username, role: submittedData.role, ... (submittedData.password && { password: submittedData.password }) } : u);
        setUsers(updatedUsers);
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers));
        toast({ title: 'Sucesso!', description: 'Usuário atualizado.' });
    } else {
        if (!submittedData.password) {
            userForm.setError('password', { message: 'A senha é obrigatória para novos usuários.' });
            return;
        }
        if (users.some(u => u.username.toLowerCase() === submittedData.username.toLowerCase())) {
            userForm.setError('username', { message: 'Este nome de usuário já existe.' });
            return;
        }
        const newUser: User = {
            id: new Date().toISOString(),
            name: submittedData.name,
            username: submittedData.username,
            password: submittedData.password,
            companyId: activeCompanyId,
            role: submittedData.role
        };
        const updatedUsers = [...users, newUser];
        setUsers(updatedUsers);
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers));
        toast({ title: 'Sucesso!', description: 'Usuário adicionado.' });
    }
    setIsUserDialogOpen(false);
    setEditingUser(null);
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
  
  const openUserDialog = (user: User | null, companyId: string) => {
    setActiveCompanyId(companyId);
    setEditingUser(user);
    if (user) {
      userForm.reset({ name: user.name, username: user.username, password: '', role: user.role});
    } else {
      userForm.reset({ name: '', username: '', password: '', role: 'user' });
    }
    setIsUserDialogOpen(true);
  };

  const confirmDeleteCompany = () => {
    if (!companyToDelete) return;

    const updatedCompanies = companies.filter(c => c.document !== companyToDelete.document);
    const updatedUsers = users.filter(u => u.companyId !== companyToDelete.document);

    setCompanies(updatedCompanies);
    setUsers(updatedUsers);

    localStorage.setItem(COMPANIES_STORAGE_KEY, JSON.stringify(updatedCompanies));
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers));
    localStorage.removeItem(getTransactionsStorageKey(companyToDelete.document));
    localStorage.removeItem(getCategoriesStorageKey(companyToDelete.document));

    toast({ title: 'Sucesso!', description: `A empresa ${companyToDelete.name} e todos os seus dados foram removidos.` });
    setIsDeleteCompanyAlertOpen(false);
    setCompanyToDelete(null);
  };

  const confirmDeleteUser = () => {
     if (!userToDelete) return;

      const updatedUsers = users.filter(u => u.id !== userToDelete.id);
      setUsers(updatedUsers);
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers));
      
      toast({ title: 'Sucesso!', description: 'Usuário removido.' });
      setIsDeleteUserAlertOpen(false);
      setUserToDelete(null);
  };

  const systemAdmins = users.filter((u) => u.role === 'system_admin');

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => openCompanyDialog(null)}>
          <Building className="mr-2 h-4 w-4" />
          Adicionar Nova Empresa
        </Button>
      </div>
      <Accordion
        type="single"
        collapsible
        className="w-full"
        defaultValue="system-admins"
      >
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {systemAdmins.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.name}</TableCell>
                      <TableCell className="font-medium">
                        {user.username}
                      </TableCell>
                      <TableCell>ADMINISTRADOR DO SISTEMA</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </AccordionContent>
        </AccordionItem>
        {companies.map((company) => (
          <AccordionItem value={company.document} key={company.document}>
            <AccordionTrigger>
              <div className="flex justify-between items-center w-full">
                <div className="flex items-center gap-4">
                  <Building className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-semibold">{company.name}</p>
                    <p className="text-sm text-muted-foreground font-normal">
                      {company.document}
                    </p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 mr-2"
                      asChild
                    >
                      <span>
                        <MoreHorizontal className="h-4 w-4" />
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => openCompanyDialog(company)}>
                      <Edit className="mr-2 h-4 w-4" /> Editar Empresa
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setCompanyToDelete(company);
                        setIsDeleteCompanyAlertOpen(true);
                      }}
                      className="text-red-500"
                      disabled={company.document === 'default-001'}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Deletar Empresa
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </AccordionTrigger>
            <AccordionContent className="bg-muted/40 p-4 rounded-md">
              <div className="flex justify-end mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openUserDialog(null, company.document)}
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
                    {users.filter((u) => u.companyId === company.document)
                      .length > 0 ? (
                      users
                        .filter((u) => u.companyId === company.document)
                        .map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>{user.name}</TableCell>
                            <TableCell className="font-medium">
                              {user.username}
                            </TableCell>
                            <TableCell>
                              {user.role === 'company_admin' &&
                                'Admin. da Empresa'}
                              {user.role === 'user' && 'Usuário'}
                            </TableCell>
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
                                    onClick={() =>
                                      openUserDialog(user, company.document)
                                    }
                                    disabled={user.id === currentUser?.id}
                                  >
                                    <Edit className="mr-2 h-4 w-4" /> Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setUserToDelete(user);
                                      setIsDeleteUserAlertOpen(true);
                                    }}
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
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Company Dialog */}
      <Dialog open={isCompanyDialogOpen} onOpenChange={setIsCompanyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCompany ? 'Editar' : 'Adicionar'} Empresa</DialogTitle>
          </DialogHeader>
          <Form {...companyForm}>
            <form onSubmit={companyForm.handleSubmit(handleCompanySubmit)} className="space-y-4">
              <FormField control={companyForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nome da Empresa</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
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
      
      {/* User Dialog */}
       <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Editar' : 'Adicionar'} Usuário</DialogTitle>
          </DialogHeader>
          <Form {...userForm}>
            <form onSubmit={userForm.handleSubmit(handleUserSubmit)} className="space-y-4">
                <FormField control={userForm.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Nome Completo</FormLabel><FormControl><Input {...field} onChange={e => field.onChange(e.target.value.toUpperCase())} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={userForm.control} name="username" render={({ field }) => ( <FormItem><FormLabel>Nome de Usuário</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={userForm.control} name="password" render={({ field }) => ( <FormItem><FormLabel>Senha</FormLabel><FormControl><Input type="password" placeholder={editingUser ? "Deixe em branco para manter a atual" : "••••••••" } {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={userForm.control} name="role" render={({ field }) => ( <FormItem><FormLabel>Nível de Acesso</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4"><FormItem className="flex items-center space-x-2"><RadioGroupItem value="user" /><Label>Usuário</Label></FormItem><FormItem className="flex items-center space-x-2"><RadioGroupItem value="company_admin" /><Label>Admin. da Empresa</Label></FormItem></RadioGroup></FormControl><FormMessage /></FormItem> )} />
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="ghost">Cancelar</Button></DialogClose>
                <Button type="submit">{editingUser ? 'Salvar' : 'Adicionar'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Company Alert */}
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

      {/* Delete User Alert */}
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
