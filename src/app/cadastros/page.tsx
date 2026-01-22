
'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, PageHeaderDescription, PageHeaderHeading } from "@/components/app/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Building, AlertTriangle, Blocks, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/firebase/config";
import { collection, addDoc, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import type { Client } from '@/lib/clients-data';

interface Company {
  id: string;
  name: string;
  cnpj?: string;
  isPreCnpj: boolean;
  useDepartments: boolean;
}

interface CostCenter {
    id: string;
    name: string;
}

interface BankAccount {
    id?: string;
    companyId: string;
    bankName: string;
    agency: string;
    account: string;
    balanceEnabled: boolean;
}

export default function CadastrosPage() {
  const [totalLicenses, setTotalLicenses] = useState(1); 
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  
  const clientName = typeof window !== 'undefined' ? localStorage.getItem('clientName') : null;
  
  // States for new company
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyCnpj, setNewCompanyCnpj] = useState('');
  const [useDepartmentsForNewCompany, setUseDepartmentsForNewCompany] = useState(false);
  const [isPreCnpj, setIsPreCnpj] = useState(false);
  const [isSubmittingCompany, setIsSubmittingCompany] = useState(false);

  // States for bank accounts
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [newBankAccount, setNewBankAccount] = useState<Partial<BankAccount>>({ balanceEnabled: false });
  const [isSubmittingBankAccount, setIsSubmittingBankAccount] = useState(false);
  const [isLoadingBankAccounts, setIsLoadingBankAccounts] = useState(true);

  // States for cost centers
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [newCostCenterName, setNewCostCenterName] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [isLoadingCostCenters, setIsLoadingCostCenters] = useState(false);
  const [isSubmittingCostCenter, setIsSubmittingCostCenter] = useState(false);
  
  const usedLicenses = companies.length;
  const isDepartmentModeActive = companies.some(c => c.useDepartments);
  const remainingLicenses = totalLicenses - usedLicenses;
  const limitReached = remainingLicenses <= 0;
  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

    const fetchData = async () => {
        if (!clientName) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const clientDocRef = doc(db, 'clients', clientName);
            const clientDoc = await getDoc(clientDocRef);
            if (clientDoc.exists()) {
                const clientData = clientDoc.data() as Client;
                setTotalLicenses(clientData.maxCompanies || 1);

                const companiesQuery = query(collection(db, 'clients', clientName, 'companies'));
                const companiesSnapshot = await getDocs(companiesQuery);
                const companiesData = companiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Company[];
                setCompanies(companiesData);
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os dados. Verifique sua conexão e tente novamente.' });
        } finally {
            setIsLoading(false);
        }
    };
    
    const fetchBankAccounts = async () => {
        if (!clientName) return;
        setIsLoadingBankAccounts(true);
        try {
            const q = query(collection(db, 'clients', clientName, 'bankAccounts'));
            const querySnapshot = await getDocs(q);
            const accountsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BankAccount[];
            setBankAccounts(accountsData);
        } catch (error) {
             toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar as contas bancárias.' });
        } finally {
            setIsLoadingBankAccounts(false);
        }
    }

    const fetchCostCenters = async (companyId: string) => {
        if (!clientName || !companyId) return;
        setIsLoadingCostCenters(true);
        try {
            const q = query(collection(db, 'clients', clientName, 'companies', companyId, 'costCenters'));
            const querySnapshot = await getDocs(q);
            const centersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CostCenter[];
            setCostCenters(centersData);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os centros de custo.' });
        } finally {
            setIsLoadingCostCenters(false);
        }
    }

  useEffect(() => {
    fetchData();
  }, [clientName]);
  
  useEffect(() => {
    if (selectedCompanyId) {
        fetchCostCenters(selectedCompanyId);
    } else {
        setCostCenters([]);
    }
  }, [selectedCompanyId, clientName]);

  const handleTabChange = (value: string) => {
    if (value === 'bancos' && !isLoading) {
        fetchBankAccounts();
    }
  };

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (limitReached || !clientName) return;
    
    setIsSubmittingCompany(true);
    try {
        const newCompany = {
            name: newCompanyName,
            cnpj: isPreCnpj ? '' : newCompanyCnpj,
            isPreCnpj: isPreCnpj,
            useDepartments: useDepartmentsForNewCompany,
        };

        const docRef = await addDoc(collection(db, "clients", clientName, "companies"), newCompany);
        setCompanies(prev => [...prev, { id: docRef.id, ...newCompany }]);

        toast({
            title: "Empresa Adicionada!",
            description: `${newCompanyName} foi cadastrada com sucesso.`,
            className: "bg-accent text-accent-foreground",
        });

        setNewCompanyName('');
        setNewCompanyCnpj('');
        setIsPreCnpj(false);
        setUseDepartmentsForNewCompany(false);

    } catch (error) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível salvar a nova empresa.' });
    } finally {
        setIsSubmittingCompany(false);
    }
  }
  
  const handleAddBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
     if (!clientName || !newBankAccount.companyId || !newBankAccount.bankName || !newBankAccount.agency || !newBankAccount.account) {
        toast({ variant: 'destructive', title: 'Campos Incompletos', description: 'Por favor, preencha todos os campos da conta bancária.' });
        return;
    }
    
    setIsSubmittingBankAccount(true);
    try {
        const bankAccountData = { ...newBankAccount };
        const docRef = await addDoc(collection(db, "clients", clientName, "bankAccounts"), bankAccountData);
        setBankAccounts(prev => [...prev, { id: docRef.id, ...bankAccountData as BankAccount }]);

        toast({
            title: "Conta Bancária Adicionada!",
            description: `A conta no ${newBankAccount.bankName} foi cadastrada com sucesso.`,
            className: "bg-accent text-accent-foreground",
        });
        
        setNewBankAccount({ balanceEnabled: false });

    } catch (error) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível salvar a nova conta.' });
    } finally {
        setIsSubmittingBankAccount(false);
    }
  }

  const handleBankAccountInputChange = (field: keyof BankAccount, value: string | boolean) => {
    setNewBankAccount(prev => ({...prev, [field]: value }));
  }

  const handleAddCostCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !selectedCompanyId || !newCostCenterName.trim()) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Selecione uma empresa e digite o nome do centro de custo.' });
        return;
    }

    setIsSubmittingCostCenter(true);
    try {
        const newCostCenter = {
            name: newCostCenterName.trim()
        };
        const docRef = await addDoc(collection(db, "clients", clientName, "companies", selectedCompanyId, "costCenters"), newCostCenter);
        setCostCenters(prev => [...prev, { id: docRef.id, ...newCostCenter }]);

        toast({ title: 'Sucesso!', description: 'Centro de custo salvo com sucesso.', className: "bg-accent text-accent-foreground" });
        setNewCostCenterName('');

    } catch (error) {
         toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível salvar o centro de custo.' });
    } finally {
        setIsSubmittingCostCenter(false);
    }
  }


  return (
    <div className="space-y-6">
      <PageHeader>
        <PageHeaderHeading>Cadastros</PageHeaderHeading>
        <PageHeaderDescription>
          Gerencie as empresas, centros de custo e contas bancárias do seu espaço de trabalho.
        </PageHeaderDescription>
      </PageHeader>

      <Tabs defaultValue="empresas" className="w-full" onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="empresas">Empresas</TabsTrigger>
          <TabsTrigger value="centros-de-custo" disabled={!isDepartmentModeActive}>Centros de Custo</TabsTrigger>
          <TabsTrigger value="bancos">Bancos</TabsTrigger>
        </TabsList>
        
        <TabsContent value="empresas">
          <Card>
            <CardHeader>
              <CardTitle>Cadastro de Empresas</CardTitle>
              <CardDescription>Adicione e visualize as empresas do seu grupo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Licenciamento</AlertTitle>
                <AlertDescription>
                  {limitReached 
                    ? "Você atingiu o número máximo de empresas que pode cadastrar."
                    : `Você pode cadastrar mais ${remainingLicenses} empresa(s) no seu plano.`
                  }
                </AlertDescription>
              </Alert>

              <form onSubmit={handleAddCompany} className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="company-name">Nome da Empresa</Label>
                        <Input id="company-name" placeholder="Ex: Matriz S.A." disabled={limitReached || isSubmittingCompany} value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} required/>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="company-cnpj">CNPJ</Label>
                        <Input id="company-cnpj" placeholder="00.000.000/0001-00" disabled={limitReached || isPreCnpj || isSubmittingCompany} value={newCompanyCnpj} onChange={(e) => setNewCompanyCnpj(e.target.value)} />
                    </div>
                    <div className="sm:col-span-2 flex items-center space-x-2">
                        <Checkbox id="is-pre-cnpj" checked={isPreCnpj} onCheckedChange={(checked) => setIsPreCnpj(!!checked)} disabled={isSubmittingCompany}/>
                        <Label htmlFor="is-pre-cnpj">Empresa em constituição (sem CNPJ)</Label>
                    </div>

                    {isPreCnpj && (
                        <div className="sm:col-span-2">
                            <Alert variant="destructive">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Atenção</AlertTitle>
                                <AlertDescription>
                                    Os lançamentos para esta empresa serão registrados no centro de custo da Matriz até que um CNPJ seja informado.
                                </AlertDescription>
                            </Alert>
                        </div>
                    )}
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
                            checked={useDepartmentsForNewCompany}
                            onCheckedChange={setUseDepartmentsForNewCompany}
                            disabled={limitReached || isSubmittingCompany}
                        />
                    </div>
                </div>
                
                <div className="flex justify-end">
                    <Button type="submit" disabled={limitReached || isSubmittingCompany}>
                         {isSubmittingCompany && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar Empresa
                    </Button>
                </div>
              </form>

              {limitReached && (
                <p className="text-sm text-center text-muted-foreground">
                  Para cadastrar mais empresas, por favor, entre em contato com a equipe Fluxo ADM para atualizar seu plano.
                </p>
              )}

              <div className="border-t pt-4 mt-4">
                <h3 className="text-lg font-medium text-primary">Empresas Cadastradas</h3>
                 {isLoading ? (
                    <div className="flex justify-center items-center h-24">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                 ) : companies.length > 0 ? (
                    <ul className="mt-2 space-y-2">
                        {companies.map(company => (
                            <li key={company.id} className="flex items-center justify-between p-3 border rounded-md">
                                <span className="font-medium">{company.name}</span>
                                <span className="text-sm text-muted-foreground">{company.isPreCnpj ? 'Sem CNPJ' : company.cnpj}</span>
                            </li>
                        ))}
                    </ul>
                 ) : (
                    <p className="text-sm text-muted-foreground mt-2">
                        Nenhuma empresa cadastrada ainda.
                    </p>
                 )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="centros-de-custo">
          <Card>
            <CardHeader>
              <CardTitle>Cadastro de Centros de Custo (Departamentos)</CardTitle>
              <CardDescription>Vincule departamentos às empresas que utilizam essa estrutura.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="max-w-md space-y-2">
                    <Label htmlFor="cost-center-company-select">Selecione uma Empresa</Label>
                    <Select onValueChange={setSelectedCompanyId} value={selectedCompanyId || undefined}>
                      <SelectTrigger id="cost-center-company-select">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {companies
                            .filter(c => c.useDepartments)
                            .map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
                        }
                      </SelectContent>
                    </Select>
                </div>

                {selectedCompany && selectedCompany.useDepartments && (
                  <div className="border-t pt-6 space-y-6">
                    <form onSubmit={handleAddCostCenter} className="grid sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2 space-y-2">
                        <Label htmlFor="cost-center-name">Nome do Centro de Custo (Departamento)</Label>
                        <Input id="cost-center-name" placeholder={"Ex: Departamento de TI"} value={newCostCenterName} onChange={(e) => setNewCostCenterName(e.target.value)} disabled={isSubmittingCostCenter} required/>
                      </div>
                      <div className="sm:col-span-2 flex justify-end">
                          <Button type="submit" disabled={isSubmittingCostCenter}>
                            {isSubmittingCostCenter && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Salvar Centro de Custo
                          </Button>
                      </div>
                    </form>
                    <div className="border-t pt-4 mt-4">
                      <h3 className="text-lg font-medium text-primary">Centros de Custo de "{selectedCompany.name}"</h3>
                        {isLoadingCostCenters ? (
                             <div className="flex justify-center items-center h-24">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : costCenters.length > 0 ? (
                             <ul className="mt-2 space-y-2">
                                {costCenters.map(center => (
                                    <li key={center.id} className="flex items-center justify-between p-3 border rounded-md">
                                        <span className="font-medium">{center.name}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-muted-foreground mt-2">
                                Nenhum centro de custo cadastrado para esta empresa.
                            </p>
                        )}
                    </div>
                  </div>
                )}

                 {selectedCompanyId && (!selectedCompany || !selectedCompany.useDepartments) && (
                    <div className="text-center py-8">
                      <Blocks className="mx-auto h-12 w-12 text-muted-foreground" />
                      <h3 className="mt-4 text-lg font-medium">Estrutura não aplicável</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        A empresa selecionada não está configurada para usar departamentos como centro de custo.
                      </p>
                    </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bancos">
          <Card>
            <CardHeader>
              <CardTitle>Cadastro de Contas Bancárias</CardTitle>
              <CardDescription>Adicione as contas bancárias e vincule-as a uma empresa.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleAddBankAccount} className="space-y-4">
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bank-account-company">Empresa</Label>
                    <Select value={newBankAccount.companyId} onValueChange={(value) => handleBankAccountInputChange('companyId', value)} required>
                      <SelectTrigger id="bank-account-company" disabled={isSubmittingBankAccount}>
                        <SelectValue placeholder="Selecione a empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank-name">Nome do Banco</Label>
                    <Input id="bank-name" placeholder="Ex: Banco do Brasil" value={newBankAccount.bankName || ''} onChange={(e) => handleBankAccountInputChange('bankName', e.target.value)} disabled={isSubmittingBankAccount} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank-agency">Agência</Label>
                    <Input id="bank-agency" placeholder="Ex: 1234-5" value={newBankAccount.agency || ''} onChange={(e) => handleBankAccountInputChange('agency', e.target.value)} disabled={isSubmittingBankAccount} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank-account">Conta Corrente</Label>
                    <Input id="bank-account" placeholder="Ex: 12345-6" value={newBankAccount.account || ''} onChange={(e) => handleBankAccountInputChange('account', e.target.value)} disabled={isSubmittingBankAccount} required />
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                    <Switch 
                        id="balance-control"
                        checked={!!newBankAccount.balanceEnabled}
                        onCheckedChange={(checked) => handleBankAccountInputChange('balanceEnabled', checked)}
                        disabled={isSubmittingBankAccount}
                    />
                    <Label htmlFor="balance-control">Controlar saldo desta conta</Label>
                </div>
                
                <div className="flex justify-end">
                    <Button type="submit" disabled={isSubmittingBankAccount}>
                        {isSubmittingBankAccount && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar Conta Bancária
                    </Button>
                </div>
              </form>
               <div className="border-t pt-4 mt-4">
                <h3 className="text-lg font-medium text-primary">Contas Bancárias Cadastradas</h3>
                 {isLoadingBankAccounts ? (
                    <div className="flex justify-center items-center h-24">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : bankAccounts.length > 0 ? (
                     <ul className="mt-2 space-y-2">
                        {bankAccounts.map(account => (
                            <li key={account.id} className="flex items-center justify-between p-3 border rounded-md">
                                <div>
                                    <span className="font-medium">{account.bankName}</span>
                                    <span className="text-sm text-muted-foreground ml-2"> (Ag: {account.agency} / CC: {account.account})</span>
                                </div>
                                <span className="text-sm text-muted-foreground">{companies.find(c => c.id === account.companyId)?.name}</span>
                            </li>
                        ))}
                    </ul>
                 ) : (
                    <p className="text-sm text-muted-foreground mt-2">
                        Nenhuma conta bancária cadastrada ainda.
                    </p>
                 )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
