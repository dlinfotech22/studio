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

const userSchema = z.object({
  name: z.string().min(1, 'O nome é obrigatório.'),
  username: z.string().min(1, 'O nome de usuário é obrigatório.'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
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

  useEffect(() => {
    try {
      const storedUsers = localStorage.getItem(USERS_STORAGE_KEY);
      if (storedUsers) {
        setUsers(JSON.parse(storedUsers));
      } else {
        const defaultUsers: User[] = [
          { id: '1', name: 'ADMINISTRADOR', username: 'admin', password: 'senha123' },
        ];
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(defaultUsers));
        setUsers(defaultUsers);
      }
    } catch (error) {
      console.error('Failed to access localStorage:', error);
      const defaultUsers: User[] = [
        { id: '1', name: 'ADMINISTRADOR', username: 'admin', password: 'senha123' },
      ];
      setUsers(defaultUsers);
    }
  }, []);

  useEffect(() => {
    if (users.length > 0) {
      try {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
      } catch (error) {
        console.error('Failed to save users to localStorage:', error);
      }
    }
  }, [users]);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: '',
      username: '',
      password: '',
    },
  });

  const onSubmit = (data: UserFormValues) => {
    const payload = { ...data, username: data.username.toLowerCase(), name: data.name.toUpperCase() };
    if (editingUser) {
      if (editingUser.username !== payload.username) {
        const existingUser = users.find(
          (u) =>
            u.username.toLowerCase() === payload.username.toLowerCase() &&
            u.id !== editingUser.id
        );
        if (existingUser) {
          form.setError('username', {
            type: 'manual',
            message: 'Este nome de usuário já existe.',
          });
          return;
        }
      }

      setUsers(
        users.map((u) => (u.id === editingUser.id ? { ...u, ...payload } : u))
      );
      toast({ title: 'Sucesso!', description: 'Usuário atualizado.' });
    } else {
      const existingUser = users.find(
        (u) => u.username.toLowerCase() === payload.username.toLowerCase()
      );
      if (existingUser) {
        form.setError('username', {
          type: 'manual',
          message: 'Este nome de usuário já existe.',
        });
        return;
      }
      setUsers([...users, { id: new Date().toISOString(), ...payload }]);
      toast({ title: 'Sucesso!', description: 'Usuário adicionado.' });
    }
    setEditingUser(null);
    form.reset({ name: '', username: '', password: '' });
    setIsDialogOpen(false);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    form.reset(user);
    setIsDialogOpen(true);
  };

  const handleDelete = (user: User) => {
    setUserToDelete(user);
    setIsDeleteAlertOpen(true);
  };

  const handleConfirmDelete = () => {
    if (userToDelete) {
      if (userToDelete.username === 'admin') {
        toast({
          title: 'Ação não permitida',
          description: 'O usuário admin não pode ser removido.',
          variant: 'destructive',
        });
        setIsDeleteAlertOpen(false);
        setUserToDelete(null);
        return;
      }
      setUsers(users.filter((u) => u.id !== userToDelete.id));
      toast({
        title: 'Sucesso!',
        description: 'Usuário removido.',
      });
    }
    setIsDeleteAlertOpen(false);
    setUserToDelete(null);
  };

  const openNewUserDialog = () => {
    setEditingUser(null);
    form.reset({ name: '', username: '', password: '' });
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
                  <TableHead className="w-24 text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.name}</TableCell>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
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
                            disabled={user.username === 'admin'}
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
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        className="uppercase"
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
                        disabled={editingUser?.username === 'admin'}
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
                        placeholder="••••••••"
                        {...field}
                        value={field.value || ''}
                      />
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
