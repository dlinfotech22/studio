import { ReportsClient } from '@/components/reports-client';

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Relatórios Financeiros</h1>
        <p className="text-muted-foreground">
          Gere relatórios detalhados, exporte dados e analise o desempenho.
        </p>
      </header>
      <ReportsClient />
    </div>
  );
}
