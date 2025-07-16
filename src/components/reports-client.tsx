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
  getYear,
} from 'date-fns';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  writeBatch,
  doc,
} from 'firebase/firestore';
import { ptBR } from 'date-fns/locale';
import { FileSpreadsheet, FileText, Trash2 } from 'lucide-react';
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
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from './ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { type Transaction, type CompanyInfo } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from './ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { db } from '@/lib/firebase';

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
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
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
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);
  const [selectionMode, setSelectionMode] = useState<
    'period' | 'day' | 'month' | 'year' | undefined
  >();
  const [isClearDataAlertOpen, setIsClearDataAlertOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    const fetchData = async (id: string) => {
      try {
        const transactionsRef = collection(db, 'transactions');
        const qTransactions = query(
          transactionsRef,
          where('companyId', '==', id)
        );
        const transactionSnapshot = await getDocs(qTransactions);
        const allTransactions = transactionSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            date: (data.date as Timestamp).toDate(),
          } as Transaction;
        });
        setTransactions(allTransactions);

        const companiesRef = collection(db, 'companies');
        const qCompanies = query(companiesRef, where('document', '==', id));
        const companySnapshot = await getDocs(qCompanies);
        if (!companySnapshot.empty) {
          const companyDoc = companySnapshot.docs[0];
          setCompanyInfo({
            id: companyDoc.id,
            ...companyDoc.data(),
          } as CompanyInfo);
        }
      } catch (error) {
        console.error('Failed to load data from Firestore', error);
      } finally {
        setIsClient(true);
      }
    };

    const id = sessionStorage.getItem('current-user-company-id');
    const role = sessionStorage.getItem('current-user-role');
    setCompanyId(id);
    setUserRole(role);
    if (!id) {
      setIsClient(true);
      return;
    }
    fetchData(id);
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
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalExpenses = filteredTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const profit = totalRevenue - totalExpenses;

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
      const leftMargin = 14;

      let logoRenderedSuccessfully = false;
      if (companyInfo?.logo) {
        try {
          // Note: Adding images from URL might be blocked by CORS in some environments.
          // A server-side proxy or fetching the image as a blob might be needed.
          const img = new Image();
          img.crossOrigin = 'Anonymous';
          img.src = companyInfo.logo;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL('image/png');

            const imgProps = doc.getImageProperties(dataUrl);
            const aspectRatio = imgProps.width / imgProps.height;
            const imgWidth = 20;
            const imgHeight = imgWidth / aspectRatio;
            doc.addImage(
              dataUrl,
              'PNG',
              leftMargin,
              startY,
              imgWidth,
              imgHeight
            );
            logoRenderedSuccessfully = true;
            generatePdfContent(
              doc,
              startY,
              leftMargin,
              logoRenderedSuccessfully
            );
          };
          img.onerror = () => {
            generatePdfContent(doc, startY, leftMargin, false);
          };
        } catch (e) {
          console.error('Error adding logo to PDF', e);
          generatePdfContent(doc, startY, leftMargin, false);
        }
      } else {
        generatePdfContent(doc, startY, leftMargin, false);
      }
      return;
    }

    // Excel Export
    const dataToExport = filteredTransactions.map((t) => ({
      Data: format(new Date(t.date), 'dd/MM/yyyy'),
      Descrição: t.description,
      Tipo: t.subtype,
      Valor: t.amount,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);

    const range = XLSX.utils.decode_range(worksheet['!ref']!);
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const cell_address = { c: 3, r: R };
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
        ['', '', 'Receita Total', totalRevenue],
        ['', '', 'Despesa Total', totalExpenses],
        ['', '', 'Lucro/Prejuízo', profit],
      ],
      { origin: -1 }
    );

    const new_range = XLSX.utils.decode_range(worksheet['!ref']!);
    for (let R = new_range.e.r - 2; R <= new_range.e.r; ++R) {
      const cell_address = { c: 3, r: R };
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

  const generatePdfContent = (
    doc: jsPDF,
    startY: number,
    leftMargin: number,
    logoRendered: boolean
  ) => {
    const textXOffset = logoRendered ? 25 : 0;
    if (companyInfo?.name) {
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(companyInfo.name, leftMargin + textXOffset, startY + 6);
    }
    if (companyInfo?.document) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(companyInfo.document, leftMargin + textXOffset, startY + 12);
    }

    startY += logoRendered ? 28 : 20;

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
        if (data.column.index === 0) data.cell.styles.fontStyle = 'bold';
        if (data.row.index === 0 && data.column.index === 1)
          data.cell.styles.textColor = '#16a34a';
        if (data.row.index === 1 && data.column.index === 1)
          data.cell.styles.textColor = '#dc2626';
        if (data.row.index === 2 && data.column.index === 1)
          data.cell.styles.textColor = profit >= 0 ? '#16a34a' : '#dc2626';
      },
    });
    startY = (doc as any).lastAutoTable.finalY + 10;

    let autoTableOptions: any;
    if (selectionMode === 'month' || selectionMode === 'year') {
      const timeUnit = selectionMode === 'month' ? 'yyyy-MM-dd' : 'yyyy-MM';
      const headerLabel = selectionMode === 'month' ? 'Data' : 'Mês';
      const tableHead = [[headerLabel, 'Receitas', 'Despesas', 'Saldo']];
      const dataMap = filteredTransactions.reduce(
        (acc, t) => {
          const key = format(new Date(t.date), timeUnit);
          if (!acc[key]) {
            acc[key] = { revenue: 0, expense: 0, date: new Date(t.date) };
          }
          if (t.type === 'revenue') acc[key].revenue += t.amount;
          else acc[key].expense += t.amount;
          return acc;
        },
        {} as Record<string, { revenue: number; expense: number; date: Date }>
      );

      const tableBody = Object.values(dataMap)
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .map((d) => [
          selectionMode === 'month'
            ? format(d.date, 'dd/MM/yyyy')
            : format(d.date, 'MMMM/yyyy', { locale: ptBR }),
          Math.abs(d.revenue),
          Math.abs(d.expense),
          d.revenue - d.expense, // Keep expense negative for subtraction
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
          if (data.cell.section === 'head' && data.column.index > 0)
            data.cell.styles.halign = 'right';
          if (data.cell.section === 'body' && data.column.index > 0) {
            data.cell.text = [formatCurrency(data.cell.raw)];
            if (data.column.index === 1)
              data.cell.styles.textColor = '#16a34a';
            if (data.column.index === 2)
              data.cell.styles.textColor = '#dc2626';
            if (data.column.index === 3)
              data.cell.styles.textColor =
                data.cell.raw >= 0 ? '#16a34a' : '#dc2626';
          }
        },
      };
    } else {
      autoTableOptions = {
        head: [['Data', 'Descrição', 'Tipo', 'Valor']],
        body: filteredTransactions.map((t) => [
          format(new Date(t.date), 'dd/MM/yyyy'),
          t.description,
          t.subtype,
          formatCurrency(t.amount),
        ]),
        startY,
        headStyles: { fillColor: [41, 128, 185] },
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
  };

  const handleClearOldData = async () => {
    if (!companyId) return;
    const currentYear = new Date().getFullYear();
    const batch = writeBatch(db);
    let oldTransactionsCount = 0;

    const transactionsToDelete = transactions.filter(
      (t) => getYear(new Date(t.date)) < currentYear
    );

    transactionsToDelete.forEach((t) => {
      batch.delete(doc(db, 'transactions', t.id));
      oldTransactionsCount++;
    });

    if (oldTransactionsCount > 0) {
      try {
        await batch.commit();
        setTransactions(
          transactions.filter((t) => getYear(new Date(t.date)) >= currentYear)
        );
        toast({
          title: 'Sucesso!',
          description: `${oldTransactionsCount} lançamento(s) de anos anteriores foram removidos.`,
        });
      } catch (error: any) {
        console.error('Failed to clear old data:', error);
        toast({
          title: 'Erro!',
          description:
            error.code === 'permission-denied'
              ? 'Permissão negada para limpar os dados.'
              : 'Não foi possível limpar os dados antigos.',
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: 'Nenhum dado antigo',
        description: 'Não há lançamentos de anos anteriores para remover.',
      });
    }

    setIsClearDataAlertOpen(false);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [date, itemsPerPage]);

  const totalItems = filteredTransactions.length;
  const totalPages = itemsPerPage > 0 ? Math.ceil(totalItems / itemsPerPage) : 1;
  const paginatedTransactions =
    itemsPerPage > 0
      ? filteredTransactions
          .sort(
            (a, b) =>
              new Date(b.date as Date).getTime() -
              new Date(a.date as Date).getTime()
          )
          .slice(
            (currentPage - 1) * itemsPerPage,
            currentPage * itemsPerPage
          )
      : filteredTransactions.sort(
          (a, b) =>
            new Date(b.date as Date).getTime() -
            new Date(a.date as Date).getTime()
        );

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
            <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
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
              {userRole === 'company_admin' && (
                <Button
                  variant="destructive"
                  onClick={() => setIsClearDataAlertOpen(true)}
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Limpar Dados Antigos
                </Button>
              )}
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
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTransactions.length > 0 ? (
                  paginatedTransactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        {format(new Date(t.date as Date), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="font-medium">
                        {t.description}
                      </TableCell>
                       <TableCell>{t.subtype}</TableCell>
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
        {itemsPerPage > 0 && totalPages > 1 && (
          <CardFooter className="flex items-center justify-between pt-4">
            <div className="text-sm text-muted-foreground">
              Total de {totalItems} lançamento(s).
            </div>
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium">Itens por página</p>
              <Select
                value={`${itemsPerPage}`}
                onValueChange={(value) => {
                  setItemsPerPage(Number(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={itemsPerPage} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 30, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                  <SelectItem value="0">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Próximo
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>
      <AlertDialog
        open={isClearDataAlertOpen}
        onOpenChange={setIsClearDataAlertOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá permanentemente todos os lançamentos de anos
              anteriores ao ano atual ({new Date().getFullYear()}). Esta ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearOldData}>
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
