

'use client';

import { PageHeader, PageHeaderDescription, PageHeaderHeading } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { CalendarIcon, PlusCircle, Trash2, UploadCloud, AlertCircle, CheckCircle2, AlertTriangle, Send, FileCheck2, Clock, FileText, Copy, User, Search, Tags, ChevronsUpDown, Check, Loader2, Edit } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { db, app } from '@/firebase/config';
import { collection, query, where, getDocs, addDoc, serverTimestamp, Timestamp, QueryConstraint, doc, updateDoc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from "firebase/functions";
import { useUser } from '@/firebase/auth/use-user';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';


// --- Tipos ---
interface Company {
    id: string;
    name: string;
}
interface Supplier {
    id: string;
    name: string;
}
interface CostCenter {
    id: string;
    name: string;
}
interface Quote {
    id: string;
    supplierId: string;
    supplierName: string;
    product: string;
    date: string;
    unitPrice: number;
}
interface PurchaseItem {
    id: number;
    description: string;
    quantity: number;
    value: number;
}
interface ActionInfo {
    done: boolean;
    user?: string;
    date?: string;
}
interface DocumentAction {
    sent: ActionInfo;
    approved: ActionInfo;
}

interface PurchaseOrder {
    id: string;
    requester: string;
    supplierId?: string;
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
        boletos?: { url: string; name: string; dueDate: string | null; code?: string }[];
    };
    rejectionReason?: string;
}

interface CompletedOrder {
    id: string;
    supplier: string;
    date: string;
    total: number;
    paymentStatus: 'Pago' | 'Aguardando Pagamento';
}
interface Installment {
    id: number;
    dueDate?: Date;
    file?: File;
    code?: string;
}


// --- Dados de exemplo que serão substituídos ---
const initialPaymentMethods = [
    { value: 'boleto', label: 'Boleto' },
    { value: 'cartao-credito', label: 'Cartão de Crédito' },
    { value: 'pix', label: 'PIX' },
    { value: 'transferencia', label: 'Transferência' },
];
const initialOnlineCategories = [
    { value: 'materiais-escritorio', label: 'Materiais de Escritório' },
    { value: 'eletronicos', label: 'Eletrônicos' },
    { value: 'servicos-online', label: 'Serviços Online' },
    { value: 'outros', label: 'Outros' },
];


export default function ComprasPage() {
    const { toast } = useToast();
    const { user } = useUser();
    const clientName = typeof window !== 'undefined' ? localStorage.getItem('clientName') : null;

    // Estados dos dados do formulário
    const [companyId, setCompanyId] = useState('');
    const [costCenterId, setCostCenterId] = useState('');
    const [date, setDate] = useState<Date>();
    const [deliveryDate, setDeliveryDate] = useState<Date>();
    const [items, setItems] = useState<PurchaseItem[]>([ { id: 1, description: '', quantity: 1, value: 0 } ]);
    const [totalValue, setTotalValue] = useState(0);
    const [purchaseType, setPurchaseType] = useState('supplier');
    const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
    const [onlineStoreName, setOnlineStoreName] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('');
    const [installments, setInstallments] = useState<Installment[]>([]);
    const [numInstallments, setNumInstallments] = useState<number>(1);
    
    // Estados de controle da UI
    const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
    const [isQuoteSearchOpen, setIsQuoteSearchOpen] = useState(false);
    const [isSearchingQuotes, setIsSearchingQuotes] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [isLoadingCostCenters, setIsLoadingCostCenters] = useState(false);
    const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
    const [isDeliveryDatePopoverOpen, setIsDeliveryDatePopoverOpen] = useState(false);
    const [isEditDeliveryDatePopoverOpen, setIsEditDeliveryDatePopoverOpen] = useState(false);
    const [installmentPopovers, setInstallmentPopovers] = useState<Record<number, boolean>>({});

    // Estados para dados dinâmicos
    const [companies, setCompanies] = useState<Company[]>([]);
    const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [completedOrders, setCompletedOrders] = useState<PurchaseOrder[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredQuotes, setFilteredQuotes] = useState<Quote[]>([]);
    const [paymentMethods, setPaymentMethods] = useState(initialPaymentMethods);
    const [openPaymentMethod, setOpenPaymentMethod] = useState(false);
    const [newPaymentMethod, setNewPaymentMethod] = useState("");
    const [onlineCategories, setOnlineCategories] = useState(initialOnlineCategories);
    const [openOnlineCategory, setOpenOnlineCategory] = useState(false);
    const [onlineCategoryValue, setOnlineCategoryValue] = useState("");
    const [newOnlineCategory, setNewOnlineCategory] = useState("");

    // Quote Search Dialog States
    const [quoteSearchProduct, setQuoteSearchProduct] = useState('');
    const [quoteSearchDateFrom, setQuoteSearchDateFrom] = useState<Date | undefined>();
    const [quoteSearchDateTo, setQuoteSearchDateTo] = useState<Date | undefined>();
    const [quoteSearchSupplier, setQuoteSearchSupplier] = useState('');
    
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
    
                const rolesQuery = query(collection(db, 'clients', clientName, 'roles'), where('name', '==', userRole));
                const rolesSnapshot = await getDocs(rolesQuery);
                
                if (rolesSnapshot.empty) {
                    setTabPermissions({});
                    setIsLoadingPermissions(false);
                    return;
                }
                
                const roleData = rolesSnapshot.docs[0].data();
                const comprasPermission = roleData.permissions?.compras;
    
                if (comprasPermission && typeof comprasPermission === 'object' && comprasPermission.tabs) {
                    setTabPermissions(comprasPermission.tabs);
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


    const fetchPurchaseOrders = async () => {
        if (!clientName) return;
        setIsLoadingData(true);
        try {
            const collectionRef = collection(db, "clients", clientName, "purchaseOrders");
            const qOpen = query(collectionRef, where("status", "!=", "Concluído"));
            const qCompleted = query(collectionRef, where("status", "==", "Concluído"));
    
            const [openSnapshot, completedSnapshot] = await Promise.all([
                getDocs(qOpen),
                getDocs(qCompleted)
            ]);
            
            const openOrdersData = openSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseOrder));
            setPurchaseOrders(openOrdersData);
    
            const completedOrdersData = completedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseOrder));
            setCompletedOrders(completedOrdersData);
    
        } catch (error) {
            console.error("Erro ao buscar ordens de compra:", error);
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar as ordens de compra.' });
        } finally {
            setIsLoadingData(false);
        }
    };

    // Carregar dados iniciais
    useEffect(() => {
        if (!clientName) return;

        const fetchInitialData = async () => {
            setIsLoadingData(true);
            try {
                // Fetch Companies
                const companiesQuery = query(collection(db, 'clients', clientName, 'companies'));
                const companiesSnapshot = await getDocs(companiesQuery);
                const companiesData = companiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Company[];
                setCompanies(companiesData);

                // Fetch Suppliers
                const suppliersQuery = query(collection(db, "clients", clientName, "suppliers"), where("status", "==", "Ativo"));
                const suppliersSnapshot = await getDocs(suppliersQuery);
                const suppliersData = suppliersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Supplier[];
                setSuppliers(suppliersData);

                // Fetch Purchase Orders
                await fetchPurchaseOrders();
            } catch (error) {
                console.error("Erro ao buscar dados iniciais:", error);
                toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar empresas e fornecedores.' });
            } finally {
                setIsLoadingData(false);
            }
        };
        fetchInitialData();
    }, [clientName, toast]);

    useEffect(() => {
        const fetchCostCenters = async () => {
            if (!clientName || !companyId) {
                setCostCenters([]);
                setCostCenterId('');
                return;
            }
            setIsLoadingCostCenters(true);
            try {
                const q = query(collection(db, 'clients', clientName, 'companies', companyId, 'costCenters'));
                const querySnapshot = await getDocs(q);
                const centersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CostCenter[];
                setCostCenters(centersData);
                setCostCenterId(''); // Reset selection when company changes
            } catch (error) {
                toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os centros de custo.' });
            } finally {
                setIsLoadingCostCenters(false);
            }
        };

        fetchCostCenters();
    }, [clientName, companyId, toast]);
    

    const bestPrice = useMemo(() => {
        if (filteredQuotes.length === 0) return null;
        return Math.min(...filteredQuotes.map(q => q.unitPrice));
    }, [filteredQuotes]);

    const handleSearchQuotes = async () => {
        if (!clientName) {
            setFilteredQuotes([]);
            return;
        }
        setIsSearchingQuotes(true);
        try {
            const constraints: QueryConstraint[] = [where("clientId", "==", clientName)];

            if (quoteSearchProduct.trim() !== '') {
                constraints.push(where("product", ">=", quoteSearchProduct.toLowerCase()));
                constraints.push(where("product", "<=", quoteSearchProduct.toLowerCase() + '\uf8ff'));
            }
            if (quoteSearchSupplier) {
                constraints.push(where("supplierId", "==", quoteSearchSupplier));
            }
            if (quoteSearchDateFrom) {
                constraints.push(where("date", ">=", format(quoteSearchDateFrom, 'yyyy-MM-dd')));
            }
            if (quoteSearchDateTo) {
                constraints.push(where("date", "<=", format(quoteSearchDateTo, 'yyyy-MM-dd')));
            }

            const q = query(collection(db, "clients", clientName, "quotes"), ...constraints);
            const querySnapshot = await getDocs(q);
            const results = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quote));
            setFilteredQuotes(results);
        } catch (error) {
            console.error("Error searching quotes: ", error);
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível realizar a busca de cotações." });
        } finally {
            setIsSearchingQuotes(false);
        }
    };

    const handleSelectQuote = (quote: Quote) => {
        setItems(prevItems => {
            const newItems = [...prevItems];
            if (newItems.length === 1 && newItems[0].description === '' && newItems[0].value === 0) {
                 newItems[0] = { ...newItems[0], description: quote.product, value: quote.unitPrice, quantity: 1 };
            } else {
                newItems.push({ id: Date.now(), description: quote.product, value: quote.unitPrice, quantity: 1 });
            }
            return newItems;
        });

        const isRegisteredSupplier = suppliers.some(s => s.id === quote.supplierId);
        
        if (isRegisteredSupplier) {
            setPurchaseType('supplier');
            setSelectedSupplierId(quote.supplierId);
        } else {
            setPurchaseType('online');
            setOnlineStoreName(quote.supplierName);
        }

        setIsQuoteSearchOpen(false);
    };

    const resetForm = () => {
        setCompanyId('');
        setCostCenterId('');
        setDate(undefined);
        setDeliveryDate(undefined);
        setItems([{ id: 1, description: '', quantity: 1, value: 0 }]);
        setPurchaseType('supplier');
        setSelectedSupplierId('');
        setOnlineStoreName('');
        setPaymentMethod('');
        setNumInstallments(1);
    };

    const handleSavePurchaseOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!clientName || !companyId || !date || !deliveryDate || !paymentMethod || items.some(i => !i.description || i.quantity <= 0 || i.value <= 0)) {
            toast({ variant: 'destructive', title: 'Campos Incompletos', description: 'Por favor, preencha todos os campos obrigatórios da ordem de compra.' });
            return;
        }
        setIsSubmitting(true);

        let supplierName = '';
        let supplierId: string | undefined = undefined;
        if (purchaseType === 'supplier') {
            supplierName = suppliers.find(s => s.id === selectedSupplierId)?.name || 'N/A';
            supplierId = selectedSupplierId;
        } else {
            supplierName = onlineStoreName;
        }

        try {
            const newOrder: Omit<PurchaseOrder, 'id' | 'createdAt'> = {
                clientId: clientName,
                companyId,
                costCenterId: costCenterId || '',
                requester: user?.displayName || user?.email || "Usuário Desconhecido",
                date: format(date, 'yyyy-MM-dd'),
                deliveryDate: format(deliveryDate, 'yyyy-MM-dd'),
                items: items.map(({ id, ...rest }) => rest),
                total: totalValue,
                status: 'Aguardando Documentos',
                purchaseType,
                supplierId: supplierId,
                supplierName,
                paymentMethod,
                onlineStoreName: purchaseType === 'online' ? onlineStoreName : '',
                onlineStoreCategory: purchaseType === 'online' ? onlineCategoryValue : '',
                actions: {
                    nf: { sent: { done: false }, approved: { done: false } },
                    boleto: { sent: { done: false }, approved: { done: false } },
                    entrega: { done: false },
                },
            };

            await addDoc(collection(db, "clients", clientName, "purchaseOrders"), {
                ...newOrder,
                createdAt: serverTimestamp(),
            });

            toast({ title: "Sucesso!", description: "Ordem de compra criada com sucesso.", className: "bg-accent text-accent-foreground" });
            resetForm();
            fetchPurchaseOrders(); // Refresh the list

        } catch (error) {
            console.error("Erro ao salvar ordem de compra: ", error);
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível salvar a ordem de compra." });
        } finally {
            setIsSubmitting(false);
        }
    };


    useEffect(() => {
        const newTotal = items.reduce((acc, item) => acc + (item.quantity * item.value), 0);
        setTotalValue(newTotal);
        updateInstallments(numInstallments, newTotal);
    }, [items, numInstallments]);

    useEffect(() => {
        if (paymentMethod === 'boleto') {
            updateInstallments(1, totalValue);
        } else {
            setInstallments([]);
        }
    }, [paymentMethod, totalValue]);


    const addItem = () => {
        setItems([...items, { id: Date.now(), description: '', quantity: 1, value: 0 }]);
    };

    const removeItem = (id: number) => {
        setItems(items.filter(item => item.id !== id));
    };

    const handleItemChange = (id: number, field: keyof PurchaseItem, fieldValue: string | number) => {
        setItems(items.map(item => {
            if (item.id === id) {
                const numericValue = (field === 'quantity' || field === 'value')
                    ? Number(fieldValue)
                    : fieldValue;
                return { ...item, [field]: numericValue };
            }
            return item;
        }));
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

    const updateInstallments = (count: number, total: number) => {
        setNumInstallments(count);
        const newInstallments: Installment[] = [];
        for (let i = 1; i <= count; i++) {
            newInstallments.push({ id: i, code: '' });
        }
        setInstallments(newInstallments);
    };

    const handleInstallmentDateChange = (installmentId: number, date?: Date) => {
        setInstallments(prev => prev.map(inst => inst.id === installmentId ? { ...inst, dueDate: date } : inst));
        setInstallmentPopovers(prev => ({...prev, [installmentId]: false}));
    };

    const handleInstallmentCodeChange = (installmentId: number, code: string) => {
        setInstallments(prev => prev.map(inst => inst.id === installmentId ? { ...inst, code } : inst));
    };

    const installmentValue = totalValue > 0 && numInstallments > 0 ? (totalValue / numInstallments).toFixed(2) : '0.00';

    const handleConfirmDelivery = async () => {
        if (!selectedOrder || !clientName) return;
        setIsSubmitting(true);
        try {
            const orderRef = doc(db, "clients", clientName, "purchaseOrders", selectedOrder.id);
            const updatedActions = {
                ...selectedOrder.actions,
                entrega: {
                    done: true,
                    user: user?.displayName || user?.email || 'N/A',
                    date: format(new Date(), 'dd/MM/yyyy HH:mm')
                }
            };
            await updateDoc(orderRef, { actions: updatedActions, status: 'Aguardando Aprovação' });
            
            // Update local state
            const updatedOrder = { ...selectedOrder, actions: updatedActions, status: 'Aguardando Aprovação' as const };
            setSelectedOrder(updatedOrder);
            setPurchaseOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));

            toast({ title: "Entrega Confirmada!", description: "O recebimento da mercadoria foi registrado.", className: "bg-accent text-accent-foreground" });
        } catch (error) {
            toast({ variant: 'destructive', title: "Erro", description: "Não foi possível confirmar a entrega." });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreatePaymentMethod = () => {
        if (newPaymentMethod) {
            const newValue = newPaymentMethod.toLowerCase().replace(/\s+/g, '-');
            const newItem = { value: newValue, label: newPaymentMethod };
            setPaymentMethods([...paymentMethods, newItem]);
            setPaymentMethod(newValue);
            setNewPaymentMethod('');
            setOpenPaymentMethod(false);
        }
    };

    const handleCreateOnlineCategory = () => {
        if (newOnlineCategory) {
            const newValue = newOnlineCategory.toLowerCase().replace(/\s+/g, '-');
            const newItem = { value: newValue, label: newOnlineCategory };
            setOnlineCategories([...onlineCategories, newItem]);
            setOnlineCategoryValue(newValue);
            setNewOnlineCategory('');
            setOpenOnlineCategory(false);
        }
    };

    const handleDeleteCategory = (
      e: React.MouseEvent,
      valueToDelete: string,
      type: 'payment' | 'online'
    ) => {
      e.stopPropagation();
      e.preventDefault();
    
      if (type === 'payment') {
        setPaymentMethods(prev => prev.filter(pm => pm.value !== valueToDelete));
        if (paymentMethod === valueToDelete) {
          setPaymentMethod('');
        }
      } else {
        setOnlineCategories(prev => prev.filter(c => c.value !== valueToDelete));
        if (onlineCategoryValue === valueToDelete) {
          setOnlineCategoryValue('');
        }
      }
    
      toast({
        title: "Categoria Removida",
        description: "A categoria foi removida da lista.",
      });
    };

    // --- Funções para edição no modal ---
    const handleSelectedItemChange = (index: number, field: 'description' | 'quantity' | 'value', value: string | number) => {
        if (!selectedOrder) return;
        const newItems = [...selectedOrder.items];
        // @ts-ignore
        newItems[index][field] = value;
        const newTotal = newItems.reduce((acc, item) => acc + (Number(item.quantity) * Number(item.value)), 0);
        setSelectedOrder(prev => prev ? { ...prev, items: newItems, total: newTotal } : null);
    };
    
    const addItemToSelectedOrder = () => {
        if (!selectedOrder) return;
        const newItems = [...selectedOrder.items, { description: '', quantity: 1, value: 0 }];
        setSelectedOrder(prev => prev ? { ...prev, items: newItems } : null);
    };
    
    const removeItemFromSelectedOrder = (index: number) => {
        if (!selectedOrder) return;
        const newItems = selectedOrder.items.filter((_, i) => i !== index);
        const newTotal = newItems.reduce((acc, item) => acc + (Number(item.quantity) * Number(item.value)), 0);
        setSelectedOrder(prev => prev ? { ...prev, items: newItems, total: newTotal } : null);
    };
    
    const handleUpdatePurchaseOrder = async () => {
        if (!selectedOrder || !clientName) return;
        setIsSubmitting(true);
        try {
            const orderRef = doc(db, "clients", clientName, "purchaseOrders", selectedOrder.id);
            const { id, createdAt, ...dataToUpdate } = selectedOrder;
    
            await updateDoc(orderRef, {
                ...dataToUpdate,
                date: typeof dataToUpdate.date === 'string' ? dataToUpdate.date : format(new Date(dataToUpdate.date), 'yyyy-MM-dd'),
                deliveryDate: typeof dataToUpdate.deliveryDate === 'string' ? dataToUpdate.deliveryDate : format(new Date(dataToUpdate.deliveryDate), 'yyyy-MM-dd'),
            });
            
            toast({ title: "Sucesso!", description: "Ordem de compra atualizada.", className: "bg-accent text-accent-foreground" });
            
            fetchPurchaseOrders();
            setSelectedOrder(null);
    
        } catch (error) {
            console.error("Error updating purchase order:", error);
            toast({ variant: 'destructive', title: "Erro", description: "Não foi possível atualizar a ordem de compra." });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDeletePurchaseOrder = async () => {
        if (!selectedOrder || !clientName) return;

        setIsSubmitting(true);
        const functions = getFunctions(app, 'southamerica-east1');
        const deletePurchaseOrderFn = httpsCallable(functions, 'deletePurchaseOrder');

        try {
            const result = await deletePurchaseOrderFn({ clientId: clientName, purchaseOrderId: selectedOrder.id });

            if ((result.data as any).success) {
                toast({
                    title: "Ordem de Compra Excluída!",
                    description: `O pedido ${selectedOrder.id.substring(0,8)} foi removido com sucesso.`,
                });
                setSelectedOrder(null);
                fetchPurchaseOrders(); // Refresh the list
            } else {
                throw new Error((result.data as any).message || "A função de exclusão retornou um erro.");
            }
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Erro ao Excluir",
                description: error.message || "Não foi possível remover a ordem de compra.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };


    const ActionLog = ({ action, actionName, actorType = 'Aprovado' }: { action: ActionInfo, actionName: string, actorType?: string }) => {
        if (!action.done) {
            return (
                <div className="flex items-center justify-between w-full">
                    <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Clock className="h-4 w-4" /> {actionName}
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

    const hasDelayedOrders = purchaseOrders.some(order => order.status === 'Entrega Atrasada');

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
                <PageHeaderHeading>Gestão de Compras</PageHeaderHeading>
                <PageHeaderDescription>
                    Crie, acompanhe e gerencie as ordens de compra da sua empresa.
                </PageHeaderDescription>
            </PageHeader>

            <Tabs defaultValue="nova-ordem" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    {(tabPermissions?.['nova-ordem'] !== false) && <TabsTrigger value="nova-ordem">Nova Ordem de Compra</TabsTrigger> }
                    {(tabPermissions?.['acompanhamento'] !== false) && 
                        <TabsTrigger value="acompanhamento" className="relative">
                            Acompanhamento
                            {hasDelayedOrders && (
                                <span className="absolute top-1 right-2 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
                                </span>
                            )}
                        </TabsTrigger>
                    }
                    {(tabPermissions?.['historico'] !== false) && <TabsTrigger value="historico">Histórico</TabsTrigger> }
                </TabsList>
                
                {(tabPermissions?.['nova-ordem'] !== false) && 
                <TabsContent value="nova-ordem">
                    <form onSubmit={handleSavePurchaseOrder}>
                    <Card>
                        <CardHeader>
                            <CardTitle>Nova Ordem de Compra</CardTitle>
                            <CardDescription>Preencha os detalhes abaixo para criar uma nova ordem de compra.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                             <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="purchase-company">Empresa</Label>
                                    <Select value={companyId} onValueChange={setCompanyId} required>
                                        <SelectTrigger id="purchase-company">
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
                                    <Label htmlFor="cost-center">Centro de Custo</Label>
                                    <Select value={costCenterId} onValueChange={setCostCenterId} disabled={!companyId || isLoadingCostCenters}>
                                        <SelectTrigger id="cost-center">
                                            <SelectValue placeholder={isLoadingCostCenters ? "Carregando..." : "Selecione o centro de custo"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {costCenters.length > 0 ? (
                                                costCenters.map(center => (
                                                    <SelectItem key={center.id} value={center.id}>{center.name}</SelectItem>
                                                ))
                                            ) : (
                                                <p className="p-2 text-xs text-muted-foreground">Nenhum centro de custo.</p>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            
                            <Separator />

                            <div className="space-y-2">
                                <Label>Tipo de Compra</Label>
                                <RadioGroup value={purchaseType} onValueChange={setPurchaseType} className="flex items-center gap-4">
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="supplier" id="r-supplier" />
                                        <Label htmlFor="r-supplier">Fornecedor Cadastrado</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="online" id="r-online" />
                                        <Label htmlFor="r-online">Compra Online/Avulsa</Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                {purchaseType === 'supplier' ? (
                                    <div className="space-y-2">
                                        <Label htmlFor="supplier">Fornecedor</Label>
                                        <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                                            <SelectTrigger id="supplier">
                                                <SelectValue placeholder="Selecione o fornecedor" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {suppliers.map(supplier => (
                                                    <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ) : (
                                    <>
                                        <div className="space-y-2">
                                            <Label htmlFor="online-store">Nome da Loja</Label>
                                            <Input id="online-store" placeholder="Ex: Amazon, Loja Local" value={onlineStoreName} onChange={e => setOnlineStoreName(e.target.value)} />
                                        </div>
                                         <div className="space-y-2">
                                            <Label htmlFor="online-category">Categoria</Label>
                                            <Popover open={openOnlineCategory} onOpenChange={setOpenOnlineCategory}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    aria-expanded={openOnlineCategory}
                                                    className="w-full justify-between"
                                                    >
                                                    {onlineCategoryValue
                                                        ? onlineCategories.find((c) => c.value === onlineCategoryValue)?.label
                                                        : "Selecione a categoria"}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-full p-0">
                                                    <Command>
                                                    <CommandInput 
                                                        placeholder="Buscar ou criar categoria..." 
                                                        value={newOnlineCategory}
                                                        onValueChange={setNewOnlineCategory}
                                                    />
                                                    <CommandList>
                                                        <CommandEmpty>
                                                            <Button variant="link" onClick={handleCreateOnlineCategory}>
                                                                Criar nova categoria: "{newOnlineCategory}"
                                                            </Button>
                                                        </CommandEmpty>
                                                        <CommandGroup>
                                                            {onlineCategories.map((c) => (
                                                            <CommandItem
                                                                key={c.value}
                                                                value={c.label}
                                                                onSelect={() => {
                                                                    setOnlineCategoryValue(c.value === onlineCategoryValue ? "" : c.value);
                                                                    setOpenOnlineCategory(false);
                                                                }}
                                                                className="flex justify-between"
                                                            >
                                                                <div>
                                                                    <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        onlineCategoryValue === c.value ? "opacity-100" : "opacity-0"
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
                                                                            <AlertDialogAction onClick={(e) => handleDeleteCategory(e, c.value, 'online')}>Excluir</AlertDialogAction>
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
                                    </>
                                )}
                            </div>

                            <Separator />

                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <Label>Itens da Compra</Label>
                                     <Dialog open={isQuoteSearchOpen} onOpenChange={setIsQuoteSearchOpen}>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="sm">
                                                <Tags className="mr-2 h-4 w-4" />
                                                Buscar Cotação
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-4xl">
                                            <DialogHeader>
                                                <DialogTitle>Buscar Produto em Cotações</DialogTitle>
                                                <DialogDescription>
                                                    Pesquise por um produto para ver o histórico de preços e adicioná-lo à sua compra.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="py-4 space-y-4">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                                                    <div className="lg:col-span-2 space-y-2">
                                                        <Label htmlFor="search-quote-product" className="text-xs">Produto ou Serviço</Label>
                                                        <Input
                                                            id="search-quote-product"
                                                            placeholder="Digite o nome do item..."
                                                            value={quoteSearchProduct}
                                                            onChange={(e) => setQuoteSearchProduct(e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="search-quote-supplier" className="text-xs">Fornecedor</Label>
                                                        <Select value={quoteSearchSupplier} onValueChange={setQuoteSearchSupplier}>
                                                            <SelectTrigger id="search-quote-supplier">
                                                                <SelectValue placeholder="Todos" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <Button onClick={handleSearchQuotes} disabled={isSearchingQuotes}>
                                                        {isSearchingQuotes ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                                                        Buscar
                                                    </Button>
                                                    <div className="space-y-2">
                                                        <Label className="text-xs">Período (De)</Label>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !quoteSearchDateFrom && "text-muted-foreground")}>
                                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                                    {quoteSearchDateFrom ? format(quoteSearchDateFrom, "dd/MM/yyyy") : <span>Selecione</span>}
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={quoteSearchDateFrom} onSelect={setQuoteSearchDateFrom} /></PopoverContent>
                                                        </Popover>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-xs">Período (Até)</Label>
                                                         <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !quoteSearchDateTo && "text-muted-foreground")}>
                                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                                    {quoteSearchDateTo ? format(quoteSearchDateTo, "dd/MM/yyyy") : <span>Selecione</span>}
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={quoteSearchDateTo} onSelect={setQuoteSearchDateTo} /></PopoverContent>
                                                        </Popover>
                                                    </div>
                                                </div>
                                                {isSearchingQuotes ? (
                                                     <div className="flex justify-center items-center h-24">
                                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                                    </div>
                                                ) : filteredQuotes.length > 0 ? (
                                                    <div className="border-t pt-4">
                                                        <h3 className="text-sm font-medium text-primary mb-2">Resultados para "{quoteSearchProduct}"</h3>
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead>Fornecedor</TableHead>
                                                                    <TableHead>Data</TableHead>
                                                                    <TableHead className="text-right">Preço Unit.</TableHead>
                                                                    <TableHead className="w-[100px]"></TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {filteredQuotes.map((quote) => (
                                                                    <TableRow key={quote.id} className={cn(quote.unitPrice === bestPrice && 'bg-accent/50')}>
                                                                        <TableCell className="font-medium">{quote.supplierName}</TableCell>
                                                                        <TableCell>{format(new Date(quote.date), 'dd/MM/yyyy')}</TableCell>
                                                                        <TableCell className={cn("text-right font-semibold", quote.unitPrice === bestPrice && 'text-green-600')}>
                                                                            R$ {quote.unitPrice.toFixed(2)}
                                                                        </TableCell>
                                                                        <TableCell className="text-right">
                                                                            <Button size="sm" onClick={() => handleSelectQuote(quote)}>Selecionar</Button>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                ) : (
                                                    (quoteSearchProduct || quoteSearchSupplier) && <p className="text-center text-sm text-muted-foreground pt-4">Nenhum resultado encontrado.</p>
                                                )}
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                </div>

                                {items.map((item, index) => (
                                    <div key={item.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end p-2 border rounded-lg">
                                        <div className="sm:col-span-6 space-y-1">
                                            {index === 0 && <Label htmlFor={`desc-${item.id}`} className="text-xs text-muted-foreground">Descrição do Item</Label>}
                                            <Input
                                                id={`desc-${item.id}`}
                                                placeholder="Ex: Teclado sem fio"
                                                value={item.description}
                                                onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                                            />
                                        </div>
                                        <div className="sm:col-span-2 space-y-1">
                                            {index === 0 && <Label htmlFor={`qty-${item.id}`} className="text-xs text-muted-foreground">Qtde.</Label>}
                                            <Input
                                                id={`qty-${item.id}`}
                                                type="number"
                                                placeholder="1"
                                                value={item.quantity}
                                                onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                                            />
                                        </div>
                                        <div className="sm:col-span-2 space-y-1">
                                            {index === 0 && <Label htmlFor={`val-${item.id}`} className="text-xs text-muted-foreground">Valor (R$)</Label>}
                                            <Input
                                                id={`val-${item.id}`}
                                                type="number"
                                                placeholder="150,00"
                                                value={item.value}
                                                onChange={(e) => handleItemChange(item.id, 'value', e.target.value)}
                                            />
                                        </div>
                                        <div className="sm:col-span-2 flex items-center justify-end gap-2">
                                            <span className="text-sm font-medium w-full text-center sm:text-right">
                                                R$ {(item.quantity * item.value).toFixed(2)}
                                            </span>
                                            {items.length > 1 && (
                                                <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                <Button variant="outline" size="sm" onClick={addItem}>
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Adicionar Item
                                </Button>
                            </div>

                            <Separator />

                            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
                                <div className="space-y-2">
                                    <Label htmlFor="purchase-date">Data da Compra</Label>
                                    <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full justify-start text-left font-normal",
                                                    !date && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {date ? format(date, "dd/MM/yyyy") : <span>Selecione a data</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar
                                                mode="single"
                                                selected={date}
                                                onSelect={(day) => { setDate(day); setIsDatePopoverOpen(false); }}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="delivery-date">Prazo de Entrega</Label>
                                    <Popover open={isDeliveryDatePopoverOpen} onOpenChange={setIsDeliveryDatePopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full justify-start text-left font-normal",
                                                    !deliveryDate && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {deliveryDate ? format(deliveryDate, "dd/MM/yyyy") : <span>Selecione a data</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar
                                                mode="single"
                                                selected={deliveryDate}
                                                onSelect={(day) => { setDeliveryDate(day); setIsDeliveryDatePopoverOpen(false); }}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="payment-method">Forma de Pagamento</Label>
                                    <Popover open={openPaymentMethod} onOpenChange={setOpenPaymentMethod}>
                                        <PopoverTrigger asChild>
                                            <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openPaymentMethod}
                                            className="w-full justify-between"
                                            >
                                            {paymentMethod
                                                ? paymentMethods.find((pm) => pm.value === paymentMethod)?.label
                                                : "Selecione..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-full p-0">
                                            <Command>
                                                <CommandInput 
                                                    placeholder="Buscar ou criar forma..." 
                                                    value={newPaymentMethod}
                                                    onValueChange={setNewPaymentMethod}
                                                />
                                                <CommandList>
                                                    <CommandEmpty>
                                                        <Button variant="link" onClick={handleCreatePaymentMethod}>
                                                            Criar nova forma: "{newPaymentMethod}"
                                                        </Button>
                                                    </CommandEmpty>
                                                    <CommandGroup>
                                                        {paymentMethods.map((pm) => (
                                                            <CommandItem
                                                                key={pm.value}
                                                                value={pm.label}
                                                                onSelect={() => {
                                                                    setPaymentMethod(pm.value === paymentMethod ? "" : pm.value);
                                                                    setOpenPaymentMethod(false);
                                                                }}
                                                                className="flex justify-between"
                                                            >
                                                                <div>
                                                                    <Check className={cn("mr-2 h-4 w-4", paymentMethod === pm.value ? "opacity-100" : "opacity-0")} />
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
                                <div className="flex flex-col items-end gap-2 text-right">
                                    <span className="text-sm text-muted-foreground">Valor Total da Compra</span>
                                    <p className="text-2xl font-bold">R$ {totalValue.toFixed(2)}</p>
                                </div>
                            </div>

                            {purchaseType === 'online' && (
                                <>
                                    <Separator />
                                    <div className="space-y-4">
                                        <Label>Documentos e Dados de Pagamento</Label>
                                        <div className="space-y-6">
                                            <Card className="flex flex-col">
                                                <CardHeader>
                                                    <CardTitle className="text-base">Nota Fiscal</CardTitle>
                                                    <CardDescription className="text-xs">Anexe a nota fiscal (XML ou PDF).</CardDescription>
                                                </CardHeader>
                                                <CardContent className="flex-grow flex items-center justify-center">
                                                    <Button variant="outline" className="w-full">
                                                        <UploadCloud className="mr-2 h-4 w-4" />
                                                        Anexar Nota Fiscal
                                                    </Button>
                                                </CardContent>
                                            </Card>

                                            {paymentMethod === 'boleto' && (
                                                <Card>
                                                     <CardHeader>
                                                        <CardTitle className="text-base">Boletos</CardTitle>
                                                        <CardDescription className="text-xs">Selecione o número de parcelas e anexe cada boleto com sua data de vencimento.</CardDescription>
                                                    </CardHeader>
                                                    <CardContent className="space-y-4">
                                                        <div className="w-full sm:w-1/3">
                                                            <Label htmlFor="installments-select-online">Número de Parcelas</Label>
                                                            <Select
                                                                onValueChange={(value) => updateInstallments(parseInt(value), totalValue)}
                                                                defaultValue="1"
                                                            >
                                                                <SelectTrigger id="installments-select-online">
                                                                    <SelectValue placeholder="Selecione..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {Array.from({ length: 12 }, (_, i) => i).map(i => (
                                                                        <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}x</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        
                                                        <div className="space-y-2">
                                                            {installments.map((inst, index) => (
                                                                <div key={inst.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2 border rounded-md">
                                                                    <div className="sm:col-span-1 font-medium text-sm">
                                                                        {index + 1}
                                                                    </div>
                                                                    <div className="sm:col-span-2">
                                                                        <Label className="text-xs text-muted-foreground">Vencimento</Label>
                                                                        <Popover open={installmentPopovers[inst.id]} onOpenChange={(isOpen) => setInstallmentPopovers(prev => ({...prev, [inst.id]: isOpen}))}>
                                                                            <PopoverTrigger asChild>
                                                                                <Button
                                                                                    variant={"outline"}
                                                                                    className={cn("w-full justify-start text-left font-normal", !inst.dueDate && "text-muted-foreground")}
                                                                                >
                                                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                                                    {inst.dueDate ? format(inst.dueDate, "dd/MM/yyyy") : <span>Selecione</span>}
                                                                                </Button>
                                                                            </PopoverTrigger>
                                                                            <PopoverContent className="w-auto p-0">
                                                                                <Calendar mode="single" selected={inst.dueDate} onSelect={(date) => handleInstallmentDateChange(inst.id, date)} initialFocus />
                                                                            </PopoverContent>
                                                                        </Popover>
                                                                    </div>
                                                                    <div className="sm:col-span-2">
                                                                        <Label className="text-xs text-muted-foreground">Valor</Label>
                                                                        <p className="font-medium h-10 flex items-center">R$ {installmentValue}</p>
                                                                    </div>
                                                                    <div className="sm:col-span-4">
                                                                        <Label className="text-xs text-muted-foreground">Código do Boleto</Label>
                                                                        <div className="flex items-center gap-2">
                                                                            <Input value={inst.code ?? ''} onChange={(e) => handleInstallmentCodeChange(inst.id, e.target.value)} placeholder="Linha digitável do boleto" />
                                                                            <Button variant="outline" size="icon" onClick={() => handleCopyCode(inst.code)}>
                                                                                <Copy className="h-4 w-4" />
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                    <div className="sm:col-span-3">
                                                                        <Label className="text-xs text-muted-foreground">Anexo</Label>
                                                                         <Button variant="outline" className="w-full">
                                                                            <UploadCloud className="mr-2 h-4 w-4" />
                                                                            Anexar
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                                </div>
                                                            </CardContent>
                                                        </Card>
                                                    )}

                                            {(paymentMethod === 'pix' || paymentMethod === 'transferencia') && (
                                                <Card>
                                                    <CardHeader>
                                                        <CardTitle className="text-base">Dados de Pagamento</CardTitle>
                                                        <CardDescription className="text-xs">
                                                            {paymentMethod === 'pix' ? 'Informe a chave PIX para o reembolso/pagamento.' : 'Informe a conta bancária para reembolso/pagamento.'}
                                                        </CardDescription>
                                                    </CardHeader>
                                                    <CardContent className="space-y-2">
                                                        {paymentMethod === 'pix' ? (
                                                            <div>
                                                                <Label htmlFor="pix-key">Chave PIX</Label>
                                                                <Input id="pix-key" placeholder="CNPJ, email, telefone..." />
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                <Textarea placeholder="Informe Banco, Agência, Conta..." rows={3} />
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            )}

                                        </div>
                                    </div>
                                </>
                            )}

                        </CardContent>
                        <CardFooter className="flex flex-col sm:flex-row items-start sm:items-center justify-end gap-4">
                            {purchaseType === 'supplier' && (
                                <div className="flex items-center space-x-2 mr-auto">
                                    <Checkbox id="notify-supplier" defaultChecked />
                                    <Label htmlFor="notify-supplier" className="text-sm font-normal text-muted-foreground">
                                        Notificar fornecedor por e-mail sobre esta nova ordem de compra.
                                    </Label>
                                </div>
                            )}
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar Ordem de Compra
                            </Button>
                        </CardFooter>
                    </Card>
                    </form>
                </TabsContent>
                }

                {(tabPermissions?.['acompanhamento'] !== false) && 
                <TabsContent value="acompanhamento">
                    <Card>
                        <CardHeader>
                            <CardTitle>Acompanhamento de Ordens</CardTitle>
                            <CardDescription>Valide documentos e aprove pagamentos das ordens de compra em aberto.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Pedido</TableHead>
                                        <TableHead>Fornecedor</TableHead>
                                        <TableHead>Solicitante</TableHead>
                                        <TableHead>Data</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Valor</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoadingData ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-24 text-center">
                                                <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                            </TableCell>
                                        </TableRow>
                                    ) : purchaseOrders.length > 0 ? (
                                        purchaseOrders.map(order => (
                                            <TableRow key={order.id} className={cn("cursor-pointer", order.status === 'Entrega Atrasada' && 'bg-destructive/10 hover:bg-destructive/20')} onClick={() => setSelectedOrder(order)}>
                                                <TableCell className="font-medium">{order.id.substring(0, 8)}...</TableCell>
                                                <TableCell>{order.supplierName}</TableCell>
                                                <TableCell>{order.requester}</TableCell>
                                                <TableCell>{format(new Date(order.date), 'dd/MM/yyyy')}</TableCell>
                                                <TableCell>
                                                    <Badge variant={order.status.includes('Atrasada') || order.status.includes('Documentos') || order.status === 'Reprovado' ? 'destructive' : 'secondary'}>
                                                        {order.status === 'Entrega Atrasada' && <AlertCircle className="mr-1 h-3 w-3" />}
                                                        {order.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">R$ {order.total.toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-24 text-center">
                                                Nenhuma ordem de compra pendente.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                            <Dialog open={!!selectedOrder} onOpenChange={(isOpen) => !isOpen && setSelectedOrder(null)}>
                                {selectedOrder && (() => {
                                    const nfSentAction = {
                                        ...selectedOrder.actions.nf.sent,
                                        done: !!selectedOrder.attachments?.nf?.url,
                                    };
                                    const boletoSentAction = {
                                        ...selectedOrder.actions.boleto.sent,
                                        done: !!selectedOrder.attachments?.boletos?.some(b => !!b.url),
                                    };
                                    
                                    return (
                                    <DialogContent className="max-w-4xl">
                                        <DialogHeader>
                                            <DialogTitle>Analisar / Editar Pedido: {selectedOrder.id.substring(0,8)}...</DialogTitle>
                                            <DialogDescription>
                                                Fornecedor: {selectedOrder.supplierName} | Prazo de Entrega: {format(new Date(selectedOrder.deliveryDate), 'dd/MM/yyyy')}
                                            </DialogDescription>
                                        </DialogHeader>
                                        
                                        <div className="py-6 space-y-6 max-h-[70vh] overflow-y-auto pr-4">
                                            {selectedOrder.status === 'Reprovado' && (
                                                <Alert variant="destructive">
                                                    <AlertTriangle className="h-4 w-4" />
                                                    <AlertTitle>Pedido Reprovado!</AlertTitle>
                                                    <AlertDescription>
                                                        <b>Motivo:</b> {selectedOrder.rejectionReason || 'Nenhum motivo informado.'}. O fornecedor foi notificado para reenviar os documentos.
                                                    </AlertDescription>
                                                </Alert>
                                            )}
                                            {selectedOrder.status === 'Entrega Atrasada' && (
                                                <Alert variant="destructive">
                                                    <AlertTriangle className="h-4 w-4" />
                                                    <AlertTitle>Entrega Atrasada!</AlertTitle>
                                                    <AlertDescription>
                                                        A entrega deste pedido não foi confirmada no prazo. Verifique com o fornecedor.
                                                    </AlertDescription>
                                                </Alert>
                                            )}

                                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                <div className="lg:col-span-2 space-y-4">
                                                    <Collapsible>
                                                        <div className="flex items-center justify-between">
                                                            <h5 className="font-medium">Itens do Pedido</h5>
                                                            <CollapsibleTrigger asChild>
                                                                <Button variant="ghost" size="sm">
                                                                    <Edit className="mr-2 h-4 w-4" /> Editar Pedido
                                                                </Button>
                                                            </CollapsibleTrigger>
                                                        </div>
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
                                                        <CollapsibleContent className="space-y-4 pt-4 data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                                                            <Separator/>
                                                            <h6 className="font-semibold">Editar Itens e Prazo</h6>
                                                            <div className="space-y-2">
                                                                <Label htmlFor="edit-delivery-date">Prazo de Entrega</Label>
                                                                <Popover open={isEditDeliveryDatePopoverOpen} onOpenChange={setIsEditDeliveryDatePopoverOpen}>
                                                                    <PopoverTrigger asChild>
                                                                        <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !selectedOrder.deliveryDate && "text-muted-foreground")}>
                                                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                                                            {selectedOrder.deliveryDate ? format(new Date(selectedOrder.deliveryDate), "dd/MM/yyyy") : <span>Selecione a data</span>}
                                                                        </Button>
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="w-auto p-0">
                                                                        <Calendar
                                                                            mode="single"
                                                                            selected={new Date(selectedOrder.deliveryDate)}
                                                                            onSelect={(day) => {
                                                                                if(day) setSelectedOrder(prev => prev ? { ...prev, deliveryDate: format(day, 'yyyy-MM-dd') } : null);
                                                                                setIsEditDeliveryDatePopoverOpen(false);
                                                                            }}
                                                                            initialFocus
                                                                        />
                                                                    </PopoverContent>
                                                                </Popover>
                                                            </div>
                                                            {selectedOrder.items.map((item, index) => (
                                                                <div key={index} className="grid grid-cols-12 gap-2 items-end p-2 border rounded-lg">
                                                                    <div className="col-span-6"><Input value={item.description} onChange={e => handleSelectedItemChange(index, 'description', e.target.value)} /></div>
                                                                    <div className="col-span-2"><Input type="number" value={item.quantity} onChange={e => handleSelectedItemChange(index, 'quantity', Number(e.target.value))} /></div>
                                                                    <div className="col-span-2"><Input type="number" value={item.value} onChange={e => handleSelectedItemChange(index, 'value', Number(e.target.value))} /></div>
                                                                    <div className="col-span-2 flex justify-end">
                                                                        <Button variant="ghost" size="icon" onClick={() => removeItemFromSelectedOrder(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                             <Button variant="outline" size="sm" onClick={addItemToSelectedOrder}><PlusCircle className="mr-2 h-4 w-4" /> Adicionar Item</Button>
                                                        </CollapsibleContent>
                                                    </Collapsible>
                                                    <Button onClick={handleConfirmDelivery} disabled={selectedOrder.actions.entrega.done || isSubmitting}>
                                                        {isSubmitting && selectedOrder.actions.entrega.done === false ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle2 className="mr-2"/>}
                                                        Confirmar Recebimento da Mercadoria
                                                    </Button>
                                                </div>
                                                <div className="space-y-4">
                                                    <h5 className="font-medium">Checklist de Aprovação</h5>
                                                     <div className="space-y-4 rounded-md border p-4">
                                                        <div className="space-y-3">
                                                            <h6 className="font-semibold text-sm flex items-center gap-2"><FileText className="h-4 w-4" /> Nota Fiscal</h6>
                                                            <div className="pl-4 space-y-3 text-xs">
                                                                <ActionLog action={nfSentAction} actionName="Enviada" actorType="Enviada" />
                                                                <ActionLog action={selectedOrder.actions.nf.approved} actionName="Aprovada" actorType="Aprovada" />
                                                                {selectedOrder.attachments?.nf?.url && (
                                                                    <Button asChild variant="outline" size="sm" className="w-full mt-2">
                                                                        <a href={selectedOrder.attachments.nf.url} target="_blank" rel="noopener noreferrer">
                                                                            <FileText className="mr-2 h-3 w-3" /> Ver Nota Fiscal
                                                                        </a>
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <Separator />
                                                        <div className="space-y-3">
                                                            <h6 className="font-semibold text-sm flex items-center gap-2"><FileText className="h-4 w-4" /> Boleto(s)</h6>
                                                            <div className="pl-4 space-y-3 text-xs">
                                                                <ActionLog action={boletoSentAction} actionName="Enviado" actorType="Enviado" />
                                                                <ActionLog action={selectedOrder.actions.boleto.approved} actionName="Aprovada" actorType="Aprovada" />
                                                                {selectedOrder.attachments?.boletos?.map((boleto, index) => boleto.url && (
                                                                     <Button asChild variant="outline" size="sm" className="w-full mt-1" key={index}>
                                                                        <a href={boleto.url} target="_blank" rel="noopener noreferrer">
                                                                            <FileText className="mr-2 h-3 w-3" /> Ver Boleto ({index + 1})
                                                                        </a>
                                                                    </Button>
                                                                ))}
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
                                                </div>
                                            </div>
                                        </div>
                                        <DialogFooter className="justify-between">
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="destructive" disabled={isSubmitting}>
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Excluir Pedido
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Esta ação não pode ser desfeita. O pedido <span className="font-bold">{selectedOrder.id.substring(0,8)}...</span> será permanentemente excluído.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={handleDeletePurchaseOrder}
                                                            className="bg-destructive hover:bg-destructive/90"
                                                            disabled={isSubmitting}
                                                        >
                                                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Sim, excluir permanentemente" }
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                            <div className="flex gap-2">
                                                <Button variant="outline" onClick={() => setSelectedOrder(null)}>Fechar</Button>
                                                <Button onClick={handleUpdatePurchaseOrder} disabled={isSubmitting}>
                                                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Edit className="h-4 w-4 mr-2"/>}
                                                    Salvar Alterações
                                                </Button>
                                            </div>
                                        </DialogFooter>
                                    </DialogContent>
                                )})()}
                            </Dialog>
                        </CardContent>
                    </Card>
                </TabsContent>
                }

                {(tabPermissions?.['historico'] !== false) && 
                <TabsContent value="historico">
                    <Card>
                        <CardHeader>
                            <CardTitle>Histórico de Compras</CardTitle>
                            <CardDescription>Consulte todas as ordens de compra finalizadas e seus status de pagamento.</CardDescription>
                        </CardHeader>
                        <CardContent>
                           <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Pedido</TableHead>
                                        <TableHead>Fornecedor</TableHead>
                                        <TableHead>Data</TableHead>
                                        <TableHead>Status do Pagamento</TableHead>
                                        <TableHead className="text-right">Valor</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoadingData ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-24 text-center">
                                                <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                            </TableCell>
                                        </TableRow>
                                    ) : completedOrders.length > 0 ? (
                                        completedOrders.map(order => (
                                            <TableRow key={order.id}>
                                                <TableCell className="font-medium">{order.id.substring(0,8)}...</TableCell>
                                                <TableCell>{order.supplierName}</TableCell>
                                                <TableCell>{format(new Date(order.date), 'dd/MM/yyyy')}</TableCell>
                                                <TableCell>
                                                    <Badge variant="default" className="bg-accent text-accent-foreground">
                                                        Pago
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">R$ {order.total.toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-24 text-center">
                                                Nenhuma ordem de compra concluída.
                                            </TableCell>
                                        </TableRow>
                                    )}
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
