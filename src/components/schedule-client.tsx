
'use client';

import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  Timestamp,
  writeBatch,
  getDoc,
  runTransaction,
} from 'firebase/firestore';
import { format, isSameDay, startOfDay, setHours, setMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, Wrench, CheckCircle, PlusCircle, Trash2, ChevronsUpDown, Check } from 'lucide-react';
import { db } from '@/lib/firebase';
import { type Transaction, type CompanyInfo, type Service, type Customer, ServiceStatus } from '@/lib/types';
import { formatCurrency, cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from './ui/separator';
import { Button } from './ui/button';
import { Calendar } from './ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from './ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select';


const scheduleServiceItemSchema = z.object({
    serviceId: z.string().min(1),
    serviceName: z.string(),
    price: z.coerce.number(),
});

const scheduleSchema = z.object({
  scheduledDate: z.date({ required_error: 'A data do agendamento é obrigatória.' }),
  scheduledTime: z.string().refine(val => /^\d{2}:\d{2}$/.test(val) && val !== '', { message: "A hora é obrigatória." }),
  customerId: z.string().optional(),
  customerName: z.string().min(1, 'O nome do cliente é obrigatório.'),
  services: z.array(scheduleServiceItemSchema).min(1, 'Você deve adicionar pelo menos um serviço.'),
});

type ScheduleFormValues = z.infer<typeof scheduleSchema>;

const serviceStatusOptions: ServiceStatus[] = [
    'Aberta',
    'Aguardando Aprovação',
    'Aprovada',
    'Aguardando Peça / Material',
    'Em Execução',
    'Pausada',
    'Finalizada',
    'Aguardando Pagamento',
    'Encerrada / Concluída',
    'Cancelada',
];

export function ScheduleClient() {
  const [scheduledServices, setScheduledServices] = useState<Transaction[]>([]);
  const [activeServices, setActiveServices] = useState<Transaction[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [selectedDayServices, setSelectedDayServices] = useState<Transaction[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const { toast } = useToast();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [currentService, setCurrentService] = useState<Service | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isMainCalendarOpen, setIsMainCalendarOpen] = useState(false);
  
  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
        scheduledDate: new Date(),
        scheduledTime: '',
        customerName: '',
        customerId: '',
        services: [],
    }
  });

  const { fields: services, append: appendService, remove: removeService } = useFieldArray({
    control: form.control,
    name: "services",
  });

  const fetchCompanyData = async (cId: string) => {
    setIsLoading(true);
    try {
        const servicesRef = collection(db, 'transactions');
        const qServices = query(
            servicesRef,
            where('companyId', '==', cId),
            where('subtype', 'in', ['Prestação de Serviço', 'Serviço + Venda'])
        );

        const servicesSnapshot = await getDocs(qServices);
        const fetchedServices = servicesSnapshot.docs.map((doc) => {
            const data = doc.data();
            return { id: doc.id, ...data, date: (data.date as Timestamp).toDate(), scheduledDate: data.scheduledDate ? (data.scheduledDate as Timestamp).toDate() : null } as Transaction;
        });
        
        setScheduledServices(fetchedServices.filter(s => s.serviceStatus === 'Agendado').sort((a,b) => (a.scheduledDate?.getTime() ?? 0) - (b.scheduledDate?.getTime() ?? 0)));
        setActiveServices(fetchedServices.filter(s => s.serviceStatus && !['Agendado', 'Encerrada / Concluída', 'Cancelada'].includes(s.serviceStatus)).sort((a,b) => (a.date as Date).getTime() - (b.date as Date).getTime()));

        const customersSnapshot = await getDocs(query(collection(db, 'customers'), where('companyId', '==', cId)));
        setAllCustomers(customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));

        const availableServicesSnapshot = await getDocs(query(collection(db, 'services'), where('companyId', '==', cId)));
        setAvailableServices(availableServicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service)));

        const companyInfoSnapshot = await getDocs(query(collection(db, 'companies'), where('document', '==', cId)));
        if (!companyInfoSnapshot.empty) {
            setCompanyInfo({id: companyInfoSnapshot.docs[0].id, ...companyInfoSnapshot.docs[0].data()} as CompanyInfo);
        }

    } catch (error) {
        console.error('Failed to fetch scheduled services:', error);
        toast({ title: 'Erro ao buscar dados', description: 'Não foi possível carregar os dados. Tente novamente.', variant: 'destructive' });
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    const cId = sessionStorage.getItem('current-user-company-id');
    setCompanyId(cId);
    if (cId) {
      fetchCompanyData(cId);
    } else {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    if (selectedDate) {
        const servicesForDay = scheduledServices
        .filter(s => s.scheduledDate && isSameDay(s.scheduledDate, selectedDate))
      setSelectedDayServices(servicesForDay);
    } else {
      setSelectedDayServices([]);
    }
  }, [selectedDate, scheduledServices]);

  const handleStartService = async (transactionId: string) => {
    try {
      const transactionRef = doc(db, 'transactions', transactionId);
      const payload = { serviceStatus: 'Aberta' as const, date: Timestamp.fromDate(new Date()) };
      await updateDoc(transactionRef, payload);
      
      toast({ title: 'Serviço Iniciado!', description: `O serviço foi movido para Ordens de Serviço.` });
      
      if (companyId) {
          fetchCompanyData(companyId);
      }
    } catch (error) {
      console.error('Failed to update service status:', error);
      toast({ title: 'Erro ao iniciar serviço', description: 'Não foi possível iniciar o serviço.', variant: 'destructive' });
    }
  };

  const handleStatusChange = async (transactionId: string, newStatus: ServiceStatus) => {
    try {
      const transactionRef = doc(db, 'transactions', transactionId);
      await updateDoc(transactionRef, { serviceStatus: newStatus });
      toast({ title: 'Status Atualizado!', description: `O serviço foi atualizado para "${newStatus}".` });
      if (companyId) {
          fetchCompanyData(companyId);
      }
    } catch (error) {
      console.error('Failed to update service status:', error);
      toast({ title: 'Erro ao atualizar status', description: 'Não foi possível alterar o status do serviço.', variant: 'destructive' });
    }
  };
  
  const handleDaySelect = (day: Date | undefined) => {
      setSelectedDate(day ? startOfDay(day) : undefined);
      setIsMainCalendarOpen(false);
  }

  const handleAddService = () => {
    if (currentService) {
        appendService({
            serviceId: currentService.id,
            serviceName: currentService.name,
            price: currentService.price,
        });
        setCurrentService(null);
    }
  };

  const onScheduleSubmit = async (data: ScheduleFormValues) => {
    if (!companyId || !companyInfo) return;

    try {
        await runTransaction(db, async (transaction) => {
            const companyRef = doc(db, 'companies', companyInfo.id);
            const companyDoc = await transaction.get(companyRef);
            if (!companyDoc.exists()) throw new Error("Empresa não encontrada.");

            let currentCounter = companyDoc.data().transactionCounter || 0;
            const sequentialId = currentCounter + 1;
            
            const totalAmount = data.services.reduce((sum, s) => sum + s.price, 0);

            const [hours, minutes] = data.scheduledTime.split(':').map(Number);
            const finalScheduledDate = setMinutes(setHours(data.scheduledDate, hours), minutes);

            const newSchedulePayload: Partial<Omit<Transaction, 'id'>> & {date: Timestamp} = {
                sequentialId: sequentialId,
                companyId: companyId,
                type: 'revenue',
                subtype: 'Prestação de Serviço',
                customerName: data.customerName.toUpperCase(),
                customerId: data.customerId,
                services: data.services,
                amount: totalAmount,
                date: Timestamp.fromDate(finalScheduledDate),
                scheduledDate: Timestamp.fromDate(finalScheduledDate),
                serviceStatus: 'Agendado',
                status: 'Pendente',
                description: `AGENDAMENTO PARA: ${data.services.map(s => s.serviceName).join(', ')}`,
            };

            const newTransactionRef = doc(collection(db, 'transactions'));
            transaction.set(newTransactionRef, newSchedulePayload);
            transaction.update(companyRef, { transactionCounter: sequentialId });
        });

        toast({ title: 'Sucesso!', description: 'Serviço agendado.' });
        setIsFormOpen(false);
        form.reset({
          scheduledDate: new Date(),
          scheduledTime: '',
          customerName: '',
          customerId: '',
          services: [],
      });
        fetchCompanyData(companyId); // Refetch data
    } catch (error: any) {
        console.error('Failed to schedule service:', error);
        toast({ title: 'Erro!', description: error.message || 'Não foi possível agendar o serviço.', variant: 'destructive' });
    }
  };

  const TimeSlotPicker = () => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedDate = form.watch('scheduledDate');
    const selectedTime = form.watch('scheduledTime');

    const bookedTimes = scheduledServices
        .filter(s => s.scheduledDate && isSameDay(s.scheduledDate, selectedDate))
        .map(s => format(s.scheduledDate as Date, 'HH:mm'));

    const timeSlots = Array.from({ length: 11 }, (_, i) => {
        const hour = i + 8;
        return `${String(hour).padStart(2, '0')}:00`;
    });

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                    {selectedTime || "Selecione uma hora"}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
                <div className="grid grid-cols-4 gap-2">
                    {timeSlots.map(slot => (
                        <Button
                            key={slot}
                            variant={selectedTime === slot ? 'default' : 'outline'}
                            disabled={bookedTimes.includes(slot)}
                            onClick={() => {
                                form.setValue('scheduledTime', slot);
                                form.clearErrors('scheduledTime');
                                setIsOpen(false);
                            }}
                        >
                            {slot}
                        </Button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
  };
  
  const CustomerCombobox = () => {
    const [open, setOpen] = useState(false);
    const customerNameValue = form.watch('customerName');

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
                    {customerNameValue || "Selecione ou digite um cliente"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0"
                onCloseAutoFocus={(e) => {
                    if ((e.target as HTMLElement)?.closest('[cmdk-item]')) e.preventDefault();
                }}
            >
                <Command filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}>
                    <CommandInput placeholder="Buscar cliente..." value={customerNameValue} onValueChange={(search) => form.setValue('customerName', search.toUpperCase())} autoComplete="off" />
                    <CommandList>
                        <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                        <CommandGroup>
                            {allCustomers.map((client) => (
                                <CommandItem key={client.id} value={client.name}
                                    onSelect={(currentValue) => {
                                        const selectedClient = allCustomers.find(c => c.name.toLowerCase() === currentValue.toLowerCase());
                                        if(selectedClient) {
                                            form.setValue('customerId', selectedClient.id);
                                            form.setValue('customerName', selectedClient.name);
                                            form.clearErrors('customerName');
                                        }
                                        setOpen(false);
                                    }}
                                >
                                    <Check className={cn("mr-2 h-4 w-4", client.id === form.getValues("customerId") ? "opacity-100" : "opacity-0")} />
                                    {client.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
  };
  
  const ServiceCombobox = () => {
    const [open, setOpen] = useState(false);
    return (
       <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className={cn("w-full justify-between", !currentService && "text-muted-foreground")}>
              {currentService ? currentService.name : "Selecione um serviço"}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
              <CommandInput placeholder="Digite para filtrar..." autoComplete="off"/>
              <CommandList>
              <CommandEmpty>Nenhum serviço encontrado.</CommandEmpty>
              <CommandGroup>
                  {availableServices.map((serv) => (
                  <CommandItem
                      value={serv.name}
                      key={serv.id}
                      onSelect={() => {
                          setCurrentService(serv);
                          setOpen(false);
                      }}
                  >
                      <Check className={cn("mr-2 h-4 w-4", currentService?.id === serv.id ? "opacity-100" : "opacity-0")} />
                      {serv.name}
                  </CommandItem>
                  ))}
              </CommandGroup>
              </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    )
  }

  const renderServiceCards = (servicesToRender: Transaction[], title: string, emptyMessage: string, emptyIcon: React.ReactNode) => {
      if(servicesToRender.length === 0) {
          return (
             <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm p-8 text-center h-[200px] mt-4">
                <div className="flex flex-col items-center gap-2">
                    {emptyIcon}
                    <h2 className="text-2xl font-semibold">
                      {title}
                    </h2>
                    <p className="max-w-md mt-2 text-sm text-muted-foreground">{emptyMessage}</p>
                </div>
            </div>
          )
      }

      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
          {servicesToRender.map((service) => (
            <Card key={service.id} className="flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{service.customerName}</CardTitle>
                    <CardDescription>
                      {service.scheduledDate && <span className="font-semibold capitalize text-base">{format(new Date(service.scheduledDate), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>}
                    </CardDescription>
                  </div>
                   <Badge variant="secondary">{service.serviceStatus}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-grow space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm flex items-center gap-2"><Wrench className="h-4 w-4"/>Serviços</h4>
                    <div className="pl-4">
                        {service.services?.map(s => (
                            <div key={s.serviceId} className="flex justify-between text-sm">
                                <p>{s.serviceName}</p>
                                <p className="font-mono">{formatCurrency(s.price)}</p>
                            </div>
                        ))}
                    </div>
                  </div>
              </CardContent>
              <CardFooter className="flex-col items-stretch gap-4 !pt-4">
                 <div className="flex justify-between items-center pt-2 border-t">
                    <span className="font-bold">Valor Total:</span>
                    <span className="font-bold text-lg">{formatCurrency(service.amount)}</span>
                 </div>
                 {service.serviceStatus === 'Agendado' ? (
                     <Button size="sm" className="w-full" onClick={() => handleStartService(service.id)}>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Confirmar e Iniciar
                     </Button>
                 ) : (
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Mudar Status:</span>
                        <Select value={service.serviceStatus} onValueChange={(newStatus: ServiceStatus) => handleStatusChange(service.id, newStatus)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Alterar status" />
                            </SelectTrigger>
                            <SelectContent>
                            {serviceStatusOptions.map((status) => (
                                <SelectItem key={status} value={status}>
                                {status}
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                    </div>
                 )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
          <Skeleton className="h-10 w-40 ml-auto" />
          <div className="flex justify-center">
            <Skeleton className="h-[360px] w-full max-w-sm" />
          </div>
      </div>
    );
  }

  return (
    <>
        <div className="flex items-center justify-between mb-4">
            <Popover open={isMainCalendarOpen} onOpenChange={setIsMainCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant={'outline'} className={cn('w-[280px] justify-start text-left font-normal', !selectedDate && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, 'PPP', { locale: ptBR }) : <span>Selecione uma data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDaySelect}
                    initialFocus
                    locale={ptBR}
                    modifiers={{ scheduled: scheduledServices.map(s => s.scheduledDate).filter((d): d is Date => !!d) }}
                    modifiersClassNames={{ scheduled: 'bg-primary/20 text-primary-foreground rounded-full' }}
                />
              </PopoverContent>
            </Popover>
            <Button onClick={() => {
              form.reset({
                scheduledDate: new Date(),
                scheduledTime: '',
                customerName: '',
                customerId: '',
                services: [],
              });
              setIsFormOpen(true);
            }}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Agendar Serviço
            </Button>
        </div>
        
        {selectedDate && renderServiceCards(
            selectedDayServices, 
            'Nenhum agendamento para este dia.',
            '',
            <CalendarIcon className="w-16 h-16 text-muted-foreground" />
        )}
      
      <Dialog open={isFormOpen} onOpenChange={(isOpen) => {
        if (!isOpen) {
          form.reset({
            scheduledDate: new Date(),
            scheduledTime: '',
            customerName: '',
            customerId: '',
            services: [],
          });
        }
        setIsFormOpen(isOpen);
      }}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Novo Agendamento</DialogTitle>
                <DialogDescription>Preencha os dados para criar um novo agendamento de serviço.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onScheduleSubmit)} className="space-y-4">
                    <FormField control={form.control} name="customerName" render={() => (
                        <FormItem className="flex flex-col">
                           <FormLabel>Cliente</FormLabel>
                           <CustomerCombobox />
                           <FormMessage />
                        </FormItem>
                    )} />

                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="scheduledDate" render={({ field }) => (
                          <FormItem className="flex flex-col !space-y-0">
                            <FormLabel className="mb-2">Data do Agendamento</FormLabel>
                            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen} modal={true}>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button variant={'outline'} className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}>
                                    {field.value ? format(field.value, 'PPP', { locale: ptBR }) : <span>Escolha uma data</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0 z-[51]" align="start">
                                <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={(date) => {
                                        field.onChange(date);
                                        setIsCalendarOpen(false);
                                    }}
                                    initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage className="pt-2" />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="scheduledTime" render={() => (
                            <FormItem className="pt-1">
                                <FormLabel className="mb-2">Hora</FormLabel>
                                <FormControl>
                                    <TimeSlotPicker />
                                </FormControl>
                                <FormMessage className="pt-2"/>
                            </FormItem>
                        )}/>
                    </div>
                    
                    <Card>
                      <CardHeader className="px-6 pt-4 pb-2">
                          <CardTitle className="text-lg">Serviços do Agendamento</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                          <div className="flex flex-col md:flex-row gap-2 items-end">
                                <div className="flex-1 w-full">
                                  <Label>Serviço</Label>
                                  <ServiceCombobox />
                                </div>
                              <Button type="button" onClick={handleAddService}>Adicionar</Button>
                          </div>
                          <Separator />
                          <div className="space-y-2">
                              {services.map((service, index) => (
                                  <div key={service.id} className="flex items-center justify-between p-2 rounded-md bg-muted">
                                      <p className="font-medium">{service.serviceName}</p>
                                      <div className='flex items-center'>
                                          <p className="font-mono">{formatCurrency(service.price)}</p>
                                          <Button type="button" variant="ghost" size="icon" className="ml-2 h-8 w-8" onClick={() => removeService(index)}>
                                              <Trash2 className="h-4 w-4 text-red-500" />
                                          </Button>
                                      </div>
                                  </div>
                              ))}
                              {services.length === 0 && <p className="text-sm text-center text-muted-foreground">Nenhum serviço adicionado.</p>}
                          </div>
                          <FormField control={form.control} name="services" render={({ fieldState }) => <FormMessage>{fieldState.error?.message || fieldState.error?.root?.message}</FormMessage>} />
                      </CardContent>
                    </Card>

                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="ghost">Cancelar</Button></DialogClose>
                        <Button type="submit">Agendar</Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
