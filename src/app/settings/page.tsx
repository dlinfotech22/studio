'use client';

import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTheme } from 'next-themes';
import {
  Edit,
  Trash2,
  PlusCircle,
  MoreHorizontal,
  Moon,
  Sun,
  Image as ImageIcon,
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

const USERS_STORAGE_KEY = 'app-users';
const COMPANIES_STORAGE_KEY = 'app-companies';

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
const defaultCategories: Category[] = [
  { id: 'cat-rev-1', name: 'Prestação de Serviço', type: 'revenue', companyId: 'default-001' },
  { id: 'cat-rev-2', name: 'Venda de Produtos', type: 'revenue', companyId: 'default-001' },
  { id: 'cat-exp-1', name: 'Salários', type: 'expense', companyId: 'default-001' },
  { id: 'cat-exp-2', name: 'Fornecedores', type: 'expense', companyId: 'default-001' },
  { id: 'cat-exp-3', name: 'Aluguel', type: 'expense', companyId: 'default-001' },
];

const defaultCompanyInfo: CompanyInfo = {
  name: '',
  document: '',
  logo: '',
};

// Sub-components for each settings tab
function UserProfile() {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const username = localStorage.getItem('current-user');
    if (username) {
      const users: User[] = JSON.parse(
        localStorage.getItem(USERS_STORAGE_KEY) || '[]'
      );
      const user = users.find((u) => u.username === username);
      setCurrentUser(user || null);
    }
  }, []);

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = (values: z.infer<typeof profileSchema>) => {
    if (!currentUser) return;

    if (values.currentPassword !== currentUser.password) {
      form.setError('currentPassword', { message: 'Senha atual incorreta.' });
      return;
    }

    const users: User[] = JSON.parse(
      localStorage.getItem(USERS_STORAGE_KEY) || '[]'
    );
    const updatedUsers = users.map((u) =>
      u.id === currentUser.id ? { ...u, password: values.newPassword } : u
    );
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers));

    toast({ title: 'Sucesso!', description: 'Sua senha foi alterada.' });
    form.reset();
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
  const [isDocumentDisabled, setIsDocumentDisabled] = useState(true);

  useEffect(() => {
    const id = localStorage.getItem('current-user-company-id');
    setCompanyId(id);
    if (id) {
      // The document field (company ID) can only be edited if it's the placeholder value.
      setIsDocumentDisabled(id !== 'default-001');
      try {
        const allCompanies: CompanyInfo[] = JSON.parse(localStorage.getItem(COMPANIES_STORAGE_KEY) || '[]');
        const currentCompany = allCompanies.find(c => c.document === id);
        if (currentCompany) {
          setCompanyInfo(currentCompany);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const form = useForm<z.infer<typeof companyInfoSchema>>({
    resolver: zodResolver(companyInfoSchema),
    values: companyInfo,
  });

  const onSubmit = (values: z.infer<typeof companyInfoSchema>) => {
    if (!companyId) return;

    const allCompanies: CompanyInfo[] = JSON.parse(localStorage.getItem(COMPANIES_STORAGE_KEY) || '[]');

    // Prevent using a document ID that already exists
    if (values.document !== companyId && allCompanies.some(c => c.document === values.document)) {
        form.setError('document', { message: 'Este documento já está cadastrado.' });
        return;
    }

    const updatedInfo = { ...companyInfo, ...values };
    const updatedCompanies = allCompanies.map(c => c.document === companyId ? updatedInfo : c);
    
    localStorage.setItem(COMPANIES_STORAGE_KEY, JSON.stringify(updatedCompanies));
    
    // If the document ID was changed, update it for the current session and user record
    if (values.document !== companyId) {
        localStorage.setItem('current-user-company-id', values.document);

        const allUsers: User[] = JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || '[]');
        const currentUsername = localStorage.getItem('current-user');
        const updatedUsers = allUsers.map(u => u.username === currentUsername ? {...u, companyId: values.document} : u);
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers));
        setCompanyId(values.document);
        setIsDocumentDisabled(true);
    }
    
    setCompanyInfo(updatedInfo);
    toast({ title: 'Sucesso!', description: 'Informações da empresa salvas.' });
    form.reset(updatedInfo);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        form.setValue('logo', result);
        setCompanyInfo(prev => ({...prev, logo: result}));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informações da Empresa</CardTitle>
        <CardDescription>
          Essas informações serão usadas nos relatórios.
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
              >
                Carregar Logo
              </Button>
              <Input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/png, image/jpeg"
                onChange={handleLogoChange}
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
                name="document"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CNPJ / CPF</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={isDocumentDisabled} />
                    </FormControl>
                    <FormDescription>
                        O documento é o identificador único da empresa e não pode ser alterado após a configuração inicial.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit">Salvar Informações</Button>
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
  
  const form = useForm<z.infer<typeof categorySchema>>({
    resolver: zodResolver(categorySchema),
  });

  const getCategoriesStorageKey = (id: string) => `app-categories-${id}`;

  useEffect(() => {
    const id = localStorage.getItem('current-user-company-id');
    setCompanyId(id);
    if (id) {
      try {
        const storageKey = getCategoriesStorageKey(id);
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          setCategories(JSON.parse(stored));
        } else {
          const companyDefaultCategories = defaultCategories.map(c => ({...c, companyId: id}));
          setCategories(companyDefaultCategories);
          localStorage.setItem(storageKey, JSON.stringify(companyDefaultCategories));
        }
      } catch (e) {
        console.error(e);
        const companyDefaultCategories = defaultCategories.map(c => ({...c, companyId: id}));
        setCategories(companyDefaultCategories);
      }
    }
  }, []);

  useEffect(() => {
    if (companyId && categories.length > 0) {
      localStorage.setItem(getCategoriesStorageKey(companyId), JSON.stringify(categories));
    }
  }, [categories, companyId]);

  const onSubmit = (values: z.infer<typeof categorySchema>) => {
    if (!companyId) return;
    const payload = {...values, companyId};

    if (editingCategory) {
      setCategories(
        categories.map((c) =>
          c.id === editingCategory.id ? { ...c, ...payload } : c
        )
      );
      toast({ title: 'Sucesso!', description: 'Categoria atualizada.' });
    } else {
      setCategories([...categories, { id: new Date().toISOString(), ...payload }]);
      toast({ title: 'Sucesso!', description: 'Categoria adicionada.' });
    }
    setEditingCategory(null);
    form.reset({ name: '', type: 'revenue' });
    setIsDialogOpen(false);
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

  const confirmDelete = () => {
    if (categoryToDelete) {
      setCategories(categories.filter((c) => c.id !== categoryToDelete.id));
      toast({ title: 'Sucesso!', description: 'Categoria removida.' });
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
    const data = categories.filter((c) => c.type === type);
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
            {data.length > 0 ? data.map((cat) => (
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
                      <DropdownMenuItem onClick={() => handleDelete(cat)} className="text-red-500">
                        <Trash2 className="mr-2 h-4 w-4" /> Deletar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )) : (
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
          <Tabs defaultValue="revenue" className="w-full">
            <TabsList>
              <TabsTrigger value="revenue">Receitas</TabsTrigger>
              <TabsTrigger value="expense">Despesas</TabsTrigger>
            </TabsList>
            <TabsContent value="revenue" className="mt-4">
              <div className="flex justify-end mb-4">
                  <Button onClick={() => openNewDialog('revenue')}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Nova Categoria
                  </Button>
              </div>
              {renderCategoryTable('revenue')}
            </TabsContent>
            <TabsContent value="expense" className="mt-4">
            <div className="flex justify-end mb-4">
                  <Button onClick={() => openNewDialog('expense')}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Nova Categoria
                  </Button>
              </div>
              {renderCategoryTable('expense')}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Editar' : 'Nova'} Categoria</DialogTitle>
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
                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
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
                <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                <Button type="submit">{editingCategory ? 'Salvar' : 'Adicionar'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita e removerá a categoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Continuar</AlertDialogAction>
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
        <RadioGroup value={theme} onValueChange={setTheme} className="space-y-2">
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
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie as configurações da sua conta, empresa e aparência do sistema.
        </p>
      </header>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="profile">Perfil</TabsTrigger>
          <TabsTrigger value="company">Empresa</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
          <TabsTrigger value="appearance">Aparência</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="mt-6">
          <UserProfile />
        </TabsContent>
        <TabsContent value="company" className="mt-6">
          <CompanyProfile />
        </TabsContent>
        <TabsContent value="categories" className="mt-6">
          <CategoryManagement />
        </TabsContent>
        <TabsContent value="appearance" className="mt-6">
          <AppearanceSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
