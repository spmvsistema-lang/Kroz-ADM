
'use client';

import { useState, useEffect } from "react";
import { PageHeader, PageHeaderDescription, PageHeaderHeading } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CalendarClock, CheckCircle2, FileText, DollarSign, Download, Landmark, Copy, UploadCloud, CalendarIcon, Loader2, Link as LinkIcon, FileHeart } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { db } from '@/firebase/config';
import { collection, query, where, getDocs, Timestamp, doc, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/firebase/auth/use-user";
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


// Tipos de dados
interface Attachment {
    type: 'NF' | 'Boleto' | 'Comprovante' | 'Outro';
    fileName: string;
    fileUrl: string;
}

interface PaymentDetails {
    method: string;
    pixKey?: string;
    bankInfo?: string;
}

interface Payment {
    id: string;
    supplier: string;
    origin: string;
    dueDate: string;
    paidDate?: string;
    value: number;
    status: 'Atrasado' | 'Pendente' | 'Pago';
    attachments: Attachment[];
    paymentDetails?: PaymentDetails;
    type: 'purchase' | 'veterinarian' | 'expense';
    veterinarianId?: string;
    serviceNoteReceived?: boolean;
    companyId?: string;
}

interface PurchaseOrder {
    id: string;
    supplierName: string;
    date: string; // yyyy-MM-dd
    deliveryDate: string; // yyyy-MM-dd
    total: number;
    status: 'Aguardando Documentos' | 'Aguardando Aprovação' | 'Entrega Atrasada' | 'Aguardando Pagamento' | 'Concluído';
    paymentMethod: string;
    clientId: string;
    companyId: string;
    attachments?: {
        nf?: { url: string; name: string };
        boletos?: { url: string; name: string; }[];
    };
}

interface Company {
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


export default function PagamentosPage() {
    const { user } = useUser();
    const [payments, setPayments] = useState<Payment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
    const [paymentDate, setPaymentDate] = useState<Date>();
    const [paymentValue, setPaymentValue] = useState<string>('');
    const [isPaymentDatePopoverOpen, setIsPaymentDatePopoverOpen] = useState(false);
    const { toast } = useToast();
    const clientName = typeof window !== 'undefined' ? localStorage.getItem('clientName') : null;
    
    // Novas dependências de dados
    const [companies, setCompanies] = useState<Company[]>([]);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

    // State para o modal
    const [paymentCompanyId, setPaymentCompanyId] = useState<string>('');
    const [paymentBankAccountId, setPaymentBankAccountId] = useState<string>('');

    useEffect(() => {
        if (!clientName) return;

        const fetchPayments = async () => {
            setIsLoading(true);
            try {
                const now = new Date();
                now.setHours(0, 0, 0, 0);

                const [
                    poSnapshot,
                    vetPaymentsSnapshot,
                    expensesSnapshot,
                    companiesSnapshot,
                    bankAccountsSnapshot
                ] = await Promise.all([
                    getDocs(query(collection(db, "clients", clientName, "purchaseOrders"))),
                    getDocs(query(collection(db, "clients", clientName, "payments"))),
                    getDocs(query(collection(db, "clients", clientName, "expenses"))),
                    getDocs(query(collection(db, "clients", clientName, "companies"))),
                    getDocs(query(collection(db, "clients", clientName, "bankAccounts"))),
                ]);

                const companiesData = companiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Company));
                setCompanies(companiesData);
                const bankAccountsData = bankAccountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BankAccount));
                setBankAccounts(bankAccountsData);

                // Fetch payments from purchase orders
                const poPayments = poSnapshot.docs.map(doc => {
                    const order = { id: doc.id, ...doc.data() } as PurchaseOrder;
                    let status: Payment['status'];
                    const dueDate = new Date(order.deliveryDate);

                    if (order.status === 'Concluído') status = 'Pago';
                    else if (order.status === 'Aguardando Pagamento' && dueDate < now) status = 'Atrasado';
                    else if (order.status === 'Aguardando Pagamento') status = 'Pendente';
                    else return null;

                    const attachments: Attachment[] = [];
                    if (order.attachments?.nf?.url) {
                        attachments.push({ type: 'NF', fileName: order.attachments.nf.name, fileUrl: order.attachments.nf.url });
                    }
                    if (order.attachments?.boletos) {
                        order.attachments.boletos.forEach(boleto => {
                            if(boleto.url) attachments.push({ type: 'Boleto', fileName: boleto.name, fileUrl: boleto.url });
                        });
                    }

                    return {
                        id: order.id,
                        supplier: order.supplierName,
                        origin: `Compra ${order.id.substring(0, 8)}...`,
                        dueDate: format(dueDate, 'dd/MM/yyyy'),
                        value: order.total,
                        status: status,
                        attachments: attachments,
                        paymentDetails: { method: order.paymentMethod },
                        paidDate: order.status === 'Concluído' ? format(new Date(order.date), 'dd/MM/yyyy') : undefined,
                        type: 'purchase' as const,
                        companyId: order.companyId,
                    };
                }).filter(p => p !== null) as Payment[];

                // Fetch payments from veterinarians
                const vetPayments = vetPaymentsSnapshot.docs.map(doc => {
                    const data = doc.data();
                    let status: Payment['status'] = data.status;
                     const dueDate = new Date(data.dueDate);
                    if (status === 'Pendente' && dueDate < now) {
                        status = 'Atrasado';
                    }
                    const attachments: Attachment[] = [];
                    if (data.fileUrl) {
                        attachments.push({ type: 'Outro', fileName: data.fileName, fileUrl: data.fileUrl });
                    }
                    return {
                        id: doc.id,
                        supplier: data.veterinarianName,
                        origin: `Serviço Vet. (${data.monthYear})`,
                        dueDate: format(dueDate, 'dd/MM/yyyy'),
                        value: data.value,
                        status: status,
                        attachments: attachments,
                        type: 'veterinarian' as const,
                        veterinarianId: data.veterinarianId,
                        serviceNoteReceived: data.serviceNoteReceived || false
                    };
                });

                // Fetch payments from expenses
                const expensePayments = expensesSnapshot.docs.map(doc => {
                    const data = doc.data();
                    const dueDate = new Date(data.expenseDate);
                    let status: Payment['status'] = data.status || 'Pendente';

                     if (status === 'Pendente' && dueDate < now) {
                        status = 'Atrasado';
                    }

                    return {
                        id: doc.id,
                        supplier: data.description,
                        origin: `Despesa Avulsa`,
                        dueDate: format(dueDate, 'dd/MM/yyyy'),
                        paidDate: data.paidDate ? format(new Date(data.paidDate), 'dd/MM/yyyy') : undefined,
                        value: data.value,
                        status: status,
                        attachments: [], // Expenses don't have attachments for now
                        paymentDetails: { method: data.paymentMethod },
                        type: 'expense' as const,
                        companyId: data.companyId,
                    };
                });


                const allPayments = [...poPayments, ...vetPayments, ...expensePayments].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
                setPayments(allPayments);

            } catch (error) {
                console.error("Error fetching payments:", error);
                toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os dados de pagamento.' });
            } finally {
                setIsLoading(false);
            }
        };

        fetchPayments();
    }, [clientName, toast]);

    const handleOpenModal = (payment: Payment) => {
        setSelectedPayment(payment);
        setPaymentValue(payment.value.toString());
        setPaymentDate(new Date());

        if (payment.companyId) {
            setPaymentCompanyId(payment.companyId);
        } else {
            setPaymentCompanyId('');
        }
        setPaymentBankAccountId('');
    };

    const handleRegisterPayment = async () => {
        if (!selectedPayment || !paymentDate || !paymentValue || !clientName || !paymentCompanyId || !paymentBankAccountId) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Empresa, Conta, Data e Valor são obrigatórios.' });
            return;
        }
        setIsSubmitting(true);
        try {
             // 1. Criar a despesa correspondente
            await addDoc(collection(db, "clients", clientName, "expenses"), {
                clientId: clientName,
                companyId: paymentCompanyId,
                bankAccountId: paymentBankAccountId,
                description: `Pagamento: ${selectedPayment.supplier}`,
                value: Number(paymentValue),
                expenseDate: format(paymentDate, 'yyyy-MM-dd'), // A despesa é a data do pagamento
                category: selectedPayment.type === 'purchase' ? 'pagamento-compra' : (selectedPayment.type === 'veterinarian' ? 'pagamento-servico-vet' : 'pagamento-despesa'),
                status: 'Pago',
                originId: selectedPayment.id,
                originType: selectedPayment.type,
                createdAt: serverTimestamp(),
            });
            
            // 2. Atualizar o documento original para "Pago"
            let collectionName: string;
            switch(selectedPayment.type) {
                case 'purchase': collectionName = 'purchaseOrders'; break;
                case 'veterinarian': collectionName = 'payments'; break;
                case 'expense': collectionName = 'expenses'; break;
                default:
                    toast({ variant: 'destructive', title: 'Erro', description: 'Tipo de pagamento desconhecido.' });
                    setIsSubmitting(false);
                    return;
            }

            const paymentRef = doc(db, "clients", clientName, collectionName, selectedPayment.id);
            await updateDoc(paymentRef, {
                status: 'Pago',
                paidDate: format(paymentDate, 'yyyy-MM-dd'),
            });
            
            toast({ title: 'Sucesso!', description: 'Pagamento registrado com sucesso.', className: 'bg-accent text-accent-foreground' });
            
            // Atualização otimista da UI
            setPayments(prev => prev.map(p => p.id === selectedPayment.id ? { ...p, status: 'Pago', paidDate: format(paymentDate, 'dd/MM/yyyy') } : p));
            setSelectedPayment(null);
            setPaymentDate(undefined);
            setPaymentValue('');
            setPaymentCompanyId('');
            setPaymentBankAccountId('');

        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível registrar o pagamento.' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleConfirmServiceNote = async () => {
        if (!selectedPayment || !clientName) return;
        
        if (selectedPayment.type !== 'veterinarian' || selectedPayment.serviceNoteReceived) return;

        setIsSubmitting(true);
        try {
            const paymentRef = doc(db, "clients", clientName, "payments", selectedPayment.id);
            await updateDoc(paymentRef, {
                serviceNoteReceived: true
            });

            const updatedPayment = { ...selectedPayment, serviceNoteReceived: true };
            
            setSelectedPayment(updatedPayment);
            setPayments(prev => prev.map(p => p.id === updatedPayment.id ? updatedPayment : p));

            toast({ title: "Sucesso!", description: "Recebimento da nota de serviço confirmado.", className: "bg-accent text-accent-foreground" });

        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível confirmar o recebimento da nota.' });
        } finally {
            setIsSubmitting(false);
        }
    };


    const overduePayments = payments.filter(p => p.status === 'Atrasado');
    const upcomingPayments = payments.filter(p => p.status === 'Pendente');
    const paidPayments = payments.filter(p => p.status === 'Pago');


    const renderTable = (data: Payment[], tableType: 'atrasados' | 'proximos' | 'pagos') => {
        if (isLoading) {
            return (
                <div className="flex items-center justify-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            )
        }
        if (data.length === 0) {
            return <p className="text-sm text-muted-foreground text-center py-8">Nenhum pagamento nesta categoria.</p>;
        }
        return (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Fornecedor/Destinatário</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>{tableType === 'pagos' ? 'Data Pagamento' : 'Vencimento'}</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map(p => (
                        <DialogTrigger key={p.id} asChild>
                            <TableRow 
                                className={`cursor-pointer ${tableType === 'atrasados' ? 'bg-destructive/10 hover:bg-destructive/20' : ''}`}
                                onClick={() => handleOpenModal(p)}
                            >
                                <TableCell className="font-medium">{p.supplier}</TableCell>
                                <TableCell>{p.origin}</TableCell>
                                <TableCell>{tableType === 'pagos' ? p.paidDate : p.dueDate}</TableCell>
                                <TableCell className="text-right">R$ {p.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</TableCell>
                            </TableRow>
                        </DialogTrigger>
                    ))}
                </TableBody>
            </Table>
        )
    };

    return (
        <div className="space-y-6">
            <PageHeader>
                <PageHeaderHeading>Gestão de Pagamentos</PageHeaderHeading>
                <PageHeaderDescription>
                    Gerencie, agende e acompanhe todas as contas a pagar da sua empresa.
                </PageHeaderDescription>
            </PageHeader>
            <Dialog onOpenChange={(isOpen) => !isOpen && setSelectedPayment(null)}>
                <Tabs defaultValue="proximos" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="atrasados" className="relative">
                            <AlertCircle className="mr-2 h-4 w-4 text-destructive" />
                            Atrasados
                            {overduePayments.length > 0 &&
                                <Badge variant="destructive" className="ml-2">{overduePayments.length}</Badge>
                            }
                        </TabsTrigger>
                        <TabsTrigger value="proximos">
                            <CalendarClock className="mr-2 h-4 w-4 text-primary" />
                            Próximos Vencimentos
                        </TabsTrigger>
                        <TabsTrigger value="pagos">
                            <CheckCircle2 className="mr-2 h-4 w-4 text-accent" />
                            Pagos
                        </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="atrasados">
                        <Card>
                            <CardHeader>
                                <CardTitle>Pagamentos Atrasados</CardTitle>
                                <CardDescription>Contas com data de vencimento ultrapassada que requerem ação imediata.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {renderTable(overduePayments, 'atrasados')}
                            </CardContent>
                        </Card>
                    </TabsContent>
                    
                    <TabsContent value="proximos">
                        <Card>
                            <CardHeader>
                                <CardTitle>Próximos Vencimentos</CardTitle>
                                <CardDescription>Contas a pagar agendadas para os próximos dias e semanas.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {renderTable(upcomingPayments, 'proximos')}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="pagos">
                        <Card>
                            <CardHeader>
                                <CardTitle>Histórico de Pagamentos</CardTitle>
                                <CardDescription>Consulte todas as contas que já foram pagas.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {renderTable(paidPayments, 'pagos')}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
                
                {selectedPayment && (
                     <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Registrar Pagamento: {selectedPayment.id.substring(0,8)}</DialogTitle>
                            <DialogDescription>
                                {selectedPayment.type === 'purchase' ? `Fornecedor: ${selectedPayment.supplier}` : selectedPayment.type === 'veterinarian' ? `Veterinário: ${selectedPayment.supplier}` : `Despesa: ${selectedPayment.supplier}`} | Origem: {selectedPayment.origin}
                            </DialogDescription>
                        </DialogHeader>
                        
                         <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
                            <div className="grid grid-cols-3 gap-4 text-sm p-4 border rounded-lg">
                                <div>
                                    <p className="text-muted-foreground">Valor</p>
                                    <p className="font-semibold text-lg">R$ {selectedPayment.value.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Vencimento</p>
                                    <p className="font-semibold">{selectedPayment.dueDate}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Status</p>
                                    <Badge variant={selectedPayment.status === 'Pago' ? 'default' : selectedPayment.status === 'Atrasado' ? 'destructive' : 'secondary'} className={selectedPayment.status === 'Pago' ? 'bg-accent text-accent-foreground' : ''}>
                                        {selectedPayment.status}
                                    </Badge>
                                </div>
                            </div>
                            
                            {selectedPayment.attachments && selectedPayment.attachments.length > 0 && (
                                <>
                                    <Separator />
                                    <div className="space-y-2">
                                        <h4 className="font-medium text-sm">Documentos Anexados</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedPayment.attachments.map((att, index) => (
                                                <Button key={index} asChild variant="secondary" size="sm">
                                                    <a href={att.fileUrl} target="_blank" rel="noopener noreferrer">
                                                        <Download className="mr-2 h-4 w-4" />
                                                        {att.fileName}
                                                    </a>
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                            
                            {selectedPayment.type === 'veterinarian' && (
                                <>
                                    <Separator />
                                    <div className="space-y-2">
                                        <h4 className="font-medium text-sm">Documento do Serviço</h4>
                                        <div className="flex items-center justify-between rounded-lg border p-3">
                                            <div className="flex items-center gap-3">
                                                <FileHeart className="h-5 w-5 text-primary" />
                                                <div>
                                                    <p className="font-medium text-sm">Nota de Serviço</p>
                                                    <p className="text-xs text-muted-foreground">Enviada pelo veterinário</p>
                                                </div>
                                            </div>
                                            {selectedPayment.serviceNoteReceived ? (
                                                <Badge variant="default" className="bg-accent text-accent-foreground">Recebida</Badge>
                                            ) : (
                                                <Badge variant="destructive">Pendente</Badge>
                                            )}
                                        </div>
                                        {!selectedPayment.serviceNoteReceived && selectedPayment.status !== 'Pago' && (
                                            <Button 
                                                variant="outline" 
                                                className="w-full" 
                                                onClick={handleConfirmServiceNote}
                                                disabled={isSubmitting}
                                            >
                                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                                Confirmar Recebimento da Nota
                                            </Button>
                                        )}
                                    </div>
                                </>
                            )}
                            
                            {selectedPayment.status !== 'Pago' && (
                                <>
                                <Separator />
                                <div className="space-y-2">
                                    <Label htmlFor="payment-company">Empresa</Label>
                                    <Select value={paymentCompanyId} onValueChange={setPaymentCompanyId} required>
                                        <SelectTrigger id="payment-company">
                                            <SelectValue placeholder="Selecione a empresa pagadora" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="payment-bank-account">Conta de Débito</Label>
                                    <Select value={paymentBankAccountId} onValueChange={setPaymentBankAccountId} required disabled={!paymentCompanyId}>
                                        <SelectTrigger id="payment-bank-account">
                                            <SelectValue placeholder="Selecione a conta" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {bankAccounts.filter(acc => acc.companyId === paymentCompanyId).map(account => (
                                                <SelectItem key={account.id} value={account.id}>{account.bankName} - Ag: {account.agency}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="payment-date">Data do Pagamento</Label>
                                        <Popover open={isPaymentDatePopoverOpen} onOpenChange={setIsPaymentDatePopoverOpen}>
                                            <PopoverTrigger asChild>
                                                <Button id="payment-date" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !paymentDate && "text-muted-foreground")}>
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {paymentDate ? format(paymentDate, "dd/MM/yyyy") : <span>Selecione uma data</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar mode="single" selected={paymentDate} onSelect={(day) => { setPaymentDate(day); setIsPaymentDatePopoverOpen(false); }} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="payment-value">Valor Pago (R$)</Label>
                                        <Input id="payment-value" type="number" placeholder="0,00" value={paymentValue} onChange={e => setPaymentValue(e.target.value)} />
                                    </div>
                                </div>
                                 <div className="space-y-2">
                                    <Label htmlFor="receipt">Comprovante de Pagamento</Label>
                                    <Button variant="outline" className="w-full">
                                        <UploadCloud className="mr-2 h-4 w-4" />
                                        Anexar Comprovante
                                    </Button>
                                </div>
                                </>
                            )}
                        </div>

                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Fechar</Button></DialogClose>
                            {selectedPayment.status !== 'Pago' ? (
                                <Button className="w-full sm:w-auto" onClick={handleRegisterPayment} disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    <DollarSign className="mr-2 h-4 w-4" />
                                    Registrar Pagamento
                                </Button>
                            ) : (
                                <p className="text-sm text-accent">Pagamento realizado em {selectedPayment.paidDate}</p>
                            )}
                        </DialogFooter>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
}
