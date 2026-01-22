

'use client'

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader, PageHeaderDescription, PageHeaderHeading } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Upload, Paperclip, CalendarIcon, Copy, Loader2, ArrowLeft, File as FileIcon, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format, addMonths } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { useUser } from '@/firebase/auth/use-user';
import { db, app } from '@/firebase/config';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';


// Simulação de dados
interface ActionInfo {
    done: boolean;
    user?: string;
    date?: string;
}

interface PurchaseOrder {
    id: string;
    date: string;
    total: number;
    status: string;
    paymentMethod: string;
    items: { description: string; quantity: number; value: number }[];
    actions: {
        nf: { sent: ActionInfo };
        boleto: { sent: ActionInfo };
    };
    rejectionReason?: string;
}

const getStatusVariant = (status: string) => {
    switch (status) {
        case 'Concluído':
            return 'default';
        case 'Aguardando Documentos':
        case 'Reprovado':
            return 'destructive';
        default:
            return 'secondary';
    }
};

interface Installment {
    id: number;
    dueDate?: Date;
    file?: File | null;
    previewUrl?: string | null;
    code?: string;
}

export default function FornecedorPedidosPage() {
    const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const { user, isLoading: isUserLoading } = useUser();
    const router = useRouter();

    // States for the modal form
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
    const [pixKey, setPixKey] = useState('');
    const [bankData, setBankData] = useState('');
    const [nfFile, setNfFile] = useState<File | null>(null);
    const [installments, setInstallments] = useState<Installment[]>([]);
    const [numInstallments, setNumInstallments] = useState<number>(1);
    const [installmentPopovers, setInstallmentPopovers] = useState<Record<number, boolean>>({});

    // States for PDF Previewer
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

    
    const orderTotal = selectedOrder?.total || 0;

    // Effect to clean up object URLs when the component unmounts
    const installmentsRef = useRef(installments);
    installmentsRef.current = installments;

    useEffect(() => {
        return () => {
            installmentsRef.current.forEach(inst => {
                if (inst.previewUrl) {
                    URL.revokeObjectURL(inst.previewUrl);
                }
            });
        };
    }, []);


    useEffect(() => {
        const fetchOrders = async () => {
            if (!user) {
                setIsLoading(false);
                return;
            }
            const clientId = localStorage.getItem('clientName');
            if (!clientId) {
                router.replace('/fornecedor/selecao-cliente');
                return;
            }
            setIsLoading(true);

            try {
                const suppliersQuery = query(
                    collection(db, "clients", clientId, "suppliers"),
                    where("authUid", "==", user.uid)
                );
                const suppliersSnapshot = await getDocs(suppliersQuery);

                if (suppliersSnapshot.empty) {
                    toast({ variant: "destructive", title: "Acesso Negado", description: "Você não está cadastrado como fornecedor para este cliente." });
                    setOrders([]);
                    setIsLoading(false);
                    return;
                }
                
                const supplierDoc = suppliersSnapshot.docs[0];
                const supplierIdForClient = supplierDoc.id;
                
                const ordersQuery = query(
                    collection(db, "clients", clientId, "purchaseOrders"), 
                    where("supplierId", "==", supplierIdForClient)
                );
                const ordersSnapshot = await getDocs(ordersQuery);

                const fetchedOrders = ordersSnapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        date: format(new Date(data.date), 'dd/MM/yyyy'),
                        total: data.total,
                        status: data.status,
                        paymentMethod: data.paymentMethod,
                        items: data.items,
                        actions: data.actions,
                        rejectionReason: data.rejectionReason,
                    };
                }) as PurchaseOrder[];
                
                setOrders(fetchedOrders);

            } catch (error) {
                console.error("Error fetching orders:", error);
                toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar seus pedidos." });
            } finally {
                setIsLoading(false);
            }
        };

        if (user) {
            fetchOrders();
        } else if (!isUserLoading) {
            setIsLoading(false);
        }

    }, [user, isUserLoading, toast, router]);

    const handleOpenOrderModal = (order: PurchaseOrder) => {
        setSelectedOrder(order);
        // Reset form states for the modal
        setSelectedPaymentMethod(order.paymentMethod);
        setPixKey('');
        setBankData('');
        setNfFile(null);
        setNumInstallments(1);
        updateInstallments(1, order.total);
    };

    const updateInstallments = (count: number, total: number) => {
        setNumInstallments(count);
        const newInstallments: Installment[] = [];
        for (let i = 1; i <= count; i++) {
            newInstallments.push({ id: i, code: '', file: null, previewUrl: null });
        }
        setInstallments(newInstallments);
        setInstallmentPopovers({});
    };

    const handleInstallmentDateChange = (installmentId: number, date?: Date) => {
        if (installmentId === 1 && date) {
            setInstallments(prev => {
                return prev.map(inst => {
                    return { ...inst, dueDate: addMonths(date, inst.id - 1) };
                });
            });
        } else {
            setInstallments(prev => prev.map(inst => inst.id === installmentId ? { ...inst, dueDate: date } : inst));
        }
        setInstallmentPopovers(prev => ({ ...prev, [installmentId]: false }));
    };

    const handleInstallmentCodeChange = (installmentId: number, code: string) => {
        setInstallments(prev => prev.map(inst => inst.id === installmentId ? { ...inst, code } : inst));
    };
    
    const handleInstallmentFileChange = (installmentId: number, file: File | null) => {
        setInstallments(prev =>
            prev.map(inst => {
                if (inst.id === installmentId) {
                    if (inst.previewUrl) {
                        URL.revokeObjectURL(inst.previewUrl);
                    }
                    const newPreviewUrl = file ? URL.createObjectURL(file) : null;
                    return { ...inst, file: file, previewUrl: newPreviewUrl };
                }
                return inst;
            })
        );
    };

    const handleCopyCode = (code?: string) => {
        if (code) {
            navigator.clipboard.writeText(code);
            toast({
                title: "Sucesso!",
                description: "Código do boleto copiado para a área de transferência.",
                className: "bg-accent text-accent-foreground"
            });
        }
    };
    
    const installmentValue = orderTotal > 0 && numInstallments > 0 ? (orderTotal / numInstallments).toFixed(2) : '0.00';
    
    const handleSwitchClient = () => {
        localStorage.removeItem('clientName');
        router.push('/fornecedor/selecao-cliente');
    };

    const handleSendDocuments = async () => {
        const clientId = localStorage.getItem('clientName');
        if (!selectedOrder || !nfFile || !selectedPaymentMethod || !user || !clientId) {
            toast({ variant: 'destructive', title: 'Campos Incompletos', description: 'É obrigatório anexar a Nota Fiscal e selecionar uma forma de pagamento.' });
            return;
        }
        
        if (selectedPaymentMethod === 'Boleto' && installments.some(inst => !inst.dueDate || !inst.file)) {
             toast({ variant: 'destructive', title: 'Boletos Incompletos', description: 'Para pagamento com boleto, anexe todos os arquivos e defina todas as datas de vencimento.' });
            return;
        }
        if (selectedPaymentMethod === 'PIX' && !pixKey) {
             toast({ variant: 'destructive', title: 'Chave PIX Faltando', description: 'Por favor, informe sua chave PIX.' });
            return;
        }
         if (selectedPaymentMethod === 'Transferência' && !bankData) {
             toast({ variant: 'destructive', title: 'Dados Bancários Faltando', description: 'Por favor, informe seus dados bancários.' });
            return;
        }

        setIsSubmitting(true);
        try {
            const storage = getStorage(app);
            const metadata = {
                customMetadata: {
                    'ownerUid': user.uid,
                }
            };

            // 1. Upload NF
            const nfStorageRef = ref(storage, `clients/${clientId}/purchase-orders/${selectedOrder.id}/nf-${nfFile.name}`);
            const nfUploadResult = await uploadBytes(nfStorageRef, nfFile, metadata);
            const nfUrl = await getDownloadURL(nfUploadResult.ref);

            // 2. Upload Boletos if they exist
            const uploadedInstallmentsData = await Promise.all(
                installments.map(async (inst) => {
                    if (inst.file) {
                        const boletoStorageRef = ref(storage, `clients/${clientId}/purchase-orders/${selectedOrder.id}/boleto-parc${inst.id}-${inst.file.name}`);
                        const boletoUploadResult = await uploadBytes(boletoStorageRef, inst.file, metadata);
                        const boletoUrl = await getDownloadURL(boletoUploadResult.ref);
                        return {
                            dueDate: inst.dueDate ? format(inst.dueDate, 'yyyy-MM-dd') : null,
                            code: inst.code,
                            url: boletoUrl,
                            name: inst.file.name,
                        };
                    }
                    return {
                        dueDate: inst.dueDate ? format(inst.dueDate, 'yyyy-MM-dd') : null,
                        code: inst.code,
                        url: null,
                        name: null,
                    };
                })
            );
            
            // 3. Update Firestore Document
            const orderRef = doc(db, 'clients', clientId, 'purchaseOrders', selectedOrder.id);
            
            const attachments: any = {
                nf: { url: nfUrl, name: nfFile.name }
            };
            if (selectedPaymentMethod === 'Boleto') {
                attachments.boletos = uploadedInstallmentsData;
            }
            
            const now = new Date();
            const updateData: any = {
                status: 'Aguardando Aprovação',
                attachments,
                supplierPaymentInfo: {
                    method: selectedPaymentMethod,
                    pixKey: selectedPaymentMethod === 'PIX' ? pixKey : null,
                    bankData: selectedPaymentMethod === 'Transferência' ? bankData : null,
                },
                'actions.nf.sent': {
                    done: true,
                    user: user.displayName || user.email,
                    date: format(now, 'dd/MM/yyyy HH:mm')
                },
                'actions.boleto.sent': selectedPaymentMethod === 'Boleto' ? {
                    done: true,
                    user: user.displayName || user.email,
                    date: format(now, 'dd/MM/yyyy HH:mm')
                } : selectedOrder.actions.boleto,
                rejectionReason: null, // Clear reason on resubmission
            };
            
            await updateDoc(orderRef, updateData);

            toast({ title: 'Sucesso!', description: 'Documentos enviados para aprovação.', className: 'bg-accent text-accent-foreground'});

            setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, status: 'Aguardando Aprovação' } : o));
            setSelectedOrder(null);
        } catch (error) {
            console.error("Error sending documents:", error);
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível enviar os documentos." });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const SentStatus = ({ action, actionName }: { action: ActionInfo, actionName: string }) => {
        if (!action || !action.done) {
            return (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{actionName} pendente de envio.</span>
                </div>
            );
        }
        return (
            <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <div className="flex flex-col">
                    <span className="font-medium text-sm">{actionName} enviado</span>
                    <span className="text-xs text-muted-foreground">
                        Em {action.date}
                    </span>
                </div>
            </div>
        );
    };


    return (
        <div className="space-y-6">
            <PageHeader>
                 <div>
                    <PageHeaderHeading>Portal do Fornecedor</PageHeaderHeading>
                    <PageHeaderDescription>
                        Visualize e gerencie suas ordens de compra.
                    </PageHeaderDescription>
                </div>
                <Button variant="outline" onClick={handleSwitchClient}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Trocar de Cliente
                </Button>
            </PageHeader>
            <Dialog open={!!selectedOrder} onOpenChange={(isOpen) => !isOpen && setSelectedOrder(null)}>
                <Card>
                    <CardHeader>
                        <CardTitle>Minhas Ordens de Compra</CardTitle>
                        <CardDescription>Acompanhe o status e as ações necessárias para cada pedido.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex h-48 items-center justify-center">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[120px]">Pedido</TableHead>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Valor</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {orders.length > 0 ? (
                                    orders.map((order) => (
                                        <TableRow key={order.id} className="cursor-pointer" onClick={() => handleOpenOrderModal(order)}>
                                            <TableCell className="font-medium">{order.id.substring(0,8)}...</TableCell>
                                            <TableCell>{order.date}</TableCell>
                                            <TableCell>
                                                <Badge variant={getStatusVariant(order.status)}>{order.status}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right">R$ {order.total.toFixed(2)}</TableCell>
                                        </TableRow>
                                ))) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">Nenhum pedido encontrado para você.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                        )}
                    </CardContent>
                </Card>
                
                {selectedOrder && (
                    <DialogContent className="sm:max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>Detalhes do Pedido: {selectedOrder.id.substring(0,8)}...</DialogTitle>
                             <DialogDescription>
                                {selectedOrder.status === 'Aguardando Documentos' || selectedOrder.status === 'Reprovado' 
                                    ? 'Anexe a nota fiscal e informe os dados de pagamento para continuar.'
                                    : `Status do pedido: ${selectedOrder.status}. Documentos enviados para análise.`
                                }
                            </DialogDescription>
                        </DialogHeader>
                        
                        {selectedOrder.status === 'Aguardando Documentos' || selectedOrder.status === 'Reprovado' ? (
                            <form onSubmit={(e) => { e.preventDefault(); handleSendDocuments(); }}>
                                <div className="py-4 space-y-6 max-h-[70vh] overflow-y-auto pr-4">
                                    {selectedOrder.status === 'Reprovado' && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertTitle>Seu Pedido Foi Reprovado</AlertTitle>
                                            <AlertDescription>
                                                <strong>Motivo:</strong> {selectedOrder.rejectionReason || 'Nenhum motivo especificado.'}
                                                <br />
                                                Por favor, corrija e reenvie os documentos.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    {selectedOrder.status === 'Aguardando Documentos' && (
                                        <Alert>
                                            <Paperclip className="h-4 w-4" />
                                            <AlertTitle>Ações Requeridas</AlertTitle>
                                            <AlertDescription>
                                                Para receber o pagamento, por favor, anexe a nota fiscal e preencha as informações de pagamento abaixo.
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                    <div className="space-y-2">
                                        <Label htmlFor="nf-file" className="font-medium">Nota Fiscal (XML ou PDF)</Label>
                                        <Input id="nf-file" type="file" accept=".pdf,.xml" onChange={(e) => setNfFile(e.target.files ? e.target.files[0] : null)} required />
                                        {nfFile && <p className="text-sm text-muted-foreground flex items-center gap-2"><FileIcon className="h-4 w-4" />{nfFile.name}</p>}
                                    </div>

                                    <Separator />

                                    <div className="space-y-4">
                                        <h4 className="font-medium">Informações de Pagamento</h4>
                                        <div className="space-y-2">
                                            <Label htmlFor="payment-method-select">Forma de Pagamento</Label>
                                            <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
                                                <SelectTrigger id="payment-method-select">
                                                    <SelectValue placeholder="Selecione como deseja receber" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Boleto">Boleto</SelectItem>
                                                    <SelectItem value="PIX">PIX</SelectItem>
                                                    <SelectItem value="Transferência">Transferência</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        
                                        {selectedPaymentMethod === 'Boleto' && (
                                            <Card>
                                                <CardHeader className="p-4">
                                                    <CardTitle className="text-base">Boletos</CardTitle>
                                                    <CardDescription className="text-xs">Selecione o número de parcelas e anexe cada boleto com sua data de vencimento.</CardDescription>
                                                </CardHeader>
                                                <CardContent className="space-y-4 p-4 pt-0">
                                                    <div className="w-full sm:w-1/3">
                                                        <Label htmlFor={`installments-select-${selectedOrder.id}`}>Número de Parcelas</Label>
                                                        <Select
                                                            onValueChange={(value) => updateInstallments(parseInt(value), orderTotal)}
                                                            defaultValue="1"
                                                        >
                                                            <SelectTrigger id={`installments-select-${selectedOrder.id}`}><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                                            <SelectContent>
                                                                {[...Array(12).keys()].map(i => <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}x</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {installments.map((inst, index) => (
                                                            <div key={inst.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2 border rounded-md">
                                                                <div className="sm:col-span-1 font-medium text-sm">{index + 1}</div>
                                                                <div className="sm:col-span-3">
                                                                    <Label className="text-xs text-muted-foreground">Vencimento</Label>
                                                                    <Popover open={installmentPopovers[inst.id]} onOpenChange={(isOpen) => setInstallmentPopovers(prev => ({ ...prev, [inst.id]: isOpen }))}>
                                                                        <PopoverTrigger asChild>
                                                                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !inst.dueDate && "text-muted-foreground")}>
                                                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                                                {inst.dueDate ? format(inst.dueDate, "dd/MM/yyyy") : <span>Selecione</span>}
                                                                            </Button>
                                                                        </PopoverTrigger>
                                                                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={inst.dueDate} onSelect={(date) => handleInstallmentDateChange(inst.id, date)} initialFocus /></PopoverContent>
                                                                    </Popover>
                                                                </div>
                                                                <div className="sm:col-span-2"><Label className="text-xs text-muted-foreground">Valor</Label><p className="font-medium h-10 flex items-center">R$ {installmentValue}</p></div>
                                                                <div className="sm:col-span-6 relative">
                                                                    <Label className="text-xs text-muted-foreground">Código de Barras</Label>
                                                                    <div className="flex items-center gap-1">
                                                                        <Input 
                                                                            value={inst.code ?? ''} 
                                                                            onChange={(e) => handleInstallmentCodeChange(inst.id, e.target.value)} 
                                                                            placeholder="Linha digitável" 
                                                                        />
                                                                        <Button variant="ghost" size="icon" type="button" onClick={() => handleCopyCode(inst.code)}><Copy className="h-4 w-4" /></Button>
                                                                    </div>
                                                                </div>
                                                                <div className="sm:col-span-12">
                                                                <Label className="text-xs text-muted-foreground">Anexo do Boleto</Label>
                                                                <div className="flex items-center gap-2">
                                                                    <Input type="file" accept=".pdf" className="text-xs flex-1" onChange={(e) => handleInstallmentFileChange(inst.id, e.target.files ? e.target.files[0] : null)} />
                                                                    {inst.previewUrl && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="secondary"
                                                                        size="sm"
                                                                        onClick={() => {
                                                                        setPdfPreviewUrl(inst.previewUrl);
                                                                        setIsPdfModalOpen(true);
                                                                        }}
                                                                    >
                                                                        Visualizar
                                                                    </Button>
                                                                    )}
                                                                </div>
                                                                {inst.file && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><FileIcon className="h-3 w-3" />{inst.file.name}</p>}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        )}

                                        {selectedPaymentMethod === 'PIX' && (
                                            <Card>
                                                <CardHeader className="p-4"><CardTitle className="text-base">Dados para PIX</CardTitle></CardHeader>
                                                <CardContent className="p-4 pt-0">
                                                    <Label htmlFor={`pix-${selectedOrder.id}`}>Sua Chave PIX</Label>
                                                    <Input id={`pix-${selectedOrder.id}`} value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="CNPJ, email, telefone..." />
                                                </CardContent>
                                            </Card>
                                        )}

                                        {selectedPaymentMethod === 'Transferência' && (
                                            <Card>
                                                <CardHeader className="p-4"><CardTitle className="text-base">Dados Bancários</CardTitle></CardHeader>
                                                <CardContent className="p-4 pt-0">
                                                    <Label htmlFor={`bank-info-${selectedOrder.id}`}>Seus Dados Bancários</Label>
                                                    <Textarea id={`bank-info-${selectedOrder.id}`} value={bankData} onChange={(e) => setBankData(e.target.value)} placeholder="Banco: XXX&#10;Agência: 0000&#10;Conta: 00000-0&#10;CNPJ: XX.XXX.XXX/0001-XX" rows={4} />
                                                </CardContent>
                                            </Card>
                                        )}
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={() => setSelectedOrder(null)}>Fechar</Button>
                                    <Button type="submit" disabled={isSubmitting}>
                                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Enviar Documentos
                                    </Button>
                                </DialogFooter>
                            </form>
                        ) : (
                             <div className="py-4 space-y-6 max-h-[70vh] overflow-y-auto pr-4">
                                <h4 className="font-medium">Itens do Pedido</h4>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Item</TableHead>
                                            <TableHead className="text-center">Qtd.</TableHead>
                                            <TableHead className="text-right">Valor Unit.</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedOrder.items.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell>{item.description}</TableCell>
                                                <TableCell className="text-center">{item.quantity}</TableCell>
                                                <TableCell className="text-right">R$ {item.value.toFixed(2)}</TableCell>
                                                <TableCell className="text-right">R$ {(item.quantity * item.value).toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>

                                <Separator />

                                <h4 className="font-medium">Documentos Enviados</h4>
                                <div className="space-y-4 rounded-md border p-4 bg-muted/50">
                                    <SentStatus action={selectedOrder.actions.nf.sent} actionName="Nota Fiscal" />
                                    <Separator />
                                    <SentStatus action={selectedOrder.actions.boleto.sent} actionName="Boleto(s)" />
                                </div>

                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setSelectedOrder(null)}>Fechar</Button>
                                </DialogFooter>
                            </div>
                        )}
                    </DialogContent>
                )}
            </Dialog>

             <Dialog open={isPdfModalOpen} onOpenChange={setIsPdfModalOpen}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Visualizador de Boleto</DialogTitle>
                        <DialogDescription>
                            Copie a linha digitável do boleto abaixo e cole no campo correspondente.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 py-4">
                        {pdfPreviewUrl ? (
                            <iframe
                                src={pdfPreviewUrl}
                                className="w-full h-full border rounded-md"
                                title="Visualizador de PDF"
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full bg-muted rounded-md">
                                <p className="text-muted-foreground">Não foi possível carregar o PDF.</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
