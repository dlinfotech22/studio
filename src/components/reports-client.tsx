
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
import { type Transaction, type CompanyInfo, type Product } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from './ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { db } from '@/lib/firebase';
import { Label } from './ui/label';

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
                  <TableHead>Tipo</TableHead>
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
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);
  const [selectionMode, setSelectionMode] = useState<
    'period' | 'day' | 'month' | 'year' | undefined
  >();
  const [isClearDataDialogOpen, setIsClearDataDialogOpen] = useState(false);
  const [deletableYears, setDeletableYears] = useState<number[]>([]);
  const [yearToClear, setYearToClear] = useState<number | null>(null);

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

  const getTransactionAdditionalInfo = (transaction: Transaction) => {
    const baseDescription = transaction.subtype === 'Despesa'
        ? 'DESPESA GERAL'
        : `LANÇAMENTO PARA ${transaction.customerName?.toUpperCase()}`;

    if (transaction.description.startsWith(baseDescription)) {
        const additionalInfo = transaction.description.substring(baseDescription.length);
        if (additionalInfo.startsWith(' - ')) {
            return additionalInfo.substring(3);
        }
        return additionalInfo;
    }
    return transaction.description;
  };
  
  const prepareExportData = (transactionsToExport: Transaction[]) => {
    return transactionsToExport.map(t => {
      const productTotal = t.items?.reduce((sum, item) => sum + item.quantity * item.price, 0) || 0;
      const serviceTotal = t.services?.reduce((sum, service) => sum + service.price, 0) || 0;
      const itemsList = t.items?.map(item => `${item.quantity}x ${item.productName}`).join(', ') || '';
      const servicesList = t.services?.map(service => service.serviceName).join(', ') || '';

      return {
        'Data': format(new Date(t.date), 'dd/MM/yyyy'),
        'ID': t.sequentialId ? String(t.sequentialId).padStart(8, '0') : t.id.substring(0,8).toUpperCase(),
        'Cliente': t.customerName || '',
        'Descrição Adicional': getTransactionAdditionalInfo(t),
        'Itens': itemsList,
        'Serviços': servicesList,
        'Total Produtos (R$)': productTotal,
        'Total Serviços (R$)': serviceTotal,
        'Valor Total (R$)': t.amount,
        'Tipo': t.type, // For PDF coloring
      };
    });
  };

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
    
    const dataToExport = prepareExportData(filteredTransactions);

    if (formatType === 'Excel') {
      const worksheet = XLSX.utils.json_to_sheet(dataToExport.map(d => {
        const {Tipo, ...rest} = d;
        return rest;
      }));
  
      worksheet['!cols'] = [
        { wch: 12 }, { wch: 10 }, { wch: 30 }, { wch: 40 }, { wch: 30 }, { wch: 30 },
        { wch: 20 }, { wch: 20 }, { wch: 20 }
      ];
      
      const range = XLSX.utils.decode_range(worksheet['!ref']!);
      for (let R = range.s.r + 1; R <= range.e.r; ++R) {
          for (let C of [6, 7, 8]) { // Columns for currency
              const cell_address = { c: C, r: R };
              const cell_ref = XLSX.utils.encode_cell(cell_address);
              if (worksheet[cell_ref] && typeof worksheet[cell_ref].v === 'number' && worksheet[cell_ref].v > 0) {
                  worksheet[cell_ref].t = 'n';
                  worksheet[cell_ref].z = '"R$"#,##0.00';
              } else if (worksheet[cell_ref]) {
                 worksheet[cell_ref].v = ''; // Clear cell if value is 0
              }
          }
      }
  
      // Add summary
      XLSX.utils.sheet_add_aoa(
        worksheet,
        [
          [],
          ['', '', '', '', '', '', 'Receita Total', totalRevenue],
          ['', '', '', '', '', '', 'Despesa Total', totalExpenses],
          ['', '', '', '', '', '', 'Lucro/Prejuízo', profit],
        ],
        { origin: -1 }
      );
      
      const summaryStartRow = range.e.r + 3;
      for (let R = summaryStartRow; R <= summaryStartRow + 2; ++R) {
          const cell_address = { c: 7, r: R };
          const cell_ref = XLSX.utils.encode_cell(cell_address);
          if (worksheet[cell_ref] && typeof worksheet[cell_ref].v === 'number') {
              worksheet[cell_ref].t = 'n';
              worksheet[cell_ref].z = '"R$"#,##0.00';
          }
      }
  
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

    } else if (formatType === 'PDF') {
      const doc = new jsPDF({ orientation: 'landscape' });
      generatePdfContent(doc, dataToExport);
    }
  };

  const generatePdfContent = (doc: jsPDF, data: any[]) => {
    let startY = 15;
    const leftMargin = 14;

    if (companyInfo?.name) {
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(companyInfo.name, leftMargin, startY);
      startY += 8;
    }
    
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
      styles: { fontSize: 10 },
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
    startY = (doc as any).lastAutoTable.finalY + 8;
    
    const tableHead = [['Data', 'Cliente', 'Descrição Adicional', 'Itens', 'Serviços', 'Total Produtos', 'Total Serviços', 'Valor Total']];
    const tableBody = data.map(t => [
        t['Data'],
        t['Cliente'],
        t['Descrição Adicional'],
        t['Itens'],
        t['Serviços'],
        t['Total Produtos (R$)'] > 0 ? formatCurrency(t['Total Produtos (R$)']) : '-',
        t['Total Serviços (R$)'] > 0 ? formatCurrency(t['Total Serviços (R$)']) : '-',
        formatCurrency(t['Valor Total (R$)'])
    ]);
    
    (doc as any).autoTable({
        head: tableHead,
        body: tableBody,
        startY,
        headStyles: { fillColor: [41, 128, 185], fontSize: 7 },
        styles: { fontSize: 6, cellPadding: 2, overflow: 'linebreak' },
        columnStyles: {
            0: { cellWidth: 18 },
            1: { cellWidth: 35 },
            2: { cellWidth: 40 },
            3: { cellWidth: 35 },
            4: { cellWidth: 35 },
            5: { halign: 'right', cellWidth: 20 },
            6: { halign: 'right', cellWidth: 20 },
            7: { halign: 'right', cellWidth: 20 },
        },
        didParseCell: (hookData: any) => {
            if (hookData.section === 'body' && hookData.column.index === 7) {
                const transactionType = data[hookData.row.index].Tipo;
                hookData.cell.styles.textColor = transactionType === 'revenue' ? '#16a34a' : '#dc2626';
            }
        },
    });

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

  const handleOpenClearDataDialog = () => {
    const currentYear = new Date().getFullYear();
    const yearsWithData = [
      ...new Set(
        transactions.map((t) => getYear(new Date(t.date)))
      ),
    ].filter((year) => year < currentYear);

    if (yearsWithData.length === 0) {
      toast({
        title: 'Nenhum dado antigo',
        description: 'Não há lançamentos de anos anteriores para remover.',
      });
      return;
    }

    setDeletableYears(yearsWithData.sort((a, b) => b - a));
    setIsClearDataDialogOpen(true);
  };

  const handleClearOldData = async () => {
    if (!companyId || !yearToClear) return;
    const batch = writeBatch(db);
    let oldTransactionsCount = 0;

    const transactionsToDelete = transactions.filter(
      (t) => getYear(new Date(t.date)) === yearToClear
    );

    transactionsToDelete.forEach((t) => {
      batch.delete(doc(db, 'transactions', t.id));
      oldTransactionsCount++;
    });

    if (oldTransactionsCount > 0) {
      try {
        await batch.commit();
        setTransactions(
          transactions.filter((t) => getYear(new Date(t.date)) !== yearToClear)
        );
        toast({
          title: 'Sucesso!',
          description: `${oldTransactionsCount} lançamento(s) do ano de ${yearToClear} foram removidos.`,
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
    }

    setIsClearDataDialogOpen(false);
    setYearToClear(null);
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
                  onClick={handleOpenClearDataDialog}
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
                  <TableHead className="w-[100px]">Data</TableHead>
                  <TableHead className="w-[150px]">Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-[120px] text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTransactions.length > 0 ? (
                  paginatedTransactions.map((t) => {
                    return (
                        <TableRow key={t.id}>
                            <TableCell>
                                {format(new Date(t.date as Date), 'dd/MM/yyyy')}
                            </TableCell>
                            <TableCell>{t.subtype}</TableCell>
                            <TableCell className="font-medium">
                                {t.description}
                            </TableCell>
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
                    );
                  })
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
      
      <Dialog
        open={isClearDataDialogOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setYearToClear(null);
          }
          setIsClearDataDialogOpen(isOpen);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Limpar Dados Antigos</DialogTitle>
            <DialogDescription>
              Selecione o ano cujos dados de transações você deseja remover
              permanentemente. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Label htmlFor="year-select">Ano para Limpeza</Label>
            <Select
              onValueChange={(value) => setYearToClear(Number(value))}
            >
              <SelectTrigger id="year-select">
                <SelectValue placeholder="Selecione um ano..." />
              </SelectTrigger>
              <SelectContent>
                {deletableYears.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleClearOldData}
              disabled={!yearToClear}
            >
              Confirmar Limpeza
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
