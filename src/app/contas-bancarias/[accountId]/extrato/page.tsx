
'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { PageHeader, PageHeaderDescription, PageHeaderHeading } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Landmark, ArrowUpRight, ArrowDownLeft, Search, CalendarIcon, Download, ArrowLeft, Link as LinkIcon, FileClock, ChevronDown, Edit, Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { db } from '@/firebase/config';
import { collection, query, where, getDocs, Timestamp, doc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface BankAccount {
    id: string;
    bankName: string;
    agency: string;
    account: string;
    companyId: string;
    balance: number;
}

interface Company {
    id: string;
    name: string;
}

interface Log {
    user: string;
    date: string;
    action: string;
}

interface Transaction {
    id: string;
    date: string;
    description: string;
    type: 'expense' | 'revenue';
    value: number;
    originType: 'Compra' | 'Venda' | 'Despesa Avulsa' | 'Transferência' | 'Receita';
    originId: string;
    logs: Log[];
}

const getOriginLink = (transaction: Transaction): string => {
    const originType = transaction.originType;
    const originId = transaction.originId;
    switch (originType) {
        case 'Despesa Avulsa':
            return `/despesas?tab=despesas-lancadas&id=${originId}`;
        case 'Receita':
        case 'Venda':
            return `/receitas?tab=receitas-lancadas&id=${originId}`;
        case 'Compra':
            return `/compras?tab=acompanhamento&id=${originId}`;
        default:
            return '#'; // Fallback for types like 'Transferência'
    }
};

export default function ExtratoPage() {
    const params = useParams();
    const { toast } = useToast();
    const { accountId } = params;
    const clientName = typeof window !== 'undefined' ? localStorage.getItem('clientName') : null;
    
    const [account, setAccount] = useState<BankAccount | null>(null);
    const [company, setCompany] = useState<Company | null>(null);

    const [dateFrom, setDateFrom] = useState<Date>();
    const [dateTo, setDateTo] = useState<Date>();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

    useEffect(() => {
        if (!clientName || !accountId) {
            setIsLoading(false);
            return;
        }

        const fetchAccountData = async () => {
            setIsLoading(true);
            try {
                // Fetch Account
                const accountRef = doc(db, 'clients', clientName as string, 'bankAccounts', accountId as string);
                const accountSnap = await getDoc(accountRef);
                
                if (!accountSnap.exists()) {
                    toast({ variant: 'destructive', title: 'Erro', description: 'Conta bancária não encontrada.' });
                    setIsLoading(false);
                    return;
                }
                
                const accountData = { id: accountSnap.id, ...accountSnap.data(), balance: accountSnap.data().balance || 0 } as BankAccount;
                setAccount(accountData);

                // Fetch Company
                const companyRef = doc(db, 'clients', clientName as string, 'companies', accountData.companyId);
                const companySnap = await getDoc(companyRef);
                if (companySnap.exists()) {
                    setCompany({ id: companySnap.id, ...companySnap.data() } as Company);
                }

                // Fetch Transactions for THIS account
                const expensesQuery = query(collection(db, "clients", clientName as string, "expenses"), where("bankAccountId", "==", accountId));
                const revenuesQuery = query(collection(db, "clients", clientName as string, "revenues"), where("bankAccount", "==", accountId));

                const [expensesSnapshot, revenuesSnapshot] = await Promise.all([
                    getDocs(expensesQuery),
                    getDocs(revenuesQuery),
                ]);

                const allTransactions: Transaction[] = [];

                expensesSnapshot.forEach(doc => {
                    const data = doc.data();
                    allTransactions.push({
                        id: doc.id,
                        date: format(new Date(data.expenseDate), 'dd/MM/yyyy'),
                        description: data.description,
                        type: 'expense',
                        value: -Math.abs(data.value),
                        originType: 'Despesa Avulsa',
                        originId: doc.id,
                        logs: [], // simplified
                    });
                });

                revenuesSnapshot.forEach(doc => {
                     const data = doc.data();
                     allTransactions.push({
                        id: doc.id,
                        date: format(new Date(data.date), 'dd/MM/yyyy'),
                        description: data.description,
                        type: 'revenue',
                        value: data.value,
                        originType: 'Receita',
                        originId: doc.id,
                        logs: (data.logs || []).map((log: any) => ({...log, date: format(new Date(log.date), 'dd/MM/yyyy HH:mm')})),
                    });
                });

                allTransactions.sort((a, b) => new Date(b.date.split('/').reverse().join('-')).getTime() - new Date(a.date.split('/').reverse().join('-')).getTime());
                setTransactions(allTransactions);

                // Calculate balance
                const totalRevenue = revenuesSnapshot.docs
                    .filter(doc => doc.data().status === 'Recebido')
                    .reduce((sum, doc) => sum + doc.data().value, 0);

                const totalExpense = expensesSnapshot.docs
                    .reduce((sum, doc) => sum + doc.data().value, 0);

                const calculatedBalance = totalRevenue - totalExpense;

                // Update the account state with the calculated balance.
                setAccount(prev => {
                    if (!prev) return null;
                    return { ...prev, balance: calculatedBalance };
                });


            } catch (error) {
                toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os dados da conta.' });
            } finally {
                setIsLoading(false);
            }
        };

        fetchAccountData();

    }, [clientName, accountId, toast]);

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        )
    }

    if (!account) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center">
                 <h2 className="text-2xl font-bold mb-4">Conta não encontrada</h2>
                 <p className="text-muted-foreground mb-8">A conta que você está tentando acessar não existe ou foi removida.</p>
                 <Button asChild>
                    <Link href="/contas-bancarias">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Voltar para Contas Bancárias
                    </Link>
                 </Button>
            </div>
        )
    }
    
    return (
        <div className="space-y-6">
             <PageHeader>
                <div className='flex-1'>
                    <PageHeaderHeading>Extrato Bancário</PageHeaderHeading>
                    <PageHeaderDescription>
                        Consulte as movimentações da conta {account.bankName} ({account.agency} / {account.account}).
                    </PageHeaderDescription>
                </div>
                 <Button asChild variant="outline">
                    <Link href="/contas-bancarias">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Voltar
                    </Link>
                 </Button>
            </PageHeader>

            <Card>
                <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Landmark className="h-5 w-5 text-muted-foreground" />
                                {account.bankName} - {company?.name || '...'}
                            </CardTitle>
                            <CardDescription>Agência: {account.agency} | Conta: {account.account}</CardDescription>
                        </div>
                        <div className="text-right">
                             <p className="text-sm text-muted-foreground">Saldo Atual</p>
                            <p className="text-2xl font-bold">
                                R$ {account.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Filtrar Lançamentos</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                        <div className="space-y-2">
                            <Label htmlFor="date-from">Período (De)</Label>
                             <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="date-from"
                                        variant={"outline"}
                                        className={cn("w-full justify-start text-left font-normal",!dateFrom && "text-muted-foreground")}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateFrom ? format(dateFrom, "dd/MM/yyyy") : <span>Selecione a data</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                             <Label htmlFor="date-to">Período (Até)</Label>
                             <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="date-to"
                                        variant={"outline"}
                                        className={cn("w-full justify-start text-left font-normal", !dateTo && "text-muted-foreground")}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateTo ? format(dateTo, "dd/MM/yyyy") : <span>Selecione a data</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
                                </PopoverContent>
                            </Popover>
                        </div>
                         <Button>
                            <Search className="mr-2 h-4 w-4" />
                            Buscar
                        </Button>
                    </div>
                </CardContent>
            </Card>
            
            <Dialog onOpenChange={(isOpen) => !isOpen && setSelectedTransaction(null)}>
                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <div>
                            <CardTitle>Histórico de Transações</CardTitle>
                            <CardDescription>Lista de receitas e despesas no período selecionado.</CardDescription>
                        </div>
                        <Button variant="outline">
                            <Download className="mr-2 h-4 w-4" />
                            Exportar
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex justify-center items-center h-24">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Data</TableHead>
                                        <TableHead>Descrição</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead className="text-right">Valor</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.length > 0 ? transactions.map((tx) => (
                                        <DialogTrigger asChild key={tx.id}>
                                            <TableRow className="cursor-pointer" onClick={() => setSelectedTransaction(tx)}>
                                                <TableCell>{tx.date}</TableCell>
                                                <TableCell className="font-medium">{tx.description}</TableCell>
                                                <TableCell>
                                                    <Badge variant={tx.type === 'revenue' ? 'default' : 'destructive'} className={tx.type === 'revenue' ? 'bg-accent text-accent-foreground' : ''}>
                                                        {tx.type === 'revenue' ? 'Receita' : 'Despesa'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className={`text-right font-semibold ${tx.type === 'revenue' ? 'text-green-600' : 'text-red-600'}`}>
                                                    R$ {tx.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>
                                            </TableRow>
                                        </DialogTrigger>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center">Nenhuma transação encontrada.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>

                {selectedTransaction && (
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Detalhes da Transação</DialogTitle>
                            <DialogDescription>
                                {selectedTransaction.description}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                             <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-muted-foreground">Valor</p>
                                    <p className={`font-semibold text-lg ${selectedTransaction.type === 'revenue' ? 'text-green-600' : 'text-red-600'}`}>
                                        R$ {selectedTransaction.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                </div>
                                 <div>
                                    <p className="text-muted-foreground">Data</p>
                                    <p className="font-semibold">{selectedTransaction.date}</p>
                                </div>
                                 <div>
                                    <p className="text-muted-foreground">Tipo de Lançamento</p>
                                    <p className="font-semibold">{selectedTransaction.originType}</p>
                                </div>
                                  <div>
                                    <p className="text-muted-foreground">ID de Origem</p>
                                    <p className="font-semibold">{selectedTransaction.originId.substring(0,12)}...</p>
                                </div>
                            </div>
                            <Separator />
                            <div>
                                <h4 className="font-medium text-sm mb-2">Ações</h4>
                                <Button asChild variant="outline" className="w-full">
                                    <Link href={getOriginLink(selectedTransaction)}>
                                        <LinkIcon className="mr-2 h-4 w-4" />
                                        Ver Lançamento de Origem
                                    </Link>
                                </Button>
                            </div>
                            {selectedTransaction.logs && selectedTransaction.logs.length > 0 && (
                                <>
                                <Separator />
                                <Collapsible>
                                    <CollapsibleTrigger className="flex items-center justify-between w-full font-medium mb-3 group text-sm">
                                        <div className="flex items-center gap-2">
                                            <FileClock className="h-5 w-5 text-primary" /> Log de Auditoria
                                        </div>
                                        <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                                        <div className="space-y-4 pl-7 pt-2">
                                            {selectedTransaction.logs.map((log, index) => (
                                                <div key={index} className="flex items-start gap-4">
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                                                        <Edit className="h-4 w-4 text-muted-foreground" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-sm">{log.action} por {log.user}</p>
                                                        <p className="text-xs text-muted-foreground">{log.date}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                                </>
                            )}
                        </div>
                    </DialogContent>
                )}
            </Dialog>

        </div>
    )
}
