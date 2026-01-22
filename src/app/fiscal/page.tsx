
'use client';

import { useState, useEffect } from "react";
import { PageHeader, PageHeaderDescription, PageHeaderHeading } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, Search, Eye, Link as LinkIcon, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { db } from '@/firebase/config';
import { collection, query, where, getDocs, Timestamp, getDoc, doc } from 'firebase/firestore';
import Link from 'next/link';
import { useUser } from "@/firebase/auth/use-user";


// --- Tipos e Dados ---

interface Company {
    id: string;
    name: string;
}

interface Invoice {
    id: string;
    supplier: string;
    number: string;
    emissionDate: string;
    value: number;
    status: 'Vinculada' | 'Manifestada' | 'Avulsa';
    origin: string;
    originId: string;
    companyId: string;
    fileUrl?: string;
    fileName?: string;
}

interface InvoiceOut {
    id: string;
    client: string;
    number: string;
    emissionDate: string;
    value: number;
    status: 'Emitida' | 'Cancelada';
    origin: 'Receita';
    originId: string;
    companyId: string;
}

interface PaymentDocument {
    id: string;
    supplier: string;
    dueDate: string;
    value: number;
    status: 'Pendente' | 'Pago' | 'Atrasado';
    origin: string;
    originId: string;
    documentType: string;
    companyId: string;
    fileUrl?: string;
    fileName?: string;
}

export default function FiscalPage() {
    const { user } = useUser();
    const [dateFrom, setDateFrom] = useState<Date>();
    const [dateTo, setDateTo] = useState<Date>();
    
    // Original data
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [invoicesOut, setInvoicesOut] = useState<InvoiceOut[]>([]);
    const [paymentDocs, setPaymentDocs] = useState<PaymentDocument[]>([]);
    
    // Filtered data for display
    const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
    const [filteredInvoicesOut, setFilteredInvoicesOut] = useState<InvoiceOut[]>([]);
    const [filteredPaymentDocs, setFilteredPaymentDocs] = useState<PaymentDocument[]>([]);

    const [companies, setCompanies] = useState<Company[]>([]);
    const [selectedCompany, setSelectedCompany] = useState<string>('all');


    const [isSearching, setIsSearching] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const clientName = typeof window !== 'undefined' ? localStorage.getItem('clientName') : null;

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
                const permissions = roleData.permissions?.fiscal;
    
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
        if (!clientName) {
            setIsLoading(false);
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const companiesQuery = query(collection(db, `clients/${clientName}/companies`));
                
                const now = new Date();
                now.setHours(0, 0, 0, 0);

                // Fetch data from all sources
                const poQuery = getDocs(query(collection(db, "clients", clientName, "purchaseOrders")));
                const expensesQuery = getDocs(query(collection(db, "clients", clientName, "expenses")));
                const vetPaymentsQuery = getDocs(query(collection(db, "clients", clientName, "payments")));
                const revenuesQuery = getDocs(query(collection(db, "clients", clientName, "revenues")));
                const companiesSnapshot = await getDocs(companiesQuery);

                const [poSnapshot, expensesSnapshot, vetPaymentsSnapshot, revenuesSnapshot] = await Promise.all([poQuery, expensesQuery, vetPaymentsQuery, revenuesQuery]);
                
                const companiesData = companiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Company));
                setCompanies(companiesData);

                const allInvoices: Invoice[] = [];
                const allInvoicesOut: InvoiceOut[] = [];
                const allPaymentDocs: PaymentDocument[] = [];

                // Process Purchase Orders (Notas de Entrada, Documentos de Pagamento)
                poSnapshot.forEach(doc => {
                    const order = doc.data();
                    allInvoices.push({
                        id: doc.id,
                        supplier: order.supplierName,
                        number: Math.floor(10000 + Math.random() * 90000).toString(),
                        emissionDate: format(new Date(order.date), 'dd/MM/yyyy'),
                        value: order.total,
                        status: 'Vinculada',
                        origin: `Compra ${doc.id.substring(0, 6)}`,
                        originId: doc.id,
                        companyId: order.companyId,
                        fileUrl: order.attachments?.nf?.url,
                        fileName: order.attachments?.nf?.name,
                    });
                    
                    if (['Aguardando Pagamento', 'Concluído'].includes(order.status)) {
                         let status: PaymentDocument['status'];
                         const dueDate = new Date(order.deliveryDate);
                         if (order.status === 'Concluído') {
                             status = 'Pago';
                         } else if (dueDate < now) {
                             status = 'Atrasado';
                         } else {
                             status = 'Pendente';
                         }
                         
                         order.attachments?.boletos?.forEach((boleto: any, index: number) => {
                            if (boleto.url) {
                                allPaymentDocs.push({
                                    id: `po-${doc.id}-${index}`,
                                    supplier: order.supplierName,
                                    dueDate: boleto.dueDate ? format(new Date(boleto.dueDate), 'dd/MM/yyyy') : format(dueDate, 'dd/MM/yyyy'),
                                    value: order.total / (order.attachments?.boletos?.length || 1),
                                    status: status,
                                    origin: `Compra ${doc.id.substring(0, 6)}`,
                                    originId: doc.id,
                                    documentType: 'Boleto',
                                    companyId: order.companyId,
                                    fileUrl: boleto.url,
                                    fileName: boleto.name,
                                });
                            }
                         });
                    }
                });

                // Process Revenues (Notas de Saída)
                revenuesSnapshot.forEach(doc => {
                    const revenue = doc.data();
                    allInvoicesOut.push({
                        id: doc.id,
                        client: revenue.description || 'Cliente não identificado',
                        number: `NS-${Math.floor(10000 + Math.random() * 90000)}`,
                        emissionDate: format(new Date(revenue.date), 'dd/MM/yyyy'),
                        value: revenue.value,
                        status: 'Emitida',
                        origin: 'Receita',
                        originId: doc.id,
                        companyId: revenue.companyId,
                    });
                });

                // Process Expenses (Documentos de Pagamento)
                expensesSnapshot.forEach(doc => {
                    const expense = doc.data();
                    const dueDate = new Date(expense.expenseDate);
                    let status: PaymentDocument['status'] = expense.status === 'Pago' ? 'Pago' : 'Pendente';
                    if (status === 'Pendente' && dueDate < now) {
                        status = 'Atrasado';
                    }
                     allPaymentDocs.push({
                        id: `exp-${doc.id}`,
                        supplier: expense.description,
                        dueDate: format(dueDate, 'dd/MM/yyyy'),
                        value: expense.value,
                        status: status,
                        origin: `Despesa Avulsa`,
                        originId: doc.id,
                        documentType: expense.paymentMethod || 'Outro',
                        companyId: expense.companyId
                     });
                });
                
                // Process Veterinarian Payments (Documentos de Pagamento)
                vetPaymentsSnapshot.forEach(doc => {
                    const payment = doc.data();
                    const dueDate = new Date(payment.dueDate);
                     let status: PaymentDocument['status'] = payment.status === 'Pago' ? 'Pago' : 'Pendente';
                     if (status === 'Pendente' && dueDate < now) {
                         status = 'Atrasado';
                     }
                      allPaymentDocs.push({
                        id: `vet-${doc.id}`,
                        supplier: payment.veterinarianName,
                        dueDate: format(dueDate, 'dd/MM/yyyy'),
                        value: payment.value,
                        status: status,
                        origin: `Serviço Vet.`,
                        originId: doc.id,
                        documentType: 'Pagamento',
                        companyId: payment.companyId || ''
                     });
                });

                setInvoices(allInvoices);
                setFilteredInvoices(allInvoices);
                setInvoicesOut(allInvoicesOut);
                setFilteredInvoicesOut(allInvoicesOut);
                setPaymentDocs(allPaymentDocs);
                setFilteredPaymentDocs(allPaymentDocs);

            } catch (error) {
                console.error("Erro ao buscar dados fiscais:", error);
                toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os dados.' });
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [clientName, toast]);

    const handleSearch = () => {
        setIsSearching(true);
        
        let tempInvoices = [...invoices];
        let tempInvoicesOut = [...invoicesOut];
        let tempPaymentDocs = [...paymentDocs];

        if (selectedCompany !== 'all') {
            tempInvoices = tempInvoices.filter(inv => inv.companyId === selectedCompany);
            tempInvoicesOut = tempInvoicesOut.filter(inv => inv.companyId === selectedCompany);
            tempPaymentDocs = tempPaymentDocs.filter(doc => doc.companyId === selectedCompany);
        }

        if (dateFrom) {
            tempInvoices = tempInvoices.filter(inv => new Date(inv.emissionDate.split('/').reverse().join('-')) >= dateFrom);
            tempInvoicesOut = tempInvoicesOut.filter(inv => new Date(inv.emissionDate.split('/').reverse().join('-')) >= dateFrom);
            tempPaymentDocs = tempPaymentDocs.filter(doc => new Date(doc.dueDate.split('/').reverse().join('-')) >= dateFrom);
        }

        if (dateTo) {
            tempInvoices = tempInvoices.filter(inv => new Date(inv.emissionDate.split('/').reverse().join('-')) <= dateTo);
            tempInvoicesOut = tempInvoicesOut.filter(inv => new Date(inv.emissionDate.split('/').reverse().join('-')) <= dateTo);
            tempPaymentDocs = tempPaymentDocs.filter(doc => new Date(doc.dueDate.split('/').reverse().join('-')) <= dateTo);
        }

        setFilteredInvoices(tempInvoices);
        setFilteredInvoicesOut(tempInvoicesOut);
        setFilteredPaymentDocs(tempPaymentDocs);

        setTimeout(() => setIsSearching(false), 300);
    }
    
    const getOriginLink = (doc: Invoice | PaymentDocument | InvoiceOut) => {
        switch(doc.origin.split(' ')[0]){
            case 'Compra':
                return `/compras?tab=acompanhamento&id=${doc.originId}`;
            case 'Despesa':
                return `/despesas?tab=despesas-lancadas&id=${doc.originId}`;
            case 'Serviço':
                return `/pagamentos?id=${doc.originId}`;
            case 'Receita':
                return `/receitas?tab=receitas-lancadas&id=${doc.originId}`;
            default:
                return '#';
        }
    }

    const renderInvoicesTable = () => {
        if (isLoading) {
            return (
                <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                    </TableCell>
                </TableRow>
            );
        }
        if (filteredInvoices.length === 0) {
            return (
                <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                        Nenhuma nota fiscal encontrada para os filtros selecionados.
                    </TableCell>
                </TableRow>
            );
        }
        return filteredInvoices.map((invoice) => (
            <TableRow key={invoice.id}>
                <TableCell className="font-medium">{invoice.supplier}</TableCell>
                <TableCell>{invoice.number}</TableCell>
                <TableCell>{invoice.emissionDate}</TableCell>
                <TableCell>{invoice.origin}</TableCell>
                <TableCell>
                    <Badge variant={invoice.status === 'Vinculada' ? 'default' : 'secondary'} className={invoice.status === 'Vinculada' ? 'bg-accent text-accent-foreground' : ''}>
                        {invoice.status}
                    </Badge>
                </TableCell>
                <TableCell className="text-right">R$ {invoice.value.toFixed(2)}</TableCell>
                <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                        <TooltipProvider>
                            {invoice.fileUrl && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                                            <a href={invoice.fileUrl} target="_blank" rel="noopener noreferrer">
                                                <Download className="h-4 w-4" />
                                            </a>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Baixar {invoice.fileName || 'documento'}</p>
                                    </TooltipContent>
                                </Tooltip>
                            )}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                     <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                                        <Link href={getOriginLink(invoice)}>
                                            <LinkIcon className="h-4 w-4" />
                                        </Link>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Ver lançamento de origem</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </TableCell>
            </TableRow>
        ));
    };

    const renderInvoicesOutTable = () => {
        if (isLoading) {
            return (
                <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                    </TableCell>
                </TableRow>
            );
        }
        if (filteredInvoicesOut.length === 0) {
            return (
                <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                        Nenhuma nota fiscal de saída encontrada.
                    </TableCell>
                </TableRow>
            );
        }
        return filteredInvoicesOut.map((invoice) => (
             <TableRow key={invoice.id}>
                <TableCell className="font-medium">{invoice.client}</TableCell>
                <TableCell>{invoice.number}</TableCell>
                <TableCell>{invoice.emissionDate}</TableCell>
                <TableCell className="text-right">R$ {invoice.value.toFixed(2)}</TableCell>
                <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toast({ title: "Funcionalidade em desenvolvimento" })}>
                                        <Download className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Baixar DANFE</p>
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                     <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                                        <Link href={getOriginLink(invoice)}>
                                            <LinkIcon className="h-4 w-4" />
                                        </Link>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Ver receita de origem</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </TableCell>
            </TableRow>
        ));
    };

    const renderPaymentsTable = () => {
         if (isLoading) {
            return (
                <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                    </TableCell>
                </TableRow>
            );
        }
        if (filteredPaymentDocs.length === 0) {
            return (
                <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                        Nenhum documento de pagamento encontrado para os filtros selecionados.
                    </TableCell>
                </TableRow>
            );
        }
        return filteredPaymentDocs.map(doc => (
            <TableRow key={doc.id}>
                <TableCell>
                    <div className="font-medium">{doc.supplier}</div>
                    <div className="text-xs text-muted-foreground">{doc.origin}</div>
                </TableCell>
                <TableCell>{doc.dueDate}</TableCell>
                <TableCell>
                    <Badge variant="outline">{doc.documentType}</Badge>
                </TableCell>
                <TableCell>
                    <Badge variant={doc.status === 'Pago' ? 'default' : doc.status === 'Atrasado' ? 'destructive' : 'secondary'} className={doc.status === 'Pago' ? 'bg-accent text-accent-foreground' : ''}>
                        {doc.status}
                    </Badge>
                </TableCell>
                <TableCell className="text-right">R$ {doc.value.toFixed(2)}</TableCell>
                <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                        <TooltipProvider>
                            {doc.fileUrl && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                                            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                                                <Download className="h-4 w-4" />
                                            </a>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Baixar {doc.fileName || 'documento'}</p>
                                    </TooltipContent>
                                </Tooltip>
                            )}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                                        <Link href={getOriginLink(doc)}>
                                            <LinkIcon className="h-4 w-4" />
                                        </Link>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Ver lançamento</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </TableCell>
            </TableRow>
        ));
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
                <PageHeaderHeading>Gestão Fiscal e Documentos</PageHeaderHeading>
                <PageHeaderDescription>
                    Gerencie, consulte e baixe as notas fiscais e documentos de pagamento.
                </PageHeaderDescription>
            </PageHeader>
            
            <Tabs defaultValue="entrada" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    {(tabPermissions?.['entrada'] !== false) && <TabsTrigger value="entrada">Notas de Entrada</TabsTrigger> }
                    {(tabPermissions?.['saida'] !== false) && <TabsTrigger value="saida">Notas de Saída</TabsTrigger> }
                    {(tabPermissions?.['pagamentos'] !== false) && <TabsTrigger value="pagamentos">Documentos de Pagamento</TabsTrigger> }
                </TabsList>
                
                {(tabPermissions?.['entrada'] !== false) && 
                <TabsContent value="entrada">
                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Filtros de Notas de Entrada</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                                    <div className="space-y-2">
                                        <Label htmlFor="date-from-entrada">Período (De)</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button id="date-from-entrada" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {dateFrom ? format(dateFrom, "dd/MM/yyyy") : <span>Selecione</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus /></PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="date-to-entrada">Período (Até)</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button id="date-to-entrada" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {dateTo ? format(dateTo, "dd/MM/yyyy") : <span>Selecione</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus /></PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="filter-company-entrada">Empresa</Label>
                                        <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                                            <SelectTrigger id="filter-company-entrada"><SelectValue placeholder="Todas" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todas as Empresas</SelectItem>
                                                {companies.map(company => (
                                                    <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button onClick={handleSearch} disabled={isSearching}>
                                        {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                                        Buscar
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Notas Fiscais de Entrada</CardTitle>
                                    <CardDescription>Consulte as notas emitidas contra o CNPJ da sua empresa.</CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Fornecedor</TableHead>
                                            <TableHead>Número</TableHead>
                                            <TableHead>Emissão</TableHead>
                                            <TableHead>Origem</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Valor</TableHead>
                                            <TableHead className="w-[80px] text-center">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {renderInvoicesTable()}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
                }
                
                {(tabPermissions?.['saida'] !== false) && 
                <TabsContent value="saida">
                    <Card>
                        <CardHeader>
                            <CardTitle>Notas Fiscais de Saída</CardTitle>
                            <CardDescription>Consulte as notas que sua empresa emitiu.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead>Número</TableHead>
                                        <TableHead>Emissão</TableHead>
                                        <TableHead className="text-right">Valor</TableHead>
                                        <TableHead className="text-center">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {renderInvoicesOutTable()}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
                }

                {(tabPermissions?.['pagamentos'] !== false) && 
                <TabsContent value="pagamentos">
                    <Card>
                        <CardHeader>
                            <CardTitle>Documentos de Pagamento</CardTitle>
                            <CardDescription>Consulte todos os boletos e comprovantes anexados no sistema.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fornecedor/Origem</TableHead>
                                        <TableHead>Vencimento</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Valor</TableHead>
                                        <TableHead className="w-[80px] text-center">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {renderPaymentsTable()}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
                }
            </Tabs>
        </div>
    );
}
