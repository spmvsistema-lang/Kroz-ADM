
'use client';

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Loader2, Search, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";


const veterinarianSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Nome é obrigatório"),
  cnpj: z.string().optional(),
  fantasyName: z.string().optional(),
  email: z.string().email("Email inválido"),
  clinics: z.array(z.string()).min(1, "É necessário pelo menos uma clínica."),
  status: z.enum(['Ativo', 'Inativo']),
  role: z.string().optional(),
  bankName: z.string().optional().nullable(),
  bankAgency: z.string().optional().nullable(),
  bankAccount: z.string().optional().nullable(),
  pixKey: z.string().optional().nullable(),
  closingDay: z.number().optional().nullable(),
  issuesInvoice: z.boolean().optional().nullable(),
});


type Veterinarian = z.infer<typeof veterinarianSchema>;

interface Company {
    id: string;
    name: string;
}

interface AddVeterinarianDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVeterinarianAdd: (newVet: Omit<Veterinarian, 'id'>, password?: string) => void;
  onVeterinarianEdit: (updatedVet: Veterinarian, finalPaymentDate?: Date) => void;
  veterinarianToEdit?: Veterinarian | null;
  companies: Company[];
}

export function AddVeterinarianDialog({ open, onOpenChange, onVeterinarianAdd, onVeterinarianEdit, veterinarianToEdit, companies }: AddVeterinarianDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<Veterinarian>>({});
  const [password, setPassword] = useState('');
  const [isClinicPopoverOpen, setIsClinicPopoverOpen] = useState(false);
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);
  
  const [showFinalPaymentDialog, setShowFinalPaymentDialog] = useState(false);
  const [finalPaymentDate, setFinalPaymentDate] = useState<Date | undefined>();

  
  const isEditMode = !!veterinarianToEdit;
  const wasActive = veterinarianToEdit?.status === 'Ativo';

  useEffect(() => {
    if (veterinarianToEdit && open) {
      setFormData({
        ...veterinarianToEdit,
        clinics: veterinarianToEdit.clinics || [],
      });
    } else {
      setFormData({
        status: 'Ativo', // Default status
        clinics: [],
        issuesInvoice: false,
      });
      setPassword('');
    }
  }, [veterinarianToEdit, open]);

  const handleInputChange = (field: keyof Omit<Veterinarian, 'id'|'clinics'|'closingDay'|'issuesInvoice'>, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNumericInputChange = (field: 'closingDay', value: string) => {
    const numValue = value === '' ? undefined : parseInt(value, 10);
    setFormData(prev => ({...prev, [field]: isNaN(numValue as any) ? undefined : numValue }));
  }

  const handleSwitchChange = (field: 'issuesInvoice', checked: boolean) => {
    setFormData(prev => ({ ...prev, [field]: checked }));
  }

  const handleStatusChange = (value: 'Ativo' | 'Inativo') => {
    if (isEditMode && wasActive && value === 'Inativo') {
        setShowFinalPaymentDialog(true);
    }
    handleInputChange('status', value);
  }

  const handleClinicSelection = (companyName: string) => {
    setFormData(prev => {
        const currentClinics = prev.clinics || [];
        if (currentClinics.includes(companyName)) {
            return { ...prev, clinics: currentClinics.filter(c => c !== companyName) };
        } else {
            return { ...prev, clinics: [...currentClinics, companyName] };
        }
    });
    // Keep popover open for multi-select
  }

  const handleCnpjSearch = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!formData.cnpj) {
        toast({ variant: "destructive", title: "CNPJ inválido", description: "Por favor, insira um CNPJ para buscar." });
        return;
    }

    setIsSearchingCnpj(true);
    const cnpjOnlyNumbers = formData.cnpj.replace(/\D/g, '');

    try {
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjOnlyNumbers}`);
        const data = await response.json();

        if (response.ok) {
            setFormData(prev => ({
                ...prev,
                name: data.razao_social,
                fantasyName: data.nome_fantasia,
            }));
             toast({ title: "Sucesso!", description: "Dados do CNPJ preenchidos." });
        } else {
            throw new Error(data.message || 'CNPJ não encontrado ou inválido.');
        }

    } catch (error: any) {
        toast({ variant: "destructive", title: "Erro na busca", description: error.message || "Não foi possível buscar o CNPJ." });
    } finally {
        setIsSearchingCnpj(false);
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
     if (isEditMode && wasActive && formData.status === 'Inativo') {
        setShowFinalPaymentDialog(true);
        return; // Don't submit yet, wait for the final payment date
    }

    const dataToValidate = {
      id: formData.id || `temp-id-${Date.now()}`,
      name: formData.name || '',
      cnpj: formData.cnpj || '',
      fantasyName: formData.fantasyName || '',
      email: formData.email || '',
      clinics: formData.clinics || [],
      status: formData.status || 'Ativo',
      bankName: formData.bankName,
      bankAgency: formData.bankAgency,
      bankAccount: formData.bankAccount,
      pixKey: formData.pixKey,
      closingDay: formData.closingDay,
      issuesInvoice: formData.issuesInvoice || false,
    };

    const result = veterinarianSchema.safeParse(dataToValidate);

    if (!result.success) {
        toast({
            variant: "destructive",
            title: "Erro de Validação",
            description: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        });
        return;
    }
    
    if (isEditMode) {
      onVeterinarianEdit(result.data as Veterinarian);
    } else {
      const { id, ...newVetData } = result.data;
      onVeterinarianAdd(newVetData, password);
    }
    
    onOpenChange(false);
  };
  
   const handleConfirmFinalPayment = () => {
        if (!finalPaymentDate) {
            toast({ variant: "destructive", title: "Data Inválida", description: "Por favor, selecione a data do último pagamento." });
            return;
        }

        const dataToValidate = {
            id: formData.id || `temp-id-${Date.now()}`,
            ...formData,
            status: 'Inativo',
        };
        const result = veterinarianSchema.safeParse(dataToValidate);

        if (!result.success) {
            toast({ variant: "destructive", title: "Erro de Validação", description: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') });
            return;
        }

        onVeterinarianEdit(result.data as Veterinarian, finalPaymentDate);
        setShowFinalPaymentDialog(false);
        onOpenChange(false);
    }

    const handleCancelInactivation = () => {
        setFormData(prev => ({...prev, status: 'Ativo'}));
        setShowFinalPaymentDialog(false);
    }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Editar Veterinário' : 'Adicionar Novo Veterinário'}</DialogTitle>
          <DialogDescription>
            Preencha os dados abaixo para {isEditMode ? 'atualizar o' : 'criar um novo'} profissional.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
            <Tabs defaultValue="professional-data">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="professional-data">Dados Profissionais</TabsTrigger>
                    <TabsTrigger value="bank-data">Dados Bancários</TabsTrigger>
                    <TabsTrigger value="access-data">Dados de Acesso</TabsTrigger>
                </TabsList>
                <TabsContent value="professional-data">
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="vet-cnpj">CNPJ (Opcional)</Label>
                            <div className="flex items-center gap-2">
                                <Input id="vet-cnpj" value={formData.cnpj || ''} onChange={(e) => handleInputChange('cnpj', e.target.value)} placeholder="Digite o CNPJ e clique em buscar" />
                                <Button type="button" variant="outline" size="icon" onClick={handleCnpjSearch} disabled={isSearchingCnpj}>
                                    {isSearchingCnpj ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="vet-name">Razão Social / Nome</Label>
                            <Input id="vet-name" value={formData.name || ''} onChange={(e) => handleInputChange('name', e.target.value)} placeholder="Nome completo" required disabled={isSearchingCnpj} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="vet-fantasyName">Nome Fantasia</Label>
                            <Input id="vet-fantasyName" value={formData.fantasyName || ''} onChange={(e) => handleInputChange('fantasyName', e.target.value)} placeholder="Nome de preferência" disabled={isSearchingCnpj}/>
                        </div>

                         <div className="space-y-2">
                            <Label>Hospitais/Clínicas</Label>
                            <Popover open={isClinicPopoverOpen} onOpenChange={setIsClinicPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={isClinicPopoverOpen}
                                        className="w-full justify-between h-auto min-h-10"
                                    >
                                        <div className="flex flex-wrap gap-1">
                                            {formData.clinics && formData.clinics.length > 0 ? (
                                                formData.clinics.map(clinic => (
                                                    <Badge key={clinic} variant="secondary">
                                                        {clinic}
                                                    </Badge>
                                                ))
                                            ) : "Selecione as empresas..." }
                                        </div>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                    <Command>
                                        <CommandInput placeholder="Buscar empresa..." />
                                        <CommandList>
                                            <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
                                            <CommandGroup>
                                            {companies.map((company) => (
                                                <CommandItem
                                                    key={company.id}
                                                    value={company.name}
                                                    onSelect={() => handleClinicSelection(company.name)}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            formData.clinics?.includes(company.name) ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    {company.name}
                                                </CommandItem>
                                            ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="vet-status">Status</Label>
                            <Select value={formData.status} onValueChange={(value: 'Ativo' | 'Inativo') => handleStatusChange(value)} required>
                                <SelectTrigger id="vet-status">
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Ativo">Ativo</SelectItem>
                                    <SelectItem value="Inativo">Inativo</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="bank-data">
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="vet-bankName">Banco</Label>
                                <Input id="vet-bankName" value={formData.bankName || ''} onChange={(e) => handleInputChange('bankName', e.target.value)} placeholder="Ex: Banco do Brasil"/>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="vet-bankAgency">Agência</Label>
                                <Input id="vet-bankAgency" value={formData.bankAgency || ''} onChange={(e) => handleInputChange('bankAgency', e.target.value)} placeholder="Ex: 1234-5"/>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="vet-bankAccount">Conta</Label>
                            <Input id="vet-bankAccount" value={formData.bankAccount || ''} onChange={(e) => handleInputChange('bankAccount', e.target.value)} placeholder="Ex: 12345-6"/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="vet-pixKey">Chave PIX</Label>
                            <Input id="vet-pixKey" value={formData.pixKey || ''} onChange={(e) => handleInputChange('pixKey', e.target.value)} placeholder="Email, CNPJ, Telefone..."/>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                            <div className="space-y-2">
                                <Label htmlFor="vet-closingDay">Dia de Fechamento</Label>
                                <Input id="vet-closingDay" type="number" min="1" max="31" value={formData.closingDay || ''} onChange={(e) => handleNumericInputChange('closingDay', e.target.value)} placeholder="Ex: 5"/>
                                <p className="text-xs text-muted-foreground">
                                    O dia que será inserido no financeiro a necessidade de solicitar a nota fiscal.
                                </p>
                            </div>
                            <div className="flex items-center space-x-2 pt-8">
                                <Switch id="vet-issuesInvoice" checked={formData.issuesInvoice} onCheckedChange={(checked) => handleSwitchChange('issuesInvoice', checked)} />
                                <Label htmlFor="vet-issuesInvoice">Gera Nota Fiscal</Label>
                            </div>
                        </div>
                    </div>
                </TabsContent>
                 <TabsContent value="access-data">
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="vet-email">Email</Label>
                            <Input id="vet-email" type="email" value={formData.email || ''} onChange={(e) => handleInputChange('email', e.target.value)} placeholder="email@exemplo.com" required disabled={isEditMode} />
                        </div>
                        {!isEditMode && (
                            <div className="space-y-2">
                                <Label htmlFor="vet-password">Senha</Label>
                                <Input id="vet-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Defina uma senha de acesso" required />
                            </div>
                        )}
                         {isEditMode && (
                            <p className="text-sm text-muted-foreground">A senha de um usuário existente só pode ser alterada através da recuperação de senha na tela de login.</p>
                        )}
                    </div>
                </TabsContent>
            </Tabs>

            <DialogFooter className="pt-4">
                <DialogClose asChild>
                    <Button type="button" variant="outline">Cancelar</Button>
                </DialogClose>
                <Button type="submit">{isEditMode ? 'Salvar Alterações' : 'Criar Veterinário'}</Button>
            </DialogFooter>
        </form>
         <AlertDialog open={showFinalPaymentDialog} onOpenChange={setShowFinalPaymentDialog}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Inativar Veterinário</AlertDialogTitle>
                    <AlertDialogDescription>
                        Para inativar o veterinário, por favor, informe a data para o lançamento do último pagamento pendente.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex justify-center py-4">
                    <Calendar
                        mode="single"
                        selected={finalPaymentDate}
                        onSelect={setFinalPaymentDate}
                        initialFocus
                    />
                </div>
                <AlertDialogFooter>
                    <Button variant="outline" onClick={handleCancelInactivation}>Cancelar</Button>
                    <Button onClick={handleConfirmFinalPayment} disabled={!finalPaymentDate}>
                        Confirmar e Inativar
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

    

    