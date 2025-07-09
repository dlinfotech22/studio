'use client';

import { useState, useEffect } from 'react';
import { Building } from 'lucide-react';

export function AdminDashboard() {
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const name = localStorage.getItem('current-user-name');
    setUserName(name || 'Administrador');
  }, []);

  return (
    <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm p-8 text-center h-full">
      <div className="flex flex-col items-center gap-2">
        <Building className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-2xl font-semibold">Bem-vindo, {userName}!</h2>
        <p className="text-muted-foreground">
          Você está no painel de administração do sistema.
        </p>
        <p className="max-w-md mt-2 text-sm text-muted-foreground">
          Use o menu lateral para gerenciar empresas e usuários. Os dashboards
          são específicos de cada empresa e não são exibidos aqui.
        </p>
      </div>
    </div>
  );
}
