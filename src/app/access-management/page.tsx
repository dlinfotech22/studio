import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AccessManagementPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Gestão de Acessos</h1>
        <p className="text-muted-foreground">
          Adicione, edite e remova os acessos dos usuários ao sistema.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Usuários</CardTitle>
          <CardDescription>
            Funcionalidade de gerenciamento de usuários em desenvolvimento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Em breve, você poderá gerenciar os usuários aqui.</p>
        </CardContent>
      </Card>
    </div>
  );
}
