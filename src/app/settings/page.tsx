
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
} from 'firebase/firestore';
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import {
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
import { type User, type CompanyInfo } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { db, storage } from '@/lib/firebase';
import { maskDocument, formatPhone } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

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
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  quoteValidityDays: z.coerce.number().int().min(1, 'A validade deve ser de pelo menos 1 dia.').optional(),
});


// Default values
const defaultCompanyInfo: CompanyInfo = {
  id: '',
  name: '',
  document: '',
  logo: '',
  address: '',
  phone: '',
  email: '',
};

function canvasPreview(
  image: HTMLImageElement,
  canvas: HTMLCanvasElement,
  crop: PixelCrop
) {
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const pixelRatio = window.devicePixelRatio || 1;

  canvas.width = Math.floor(crop.width * scaleX * pixelRatio);
  canvas.height = Math.floor(crop.height * scaleY * pixelRatio);

  ctx.scale(pixelRatio, pixelRatio);
  ctx.imageSmoothingQuality = 'high';

  const cropX = crop.x * scaleX;
  const cropY = crop.y * scaleY;

  const centerX = image.naturalWidth / 2;
  const centerY = image.naturalHeight / 2;

  ctx.save();
  ctx.translate(-cropX, -cropY);
  ctx.translate(centerX, centerY);
  ctx.translate(-centerX, -centerY);
  ctx.drawImage(
    image,
    0,
    0,
    image.naturalWidth,
    image.naturalHeight,
    0,
    0,
    image.naturalWidth,
    image.naturalHeight
  );

  ctx.restore();
}

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
                    <Input type="password" {...field} autoComplete="off" />
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
                    <Input type="password" {...field} autoComplete="off" />
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
                    <Input type="password" {...field} autoComplete="off" />
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
  const imgRef = useRef<HTMLImageElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(defaultCompanyInfo);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [isCompanyAdmin, setIsCompanyAdmin] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const aspect = 1;

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
    values: {
      ...companyInfo,
      document: maskDocument(companyInfo.document),
      phone: formatPhone(companyInfo.phone || ''),
      quoteValidityDays: companyInfo.quoteValidityDays || 30,
    },
  });

  useEffect(() => {
    form.reset({
        ...companyInfo,
        document: maskDocument(companyInfo.document),
        phone: formatPhone(companyInfo.phone || ''),
        quoteValidityDays: companyInfo.quoteValidityDays || 30,
    });
  }, [companyInfo, form]);

  const onSubmit = async (values: z.infer<typeof companyInfoSchema>) => {
    if (!companyId || (!isSystemAdmin && !isCompanyAdmin)) return;

    try {
      const updatedInfo = { ...companyInfo, ...values, name: values.name.toUpperCase(), phone: values.phone?.replace(/\D/g, '') };
      const companyRef = doc(db, 'companies', updatedInfo.id);
      const payload: Partial<CompanyInfo> = {
        name: updatedInfo.name,
        logo: updatedInfo.logo,
        address: values.address,
        phone: updatedInfo.phone,
        email: values.email,
        quoteValidityDays: values.quoteValidityDays,
      };
      
      await updateDoc(companyRef, payload as any);

      setCompanyInfo(updatedInfo);
      toast({ title: 'Sucesso!', description: 'Informações da empresa salvas.' });
      form.reset({
        ...updatedInfo,
        document: maskDocument(updatedInfo.document),
        phone: formatPhone(updatedInfo.phone || ''),
        quoteValidityDays: values.quoteValidityDays,
      });
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

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined); // Reset crop
      const reader = new FileReader();
      reader.addEventListener('load', () =>
        setImgSrc(reader.result?.toString() || '')
      );
      reader.readAsDataURL(e.target.files[0]);
      setIsCropModalOpen(true);
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; // Reset file input
      }
    }
  };

  const handleSaveCroppedLogo = async () => {
    if (!completedCrop || !previewCanvasRef.current || !imgRef.current || !companyId) {
      return;
    }
    setIsUploading(true);
    setIsCropModalOpen(false);

    canvasPreview(imgRef.current, previewCanvasRef.current, completedCrop);

    previewCanvasRef.current.toBlob(async (blob) => {
        if (!blob) {
            toast({
                title: 'Erro!',
                description: 'Não foi possível gerar a imagem cortada.',
                variant: 'destructive',
            });
            setIsUploading(false);
            return;
        }

        try {
            const logoStorageRef = storageRef(storage, `logos/${companyId}/logo.png`);
            await uploadBytes(logoStorageRef, blob, { contentType: 'image/png' });
            const downloadURL = await getDownloadURL(logoStorageRef);
            form.setValue('logo', downloadURL);
            setCompanyInfo((prev) => ({ ...prev, logo: downloadURL }));
            toast({ title: 'Sucesso!', description: 'Logo carregado. Clique em salvar para aplicar as alterações.' });
        } catch (error) {
            console.error('Failed to upload cropped logo:', error);
            toast({
              title: 'Erro de Upload!',
              description: 'Não foi possível carregar o logo.',
              variant: 'destructive',
            });
        } finally {
            setIsUploading(false);
            setImgSrc('');
        }
    }, 'image/png');
  };

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    setCrop(centerCrop(
      makeAspectCrop({
        unit: '%',
        width: 90,
      }, aspect, width, height),
      width,
      height
    ));
  }

  const canEdit = isSystemAdmin || isCompanyAdmin;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Informações da Empresa</CardTitle>
          <CardDescription>
            {canEdit
              ? 'Gerencie os dados cadastrais da sua empresa.'
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
                  disabled={!canEdit || isUploading}
                >
                  {isUploading ? 'Carregando...' : 'Carregar Logo'}
                </Button>
                <Input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/png, image/jpeg"
                  onChange={handleLogoChange}
                  disabled={!canEdit || isUploading}
                  autoComplete="off"
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
                          autoComplete="off"
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
                        <Input {...field} disabled={true} autoComplete="off" />
                      </FormControl>
                      <FormDescription>
                        O documento é o identificador único da empresa e não pode ser alterado.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Endereço</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          disabled={!canEdit}
                          autoComplete="off"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          disabled={!canEdit}
                          autoComplete="off"
                          onChange={(e) => field.onChange(formatPhone(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          {...field}
                          disabled={!canEdit}
                          autoComplete="off"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="quoteValidityDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Validade do Orçamento (dias)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          disabled={!canEdit}
                          autoComplete="off"
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.valueAsNumber)}
                        />
                      </FormControl>
                      <FormDescription>
                        Por quantos dias um orçamento permanece válido antes de expirar. (Padrão: 30)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={!canEdit || isUploading}>Salvar Informações</Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
      <Dialog open={isCropModalOpen} onOpenChange={setIsCropModalOpen}>
        <DialogContent className="max-w-md">
            <DialogHeader>
                <DialogTitle>Cortar Imagem</DialogTitle>
                <DialogDescription>
                    Ajuste a seleção para cortar o logo.
                </DialogDescription>
            </DialogHeader>
            {imgSrc && (
                <div className="flex justify-center">
                  <ReactCrop
                      crop={crop}
                      onChange={(_, percentCrop) => setCrop(percentCrop)}
                      onComplete={(c) => setCompletedCrop(c)}
                      aspect={aspect}
                      minHeight={100}
                  >
                      <img
                          ref={imgRef}
                          alt="Crop me"
                          src={imgSrc}
                          onLoad={onImageLoad}
                          className="max-h-[60vh]"
                      />
                  </ReactCrop>
                </div>
            )}
             {!!completedCrop && (
                <canvas
                    ref={previewCanvasRef}
                    style={{
                        display: 'none',
                        objectFit: 'contain',
                        width: completedCrop.width,
                        height: completedCrop.height,
                    }}
                />
            )}
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="ghost">Cancelar</Button>
                </DialogClose>
                <Button onClick={handleSaveCroppedLogo} disabled={!completedCrop || isUploading}>
                  {isUploading ? 'Salvando...' : 'Salvar Logo'}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
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
            <Label htmlFor="light" className="flex items-center gap-2 font-normal">
              <Sun className="h-4 w-4" /> Claro
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="dark" id="dark" />
            <Label htmlFor="dark" className="flex items-center gap-2 font-normal">
              <Moon className="h-4 w-4" /> Escuro
            </Label>
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage({}: {}) {
  const [hasCompany, setHasCompany] = useState(false);

  useEffect(() => {
    const companyId = sessionStorage.getItem('current-user-company-id');
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
              <TabsTrigger value="company">Empresa</TabsTrigger>
          )}
          <TabsTrigger value="appearance">Aparência</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="mt-6">
          <UserProfile />
        </TabsContent>
        {hasCompany && (
            <TabsContent value="company" className="mt-6">
              <CompanyProfile />
            </TabsContent>
        )}
        <TabsContent value="appearance" className="mt-6">
          <AppearanceSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
