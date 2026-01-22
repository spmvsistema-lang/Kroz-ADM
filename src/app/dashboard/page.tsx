
'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  CreditCard,
  DollarSign,
  Loader2,
  ShoppingCart,
  Users,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { Bar, BarChart as RechartsBarChart, XAxis, YAxis, CartesianGrid } from 'recharts';
import { db } from '@/firebase/config';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { format, subMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';


interface Revenue {
    id: string;
    value: number;
    status: 'Recebido' | 'Pendente';
    date: string; // yyyy-MM-dd
}

interface PurchaseOrder {
    id: string;
    total: number;
    status: 'Aguardando Pagamento' | 'Concluído' | 'Aguardando Documentos' | 'Aguardando Aprovação' | 'Entrega Atrasada';
    supplierName: string;
    date: string; // yyyy-MM-dd
    deliveryDate: string; // yyyy-MM-dd
}

interface Expense {
    id: string;
    description: string;
    value: number;
    expenseDate: string; // yyyy-MM-dd
}

interface UpcomingPayment {
    id: string;
    description: string;
    dueDate: string;
    value: number;
    status: 'Aguardando Pagamento' | 'Entrega Atrasada';
}

interface ChartData {
  month: string;
  entradas: number;
  saidas: number;
}


const chartConfig = {
  entradas: {
    label: 'Entradas',
    color: 'hsl(var(--chart-2))',
  },
  saidas: {
    label: 'Saídas',
    color: 'hsl(var(--destructive))',
  },
} satisfies ChartConfig;

export default function DashboardPage() {
    const [totalRevenue, setTotalRevenue] = useState(0);
    const [accountsReceivable, setAccountsReceivable] = useState(0);
    const [accountsPayable, setAccountsPayable] = useState(0);
    const [purchaseOrderCount, setPurchaseOrderCount] = useState(0);
    const [upcomingPayments, setUpcomingPayments] = useState<UpcomingPayment[]>([]);
    const [chartData, setChartData] = useState<ChartData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const clientName = typeof window !== 'undefined' ? localStorage.getItem('clientName') : null;

    useEffect(() => {
        if (!clientName) {
            setIsLoading(false);
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch Revenues
                const revenuesQuery = query(collection(db, "clients", clientName, "revenues"));
                const revenuesSnapshot = await getDocs(revenuesQuery);
                const revenuesData = revenuesSnapshot.docs.map(doc => doc.data() as Revenue);

                const totalRev = revenuesData.reduce((acc, cur) => acc + cur.value, 0);
                const accountsRec = revenuesData.filter(r => r.status === 'Pendente').reduce((acc, cur) => acc + cur.value, 0);
                setTotalRevenue(totalRev);
                setAccountsReceivable(accountsRec);

                // Fetch Purchase Orders
                const purchaseOrdersQuery = query(collection(db, "clients", clientName, "purchaseOrders"));
                const purchaseOrdersSnapshot = await getDocs(purchaseOrdersQuery);
                const purchaseOrdersData = purchaseOrdersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseOrder));

                // Fetch Expenses
                const expensesQuery = query(collection(db, "clients", clientName, "expenses"));
                const expensesSnapshot = await getDocs(expensesQuery);
                const expensesData = expensesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));

                // Calculate Accounts Payable
                const purchaseOrdersPayable = purchaseOrdersData
                    .filter(o => o.status === 'Aguardando Pagamento')
                    .reduce((acc, cur) => acc + cur.total, 0);
                
                const expensesPayable = expensesData.reduce((acc, cur) => acc + cur.value, 0);
                setAccountsPayable(purchaseOrdersPayable + expensesPayable);
                setPurchaseOrderCount(purchaseOrdersData.length);
                
                // Combine upcoming payments
                 const upcomingFromPurchases: UpcomingPayment[] = purchaseOrdersData
                    .filter(o => o.status === 'Aguardando Pagamento' || o.status === 'Entrega Atrasada')
                    .map(o => ({
                        id: o.id,
                        description: o.supplierName,
                        dueDate: o.deliveryDate,
                        value: o.total,
                        status: o.status === 'Entrega Atrasada' ? 'Entrega Atrasada' : 'Aguardando Pagamento',
                    }));

                const now = new Date();
                now.setHours(0, 0, 0, 0);

                const upcomingFromExpenses: UpcomingPayment[] = expensesData.map(e => {
                    const dueDate = new Date(e.expenseDate);
                    const status = dueDate < now ? 'Entrega Atrasada' : 'Aguardando Pagamento'; // Simplified status for expenses
                    return {
                        id: e.id,
                        description: e.description,
                        dueDate: e.expenseDate,
                        value: e.value,
                        status: status,
                    };
                });

                const combinedUpcoming = [...upcomingFromPurchases, ...upcomingFromExpenses]
                    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                    .slice(0, 5);

                setUpcomingPayments(combinedUpcoming);


                // Process data for chart
                if (revenuesData.length > 0 || purchaseOrdersData.length > 0 || expensesData.length > 0) {
                    const sixMonthsAgo = subMonths(new Date(), 5);
                    sixMonthsAgo.setDate(1);

                    const monthlyData: { [key: string]: { entradas: number, saidas: number } } = {};

                    for (let i = 5; i >= 0; i--) {
                        const month = format(subMonths(new Date(), i), 'MMM/yy', { locale: ptBR });
                        monthlyData[month] = { entradas: 0, saidas: 0 };
                    }

                    revenuesData.forEach(rev => {
                        try {
                            const revDate = parseISO(rev.date);
                            if (revDate >= sixMonthsAgo) {
                                const month = format(revDate, 'MMM/yy', { locale: ptBR });
                                if (monthlyData[month]) {
                                    monthlyData[month].entradas += rev.value;
                                }
                            }
                        } catch (e) {
                            console.warn(`Invalid date format for revenue: ${rev.date}`);
                        }
                    });
                    
                    purchaseOrdersData.forEach(order => {
                        try {
                             const orderDate = parseISO(order.date);
                             if (orderDate >= sixMonthsAgo) {
                                const month = format(orderDate, 'MMM/yy', { locale: ptBR });
                                if (monthlyData[month]) {
                                     monthlyData[month].saidas += order.total;
                                }
                            }
                        } catch (e) {
                             console.warn(`Invalid date format for purchase order: ${order.date}`);
                        }
                    });

                    expensesData.forEach(expense => {
                        try {
                            const expenseDate = parseISO(expense.expenseDate);
                            if (expenseDate >= sixMonthsAgo) {
                                const month = format(expenseDate, 'MMM/yy', { locale: ptBR });
                                if (monthlyData[month]) {
                                    monthlyData[month].saidas += expense.value;
                                }
                            }
                        } catch (e) {
                            console.warn(`Invalid date format for expense: ${expense.expenseDate}`);
                        }
                    });

                    const processedChartData = Object.entries(monthlyData)
                        .map(([month, values]) => ({ month, ...values }));

                    setChartData(processedChartData);
                } else {
                    setChartData([]);
                }


            } catch (error) {
                console.error("Failed to fetch dashboard data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [clientName]);
    
    if (isLoading) {
        return <div className="flex h-64 w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
    }


  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Faturamento Total
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">
              +20.1% do último mês (simulado)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contas a Receber</CardTitle>
            <ArrowUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {accountsReceivable.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">
              +18.1% do último mês (simulado)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contas a Pagar</CardTitle>
            <ArrowDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {accountsPayable.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">
              +19% do último mês (simulado)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Ordens de Compra
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{purchaseOrderCount}</div>
            <p className="text-xs text-muted-foreground">
              Total de OCs criadas
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-primary">Fluxo de Caixa Mensal</CardTitle>
            <CardDescription>
              Entradas e saídas dos últimos 6 meses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
                <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
                    <RechartsBarChart accessibilityLayer data={chartData}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="month"
                            tickLine={false}
                            tickMargin={10}
                            axisLine={false}
                        />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar dataKey="entradas" fill="var(--color-entradas)" radius={4} />
                        <Bar dataKey="saidas" fill="var(--color-saidas)" radius={4} />
                    </RechartsBarChart>
                </ChartContainer>
            ) : (
                <div className="flex h-[200px] w-full items-center justify-center text-sm text-muted-foreground">
                    Nenhum dado de fluxo de caixa para exibir.
                </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-primary">Contas a Pagar</CardTitle>
            <CardDescription>
              Próximos vencimentos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor/Despesa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingPayments.length > 0 ? (
                    upcomingPayments.map((payment) => (
                        <TableRow key={payment.id}>
                            <TableCell>
                                <div className="font-medium">{payment.description}</div>
                                <div className="text-sm text-muted-foreground">
                                Vence em: {format(new Date(payment.dueDate), 'dd/MM/yyyy')}
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant={payment.status === "Entrega Atrasada" ? "destructive" : "secondary"}>{payment.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right">R$ {payment.value.toFixed(2)}</TableCell>
                        </TableRow>
                    ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={3} className="h-24 text-center">
                            Nenhuma conta a pagar pendente.
                        </TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
