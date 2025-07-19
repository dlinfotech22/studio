
'use client';

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  runTransaction,
} from 'firebase/firestore';
import {
  Search,
  FileSpreadsheet,
  FileText,
  PackagePlus,
  MoreHorizontal,
  PackageX,
  Archive,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';

import { type Product, type CompanyInfo } from '@/lib/types';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { db } from '@/lib/firebase';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent, CardFooter } from './ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

export function InventoryClient() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const [isRestockDialogOpen, setIsRestockDialogOpen] = useState(false);
  const [productToRestock, setProductToRestock] = useState<Product | null>(
    null
  );
  const [restockQuantity, setRestockQuantity] = useState<number | ''>('');

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    const fetchData = async (id: string) => {
      try {
        const productsRef = collection(db, 'products');
        const q = query(productsRef, where('companyId', '==', id));
        const snapshot = await getDocs(q);
        const fetchedProducts = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Product)
        );
        setProducts(fetchedProducts);

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
        console.error('Failed to load products from Firestore', error);
      }
    };

    const id = sessionStorage.getItem('current-user-company-id');
    setCompanyId(id);
    if (id) {
      fetchData(id);
    }
  }, []);

  const handleOpenRestockDialog = (product: Product) => {
    setProductToRestock(product);
    setRestockQuantity('');
    setIsRestockDialogOpen(true);
  };

  const handleConfirmRestock = async () => {
    if (!productToRestock || !restockQuantity || restockQuantity <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'Por favor, insira uma quantidade positiva para repor.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const productRef = doc(db, 'products', productToRestock.id);
      await runTransaction(db, async (transaction) => {
        const productDoc = await transaction.get(productRef);
        if (!productDoc.exists()) {
          throw new Error('Produto não encontrado.');
        }
        const currentQuantity = productDoc.data().quantity;
        const newQuantity = currentQuantity + Number(restockQuantity);
        transaction.update(productRef, { quantity: newQuantity });
      });

      setProducts(
        products.map((p) =>
          p.id === productToRestock.id
            ? { ...p, quantity: p.quantity + Number(restockQuantity) }
            : p
        )
      );

      toast({
        title: 'Sucesso!',
        description: `Estoque do produto ${productToRestock.name} atualizado.`,
      });
    } catch (error: any) {
      console.error('Failed to restock product:', error);
      toast({
        title: 'Erro!',
        description: error.message || 'Não foi possível repor o estoque.',
        variant: 'destructive',
      });
    } finally {
      setIsRestockDialogOpen(false);
      setProductToRestock(null);
    }
  };

  const handleExport = (
    formatType: 'Excel' | 'PDF',
    productsToExport: Product[]
  ) => {
    if (productsToExport.length === 0) {
      toast({
        title: 'Nenhum produto para exportar',
        description: 'Não há produtos na lista para gerar o arquivo.',
        variant: 'destructive',
      });
      return;
    }

    const totalValue = productsToExport.reduce(
      (sum, p) => sum + p.price * p.quantity,
      0
    );

    if (formatType === 'PDF') {
      const doc = new jsPDF();
      let startY = 15;
      const leftMargin = 14;

      if (companyInfo?.name) {
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(companyInfo.name, leftMargin, startY);
      }
      startY += 8;

      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Relatório de Estoque', leftMargin, startY);
      startY += 6;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy')}`, leftMargin, startY);
      startY += 10;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`Valor Total do Estoque: ${formatCurrency(totalValue)}`, leftMargin, startY);
      startY += 10;

      const tableHead = [
        ['Produto', 'Cód. Barras', 'Qtde.', 'Preço Venda (UN)'],
      ];
      const tableBody = productsToExport.map((p) => [
        p.name,
        p.barcode || '-',
        p.quantity,
        formatCurrency(p.price),
      ]);

      (doc as any).autoTable({
        head: tableHead,
        body: tableBody,
        startY,
        headStyles: { fillColor: [41, 128, 185] },
        columnStyles: {
          2: { halign: 'right' },
          3: { halign: 'right' },
        },
      });

      const fileName = `relatorio_estoque_${format(
        new Date(),
        'yyyy-MM-dd'
      )}.pdf`;
      doc.save(fileName);
      toast({
        title: 'Exportação Concluída',
        description: `O arquivo ${fileName} foi gerado.`,
      });
      return;
    }

    // Excel Export
    const dataToExport = productsToExport.map((p) => ({
      'Produto': p.name,
      'Código de Barras': p.barcode || '',
      'Quantidade': p.quantity,
      'Preço de Venda': p.price,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    XLSX.utils.sheet_add_aoa(
      worksheet,
      [['', '', 'Valor Total do Estoque:', totalValue]],
      { origin: -1 }
    );

    worksheet['!cols'] = [{ wch: 40 }, { wch: 20 }, { wch: 15 }, { wch: 15 }];
    const priceRange = XLSX.utils.decode_range(worksheet['!ref']!);
    for (let R = priceRange.s.r + 1; R <= priceRange.e.r; ++R) {
      const cell_address = { c: 3, r: R };
      const cell_ref = XLSX.utils.encode_cell(cell_address);
      if (worksheet[cell_ref]) {
        worksheet[cell_ref].t = 'n';
        worksheet[cell_ref].z = '"R$"#,##0.00';
      }
    }
    const totalCellRef = XLSX.utils.encode_cell({ c: 3, r: priceRange.e.r + 1 });
    if (worksheet[totalCellRef]) {
      worksheet[totalCellRef].t = 'n';
      worksheet[totalCellRef].z = '"R$"#,##0.00';
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Estoque');
    const fileName = `relatorio_estoque_${format(
      new Date(),
      'yyyy-MM-dd'
    )}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast({
      title: 'Exportação Concluída',
      description: `O arquivo ${fileName} foi gerado.`,
    });
  };

  const filteredProducts = products
    .filter(
      (p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.barcode || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  const lowStockProducts = filteredProducts.filter(
    (p) => p.quantity <= (p.minimumStock ?? 0)
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage, activeTab]);

  const renderTable = (productsToShow: Product[]) => {
    const totalItems = productsToShow.length;
    const totalPages =
      itemsPerPage > 0 ? Math.ceil(totalItems / itemsPerPage) : 1;
    const paginatedProducts =
      itemsPerPage > 0
        ? productsToShow.slice(
            (currentPage - 1) * itemsPerPage,
            currentPage * itemsPerPage
          )
        : productsToShow;

    if (productsToShow.length === 0 && activeTab === 'low-stock') {
      return (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm p-8 text-center h-[200px]">
          <div className="flex flex-col items-center gap-2">
            <PackageX className="w-16 h-16 text-muted-foreground" />
            <h2 className="text-2xl font-semibold">
              Nenhum produto com estoque baixo!
            </h2>
            <p className="max-w-md mt-2 text-sm text-muted-foreground">
              Todos os produtos estão acima do nível mínimo de estoque definido.
            </p>
          </div>
        </div>
      );
    }
    return (
      <Card>
        <CardContent className="p-0">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Produto</TableHead>
                  <TableHead>Código de Barras</TableHead>
                  <TableHead className="text-right">
                    Quantidade em Estoque
                  </TableHead>
                  <TableHead className="text-right">Preço de Venda</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProducts.length > 0 ? (
                  paginatedProducts.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.barcode || '-'}</TableCell>
                      <TableCell
                        className={cn(
                          'text-right font-semibold',
                          item.quantity <= (item.minimumStock ?? 0) &&
                            'text-red-500'
                        )}
                      >
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(item.price)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleOpenRestockDialog(item)}
                            >
                              <PackagePlus className="mr-2 h-4 w-4" /> Repor
                              Estoque
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      Nenhum produto encontrado.
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
              Total de {totalItems} produto(s).
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
                  {[10, 20, 30, 50].map((pageSize) => (
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
    );
  };

  const productsForCurrentTab =
    activeTab === 'all' ? filteredProducts : lowStockProducts;

  return (
    <>
      <div className="flex flex-col gap-4 mb-4 md:flex-row md:items-center">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por nome ou código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
            autoComplete="off"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          <Button
            variant="outline"
            onClick={() => handleExport('Excel', productsForCurrentTab)}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Exportar para Excel
          </Button>
          <Button onClick={() => handleExport('PDF', productsForCurrentTab)}>
            <FileText className="mr-2 h-4 w-4" />
            Gerar Relatório PDF
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">
            <Archive className="mr-2 h-4 w-4" />
            Todos os Produtos
          </TabsTrigger>
          <TabsTrigger value="low-stock">
            <PackageX className="mr-2 h-4 w-4" />
            Estoque Baixo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">{renderTable(filteredProducts)}</TabsContent>

        <TabsContent value="low-stock">
          {renderTable(lowStockProducts)}
        </TabsContent>
      </Tabs>

      <Dialog open={isRestockDialogOpen} onOpenChange={setIsRestockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Repor Estoque</DialogTitle>
            <DialogDescription>
              Adicione uma quantidade ao estoque do produto selecionado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">{productToRestock?.name}</h4>
              <p className="text-sm text-muted-foreground">
                Quantidade atual: {productToRestock?.quantity}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="restock-quantity">
                Quantidade a Adicionar
              </Label>
              <Input
                id="restock-quantity"
                type="number"
                min="1"
                placeholder="0"
                value={restockQuantity}
                onChange={(e) =>
                  setRestockQuantity(
                    e.target.value === '' ? '' : Number(e.target.value)
                  )
                }
                autoFocus
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancelar
              </Button>
            </DialogClose>
            <Button onClick={handleConfirmRestock}>Confirmar Reposição</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
