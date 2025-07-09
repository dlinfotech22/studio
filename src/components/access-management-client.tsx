'use client';

import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { PlusCircle, Edit, Trash2, MoreHorizontal } from 'lucide-react';

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
import { Card, CardContent } from './ui/card';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';

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

const USERS_STORAGE_KEY = 'app-users';

export function AccessManagementClient() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const currentCompanyId = sessionStorage.getItem('current-user-company-id');
    setCompanyId(currentCompanyId);
    const currentUsername = sessionStorage.getItem('current-user');

    if (currentCompanyId) {
      try {
        const storedUsers = localStorage.getItem(USERS_STORAGE_KEY);
        if (storedUsers) {
          const allUsers: User[] = JSON.parse(storedUsers);
          setUsers(allUsers.filter((u) => u.companyId === currentCompanyId));
          setCurrentUser(
            allUsers.find((u) => u.username === currentUsername) || null
          );
        }
      } catch (error) {
        console.error('Failed to access localStorage:', error);
      }
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

  const onSubmit = (data: UserFormValues) => {
    if (!companyId) return;

    const allUsers: User[] = JSON.parse(
      localStorage.getItem(USERS_STORAGE_KEY) || '[]'
    );

    const submittedData = {
      ...data,
      username: data.username.toLowerCase(),
      name: data.name.toUpperCase(),
    };

    if (editingUser) {
      // Logic for editing a user
      if (
        editingUser.username.toLowerCase() !==
        submittedData.username.toLowerCase()
      ) {
        const existingUser = allUsers.find(
          (u) =>
            u.username.toLowerCase() ===
              submittedData.username.toLowerCase() && u.id !== editingUser.id
        );
        if (existingUser) {
          form.setError('username', {
            type: 'manual',
            message: 'Este nome de usuário já existe.',
          });
          return;
        }
      }

      const payload: User = {
        ...editingUser,
        name: submittedData.name,
        username: submittedData.username,
        role: submittedData.role,
        ...(submittedData.password && { password: submittedData.password }),
      };

      const updatedAllUsers = allUsers.map((u) =>
        u.id === editingUser.id ? payload : u
      );
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedAllUsers));
      setUsers(updatedAllUsers.filter((u) => u.companyId === companyId));
      toast({ title: 'Sucesso!', description: 'Usuário atualizado.' });
    } else {
      // Logic for creating a new user
      if (!submittedData.password) {
        form.setError('password', {
          type: 'manual',
          message: 'A senha é obrigatória para novos usuários.',
        });
        return;
      }

      const existingUser = allUsers.find(
        (u) => u.username.toLowerCase() === submittedData.username.toLowerCase()
      );
      if (existingUser) {
        form.setError('username', {
          type: 'manual',
          message: 'Este nome de usuário já existe.',
        });
        return;
      }

      const newUser: User = {
        id: new Date().toISOString(),
        name: submittedData.name,
        username: submittedData.username,
        password: submittedData.password,
        companyId: companyId,
        role: submittedData.role,
      };

      const updatedAllUsers = [...allUsers, newUser];
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedAllUsers));
      setUsers(updatedAllUsers.filter((u) => u.companyId === companyId));
      toast({ title: 'Sucesso!', description: 'Usuário adicionado.' });
    }

    setEditingUser(null);
    form.reset({ name: '', username: '', password: '', role: 'user' });
    setIsDialogOpen(false);
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

  const handleConfirmDelete = () => {
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
        const allUsers: User[] = JSON.parse(
          localStorage.getItem(USERS_STORAGE_KEY) || '[]'
        );
        const updatedAllUsers = allUsers.filter(
          (u) => u.id !== userToDelete.id
        );
        localStorage.setItem(
          USERS_STORAGE_KEY,
          JSON.stringify(updatedAllUsers)
        );
        setUsers(updatedAllUsers.filter((u) => u.companyId === companyId));
        toast({
          title: 'Sucesso!',
          description: 'Usuário removido.',
        });
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

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-end p-4">
            <Button onClick={openNewUserDialog}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Adicionar Usuário
            </Button>
          </div>
          <div className="rounded-md border-t">
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
                {users.map((user) => (
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
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
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
                        disabled={editingUser?.role === 'system_admin'}
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
