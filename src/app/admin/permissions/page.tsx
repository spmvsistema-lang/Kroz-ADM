
'use client';

import { useState, useEffect } from 'react';
import { PageHeader, PageHeaderDescription, PageHeaderHeading } from '@/components/app/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    LayoutDashboard,
    Building2,
    TrendingUp,
    Truck,
    Tags,
    ShoppingCart,
    DollarSign,
    CreditCard,
    FileArchive,
    ReceiptText,
    Landmark,
    FileText,
    Settings,
    Stethoscope,
    Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/firebase/config';
import { collection, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Client } from '@/lib/clients-data';

const allMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'cadastros', label: 'Empresas', icon: Building2 },
    { id: 'receitas', label: 'Receitas', icon: TrendingUp },
    { id: 'fornecedores', label: 'Fornecedores', icon: Truck },
    { id: 'veterinarios', label: 'Veterinários', icon: Stethoscope },
    { id: 'cotacoes', label: 'Cotações', icon: Tags },
    { id: 'compras', label: 'Compras', icon: ShoppingCart },
    { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
    { id: 'pagamentos', label: 'Pagamentos', icon: CreditCard },
    { id: 'fiscal', label: 'Fiscal', icon: FileArchive },
    { id: 'despesas', label: 'Despesas', icon: ReceiptText },
    { id: 'contas-bancarias', label: 'Contas Bancárias', icon: Landmark },
    { id: 'prestacao-de-contas', label: 'Prestação de Contas', icon: FileText },
    { id: 'settings', label: 'Configurações', icon: Settings },
];

type ClientPermissions = {
    [menuId: string]: boolean;
}

export default function PermissionsPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [permissions, setPermissions] = useState<ClientPermissions>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const fetchClients = async () => {
            setIsLoading(true);
            try {
                const querySnapshot = await getDocs(collection(db, "clients"));
                const clientsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Client);
                setClients(clientsData);
            } catch (error) {
                toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar os clientes." });
            } finally {
                setIsLoading(false);
            }
        };
        fetchClients();
    }, [toast]);

    useEffect(() => {
        if (!selectedClientId) {
            setPermissions({});
            return;
        }

        const fetchPermissions = async () => {
            setIsLoading(true);
            try {
                const clientRef = doc(db, "clients", selectedClientId);
                const clientSnap = await getDoc(clientRef);
                if (clientSnap.exists()) {
                    const clientData = clientSnap.data();
                    setPermissions(clientData.permissions || {});
                }
            } catch (error) {
                toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar as permissões do cliente." });
            } finally {
                setIsLoading(false);
            }
        };

        fetchPermissions();
    }, [selectedClientId, toast]);


    const handlePermissionChange = (menuId: string, checked: boolean) => {
        setPermissions(prev => ({
            ...prev,
            [menuId]: checked,
        }));
    };

    const handleSaveChanges = async () => {
        if (!selectedClientId) {
            toast({ variant: "destructive", title: "Erro", description: "Nenhum cliente selecionado." });
            return;
        }

        setIsSaving(true);
        try {
            const clientRef = doc(db, "clients", selectedClientId);
            await updateDoc(clientRef, { permissions: permissions });
            toast({
                title: "Permissões Salvas!",
                description: `As permissões para o cliente selecionado foram atualizadas.`,
                className: 'bg-accent text-accent-foreground'
            });
        } catch (error) {
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível salvar as permissões." });
        } finally {
            setIsSaving(false);
        }
    };

    const selectedClientName = clients.find(c => c.id === selectedClientId)?.name || '';

    return (
        <div className="space-y-6">
            <PageHeader>
                <PageHeaderHeading>Permissões por Cliente</PageHeaderHeading>
                <PageHeaderDescription>
                    Habilite ou desabilite o acesso a módulos específicos para cada cliente.
                </PageHeaderDescription>
            </PageHeader>
            <Card>
                <CardHeader>
                    <CardTitle>Selecione um Cliente</CardTitle>
                    <CardDescription>Escolha um cliente para visualizar e editar suas permissões de menu.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Select onValueChange={setSelectedClientId} value={selectedClientId}>
                        <SelectTrigger className="w-full md:w-1/2 lg:w-1/3">
                            <SelectValue placeholder="Selecione um cliente..." />
                        </SelectTrigger>
                        <SelectContent>
                            {clients.map(client => (
                                <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {selectedClientId && (
                <Card>
                    <CardHeader>
                        <CardTitle>Módulos Acessíveis para "{selectedClientName}"</CardTitle>
                        <CardDescription>Marque os módulos que este cliente poderá acessar.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex items-center justify-center h-48">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <div className="grid md:grid-cols-2 gap-x-8 gap-y-4 rounded-lg border p-4">
                                {allMenuItems.map(item => (
                                    <div key={item.id} className="flex items-center justify-between">
                                        <Label htmlFor={`perm-${item.id}`} className="flex items-center gap-3">
                                            <item.icon className="h-5 w-5 text-muted-foreground" />
                                            {item.label}
                                        </Label>
                                        <Switch
                                            id={`perm-${item.id}`}
                                            checked={permissions[item.id] || false}
                                            onCheckedChange={(checked) => handlePermissionChange(item.id, checked)}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="justify-end">
                        <Button onClick={handleSaveChanges} disabled={isSaving || isLoading}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Salvar Permissões
                        </Button>
                    </CardFooter>
                </Card>
            )}
        </div>
    );
}
