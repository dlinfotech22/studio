
'use client';

import { AccountsReceivableClient } from '@/components/accounts-receivable-client';

export default function AccountsReceivablePage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Contas a Receber</h1>
        <p className="text-muted-foreground">
          Gerencie e acompanhe os recebimentos pendentes.
        </p>
      </header>
      <AccountsReceivableClient />
    </div>
  );
}
