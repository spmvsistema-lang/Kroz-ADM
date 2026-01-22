
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
import { CalendarIcon, Search, UploadCloud, ChevronsUpDown, Check, Loader2, Trash2 } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/firebase/config";
import { collection, addDoc, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useSearchParams } from "next/navigation";
import { useUser } from "@/firebase/auth/use-user";

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

interface Expense {
    id: string;
    description: string;
    value: number;
    expenseDate: string;
    category: string;
    companyId: string;
    bankAccountId?: string;
    status: 'Pendente' | 'Pago';
}


const initialExpenseCategories = [
    { value: 'contas-consumo', label: 'Contas de Consumo' },
    { value: 'reembolsos', label: 'Reembolsos' },
    { value: 'servicos', label: 'Serviços Contratados' },
    { value: 'outros', label: 'Outros' },
];

const initialPaymentMethods = [
    { value: 'boleto', label: 'Boleto' },
    { value: 'cartao-corporativo', label: 'Cartão Corporativo' },
    { value: 'pix', label: 'PIX' },
    { value: 'transferencia', label: 'Transferência' },
];

export default function DespesasPage() {
    const { toast } = useToast();
    const { user } = useUser();
    const searchParams = useSearchParams();
    const clientName = typeof window !== 'undefined' ? localStorage.getItem('clientName') : null;

    // Data states
    const [companies, setCompanies] = useState<Company[]>([]);
    const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    
    // Form states
    const [companyId, setCompanyId] = useState('');
    const [costCenterId, setCostCenterId] = useState('');
    const [description, setDescription] = useState('');
    const [value, setValue] = useState('');
    const [expenseDate, setExpenseDate] = useState<Date>();
    const [hasAttachment, setHasAttachment] = useState(false);
    const [boletoCode, setBoletoCode] = useState('');
    const [selectedAccountId, setSelectedAccountId] = useState('');
    
    // UI states
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingCostCenters, setIsLoadingCostCenters] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExpenseDatePopoverOpen, setIsExpenseDatePopoverOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('novo-lancamento');


    // Combobox states
    const [expenseCategories, setExpenseCategories] = useState(initialExpenseCategories);
    const [openExpenseCategory, setOpenExpenseCategory] = useState(false);
    const [expenseCategoryValue, setExpenseCategoryValue] = useState("");
    const [newExpenseCategory, setNewExpenseCategory] = useState("");

    const [paymentMethods, setPaymentMethods] = useState(initialPaymentMethods);
    const [openPaymentMethod, setOpenPaymentMethod] = useState(false);
    const [paymentMethodValue, setPaymentMethodValue] = useState("");
    const [newPaymentMethod, setNewPaymentMethod] = useState("");
    
    // States for search tab
    const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchDescription, setSearchDescription] = useState('');
    const [searchDateFrom, setSearchDateFrom] = useState<Date>();
    const [searchDateTo, setSearchDateTo] = useState<Date>();
    const [searchCompanyId, setSearchCompanyId] = useState('all');
    const [searchPaymentMethod, setSearchPaymentMethod] = useState('all');
    const [searchCategory, setSearchCategory] = useState('all');
    const [isDateFromPopoverOpen, setIsDateFromPopoverOpen] = useState(false);
    const [isDateToPopoverOpen, setIsDateToPopoverOpen] = useState(false);

    // Permissions states
    const [tabPermissions, setTabPermissions] = useState<Record<string, boolean>>({});
    const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);


     useEffect(() => {
        const fetchPermissions = async () => {
            if (!user) return;
            if (!clientName) {
                setTabPermissions({});
                setIsLoadingPermissions(false);
                return;
            }
    
            try {
                const userDocRef = doc(db, 'clients', clientName, 'users', user.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (!userDocSnap.exists()) {
                    setTabPermissions({});
                    setIsLoadingPermissions(false);
                    return;
                }
                const userRole = userDocSnap.data().role;
    
                const rolesQuery = query(collection(db, 'roles'), where('clientId', '==', clientName), where('name', '==', userRole));
                const rolesSnapshot = await getDocs(rolesQuery);
                
                if (rolesSnapshot.empty) {
                    setTabPermissions({});
                    setIsLoadingPermissions(false);
                    return;
                }
                
                const roleData = rolesSnapshot.docs[0].data();
                const permissions = roleData.permissions?.despesas;
    
                if (permissions && typeof permissions === 'object' && permissions.tabs) {
                    setTabPermissions(permissions.tabs);
                } else {
                    setTabPermissions({});
                }
    
            } catch (e) {
                console.error("Error fetching tab permissions: ", e);
                setTabPermissions({});
            } finally {
                setIsLoadingPermissions(false);
            }
        };
    
        if(user) fetchPermissions();
    }, [user, clientName]);


    const selectedCompany = useMemo(() => companies.find(c => c.id === companyId), [companyId, companies]);

    useEffect(() => {
        if (!clientName) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Cliente não identificado.'});
            setIsLoading(false);
            return;
        }

        const fetchInitialData = async () => {
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
                
            } catch (error) {
                console.error("Erro ao carregar dados:", error);
                toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os dados de empresa e contas.'});
            } finally {
                setIsLoading(false);
            }
        };

        fetchInitialData();
    }, [clientName, toast]);

    useEffect(() => {
        const fetchCostCenters = async () => {
            if (!clientName || !companyId || !selectedCompany?.useDepartments) {
                setCostCenters([]);
                setCostCenterId('');
                return;
            }
            setIsLoadingCostCenters(true);
            try {
                const q = query(collection(db, 'clients', clientName, 'companies', companyId, 'costCenters'));
                const querySnapshot = await getDocs(q);
                const centersData = querySnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name } as CostCenter));
                setCostCenters(centersData);
            } catch (error) {
                toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os centros de custo.' });
            } finally {
                setIsLoadingCostCenters(false);
            }
        };

        fetchCostCenters();
    }, [clientName, companyId, selectedCompany, toast]);

    useEffect(() => {
        const tab = searchParams.get('tab');
        const id = searchParams.get('id');
    
        if (tab) {
            setActiveTab(tab);
        }
    
        if (id && clientName) {
            const fetchExpenseById = async () => {
                setIsSearching(true);
                try {
                    const expenseRef = doc(db, "clients", clientName, "expenses", id);
                    const docSnap = await getDoc(expenseRef);
                    if (docSnap.exists()) {
                        const expenseData = { id: docSnap.id, ...docSnap.data() } as Expense;
                        setFilteredExpenses([expenseData]);
                    } else {
                        toast({
                            variant: "destructive",
                            title: "Não encontrado",
                            description: "A despesa que você está procurando não foi encontrada.",
                        });
                        setFilteredExpenses([]);
                    }
                } catch (error) {
                    toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível buscar a despesa específica.' });
                } finally {
                    setIsSearching(false);
                }
            };
            fetchExpenseById();
        }
    }, [searchParams, clientName, toast]);
    
    const resetForm = () => {
        setCompanyId('');
        setCostCenterId('');
        setDescription('');
        setValue('');
        setExpenseDate(undefined);
        setExpenseCategoryValue('');
        setPaymentMethodValue('');
        setBoletoCode('');
        setHasAttachment(false);
        setSelectedAccountId('');
    };

    const handleSaveExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!clientName || !companyId || !description || !value || !expenseDate || !expenseCategoryValue || !paymentMethodValue || !selectedAccountId) {
            toast({ variant: 'destructive', title: 'Campos incompletos', description: 'Por favor, preencha todos os campos obrigatórios.' });
            return;
        }
        setIsSubmitting(true);
        try {
            await addDoc(collection(db, "clients", clientName, "expenses"), {
                clientId: clientName,
                companyId,
                costCenterId: costCenterId || null,
                description,
                value: Number(value),
                expenseDate: format(expenseDate, 'yyyy-MM-dd'),
                category: expenseCategoryValue,
                paymentMethod: paymentMethodValue,
                bankAccountId: selectedAccountId,
                boletoCode: paymentMethodValue === 'boleto' ? boletoCode : null,
                hasAttachment,
                status: 'Pendente',
                createdAt: new Date(),
            });

            toast({ title: 'Sucesso!', description: 'Despesa lançada com sucesso.', className: 'bg-accent text-accent-foreground' });
            resetForm();
        } catch (error) {
            console.error("Erro ao salvar despesa:", error);
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível salvar a despesa.' });
        } finally {
            setIsSubmitting(false);
        }
    };


    const handleCreateExpenseCategory = () => {
        if (newExpenseCategory) {
            const newValue = newExpenseCategory.toLowerCase().replace(/\s+/g, '-');
            const newItem = { value: newValue, label: newExpenseCategory };
            setExpenseCategories([...expenseCategories, newItem]);
            setExpenseCategoryValue(newValue);
            setNewExpenseCategory('');
            setOpenExpenseCategory(false);
        }
    };

    const handleCreatePaymentMethod = () => {
        if (newPaymentMethod) {
            const newValue = newPaymentMethod.toLowerCase().replace(/\s+/g, '-');
            const newItem = { value: newValue, label: newPaymentMethod };
            setPaymentMethods([...paymentMethods, newItem]);
            setPaymentMethodValue(newValue);
            setNewPaymentMethod('');
            setOpenPaymentMethod(false);
        }
    };

    const handleDeleteCategory = (
        e: React.MouseEvent,
        valueToDelete: string,
        type: 'expense' | 'payment'
      ) => {
        e.stopPropagation();
        e.preventDefault();
      
        if (type === 'expense') {
          setExpenseCategories(prev => prev.filter(c => c.value !== valueToDelete));
          if (expenseCategoryValue === valueToDelete) {
            setExpenseCategoryValue('');
          }
        } else {
          setPaymentMethods(prev => prev.filter(pm => pm.value !== valueToDelete));
          if (paymentMethodValue === valueToDelete) {
            setPaymentMethodValue('');
          }
        }
      
        toast({
          title: "Categoria Removida",
          description: "A categoria foi removida da lista.",
        });
      };
      
    const handleSearch = async () => {
        if (!clientName) return;
        setIsSearching(true);
        try {
            let expensesQuery: any = query(collection(db, "clients", clientName, "expenses"));

            if (searchCompanyId && searchCompanyId !== 'all') {
                expensesQuery = query(expensesQuery, where("companyId", "==", searchCompanyId));
            }
            if (searchCategory && searchCategory !== 'all') {
                expensesQuery = query(expensesQuery, where("category", "==", searchCategory));
            }
            if (searchPaymentMethod && searchPaymentMethod !== 'all') {
                expensesQuery = query(expensesQuery, where("paymentMethod", "==", searchPaymentMethod));
            }
            if (dateFrom) {
                expensesQuery = query(expensesQuery, where("expenseDate", ">=", format(searchDateFrom, 'yyyy-MM-dd')));
            }
            if (dateTo) {
                expensesQuery = query(expensesQuery, where("expenseDate", "<=", format(searchDateTo, 'yyyy-MM-dd')));
            }
            
            const querySnapshot = await getDocs(expensesQuery);
            let results = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));

            if (searchDescription) {
                results = results.filter(expense => 
                    expense.description.toLowerCase().includes(searchDescription.toLowerCase())
                );
            }

            setFilteredExpenses(results);

            if (results.length === 0) {
                 toast({
                    title: "Nenhum resultado",
                    description: "Nenhuma despesa encontrada para os filtros aplicados.",
                });
            }

        } catch (error) {
            console.error("Error searching expenses:", error);
            toast({ variant: 'destructive', title: 'Erro na Busca', description: 'Não foi possível buscar as despesas.' });
        } finally {
            setIsSearching(false);
        }
    };
    
    const getCategoryBadgeColor = (categoryValue: string) => {
        const colors = [
            'border-transparent bg-chart-1/20 text-chart-1 hover:bg-chart-1/30',
            'border-transparent bg-chart-2/20 text-chart-2 hover:bg-chart-2/30',
            'border-transparent bg-chart-3/20 text-chart-3 hover:bg-chart-3/30',
            'border-transparent bg-chart-4/20 text-chart-4 hover:bg-chart-4/30',
            'border-transparent bg-chart-5/20 text-chart-5 hover:bg-chart-5/30',
        ];
        // Simple hash function to get a consistent color for a given category string
        let hash = 0;
        if (!categoryValue || categoryValue.length === 0) return colors[0];
        for (let i = 0; i < categoryValue.length; i++) {
            hash = categoryValue.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash % colors.length);
        return colors[index];
    };

    if (isLoadingPermissions) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }


    return (
        <div className="space-y-6">
            <PageHeader>
                <PageHeaderHeading>Gestão de Despesas</PageHeaderHeading>
                <PageHeaderDescription>
                    Lance e visualize todas as despesas da sua empresa.
                </PageHeaderDescription>
            </PageHeader>
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    {(tabPermissions?.['novo-lancamento'] !== false) && <TabsTrigger value="novo-lancamento">Novo Lançamento</TabsTrigger> }
                    {(tabPermissions?.['despesas-lancadas'] !== false) && <TabsTrigger value="despesas-lancadas">Despesas Lançadas</TabsTrigger> }
                </TabsList>
                {(tabPermissions?.['novo-lancamento'] !== false) && 
                <TabsContent value="novo-lancamento">
                    <form onSubmit={handleSaveExpense}>
                    <Card>
                        <CardHeader>
                            <CardTitle>Lançamento de Despesa Avulsa</CardTitle>
                            <CardDescription>Registre despesas como contas de consumo, reembolsos, etc.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="expense-company">Empresa</Label>
                                    <Select value={companyId} onValueChange={setCompanyId} disabled={isLoading} required>
                                        <SelectTrigger id="expense-company">
                                            <SelectValue placeholder="Selecione a empresa" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                 <div className="space-y-2">
                                    <Label htmlFor="expense-cost-center">Centro de Custo</Label>
                                    <Select
                                        value={costCenterId}
                                        onValueChange={setCostCenterId}
                                        disabled={!selectedCompany || !selectedCompany.useDepartments || isLoadingCostCenters}
                                    >
                                        <SelectTrigger id="expense-cost-center">
                                            <SelectValue placeholder={
                                                !selectedCompany ? "Selecione uma empresa" :
                                                !selectedCompany.useDepartments ? "Não aplicável" :
                                                isLoadingCostCenters ? "Carregando..." :
                                                "Selecione"
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
                                                    <p className="p-2 text-xs text-muted-foreground">Nenhum centro de custo.</p>
                                                )
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <Separator />
                            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div className="lg:col-span-2 space-y-2">
                                    <Label htmlFor="expense-description">Descrição da Despesa</Label>
                                    <Input id="expense-description" placeholder="Ex: Conta de luz, Reembolso de viagem" value={description} onChange={e => setDescription(e.target.value)} required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="expense-value">Valor (R$)</Label>
                                    <Input id="expense-value" type="number" placeholder="150,00" value={value} onChange={e => setValue(e.target.value)} required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="expense-date">Data da Despesa</Label>
                                     <Popover open={isExpenseDatePopoverOpen} onOpenChange={setIsExpenseDatePopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full justify-start text-left font-normal",
                                                    !expenseDate && "text-muted-foreground"
                                                )}
                                                required
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {expenseDate ? format(expenseDate, "dd/MM/yyyy") : <span>Selecione a data</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar
                                                mode="single"
                                                selected={expenseDate}
                                                onSelect={(day) => { setExpenseDate(day); setIsExpenseDatePopoverOpen(false); }}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                 <div className="space-y-2">
                                    <Label htmlFor="expense-category">Categoria da Despesa</Label>
                                    <Popover open={openExpenseCategory} onOpenChange={setOpenExpenseCategory}>
                                        <PopoverTrigger asChild>
                                            <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openExpenseCategory}
                                            className="w-full justify-between"
                                            required
                                            >
                                            {expenseCategoryValue
                                                ? expenseCategories.find((c) => c.value === expenseCategoryValue)?.label
                                                : "Selecione..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-full p-0">
                                            <Command>
                                                <CommandInput 
                                                    placeholder="Buscar ou criar..." 
                                                    value={newExpenseCategory}
                                                    onValueChange={setNewExpenseCategory}
                                                />
                                                <CommandList>
                                                    <CommandEmpty>
                                                        <Button variant="link" onClick={handleCreateExpenseCategory}>
                                                            Criar nova: "{newExpenseCategory}"
                                                        </Button>
                                                    </CommandEmpty>
                                                    <CommandGroup>
                                                        {expenseCategories.map((c) => (
                                                            <CommandItem
                                                                key={c.value}
                                                                value={c.label}
                                                                onSelect={() => {
                                                                    setExpenseCategoryValue(c.value === expenseCategoryValue ? "" : c.value);
                                                                    setOpenExpenseCategory(false);
                                                                }}
                                                                className="flex justify-between"
                                                            >
                                                                <div>
                                                                    <Check className={cn("mr-2 h-4 w-4", expenseCategoryValue === c.value ? "opacity-100" : "opacity-0")} />
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
                                                                            <AlertDialogAction onClick={(e) => handleDeleteCategory(e, c.value, 'expense')}>Excluir</AlertDialogAction>
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
                                    <Label htmlFor="expense-payment-method">Forma de Pagamento</Label>
                                    <Popover open={openPaymentMethod} onOpenChange={setOpenPaymentMethod}>
                                        <PopoverTrigger asChild>
                                            <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openPaymentMethod}
                                            className="w-full justify-between"
                                            required
                                            >
                                            {paymentMethodValue
                                                ? paymentMethods.find((pm) => pm.value === paymentMethodValue)?.label
                                                : "Selecione..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-full p-0">
                                            <Command>
                                                <CommandInput 
                                                    placeholder="Buscar ou criar..." 
                                                    value={newPaymentMethod}
                                                    onValueChange={setNewPaymentMethod}
                                                />
                                                <CommandList>
                                                    <CommandEmpty>
                                                        <Button variant="link" onClick={handleCreatePaymentMethod}>
                                                            Criar nova: "{newPaymentMethod}"
                                                        </Button>
                                                    </CommandEmpty>
                                                    <CommandGroup>
                                                        {paymentMethods.map((pm) => (
                                                            <CommandItem
                                                                key={pm.value}
                                                                value={pm.label}
                                                                onSelect={() => {
                                                                    setPaymentMethodValue(pm.value === paymentMethodValue ? "" : pm.value);
                                                                    setOpenPaymentMethod(false);
                                                                }}
                                                                className="flex justify-between"
                                                            >
                                                                <div>
                                                                    <Check className={cn("mr-2 h-4 w-4", paymentMethodValue === pm.value ? "opacity-100" : "opacity-0")} />
                                                                    {pm.label}
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
                                                                                Esta ação não pode ser desfeita. Isso excluirá permanentemente a forma de pagamento "{pm.label}".
                                                                            </AlertDialogDescription>
                                                                        </AlertDialogHeader>
                                                                        <AlertDialogFooter>
                                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                            <AlertDialogAction onClick={(e) => handleDeleteCategory(e, pm.value, 'payment')}>Excluir</AlertDialogAction>
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
                                    <Label htmlFor="expense-bank-account">Conta de Débito</Label>
                                    <Select value={selectedAccountId} onValueChange={setSelectedAccountId} required disabled={!companyId}>
                                        <SelectTrigger id="expense-bank-account">
                                            <SelectValue placeholder="Selecione a conta" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {bankAccounts.filter(acc => acc.companyId === companyId).map(account => (
                                                <SelectItem key={account.id} value={account.id}>{account.bankName} - Ag: {account.agency}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            
                            {paymentMethodValue === 'boleto' && (
                                <div className="grid md:grid-cols-3 gap-6 border-t pt-6">
                                    <div className="md:col-span-2 space-y-2">
                                        <Label htmlFor="boleto-code">Código de Barras do Boleto</Label>
                                        <Input id="boleto-code" placeholder="Digite ou cole a linha digitável" value={boletoCode} onChange={e => setBoletoCode(e.target.value)} />
                                    </div>
                                    <div className="flex items-end">
                                        <Button variant="outline" className="w-full" type="button">
                                            <UploadCloud className="mr-2 h-4 w-4" />
                                            Anexar Boleto (PDF)
                                        </Button>
                                    </div>
                                </div>
                            )}

                            <Separator />

                             <div className="flex items-center space-x-2 pt-2">
                                <Switch
                                    id="has-attachment-switch"
                                    checked={hasAttachment}
                                    onCheckedChange={setHasAttachment}
                                />
                                <Label htmlFor="has-attachment-switch">Anexar Nota ou Comprovante</Label>
                            </div>
                            {hasAttachment && (
                                <div className="max-w-sm">
                                    <Button variant="outline" className="w-full" type="button">
                                        <UploadCloud className="mr-2 h-4 w-4" />
                                        Anexar Arquivo
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="flex justify-end">
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar Lançamento
                            </Button>
                        </CardFooter>
                    </Card>
                    </form>
                </TabsContent>
                }
                {(tabPermissions?.['despesas-lancadas'] !== false) && 
                <TabsContent value="despesas-lancadas">
                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Filtrar Despesas</CardTitle>
                                <CardDescription>Busque por todas as despesas, sejam elas lançamentos manuais ou pagamentos de compras.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                                    <div className="space-y-2 lg:col-span-4">
                                        <Label htmlFor="search-description">Descrição</Label>
                                        <Input id="search-description" placeholder="Buscar por descrição..." value={searchDescription} onChange={(e) => setSearchDescription(e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="date-from">Período (De)</Label>
                                        <Popover open={isDateFromPopoverOpen} onOpenChange={setIsDateFromPopoverOpen}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    id="date-from"
                                                    variant={"outline"}
                                                    className={cn(
                                                        "w-full justify-start text-left font-normal",
                                                        !searchDateFrom && "text-muted-foreground"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {searchDateFrom ? format(searchDateFrom, "dd/MM/yyyy") : <span>Selecione a data</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar
                                                    mode="single"
                                                    selected={searchDateFrom}
                                                    onSelect={(day) => { setSearchDateFrom(day); setIsDateFromPopoverOpen(false); }}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="date-to">Período (Até)</Label>
                                        <Popover open={isDateToPopoverOpen} onOpenChange={setIsDateToPopoverOpen}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    id="date-to"
                                                    variant={"outline"}
                                                    className={cn(
                                                        "w-full justify-start text-left font-normal",
                                                        !searchDateTo && "text-muted-foreground"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {searchDateTo ? format(searchDateTo, "dd/MM/yyyy") : <span>Selecione a data</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar
                                                    mode="single"
                                                    selected={searchDateTo}
                                                    onSelect={(day) => { setSearchDateTo(day); setIsDateToPopoverOpen(false); }}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="filter-company">Empresa</Label>
                                        <Select value={searchCompanyId} onValueChange={setSearchCompanyId} disabled={isLoading}>
                                            <SelectTrigger id="filter-company">
                                                <SelectValue placeholder="Todas" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todas as Empresas</SelectItem>
                                                {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="filter-payment-method">Forma de Pagamento</Label>
                                        <Select value={searchPaymentMethod} onValueChange={setSearchPaymentMethod}>
                                            <SelectTrigger id="filter-payment-method">
                                                <SelectValue placeholder="Todas" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todas</SelectItem>
                                                {paymentMethods.map(pm => <SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="filter-category">Categoria</Label>
                                        <Select value={searchCategory} onValueChange={setSearchCategory}>
                                            <SelectTrigger id="filter-category">
                                                <SelectValue placeholder="Todas" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todas as Categorias</SelectItem>
                                                 {expenseCategories.map(cat => <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>)}
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
                                <CardDescription>
                                    Abaixo está a lista de despesas encontradas com base nos filtros aplicados.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {isSearching ? (
                                    <div className="flex justify-center items-center h-24">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : filteredExpenses.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Descrição</TableHead>
                                                <TableHead>Empresa</TableHead>
                                                <TableHead>Categoria</TableHead>
                                                <TableHead>Data</TableHead>
                                                <TableHead className="text-right">Valor</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredExpenses.map((expense) => (
                                                <TableRow key={expense.id}>
                                                    <TableCell className="font-medium">{expense.description}</TableCell>
                                                    <TableCell>{companies.find(c => c.id === expense.companyId)?.name || 'N/A'}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className={cn(getCategoryBadgeColor(expense.category))}>
                                                            {expenseCategories.find(c => c.value === expense.category)?.label || expense.category}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>{format(new Date(expense.expenseDate), 'dd/MM/yyyy')}</TableCell>
                                                    <TableCell className="text-right">R$ {expense.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum resultado encontrado. Tente refinar sua busca.</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
                }
            </Tabs>
        </div>
    );
}
