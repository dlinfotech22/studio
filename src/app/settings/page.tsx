'use client';

import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTheme } from 'next-themes';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  addDoc,
  deleteDoc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import {
  Edit,
  Trash2,
  PlusCircle,
  MoreHorizontal,
  Moon,
  Sun,
  Image as ImageIcon,
  Search,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { type User, type Category, type CompanyInfo } from '@/lib/types';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { capitalizeFirstLetter } from '@/lib/utils';
import { db, storage } from '@/lib/firebase';

// Schemas
const profileSchema = z
  .object({
    currentPassword: z.string().min(1, 'Senha atual é obrigatória.'),
    newPassword: z.string().min(6, 'A nova senha deve ter no mínimo 6 caracteres.'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  });

const companyInfoSchema = z.object({
  name: z.string().min(1, 'O nome da empresa é obrigatório.'),
  document: z.string().min(1, 'O CNPJ/CPF é obrigatório.'),
  logo: z.string().optional(),
});

const categorySchema = z.object({
  name: z.string().min(1, 'O nome da categoria é obrigatório.'),
  type: z.enum(['revenue', 'expense']),
});

// Default values
const defaultCategories: Omit<Category, 'companyId' | 'id'>[] = [
  { name: 'Prestação de Serviço', type: 'revenue' },
  { name: 'Venda de Produtos', type: 'revenue' },
  { name: 'Salários', type: 'expense' },
  { name: 'Fornecedores', type: 'expense' },
  { name: 'Aluguel', type: 'expense' },
];

const defaultCompanyInfo: CompanyInfo = {
  id: '',
  name: '',
  document: '',
  logo: '',
};

// Sub-components for each settings tab
function UserProfile() {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const username = sessionStorage.getItem('current-user');
      if (username) {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('username', '==', username));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          setCurrentUser({ id: userDoc.id, ...userDoc.data() } as User);
        }
      }
    };
    fetchUser();
  }, []);

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof profileSchema>) => {
    if (!currentUser) return;

    if (values.currentPassword !== currentUser.password) {
      form.setError('currentPassword', { message: 'Senha atual incorreta.' });
      return;
    }

    try {
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, { password: values.newPassword });
      toast({ title: 'Sucesso!', description: 'Sua senha foi alterada.' });
      form.reset();
    } catch (error: any) {
      console.error('Failed to update password:', error);
      toast({
        title: 'Erro!',
        description:
          error.code === 'permission-denied'
            ? 'Permissão negada para alterar a senha.'
            : 'Não foi possível alterar a senha.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Perfil de Usuário</CardTitle>
        <CardDescription>Altere sua senha de acesso.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-md">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha Atual</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nova Senha</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmar Nova Senha</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <Button type="submit">Salvar Alterações</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function CompanyProfile() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(defaultCompanyInfo);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [isCompanyAdmin, setIsCompanyAdmin] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const fetchCompanyInfo = async (id: string) => {
      try {
        const companiesRef = collection(db, 'companies');
        const q = query(companiesRef, where('document', '==', id));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const companyDoc = querySnapshot.docs[0];
          setCompanyInfo({ id: companyDoc.id, ...companyDoc.data() } as CompanyInfo);
        }
      } catch (e) {
        console.error(e);
      }
    };

    const id = sessionStorage.getItem('current-user-company-id');
    const role = sessionStorage.getItem('current-user-role');
    setIsSystemAdmin(role === 'system_admin');
    setIsCompanyAdmin(role === 'company_admin');
    setCompanyId(id);
    if (id) {
      fetchCompanyInfo(id);
    }
  }, []);

  const form = useForm<z.infer<typeof companyInfoSchema>>({
    resolver: zodResolver(companyInfoSchema),
    values: companyInfo,
  });

  useEffect(() => {
    form.reset(companyInfo);
  }, [companyInfo, form]);

  const onSubmit = async (values: z.infer<typeof companyInfoSchema>) => {
    if (!companyId || (!isSystemAdmin && !isCompanyAdmin)) return;

    try {
      const updatedInfo = { ...companyInfo, ...values, name: values.name.toUpperCase() };
      const companyRef = doc(db, 'companies', updatedInfo.id);
      await updateDoc(companyRef, {
        name: updatedInfo.name,
        logo: updatedInfo.logo,
      });

      setCompanyInfo(updatedInfo);
      toast({ title: 'Sucesso!', description: 'Informações da empresa salvas.' });
      form.reset(updatedInfo);
    } catch (error: any) {
      console.error('Failed to save company info:', error);
      toast({
        title: 'Erro!',
        description:
          error.code === 'permission-denied'
            ? 'Permissão negada para salvar informações da empresa.'
            : 'Não foi possível salvar as informações.',
        variant: 'destructive',
      });
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if ((!isSystemAdmin && !isCompanyAdmin) || !companyId) return;
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        const logoStorageRef = storageRef(storage, `logos/${companyId}/${file.name}`);
        await uploadBytes(logoStorageRef, file);
        const downloadURL = await getDownloadURL(logoStorageRef);
        form.setValue('logo', downloadURL);
        setCompanyInfo((prev) => ({ ...prev, logo: downloadURL }));
        toast({ title: 'Sucesso!', description: 'Logo carregado. Clique em salvar para aplicar.' });
      } catch (error) {
        console.error('Failed to upload logo:', error);
        toast({
          title: 'Erro de Upload!',
          description: 'Não foi possível carregar o logo.',
          variant: 'destructive',
        });
      } finally {
        setIsUploading(false);
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informações da Empresa</CardTitle>
        <CardDescription>
          {isSystemAdmin
            ? 'Como administrador do sistema, você pode alterar o nome e o logo da empresa.'
            : isCompanyAdmin
            ? 'Como administrador da empresa, você pode alterar o logo.'
            : 'Somente administradores podem editar estas informações.'}
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={form.watch('logo')} />
                <AvatarFallback>
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={(!isSystemAdmin && !isCompanyAdmin) || isUploading}
              >
                {isUploading ? 'Carregando...' : 'Carregar Logo'}
              </Button>
              <Input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/png, image/jpeg"
                onChange={handleLogoChange}
                disabled={(!isSystemAdmin && !isCompanyAdmin) || isUploading}
              />
            </div>
            <div className="max-w-md space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Empresa</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        disabled={!isSystemAdmin}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="document"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CNPJ / CPF</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={true} />
                    </FormControl>
                    <FormDescription>
                      O documento é o identificador único da empresa e não pode ser alterado.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={(!isSystemAdmin && !isCompanyAdmin) || isUploading}>Salvar Informações</Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

function CategoryManagement() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'revenue' | 'expense'>('revenue');

  const form = useForm<z.infer<typeof categorySchema>>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      type: 'revenue',
    },
  });

  useEffect(() => {
    const fetchCategories = async (id: string) => {
      try {
        const categoriesRef = collection(db, 'categories');
        const q = query(categoriesRef, where('companyId', '==', id));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          // If no categories exist, create default ones
          const batch = writeBatch(db);
          const companyDefaultCategories = defaultCategories.map((c) => {
            const newDocRef = doc(collection(db, 'categories'));
            const newCategory = { ...c, companyId: id };
            batch.set(newDocRef, newCategory);
            return { id: newDocRef.id, ...newCategory };
          });
          await batch.commit();
          setCategories(companyDefaultCategories);
        } else {
          const fetchedCategories = querySnapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() } as Category)
          );
          setCategories(fetchedCategories);
        }
      } catch (e) {
        console.error('Failed to load or set categories:', e);
      }
    };

    const id = sessionStorage.getItem('current-user-company-id');
    setCompanyId(id);
    if (id) {
      fetchCategories(id);
    }
  }, []);

  const onSubmit = async (values: z.infer<typeof categorySchema>) => {
    if (!companyId) return;
    const payload = { ...values, companyId, name: capitalizeFirstLetter(values.name) };

    try {
      if (editingCategory) {
        const categoryRef = doc(db, 'categories', editingCategory.id);
        await updateDoc(categoryRef, { name: payload.name, type: payload.type });
        setCategories(
          categories.map((c) =>
            c.id === editingCategory.id ? { ...editingCategory, ...payload } : c
          )
        );
        toast({ title: 'Sucesso!', description: 'Categoria atualizada.' });
      } else {
        const docRef = await addDoc(collection(db, 'categories'), payload);
        setCategories([...categories, { id: docRef.id, ...payload }]);
        toast({ title: 'Sucesso!', description: 'Categoria adicionada.' });
      }
      setEditingCategory(null);
      form.reset({ name: '', type: activeTab });
      setIsDialogOpen(false);
    } catch (error: any) {
      console.error('Failed to save category:', error);
      toast({
        title: 'Erro!',
        description:
          error.code === 'permission-denied'
            ? 'Permissão negada para salvar a categoria.'
            : 'Não foi possível salvar a categoria.',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    form.reset(category);
    setIsDialogOpen(true);
  };

  const handleDelete = (category: Category) => {
    setCategoryToDelete(category);
    setIsDeleteAlertOpen(true);
  };

  const confirmDelete = async () => {
    if (categoryToDelete) {
      try {
        await deleteDoc(doc(db, 'categories', categoryToDelete.id));
        setCategories(categories.filter((c) => c.id !== categoryToDelete.id));
        toast({ title: 'Sucesso!', description: 'Categoria removida.' });
      } catch (error: any) {
        console.error('Failed to delete category:', error);
        toast({
          title: 'Erro!',
          description:
            error.code === 'permission-denied'
              ? 'Permissão negada para remover a categoria.'
              : 'Não foi possível remover a categoria.',
          variant: 'destructive',
        });
      }
    }
    setIsDeleteAlertOpen(false);
    setCategoryToDelete(null);
  };

  const openNewDialog = (type: 'revenue' | 'expense') => {
    setEditingCategory(null);
    form.reset({ name: '', type });
    setIsDialogOpen(true);
  };

  const renderCategoryTable = (type: 'revenue' | 'expense') => {
    const data = categories.filter(
      (c) =>
        c.type === type &&
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome da Categoria</TableHead>
              <TableHead className="w-24 text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length > 0 ? (
              data.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell>{cat.name}</TableCell>
                  <TableCell className="text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleEdit(cat)}>
                          <Edit className="mr-2 h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(cat)}
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
                <TableCell colSpan={2} className="h-24 text-center">
                  Nenhuma categoria encontrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Gerenciar Categorias</CardTitle>
          <CardDescription>
            Adicione, edite ou remova categorias de receitas e despesas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v as 'revenue' | 'expense');
              setSearchTerm('');
            }}
            className="w-full"
          >
            <div className="flex flex-col gap-4 mb-4 md:flex-row md:items-center md:justify-between">
              <TabsList>
                <TabsTrigger value="revenue">Receitas</TabsTrigger>
                <TabsTrigger value="expense">Despesas</TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2">
                <div className="relative w-full md:w-auto">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Pesquisar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 w-full md:w-[250px]"
                  />
                </div>
                <Button onClick={() => openNewDialog(activeTab)}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Nova Categoria
                </Button>
              </div>
            </div>

            <TabsContent value="revenue" className="mt-0">
              {renderCategoryTable('revenue')}
            </TabsContent>
            <TabsContent value="expense" className="mt-0">
              {renderCategoryTable('expense')}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Editar' : 'Nova'} Categoria
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Categoria</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(e) =>
                          field.onChange(capitalizeFirstLetter(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex gap-4"
                    >
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <RadioGroupItem value="revenue" />
                        </FormControl>
                        <FormLabel>Receita</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <RadioGroupItem value="expense" />
                        </FormControl>
                        <FormLabel>Despesa</FormLabel>
                      </FormItem>
                    </RadioGroup>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Cancelar</Button>
                </DialogClose>
                <Button type="submit">
                  {editingCategory ? 'Salvar' : 'Adicionar'}
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
              Esta ação não pode ser desfeita e removerá a categoria.
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

function AppearanceSettings() {
  const { setTheme, theme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aparência</CardTitle>
        <CardDescription>
          Personalize a aparência do sistema.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={theme}
          onValueChange={setTheme}
          className="space-y-2"
        >
          <Label>Tema</Label>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="light" id="light" />
            <Label htmlFor="light" className="flex items-center gap-2">
              <Sun className="h-4 w-4" /> Claro
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="dark" id="dark" />
            <Label htmlFor="dark" className="flex items-center gap-2">
              <Moon className="h-4 w-4" /> Escuro
            </Label>
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [hasCompany, setHasCompany] = useState(false);

  useEffect(() => {
    const role = sessionStorage.getItem('current-user-role');
    const companyId = sessionStorage.getItem('current-user-company-id');
    setIsSystemAdmin(role === 'system_admin');
    setHasCompany(!!companyId);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie as configurações da sua conta e aparência do sistema.
        </p>
      </header>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList>
          <TabsTrigger value="profile">Perfil</TabsTrigger>
          {hasCompany && (
            <>
              <TabsTrigger value="company">Empresa</TabsTrigger>
              <TabsTrigger value="categories">Categorias</TabsTrigger>
            </>
          )}
          <TabsTrigger value="appearance">Aparência</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="mt-6">
          <UserProfile />
        </TabsContent>
        {hasCompany && (
          <>
            <TabsContent value="company" className="mt-6">
              <CompanyProfile />
            </TabsContent>
            <TabsContent value="categories" className="mt-6">
              <CategoryManagement />
            </TabsContent>
          </>
        )}
        <TabsContent value="appearance" className="mt-6">
          <AppearanceSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
