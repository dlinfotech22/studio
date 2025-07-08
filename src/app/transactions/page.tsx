import { TransactionsClient } from '@/components/transactions-client';

export default function TransactionsPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Lançamentos Financeiros</h1>
        <p className="text-muted-foreground">
          Adicione e gerencie as receitas e despesas da sua empresa.
        </p>
      </header>
      <TransactionsClient />
    </div>
  );
}
