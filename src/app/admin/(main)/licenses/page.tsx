
'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, RefreshCw, CalendarIcon, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { Client, clientSchema } from '@/lib/clients-data';
import { useToast } from "@/hooks/use-toast";
import { format, addYears, addMonths, isValid, parse } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, generateSlug } from "@/lib/utils";
import { db, app } from "@/firebase/config";
import { collection, getDocs, doc, updateDoc, setDoc, addDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";

interface NewClient {
    name: string;
    cnpj?: string;
    isPreCnpj: boolean;
    useDepartments: boolean;
    contactName: string;
    contactEmail: string;
    password?: string;
    plan: 'Administrativo' | 'Clinica' | 'Administrativo e Clinica';
    planPrice?: number;
    licenseExpiration?: Date;
    logoUrl?: string;
    maxCompanies?: number;
}

export default function LicensesPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    // Estados para o novo cliente
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newClient, setNewClient] = useState<NewClient>({ name: '', cnpj: '', isPreCnpj: false, useDepartments: false, contactName: '', contactEmail: '', password: '', plan: 'Administrativo', planPrice: 0, logoUrl: '', maxCompanies: 1 });
    const [licenseExpirationString, setLicenseExpirationString] = useState('');
    
    const fetchClients = async () => {
        setIsLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, "clients"));
            const clientsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Client[];
            setClients(clientsData);
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Erro ao buscar clientes",
                description: "Não foi possível carregar os dados dos clientes do banco de dados.",
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchClients();
    }, []);


    // Funções para manipular os dados do cliente selecionado no modal de edição
    const handlePlanChange = (plan: 'Administrativo' | 'Clinica' | 'Administrativo e Clinica') => {
        if (selectedClient) {
            setSelectedClient({ ...selectedClient, plan });
        }
    };

    const handleLicenseToggle = (checked: boolean) => {
        if (selectedClient) {
            setSelectedClient({ ...selectedClient, licenseActive: checked });
        }
    };
    
    const handlePaymentToggle = (checked: boolean) => {
         if (selectedClient) {
            setSelectedClient({ ...selectedClient, paymentVerified: checked });
        }
    };

     const handleRenewLicenseYearly = () => {
        if (selectedClient) {
            const currentExpiration = new Date(selectedClient.licenseExpiration);
            const newExpirationDate = addYears(currentExpiration, 1);
            setSelectedClient({ ...selectedClient, licenseExpiration: format(newExpirationDate, 'yyyy-MM-dd') });
            toast({
                title: "Licença Renovada!",
                description: `A licença de ${selectedClient.name} foi estendida para ${format(newExpirationDate, 'dd/MM/yyyy')}.`,
                className: "bg-accent text-accent-foreground",
            });
        }
    };
    
    const handleRenewLicenseMonthly = () => {
        if (selectedClient) {
            const currentExpiration = new Date(selectedClient.licenseExpiration);
            const newExpirationDate = addMonths(currentExpiration, 1);
            setSelectedClient({ ...selectedClient, licenseExpiration: format(newExpirationDate, 'dd/MM/yyyy') });
            toast({
                title: "Licença Renovada!",
                description: `A licença de ${selectedClient.name} foi estendida para ${format(newExpirationDate, 'dd/MM/yyyy')}.`,
                className: "bg-accent text-accent-foreground",
            });
        }
    };


    const handleSaveChanges = async () => {
        if (!selectedClient) return;
        
        setIsSubmitting(true);
        try {
            const clientRef = doc(db, "clients", selectedClient.id);
            // Omit 'id' from the object to be saved
            const { id, ...clientData } = selectedClient;
            await updateDoc(clientRef, clientData);
            
            await fetchClients(); // Re-fetch all clients to update the list
            
            setIsEditModalOpen(false);
            setSelectedClient(null);
            toast({
                title: "Sucesso!",
                description: "As alterações no cliente foram salvas.",
                className: "bg-accent text-accent-foreground",
            });
        } catch (error) {
             toast({
                variant: "destructive",
                title: "Erro ao salvar",
                description: "Não foi possível salvar as alterações no banco de dados.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOpenEditModal = (client: Client) => {
        setSelectedClient({ ...client });
        setIsEditModalOpen(true);
    }
    
    const handleAddClient = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!newClient.password) {
            toast({ variant: "destructive", title: "Erro", description: "O campo de senha é obrigatório." });
            return;
        }
        
        setIsSubmitting(true);
        const functions = getFunctions(app, 'southamerica-east1');
        const createClientUser = httpsCallable(functions, 'createClientUser');

        try {
            const clientNameAsId = generateSlug(newClient.name);
            const expirationDate = newClient.licenseExpiration || addYears(new Date(), 1);

            // 1. Create client document
            const clientData: Omit<Client, 'id'> = {
                name: newClient.name,
                contact: newClient.contactEmail,
                plan: newClient.plan,
                planPrice: Number(newClient.planPrice) || 0,
                licenseActive: true,
                paymentVerified: false,
                licenseExpiration: format(expirationDate, 'yyyy-MM-dd'),
                logoUrl: newClient.logoUrl || null,
                maxCompanies: Number(newClient.maxCompanies) || 1,
            };
            await setDoc(doc(db, "clients", clientNameAsId), clientData);

            // 2. Create the first company for this client
            const companyData = {
                name: newClient.name,
                cnpj: newClient.isPreCnpj ? '' : (newClient.cnpj || ''),
                isPreCnpj: newClient.isPreCnpj,
                useDepartments: newClient.useDepartments,
            };
            await addDoc(collection(db, "clients", clientNameAsId, "companies"), companyData);
            
            // 3. Call the Cloud Function to create the user and set custom claims
            const result = await createClientUser({
                email: newClient.contactEmail,
                password: newClient.password,
                displayName: newClient.contactName,
                clientId: clientNameAsId,
                role: 'Admin',
            });
            
            if ((result.data as any).error) {
                 throw new Error((result.data as any).error.message);
            }

            toast({
                title: "Cliente Cadastrado com Sucesso!",
                description: `${newClient.name} foi adicionado, com a empresa principal e o usuário admin criados.`,
                className: "bg-accent text-accent-foreground",
            });
            
            await fetchClients();

            setNewClient({ name: '', cnpj: '', isPreCnpj: false, useDepartments: false, contactName: '', contactEmail: '', password: '', plan: 'Administrativo', planPrice: 0, logoUrl: '', maxCompanies: 1 });
            setLicenseExpirationString('');
            setIsAddModalOpen(false);

        } catch (error: any) {
            let errorMessage = "Ocorreu um erro ao tentar criar o cliente e o usuário.";
            if (error.message) {
                errorMessage = error.message;
            }
            toast({
                variant: "destructive",
                title: "Erro no Cadastro",
                description: errorMessage,
            });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const getBadgeVariant = (isActive: boolean) => {
        return isActive ? 'default' : 'destructive';
    }
    
    const getBadgeClass = (isActive: boolean) => {
        return isActive ? 'bg-accent text-accent-foreground' : '';
    }
    
    const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLicenseExpirationString(e.target.value);
    };

    const handleDateInputBlur = () => {
        const date = parse(licenseExpirationString, 'dd/MM/yyyy', new Date());
        if (isValid(date)) {
            setNewClient(prev => ({ ...prev, licenseExpiration: date }));
        } else {
             setNewClient(prev => ({ ...prev, licenseExpiration: undefined }));
        }
    };

    const handleDeleteClient = async () => {
        if (!selectedClient) return;

        setIsSubmitting(true);
        const functions = getFunctions(app, 'southamerica-east1');
        const deleteClientFn = httpsCallable(functions, 'deleteClient');

        try {
            const result = await deleteClientFn({ clientId: selectedClient.id });
            
             if ((result.data as any).error) {
                 throw new Error((result.data as any).error.message);
            }

            toast({
                title: "Cliente Excluído!",
                description: `${selectedClient.name} foi removido com sucesso.`,
            });
            
            await fetchClients();
            setIsEditModalOpen(false);
            setSelectedClient(null);

        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Erro ao Excluir",
                description: error.message || "Não foi possível remover o cliente.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <CardTitle>Cadastro de Clientes</CardTitle>
                    <CardDescription>Gerencie os clientes e as licenças da plataforma.</CardDescription>
                </div>
                <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                    <DialogTrigger asChild>
                         <Button>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Cadastrar Cliente
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
                            <DialogDescription>Preencha os dados abaixo para criar um novo cliente e seu respectivo login de administrador.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleAddClient}>
                            <div className="space-y-4 py-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="new-client-name">Nome da Empresa Cliente</Label>
                                        <Input 
                                            id="new-client-name" 
                                            value={newClient.name}
                                            onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                                            placeholder="Ex: Nova Empresa Ltda."
                                            required
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="new-client-cnpj">CNPJ</Label>
                                        <Input
                                            id="new-client-cnpj"
                                            placeholder="00.000.000/0001-00"
                                            value={newClient.cnpj || ''}
                                            onChange={(e) => setNewClient({ ...newClient, cnpj: e.target.value })}
                                            disabled={isSubmitting || newClient.isPreCnpj}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="is-pre-cnpj" checked={newClient.isPreCnpj} onCheckedChange={(checked) => setNewClient({...newClient, isPreCnpj: !!checked })} disabled={isSubmitting}/>
                                    <Label htmlFor="is-pre-cnpj">Empresa em constituição (sem CNPJ)</Label>
                                </div>
                                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="new-client-contact-name">Nome do Contato Admin</Label>
                                        <Input 
                                            id="new-client-contact-name" 
                                            value={newClient.contactName}
                                            onChange={(e) => setNewClient({ ...newClient, contactName: e.target.value })}
                                            placeholder="Ex: João da Silva"
                                            required
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="new-client-contact-email">Email de Contato (Login)</Label>
                                        <Input 
                                            id="new-client-contact-email" 
                                            type="email"
                                            value={newClient.contactEmail}
                                            onChange={(e) => setNewClient({ ...newClient, contactEmail: e.target.value })}
                                            placeholder="contato@empresa.com"
                                            required
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="new-client-password">Senha do Admin</Label>
                                    <Input 
                                        id="new-client-password" 
                                        type="password"
                                        value={newClient.password || ''}
                                        onChange={(e) => setNewClient({ ...newClient, password: e.target.value })}
                                        placeholder="Defina uma senha segura"
                                        required
                                        disabled={isSubmitting}
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="new-client-plan">Plano</Label>
                                        <Select 
                                            value={newClient.plan} 
                                            onValueChange={(value: 'Administrativo' | 'Clinica' | 'Administrativo e Clinica') => setNewClient({ ...newClient, plan: value })}
                                            disabled={isSubmitting}
                                        >
                                            <SelectTrigger id="new-client-plan">
                                                <SelectValue placeholder="Selecione o plano" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Administrativo">Administrativo</SelectItem>
                                                <SelectItem value="Clinica">Clinica</SelectItem>
                                                <SelectItem value="Administrativo e Clinica">Administrativo e Clinica</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="new-client-plan-price">Valor do Plano (R$)</Label>
                                        <Input
                                            id="new-client-plan-price"
                                            type="number"
                                            placeholder="Ex: 350.00"
                                            value={newClient.planPrice || ''}
                                            onChange={(e) => setNewClient({ ...newClient, planPrice: parseFloat(e.target.value) || undefined })}
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="new-client-max-companies">Número de Empresas (Licenças)</Label>
                                        <Input
                                            id="new-client-max-companies"
                                            type="number"
                                            placeholder="1"
                                            value={newClient.maxCompanies || 1}
                                            onChange={(e) => setNewClient({ ...newClient, maxCompanies: parseInt(e.target.value) || 1 })}
                                            disabled={isSubmitting}
                                            min="1"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="new-license-expiration">Data de Bloqueio</Label>
                                         <Input
                                            id="new-license-expiration"
                                            value={licenseExpirationString}
                                            onChange={handleDateInputChange}
                                            onBlur={handleDateInputBlur}
                                            placeholder="dd/MM/yyyy"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-4 rounded-md border p-4">
                                    <div className="flex items-center justify-between">
                                        <div className='space-y-1'>
                                            <Label htmlFor="use-departments-switch">Usar Departamentos como Centro de Custo</Label>
                                            <p className="text-xs text-muted-foreground">
                                                Se ativo, você poderá vincular um departamento a cada lançamento desta empresa.
                                            </p>
                                        </div>
                                        <Switch 
                                            id="use-departments-switch"
                                            checked={newClient.useDepartments}
                                            onCheckedChange={(checked) => setNewClient({...newClient, useDepartments: checked })}
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="new-client-logo">URL do Logo (Opcional)</Label>
                                    <Input 
                                        id="new-client-logo" 
                                        type="url"
                                        value={newClient.logoUrl || ''}
                                        onChange={(e) => setNewClient({ ...newClient, logoUrl: e.target.value })}
                                        placeholder="https://exemplo.com/logo.png"
                                        disabled={isSubmitting}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button type="button" variant="outline" disabled={isSubmitting}>Cancelar</Button>
                                </DialogClose>
                                <Button type="submit" disabled={isSubmitting}>
                                     {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Salvar Cliente
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                   <div className="w-full overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Contato</TableHead>
                                    <TableHead>Pagamento</TableHead>
                                    <TableHead>Licença</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">
                                            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                        </TableCell>
                                    </TableRow>
                                ) : clients.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">
                                            Nenhum cliente encontrado.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    clients.map((client) => (
                                        <DialogTrigger asChild key={client.id}>
                                            <TableRow className="cursor-pointer" onClick={() => handleOpenEditModal(client)}>
                                                <TableCell className="font-medium">{client.name}</TableCell>
                                                <TableCell>{client.contact}</TableCell>
                                                <TableCell>
                                                    <Badge variant={getBadgeVariant(client.paymentVerified)} className={getBadgeClass(client.paymentVerified)}>
                                                        {client.paymentVerified ? 'Verificado' : 'Pendente'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={getBadgeVariant(client.licenseActive)} className={getBadgeClass(client.licenseActive)}>
                                                        {client.licenseActive ? 'Ativa' : 'Inativa'}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        </DialogTrigger>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    
                    {selectedClient && (
                         <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Configurações de: {selectedClient.name}</DialogTitle>
                                <DialogDescription>Ajuste as configurações de licença, plano e pagamento para este cliente.</DialogDescription>
                            </DialogHeader>
                            <div className="grid md:grid-cols-2 gap-6 py-4">
                               <div className="space-y-6">
                                    <div className="flex items-center justify-between rounded-lg border p-4">
                                        <div className="space-y-0.5">
                                            <Label htmlFor="license-switch">Licença Ativa</Label>
                                            <p className="text-xs text-muted-foreground">
                                                Determina se o cliente pode acessar o sistema.
                                            </p>
                                        </div>
                                        <Switch
                                            id="license-switch"
                                            checked={selectedClient.licenseActive}
                                            onCheckedChange={handleLicenseToggle}
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between rounded-lg border p-4">
                                        <div className="space-y-0.5">
                                            <Label htmlFor="payment-switch">Pagamento Verificado</Label>
                                            <p className="text-xs text-muted-foreground">
                                                Indica se o pagamento da licença está em dia.
                                            </p>
                                        </div>
                                        <Switch
                                            id="payment-switch"
                                            checked={selectedClient.paymentVerified}
                                            onCheckedChange={handlePaymentToggle}
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="plan-select">Plano do Cliente</Label>
                                        <Select value={selectedClient.plan} onValueChange={(value: 'Administrativo' | 'Clinica' | 'Administrativo e Clinica') => handlePlanChange(value)} disabled={isSubmitting}>
                                            <SelectTrigger id="plan-select">
                                                <SelectValue placeholder="Selecione o plano" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Administrativo">Administrativo</SelectItem>
                                                <SelectItem value="Clinica">Clinica</SelectItem>
                                                <SelectItem value="Administrativo e Clinica">Administrativo e Clinica</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="edit-client-plan-price">Valor do Plano (R$)</Label>
                                        <Input
                                            id="edit-client-plan-price"
                                            type="number"
                                            placeholder="Ex: 350.00"
                                            value={selectedClient.planPrice || ''}
                                            onChange={(e) => setSelectedClient({ ...selectedClient, planPrice: parseFloat(e.target.value) || 0 })}
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="edit-client-max-companies">Número de Empresas (Licenças)</Label>
                                        <Input
                                            id="edit-client-max-companies"
                                            type="number"
                                            placeholder="1"
                                            value={selectedClient.maxCompanies || 1}
                                            onChange={(e) => setSelectedClient({ ...selectedClient, maxCompanies: parseInt(e.target.value) || 1 })}
                                            min="1"
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                     <div className="space-y-2">
                                        <Label htmlFor="edit-client-logo-url">URL do Logo</Label>
                                        <Input
                                            id="edit-client-logo-url"
                                            type="url"
                                            placeholder="https://exemplo.com/logo.png"
                                            value={selectedClient.logoUrl || ''}
                                            onChange={(e) => setSelectedClient({ ...selectedClient, logoUrl: e.target.value })}
                                            disabled={isSubmitting}
                                        />
                                    </div>
                               </div>
                               <div className="space-y-4">
                                    <Label>Data de Bloqueio</Label>
                                    <div className="border rounded-md p-3">
                                      <p className="text-sm text-muted-foreground">
                                          O acesso será bloqueado em:
                                      </p>
                                      <p className="text-lg font-semibold">
                                          {format(new Date(selectedClient.licenseExpiration), "dd/MM/yyyy")}
                                      </p>
                                    </div>
                                    <div className="space-y-2">
                                        <Button variant="outline" className="w-full" onClick={handleRenewLicenseMonthly} disabled={isSubmitting}>
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                            Renovar Licença (+1 mês)
                                        </Button>
                                        <Button variant="outline" className="w-full" onClick={handleRenewLicenseYearly} disabled={isSubmitting}>
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                            Renovar Licença (+1 ano)
                                        </Button>
                                    </div>
                                      <div className="border-t pt-4 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <strong>Status da Licença:</strong>
                                            <Badge variant={getBadgeVariant(selectedClient.licenseActive)} className={getBadgeClass(selectedClient.licenseActive)}>
                                                {selectedClient.licenseActive ? 'Ativa' : 'Inativa'}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <strong>Status do Pagamento:</strong>
                                            <Badge variant={getBadgeVariant(selectedClient.paymentVerified)} className={getBadgeClass(selectedClient.paymentVerified)}>
                                                {selectedClient.paymentVerified ? 'Verificado' : 'Pendente'}
                                            </Badge>
                                        </div>
                                    </div>
                               </div>
                            </div>
                            <DialogFooter className="justify-between">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" disabled={isSubmitting}>
                                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                            Excluir Cliente
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Esta ação é irreversível. Todos os dados associados ao cliente <span className="font-bold">{selectedClient.name}</span>, incluindo empresas, usuários, faturas e configurações, serão permanentemente excluídos.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={handleDeleteClient}
                                                className="bg-destructive hover:bg-destructive/90"
                                                disabled={isSubmitting}
                                            >
                                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Sim, excluir permanentemente" }
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                                <div className="flex gap-2">
                                    <DialogClose asChild>
                                        <Button type="button" variant="outline" disabled={isSubmitting}>Cancelar</Button>
                                    </DialogClose>
                                    <Button type="button" onClick={handleSaveChanges} disabled={isSubmitting}>
                                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Salvar Alterações
                                    </Button>
                                </div>
                            </DialogFooter>
                        </DialogContent>
                    )}
                </Dialog>
            </CardContent>
        </Card>
    );
}
