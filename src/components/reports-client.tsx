'use client';

import { useState, useEffect } from 'react';
import { DateRange } from 'react-day-picker';
import {
  format,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn, formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { type Transaction } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from './ui/skeleton';

const MonthPicker = ({
  onSelect,
  closePopover,
}: {
  onSelect: (date: Date) => void;
  closePopover: () => void;
}) => {
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: format(new Date(2000, i, 1), 'MMMM', { locale: ptBR }),
  }));

  const handleApply = () => {
    onSelect(new Date(year, month));
    closePopover();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger>
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem
                key={m.value}
                value={String(m.value)}
                className="capitalize"
              >
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger>
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button onClick={handleApply} className="w-full">
        Filtrar por Mês
      </Button>
    </div>
  );
};

const YearPicker = ({
  onSelect,
  closePopover,
}: {
  onSelect: (date: Date) => void;
  closePopover: () => void;
}) => {
  const [year, setYear] = useState(new Date().getFullYear());
  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

  const handleApply = () => {
    onSelect(new Date(year, 0));
    closePopover();
  };

  return (
    <div className="space-y-4">
      <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
        <SelectTrigger>
          <SelectValue placeholder="Ano" />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button onClick={handleApply} className="w-full">
        Filtrar por Ano
      </Button>
    </div>
  );
};

function ReportsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Skeleton className="h-10 w-full md:w-[280px]" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-[180px]" />
          <Skeleton className="h-10 w-[180px]" />
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Resumo do Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Skeleton className="h-[88px]" />
            <Skeleton className="h-[88px]" />
            <Skeleton className="h-[88px]" />
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
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    Carregando dados...
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ReportsClient() {
  const { toast } = useToast();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // This logic now runs only on the client, avoiding hydration mismatch.
    setDate({
      from: subDays(new Date(), 29),
      to: new Date(),
    });
    // Mock data, in a real app this would come from an API
    const allTransactions: Transaction[] = Array.from({ length: 50 }, (_, i) => ({
      id: `${i + 1}`,
      date: subDays(new Date(), Math.floor(Math.random() * 365)),
      description: `Transação ${i + 1}`,
      amount: Math.random() * (i % 3 === 0 ? -1 : 1) * (500 + Math.random() * 2000),
      type: i % 3 === 0 ? 'expense' : 'revenue',
      category: i % 3 === 0 ? 'Fornecedores' : 'Prestação de Serviço',
    }));
    setTransactions(allTransactions);

    setIsClient(true);
  }, []);

  const handleDaySelect = (selectedDay: Date | undefined) => {
    if (selectedDay) {
      setDate({ from: selectedDay, to: selectedDay });
      setIsPopoverOpen(false);
    }
  };

  const handleMonthSelect = (selectedMonth: Date) => {
    setDate({
      from: startOfMonth(selectedMonth),
      to: endOfMonth(selectedMonth),
    });
    setIsPopoverOpen(false);
  };

  const handleYearSelect = (selectedYear: Date) => {
    setDate({ from: startOfYear(selectedYear), to: endOfYear(selectedYear) });
    setIsPopoverOpen(false);
  };
  
  const handleRangeSelect = (range: DateRange | undefined) => {
    setDate(range);
    if(range?.from && range?.to) {
      setIsPopoverOpen(false);
    }
  }

  const handlePopoverOpenChange = (open: boolean) => {
    if (open) {
      setDate(undefined);
    }
    setIsPopoverOpen(open);
  };

  const formatDisplayDate = (dateRange: DateRange | undefined): string => {
    if (!dateRange?.from) return 'Escolha um período';
    if (dateRange.to && format(dateRange.from, 'yyyy-MM-dd') !== format(dateRange.to, 'yyyy-MM-dd')) {
      return `${format(dateRange.from, 'd LLL, y', { locale: ptBR })} - ${format(dateRange.to, 'd LLL, y', { locale: ptBR })}`;
    }
    return format(dateRange.from, 'd LLL, y', { locale: ptBR });
  }

  const filteredTransactions = transactions.filter((t) => {
    if (!date?.from || !date?.to) return false;
    // Adjust 'to' date to include the entire day
    const toDate = new Date(date.to);
    toDate.setHours(23, 59, 59, 999);
    return t.date >= date.from && t.date <= toDate;
  });

  const totalRevenue = filteredTransactions
    .filter((t) => t.type === 'revenue')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = filteredTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const profit = totalRevenue + totalExpenses;

  const handleExport = (format: 'Excel' | 'PDF') => {
    toast({
      title: 'Funcionalidade em desenvolvimento',
      description: `A exportação para ${format} ainda não foi implementada.`,
    });
  };

  if (!isClient) {
    return <ReportsSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Popover open={isPopoverOpen} onOpenChange={handlePopoverOpenChange}>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant={'outline'}
              className={cn(
                'w-full justify-start text-left font-normal md:w-auto min-w-[280px]',
                !date && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {formatDisplayDate(date)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Tabs defaultValue="period" className="w-[350px] sm:w-auto">
              <TabsList className="grid w-full grid-cols-4 rounded-b-none rounded-t-lg">
                <TabsTrigger value="period">Período</TabsTrigger>
                <TabsTrigger value="day">Dia</TabsTrigger>
                <TabsTrigger value="month">Mês</TabsTrigger>
                <TabsTrigger value="year">Ano</TabsTrigger>
              </TabsList>
              <TabsContent value="period" className="p-0">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={date?.from}
                  selected={date}
                  onSelect={handleRangeSelect}
                  numberOfMonths={2}
                />
              </TabsContent>
              <TabsContent value="day" className="p-0">
                <Calendar
                  initialFocus
                  mode="single"
                  selected={date?.from}
                  onSelect={handleDaySelect}
                />
              </TabsContent>
              <TabsContent value="month" className="p-4">
                <MonthPicker onSelect={handleMonthSelect} closePopover={() => setIsPopoverOpen(false)} />
              </TabsContent>
              <TabsContent value="year" className="p-4">
                <YearPicker onSelect={handleYearSelect} closePopover={() => setIsPopoverOpen(false)} />
              </TabsContent>
            </Tabs>
          </PopoverContent>
        </Popover>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => handleExport('Excel')}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Exportar para Excel
          </Button>
          <Button onClick={() => handleExport('PDF')}>
            <FileText className="mr-2 h-4 w-4" />
            Gerar Relatório PDF
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
              <p className="text-sm font-medium text-muted-foreground">
                Receita Total
              </p>
              <p className="text-2xl font-bold text-emerald-600">
                {formatCurrency(totalRevenue)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm font-medium text-muted-foreground">
                Despesa Total
              </p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(totalExpenses)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm font-medium text-muted-foreground">
                Lucro/Prejuízo
              </p>
              <p
                className={cn(
                  'text-2xl font-bold',
                  profit >= 0 ? 'text-primary' : 'text-destructive'
                )}
              >
                {formatCurrency(profit)}
              </p>
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
                  filteredTransactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{format(t.date, 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="font-medium">
                        {t.description}
                      </TableCell>
                      <TableCell>{t.category}</TableCell>
                      <TableCell
                        className={cn(
                          'text-right font-mono',
                          t.type === 'revenue'
                            ? 'text-emerald-600'
                            : 'text-red-600'
                        )}
                      >
                        {formatCurrency(t.amount)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
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
