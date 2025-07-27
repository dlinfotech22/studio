
'use client';

import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  Timestamp,
  runTransaction,
  deleteDoc,
} from 'firebase/firestore';
import { format, isSameDay, startOfDay, setHours, setMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, Wrench, CheckCircle, PlusCircle, Trash2, ChevronsUpDown, Check, Search } from 'lucide-react';
import { db } from '@/lib/firebase';
import { type Transaction, type CompanyInfo, type Service, type Customer } from '@/lib/types';
import { formatCurrency, cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useRouter } from 'next/navigation';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';


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
}).refine((data) => {
    const { scheduledDate, scheduledTime } = data;
    if (!scheduledDate || !scheduledTime) {
      return true; // Other validators will handle this
    }
    const [hours, minutes] = scheduledTime.split(':').map(Number);
    const scheduledDateTime = new Date(scheduledDate);
    scheduledDateTime.setHours(hours, minutes, 0, 0);

    const now = new Date();
    return scheduledDateTime > now;
}, {
    message: "Não é possível agendar em uma data ou hora passada.",
    path: ["scheduledTime"],
});


type ScheduleFormValues = z.infer<typeof scheduleSchema>;

export function ScheduleClient() {
  const [scheduledServices, setScheduledServices] = useState<Transaction[]>([]);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [selectedDayServices, setSelectedDayServices] = useState<Transaction[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const { toast } = useToast();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [currentService, setCurrentService] = useState<Service | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const router = useRouter();

  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<Transaction | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
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

  const setupListeners = (cId: string) => {
      setIsLoading(true);
      
      const qServices = query(
          collection(db, 'transactions'),
          where('companyId', '==', cId),
          where('subtype', 'in', ['Prestação de Serviço', 'Serviço + Venda']),
          where('serviceStatus', '==', 'Agendado')
      );
      const unsubTransactions = onSnapshot(qServices, (snapshot) => {
          const fetchedServices = snapshot.docs.map((doc) => {
              const data = doc.data();
              return { id: doc.id, ...data, date: (data.date as Timestamp).toDate(), scheduledDate: data.scheduledDate ? (data.scheduledDate as Timestamp).toDate() : null } as Transaction;
          });
          const sortedServices = fetchedServices.sort((a,b) => (a.scheduledDate?.getTime() ?? 0) - (b.scheduledDate?.getTime() ?? 0));
          setScheduledServices(sortedServices);

          // Auto-select the first upcoming day with schedules
          if (!selectedDate && sortedServices.length > 0) {
            const firstUpcomingSchedule = sortedServices.find(s => s.scheduledDate && startOfDay(s.scheduledDate) >= startOfDay(new Date()));
            setSelectedDate(firstUpcomingSchedule ? startOfDay(firstUpcomingSchedule.scheduledDate!) : startOfDay(sortedServices[0].scheduledDate!));
          } else if (sortedServices.length === 0) {
            setSelectedDate(undefined);
          }

          setIsLoading(false);
      }, (error) => {
          console.error('Failed to fetch scheduled services:', error);
          toast({ title: 'Erro ao buscar agendamentos', description: 'Não foi possível carregar os dados. Tente novamente.', variant: 'destructive' });
          setIsLoading(false);
      });
      
      const qCustomers = query(collection(db, 'customers'), where('companyId', '==', cId));
      const unsubCustomers = onSnapshot(qCustomers, (snapshot) => {
          setAllCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
      });

      const qAvailableServices = query(collection(db, 'services'), where('companyId', '==', cId));
      const unsubAvailableServices = onSnapshot(qAvailableServices, (snapshot) => {
          setAvailableServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service)));
      });

      const qCompanyInfo = query(collection(db, 'companies'), where('document', '==', cId));
      const unsubCompanyInfo = onSnapshot(qCompanyInfo, (snapshot) => {
          if (!snapshot.empty) {
              setCompanyInfo({id: snapshot.docs[0].id, ...snapshot.docs[0].data()} as CompanyInfo);
          }
      });

      return () => {
          unsubTransactions();
          unsubCustomers();
          unsubAvailableServices();
          unsubCompanyInfo();
      }
  }

  useEffect(() => {
    const cId = sessionStorage.getItem('current-user-company-id');
    setCompanyId(cId);
    if (cId) {
      const unsubscribe = setupListeners(cId);
      return () => unsubscribe();
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

  const filteredDayServices = selectedDayServices.filter(service => {
    const term = searchTerm.toLowerCase();
    const customerMatch = service.customerName?.toLowerCase().includes(term);
    const serviceMatch = service.services?.some(s => s.serviceName.toLowerCase().includes(term));
    return customerMatch || serviceMatch;
  });

  const uniqueScheduledDays = [...new Set(
    scheduledServices
      .map(s => s.scheduledDate ? startOfDay(s.scheduledDate).getTime() : 0)
      .filter(time => time > 0)
  )].map(time => new Date(time)).sort((a,b) => a.getTime() - b.getTime());


  const handleStartService = (transactionId: string) => {
    sessionStorage.setItem('transaction-to-edit', transactionId);
    router.push('/transactions');
  };
  
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

  const handleOpenDeleteDialog = (service: Transaction) => {
    setServiceToDelete(service);
    setIsDeleteAlertOpen(true);
  };
  
  const handleConfirmDelete = async () => {
    if (!serviceToDelete) return;
    try {
        await deleteDoc(doc(db, 'transactions', serviceToDelete.id));
        toast({ title: 'Sucesso!', description: 'Agendamento removido.' });
    } catch (error) {
        console.error('Failed to delete schedule:', error);
        toast({ title: 'Erro!', description: 'Não foi possível remover o agendamento.', variant: 'destructive' });
    } finally {
        setIsDeleteAlertOpen(false);
        setServiceToDelete(null);
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
    const [inputValue, setInputValue] = useState(form.getValues('customerName') || '');
  
    useEffect(() => {
        setInputValue(form.getValues('customerName') || '');
    }, [form.watch('customerName')]);

    return (
      <Popover
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (!isOpen && inputValue) {
            const matchedCustomer = allCustomers.find(c => c.name.toLowerCase() === inputValue.toLowerCase());
            if (!matchedCustomer) {
                form.setValue('customerName', inputValue.toUpperCase());
                form.setValue('customerId', undefined);
                form.clearErrors('customerName');
            }
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between", !inputValue && "text-muted-foreground")}
          >
            {inputValue || "Selecione ou digite um cliente"}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          <Command filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}>
            <CommandInput
              placeholder="Buscar cliente..."
              value={inputValue}
              onValueChange={setInputValue}
              autoComplete="off"
            />
            <CommandList>
              <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
              <CommandGroup>
                {allCustomers.map((client) => (
                  <CommandItem
                    key={client.id}
                    value={client.name}
                    onSelect={() => {
                      form.setValue('customerId', client.id);
                      form.setValue('customerName', client.name);
                      setInputValue(client.name);
                      form.clearErrors('customerName');
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4", form.getValues('customerId') === client.id ? "opacity-100" : "opacity-0")}
                    />
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
              <CardFooter className="flex-col items-stretch gap-2 !pt-4">
                 <div className="flex justify-between items-center pt-2 border-t">
                    <span className="font-bold">Valor Total:</span>
                    <span className="font-bold text-lg">{formatCurrency(service.amount)}</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <Button size="sm" className="w-full" onClick={() => handleStartService(service.id)}>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Confirmar e Iniciar
                    </Button>
                    <Button size="sm" variant="destructive" className="w-auto px-3" onClick={() => handleOpenDeleteDialog(service)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                 </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
          <Skeleton className="h-10 w-full md:w-auto md:max-w-xs" />
          <div className="flex justify-center">
            <Skeleton className="h-[360px] w-full max-w-sm" />
          </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {uniqueScheduledDays.map(day => (
                 <Button 
                    key={day.getTime()} 
                    variant={selectedDate && isSameDay(day, selectedDate) ? "default" : "outline"}
                    onClick={() => setSelectedDate(day)}
                 >
                   {format(day, 'dd/MM/yyyy')}
                 </Button>
            ))}
          </div>
        
        <div className="flex w-full sm:w-auto sm:justify-end items-center gap-4">
            <div className="relative w-full sm:w-auto sm:max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Buscar agendamento..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                    autoComplete="off"
                />
            </div>
            <Button onClick={() => {
              form.reset({
                scheduledDate: selectedDate || new Date(),
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
      </div>
          
      {renderServiceCards(
          filteredDayServices, 
          'Nenhum agendamento para este dia.',
          'Selecione outro dia para visualizar os agendamentos.',
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
                        <FormItem>
                           <FormLabel>Cliente</FormLabel>
                           <CustomerCombobox />
                           <FormMessage />
                        </FormItem>
                    )} />

                    <div className="grid grid-cols-2 gap-4 items-start">
                      <FormField
                        control={form.control}
                        name="scheduledDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel className="mb-2">Data do Agendamento</FormLabel>
                            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen} modal={true}>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={'outline'}
                                    className={cn(
                                      'w-full pl-3 text-left font-normal',
                                      !field.value && 'text-muted-foreground'
                                    )}
                                  >
                                    {field.value
                                      ? format(field.value, 'PPP', { locale: ptBR })
                                      : <span>Escolha uma data</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0 z-[51]" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={(date) => {
                                      if (date) {
                                        field.onChange(date);
                                        form.setValue('scheduledTime', ''); // Reset time when date changes
                                      }
                                      setIsCalendarOpen(false);
                                  }}
                                  disabled={(date) => date < startOfDay(new Date())}
                                  initialFocus
                                  modifiers={{ scheduled: uniqueScheduledDays }}
                                  modifiersClassNames={{ scheduled: 'bg-primary/20 text-primary-foreground rounded-full font-bold' }}
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage className="pt-2" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="scheduledTime"
                        render={() => (
                          <FormItem className="-mt-1">
                            <FormLabel className="mb-2">Hora</FormLabel>
                            <FormControl>
                              <TimeSlotPicker />
                            </FormControl>
                            <FormMessage className="pt-2"/>
                          </FormItem>
                        )}
                      />
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
      <AlertDialog
        open={isDeleteAlertOpen}
        onOpenChange={setIsDeleteAlertOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Isso removerá permanentemente o agendamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setServiceToDelete(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
