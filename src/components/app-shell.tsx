
'use client';

import { useState, useEffect, type ReactNode, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { type CompanyInfo } from '@/lib/types';
import {
  ArrowRightLeft,
  BarChart3,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  User,
  Package,
  ClipboardList,
  Contact,
  Book,
  Wrench,
  CalendarClock,
  Workflow,
  Maximize,
  Minimize,
  Droplets,
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
import { SubscriptionOverlay } from './subscription-overlay';
import { differenceInDays, startOfDay } from 'date-fns';

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [hasCompany, setHasCompany] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [companyStatus, setCompanyStatus] = useState<'active' | 'expiring_soon' | 'expired' | 'loading'>('loading');

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);
  
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };
  
  const handleLogout = useCallback(() => {
    sessionStorage.removeItem('auth-token');
    sessionStorage.removeItem('current-user');
    sessionStorage.removeItem('current-user-name');
    sessionStorage.removeItem('current-user-role');
    sessionStorage.removeItem('current-user-company-id');
    sessionStorage.removeItem('expiryWarningDismissed');
    setCompanyInfo(null);
    router.push('/login');
  }, [router]);

  useEffect(() => {
    const token = sessionStorage.getItem('auth-token');
    const user = sessionStorage.getItem('current-user-name');
    const role = sessionStorage.getItem('current-user-role');
    const companyId = sessionStorage.getItem('current-user-company-id');
    setCurrentUser(user);
    setCurrentUserRole(role);
    setHasCompany(!!companyId);

    const processCompanyStatus = (company: CompanyInfo | null) => {
        if (role === 'system_admin' || !company || !company.expiryDate) {
            setCompanyStatus('active');
            return;
        }

        const expiry = (company.expiryDate as Timestamp).toDate();
        const today = startOfDay(new Date());
        const diff = differenceInDays(expiry, today);

        if (diff < 0) {
            if (role !== 'company_admin') {
                handleLogout(); // Force logout for non-admins
            } else {
                setCompanyStatus('expired');
            }
        } else if (diff <= 5) {
            setCompanyStatus('expiring_soon');
        } else {
            setCompanyStatus('active');
        }
    };

    const fetchCompanyInfo = async (id: string) => {
        try {
            const companiesRef = collection(db, 'companies');
            const q = query(companiesRef, where('document', '==', id));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const companyDoc = querySnapshot.docs[0];
                const info = { id: companyDoc.id, ...companyDoc.data() } as CompanyInfo;
                setCompanyInfo(info);
                processCompanyStatus(info);
            } else {
                setCompanyStatus('active');
            }
        } catch (error) {
            console.error('Failed to fetch company info:', error);
            setCompanyStatus('active');
        }
    }
    
    if (role === 'system_admin' || !companyId) {
        setCompanyStatus('active');
    } else {
        fetchCompanyInfo(companyId);
    }

    if (!token && pathname !== '/login') {
      router.push('/login');
    } else if (token && pathname === '/login') {
      router.push('/');
    } else {
      setIsAuthenticating(false);
    }
  }, [pathname, router, handleLogout]);

  const showProductsMenu = companyInfo?.allowedSubtypes?.some(
    (st) => st === 'Venda' || st === 'Serviço + Venda'
  );

  const showServicesMenu = companyInfo?.allowedSubtypes?.some(
    (st) => st === 'Prestação de Serviço' || st === 'Serviço + Venda'
  );

  const showOilChangeMenu = showProductsMenu && showServicesMenu;

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
                className="h-40 w-40 text-primary"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                <path d="M2 17l10 5 10-5"></path>
                <path d="M2 12l10 5 10-5"></path>
              </svg>
            </Button>
            <span className="text-2xl font-semibold tracking-tight text-sidebar-foreground">
              GESTOR DL
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent className="pt-4">
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
            {hasCompany && (
               <>
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
                  <Link href="/customers">
                    <SidebarMenuButton
                      tooltip="Clientes"
                      isActive={pathname === '/customers'}
                    >
                      <Contact />
                      <span>Clientes</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href="/accounts-receivable">
                    <SidebarMenuButton
                      tooltip="Contas a Receber"
                      isActive={pathname === '/accounts-receivable'}
                    >
                      <ClipboardList />
                      <span>Contas a Receber</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                 {showProductsMenu && (
                    <SidebarMenuItem>
                      <Link href="/products">
                        <SidebarMenuButton
                          tooltip="Catálogo de Produtos"
                          isActive={pathname === '/products'}
                        >
                          <Book />
                          <span>Catálogo de Produtos</span>
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                 )}
                 {showServicesMenu && (
                    <>
                    <SidebarMenuItem>
                      <Link href="/services">
                        <SidebarMenuButton
                          tooltip="Catálogo de Serviços"
                          isActive={pathname === '/services'}
                        >
                          <Wrench />
                          <span>Catálogo de Serviços</span>
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <Link href="/schedule">
                            <SidebarMenuButton
                                tooltip="Agenda de Serviços"
                                isActive={pathname === '/schedule'}
                            >
                                <CalendarClock />
                                <span>Agenda</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                     <SidebarMenuItem>
                        <Link href="/work-orders">
                            <SidebarMenuButton
                                tooltip="Ordens de Serviço"
                                isActive={pathname === '/work-orders'}
                            >
                                <Workflow />
                                <span>Ordens de Serviço</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                    </>
                 )}
                 {showOilChangeMenu && (
                    <SidebarMenuItem>
                        <Link href="/oil-change-notifications">
                            <SidebarMenuButton
                                tooltip="Troca de Óleo"
                                isActive={pathname === '/oil-change-notifications'}
                            >
                                <Droplets />
                                <span>Troca de Óleo</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                 )}
                {showProductsMenu && (
                    <SidebarMenuItem>
                        <Link href="/inventory">
                            <SidebarMenuButton
                            tooltip="Estoque"
                            isActive={pathname === '/inventory'}
                            >
                            <Package />
                            <span>Estoque</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                )}
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
              </>
            )}
           
            {(currentUserRole === 'system_admin' || currentUserRole === 'company_admin') && (
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
            )}
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
             <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullScreen}
                className="h-8 w-8"
              >
                {isFullscreen ? (
                  <Minimize className="h-5 w-5" />
                ) : (
                  <Maximize className="h-5 w-5" />
                )}
                <span className="sr-only">
                  {isFullscreen ? 'Sair da tela cheia' : 'Entrar em tela cheia'}
                </span>
              </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <span className="hidden font-medium sm:block">
                    {currentUser}
                  </span>
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{currentUser}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </SidebarInset>
      <SubscriptionOverlay
        status={(currentUserRole === 'system_admin' || companyStatus === 'loading') ? 'active' : companyStatus}
        expiryDate={companyInfo?.expiryDate ? (companyInfo.expiryDate as Timestamp).toDate() : new Date()}
        notificationMessage={companyInfo?.paymentNotification}
        onLogout={handleLogout}
        isCompanyAdmin={currentUserRole === 'company_admin'}
      />
    </SidebarProvider>
  );
}
