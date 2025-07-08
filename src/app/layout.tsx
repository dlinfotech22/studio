import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRightLeft,
  BarChart3,
  LayoutDashboard,
  Settings,
  UserCircle,
} from 'lucide-react';
import './globals.css';
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
import { Toaster } from '@/components/ui/toaster';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Gestão Financeira',
  description: 'Gerencie as finanças da sua empresa de forma simples e eficiente.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        ></link>
      </head>
      <body className="font-body antialiased">
        <SidebarProvider>
          <Sidebar>
            <SidebarHeader>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="shrink-0 rounded-full h-auto w-auto p-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-10 w-10 text-primary"
                  >
                    <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                    <path d="M2 17l10 5 10-5"></path>
                    <path d="M2 12l10 5 10-5"></path>
                  </svg>
                </Button>
                <span className="text-3xl font-semibold tracking-tight text-sidebar-foreground">
                  Gestão Financeira
                </span>
              </div>
            </SidebarHeader>
            <SidebarContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <Link href="/">
                    <SidebarMenuButton tooltip="Dashboard" className="h-14 text-lg">
                      <LayoutDashboard className="h-7 w-7" />
                      <span className="text-lg">Dashboard</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href="/transactions">
                    <SidebarMenuButton tooltip="Lançamentos" className="h-14 text-lg">
                      <ArrowRightLeft className="h-7 w-7" />
                      <span className="text-lg">Lançamentos</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link href="/reports">
                    <SidebarMenuButton tooltip="Relatórios" className="h-14 text-lg">
                      <BarChart3 className="h-7 w-7" />
                      <span className="text-lg">Relatórios</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarContent>
            <SidebarFooter>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Configurações">
                    <Settings />
                    <span>Configurações</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <Avatar className="h-7 w-7">
                      <AvatarImage src="https://placehold.co/40x40.png" alt="User Avatar" />
                      <AvatarFallback>C</AvatarFallback>
                    </Avatar>
                    <span>Minha Empresa</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
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
        <Toaster />
      </body>
    </html>
  );
}
