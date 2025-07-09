'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { type User } from '@/lib/types';

const USERS_STORAGE_KEY = 'app-users';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Ensure default admin user exists in localStorage on client side
  useEffect(() => {
    try {
      const storedUsers = localStorage.getItem(USERS_STORAGE_KEY);
      if (!storedUsers) {
        const defaultUsers: User[] = [
          { id: '1', name: 'ADMINISTRADOR', username: 'admin', password: 'senha123' },
        ];
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(defaultUsers));
      }
    } catch (error) {
      console.error('Failed to initialize users in localStorage:', error);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Mock authentication
    setTimeout(() => {
      let users: User[] = [];
      try {
        const storedUsers = localStorage.getItem(USERS_STORAGE_KEY);
        if (storedUsers) {
          users = JSON.parse(storedUsers);
        }
      } catch (error) {
        console.error('Failed to read users from localStorage:', error);
      }

      const foundUser = users.find(
        (user) => user.username.toLowerCase() === username.toLowerCase() && user.password === password
      );

      if (foundUser) {
        localStorage.setItem('auth-token', 'mock-token-string');
        localStorage.setItem('current-user', foundUser.username);
        localStorage.setItem('current-user-name', foundUser.name);
        toast({
          title: 'Login bem-sucedido!',
          description: 'Redirecionando para o dashboard.',
        });
        router.push('/');
      } else {
        toast({
          title: 'Erro de login',
          description: 'Credenciais inválidas. Tente novamente.',
          variant: 'destructive',
        });
        setIsLoading(false);
      }
    }, 1000);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Entre com seu usuário e senha para acessar o painel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="username">Usuário</Label>
              <Input
                id="username"
                type="text"
                placeholder="admin"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex-col items-center justify-center pt-4 text-xs text-muted-foreground">
          <p>Desenvolvido por: David Leonardo</p>
          <p>Versão 1.0</p>
        </CardFooter>
      </Card>
    </div>
  );
}
