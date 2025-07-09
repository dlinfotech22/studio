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
import { type User, type CompanyInfo } from '@/lib/types';
import { capitalizeFirstLetter } from '@/lib/utils';

const USERS_STORAGE_KEY = 'app-users';
const COMPANIES_STORAGE_KEY = 'app-companies';
const SYSTEM_ADMIN_USERNAME = 'davidleonardo';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Ensure default admin user and company exist in localStorage on client side
  useEffect(() => {
    try {
      // Initialize users and ensure the system admin is always correct.
      let allUsers: User[] = JSON.parse(
        localStorage.getItem(USERS_STORAGE_KEY) || '[]'
      );

      // Define the single, correct system admin user object.
      const systemAdmin: User = {
        id: '1',
        name: 'DAVID MACHADO LEONARDO',
        username: SYSTEM_ADMIN_USERNAME,
        password: '162534',
        role: 'system_admin',
      };

      // Filter out any existing user record for the system admin to prevent duplicates or corrupted data.
      // And also remove any potential companyId from the system admin
      const otherUsers = allUsers.filter(
        (u) => u.username !== SYSTEM_ADMIN_USERNAME
      );

      // Add the one true system admin to the list of users, ensuring it's always correctly configured.
      const updatedUsers = [...otherUsers, systemAdmin];
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers));
    } catch (error) {
      console.error(
        'Failed to initialize default data in localStorage:',
        error
      );
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
        (user) =>
          user.username.toLowerCase() === username.toLowerCase() &&
          user.password === password
      );

      if (foundUser) {
        sessionStorage.setItem('auth-token', 'mock-token-string');
        sessionStorage.setItem('current-user', foundUser.username);
        sessionStorage.setItem('current-user-name', foundUser.name);
        sessionStorage.setItem('current-user-role', foundUser.role);
        if (foundUser.companyId) {
          sessionStorage.setItem('current-user-company-id', foundUser.companyId);
        } else {
          sessionStorage.removeItem('current-user-company-id');
        }

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
          <CardTitle className="text-3xl text-center">Gestão de Empresa</CardTitle>
          <CardDescription className="text-center">
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
                placeholder="Usuário"
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
