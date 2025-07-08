import { AccessManagementClient } from '@/components/access-management-client';

export default function AccessManagementPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Gestão de Acessos</h1>
        <p className="text-muted-foreground">
          Adicione, edite e remova os acessos dos usuários ao sistema.
        </p>
      </header>
      <AccessManagementClient />
    </div>
  );
}
