
'use client';

import { useState, useEffect } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '@/components/ui/card';
  import { Button } from '@/components/ui/button';
  import { ShieldCheck, Users, Activity, DollarSign, PlusCircle, History, UserCog, Loader2 } from 'lucide-react';
  import Link from 'next/link';
  import { collection, getDocs } from 'firebase/firestore';
  import { db } from '@/firebase/config';
  import { useToast } from '@/hooks/use-toast';
  import type { Client } from '@/lib/clients-data';
  
  export default function AdminDashboardPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        const fetchClients = async () => {
            setIsLoading(true);
            try {
                const querySnapshot = await getDocs(collection(db, "clients"));
                const clientsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Client[];
                setClients(clientsData);
            } catch (error) {
                console.error("Erro ao buscar clientes: ", error);
                toast({
                    variant: "destructive",
                    title: "Erro ao buscar clientes",
                    description: "Não foi possível carregar os dados dos clientes do banco de dados.",
                });
            } finally {
                setIsLoading(false);
            }
        };
        fetchClients();
    }, [toast]);

    const totalClients = clients.length;
    const activeLicenses = clients.filter(c => c.licenseActive).length;
    
    const monthlyRecurringRevenue = clients
        .filter(c => c.licenseActive)
        .reduce((total, client) => total + (client.planPrice || 0), 0);

    if (isLoading) {
        return <div className="flex h-64 w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
    }

    return (
      <div className="flex flex-col gap-6">
        <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary">Dashboard do Super Admin</h1>
            <p className="text-muted-foreground">Visão geral e gestão da plataforma Kroz ADM.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total de Clientes
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalClients}</div>
              <p className="text-xs text-muted-foreground">
                Clientes cadastrados na plataforma.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Licenças Ativas</CardTitle>
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeLicenses}</div>
              <p className="text-xs text-muted-foreground">
                {totalClients > 0 ? ((activeLicenses / totalClients) * 100).toFixed(0) : 0}% do total
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Faturamento (MRR)</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {monthlyRecurringRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                Receita mensal recorrente.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Atividade do Sistema
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Normal</div>
              <p className="text-xs text-muted-foreground">
                Última verificação há 5 minutos
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                <Button asChild variant="outline">
                    <Link href="/admin/licenses">
                        <PlusCircle className="mr-2 h-4 w-4" /> Cadastrar Cliente
                    </Link>
                </Button>
                <Button asChild variant="outline">
                    <Link href="/admin/logs">
                        <History className="mr-2 h-4 w-4" /> Ver Logs do Sistema
                    </Link>
                </Button>
                 <Button asChild variant="outline">
                    <Link href="/admin/superadmins">
                        <UserCog className="mr-2 h-4 w-4" /> Gerenciar Super Admins
                    </Link>
                </Button>
            </CardContent>
        </Card>
      </div>
    );
  }
