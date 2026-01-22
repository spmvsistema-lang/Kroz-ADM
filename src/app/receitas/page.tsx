'use client';

import { PageHeader, PageHeaderDescription, PageHeaderHeading } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Search, FileClock, Edit, ChevronDown, Check, ChevronsUpDown, Loader2, Trash2 } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { db } from "@/firebase/config";
import { collection, addDoc, getDocs, query, where, serverTimestamp, doc, updateDoc, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/firebase/auth/use-user";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useSearchParams } from "next/navigation";


// Tipos de dados
interface RevenueLog {
    action: string;
    user: string;
    date: string;
    details: string;
}

interface Revenue {
    id: string;
    description: string;
    date: string;
    value: number;
    status: 'Recebido' | 'Pendente';
    category: string;
    companyId: string;
    costCenter: string;
    bankAccount: string;
    logs: RevenueLog[];
}

interface Company {
  id: string;
  name: string;
  useDepartments: boolean;
}

interface CostCenter {
    id: string;
    name: string;
}

interface BankAccount {
    id: string;
    bankName: string;
    agency: string;
    account: string;
    companyId: string;
}

const initialCategories = [
    { value: "venda-servico", label: "Venda de Serviço" },
    { value: "venda-produto", label: "Venda de Produto" },
    { value: "aluguel", label: "Recebimento de Aluguel" },
    { value: "outros", label: "Outros" },
];


export default function ReceitasPage() {
    const { toast } = useToast();
    const { user } = useUser();
    const searchParams = useSearchParams();
    const clientName = typeof window !== 'undefined' ? localStorage.getItem('clientName') : null;

    // States for data
    const [companies, setCompanies] = useState<Company[]>([]);
    const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [revenues, setRevenues] = useState<Revenue[]>([]);
    const [filteredRevenues, setFilteredRevenues] = useState<Revenue[]>([]);
    const [modalCostCenters, setModalCostCenters] = useState<CostCenter[]>([]);
    
    // States for form
    const [date, setDate] = useState<Date>();
    const [description, setDescription] = useState('');
    const [value, setValue] = useState('');
    const [selectedCompanyId, setSelectedCompanyId] = useState<string | undefined>();
    const [selectedCostCenterId, setSelectedCostCenterId] = useState<string | undefined>();
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    
    // States for Category Combobox
    const [categories, setCategories] = useState(initialCategories);
    const [openCategory, setOpenCategory] = useState(false);
    const [categoryValue, setCategoryValue] = useState("");
    const [newCategory, setNewCategory] = useState('');

    // UI States
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingCostCenters, setIsLoadingCostCenters] = useState(false);
    const [isLoadingModalCostCenters, setIsLoadingModalCostCenters] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [dateFrom, setDateFrom] = useState<Date>();
    const [dateTo, setDateTo] = useState<Date>();
    const [selectedRevenue, setSelectedRevenue] = useState<Revenue | null>(null);
    const [activeTab, setActiveTab] = useState('novo-lancamento');
    const [searchDescription, setSearchDescription] = useState('');
    const [filterStatus, setFilterStatus] = useState('todos');

    const fetchRevenues = async () => {
        if (!clientName) return;
        setIsLoading(true);
        try {
            const q = query(collection(db, 'clients', clientName, 'revenues'));
            const querySnapshot = await getDocs(q);
            const revenuesData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Revenue));
            setRevenues(revenuesData);
            setFilteredRevenues(revenuesData); // Initialize filtered list
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar as receitas.' });
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        const fetchInitialData = async () => {
            if (!clientName) {
                toast({ variant: 'destructive', title: 'Erro', description: 'Cliente não identificado.'});
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            try {
                const companiesQuery = query(collection(db, 'clients', clientName, 'companies'));
                const companiesSnapshot = await getDocs(companiesQuery);
                const companiesData = companiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Company));
                setCompanies(companiesData);

                const bankAccountsQuery = query(collection(db, 'clients', clientName, 'bankAccounts'));
                const bankAccountsSnapshot = await getDocs(bankAccountsQuery);
                const bankAccountsData = bankAccountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankAccount));
                setBankAccounts(bankAccountsData);

                await fetchRevenues();
            } catch (error) {
                if (!companies.length) {
                    toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os dados de empresa.'});
                }
            } finally {
                setIsLoading(false);
            }
        }
        fetchInitialData();
    }, [clientName]);
    
    useEffect(() => {
        const tab = searchParams.get('tab');
        const id = searchParams.get('id');
    
        if (tab) {
            setActiveTab(tab);
        }
    
        if (id && clientName) {
            const fetchRevenueById = async () => {
                setIsSearching(true);
                try {
                    const revenueRef = doc(db, "clients", clientName, "revenues", id);
                    const docSnap = await getDoc(revenueRef);
                    if (docSnap.exists()) {
                        const revenueData = { id: docSnap.id, ...docSnap.data() } as Revenue;
                        setFilteredRevenues([revenueData]);
                    } else {
                        toast({
                            variant: "destructive",
                            title: "Não encontrada",
                            description: "A receita que você está procurando não foi encontrada.",
                        });
                        setFilteredRevenues([]);
                    }
                } catch (error) {
                    toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível buscar a receita específica.' });
                } finally {
                    setIsSearching(false);
                }
            };
            fetchRevenueById();
        }
    }, [searchParams, clientName, toast]);

    const selectedCompany = useMemo(() => companies.find(c => c.id === selectedCompanyId), [selectedCompanyId, companies]);
    
    useEffect(() => {
        const fetchCostCenters = async () => {
            if (!clientName || !selectedCompanyId || !selectedCompany?.useDepartments) {
                setCostCenters([]);
                setSelectedCostCenterId(undefined);
                return;
            }
            setIsLoadingCostCenters(true);
            try {
                const q = query(collection(db, 'clients', clientName, 'companies', selectedCompanyId, 'costCenters'));
                const querySnapshot = await getDocs(q);
                const centersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CostCenter[];
                setCostCenters(centersData);
            } catch (error) {
                toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os centros de custo.' });
            } finally {
                setIsLoadingCostCenters(false);
            }
        };

        fetchCostCenters();
    }, [clientName, selectedCompanyId, selectedCompany?.useDepartments, toast]);

    // Fetch cost centers for the modal
    useEffect(() => {
        if (!selectedRevenue || !selectedRevenue.companyId || !clientName) {
            setModalCostCenters([]);
            return;
        }
        const company = companies.find(c => c.id === selectedRevenue.companyId);
        if (!company?.useDepartments) {
            setModalCostCenters([]);
            return;
        }

        const fetchModalCostCenters = async () => {
            setIsLoadingModalCostCenters(true);
            try {
                const q = query(collection(db, 'clients', clientName, 'companies', selectedRevenue.companyId, 'costCenters'));
                const querySnapshot = await getDocs(q);
                const centersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CostCenter));
                setModalCostCenters(centersData);
            } catch (error) {
                 toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os centros de custo para edição.' });
            } finally {
                setIsLoadingModalCostCenters(false);
            }
        };

        fetchModalCostCenters();
    }, [selectedRevenue?.companyId, clientName, companies, toast]);


    useEffect(() => {
        if (selectedCompanyId) {
            const companyAccounts = bankAccounts.filter(acc => acc.companyId === selectedCompanyId);
            setSelectedAccountId(companyAccounts.length > 0 ? '' : 'none');
        } else {
            setSelectedAccountId('');
        }
    }, [selectedCompanyId, bankAccounts]);


    const handleAddRevenue = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!clientName || !selectedCompanyId || !date || !description || !value || !categoryValue) {
            toast({ variant: 'destructive', title: 'Campos incompletos', description: 'Por favor, preencha todos os campos obrigatórios.' });
            return;
        }

        setIsSubmitting(true);
        try {
            const newRevenue = {
                companyId: selectedCompanyId,
                costCenter: selectedCostCenterId || '',
                description,
                value: Number(value),
                date: format(date, 'yyyy-MM-dd'),
                category: categoryValue,
                bankAccount: selectedAccountId,
                status: 'Pendente', 
                createdAt: serverTimestamp(),
                logs: [{
                    action: 'Criação',
                    user: user?.displayName || user?.email || "Usuário Desconhecido",
                    date: new Date().toISOString(),
                    details: 'Receita criada.'
                }]
            };

            const docRef = await addDoc(collection(db, "clients", clientName, "revenues"), newRevenue);
            
            // @ts-ignore
            setRevenues(prev => [...prev, { id: docRef.id, ...newRevenue }]);

            toast({ title: 'Sucesso!', description: 'Receita lançada com sucesso.', className: 'bg-accent text-accent-foreground' });
            setDescription('');
            setValue('');
            setDate(undefined);
            setCategoryValue('');
            setSelectedAccountId('');
            setSelectedCostCenterId(undefined);

        } catch (error) {
             toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível salvar a receita.' });
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleUpdateRevenue = async () => {
        if (!selectedRevenue || !clientName || !user) return;

        if (!selectedRevenue.description || !selectedRevenue.value || !selectedRevenue.date || !selectedRevenue.category || !selectedRevenue.companyId) {
            toast({ variant: 'destructive', title: 'Campos incompletos', description: 'Todos os campos devem ser preenchidos.' });
            return;
        }

        setIsSubmitting(true);
        try {
            const revenueRef = doc(db, "clients", clientName, "revenues", selectedRevenue.id);
            
            const newLog = {
                action: 'Edição',
                user: user.displayName || user.email || "Usuário Desconhecido",
                date: new Date().toISOString(),
                details: `Receita editada.`
            };
            
            const updatedLogs = [...(selectedRevenue.logs || []), newLog];

            const { id, ...revenueDataToUpdate } = { ...selectedRevenue, logs: updatedLogs };
            await updateDoc(revenueRef, revenueDataToUpdate);
            
            toast({ title: 'Sucesso!', description: 'Receita atualizada com sucesso.', className: 'bg-accent text-accent-foreground' });
            
            setRevenues(prev => prev.map(r => r.id === selectedRevenue.id ? selectedRevenue : r));
            setFilteredRevenues(prev => prev.map(r => r.id === selectedRevenue.id ? selectedRevenue : r));

            setSelectedRevenue(null);

        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível atualizar a receita.' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleSelectedRevenueChange = (field: keyof Revenue, value: any) => {
        if (selectedRevenue) {
            setSelectedRevenue(prev => {
                const updated = { ...prev!, [field]: value };
                 if (field === 'companyId') {
                    updated.costCenter = '';
                    updated.bankAccount = '';
                }
                return updated;
            });
        }
    }

    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'Recebido':
                return 'default';
            case 'Pendente':
                return 'secondary';
            default:
                return 'outline';
        }
    };
    
    const handleCreateCategory = () => {
        if (newCategory) {
            const newCategoryValue = newCategory.toLowerCase().replace(/\s+/g, '-');
            const newCategoryItem = { value: newCategoryValue, label: newCategory };
            setCategories([...categories, newCategoryItem]);
            setCategoryValue(newCategoryValue);
            setNewCategory('');
            setOpenCategory(false);
        }
    };
    
    const handleCreateCategoryInModal = () => {
        if (newCategory && selectedRevenue) {
            const newCategoryValue = newCategory.toLowerCase().replace(/\s+/g, '-');
            const newCategoryItem = { value: newCategoryValue, label: newCategory };
            setCategories([...categories, newCategoryItem]);
            handleSelectedRevenueChange('category', newCategoryValue);
            setNewCategory('');
            setOpenCategory(false);
        }
    };

    const handleDeleteCategory = (e: React.MouseEvent, valueToDelete: string) => {
        e.stopPropagation();
        e.preventDefault();
        
        setCategories(prev => prev.filter(c => c.value !== valueToDelete));
        if (categoryValue === valueToDelete) {
          setCategoryValue('');
        }
         if (selectedRevenue?.category === valueToDelete) {
            handleSelectedRevenueChange('category', '');
        }
        
        toast({
          title: "Categoria Removida",
          description: "A categoria foi removida da lista.",
        });
      };

    const getCategoryLabel = (value: string) => {
        return categories.find(c => c.value === value)?.label || value;
    }

    const handleSearch = () => {
        setIsSearching(true);
        let results = [...revenues];

        if (searchDescription) {
            results = results.filter(r => r.description.toLowerCase().includes(searchDescription.toLowerCase()));
        }
        if (filterStatus !== 'todos') {
            results = results.filter(r => r.status === filterStatus);
        }
        if (dateFrom) {
            results = results.filter(r => new Date(r.date) >= dateFrom);
        }
        if (dateTo) {
            results = results.filter(r => new Date(r.date) <= dateTo);
        }

        setFilteredRevenues(results);
        setIsSearching(false);

        if (results.length === 0) {
            toast({ title: 'Nenhum resultado', description: 'Nenhuma receita encontrada para os filtros aplicados.' });
        }
    };


    return (
        <div className="space-y-6">
            <PageHeader>
                <PageHeaderHeading>Gestão de Receitas</PageHeaderHeading>
                <PageHeaderDescription>
                    Realize o lançamento manual de receitas, como vendas e serviços.
                </PageHeaderDescription>
            </PageHeader>
            
            <Dialog onOpenChange={(isOpen) => !isOpen && setSelectedRevenue(null)}>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="novo-lancamento">Novo Lançamento</TabsTrigger>
                        <TabsTrigger value="receitas-lancadas">Receitas Lançadas</TabsTrigger>
                    </TabsList>
                    <TabsContent value="novo-lancamento">
                        <form onSubmit={handleAddRevenue}>
                        <Card>
                            <CardHeader>
                                <CardTitle>Lançamento de Nova Receita</CardTitle>
                                <CardDescription>Preencha os detalhes abaixo para registrar uma nova entrada.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="revenue-company">Empresa</Label>
                                        <Select onValueChange={setSelectedCompanyId} value={selectedCompanyId}>
                                            <SelectTrigger id="revenue-company">
                                                <SelectValue placeholder="Selecione a empresa" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {companies.map(company => (
                                                    <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="revenue-cost-center">Centro de Custo</Label>
                                        <Select
                                            onValueChange={setSelectedCostCenterId}
                                            value={selectedCostCenterId}
                                            disabled={!selectedCompany || !selectedCompany.useDepartments || isLoadingCostCenters}
                                        >
                                            <SelectTrigger id="revenue-cost-center">
                                                <SelectValue placeholder={
                                                    !selectedCompany ? "Selecione a empresa" : 
                                                    !selectedCompany.useDepartments ? "Não aplicável" :
                                                    isLoadingCostCenters ? "Carregando..." :
                                                    "Selecione o centro de custo"
                                                } />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {isLoadingCostCenters ? (
                                                    <div className="flex items-center justify-center p-2">
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    </div>
                                                ) : (
                                                    costCenters.length > 0 ? (
                                                        costCenters.map(center => (
                                                            <SelectItem key={center.id} value={center.id}>{center.name}</SelectItem>
                                                        ))
                                                    ) : (
                                                        <p className="p-2 text-xs text-muted-foreground">Nenhum centro de custo cadastrado.</p>
                                                    )
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <div className="lg:col-span-2 space-y-2">
                                        <Label htmlFor="revenue-description">Descrição da Receita</Label>
                                        <Input id="revenue-description" placeholder="Ex: Venda de serviço de consultoria" value={description} onChange={(e) => setDescription(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="revenue-value">Valor (R$)</Label>
                                        <Input id="revenue-value" type="number" placeholder="2500,00" value={value} onChange={(e) => setValue(e.target.value)}/>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="revenue-date">Data da Receita</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {date ? format(date, "dd/MM/yyyy") : <span>Selecione a data</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="revenue-category">Categoria</Label>
                                        <Popover open={openCategory} onOpenChange={setOpenCategory}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={openCategory}
                                                className="w-full justify-between"
                                                >
                                                {categoryValue
                                                    ? categories.find((c) => c.value === categoryValue)?.label
                                                    : "Selecione a categoria"}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-full p-0">
                                                <Command>
                                                <CommandInput 
                                                    placeholder="Buscar ou criar categoria..." 
                                                    value={newCategory}
                                                    onValueChange={setNewCategory}
                                                />
                                                <CommandList>
                                                    <CommandEmpty>
                                                        <Button variant="link" onClick={handleCreateCategory}>
                                                            Criar nova categoria: "{newCategory}"
                                                        </Button>
                                                    </CommandEmpty>
                                                    <CommandGroup>
                                                        {categories.map((c) => (
                                                        <CommandItem
                                                            key={c.value}
                                                            value={c.label}
                                                            onSelect={() => {
                                                            setCategoryValue(c.value === categoryValue ? "" : c.value);
                                                            setOpenCategory(false);
                                                            }}
                                                            className="flex justify-between"
                                                        >
                                                            <div>
                                                                <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    categoryValue === c.value ? "opacity-100" : "opacity-0"
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
                                        <Label htmlFor="revenue-bank-account">Conta Bancária</Label>
                                        <Select
                                            value={selectedAccountId}
                                            onValueChange={setSelectedAccountId}
                                            disabled={!selectedCompanyId}
                                        >
                                            <SelectTrigger id="revenue-bank-account">
                                                <SelectValue placeholder={!selectedCompanyId ? "Selecione a empresa" : "Selecione a conta"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Não vincular (apenas controle)</SelectItem>
                                                {bankAccounts.filter(acc => acc.companyId === selectedCompanyId).map(acc => (
                                                    <SelectItem key={acc.id} value={acc.id}>{acc.bankName} (Ag: {acc.agency})</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="justify-end">
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Salvar Receita
                                </Button>
                            </CardFooter>
                        </Card>
                        </form>
                    </TabsContent>
                    <TabsContent value="receitas-lancadas">
                        <div className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Filtrar Receitas</CardTitle>
                                    <CardDescription>Filtre as receitas lançadas por período, status ou descrição.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                                        <div className="space-y-2 lg:col-span-4">
                                            <Label htmlFor="search-description">Descrição</Label>
                                            <Input id="search-description" placeholder="Buscar por descrição..." value={searchDescription} onChange={(e) => setSearchDescription(e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="date-from">De</Label>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        id="date-from"
                                                        variant={"outline"}
                                                        className={cn("w-full justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}
                                                    >
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {dateFrom ? format(dateFrom, "dd/MM/yyyy") : <span>Selecione</span>}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0">
                                                    <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="date-to">Até</Label>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        id="date-to"
                                                        variant={"outline"}
                                                        className={cn("w-full justify-start text-left font-normal", !dateTo && "text-muted-foreground")}
                                                    >
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {dateTo ? format(dateTo, "dd/MM/yyyy") : <span>Selecione</span>}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0">
                                                    <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="filter-status">Status</Label>
                                            <Select value={filterStatus} onValueChange={setFilterStatus}>
                                                <SelectTrigger id="filter-status">
                                                    <SelectValue placeholder="Todos" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="todos">Todos</SelectItem>
                                                    <SelectItem value="Recebido">Recebido</SelectItem>
                                                    <SelectItem value="Pendente">Pendente</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="justify-end">
                                    <Button onClick={handleSearch} disabled={isSearching}>
                                        {isSearching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Buscar
                                    </Button>
                                </CardFooter>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Resultados</CardTitle>
                                    <CardDescription>Acompanhe as receitas registradas e seu status.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {isLoading || isSearching ? (
                                        <div className="flex justify-center items-center h-24">
                                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : filteredRevenues.length > 0 ? (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Descrição</TableHead>
                                                    <TableHead>Categoria</TableHead>
                                                    <TableHead>Data</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead className="text-right">Valor</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredRevenues.map((revenue) => (
                                                    <DialogTrigger key={revenue.id} asChild>
                                                        <TableRow className="cursor-pointer" onClick={() => setSelectedRevenue(revenue)}>
                                                            <TableCell className="font-medium">{revenue.description}</TableCell>
                                                            <TableCell>
                                                                <Badge variant="outline">{getCategoryLabel(revenue.category)}</Badge>
                                                            </TableCell>
                                                            <TableCell>{format(new Date(revenue.date), 'dd/MM/yyyy')}</TableCell>
                                                            <TableCell>
                                                                <Badge variant={getStatusVariant(revenue.status)} className={revenue.status === 'Recebido' ? 'bg-accent text-accent-foreground' : ''}>
                                                                    {revenue.status}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-right">R$ {revenue.value.toFixed(2)}</TableCell>
                                                        </TableRow>
                                                    </DialogTrigger>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    ) : (
                                        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma receita encontrada.</p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>
                 {selectedRevenue && (
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Editar Receita: {selectedRevenue.id.substring(0,8)}...</DialogTitle>
                            <DialogDescription>
                                Altere as informações da receita e salve as alterações.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={(e) => { e.preventDefault(); handleUpdateRevenue(); }}>
                            <div className="py-4 space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-revenue-description">Descrição</Label>
                                    <Input id="edit-revenue-description" value={selectedRevenue.description} onChange={(e) => handleSelectedRevenueChange('description', e.target.value)} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                     <div className="space-y-2">
                                        <Label htmlFor="edit-revenue-company">Empresa</Label>
                                        <Select value={selectedRevenue.companyId} onValueChange={(value) => handleSelectedRevenueChange('companyId', value)}>
                                            <SelectTrigger id="edit-revenue-company"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                            <SelectContent>
                                                {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="edit-revenue-cost-center">Centro de Custo</Label>
                                        <Select
                                            value={selectedRevenue.costCenter}
                                            onValueChange={(value) => handleSelectedRevenueChange('costCenter', value)}
                                            disabled={!companies.find(c => c.id === selectedRevenue.companyId)?.useDepartments || isLoadingModalCostCenters}
                                        >
                                            <SelectTrigger id="edit-revenue-cost-center">
                                                <SelectValue placeholder={
                                                    !companies.find(c => c.id === selectedRevenue.companyId)?.useDepartments ? 'Não aplicável' :
                                                    isLoadingModalCostCenters ? 'Carregando...' :
                                                    'Selecione'
                                                } />
                                            </SelectTrigger>
                                            <SelectContent>
                                                 {modalCostCenters.map(center => (
                                                    <SelectItem key={center.id} value={center.id}>{center.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="edit-revenue-value">Valor</Label>
                                        <Input id="edit-revenue-value" type="number" value={selectedRevenue.value} onChange={(e) => handleSelectedRevenueChange('value', Number(e.target.value))} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="edit-revenue-date">Data</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !selectedRevenue.date && "text-muted-foreground")}>
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {selectedRevenue.date ? format(new Date(selectedRevenue.date), "dd/MM/yyyy") : <span>Selecione</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar mode="single" selected={new Date(selectedRevenue.date)} onSelect={(day) => day && handleSelectedRevenueChange('date', format(day, 'yyyy-MM-dd'))} />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="edit-revenue-category">Categoria</Label>
                                        <Popover open={openCategory} onOpenChange={setOpenCategory}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={openCategory}
                                                className="w-full justify-between font-normal"
                                                >
                                                {selectedRevenue.category
                                                    ? categories.find((c) => c.value === selectedRevenue.category)?.label
                                                    : "Selecione..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-full p-0">
                                                <Command>
                                                    <CommandInput 
                                                        placeholder="Buscar ou criar..." 
                                                        value={newCategory}
                                                        onValueChange={setNewCategory}
                                                    />
                                                    <CommandList>
                                                        <CommandEmpty>
                                                            <Button variant="link" onClick={handleCreateCategoryInModal}>
                                                                Criar nova: "{newCategory}"
                                                            </Button>
                                                        </CommandEmpty>
                                                        <CommandGroup>
                                                            {categories.map((c) => (
                                                            <CommandItem
                                                                key={c.value}
                                                                value={c.label}
                                                                onSelect={() => {
                                                                    handleSelectedRevenueChange('category', c.value);
                                                                    setOpenCategory(false);
                                                                }}
                                                                className="flex justify-between"
                                                            >
                                                                <div>
                                                                    <Check className={cn("mr-2 h-4 w-4", selectedRevenue.category === c.value ? "opacity-100" : "opacity-0")} />
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
                                        <Label htmlFor="edit-revenue-bank-account">Conta Bancária</Label>
                                        <Select 
                                            value={selectedRevenue.bankAccount} 
                                            onValueChange={(value) => handleSelectedRevenueChange('bankAccount', value)}
                                            disabled={!selectedRevenue.companyId}
                                        >
                                            <SelectTrigger id="edit-revenue-bank-account"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                            <SelectContent>
                                                 <SelectItem value="none">Não vincular</SelectItem>
                                                 {bankAccounts.filter(acc => acc.companyId === selectedRevenue.companyId).map(acc => (
                                                    <SelectItem key={acc.id} value={acc.id}>{acc.bankName} (Ag: {acc.agency})</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="edit-revenue-status">Status</Label>
                                        <Select value={selectedRevenue.status} onValueChange={(value) => handleSelectedRevenueChange('status', value)}>
                                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Pendente">Pendente</SelectItem>
                                                <SelectItem value="Recebido">Recebido</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <Separator />
                                <Collapsible>
                                    <CollapsibleTrigger className="flex items-center justify-between w-full font-medium mb-3 group text-sm">
                                        <div className="flex items-center gap-2">
                                            <FileClock className="h-5 w-5 text-primary" /> Log de Alterações
                                        </div>
                                        <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                                        <div className="space-y-4 pl-7 pt-2">
                                            {selectedRevenue.logs && selectedRevenue.logs.map((log, index) => (
                                                <div key={index} className="flex items-start gap-4">
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                                                        {log.action === 'Criação' ? <Search className="h-4 w-4 text-muted-foreground" /> : <Edit className="h-4 w-4 text-muted-foreground" />}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-sm">{log.action} por {log.user}</p>
                                                        <p className="text-xs text-muted-foreground">{format(new Date(log.date), 'dd/MM/yyyy HH:mm')}</p>
                                                        <p className="text-sm mt-1">{log.details}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            </div>
                             <DialogFooter>
                                <DialogClose asChild>
                                    <Button variant="outline" type="button">Cancelar</Button>
                                </DialogClose>
                                <Button type="submit" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Salvar Alterações
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
}
