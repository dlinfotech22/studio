'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRightLeft,
  BarChart3,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticating, setIsAuthenticating] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('auth-token');
    if (!token && pathname !== '/login') {
      router.push('/login');
    } else if (token && pathname === '/login') {
      router.push('/');
    } else {
      setIsAuthenticating(false);
    }
  }, [pathname, router]);

  const handleLogout = () => {
    localStorage.removeItem('auth-token');
    localStorage.removeItem('current-user');
    router.push('/login');
  };

  if (isAuthenticating) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-28 w-28 animate-pulse text-primary"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
            <path d="M2 17l10 5 10-5"></path>
            <path d="M2 12l10 5 10-5"></path>
          </svg>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-auto w-auto shrink-0 rounded-full p-0"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-28 w-28 text-primary"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                <path d="M2 17l10 5 10-5"></path>
                <path d="M2 12l10 5 10-5"></path>
              </svg>
            </Button>
            <span className="text-2xl font-semibold tracking-tight text-sidebar-foreground">
              Gestão Financeira
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <Link href="/">
                <SidebarMenuButton
                  tooltip="Dashboard"
                  className="h-12 text-lg"
                  isActive={pathname === '/'}
                >
                  <LayoutDashboard className="h-7 w-7" />
                  <span className="text-lg">Dashboard</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link href="/transactions">
                <SidebarMenuButton
                  tooltip="Lançamentos"
                  className="h-12 text-lg"
                  isActive={pathname === '/transactions'}
                >
                  <ArrowRightLeft className="h-7 w-7" />
                  <span className="text-lg">Lançamentos</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link href="/reports">
                <SidebarMenuButton
                  tooltip="Relatórios"
                  className="h-12 text-lg"
                  isActive={pathname === '/reports'}
                >
                  <BarChart3 className="h-7 w-7" />
                  <span className="text-lg">Relatórios</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link href="/access-management">
                <SidebarMenuButton
                  tooltip="Gestão de Acessos"
                  className="h-12 text-lg"
                  isActive={pathname === '/access-management'}
                >
                  <Users className="h-7 w-7" />
                  <span className="text-lg">Gestão de Acessos</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <Link href="/settings">
                <SidebarMenuButton
                  tooltip="Configurações"
                  isActive={pathname === '/settings'}
                >
                  <Settings />
                  <span>Configurações</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleLogout} tooltip="Sair">
                <LogOut />
                <span>Sair</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <div className="mt-auto p-2 text-center text-xs text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
            <p>Desenvolvido por: David Leonardo</p>
            <p>Versão 1.0</p>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:h-16 sm:px-6 md:hidden">
          <SidebarTrigger />
          <h1 className="text-lg font-semibold">Gestão Financeira</h1>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
