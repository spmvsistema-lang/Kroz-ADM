
'use client';

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, PlusCircle, Search, ChevronsUpDown, Check, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { categories as initialCategories, statuses, Supplier, supplierSchema } from "@/lib/clients-data";
import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";


interface AddSupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSupplierAdd: (newSupplier: Omit<Supplier, 'id'>, password?: string) => void;
  onSupplierEdit: (updatedSupplier: Supplier) => void;
  supplierToEdit?: Supplier | null;
}

export function AddSupplierDialog({ open, onOpenChange, onSupplierAdd, onSupplierEdit, supplierToEdit }: AddSupplierDialogProps) {
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);
  const [isSearchingCep, setIsSearchingCep] = useState(false);
  const { toast } = useToast();

  const [categories, setCategories] = useState(initialCategories);
  const [openCategory, setOpenCategory] = useState(false);
  const [accessPassword, setAccessPassword] = useState('');

  const [formData, setFormData] = useState<Partial<Supplier>>({});

  useEffect(() => {
    if (supplierToEdit && open) {
      setFormData(supplierToEdit);
    } else {
      setFormData({
        status: 'Ativo' // Default status for new suppliers
      });
      setAccessPassword('');
    }
  }, [supplierToEdit, open]);

  const handleInputChange = (field: keyof Omit<Supplier, 'id'>, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

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
                cnae: data.cnae_fiscal_descricao,
                cep: data.cep,
                street: data.logradouro,
                neighborhood: data.bairro,
                city: data.municipio,
                state: data.uf,
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

  const handleCepSearch = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
     if (!formData.cep) {
        toast({ variant: "destructive", title: "CEP inválido", description: "Por favor, insira um CEP para buscar." });
        return;
    }
    
    setIsSearchingCep(true);
    const cepOnlyNumbers = formData.cep.replace(/\D/g, '');

     try {
        const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cepOnlyNumbers}`);
        const data = await response.json();
        
        if (response.ok) {
            setFormData(prev => ({
                ...prev,
                street: data.street,
                neighborhood: data.neighborhood,
                city: data.city,
                state: data.state,
            }));
            toast({ title: "Sucesso!", description: "Endereço preenchido." });
        } else {
            throw new Error(data.message || 'CEP não encontrado ou inválido.');
        }

    } catch (error: any) {
         toast({ variant: "destructive", title: "Erro na busca", description: error.message || "Não foi possível buscar o CEP." });
    } finally {
        setIsSearchingCep(false);
    }
  }

  const handleCreateCategory = () => {
    const newCategory = formData.category || '';
    if (newCategory && !categories.some(c => c.label === newCategory)) {
        const newCategoryValue = newCategory.toLowerCase().replace(/\s+/g, '-');
        const newCategoryItem = { value: newCategoryValue, label: newCategory };
        setCategories([...categories, newCategoryItem]);
        handleInputChange('category', newCategoryValue);
        setOpenCategory(false);
    }
  };

  const handleDeleteCategory = (e: React.MouseEvent, valueToDelete: string) => {
    e.stopPropagation();
    e.preventDefault();
    setCategories(prev => prev.filter(c => c.value !== valueToDelete));
    if (formData.category === valueToDelete) {
        handleInputChange('category', '');
    }
    toast({
        title: "Categoria Removida",
        description: "A categoria foi removida com sucesso.",
    });
  };

  const handleSubmit = () => {
    const dataToValidate = {
      id: formData.id || `temp-id-${Date.now()}`, 
      name: formData.name || '',
      cnpj: formData.cnpj || '',
      category: formData.category || '',
      status: formData.status || 'Ativo',
      fantasyName: formData.fantasyName || '',
      cnae: formData.cnae || '',
      cep: formData.cep || '',
      street: formData.street || '',
      number: formData.number || '',
      complement: formData.complement || '',
      neighborhood: formData.neighborhood || '',
      city: formData.city || '',
      state: formData.state || '',
      contactName: formData.contactName || '',
      contactRole: formData.contactRole || '',
      contactPhone: formData.contactPhone || '',
      contactEmail: formData.contactEmail || '',
      accessLogin: formData.accessLogin || '',
    };

    const result = supplierSchema.safeParse(dataToValidate);

    if (!result.success) {
        toast({
            variant: "destructive",
            title: "Erro de Validação",
            description: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        });
        return;
    }
    
    if (supplierToEdit) {
      onSupplierEdit(result.data as Supplier);
    } else {
      const { id, ...newSupplierData } = result.data;
      onSupplierAdd(newSupplierData, accessPassword);
    }
    
    onOpenChange(false);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{supplierToEdit ? 'Editar Fornecedor' : 'Adicionar Novo Fornecedor'}</DialogTitle>
          <DialogDescription>
            Preencha os dados do fornecedor. Opcionalmente, crie um usuário de acesso para ele.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="supplier-data">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="supplier-data">Fornecedor</TabsTrigger>
            <TabsTrigger value="address-data">Endereço</TabsTrigger>
            <TabsTrigger value="contact-data">Contato</TabsTrigger>
            <TabsTrigger value="access-user">Acesso</TabsTrigger>
          </TabsList>

          <TabsContent value="supplier-data">
            <div className="py-4 space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <div className="flex items-center gap-2">
                        <Input id="cnpj" placeholder="Digite o CNPJ e clique em buscar" value={formData.cnpj || ''} onChange={e => handleInputChange('cnpj', e.target.value)} />
                        <Button variant="outline" size="icon" onClick={handleCnpjSearch} disabled={isSearchingCnpj}>
                            {isSearchingCnpj ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            <span className="sr-only">Buscar CNPJ</span>
                        </Button>
                    </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Razão Social (Nome)</Label>
                        <Input id="name" placeholder="Será preenchido pela busca" disabled={isSearchingCnpj} value={formData.name || ''} onChange={e => handleInputChange('name', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="fantasy-name">Nome Fantasia</Label>
                        <Input id="fantasy-name" placeholder="Será preenchido pela busca" disabled={isSearchingCnpj} value={formData.fantasyName || ''} onChange={e => handleInputChange('fantasyName', e.target.value)} />
                    </div>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="cnae">Atividade Principal (CNAE)</Label>
                    <Input id="cnae" placeholder="Será preenchido pela busca" disabled={isSearchingCnpj} value={formData.cnae || ''} onChange={e => handleInputChange('cnae', e.target.value)} />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="category">Categoria</Label>
                         <Popover open={openCategory} onOpenChange={setOpenCategory}>
                            <PopoverTrigger asChild>
                                <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={openCategory}
                                className="w-full justify-between font-normal"
                                disabled={isSearchingCnpj}
                                >
                                {formData.category
                                    ? categories.find((c) => c.value === formData.category)?.label || formData.category
                                    : "Selecione a categoria"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0">
                                <Command>
                                    <CommandInput 
                                        placeholder="Buscar ou criar categoria..." 
                                        onValueChange={(v) => handleInputChange('category', v)}
                                    />
                                    <CommandList>
                                        <CommandEmpty>
                                            <Button variant="link" onClick={handleCreateCategory}>
                                                Criar nova categoria: "{formData.category}"
                                            </Button>
                                        </CommandEmpty>
                                        <CommandGroup>
                                            {categories.map((c) => (
                                            <CommandItem
                                                key={c.value}
                                                value={c.label}
                                                onSelect={() => {
                                                    handleInputChange('category', c.value)
                                                    setOpenCategory(false);
                                                }}
                                                className="flex justify-between"
                                            >
                                                <div className="flex items-center">
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            formData.category === c.value ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    {c.label}
                                                </div>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => e.stopPropagation()}>
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Esta ação não pode ser desfeita. Isso excluirá permanentemente a categoria "{c.label}".
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                            <AlertDialogAction onClick={(e) => handleDeleteCategory(e, c.value)}>Excluir</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="status">Status (Situação Cadastral)</Label>
                         <Select value={formData.status || 'Ativo'} onValueChange={(v) => handleInputChange('status', v)} disabled={isSearchingCnpj}>
                            <SelectTrigger id="status">
                                <SelectValue placeholder="Selecione o status" />
                            </SelectTrigger>
                            <SelectContent>
                                {statuses.map(status => (
                                    <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>
          </TabsContent>

          <TabsContent value="address-data">
             <div className="py-4 space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="cep">CEP</Label>
                    <div className="flex items-center gap-2">
                        <Input id="cep" placeholder="Digite o CEP e clique para buscar" value={formData.cep || ''} onChange={e => handleInputChange('cep', e.target.value)} />
                         <Button variant="outline" size="icon" onClick={handleCepSearch} disabled={isSearchingCep}>
                            {isSearchingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            <span className="sr-only">Buscar CEP</span>
                        </Button>
                    </div>
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2 space-y-2">
                        <Label htmlFor="address-street">Logradouro</Label>
                        <Input id="address-street" placeholder="Ex: Avenida Paulista" value={formData.street || ''} onChange={e => handleInputChange('street', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="address-number">Número</Label>
                        <Input id="address-number" placeholder="Ex: 1000" value={formData.number || ''} onChange={e => handleInputChange('number', e.target.value)} />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="address-complement">Complemento</Label>
                    <Input id="address-complement" placeholder="Ex: Sala 301, Bloco B" value={formData.complement || ''} onChange={e => handleInputChange('complement', e.target.value)} />
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="address-neighborhood">Bairro</Label>
                        <Input id="address-neighborhood" placeholder="Ex: Bela Vista" value={formData.neighborhood || ''} onChange={e => handleInputChange('neighborhood', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="address-city">Cidade</Label>
                        <Input id="address-city" placeholder="Ex: São Paulo" value={formData.city || ''} onChange={e => handleInputChange('city', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="address-state">Estado</Label>
                        <Input id="address-state" placeholder="Ex: SP" value={formData.state || ''} onChange={e => handleInputChange('state', e.target.value)} />
                    </div>
                </div>
             </div>
          </TabsContent>
          
          <TabsContent value="contact-data">
            <div className="py-4 grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="contact-name">Nome do Contato</Label>
                    <Input id="contact-name" placeholder="Nome do contato principal" value={formData.contactName || ''} onChange={e => handleInputChange('contactName', e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="contact-role">Cargo</Label>
                    <Input id="contact-role" placeholder="Ex: Vendedor" value={formData.contactRole || ''} onChange={e => handleInputChange('contactRole', e.target.value)} />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="contact-phone">Telefone</Label>
                    <Input id="contact-phone" type="tel" placeholder="(00) 00000-0000" value={formData.contactPhone || ''} onChange={e => handleInputChange('contactPhone', e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="contact-email">Email</Label>
                    <Input id="contact-email" type="email" placeholder="contato@fornecedor.com" value={formData.contactEmail || ''} onChange={e => handleInputChange('contactEmail', e.target.value)} />
                </div>
            </div>
          </TabsContent>

          <TabsContent value="access-user">
             <div className="py-4 space-y-4">
                <p className="text-sm text-muted-foreground">
                    Crie uma conta de usuário para que seu fornecedor possa acessar o portal. O login será o email de contato.
                </p>
                <div className="space-y-2">
                    <Label htmlFor="user-password">Senha</Label>
                    <Input id="user-password" type="password" value={accessPassword} onChange={(e) => setAccessPassword(e.target.value)} />
                </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" onClick={handleSubmit}>Salvar Fornecedor</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
