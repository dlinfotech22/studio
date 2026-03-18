
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
} from 'firebase/firestore';
import { PlusCircle, Edit, Trash2, MoreHorizontal, Search } from 'lucide-react';
import { type User } from '@/lib/types';
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
import { Card, CardContent, CardFooter } from './ui/card';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { db } from '@/lib/firebase';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Checkbox } from './ui/checkbox';

const userSchema = z.object({
  name: z.string().min(1, 'O nome é obrigatório.'),
  username: z.string().min(1, 'O nome de usuário é obrigatório.'),
  password: z
    .string()
    .min(6, 'A senha deve ter pelo menos 6 caracteres.')
    .or(z.literal(''))
    .optional(),
  role: z.enum(['company_admin', 'user']),
});

type UserFormValues = z.infer<typeof userSchema>;

export function AccessManagementClient() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  useEffect(() => {
    const fetchUsers = async (currentCompanyId: string) => {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('companyId', '==', currentCompanyId));
        const querySnapshot = await getDocs(q);
        const companyUsers = querySnapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as User)
        );
        setUsers(companyUsers);

        const currentUsername = sessionStorage.getItem('current-user');
        const qCurrentUser = query(
          usersRef,
          where('username', '==', currentUsername)
        );
        const currentUserSnapshot = await getDocs(qCurrentUser);
        if (!currentUserSnapshot.empty) {
          setCurrentUser({
            id: currentUserSnapshot.docs[0].id,
            ...currentUserSnapshot.docs[0].data(),
          } as User);
        }
      } catch (error) {
        console.error('Failed to fetch users:', error);
      }
    };

    const currentCompanyId = sessionStorage.getItem('current-user-company-id');
    if (currentCompanyId) {
      setCompanyId(currentCompanyId);
      fetchUsers(currentCompanyId);
    }
  }, []);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: '',
      username: '',
      password: '',
      role: 'user',
    },
  });

  const onSubmit = async (data: UserFormValues) => {
    if (!companyId) return;

    const submittedData = {
      ...data,
      username: data.username.toLowerCase(),
      name: data.name,
      hasDashboardAccess: data.role === 'company_admin',
    };

    try {
      const usersRef = collection(db, 'users');
      // Check for existing username
      const q = query(usersRef, where('username', '==', submittedData.username));
      const querySnapshot = await getDocs(q);
      const existingUser =
        !querySnapshot.empty && querySnapshot.docs[0].id !== editingUser?.id
          ? querySnapshot.docs[0]
          : null;

      if (existingUser) {
        form.setError('username', {
          type: 'manual',
          message: 'Este nome de usuário já existe.',
        });
        return;
      }

      if (editingUser) {
        const userRef = doc(db, 'users', editingUser.id);
        const payload: Partial<User> = {
          name: submittedData.name,
          username: submittedData.username,
          role: submittedData.role,
          hasDashboardAccess: submittedData.hasDashboardAccess,
        };
        if (submittedData.password) {
          payload.password = submittedData.password;
        }
        await updateDoc(userRef, payload);

        setUsers(
          users.map((u) => (u.id === editingUser.id ? { ...u, ...payload } : u))
        );
        toast({ title: 'Sucesso!', description: 'Usuário atualizado.' });
      } else {
        if (!submittedData.password) {
          form.setError('password', {
            type: 'manual',
            message: 'A senha é obrigatória para novos usuários.',
          });
          return;
        }
        const newUserPayload: Omit<User, 'id'> = {
          name: submittedData.name,
          username: submittedData.username,
          password: submittedData.password,
          companyId: companyId,
          role: submittedData.role,
          hasDashboardAccess: submittedData.hasDashboardAccess,
        };
        const docRef = await addDoc(collection(db, 'users'), newUserPayload);
        setUsers([...users, { id: docRef.id, ...newUserPayload }]);
        toast({ title: 'Sucesso!', description: 'Usuário adicionado.' });
      }

      setEditingUser(null);
      form.reset({ name: '', username: '', password: '', role: 'user' });
      setIsDialogOpen(false);
    } catch (error: any) {
      console.error('Failed to save user:', error);
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

  const handleEdit = (user: User) => {
    setEditingUser(user);
    form.reset({
      name: user.name,
      username: user.username,
      password: '',
      role: user.role === 'system_admin' ? 'company_admin' : user.role,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (user: User) => {
    setUserToDelete(user);
    setIsDeleteAlertOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (userToDelete && companyId) {
      if (
        userToDelete.role === 'system_admin' ||
        userToDelete.id === currentUser?.id
      ) {
        toast({
          title: 'Ação não permitida',
          description:
            'O administrador do sistema e o seu próprio usuário não podem ser removidos.',
          variant: 'destructive',
        });
      } else {
        try {
          await deleteDoc(doc(db, 'users', userToDelete.id));
          setUsers(users.filter((u) => u.id !== userToDelete.id));
          toast({
            title: 'Sucesso!',
            description: 'Usuário removido.',
          });
        } catch (error: any) {
          console.error('Failed to delete user:', error);
          toast({
            title: 'Erro!',
            description:
              error.code === 'permission-denied'
                ? 'Permissão negada para remover o usuário.'
                : 'Não foi possível remover o usuário.',
            variant: 'destructive',
          });
        }
      }
    }
    setIsDeleteAlertOpen(false);
    setUserToDelete(null);
  };

  const openNewUserDialog = () => {
    setEditingUser(null);
    form.reset({ name: '', username: '', password: '', role: 'user' });
    setIsDialogOpen(true);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalUsers = filteredUsers.length;
  const totalPages = itemsPerPage > 0 ? Math.ceil(totalUsers / itemsPerPage) : 1;
  const paginatedUsers =
    itemsPerPage > 0
      ? filteredUsers.slice(
          (currentPage - 1) * itemsPerPage,
          currentPage * itemsPerPage
        )
      : filteredUsers;
  
  const selectedRole = form.watch('role');

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:w-auto md:flex-grow md:max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Pesquisar por nome ou usuário..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
                autoComplete="off"
              />
            </div>
            <Button onClick={openNewUserDialog} className="w-full md:w-auto">
              <PlusCircle className="mr-2 h-4 w-4" />
              Adicionar Usuário
            </Button>
          </div>
          <div className="border-t">
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
                {paginatedUsers.length > 0 ? (
                  paginatedUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.name}</TableCell>
                      <TableCell className="font-medium">
                        {user.username}
                      </TableCell>
                      <TableCell className="capitalize">
                        {user.role === 'company_admin'
                          ? 'Admin. da Empresa'
                          : 'Usuário'}
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
                            <DropdownMenuItem onClick={() => handleEdit(user)}>
                              <Edit className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(user)}
                              className="text-red-500"
                              disabled={
                                user.role === 'system_admin' ||
                                user.id === currentUser?.id
                              }
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
                      Nenhum usuário encontrado.
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
              Total de {totalUsers} usuário(s).
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
                  {[20, 50, 100].map((pageSize) => (
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Editar' : 'Adicionar'} Usuário
            </DialogTitle>
            <DialogDescription>
              Preencha os dados para criar ou editar um usuário.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="ex: João da Silva"
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
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome de Usuário</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="ex: joao.silva"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        disabled={editingUser?.role === 'system_admin'}
                        autoComplete="off"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
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
                        value={field.value || ''}
                        autoComplete="off"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nível de Acesso</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex gap-4"
                        disabled={editingUser?.id === currentUser?.id}
                      >
                        <FormItem className="flex items-center space-x-2">
                          <RadioGroupItem value="user" />
                          <Label>Usuário</Label>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2">
                          <RadioGroupItem value="company_admin" />
                          <Label>Admin. da Empresa</Label>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
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
                  {editingUser ? 'Salvar Alterações' : 'Adicionar'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={isDeleteAlertOpen}
        onOpenChange={setIsDeleteAlertOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Isso removerá permanentemente o
              usuário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToDelete(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
