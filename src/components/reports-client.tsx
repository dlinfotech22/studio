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
import jsPDF from 'jspdf';
import 'jspdf-autotable';
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
import { type Transaction, type CompanyInfo } from '@/lib/types';
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

const TRANSACTIONS_STORAGE_KEY = 'app-transactions';
const COMPANY_INFO_STORAGE_KEY = 'app-company-info';

export function ReportsClient() {
  const { toast } = useToast();
  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);
  const [selectionMode, setSelectionMode] = useState<
    'period' | 'day' | 'month' | 'year' | undefined
  >();
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const storedTransactions = localStorage.getItem(TRANSACTIONS_STORAGE_KEY);
      const allTransactions = storedTransactions
        ? JSON.parse(storedTransactions, (key, value) =>
            key === 'date' ? new Date(value) : value
          )
        : [];
      setTransactions(allTransactions);

      const storedCompanyInfo = localStorage.getItem(COMPANY_INFO_STORAGE_KEY);
      if (storedCompanyInfo) {
        setCompanyInfo(JSON.parse(storedCompanyInfo));
      }
    } catch (error) {
      console.error('Failed to load data from localStorage', error);
    }
    setIsClient(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-radix-popper-content-wrapper]')) {
        return;
      }

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
      setSelectionMode(undefined);
    }
  };

  const handleDaySelect = (selectedDay: Date | undefined) => {
    if (selectedDay) {
      setDate({ from: selectedDay, to: selectedDay });
      setSelectionMode('day');
      setActiveTab(undefined);
    } else {
      setDate(undefined);
      setSelectionMode(undefined);
    }
  };

  const handleMonthSelect = (selectedMonth: Date) => {
    setDate({
      from: startOfMonth(selectedMonth),
      to: endOfMonth(selectedMonth),
    });
    setSelectionMode('month');
    setActiveTab(undefined);
  };

  const handleYearSelect = (selectedYear: Date) => {
    setDate({ from: startOfYear(selectedYear), to: endOfYear(selectedYear) });
    setSelectionMode('year');
    setActiveTab(undefined);
  };

  const handleRangeSelect = (range: DateRange | undefined) => {
    setDate(range);
    setSelectionMode('period');
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

    return new Date(t.date) >= fromDate && new Date(t.date) <= toDate;
  });

  const totalRevenue = filteredTransactions
    .filter((t) => t.type === 'revenue')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = filteredTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const profit = totalRevenue + totalExpenses;

  const handleExport = (formatType: 'Excel' | 'PDF') => {
    if (filteredTransactions.length === 0) {
      toast({
        title: 'Nenhum dado para exportar',
        description:
          'Selecione um período com transações para gerar o arquivo.',
        variant: 'destructive',
      });
      return;
    }

    if (formatType === 'PDF') {
      const doc = new jsPDF();
      let startY = 15;
      const pageW = doc.internal.pageSize.getWidth();
      const leftMargin = 14;

      // Add company info header
      if (companyInfo?.logo) {
        try {
            const img = new Image();
            img.src = companyInfo.logo;
            const imgProps = doc.getImageProperties(img.src);
            const aspectRatio = imgProps.width / imgProps.height;
            const imgWidth = 20;
            const imgHeight = imgWidth / aspectRatio;
            doc.addImage(companyInfo.logo, 'PNG', leftMargin, startY, imgWidth, imgHeight);
        } catch(e) {
            console.error("Error adding logo to PDF", e);
        }
      }

      if (companyInfo?.name) {
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(companyInfo.name, leftMargin + (companyInfo.logo ? 25 : 0), startY + 6);
      }
      if (companyInfo?.document) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(companyInfo.document, leftMargin + (companyInfo.logo ? 25 : 0), startY + 12);
      }
      
      startY += companyInfo?.logo ? 28 : 20;

      // Report Title
      const formatDateRange = () => {
        if (!date?.from) return 'Nenhum período selecionado';
        const from = format(date.from, 'dd/MM/yyyy');
        const to = date.to ? format(date.to, 'dd/MM/yyyy') : from;
        return from === to ? `do dia ${from}` : `de ${from} a ${to}`;
      };
      
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Relatório Financeiro', leftMargin, startY);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(`Período ${formatDateRange()}`, leftMargin, startY + 6);
      startY += 12;


      const summaryData = [
        ['Receita Total:', formatCurrency(totalRevenue)],
        ['Despesa Total:', formatCurrency(totalExpenses)],
        ['Lucro/Prejuízo:', formatCurrency(profit)],
      ];

      (doc as any).autoTable({
        body: summaryData,
        startY,
        theme: 'plain',
        styles: { fontSize: 12 },
        columnStyles: { 1: { halign: 'right' } },
        didParseCell: (data: any) => {
          if (data.column.index === 0) {
            data.cell.styles.fontStyle = 'bold';
          }
          if (data.row.index === 0 && data.column.index === 1) data.cell.styles.textColor = '#16a34a'; // emerald-600
          if (data.row.index === 1 && data.column.index === 1) data.cell.styles.textColor = '#dc2626'; // red-600
          if (data.row.index === 2 && data.column.index === 1) data.cell.styles.textColor = profit >= 0 ? '#16a34a' : '#dc2626';
        },
      });
      startY = (doc as any).lastAutoTable.finalY + 10;

      let tableBody: any[][] = [];
      let tableHead: string[][] = [];
      let autoTableOptions: any = {};

      if (selectionMode === 'month' && date?.from) {
        tableHead = [['Data', 'Receitas', 'Despesas', 'Saldo']];
        const dailyData = filteredTransactions.reduce(
          (acc, t) => {
            const day = format(new Date(t.date), 'yyyy-MM-dd');
            if (!acc[day]) {
              acc[day] = { revenue: 0, expense: 0, date: new Date(t.date) };
            }
            if (t.type === 'revenue') {
              acc[day].revenue += t.amount;
            } else {
              acc[day].expense += t.amount;
            }
            return acc;
          },
          {} as Record<string, { revenue: number; expense: number; date: Date }>
        );

        tableBody = Object.values(dailyData)
          .sort((a, b) => a.date.getTime() - b.date.getTime())
          .map((d) => [
            format(d.date, 'dd/MM/yyyy'),
            d.revenue,
            d.expense,
            d.revenue + d.expense,
          ]);

        autoTableOptions = {
          head: tableHead,
          body: tableBody,
          startY,
          headStyles: { fillColor: [41, 128, 185], halign: 'center' },
          columnStyles: {
            0: { halign: 'center' },
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right' },
          },
          didParseCell: (data: any) => {
            if (data.cell.section === 'head') {
               if (data.column.index > 0) data.cell.styles.halign = 'right';
            }
            if (data.cell.section === 'body' && data.column.index > 0) {
              data.cell.text = [formatCurrency(data.cell.raw)];
              if (data.column.index === 1) data.cell.styles.textColor = '#16a34a';
              if (data.column.index === 2) data.cell.styles.textColor = '#dc2626';
              if (data.column.index === 3) {
                data.cell.styles.textColor = data.cell.raw >= 0 ? '#16a34a' : '#dc2626';
              }
            }
          },
        };
      } else if (selectionMode === 'year' && date?.from) {
        tableHead = [['Mês', 'Receitas', 'Despesas', 'Saldo']];
        const monthlyData = filteredTransactions.reduce(
          (acc, t) => {
            const monthKey = format(new Date(t.date), 'yyyy-MM');
            if (!acc[monthKey]) {
              acc[monthKey] = {
                revenue: 0,
                expense: 0,
                date: startOfMonth(new Date(t.date)),
              };
            }
            if (t.type === 'revenue') {
              acc[monthKey].revenue += t.amount;
            } else {
              acc[monthKey].expense += t.amount;
            }
            return acc;
          },
          {} as Record<string, { revenue: number; expense: number; date: Date }>
        );

        tableBody = Object.values(monthlyData)
          .sort((a, b) => a.date.getTime() - b.date.getTime())
          .map((m) => [
            format(m.date, 'MMMM/yyyy', { locale: ptBR }),
            m.revenue,
            m.expense,
            m.revenue + m.expense,
          ]);

        autoTableOptions = {
          head: tableHead,
          body: tableBody,
          startY,
          headStyles: { fillColor: [41, 128, 185], halign: 'center' },
          columnStyles: {
             0: { halign: 'left' },
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right' },
          },
          didParseCell: (data: any) => {
             if (data.cell.section === 'head') {
               if (data.column.index > 0) data.cell.styles.halign = 'right';
            }
            if (data.cell.section === 'body' && data.column.index > 0) {
              data.cell.text = [formatCurrency(data.cell.raw)];
              if (data.column.index === 1) data.cell.styles.textColor = '#16a34a';
              if (data.column.index === 2) data.cell.styles.textColor = '#dc2626';
              if (data.column.index === 3) {
                data.cell.styles.textColor = data.cell.raw >= 0 ? '#16a34a' : '#dc2626';
              }
            }
          },
        };
      } else {
        autoTableOptions = {
          head: [['Data', 'Descrição', 'Categoria', 'Valor']],
          body: filteredTransactions.map((t) => [
            format(new Date(t.date), 'dd/MM/yyyy'),
            t.description,
            t.category,
            formatCurrency(t.amount),
          ]),
          startY,
          headStyles: { fillColor: [41, 128, 185] }, // a blue color
          columnStyles: { 3: { halign: 'right' } },
          didParseCell: (data: any) => {
            if (data.column.index === 3 && data.cell.section === 'body') {
              const transaction = filteredTransactions[data.row.index];
              data.cell.styles.textColor =
                transaction.type === 'revenue' ? '#16a34a' : '#dc2626';
            }
          },
        };
      }

      (doc as any).autoTable(autoTableOptions);

      const fileName = `relatorio_financeiro_${format(
        new Date(),
        'yyyy-MM-dd'
      )}.pdf`;
      doc.save(fileName);

      toast({
        title: 'Exportação Concluída',
        description: `O arquivo ${fileName} foi gerado com sucesso.`,
      });
      return;
    }

    const dataToExport = filteredTransactions.map((t) => ({
      Data: format(new Date(t.date), 'dd/MM/yyyy'),
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
                {formatCurrency(Math.abs(totalExpenses))}
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
                      <TableCell>{format(new Date(t.date), 'dd/MM/yyyy')}</TableCell>
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
