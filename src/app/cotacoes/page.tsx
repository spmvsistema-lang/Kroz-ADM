

'use client';

import { PageHeader, PageHeaderDescription, PageHeaderHeading } from '@/components/app/page-header';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2, Search } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/firebase/config';
import { collection, addDoc, getDocs, query, where, QueryConstraint, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useUser } from '@/firebase/auth/use-user';
import { z } from 'zod';
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


const quoteSchema = z.object({
    id: z.string(),
    clientId: z.string(),
    supplierId: z.string().optional().nullable(),
    supplierName: z.string(),
    product: z.string(),
    date: z.string(),
    validity: z.number(),
    quantity: z.number(),
    unitPrice: z.number(),
    quotedBy: z.string(), // Should be the user's name
    logDate: z.string(),
});


interface Quote extends z.infer<typeof quoteSchema> {}

export default function CotacoesPage() {
    const { toast } = useToast();
    const { user } = useUser();
    const clientName = typeof window !== 'undefined' ? localStorage.getItem('clientName') : null;

    // States for new quote form
    const [date, setDate] = useState<Date>();
    const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
    const [supplierType, setSupplierType] = useState('cadastrado');
    const [selectedSupplier, setSelectedSupplier] = useState('');
    const [avulsoSupplier, setAvulsoSupplier] = useState('');
    const [validity, setValidity] = useState<number | ''>('');
    const [product, setProduct] = useState('');
    const [quantity, setQuantity] = useState<number | ''>(1);
    const [unitPrice, setUnitPrice] = useState<number | ''>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // States for search
    const [searchQuery, setSearchQuery] = useState('');
    const [searchDateFrom, setSearchDateFrom] = useState<Date | undefined>();
    const [isSearchDateFromPopoverOpen, setIsSearchDateFromPopoverOpen] = useState(false);
    const [searchDateTo, setSearchDateTo] = useState<Date | undefined>();
    const [isSearchDateToPopoverOpen, setIsSearchDateToPopoverOpen] = useState(false);
    const [searchSupplierId, setSearchSupplierId] = useState<string>('');
    const [filteredQuotes, setFilteredQuotes] = useState<Quote[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    
    // States for editing
    const [quoteToEdit, setQuoteToEdit] = useState<Quote | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [editSupplierType, setEditSupplierType] = useState('cadastrado');
    const [isEditDatePopoverOpen, setIsEditDatePopoverOpen] = useState(false);
    
    // Mock data, to be replaced by API calls
    const [suppliers, setSuppliers] = useState<{id: string, name: string}[]>([]);
    const [isLoading, setIsLoading] = useState(true);

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
    
                const rolesQuery = query(collection(db, "clients", clientName, "roles"), where('name', '==', userRole));
                const rolesSnapshot = await getDocs(rolesQuery);
                
                if (rolesSnapshot.empty) {
                    setTabPermissions({});
                    setIsLoadingPermissions(false);
                    return;
                }
                
                const roleData = rolesSnapshot.docs[0].data();
                const permissions = roleData.permissions?.cotacoes;
    
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

    useEffect(() => {
      const fetchSuppliers = async () => {
        if (!clientName) {
            setIsLoading(false);
            return;
        };
        setIsLoading(true);
        try {
            const q = query(collection(db, "clients", clientName, "suppliers"), where("status", "==", "Ativo"));
            const querySnapshot = await getDocs(q);
            setSuppliers(querySnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
        } catch (error) {
             if ((error as any).code) {
                 toast({ variant: 'destructive', title: 'Erro de Conexão', description: 'Não foi possível carregar os fornecedores.' });
            }
        } finally {
            setIsLoading(false);
        }
      }
      if(clientName) fetchSuppliers();
      else setIsLoading(false);
    }, [clientName, toast]);


    const handleSaveQuote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!clientName || !date || !product || !quantity || !unitPrice) {
             toast({ variant: "destructive", title: "Erro", description: "Por favor, preencha todos os campos obrigatórios." });
             return;
        }

        const supplierName = supplierType === 'cadastrado' ? suppliers.find(s => s.id === selectedSupplier)?.name : avulsoSupplier;
        if (!supplierName) {
            toast({ variant: "destructive", title: "Erro", description: "Fornecedor inválido." });
            return;
        }
        
        setIsSubmitting(true);
        try {
            await addDoc(collection(db, "clients", clientName, "quotes"), {
                clientId: clientName,
                supplierId: supplierType === 'cadastrado' ? selectedSupplier : null,
                supplierName: supplierName,
                product: product.toLowerCase(), // Store product in lowercase for case-insensitive search
                date: format(date, 'yyyy-MM-dd'),
                validity: Number(validity) || 0,
                quantity: Number(quantity),
                unitPrice: Number(unitPrice),
                quotedBy: user?.displayName || user?.email || "Usuário Desconhecido",
                logDate: new Date().toISOString(),
            });

            toast({ title: "Sucesso!", description: "Cotação salva com sucesso.", className: "bg-accent text-accent-foreground" });
            // Reset form
            setDate(undefined);
            setSelectedSupplier('');
            setAvulsoSupplier('');
            setValidity('');
            setProduct('');
            setQuantity(1);
            setUnitPrice('');

        } catch (error) {
            console.error("Error saving quote:", error)
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível salvar a cotação." });
        } finally {
            setIsSubmitting(false);
        }
    }


    const handleSearch = async () => {
        if (!clientName) {
            setFilteredQuotes([]);
            return;
        }
        setIsSearching(true);
        try {
            const constraints: QueryConstraint[] = [where("clientId", "==", clientName)];

            if (searchQuery.trim() !== '') {
                constraints.push(where("product", ">=", searchQuery.toLowerCase()));
                constraints.push(where("product", "<=", searchQuery.toLowerCase() + '\uf8ff'));
            }
            if (searchSupplierId) {
                constraints.push(where("supplierId", "==", searchSupplierId));
            }
            if (searchDateFrom) {
                constraints.push(where("date", ">=", format(searchDateFrom, 'yyyy-MM-dd')));
            }
            if (searchDateTo) {
                constraints.push(where("date", "<=", format(searchDateTo, 'yyyy-MM-dd')));
            }

            const q = query(collection(db, "clients", clientName, "quotes"), ...constraints);
            
            const querySnapshot = await getDocs(q);
            const results = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quote));
            
            const lenientQuoteSchema = quoteSchema.extend({
                logDate: z.any()
            });
            const parsedResults = z.array(lenientQuoteSchema).parse(results);

            const formattedResults = parsedResults.map(q => ({
                ...q,
                date: format(new Date(q.date), 'dd/MM/yyyy'),
                logDate: format(q.logDate.toDate ? q.logDate.toDate() : new Date(q.logDate), 'dd/MM/yyyy')
            }))

            setFilteredQuotes(formattedResults as unknown as Quote[]);

        } catch (error) {
             if (error instanceof z.ZodError) {
                console.error("Zod validation error:", error.issues)
                toast({ variant: "destructive", title: "Erro de Dados", description: "Os dados de cotações recebidos são inválidos." });
            } else {
                console.error("Search error:", error)
                toast({ variant: "destructive", title: "Erro de Busca", description: "Não foi possível realizar a busca." });
            }
        } finally {
            setIsSearching(false);
        }
    };
    
    const handleOpenEditModal = (quote: Quote) => {
        setQuoteToEdit(quote);
        setEditSupplierType(quote.supplierId ? 'cadastrado' : 'avulso');
        setIsEditModalOpen(true);
    };

    const handleQuoteEditChange = (field: keyof Quote, value: string | number) => {
        if (quoteToEdit) {
            setQuoteToEdit(prev => ({ ...prev!, [field]: value }));
        }
    };

    const handleUpdateQuote = async () => {
        if (!quoteToEdit || !clientName) return;

        if (!quoteToEdit.product || !quoteToEdit.quantity || !quoteToEdit.unitPrice || !quoteToEdit.date) {
            toast({ variant: "destructive", title: "Erro", description: "Por favor, preencha todos os campos obrigatórios." });
            return;
        }

        setIsUpdating(true);
        try {
            const quoteRef = doc(db, "clients", clientName, "quotes", quoteToEdit.id);
            
            const [day, month, year] = quoteToEdit.date.split('/');
            const dateToSave = `${year}-${month}-${day}`;
            
            const dataToUpdate = {
                supplierId: editSupplierType === 'cadastrado' ? quoteToEdit.supplierId : null,
                supplierName: editSupplierType === 'cadastrado' ? (suppliers.find(s => s.id === quoteToEdit.supplierId)?.name || quoteToEdit.supplierName) : quoteToEdit.supplierName,
                product: quoteToEdit.product.toLowerCase(),
                date: dateToSave,
                validity: Number(quoteToEdit.validity) || 0,
                quantity: Number(quoteToEdit.quantity),
                unitPrice: Number(quoteToEdit.unitPrice),
            };

            await updateDoc(quoteRef, dataToUpdate);

            toast({ title: "Sucesso!", description: "Cotação atualizada com sucesso.", className: "bg-accent text-accent-foreground" });
            
            setFilteredQuotes(prev => prev.map(q => q.id === quoteToEdit.id ? { ...quoteToEdit, ...dataToUpdate, date: quoteToEdit.date } : q));

            setIsEditModalOpen(false);
            setQuoteToEdit(null);

        } catch (error) {
            console.error("Error updating quote:", error);
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível atualizar a cotação." });
        } finally {
            setIsUpdating(false);
        }
    };

    const bestPrice = useMemo(() => {
        if (filteredQuotes.length === 0) return null;
        return Math.min(...filteredQuotes.map(q => q.unitPrice));
    }, [filteredQuotes]);
    
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
                <PageHeaderHeading>Cotações</PageHeaderHeading>
                <PageHeaderDescription>
                    Gerencie e acompanhe cotações de preços com fornecedores.
                </PageHeaderDescription>
            </PageHeader>
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
            <Tabs defaultValue="lancamento" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    {(tabPermissions?.['lancamento'] !== false) && <TabsTrigger value="lancamento">Lançamento Manual</TabsTrigger> }
                    {(tabPermissions?.['historico'] !== false) && <TabsTrigger value="historico">Histórico e Comparativo</TabsTrigger> }
                </TabsList>
                
                {(tabPermissions?.['lancamento'] !== false) && 
                <TabsContent value="lancamento">
                    <form onSubmit={handleSaveQuote}>
                        <Card>
                            <CardHeader>
                                <CardTitle>Lançamento de Cotação</CardTitle>
                                <CardDescription>Registre manually os preços cotados com seus fornecedores.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2">
                                    <Label>Tipo de Fornecedor</Label>
                                    <RadioGroup value={supplierType} onValueChange={setSupplierType} className="flex items-center gap-4">
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="cadastrado" id="r-cadastrado" />
                                            <Label htmlFor="r-cadastrado">Fornecedor Cadastrado</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="avulso" id="r-avulso" />
                                            <Label htmlFor="r-avulso">Fornecedor Avulso</Label>
                                        </div>
                                    </RadioGroup>
                                </div>

                                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <div className="lg:col-span-2 space-y-2">
                                        <Label htmlFor="supplier">{supplierType === 'cadastrado' ? 'Fornecedor' : 'Nome do Fornecedor Avulso'}</Label>
                                        {supplierType === 'cadastrado' ? (
                                            <Select value={selectedSupplier} onValueChange={setSelectedSupplier} disabled={isLoading}>
                                                <SelectTrigger id="supplier">
                                                    <SelectValue placeholder="Selecione o fornecedor" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Input id="supplier" placeholder="Digite o nome do fornecedor" value={avulsoSupplier} onChange={e => setAvulsoSupplier(e.target.value)} />
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="quote-date">Data da Cotação</Label>
                                        <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                                                    onClick={() => setIsDatePopoverOpen(true)}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {date ? format(date, "dd/MM/yyyy") : <span>Selecione a data</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar mode="single" selected={date} onSelect={(day) => { setDate(day); setIsDatePopoverOpen(false); }} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="validity">Validade (dias)</Label>
                                        <Input id="validity" type="number" placeholder="Ex: 7" value={validity} onChange={e => setValidity(e.target.value === '' ? '' : Number(e.target.value))} />
                                    </div>
                                    <div className="lg:col-span-2 space-y-2">
                                        <Label htmlFor="product">Produto / Serviço</Label>
                                        <Input id="product" placeholder="Ex: Teclado sem fio ABNT2" value={product} onChange={e => setProduct(e.target.value)} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="quantity">Quantidade</Label>
                                        <Input id="quantity" type="number" placeholder="10" value={quantity} onChange={e => setQuantity(e.target.value === '' ? '' : Number(e.target.value))} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="unit-price">Valor Unitário (R$)</Label>
                                        <Input id="unit-price" type="number" placeholder="120,50" value={unitPrice} onChange={e => setUnitPrice(e.target.value === '' ? '' : Number(e.target.value))} required />
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="justify-end">
                                <Button type="submit" disabled={isSubmitting}>
                                     {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Salvar Cotação
                                </Button>
                            </CardFooter>
                        </Card>
                    </form>
                </TabsContent>
                }

                {(tabPermissions?.['historico'] !== false) && 
                 <TabsContent value="historico">
                    <Card>
                        <CardHeader>
                            <CardTitle>Histórico e Comparativo de Cotações</CardTitle>
                            <CardDescription>Pesquise por um produto ou serviço para ver o histórico de preços e comparar ofertas.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                                <div className="lg:col-span-2 space-y-2">
                                    <Label htmlFor="search-product">Produto ou Serviço</Label>
                                    <Input
                                        id="search-product"
                                        placeholder="Digite o nome do item..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    />
                                </div>
                                 <div className="space-y-2">
                                    <Label htmlFor="search-supplier">Fornecedor</Label>
                                    <Select value={searchSupplierId} onValueChange={setSearchSupplierId} disabled={isLoading}>
                                        <SelectTrigger id="search-supplier">
                                            <SelectValue placeholder="Todos" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button onClick={handleSearch} disabled={isSearching} className="w-full lg:w-auto">
                                    {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                                    Buscar
                                </Button>
                                <div className="space-y-2">
                                    <Label htmlFor="date-from">Período (De)</Label>
                                    <Popover open={isSearchDateFromPopoverOpen} onOpenChange={setIsSearchDateFromPopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                id="date-from"
                                                variant={"outline"}
                                                className={cn("w-full justify-start text-left font-normal", !searchDateFrom && "text-muted-foreground")}
                                                onClick={() => setIsSearchDateFromPopoverOpen(true)}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {searchDateFrom ? format(searchDateFrom, "dd/MM/yyyy") : <span>Selecione</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar mode="single" selected={searchDateFrom} onSelect={(day) => { setSearchDateFrom(day); setIsSearchDateFromPopoverOpen(false); }} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="date-to">Período (Até)</Label>
                                    <Popover open={isSearchDateToPopoverOpen} onOpenChange={setIsSearchDateToPopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                id="date-to"
                                                variant={"outline"}
                                                className={cn("w-full justify-start text-left font-normal", !searchDateTo && "text-muted-foreground")}
                                                onClick={() => setIsSearchDateToPopoverOpen(true)}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {searchDateTo ? format(searchDateTo, "dd/MM/yyyy") : <span>Selecione</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar mode="single" selected={searchDateTo} onSelect={(day) => { setSearchDateTo(day); setIsSearchDateToPopoverOpen(false); }} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                            
                             {isSearching ? (
                                <div className="flex justify-center items-center h-24">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : filteredQuotes.length > 0 ? (
                                <div className="border-t pt-6">
                                    <h3 className="text-lg font-medium text-primary mb-4">Resultados da Busca</h3>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Produto/Serviço</TableHead>
                                                <TableHead>Fornecedor</TableHead>
                                                <TableHead>Data da Cotação</TableHead>
                                                <TableHead>Cotado por</TableHead>
                                                <TableHead className="text-right">Preço Unitário</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredQuotes.map((quote) => (
                                                 <DialogTrigger asChild key={quote.id}>
                                                    <TableRow 
                                                        className={cn("cursor-pointer", quote.unitPrice === bestPrice ? 'bg-accent/50' : '')}
                                                        onClick={() => handleOpenEditModal(quote)}
                                                    >
                                                        <TableCell className="font-medium capitalize">{quote.product}</TableCell>
                                                        <TableCell>{quote.supplierName}</TableCell>
                                                        <TableCell>{quote.date}</TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-col">
                                                                <span>{quote.quotedBy}</span>
                                                                <span className="text-xs text-muted-foreground">{quote.logDate}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className={cn("text-right font-semibold", quote.unitPrice === bestPrice && 'text-green-600')}>
                                                            R$ {quote.unitPrice.toFixed(2)}
                                                        </TableCell>
                                                    </TableRow>
                                                </DialogTrigger>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                               (searchQuery || searchSupplierId || searchDateFrom || searchDateTo) && <p className="text-center text-sm text-muted-foreground pt-4">Nenhum resultado encontrado para sua busca.</p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
                }
            </Tabs>
             {quoteToEdit && (
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Editar Cotação</DialogTitle>
                        <DialogDescription>
                            Altere os detalhes da cotação para o produto "{quoteToEdit.product}".
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-6">
                         <div className="space-y-2">
                            <Label>Tipo de Fornecedor</Label>
                            <RadioGroup value={editSupplierType} onValueChange={setEditSupplierType} className="flex items-center gap-4">
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="cadastrado" id="r-edit-cadastrado" />
                                    <Label htmlFor="r-edit-cadastrado">Fornecedor Cadastrado</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="avulso" id="r-edit-avulso" />
                                    <Label htmlFor="r-edit-avulso">Fornecedor Avulso</Label>
                                </div>
                            </RadioGroup>
                        </div>
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="lg:col-span-2 space-y-2">
                                <Label htmlFor="edit-supplier">{editSupplierType === 'cadastrado' ? 'Fornecedor' : 'Nome do Fornecedor Avulso'}</Label>
                                {editSupplierType === 'cadastrado' ? (
                                    <Select value={quoteToEdit.supplierId || ''} onValueChange={(value) => handleQuoteEditChange('supplierId', value)} disabled={isLoading}>
                                        <SelectTrigger id="edit-supplier"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                        <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                ) : (
                                    <Input id="edit-supplier" value={quoteToEdit.supplierName || ''} onChange={e => handleQuoteEditChange('supplierName', e.target.value)} />
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-quote-date">Data da Cotação</Label>
                                 <Popover open={isEditDatePopoverOpen} onOpenChange={setIsEditDatePopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !quoteToEdit.date && "text-muted-foreground")}>
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {quoteToEdit.date ? quoteToEdit.date : <span>Selecione</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={new Date(quoteToEdit.date.split('/').reverse().join('-'))}
                                            onSelect={(day) => {
                                                if (day) handleQuoteEditChange('date', format(day, 'dd/MM/yyyy'));
                                                setIsEditDatePopoverOpen(false);
                                            }}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="edit-validity">Validade (dias)</Label>
                                <Input id="edit-validity" type="number" value={quoteToEdit.validity} onChange={e => handleQuoteEditChange('validity', Number(e.target.value))} />
                            </div>
                             <div className="lg:col-span-2 space-y-2">
                                <Label htmlFor="edit-product">Produto / Serviço</Label>
                                <Input id="edit-product" value={quoteToEdit.product} onChange={e => handleQuoteEditChange('product', e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-quantity">Quantidade</Label>
                                <Input id="edit-quantity" type="number" value={quoteToEdit.quantity} onChange={e => handleQuoteEditChange('quantity', Number(e.target.value))} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-unit-price">Valor Unitário (R$)</Label>
                                <Input id="edit-unit-price" type="number" value={quoteToEdit.unitPrice} onChange={e => handleQuoteEditChange('unitPrice', Number(e.target.value))} required />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline">Cancelar</Button>
                        </DialogClose>
                        <Button type="button" onClick={handleUpdateQuote} disabled={isUpdating}>
                            {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Salvar Alterações
                        </Button>
                    </DialogFooter>
                </DialogContent>
            )}
            </Dialog>
        </div>
    );
}
