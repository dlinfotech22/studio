'use client';

import { useState } from 'react';
import { DateRange } from 'react-day-picker';
import { addDays, format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn, formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { type Transaction } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

// Mock data, in a real app this would come from an API
const allTransactions: Transaction[] = Array.from({ length: 50 }, (_, i) => ({
  id: `${i + 1}`,
  date: subDays(new Date(), Math.floor(Math.random() * 365)),
  description: `Transação ${i + 1}`,
  amount: Math.random() * (i % 3 === 0 ? -1 : 1) * (500 + Math.random() * 2000),
  type: i % 3 === 0 ? 'expense' : 'revenue',
  category: i % 3 === 0 ? 'Fornecedores' : 'Prestação de Serviço',
}));


export function ReportsClient() {
  const { toast } = useToast();
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });

  const filteredTransactions = allTransactions.filter(t => {
    if (!date?.from || !date?.to) return false;
    return t.date >= date.from && t.date <= date.to;
  });

  const totalRevenue = filteredTransactions.filter(t => t.type === 'revenue').reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const profit = totalRevenue + totalExpenses;

  const handleExport = (format: 'Excel' | 'PDF') => {
    toast({
      title: 'Funcionalidade em desenvolvimento',
      description: `A exportação para ${format} ainda não foi implementada.`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant={'outline'}
              className={cn(
                'w-full justify-start text-left font-normal md:w-[300px]',
                !date && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, 'LLL dd, y', { locale: ptBR })} -{' '}
                    {format(date.to, 'LLL dd, y', { locale: ptBR })}
                  </>
                ) : (
                  format(date.from, 'LLL dd, y', { locale: ptBR })
                )
              ) : (
                <span>Escolha um período</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={setDate}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => handleExport('Excel')}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Exportar para Excel
          </Button>
          <Button onClick={() => handleExport('PDF')}>
            <FileText className="mr-2 h-4 w-4" />
            Gerar Relatório PDF (Ano)
          </Button>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Resumo do Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border bg-card p-4">
                <p className="text-sm font-medium text-muted-foreground">Receita Total</p>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalRevenue)}</p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-sm font-medium text-muted-foreground">Despesa Total</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-sm font-medium text-muted-foreground">Lucro/Prejuízo</p>
                <p className={cn("text-2xl font-bold", profit >= 0 ? 'text-primary' : 'text-destructive')}>{formatCurrency(profit)}</p>
              </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalhes dos Lançamentos</CardTitle>
        </CardHeader>
        <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map(t => (
                  <TableRow key={t.id}>
                    <TableCell>{format(t.date, 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="font-medium">{t.description}</TableCell>
                    <TableCell>{t.category}</TableCell>
                    <TableCell className={cn(
                      'text-right font-mono',
                      t.type === 'revenue' ? 'text-emerald-600' : 'text-red-600'
                    )}>
                      {formatCurrency(t.amount)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center h-24">
                    Nenhum lançamento encontrado para o período selecionado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
