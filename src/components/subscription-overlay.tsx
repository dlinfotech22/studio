'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, Ban, LogOut } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
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
  const [isWarningOpen, setIsWarningOpen] = useState(false);

  useEffect(() => {
    if (status === 'expiring_soon' && isCompanyAdmin) {
      const warningDismissed = sessionStorage.getItem('expiryWarningDismissed');
      if (!warningDismissed) {
        setIsWarningOpen(true);
      }
    }
  }, [status, isCompanyAdmin]);

  if (status === 'active') {
    return null;
  }

  const handleDismissWarning = () => {
    sessionStorage.setItem('expiryWarningDismissed', 'true');
    setIsWarningOpen(false);
  };

  const daysRemaining = differenceInDays(expiryDate, new Date());

  // Regex to find a URL in the notification message
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const paymentUrl = notificationMessage?.match(urlRegex)?.[0];

  if (status === 'expiring_soon' && isCompanyAdmin) {
    return (
      <AlertDialog open={isWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader className="items-center text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <AlertDialogTitle className="text-2xl !mt-4">Aviso de Vencimento</AlertDialogTitle>
            <AlertDialogDescription asChild className="!mt-4">
              <div>
                Sua assinatura expira em <strong>{daysRemaining + 1} dia(s)</strong>, em {format(expiryDate, 'dd/MM/yyyy')}.
                <br />
                Para evitar a interrupção do serviço, por favor, regularize sua situação.
                {notificationMessage && (
                  <div className="mt-4 p-3 bg-muted rounded-md text-sm text-foreground text-left">
                    <p className="font-semibold">Instruções de pagamento:</p>
                    <p>{notificationMessage.replace(urlRegex, '')}</p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center pt-4">
            <AlertDialogCancel onClick={handleDismissWarning}>Lembrar Depois</AlertDialogCancel>
            {paymentUrl && (
              <AlertDialogAction asChild>
                <a href={paymentUrl} target="_blank" rel="noopener noreferrer" onClick={handleDismissWarning}>
                  Realizar Pagamento
                </a>
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
