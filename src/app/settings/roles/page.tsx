

'use client';

import { useState, useEffect } from 'react';
import { PageHeader, PageHeaderDescription, PageHeaderHeading } from '@/components/app/page-header';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
    BarChart2, 
    Settings,
    PlusCircle,
    ChevronDown,
    ArrowLeft,
    Loader2,
    Stethoscope
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { db } from '@/firebase/config';
import { collection, getDocs, doc, setDoc, query, where, addDoc, updateDoc } from 'firebase/firestore';

const allMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { id: 'cadastros', label: 'Empresas', icon: Building2, href: '/cadastros' },
    { id: 'receitas', label: 'Receitas', icon: TrendingUp, href: '/receitas' },
    { id: 'fornecedores', label: 'Fornecedores', icon: Truck, href: '/fornecedores' },
    { id: 'veterinarios', label: 'Veterinários', icon: Stethoscope, href: '/veterinarios' },
    { 
        id: 'cotacoes', 
        label: 'Cotações', 
        icon: Tags, 
        href: '/cotacoes',
        tabs: [
            { id: 'lancamento', label: 'Lançamento Manual'},
            { id: 'historico', label: 'Histórico e Comparativo'},
        ]
    },
    { 
        id: 'compras', 
        label: 'Compras', 
        icon: ShoppingCart, 
        href: '/compras',
        tabs: [
            { id: 'nova-ordem', label: 'Nova Ordem de Compra'},
            { id: 'acompanhamento', label: 'Acompanhamento'},
            { id: 'historico', label: 'Histórico'},
        ]
    },
    { 
        id: 'financeiro', 
        label: 'Financeiro', 
        icon: DollarSign, 
        href: '/financeiro',
        tabs: [
            { id: 'acompanhamento', label: 'Acompanhamento'},
            { id: 'previsao-pagamentos', label: 'Previsão de pagamentos'},
            { id: 'relatorio-financeiro', label: 'Relatório Financeiro'},
        ]
    },
    { id: 'pagamentos', label: 'Pagamentos', icon: CreditCard, href: '/pagamentos' },
    { 
        id: 'fiscal', 
        label: 'Fiscal', 
        icon: FileArchive, 
        href: '/fiscal',
        tabs: [
            { id: 'entrada', label: 'Notas de Entrada'},
            { id: 'saida', label: 'Notas de Saída'},
            { id: 'pagamentos', label: 'Documentos de Pagamento'},
        ]
    },
    { 
        id: 'despesas', 
        label: 'Despesas', 
        icon: ReceiptText, 
        href: '/despesas',
        tabs: [
            { id: 'novo-lancamento', label: 'Novo Lançamento'},
            { id: 'despesas-lancadas', label: 'Despesas Lançadas'},
        ]
    },
    { id: 'contas-bancarias', label: 'Contas Bancárias', icon: Landmark, href: '/contas-bancarias' },
    { 
        id: 'prestacao-de-contas', 
        label: 'Prestação de Contas', 
        icon: FileText, 
        href: '/prestacao-de-contas',
        tabs: [
            { id: 'interna', label: 'Prestação de Contas Interna'},
            { id: 'externa', label: 'Prestação de Contas Externa'},
        ]
    },
    { id: 'settings', label: 'Configurações', icon: Settings, href: '/settings' },
];

type Role = {
    id: string;
    label: string;
    value: string;
}

type Permissions = {
  [roleId: string]: {
    [menuId: string]: boolean | {
      enabled: boolean;
      tabs: { [tabId: string]: boolean };
    };
  };
};

export default function RolesPage() {
    const [clientRoles, setClientRoles] = useState<Role[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState<string>('');
    const [permissions, setPermissions] = useState<Permissions>({});
    const [newRoleName, setNewRoleName] = useState('');
    const [isAddRoleModalOpen, setIsAddRoleModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    const clientId = typeof window !== 'undefined' ? localStorage.getItem('clientName') : null;

    useEffect(() => {
        if (!clientId) {
            toast({ variant: "destructive", title: "Erro", description: "Cliente não identificado." });
            setIsLoading(false);
            return;
        }

        const fetchRolesAndPermissions = async () => {
            setIsLoading(true);
            try {
                const rolesQuery = query(collection(db, "clients", clientId, "roles"));
                const querySnapshot = await getDocs(rolesQuery);
                const rolesData: Role[] = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    value: doc.data().name,
                    label: doc.data().name
                }));
                setClientRoles(rolesData);

                const permissionsData: Permissions = {};
                for (const role of rolesData) {
                    const roleDoc = querySnapshot.docs.find(d => d.id === role.id);
                    permissionsData[role.id] = roleDoc?.data().permissions || {};
                }
                setPermissions(permissionsData);
                
                if (rolesData.length > 0) {
                    setSelectedRoleId(rolesData[0].id);
                }

            } catch (error) {
                toast({ variant: "destructive", title: "Erro", description: "Não foi possível carregar as funções e permissões." });
            } finally {
                setIsLoading(false);
            }
        };

        fetchRolesAndPermissions();
    }, [toast, clientId]);


    const handlePermissionChange = (menuId: string, checked: boolean) => {
        setPermissions(prev => {
            const currentPermission = prev[selectedRoleId]?.[menuId];
            const newPermissionsForRole = { ...prev[selectedRoleId] };

            if (typeof currentPermission === 'object') {
                newPermissionsForRole[menuId] = { ...currentPermission, enabled: checked };
            } else {
                 const menuItem = allMenuItems.find(m => m.id === menuId);
                 if (menuItem?.tabs) {
                     newPermissionsForRole[menuId] = {
                         enabled: checked,
                         tabs: menuItem.tabs.reduce((acc, tab) => ({ ...acc, [tab.id]: checked }), {})
                     };
                 } else {
                    newPermissionsForRole[menuId] = checked;
                 }
            }

            return { ...prev, [selectedRoleId]: newPermissionsForRole };
        });
    };

    const handleTabPermissionChange = (menuId: string, tabId: string, checked: boolean) => {
        setPermissions(prev => {
            const menuPermission = prev[selectedRoleId]?.[menuId];
            if (typeof menuPermission !== 'object') return prev;

            const newTabs = { ...menuPermission.tabs, [tabId]: checked };
            const newMenuPermission = { ...menuPermission, tabs: newTabs };
            
            return {
                ...prev,
                [selectedRoleId]: {
                    ...prev[selectedRoleId],
                    [menuId]: newMenuPermission
                }
            };
        });
    }

    const handleAddRole = async () => {
        if (!newRoleName.trim() || !clientId) {
            toast({ variant: "destructive", title: "Erro", description: "O nome da função não pode ser vazio." });
            return;
        }
        const newRoleValue = newRoleName.trim();
        if (clientRoles.some(role => role.label === newRoleValue)) {
            toast({ variant: "destructive", title: "Erro", description: "Esta função já existe." });
            return;
        }

        try {
            const newRoleDocRef = await addDoc(collection(db, "clients", clientId, "roles"), {
                name: newRoleValue,
                permissions: {}
            });

            const newRole: Role = { id: newRoleDocRef.id, value: newRoleValue, label: newRoleValue };
            
            setClientRoles(prev => [...prev, newRole]);
            setPermissions(prev => ({ ...prev, [newRole.id]: {} }));
            setSelectedRoleId(newRole.id);

            setNewRoleName('');
            setIsAddRoleModalOpen(false);
            toast({
                title: "Função Criada!",
                description: `A função "${newRoleValue}" foi adicionada.`,
                className: 'bg-accent text-accent-foreground'
            });
        } catch (error) {
            toast({ variant: "destructive", title: "Erro", description: "Não foi possível criar a nova função." });
        }
    };
    
    const handleSaveChanges = async () => {
        if (!selectedRoleId || !clientId) return;
        
        setIsSaving(true);
        try {
            const roleRef = doc(db, "clients", clientId, "roles", selectedRoleId);
            await updateDoc(roleRef, { permissions: permissions[selectedRoleId] || {} });

            toast({
                title: "Permissões Salvas!",
                description: `As permissões para a função selecionada foram atualizadas.`,
                className: 'bg-accent text-accent-foreground'
            });
        } catch (error) {
             toast({ variant: "destructive", title: "Erro", description: "Não foi possível salvar as permissões." });
        } finally {
            setIsSaving(false);
        }
    }
    
    const selectedRoleName = clientRoles.find(r => r.id === selectedRoleId)?.label || '';
    const isAdminRole = selectedRoleName === 'Admin' || selectedRoleName === 'Superadmin';

    if (isLoading) {
        return (
             <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <PageHeader>
                <div className='flex-1'>
                    <PageHeaderHeading>Funções e Permissões</PageHeaderHeading>
                    <PageHeaderDescription>
                        Crie funções e defina o que cada uma pode ver e fazer no sistema.
                    </PageHeaderDescription>
                </div>
                 <Button asChild variant="outline">
                    <Link href="/settings">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Voltar
                    </Link>
                </Button>
            </PageHeader>

            <Card>
                <CardHeader>
                    <CardTitle>Configurar Permissões de Acesso</CardTitle>
                    <CardDescription>Selecione uma função para editar os módulos e abas que ela pode acessar.</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-3 gap-8">
                    <div className="md:col-span-1">
                        <div className='flex items-center justify-between mb-4'>
                            <h3 className="text-lg font-medium">Funções</h3>
                            <Dialog open={isAddRoleModalOpen} onOpenChange={setIsAddRoleModalOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                        <PlusCircle className="mr-2 h-4 w-4"/> Adicionar
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Criar Nova Função</DialogTitle>
                                        <DialogDescription>Digite o nome para a nova função de usuário.</DialogDescription>
                                    </DialogHeader>
                                    <div className="py-4">
                                        <Label htmlFor="new-role-name">Nome da Função</Label>
                                        <Input 
                                            id="new-role-name" 
                                            value={newRoleName}
                                            onChange={(e) => setNewRoleName(e.target.value)}
                                            placeholder="Ex: Marketing"
                                        />
                                    </div>
                                    <DialogFooter>
                                        <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                                        <Button type="button" onClick={handleAddRole}>Salvar Função</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                        <RadioGroup value={selectedRoleId} onValueChange={setSelectedRoleId} className="space-y-2">
                           {clientRoles.map(role => (
                             <div key={role.id} className="flex items-center space-x-2">
                                <RadioGroupItem value={role.id} id={role.id} />
                                <Label htmlFor={role.id}>{role.label}</Label>
                             </div>
                           ))}
                        </RadioGroup>
                    </div>
                    <div className="md:col-span-2">
                         <h3 className="text-lg font-medium mb-4">Módulos Acessíveis para "{selectedRoleName}"</h3>
                         <div className="space-y-2 rounded-lg border p-4">
                            {allMenuItems.map(item => {
                                const permission = permissions[selectedRoleId]?.[item.id];
                                const hasTabs = item.tabs && item.tabs.length > 0;
                                const isEnabled = typeof permission === 'boolean' ? permission : (permission as any)?.enabled;

                                if (hasTabs) {
                                    return (
                                        <Collapsible key={item.id}>
                                            <div className="flex items-center justify-between">
                                                <Label htmlFor={`perm-${item.id}`} className="flex items-center gap-3 font-semibold">
                                                    <item.icon className="h-5 w-5 text-muted-foreground" />
                                                    {item.label}
                                                </Label>
                                                <div className='flex items-center gap-4'>
                                                    <CollapsibleTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="w-9 p-0" disabled={isAdminRole}>
                                                            <ChevronDown className="h-4 w-4" />
                                                            <span className="sr-only">Toggle</span>
                                                        </Button>
                                                    </CollapsibleTrigger>
                                                    <Switch
                                                        id={`perm-${item.id}`}
                                                        checked={isEnabled || false}
                                                        onCheckedChange={(checked) => handlePermissionChange(item.id, checked)}
                                                        disabled={isAdminRole}
                                                    />
                                                </div>
                                            </div>
                                            <CollapsibleContent className="py-2 pl-10 pr-2 space-y-3 data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                                                <Separator />
                                                {item.tabs?.map(tab => {
                                                    const tabPermission = (permission as any)?.tabs?.[tab.id] || false;
                                                    return (
                                                        <div key={tab.id} className="flex items-center justify-between">
                                                            <Label htmlFor={`perm-${item.id}-${tab.id}`} className="text-sm text-muted-foreground font-normal">
                                                                {tab.label}
                                                            </Label>
                                                            <Switch
                                                                id={`perm-${item.id}-${tab.id}`}
                                                                checked={tabPermission}
                                                                onCheckedChange={(checked) => handleTabPermissionChange(item.id, tab.id, checked)}
                                                                disabled={isAdminRole}
                                                            />
                                                        </div>
                                                    )
                                                })}
                                            </CollapsibleContent>
                                        </Collapsible>
                                    )
                                }

                                return (
                                    <div key={item.id} className="flex items-center justify-between">
                                        <Label htmlFor={`perm-${item.id}`} className="flex items-center gap-3">
                                            <item.icon className="h-5 w-5 text-muted-foreground" />
                                            {item.label}
                                        </Label>
                                        <Switch
                                            id={`perm-${item.id}`}
                                            checked={isEnabled || false}
                                            onCheckedChange={(checked) => handlePermissionChange(item.id, checked)}
                                            disabled={isAdminRole}
                                        />
                                    </div>
                                )
                            })}
                            {isAdminRole && (
                                <p className="text-sm text-muted-foreground text-center pt-4">
                                    A função "{selectedRoleName}" tem acesso irrestrito a todos os módulos.
                                </p>
                            )}
                         </div>
                    </div>
                </CardContent>
                <CardFooter className="justify-end">
                    <Button onClick={handleSaveChanges} disabled={isAdminRole || isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar Permissões
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
