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
  User,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('auth-token');
    const user = localStorage.getItem('current-user');
    setCurrentUser(user);

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
        <SidebarHeader className="pt-4">
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
                  isActive={pathname === '/'}
                >
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link href="/transactions">
                <SidebarMenuButton
                  tooltip="Lançamentos"
                  isActive={pathname === '/transactions'}
                >
                  <ArrowRightLeft />
                  <span>Lançamentos</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link href="/reports">
                <SidebarMenuButton
                  tooltip="Relatórios"
                  isActive={pathname === '/reports'}
                >
                  <BarChart3 />
                  <span>Relatórios</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link href="/access-management">
                <SidebarMenuButton
                  tooltip="Gestão de Acessos"
                  isActive={pathname === '/access-management'}
                >
                  <Users />
                  <span>Gestão de Acessos</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
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
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <div className="mt-auto p-2 text-center text-xs text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
            <p>Desenvolvido por: David Leonardo</p>
            <p>Versão 1.0</p>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:h-16 sm:px-6">
            <SidebarTrigger className="md:hidden" />
            <div className="ml-auto flex items-center gap-4">
               <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full"
                  >
                    <User className="h-5 w-5" />
                    <span className="sr-only">Toggle user menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{currentUser}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                   <DropdownMenuItem className="p-0">
                    <Link href="/settings" className="flex w-full cursor-pointer items-center gap-2 px-2 py-1.5">
                      <Settings className="h-4 w-4" />
                      <span>Configurações</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sair</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
