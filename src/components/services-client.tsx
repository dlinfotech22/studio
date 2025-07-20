
'use client';

import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import {
  PlusCircle,
  Edit,
  Trash2,
  MoreHorizontal,
  Search,
} from 'lucide-react';
import { type Service } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { db } from '@/lib/firebase';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

const serviceSchema = z.object({
  name: z.string().min(1, 'O nome do serviço é obrigatório.'),
  price: z.coerce.number().positive('O preço deve ser um valor positivo.'),
});

type ServiceFormValues = z.infer<typeof serviceSchema>;

export function ServicesClient() {
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  useEffect(() => {
    const fetchData = async (id: string) => {
      try {
        const servicesRef = collection(db, 'services');
        const q = query(servicesRef, where('companyId', '==', id));
        const snapshot = await getDocs(q);
        const fetchedServices = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Service)
        );
        setServices(fetchedServices);
      } catch (error) {
        console.error('Failed to load services from Firestore', error);
      }
    };

    const id = sessionStorage.getItem('current-user-company-id');
    setCompanyId(id);
    if (id) {
      fetchData(id);
    }
  }, []);

  useEffect(() => {
    let servicesToDisplay = services.filter(
      (p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    setFilteredServices(
      servicesToDisplay.sort((a, b) => a.name.localeCompare(b.name))
    );
  }, [services, searchTerm]);

  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: '',
      price: 0,
    },
  });

  const onSubmit = async (data: ServiceFormValues) => {
    if (!companyId) return;

    const payload = { ...data, name: data.name, companyId };

    try {
      if (editingService) {
        const serviceRef = doc(db, 'services', editingService.id);
        await updateDoc(serviceRef, payload);
        setServices(
          services.map((p) =>
            p.id === editingService.id ? { ...p, ...payload } : p
          )
        );
        toast({ title: 'Sucesso!', description: 'Serviço atualizado.' });
      } else {
        const docRef = await addDoc(collection(db, 'services'), payload);
        setServices([...services, { id: docRef.id, ...payload }]);
        toast({ title: 'Sucesso!', description: 'Serviço adicionado.' });
      }
      setIsDialogOpen(false);
      form.reset();
    } catch (error: any) {
      console.error('Failed to save service', error);
      toast({
        title: 'Erro!',
        description:
          error.code === 'permission-denied'
            ? 'Permissão negada para salvar o serviço.'
            : 'Não foi possível salvar o serviço.',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    form.reset(service);
    setIsDialogOpen(true);
  };

  const handleDelete = (service: Service) => {
    setServiceToDelete(service);
    setIsDeleteAlertOpen(true);
  };

  const confirmDelete = async () => {
    if (serviceToDelete) {
      try {
        await deleteDoc(doc(db, 'services', serviceToDelete.id));
        setServices(services.filter((p) => p.id !== serviceToDelete.id));
        toast({ title: 'Sucesso!', description: 'Serviço removido.' });
      } catch (error: any) {
        console.error('Failed to delete service', error);
        toast({
          title: 'Erro!',
          description:
            error.code === 'permission-denied'
              ? 'Permissão negada para remover o serviço.'
              : 'Não foi possível remover o serviço.',
          variant: 'destructive',
        });
      }
    }
    setIsDeleteAlertOpen(false);
    setServiceToDelete(null);
  };

  const openNewServiceDialog = () => {
    setEditingService(null);
    form.reset({ name: '', price: 0 });
    setIsDialogOpen(true);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

  const totalItems = filteredServices.length;
  const totalPages =
    itemsPerPage > 0 ? Math.ceil(totalItems / itemsPerPage) : 1;
  const paginatedData =
    itemsPerPage > 0
      ? filteredServices.slice(
          (currentPage - 1) * itemsPerPage,
          currentPage * itemsPerPage
        )
      : filteredServices;

  return (
    <>
      <div className="flex flex-col gap-4 mb-4 md:flex-row md:items-center">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
            autoComplete="off"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 ml-auto">
          <Button onClick={openNewServiceDialog}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Adicionar Serviço
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome do Serviço</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
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
                          <DropdownMenuItem onClick={() => handleEdit(item)}>
                            <Edit className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(item)}
                            className="text-red-500"
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Deletar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">
                    Nenhum serviço encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {itemsPerPage > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Total de {totalItems} serviço(s).
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
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingService ? 'Editar' : 'Adicionar'} Serviço
            </DialogTitle>
            <DialogDescription>
              Preencha os detalhes do serviço para o seu catálogo.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Serviço</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: Instalação de Software"
                        {...field}
                        onChange={(e) =>
                          field.onChange(e.target.value.toUpperCase())
                        }
                        autoComplete="off"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preço (R$)</FormLabel>
                    <FormControl>
                       <Input
                        type="number"
                        placeholder="0.00"
                        autoComplete="off"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">
                    Cancelar
                  </Button>
                </DialogClose>
                <Button type="submit">
                  {editingService ? 'Salvar Alterações' : 'Adicionar'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <AlertDialog
        open={isDeleteAlertOpen}
        onOpenChange={setIsDeleteAlertOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá o serviço do seu catálogo. Lançamentos
              associados a este serviço não serão afetados, mas o vínculo será
              perdido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
