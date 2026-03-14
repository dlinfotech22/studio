
'use client';

import { AlertCircle, Ban, LogOut } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { differenceInDays, format } from 'date-fns';

type SubscriptionOverlayProps = {
  status: 'active' | 'expiring_soon' | 'expired';
  expiryDate: Date;
  notificationMessage?: string;
  onLogout: () => void;
  isCompanyAdmin: boolean;
};

export function SubscriptionOverlay({
  status,
  expiryDate,
  notificationMessage,
  onLogout,
  isCompanyAdmin,
}: SubscriptionOverlayProps) {
  if (status === 'active') {
    return null;
  }

  const daysRemaining = differenceInDays(expiryDate, new Date());

  if (status === 'expiring_soon' && isCompanyAdmin) {
    return (
      <Alert variant="destructive" className="fixed bottom-4 right-4 z-50 w-auto max-w-md">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Aviso de Vencimento</AlertTitle>
        <AlertDescription>
          <p>Sua assinatura vence em {daysRemaining + 1} dia(s). </p>
          {notificationMessage && <p className="mt-2">{notificationMessage}</p>}
        </AlertDescription>
      </Alert>
    );
  }

  if (status === 'expired') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-sm">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <Ban className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="mt-4">Acesso Bloqueado</CardTitle>
            <CardDescription>
              A assinatura da sua empresa venceu em {format(expiryDate, 'dd/MM/yyyy')}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             {isCompanyAdmin ? (
                <p className="text-sm text-muted-foreground">
                    Para continuar utilizando o sistema, por favor, realize o pagamento.
                    {notificationMessage && <strong className="mt-2 block">{notificationMessage}</strong>}
                </p>
             ) : (
                <p className="text-sm text-muted-foreground">
                    Por favor, entre em contato com o administrador da sua empresa para regularizar a situação.
                </p>
             )}
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" onClick={onLogout}>
              <LogOut className="mr-2" />
              Sair
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return null;
}
