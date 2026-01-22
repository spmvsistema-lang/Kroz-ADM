

'use client';

import { PageHeader, PageHeaderDescription, PageHeaderHeading } from '@/components/app/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, PlusCircle, UploadCloud, AlertCircle, CheckCircle2, AlertTriangle, Send, FileCheck2, Clock, FileText, Search, User, BarChart2, Loader2, PieChart as PieChartIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useState, useEffect, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { db } from '@/firebase/config';
import { collection, query, where, getDocs, Timestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import { useUser } from '@/firebase/auth/use-user';
import { ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { CartesianGrid, Line, LineChart, Pie, PieChart, Sector, XAxis, YAxis, BarChart, Bar, Cell } from "recharts";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";


// Tipos replicados de 'compras' para simulação
interface ActionInfo {
    done: boolean;
    user?: string;
    date?: string;
}

interface DocumentAction {
    sent: ActionInfo;
    approved: ActionInfo;
}

interface Revenue {
    value: number;
    date: string;
    companyId?: string;
}

interface PurchaseOrder {
    id: string;
    requester: string;
    supplierName: string;
    date: string;
    total: number;
    status: 'Aguardando Documentos' | 'Aguardando Aprovação' | 'Entrega Atrasada' | 'Aguardando Pagamento' | 'Concluído' | 'Reprovado';
    items: { description: string; quantity: number; value: number }[];
    deliveryDate: string;
    actions: {
        nf: DocumentAction;
        boleto: DocumentAction;
        entrega: ActionInfo;
    };
    createdAt: Timestamp;
    clientId: string;
    companyId: string;
    costCenterId?: string;
    paymentMethod: string;
    purchaseType: string;
    onlineStoreName?: string;
    onlineStoreCategory?: string;
    attachments?: {
        nf?: { url: string; name: string };
        boletos?: { url: string; name: string }[];
    };
    rejectionReason?: string;
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#AF19FF"];


export default function FinanceiroPage() {
    const { user } = useUser();
    const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [revenues, setRevenues] = useState<Revenue[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const hasDelayedOrders = purchaseOrders.some(order => order.status === 'Entrega Atrasada');
    const [forecastDateFrom, setForecastDateFrom] = useState<Date>();
    const [forecastDateTo, setForecastDateTo] = useState<Date>();
    const [totalForecast, setTotalForecast] = useState<number | null>(null);
    const { toast } = useToast();
    const clientName = typeof window !== 'undefined' ? localStorage.getItem('clientName') : null;
    const [activeIndex, setActiveIndex] = useState(0);

    const [userRole, setUserRole] = useState<string | null>(null);
    const [isLoadingRole, setIsLoadingRole] = useState(true);

    const [rejectionReason, setRejectionReason] = useState('');


    const fetchFinancialData = async () => {
        if (!clientName) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const revenuesQuery = query(collection(db, "clients", clientName, "revenues"));
            const purchasesQuery = query(collection(db, "clients", clientName, "purchaseOrders"));

            const [revenuesSnapshot, purchasesSnapshot] = await Promise.all([
                getDocs(revenuesQuery),
                getDocs(purchasesQuery)
            ]);

            const revenuesData = revenuesSnapshot.docs.map(doc => doc.data() as Revenue);
            setRevenues(revenuesData);

            const ordersData = purchasesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseOrder));
            setPurchaseOrders(ordersData);

        } catch (error) {
            console.error("Erro ao buscar dados financeiros:", error);
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os dados financeiros.' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchFinancialData();
    }, [clientName, toast]);

    useEffect(() => {
        const fetchRole = async () => {
            if (!user || !clientName) {
                setIsLoadingRole(false);
                return;
            }
            setIsLoadingRole(true);
            try {
                const userDocRef = doc(db, 'clients', clientName, 'users', user.uid);
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists()) {
                    setUserRole(userDoc.data().role);
                } else {
                    setUserRole(null);
                }
            } catch (e) {
                console.error("Error fetching user role", e);
                setUserRole(null);
            } finally {
                setIsLoadingRole(false);
            }
        };

        fetchRole();
    }, [user, clientName]);

    const revenueChartData = useMemo(() => {
        const monthlyRevenues: { [key: string]: number } = {};
        revenues.forEach(rev => {
            const month = format(parseISO(rev.date), 'MMM/yy', { locale: ptBR });
            if (!monthlyRevenues[month]) {
                monthlyRevenues[month] = 0;
            }
            monthlyRevenues[month] += rev.value;
        });

        const data = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const monthKey = format(d, 'MMM/yy', { locale: ptBR });
            data.push({
                month: monthKey,
                revenue: monthlyRevenues[monthKey] || 0
            });
        }
        return data;
    }, [revenues]);

    const expensesByCategoryData = useMemo(() => {
        const categoryExpenses: { [key: string]: number } = {};
        purchaseOrders.forEach(p => {
            const category = p.onlineStoreCategory || 'Outros';
            if (!categoryExpenses[category]) {
                categoryExpenses[category] = 0;
            }
            categoryExpenses[category] += p.total;
        });
        return Object.entries(categoryExpenses).map(([name, value]) => ({ name, value }));
    }, [purchaseOrders]);

    const cashFlowByCostCenterData = useMemo(() => {
        const flow: { [key: string]: { entradas: number, saidas: number } } = {};
        
        revenues.forEach(rev => {
            const center = rev.companyId || 'N/A';
            if (!flow[center]) flow[center] = { entradas: 0, saidas: 0 };
            flow[center].entradas += rev.value;
        });

        purchaseOrders.forEach(p => {
            const center = p.companyId || 'N/A';
             if (!flow[center]) flow[center] = { entradas: 0, saidas: 0 };
            flow[center].saidas += p.total;
        });

        return Object.entries(flow).map(([name, values]) => ({
            name: name,
            ...values
        }));
    }, [revenues, purchaseOrders]);

    const handleSearchForecast = () => {
        if (forecastDateFrom && forecastDateTo) {
            const total = purchaseOrders
                .filter(p => {
                    const dueDate = new Date(p.deliveryDate); // Usando deliveryDate como dueDate
                    return p.status === 'Aguardando Pagamento' && dueDate >= forecastDateFrom && dueDate <= forecastDateTo;
                })
                .reduce((acc, p) => acc + p.total, 0);
            setTotalForecast(total);
        } else {
            toast({
                variant: 'destructive',
                title: 'Período inválido',
                description: 'Por favor, selecione as datas de início e fim para a previsão.',
            });
            setTotalForecast(null);
        }
    };

    const handleApproveDocuments = async () => {
        if (!selectedOrder || !clientName || !user) return;
        setIsSubmitting(true);
        try {
            const orderRef = doc(db, "clients", clientName, "purchaseOrders", selectedOrder.id);
            const now = format(new Date(), 'dd/MM/yyyy HH:mm');
            const currentUser = user?.displayName || user?.email || 'N/A';
            const updatedActions = { ...selectedOrder.actions };

            if(selectedOrder.attachments?.nf?.url && !selectedOrder.actions.nf.approved.done) {
                updatedActions.nf.approved = { done: true, user: currentUser, date: now };
            }
             if(selectedOrder.attachments?.boletos?.some(b => b.url) && !selectedOrder.actions.boleto.approved.done) {
                updatedActions.boleto.approved = { done: true, user: currentUser, date: now };
            }
            
            await updateDoc(orderRef, { actions: updatedActions });
            
            const updatedOrder = { ...selectedOrder, actions: updatedActions };
            setSelectedOrder(updatedOrder);
            setPurchaseOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));

            toast({ title: "Documentos Aprovados!", description: "A nota fiscal e o boleto foram marcados como aprovados.", className: "bg-accent text-accent-foreground" });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível aprovar os documentos.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSendToPayment = async () => {
        if (!selectedOrder || !clientName) return;
        setIsSubmitting(true);
        try {
            const orderRef = doc(db, "clients", clientName, "purchaseOrders", selectedOrder.id);
            await updateDoc(orderRef, { status: 'Aguardando Pagamento' });

            const updatedOrder = { ...selectedOrder, status: 'Aguardando Pagamento' as const };
            setSelectedOrder(updatedOrder);
            setPurchaseOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));

            toast({
                title: "Enviado para Pagamento!",
                description: `A ordem de compra foi enviada para o financeiro e agendada como despesa.`,
                className: "bg-accent text-accent-foreground"
            });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível enviar para pagamento.' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleRejectOrder = async () => {
        if (!selectedOrder || !clientName || !rejectionReason) {
            toast({ variant: 'destructive', title: 'Erro', description: 'O motivo da reprovação é obrigatório.' });
            return;
        }
        setIsSubmitting(true);
        try {
            const orderRef = doc(db, "clients", clientName, "purchaseOrders", selectedOrder.id);
            await updateDoc(orderRef, {
                status: 'Reprovado',
                rejectionReason: rejectionReason,
            });

            const updatedOrder = { ...selectedOrder, status: 'Reprovado' as const, rejectionReason: rejectionReason };
            setPurchaseOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
            
            setRejectionReason(''); // Reset reason
            setSelectedOrder(null); // Close main modal
            toast({ title: 'Pedido Reprovado', description: 'O fornecedor foi notificado para reenviar os documentos.' });

        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível reprovar o pedido.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const ActionLog = ({ action, actionName, actorType = 'Aprovado' }: { action: ActionInfo, actionName: string, actorType?: string }) => {
        if (!action.done) {
            return (
                <div className="flex items-center justify-between w-full">
                    <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Clock className="mr-2 h-4 w-4" /> {actionName}
                    </span>
                    <Badge variant="outline">Pendente</Badge>
                </div>
            );
        }
        return (
            <div className="w-full text-sm">
                <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-accent" />
                    <span>{actionName}</span>
                </div>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <p className="pl-6 text-xs text-muted-foreground cursor-default">
                                por {action.user} em {action.date}
                            </p>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{actorType} por {action.user} em {action.date}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        );
    };

    const revenueChartConfig = {
      revenue: { label: "Faturamento", color: "hsl(var(--primary))" },
    } satisfies ChartConfig;

    const pieChartConfig = {
        value: { label: 'Valor' },
        ...expensesByCategoryData.reduce((acc, cur, index) => ({
            ...acc,
            [cur.name]: { label: cur.name, color: COLORS[index % COLORS.length] }
        }), {})
    } satisfies ChartConfig;
    
    const comparisonChartConfig = {
        entradas: { label: "Entradas", color: "hsl(var(--chart-2))" },
        saidas: { label: "Saídas", color: "hsl(var(--chart-4))" },
    } satisfies ChartConfig;

    return (
        <div className="space-y-6">
            <PageHeader>
                <PageHeaderHeading>Gestão Financeira</PageHeaderHeading>
                <PageHeaderDescription>
                    Controle o fluxo de caixa, contas a pagar e a receber.
                </PageHeaderDescription>
            </PageHeader>
            
            <Tabs defaultValue="acompanhamento" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="acompanhamento" className="relative">
                        Acompanhamento
                        {hasDelayedOrders && (
                            <span className="absolute top-1 right-2 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
                            </span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="previsao-pagamentos">Previsão de pagamentos</TabsTrigger>
                    <TabsTrigger value="relatorio-financeiro">Relatório Financeiro</TabsTrigger>
                </TabsList>

                <TabsContent value="acompanhamento">
                   <Card>
                        <CardHeader>
                            <CardTitle>Acompanhamento de Ordens</CardTitle>
                            <CardDescription>Valide documentos e aprove pagamentos das ordens de compra em aberto.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Dialog open={!!selectedOrder} onOpenChange={(isOpen) => !isOpen && setSelectedOrder(null)}>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Pedido</TableHead>
                                            <TableHead>Fornecedor</TableHead>
                                            <TableHead>Solicitante</TableHead>
                                            <TableHead>Data</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Valor</TableHead>
                                            <TableHead className="w-[100px] text-right">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                             <TableRow>
                                                <TableCell colSpan={7} className="h-24 text-center">
                                                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                                </TableCell>
                                            </TableRow>
                                        ) : purchaseOrders.length > 0 ? (
                                            purchaseOrders.map(order => (
                                                <TableRow key={order.id} className={cn("cursor-pointer", order.status === 'Entrega Atrasada' && 'bg-destructive/10 hover:bg-destructive/20')}>
                                                    <TableCell className="font-medium" onClick={() => setSelectedOrder(order)}>{order.id.substring(0,8)}...</TableCell>
                                                    <TableCell onClick={() => setSelectedOrder(order)}>{order.supplierName}</TableCell>
                                                    <TableCell onClick={() => setSelectedOrder(order)}>{order.requester}</TableCell>
                                                    <TableCell onClick={() => setSelectedOrder(order)}>{format(new Date(order.date), 'dd/MM/yyyy')}</TableCell>
                                                    <TableCell onClick={() => setSelectedOrder(order)}>
                                                        <Badge variant={order.status.includes('Atrasada') || order.status.includes('Documentos') || order.status === 'Reprovado' ? 'destructive' : order.status === 'Aguardando Pagamento' ? 'secondary' : 'outline'}>
                                                            {order.status === 'Entrega Atrasada' && <AlertCircle className="mr-1 h-3 w-3" />}
                                                            {order.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right" onClick={() => setSelectedOrder(order)}>R$ {order.total.toFixed(2)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <DialogTrigger asChild>
                                                            <Button size="sm" variant="ghost" onClick={() => setSelectedOrder(order)}>
                                                                Analisar
                                                            </Button>
                                                        </DialogTrigger>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={7} className="h-24 text-center">
                                                    Nenhuma ordem de compra pendente.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>

                                {selectedOrder && (() => {
                                    const nfSentAction = {
                                        ...selectedOrder.actions.nf.sent,
                                        done: !!selectedOrder.attachments?.nf?.url,
                                    };
                                    const boletoSentAction = {
                                        ...selectedOrder.actions.boleto.sent,
                                        done: !!selectedOrder.attachments?.boletos?.some(b => b.url),
                                    };
                                    const canApprove = !isLoadingRole && userRole && ['Admin', 'Financeiro', 'Compras'].includes(userRole);

                                    return (
                                     <DialogContent className="max-w-4xl">
                                        <DialogHeader>
                                            <DialogTitle>Análise Financeira: {selectedOrder.id.substring(0,8)}</DialogTitle>
                                            <DialogDescription>
                                                Fornecedor: {selectedOrder.supplierName} | Prazo de Entrega: {format(new Date(selectedOrder.deliveryDate), 'dd/MM/yyyy')}
                                            </DialogDescription>
                                        </DialogHeader>
                                        
                                        <div className="py-6 space-y-6">
                                            {selectedOrder.status === 'Reprovado' && (
                                                <Alert variant="destructive">
                                                    <AlertTriangle className="h-4 w-4" />
                                                    <AlertTitle>Pedido Reprovado!</AlertTitle>
                                                    <AlertDescription>
                                                        <b>Motivo:</b> {selectedOrder.rejectionReason || 'Nenhum motivo informado.'}. O fornecedor precisa reenviar os documentos.
                                                    </AlertDescription>
                                                </Alert>
                                            )}
                                            {selectedOrder.status === 'Entrega Atrasada' && (
                                                <Alert variant="destructive">
                                                    <AlertTriangle className="h-4 w-4" />
                                                    <AlertTitle>Entrega Atrasada!</AlertTitle>
                                                    <AlertDescription>
                                                        A entrega deste pedido não foi confirmada no prazo. Verifique com o fornecedor/comprador.
                                                    </AlertDescription>
                                                </Alert>
                                            )}

                                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                <div className="lg:col-span-2 space-y-4">
                                                    <h5 className="font-medium">Itens do Pedido</h5>
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Item</TableHead>
                                                                <TableHead className="text-center">Qtd.</TableHead>
                                                                <TableHead className="text-right">Valor Unit.</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {selectedOrder.items.map((item, index) => (
                                                                <TableRow key={index}>
                                                                    <TableCell>{item.description}</TableCell>
                                                                    <TableCell className="text-center">{item.quantity}</TableCell>
                                                                    <TableCell className="text-right">R$ {item.value.toFixed(2)}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                                <div className="space-y-4">
                                                     <h5 className="font-medium">Checklist de Aprovação</h5>
                                                     <div className="space-y-4 rounded-md border p-4">
                                                        <div className="space-y-3">
                                                            <h6 className="font-semibold text-sm flex items-center gap-2"><FileText className="h-4 w-4" /> Nota Fiscal</h6>
                                                            <div className="pl-4 space-y-3 text-xs">
                                                                <ActionLog action={nfSentAction} actionName="Enviada" actorType="Enviada" />
                                                                <ActionLog action={selectedOrder.actions.nf.approved} actionName="Aprovada" actorType="Aprovada" />
                                                            </div>
                                                        </div>
                                                        <Separator />
                                                        <div className="space-y-3">
                                                            <h6 className="font-semibold text-sm flex items-center gap-2"><FileText className="h-4 w-4" /> Boleto(s)</h6>
                                                            <div className="pl-4 space-y-3 text-xs">
                                                                <ActionLog action={boletoSentAction} actionName="Enviado" actorType="Enviado" />
                                                                <ActionLog action={selectedOrder.actions.boleto.approved} actionName="Aprovada" actorType="Aprovada" />
                                                            </div>
                                                        </div>
                                                        <Separator />
                                                         <div className="flex flex-col items-start gap-1">
                                                            <div className="flex items-center justify-between w-full">
                                                                <span className="flex items-center gap-2 text-sm font-medium">
                                                                    <CheckCircle2 /> Entrega Confirmada
                                                                </span>
                                                                {selectedOrder.actions.entrega.done ? <CheckCircle2 className="text-accent" /> : <Clock className="text-muted-foreground" />}
                                                            </div>
                                                            {selectedOrder.actions.entrega.done && (
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <p className="text-xs text-muted-foreground flex items-center gap-1 cursor-default pl-6">
                                                                                <User className="h-3 w-3" /> por {selectedOrder.actions.entrega.user} em {selectedOrder.actions.entrega.date}
                                                                            </p>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p>Confirmado por {selectedOrder.actions.entrega.user} em {selectedOrder.actions.entrega.date}</p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Button 
                                                            className="w-full" 
                                                            onClick={handleApproveDocuments}
                                                            disabled={
                                                                !canApprove ||
                                                                (!nfSentAction.done && !boletoSentAction.done) ||
                                                                (selectedOrder.actions.nf.approved.done && selectedOrder.actions.boleto.approved.done) ||
                                                                !selectedOrder.actions.entrega.done ||
                                                                isSubmitting
                                                            }
                                                        >
                                                            {isSubmitting && !selectedOrder.actions.nf.approved.done ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileCheck2 className="mr-2"/>}
                                                            Aprovar Documentos
                                                        </Button>
                                                         <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button 
                                                                    variant="destructive" 
                                                                    className="w-full"
                                                                    disabled={!canApprove || !nfSentAction.done || selectedOrder.status === 'Reprovado'}
                                                                >
                                                                    Reprovar
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Reprovar Pedido?</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        Por favor, informe o motivo da reprovação. O fornecedor será notificado para reenviar os documentos.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <div className="py-4">
                                                                    <Label htmlFor="rejection-reason" className="sr-only">Motivo da Reprovação</Label>
                                                                    <Textarea
                                                                        id="rejection-reason"
                                                                        value={rejectionReason}
                                                                        onChange={(e) => setRejectionReason(e.target.value)}
                                                                        placeholder="Ex: Nota fiscal com valor incorreto, boleto com vencimento errado, etc."
                                                                    />
                                                                </div>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel onClick={() => setRejectionReason('')}>Cancelar</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={handleRejectOrder} disabled={!rejectionReason || isSubmitting}>
                                                                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Confirmar Reprovação"}
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                        <Button 
                                                            variant="secondary" 
                                                            className="w-full"
                                                            onClick={handleSendToPayment}
                                                            disabled={
                                                                !canApprove ||
                                                                !selectedOrder.actions.nf.approved.done ||
                                                                !selectedOrder.actions.boleto.approved.done ||
                                                                !selectedOrder.actions.entrega.done ||
                                                                selectedOrder.status === 'Aguardando Pagamento' ||
                                                                isSubmitting
                                                            }
                                                        >
                                                            {isSubmitting && selectedOrder.status !== 'Aguardando Pagamento' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2" />}
                                                            Enviar para Pagamento
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </DialogContent>
                                )})()}

                            </Dialog>
                        </CardContent>
                    </Card>
                </TabsContent>
                 <TabsContent value="previsao-pagamentos">
                    <Card>
                        <CardHeader>
                            <CardTitle>Previsão de Pagamentos</CardTitle>
                            <CardDescription>Consulte o valor total de pagamentos a serem efetuados em um determinado período.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                                <div className="space-y-2">
                                    <Label htmlFor="forecast-date-from">Período (De)</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                id="forecast-date-from"
                                                variant={"outline"}
                                                className={cn("w-full justify-start text-left font-normal", !forecastDateFrom && "text-muted-foreground")}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {forecastDateFrom ? format(forecastDateFrom, "dd/MM/yyyy") : <span>Selecione</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar mode="single" selected={forecastDateFrom} onSelect={setForecastDateFrom} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="forecast-date-to">Período (Até)</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                id="forecast-date-to"
                                                variant={"outline"}
                                                className={cn("w-full justify-start text-left font-normal", !forecastDateTo && "text-muted-foreground")}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {forecastDateTo ? format(forecastDateTo, "dd/MM/yyyy") : <span>Selecione</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar mode="single" selected={forecastDateTo} onSelect={setForecastDateTo} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="filter-company-forecast">Empresa</Label>
                                    <Select>
                                        <SelectTrigger id="filter-company-forecast">
                                            <SelectValue placeholder="Todas" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="todas">Todas as Empresas</SelectItem>
                                            <SelectItem value="matriz-sa">Matriz S.A.</SelectItem>
                                            <SelectItem value="filial-sp">Filial SP</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="filter-cost-center-forecast">Centro de Custo</Label>
                                    <Select>
                                        <SelectTrigger id="filter-cost-center-forecast">
                                            <SelectValue placeholder="Todos" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="todos">Todos os Centros</SelectItem>
                                            <SelectItem value="ti">Departamento de TI</SelectItem>
                                            <SelectItem value="marketing">Marketing</SelectItem>
                                            <SelectItem value="administrativo">Administrativo</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button onClick={handleSearchForecast}>
                                    <Search className="mr-2 h-4 w-4" />
                                    Buscar
                                </Button>
                            </div>
                            
                            {totalForecast !== null && forecastDateFrom && forecastDateTo && (
                                <div className="pt-4">
                                     <Separator className="my-4" />
                                     <h3 className="text-lg font-medium">Resultado da Previsão</h3>
                                     <div className="mt-4 rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                                        <p className="text-sm text-muted-foreground">
                                            Total a pagar entre {format(forecastDateFrom, "dd/MM/yyyy")} e {format(forecastDateTo, "dd/MM/yyyy")}:
                                        </p>
                                        <p className="text-3xl font-bold text-primary">
                                            R$ {totalForecast.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </p>
                                     </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="relatorio-financeiro">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-primary">Relatórios e Análises</CardTitle>
                            <CardDescription>
                                Métricas e insights detalhados sobre sua operação.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {isLoading ? (
                                 <div className="flex h-64 items-center justify-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                                <div className="grid gap-6 md:grid-cols-2">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Evolução do Faturamento</CardTitle>
                                            <CardDescription>Faturamento mensal nos últimos 6 meses.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <ChartContainer config={revenueChartConfig}>
                                                <LineChart
                                                    accessibilityLayer
                                                    data={revenueChartData}
                                                    margin={{ left: 12, right: 12 }}
                                                >
                                                    <CartesianGrid vertical={false} />
                                                    <XAxis
                                                        dataKey="month"
                                                        tickLine={false}
                                                        axisLine={false}
                                                        tickMargin={8}
                                                    />
                                                    <YAxis
                                                        tickLine={false}
                                                        axisLine={false}
                                                        tickMargin={8}
                                                        tickFormatter={(value) => `R$${Number(value) / 1000}k`}
                                                    />
                                                    <ChartTooltip cursor={false} content={<ChartTooltipContent
                                                        formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR')}`}
                                                    />} />
                                                    <Line
                                                        dataKey="revenue"
                                                        type="monotone"
                                                        stroke="var(--color-revenue)"
                                                        strokeWidth={2}
                                                        dot={true}
                                                    />
                                                </LineChart>
                                            </ChartContainer>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Despesas por Categoria</CardTitle>
                                            <CardDescription>Distribuição de gastos no período.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="flex-1 pb-0">
                                            <ChartContainer
                                                config={pieChartConfig}
                                                className="mx-auto aspect-square max-h-[300px]"
                                            >
                                                <PieChart>
                                                <ChartTooltip
                                                    cursor={false}
                                                    content={<ChartTooltipContent hideLabel formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR')}`} />}
                                                />
                                                <Pie
                                                    data={expensesByCategoryData}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    innerRadius={60}
                                                    strokeWidth={5}
                                                    activeIndex={activeIndex}
                                                    activeShape={({ outerRadius = 0, ...props }: any) => (
                                                    <g>
                                                        <Sector {...props} outerRadius={outerRadius + 10} />
                                                        <Sector
                                                        {...props}
                                                        outerRadius={outerRadius + 20}
                                                        innerRadius={outerRadius + 12}
                                                        />
                                                    </g>
                                                    )}
                                                    onMouseOver={(_, index) => setActiveIndex(index)}
                                                >
                                                    {expensesByCategoryData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <ChartLegend
                                                    content={<ChartLegendContent nameKey="name" />}
                                                    className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
                                                />
                                                </PieChart>
                                            </ChartContainer>
                                        </CardContent>
                                    </Card>
                                    <Card className="md:col-span-2">
                                        <CardHeader>
                                            <CardTitle>Entradas vs. Saídas por Centro de Custo</CardTitle>
                                            <CardDescription>Comparativo financeiro das áreas da empresa.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                        <ChartContainer config={comparisonChartConfig} className="min-h-[300px] w-full">
                                                <BarChart data={cashFlowByCostCenterData}>
                                                <CartesianGrid vertical={false} />
                                                <XAxis
                                                    dataKey="name"
                                                    tickLine={false}
                                                    tickMargin={10}
                                                    axisLine={false}
                                                />
                                                <YAxis tickFormatter={(value) => `R$${Number(value) / 1000}k`} />
                                                <ChartTooltip content={<ChartTooltipContent formatter={(value) => `R$ ${Number(value).toLocaleString('pt-BR')}`} />} />
                                                <ChartLegend content={<ChartLegendContent />} />
                                                <Bar dataKey="entradas" fill="var(--color-entradas)" radius={4} />
                                                <Bar dataKey="saidas" fill="var(--color-saidas)" radius={4} />
                                                </BarChart>
                                            </ChartContainer>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
