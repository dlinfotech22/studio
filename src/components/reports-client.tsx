'use client';

import { useState, useEffect, useRef } from 'react';
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
import { FileSpreadsheet, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
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

const MonthPicker = ({ onSelect }: { onSelect: (date: Date) => void }) => {
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());

  const years = Array.from(
    { length: 10 },
    (_, i) => new Date().getFullYear() - i
  );
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: format(new Date(2000, i, 1), 'MMMM', { locale: ptBR }),
  }));

  const handleApply = () => {
    onSelect(new Date(year, month));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Selecione o mês e o ano desejado.
      </p>
      <div className="flex gap-2">
        <Select
          value={String(month)}
          onValueChange={(v) => setMonth(Number(v))}
        >
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

const YearPicker = ({ onSelect }: { onSelect: (date: Date) => void }) => {
  const [year, setYear] = useState(new Date().getFullYear());
  const years = Array.from(
    { length: 10 },
    (_, i) => new Date().getFullYear() - i
  );

  const handleApply = () => {
    onSelect(new Date(year, 0));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Selecione o ano desejado.</p>
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
        <Skeleton className="h-10 w-full md:w-[380px]" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-[180px]" />
          <Skeleton className="h-10 w-[180px]" />
        </div>
      </div>
      <Skeleton className="h-[250px] w-full" />
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
  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const allTransactions: Transaction[] = Array.from(
      { length: 50 },
      (_, i) => ({
        id: `${i + 1}`,
        date: subDays(new Date(), Math.floor(Math.random() * 365)),
        description: `Transação ${i + 1}`,
        amount:
          Math.random() * (i % 3 === 0 ? -1 : 1) * (500 + Math.random() * 2000),
        type: i % 3 === 0 ? 'expense' : 'revenue',
        category: i % 3 === 0 ? 'Fornecedores' : 'Prestação de Serviço',
      })
    );
    setTransactions(allTransactions);

    setIsClient(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tabsContainerRef.current &&
        !tabsContainerRef.current.contains(event.target as Node)
      ) {
        setActiveTab(undefined);
      }
    };

    if (activeTab) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeTab]);

  const handleTabChange = (tab: string) => {
    if (activeTab === tab) {
      setActiveTab(undefined);
    } else {
      setActiveTab(tab);
      setDate(undefined);
    }
  };

  const handleDaySelect = (selectedDay: Date | undefined) => {
    if (selectedDay) {
      setDate({ from: selectedDay, to: selectedDay });
    } else {
      setDate(undefined);
    }
    setActiveTab(undefined);
  };

  const handleMonthSelect = (selectedMonth: Date) => {
    setDate({
      from: startOfMonth(selectedMonth),
      to: endOfMonth(selectedMonth),
    });
    setActiveTab(undefined);
  };

  const handleYearSelect = (selectedYear: Date) => {
    setDate({ from: startOfYear(selectedYear), to: endOfYear(selectedYear) });
    setActiveTab(undefined);
  };

  const handleRangeSelect = (range: DateRange | undefined) => {
    setDate(range);
    if (range?.from && range.to) {
      setActiveTab(undefined);
    }
  };

  const filteredTransactions = transactions.filter((t) => {
    if (!date?.from) return false;
    const fromDate = new Date(date.from);
    fromDate.setHours(0, 0, 0, 0);

    const toDate = new Date(date.to ?? date.from);
    toDate.setHours(23, 59, 59, 999);

    return t.date >= fromDate && t.date <= toDate;
  });

  const totalRevenue = filteredTransactions
    .filter((t) => t.type === 'revenue')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = filteredTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const profit = totalRevenue + totalExpenses;

  const handleExport = (formatType: 'Excel' | 'PDF') => {
    if (formatType === 'PDF') {
      toast({
        title: 'Funcionalidade em desenvolvimento',
        description: `A exportação para PDF ainda não foi implementada.`,
      });
      return;
    }

    if (filteredTransactions.length === 0) {
      toast({
        title: 'Nenhum dado para exportar',
        description:
          'Selecione um período com transações para gerar o arquivo Excel.',
        variant: 'destructive',
      });
      return;
    }

    const dataToExport = filteredTransactions.map((t) => ({
      Data: format(t.date, 'dd/MM/yyyy'),
      Descrição: t.description,
      Categoria: t.category,
      Tipo: t.type === 'revenue' ? 'Receita' : 'Despesa',
      Valor: t.amount,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);

    const range = XLSX.utils.decode_range(worksheet['!ref']!);
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const cell_address = { c: 4, r: R };
      const cell_ref = XLSX.utils.encode_cell(cell_address);
      if (worksheet[cell_ref]) {
        worksheet[cell_ref].t = 'n';
        worksheet[cell_ref].z = '"R$"#,##0.00';
      }
    }

    XLSX.utils.sheet_add_aoa(
      worksheet,
      [
        [],
        ['', '', '', 'Receita Total', totalRevenue],
        ['', '', '', 'Despesa Total', totalExpenses],
        ['', '', '', 'Lucro/Prejuízo', profit],
      ],
      { origin: -1 }
    );

    const new_range = XLSX.utils.decode_range(worksheet['!ref']!);
    for (let R = new_range.e.r - 2; R <= new_range.e.r; ++R) {
      const cell_address = { c: 4, r: R };
      const cell_ref = XLSX.utils.encode_cell(cell_address);
      if (worksheet[cell_ref]) {
        worksheet[cell_ref].t = 'n';
        worksheet[cell_ref].z = '"R$"#,##0.00';
      }
    }

    worksheet['!cols'] = [
      { wch: 12 },
      { wch: 40 },
      { wch: 20 },
      { wch: 10 },
      { wch: 15 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Lançamentos');

    const fileName = `relatorio_financeiro_${format(
      new Date(),
      'yyyy-MM-dd'
    )}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    toast({
      title: 'Exportação Concluída',
      description: `O arquivo ${fileName} foi gerado com sucesso.`,
    });
  };

  if (!isClient) {
    return <ReportsSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div ref={tabsContainerRef}>
        <Tabs value={activeTab || ''} onValueChange={handleTabChange}>
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <TabsList>
              <TabsTrigger value="period">Período</TabsTrigger>
              <TabsTrigger value="day">Dia</TabsTrigger>
              <TabsTrigger value="month">Mês</TabsTrigger>
              <TabsTrigger value="year">Ano</TabsTrigger>
            </TabsList>
            <div className="flex w-full items-center gap-2 md:w-auto">
              <Button
                variant="outline"
                onClick={() => handleExport('Excel')}
                className="w-full sm:w-auto"
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Exportar para Excel
              </Button>
              <Button
                onClick={() => handleExport('PDF')}
                className="w-full sm:w-auto"
              >
                <FileText className="mr-2 h-4 w-4" />
                Gerar Relatório PDF
              </Button>
            </div>
          </div>

          {activeTab === 'period' && (
            <TabsContent value="period" className="mt-4 rounded-md border p-4">
              <p className="mb-4 text-sm text-muted-foreground">
                Selecione um intervalo de datas.
              </p>
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={handleRangeSelect}
                numberOfMonths={2}
              />
            </TabsContent>
          )}
          {activeTab === 'day' && (
            <TabsContent value="day" className="mt-4 rounded-md border p-4">
              <p className="mb-4 text-sm text-muted-foreground">
                Selecione um dia.
              </p>
              <Calendar
                initialFocus
                mode="single"
                selected={date?.from}
                onSelect={handleDaySelect}
              />
            </TabsContent>
          )}
          {activeTab === 'month' && (
            <TabsContent
              value="month"
              className="mt-4 max-w-sm rounded-md border p-4"
            >
              <MonthPicker onSelect={handleMonthSelect} />
            </TabsContent>
          )}
          {activeTab === 'year' && (
            <TabsContent
              value="year"
              className="mt-4 max-w-sm rounded-md border p-4"
            >
              <YearPicker onSelect={handleYearSelect} />
            </TabsContent>
          )}
        </Tabs>
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
