'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
} from 'firebase/firestore';
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
import { db } from '@/lib/firebase';

const SYSTEM_ADMIN_USERNAME = 'davidleonardo';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const initializeAdmin = async () => {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('username', '==', SYSTEM_ADMIN_USERNAME));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          const systemAdmin: Omit<User, 'id'> = {
            name: 'DAVID MACHADO LEONARDO',
            username: SYSTEM_ADMIN_USERNAME,
            password: '162534',
            role: 'system_admin',
          };
          // Use a predictable ID for the system admin for simplicity
          await setDoc(doc(db, 'users', 'system_admin_user'), systemAdmin);
        }
      } catch (error: any) {
        console.error('Failed to initialize default data in Firestore:', error);
        if (error.code === 'permission-denied') {
          toast({
            title: 'Erro de Configuração do Firebase',
            description:
              'Falha ao criar usuário admin. Verifique suas regras de segurança do Firestore.',
            variant: 'destructive',
            duration: 10000,
          });
        }
      }
    };
    initializeAdmin();
  }, [toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('username', '==', username.toLowerCase()),
        where('password', '==', password)
      );

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const foundUser = { id: userDoc.id, ...userDoc.data() } as User;

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
    } catch (error: any) {
      console.error('Login error:', error);
      let description = 'Não foi possível autenticar. Tente novamente mais tarde.';
      if (error.code === 'permission-denied') {
        description = 'Permissão negada. Verifique as regras de segurança do Firestore.';
      }
      toast({
        title: 'Erro no servidor',
        description: description,
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-3xl text-center">GESTOR DL</CardTitle>
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
                autoComplete="off"
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
                autoComplete="off"
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
