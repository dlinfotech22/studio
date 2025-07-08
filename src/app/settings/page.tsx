import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie as configurações do sistema e dos usuários.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Configurações de Usuário</CardTitle>
          <CardDescription>
            Funcionalidade de configurações em desenvolvimento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Em breve, você poderá gerenciar as configurações aqui.</p>
        </CardContent>
      </Card>
    </div>
  );
}
