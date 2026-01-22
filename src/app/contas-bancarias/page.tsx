
'use client';

import { useState, useEffect } from 'react';
import { PageHeader, PageHeaderDescription, PageHeaderHeading } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Landmark, ArrowUpRight, ArrowDownLeft, Eye, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { db } from '@/firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface BankAccount {
    id: string;
    bankName: string;
    agency: string;
    account: string;
    companyId: string;
    balance: number;
    balanceEnabled: boolean;
}

interface Company {
    id: string;
    name: string;
}

interface Revenue {
    value: number;
    status: 'Recebido' | 'Pendente';
    bankAccount: string;
}

interface Expense {
    value: number;
    bankAccountId: string;
    status: 'Pago' | 'Pendente';
}

export default function ContasBancariasPage() {
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const clientName = typeof window !== 'undefined' ? localStorage.getItem('clientName') : null;

    useEffect(() => {
        if (!clientName) {
            setIsLoading(false);
            return;
        }

        const fetchAccountsAndCompanies = async () => {
            setIsLoading(true);
            try {
                // Fetch Companies
                const companiesQuery = query(collection(db, 'clients', clientName, 'companies'));
                const companiesSnapshot = await getDocs(companiesQuery);
                const companiesData = companiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Company));
                setCompanies(companiesData);

                // Fetch Bank Accounts
                const accountsQuery = query(collection(db, "clients", clientName, "bankAccounts"));
                const accountsSnapshot = await getDocs(accountsQuery);
                const accountsData = accountsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                } as BankAccount));
                
                // Fetch all transactions to calculate balances
                const revenuesQuery = query(collection(db, "clients", clientName, "revenues"), where("status", "==", "Recebido"));
                const expensesQuery = query(collection(db, "clients", clientName, "expenses"), where("status", "==", "Pago"));

                const [revenuesSnapshot, expensesSnapshot] = await Promise.all([
                    getDocs(revenuesQuery),
                    getDocs(expensesQuery),
                ]);

                const revenuesData = revenuesSnapshot.docs.map(doc => doc.data() as Revenue);
                const expensesData = expensesSnapshot.docs.map(doc => doc.data() as Expense);

                const accountsWithBalance = accountsData.map(account => {
                    const accountRevenues = revenuesData
                        .filter(rev => rev.bankAccount === account.id)
                        .reduce((sum, rev) => sum + rev.value, 0);
                    
                    const accountExpenses = expensesData
                        .filter(exp => exp.bankAccountId === account.id)
                        .reduce((sum, exp) => sum + exp.value, 0);

                    const calculatedBalance = accountRevenues - accountExpenses;
                    
                    return { ...account, balance: calculatedBalance };
                });

                setBankAccounts(accountsWithBalance);

            } catch (error) {
                toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os dados.' });
            } finally {
                setIsLoading(false);
            }
        };

        fetchAccountsAndCompanies();
    }, [clientName, toast]);
    
    const getCompanyName = (companyId: string) => {
        return companies.find(c => c.id === companyId)?.name || 'Empresa não encontrada';
    }


    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }


    return (
        <div className="space-y-6">
            <PageHeader>
                <PageHeaderHeading>Contas Bancárias</PageHeaderHeading>
                <PageHeaderDescription>
                    Gerencie o saldo e extrato de cada conta bancária.
                </PageHeaderDescription>
            </PageHeader>

            {bankAccounts.length === 0 ? (
                 <Card>
                    <CardContent className="p-6 text-center">
                        <p className="text-muted-foreground">Nenhuma conta bancária cadastrada. Vá em <Link href="/cadastros" className="text-primary underline">Cadastros</Link> para adicionar uma.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {bankAccounts.map((account) => (
                        <Card key={account.id} className="flex flex-col">
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <Landmark className="h-5 w-5 text-muted-foreground" />
                                            {account.bankName}
                                        </CardTitle>
                                        <CardDescription>{getCompanyName(account.companyId)}</CardDescription>
                                    </div>
                                    <Badge variant={account.balanceEnabled ? "default" : "outline"} className={account.balanceEnabled ? 'bg-accent text-accent-foreground' : ''}>
                                        {account.balanceEnabled ? 'Saldo Ativo' : 'Saldo Inativo'}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-grow space-y-4">
                                <div>
                                    <p className="text-xs text-muted-foreground">Agência: {account.agency} | Conta: {account.account}</p>
                                </div>
                                {account.balanceEnabled ? (
                                    <div>
                                        <p className="text-sm text-muted-foreground">Saldo Atual</p>
                                        <p className="text-2xl font-bold">
                                            R$ {account.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground bg-muted/50 p-4 rounded-md">
                                        <p>O controle de saldo está desativado para esta conta.</p>
                                    </div>
                                )}
                                <div className="flex gap-4 text-sm">
                                    <div className="flex items-center gap-1 text-green-600">
                                        <ArrowUpRight className="h-4 w-4" />
                                        <span>Receitas (Em breve)</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-red-600">
                                        <ArrowDownLeft className="h-4 w-4" />
                                        <span>Despesas (Em breve)</span>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button className="w-full" asChild>
                                    <Link href={`/contas-bancarias/${account.id}/extrato`}>
                                        <Eye className="mr-2 h-4 w-4" />
                                        Ver Extrato
                                    </Link>
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
