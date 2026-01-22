
'use client';

import { useState, useMemo, useRef, useEffect } from "react";
import { PageHeader, PageHeaderDescription, PageHeaderHeading } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, Search, FileDown, Loader2, PieChart as PieChartIcon, BarChart2, Paperclip, Signature, Stamp, Trash2, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Bar, BarChart as RechartsBarChart, Pie, PieChart as RechartsPieChart, Cell, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import jspdf from 'jspdf';
import html2canvas from 'html2canvas';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Image from "next/image";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/firebase/config";
import { collection, query, where, getDocs, Timestamp, getDoc, doc } from "firebase/firestore";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUser } from "@/firebase/auth/use-user";

interface Transaction {
    venc: string;
    categoria: string;
    unid: string; // companyId
    fornec: string;
    docto: string;
    parc: string;
    valorNf: number;
    valorPg: number;
    banco: string;
    dataPgto: string;
    nfUrl?: string;
    boletoUrl?: string;
    costCenterId?: string | null;
}

interface Company {
    id: string;
    name: string;
}

interface CostCenter {
    id: string;
    name: string;
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#AF19FF", "#FF4560", "#775DD0"];


const SignatureModalContent = ({
  row
}: {
  row: any
}) => {
    
    return (
        <DialogContent className="max-w-xl">
            <DialogHeader>
                <DialogTitle>Documento: {row.fornec} - {row.docto}</DialogTitle>
                 <DialogDescription>
                    Visualização do documento anexado. A funcionalidade de assinatura e carimbo será implementada futuramente.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4">
                 <div className="relative border rounded-lg overflow-hidden bg-muted select-none aspect-[8.5/11]">
                    <Image src="https://picsum.photos/seed/invoice/800/1100" alt="Nota Fiscal" layout="fill" className="w-full h-full object-contain pointer-events-none" draggable={false} />
                </div>
            </div>
        </DialogContent>
    );
};


// Componente para a aba externa
const ReportTabContent = ({ title }: { title: string }) => {
    const { toast } = useToast();
    const clientName = typeof window !== 'undefined' ? localStorage.getItem('clientName') : null;

    const reportRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingPdf, setIsLoadingPdf] = useState(false);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [activeMonth, setActiveMonth] = useState('');

    useEffect(() => {
        setActiveMonth(format(new Date(), 'yyyy-MM'));
    }, []);

    useEffect(() => {
        if (!clientName) {
            setIsLoading(false);
            return;
        }
        const fetchTransactions = async () => {
            setIsLoading(true);
            try {
                const companiesQuery = query(collection(db, `clients/${clientName}/companies`));
                const companiesSnapshot = await getDocs(companiesQuery);
                const companiesData = companiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Company));
                setCompanies(companiesData);

                const purchaseOrdersQuery = query(collection(db, "clients", clientName, "purchaseOrders"));
                const expensesQuery = query(collection(db, "clients", clientName, "expenses"));

                const [purchaseOrdersSnapshot, expensesSnapshot] = await Promise.all([
                    getDocs(purchaseOrdersQuery),
                    getDocs(expensesQuery)
                ]);

                const allTransactions: Transaction[] = [];

                purchaseOrdersSnapshot.forEach(doc => {
                    const data = doc.data();
                    allTransactions.push({
                        venc: format(parseISO(data.deliveryDate), 'dd/MM/yyyy'),
                        categoria: data.onlineStoreCategory || 'Compra',
                        unid: data.companyId, // Assumindo que unid é companyId
                        fornec: data.supplierName,
                        docto: doc.id.substring(0, 7),
                        parc: 'Única', // Simplificação
                        valorNf: data.total,
                        valorPg: data.total, // Simplificação
                        banco: 'N/A', // Simplificação
                        dataPgto: data.date,
                        costCenterId: data.costCenterId || null,
                    });
                });
                 expensesSnapshot.forEach(doc => {
                    const data = doc.data();
                    allTransactions.push({
                        venc: format(parseISO(data.expenseDate), 'dd/MM/yyyy'),
                        categoria: data.category,
                        unid: data.companyId,
                        fornec: data.description,
                        docto: doc.id.substring(0, 7),
                        parc: 'Única',
                        valorNf: data.value,
                        valorPg: data.value,
                        banco: data.paymentMethod,
                        dataPgto: data.expenseDate,
                        costCenterId: data.costCenterId || null,
                    });
                });

                setTransactions(allTransactions);
            } catch (error) {
                toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os dados.' });
            } finally {
                setIsLoading(false);
            }
        };

        fetchTransactions();
    }, [clientName, toast]);

    const handleGeneratePdf = () => {
        setIsLoadingPdf(true);
        const input = reportRef.current;
        if (input) {
            html2canvas(input, { scale: 2, useCORS: true, backgroundColor: '#ffffff' }).then(canvas => {
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jspdf('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                const canvasWidth = canvas.width;
                const canvasHeight = canvas.height;
                const ratio = canvasWidth / canvasHeight;
                let imgHeight = pdfWidth / ratio;
                let heightLeft = imgHeight;
                let position = 0;

                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;

                while (heightLeft > 0) {
                    position -= pdfHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                    heightLeft -= pdfHeight;
                }

                pdf.save(`relatorio-prestacao-contas-${activeMonth}.pdf`);
                setIsLoadingPdf(false);
            });
        } else {
            setIsLoadingPdf(false);
        }
    };

    const monthOptions = useMemo(() => {
        const months = new Set(transactions.map(t => format(parseISO(t.dataPgto), 'yyyy-MM')));
        return Array.from(months).sort().reverse();
    }, [transactions]);
    
    const currentMonthData = useMemo(() => transactions.filter(t => format(parseISO(t.dataPgto), 'yyyy-MM') === activeMonth), [transactions, activeMonth]);

    const groupedByCompany = useMemo(() => {
        if (!currentMonthData.length) return {};
        const groups: { [key: string]: typeof currentMonthData } = {};
        
        currentMonthData.forEach(item => {
            const company = companies.find(c => c.id === item.unid);
            const companyName = company ? company.name : 'Empresa Desconhecida';
            if (!groups[companyName]) {
                groups[companyName] = [];
            }
            groups[companyName].push(item);
        });
        return groups;
    }, [currentMonthData, companies]);

    
    return (
        <Card className="mt-4">
            <CardHeader>
                 <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <CardTitle>{title}</CardTitle>
                        <CardDescription>Selecione um mês e clique em uma empresa para ver os detalhes.</CardDescription>
                    </div>
                     <div className="flex flex-wrap items-center gap-2">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" size="icon">
                                        <Download className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Exportar para Excel</p>
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" size="icon" onClick={handleGeneratePdf} disabled={isLoadingPdf}>
                                        {isLoadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Gerar Relatório PDF (da visão atual)</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div ref={reportRef} className="p-4 bg-background">
                     <Tabs defaultValue={activeMonth} onValueChange={setActiveMonth} className="w-full mt-6">
                        <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-6 print:hidden">
                            {monthOptions.map(month => (
                                 <TabsTrigger key={month} value={month}>{format(parseISO(month + '-01'), 'MMM/yyyy', { locale: ptBR })}</TabsTrigger>
                            ))}
                        </TabsList>
                        
                        <TabsContent value={activeMonth} className="pt-6">
                            {isLoading ? (
                                <div className="col-span-full h-24 text-center flex items-center justify-center">
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                </div>
                            ) : (
                            <Dialog>
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {Object.keys(groupedByCompany).length > 0 ? (
                                    Object.entries(groupedByCompany).map(([companyName, rows]) => {
                                        const total = rows.reduce((acc, cur) => acc + cur.valorPg, 0);
                                        return (
                                            <DialogTrigger asChild key={companyName}>
                                                <Card className="cursor-pointer hover:border-primary transition-colors">
                                                    <CardHeader>
                                                        <CardTitle>{companyName}</CardTitle>
                                                        <CardDescription>Clique para ver os detalhes</CardDescription>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <p className="text-sm text-muted-foreground">Total Pago no Mês</p>
                                                        <p className="text-2xl font-bold">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                    </CardContent>
                                                </Card>
                                            </DialogTrigger>
                                        )
                                    })
                                ) : (
                                    <div className="col-span-full h-24 text-center flex items-center justify-center">
                                        Nenhum lançamento para este mês.
                                    </div>
                                )}
                                </div>
                                
                                {Object.entries(groupedByCompany).map(([companyName, rows]) => (
                                    <DialogContent key={companyName} className="sm:max-w-4xl">
                                        <DialogHeader>
                                            <DialogTitle>Lançamentos de {companyName} - {format(parseISO(activeMonth + '-01'), 'MMMM/yyyy', { locale: ptBR })}</DialogTitle>
                                        </DialogHeader>
                                        <div className="py-4">
                                            <div className="overflow-x-auto">
                                                <Table className="min-w-full text-xs">
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Venc.</TableHead>
                                                            <TableHead>Categoria</TableHead>
                                                            <TableHead>Fornecedor</TableHead>
                                                            <TableHead>Valor Pago</TableHead>
                                                            <TableHead className="text-center">Anexos</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {rows.map((row, index) => (
                                                            <TableRow key={index} style={{ pageBreakInside: 'avoid' }}>
                                                                <TableCell>{row.venc}</TableCell>
                                                                <TableCell>{row.categoria}</TableCell>
                                                                <TableCell className="font-medium">{row.fornec}</TableCell>
                                                                <TableCell className="text-right">R$ {row.valorPg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                                                                <TableCell className="text-center">
                                                                    {(row.nfUrl || row.boletoUrl) ? (
                                                                        <Dialog>
                                                                            <DialogTrigger asChild>
                                                                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                                                                    <Paperclip className="h-4 w-4" />
                                                                                </Button>
                                                                            </DialogTrigger>
                                                                            <SignatureModalContent row={row} />
                                                                        </Dialog>
                                                                    ) : (
                                                                        <span className="text-muted-foreground">-</span>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    </DialogContent>
                                ))}
                            </Dialog>
                             )}
                        </TabsContent>
                    </Tabs>
                </div>
            </CardContent>
        </Card>
    );
}

export default function PrestacaoDeContasPage() {
    const { user } = useUser();
    const [tabPermissions, setTabPermissions] = useState<Record<string, boolean>>({});
    const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);
    const clientName = typeof window !== 'undefined' ? localStorage.getItem('clientName') : null;

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
    
                const rolesQuery = query(collection(db, 'roles'), where('clientId', '==', clientName), where('name', '==', userRole));
                const rolesSnapshot = await getDocs(rolesQuery);
                
                if (rolesSnapshot.empty) {
                    setTabPermissions({});
                    setIsLoadingPermissions(false);
                    return;
                }
                
                const roleData = rolesSnapshot.docs[0].data();
                const permissions = roleData.permissions?.['prestacao-de-contas'];
    
                if (permissions && typeof permissions === 'object' && permissions.tabs) {
                    setTabPermissions(permissions.tabs);
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
                <PageHeaderHeading>Prestação de Contas</PageHeaderHeading>
                <PageHeaderDescription>
                    Relatório mensal com todos os lançamentos financeiros.
                </PageHeaderDescription>
            </PageHeader>
            
            <Tabs defaultValue="interna" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    {(tabPermissions?.['interna'] !== false) && <TabsTrigger value="interna">Prestação de Contas Interna</TabsTrigger> }
                    {(tabPermissions?.['externa'] !== false) && <TabsTrigger value="externa">Prestação de Contas Externa</TabsTrigger> }
                </TabsList>
                {(tabPermissions?.['interna'] !== false) && 
                <TabsContent value="interna">
                    <InternalReport title="Prestação de Contas Interna"/>
                </TabsContent>
                }
                {(tabPermissions?.['externa'] !== false) && 
                <TabsContent value="externa">
                    <ReportTabContent title="Prestação de Contas Externa"/>
                </TabsContent>
                }
            </Tabs>
        </div>
    );
}

// O componente para a aba interna foi extraído para lidar com sua complexidade
const InternalReport = ({ title }: { title: string }) => {
    const { toast } = useToast();
    const clientName = typeof window !== 'undefined' ? localStorage.getItem('clientName') : null;
    
    const reportRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingPdf, setIsLoadingPdf] = useState(false);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [activeMonth, setActiveMonth] = useState('');

    const [companies, setCompanies] = useState<Company[]>([]);
    const [allCostCenters, setAllCostCenters] = useState<CostCenter[]>([]);

    const [filterCompany, setFilterCompany] = useState('all');
    const [filterCostCenter, setFilterCostCenter] = useState('all');
    const [filterCategory, setFilterCategory] = useState('all');

    useEffect(() => {
        setActiveMonth(format(new Date(), 'yyyy-MM'));
    }, []);

     useEffect(() => {
        if (!clientName) {
            setIsLoading(false);
            return;
        }
        const fetchTransactions = async () => {
            setIsLoading(true);
            try {
                // Fetch companies
                const companiesQuery = query(collection(db, `clients/${clientName}/companies`));
                const companiesSnapshot = await getDocs(companiesQuery);
                const companiesData = companiesSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name } as Company));
                setCompanies(companiesData);

                // Fetch all cost centers
                const costCentersData: CostCenter[] = [];
                for (const company of companiesData) {
                    const ccQuery = query(collection(db, `clients/${clientName}/companies/${company.id}/costCenters`));
                    const ccSnapshot = await getDocs(ccQuery);
                    ccSnapshot.forEach(doc => {
                        costCentersData.push({ id: doc.id, name: doc.data().name });
                    });
                }
                setAllCostCenters(costCentersData);

                // Fetch transactions
                const purchaseOrdersQuery = query(collection(db, "clients", clientName, "purchaseOrders"));
                const expensesQuery = query(collection(db, "clients", clientName, "expenses"));

                const [purchaseOrdersSnapshot, expensesSnapshot] = await Promise.all([
                    getDocs(purchaseOrdersQuery),
                    getDocs(expensesQuery)
                ]);

                const allTransactions: Transaction[] = [];

                purchaseOrdersSnapshot.forEach(doc => {
                    const data = doc.data();
                    allTransactions.push({
                        venc: format(parseISO(data.deliveryDate), 'dd/MM/yyyy'),
                        categoria: data.onlineStoreCategory || 'Compra',
                        unid: data.companyId,
                        fornec: data.supplierName,
                        docto: doc.id.substring(0, 7),
                        parc: 'Única',
                        valorNf: data.total,
                        valorPg: data.total,
                        banco: 'N/A',
                        dataPgto: data.date,
                        costCenterId: data.costCenterId || null,
                    });
                });
                 expensesSnapshot.forEach(doc => {
                    const data = doc.data();
                    allTransactions.push({
                        venc: format(parseISO(data.expenseDate), 'dd/MM/yyyy'),
                        categoria: data.category,
                        unid: data.companyId,
                        fornec: data.description,
                        docto: doc.id.substring(0, 7),
                        parc: 'Única',
                        valorNf: data.value,
                        valorPg: data.value,
                        banco: data.paymentMethod,
                        dataPgto: data.expenseDate,
                        costCenterId: data.costCenterId || null,
                    });
                });

                setTransactions(allTransactions);
            } catch (error) {
                toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os dados.' });
            } finally {
                setIsLoading(false);
            }
        };

        fetchTransactions();
    }, [clientName, toast]);

    const handleGeneratePdf = () => {
        setIsLoadingPdf(true);
        const input = reportRef.current;
        if (input) {
            html2canvas(input, { scale: 2, useCORS: true, backgroundColor: '#ffffff' }).then(canvas => {
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jspdf('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                const canvasWidth = canvas.width;
                const canvasHeight = canvas.height;
                const ratio = canvasWidth / canvasHeight;
                let imgHeight = pdfWidth / ratio;
                let heightLeft = imgHeight;
                let position = 0;

                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;

                while (heightLeft > 0) {
                    position -= pdfHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                    heightLeft -= pdfHeight;
                }
                
                pdf.save(`relatorio-interno-${activeMonth}.pdf`);
                setIsLoadingPdf(false);
            });
        } else {
            setIsLoadingPdf(false);
        }
    };
    
    const monthOptions = useMemo(() => {
        const months = new Set(transactions.map(t => format(parseISO(t.dataPgto), 'yyyy-MM')));
        return Array.from(months).sort().reverse();
    }, [transactions]);

    const categories = useMemo(() => [...new Set(transactions.map(item => item.categoria))], [transactions]);

    const filteredData = useMemo(() => {
        return transactions.filter(t => {
            const monthMatch = format(parseISO(t.dataPgto), 'yyyy-MM') === activeMonth;
            const companyMatch = filterCompany === 'all' || t.unid === filterCompany;
            const costCenterMatch = filterCostCenter === 'all' || t.costCenterId === filterCostCenter;
            const categoryMatch = filterCategory === 'all' || t.categoria === filterCategory;
            return monthMatch && companyMatch && costCenterMatch && categoryMatch;
        });
    }, [transactions, activeMonth, filterCompany, filterCostCenter, filterCategory]);

    const byCategory = useMemo(() => {
        if (!filteredData.length) return [];
        return categories.map(cat => ({
            name: cat,
            value: filteredData.filter(d => d.categoria === cat).reduce((acc, cur) => acc + cur.valorPg, 0)
        })).filter(item => item.value > 0);
    }, [filteredData, categories]);
    
    const bySupplier = useMemo(() => {
        if (!filteredData.length) return [];
        const supplierTotals: { [key: string]: number } = {};
        filteredData.forEach(item => {
            supplierTotals[item.fornec] = (supplierTotals[item.fornec] || 0) + item.valorPg;
        });
        return Object.entries(supplierTotals)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5); // Top 5
    }, [filteredData]);

    const totals = useMemo(() => {
        if (!filteredData.length) return { nf: 0, paid: 0, diff: 0 };
        const nf = filteredData.reduce((acc, cur) => acc + cur.valorNf, 0);
        const paid = filteredData.reduce((acc, cur) => acc + cur.valorPg, 0);
        const diff = paid - nf;
        return { nf, paid, diff };
    }, [filteredData]);

    const byUnit = useMemo(() => {
        if (!filteredData.length) return [];
        return companies.map(unit => ({
                name: unit.name,
                value: filteredData.filter(d => d.unid === unit.id).reduce((acc, cur) => acc + cur.valorPg, 0)
            }))
            .filter(item => item.value > 0);
    }, [filteredData, companies]);

    const futureForecast = useMemo(() => {
        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const monthShortNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

        const [currentYear, currentMonthNum] = activeMonth.split('-').map(Number);
        const currentMonthIndex = currentMonthNum - 1;

        const getMonthData = (monthIndex: number, year: number) => {
            const monthKey = format(new Date(year, monthIndex), 'yyyy-MM');
            const data = transactions.filter(t => format(parseISO(t.dataPgto), 'yyyy-MM') === monthKey);
            return {
                month: `${monthShortNames[monthIndex]}/${String(year).slice(-2)}`,
                value: data.reduce((acc, cur) => acc + cur.valorPg, 0)
            };
        };

        const currentMonthForecast = getMonthData(currentMonthIndex, currentYear);
        
        const nextMonthIndex = (currentMonthIndex + 1) % 12;
        const nextMonthYear = nextMonthIndex === 0 ? currentYear + 1 : currentYear;
        const nextMonthForecast = getMonthData(nextMonthIndex, nextMonthYear);

        return [currentMonthForecast, nextMonthForecast];
    }, [activeMonth, transactions]);

    const chartConfig = useMemo(() => {
        const config: any = {};
        byCategory.forEach((item, index) => {
            config[item.name] = { label: item.name, color: COLORS[index % COLORS.length] };
        });
        byUnit.forEach((item, index) => {
            if (!config[item.name]) { // Avoid overwriting
                config[item.name] = { label: item.name, color: COLORS[(index + byCategory.length) % COLORS.length] };
            }
        });
        futureForecast.forEach((item, index) => {
            config[item.month] = { label: item.month, color: COLORS[(index + byCategory.length + byUnit.length) % COLORS.length] };
        });
        return config;
    }, [byCategory, byUnit, futureForecast]);


    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const value = payload[0].value;
            const name = payload[0].name || payload[0].payload.name || label;
            return (
            <div className="p-2 text-xs bg-background/90 border rounded-md shadow-lg">
                <p className="font-bold">{`${name}`}</p>
                <p>{`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}</p>
            </div>
            );
        }
        return null;
    };

    const AnalyticsModalContent = () => (
        <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
                <DialogTitle>Resumo Visual - {format(parseISO(activeMonth + '-01'), 'MMMM/yyyy', { locale: ptBR })}</DialogTitle>
            </DialogHeader>
            <div className="py-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Totais do Mês</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Valor Total NF:</span>
                                <span className="font-medium">R$ {totals.nf.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Valor Total Pago:</span>
                                <span className="font-medium">R$ {totals.paid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Juros/Diferença:</span>
                                <span className={`font-medium ${totals.diff >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                                    R$ {totals.diff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">Previsão Futura</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ChartContainer config={chartConfig} className="w-full h-[250px]">
                                <RechartsBarChart data={futureForecast} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}>
                                    <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value/1000}k`} />
                                    <ChartTooltip content={<CustomTooltip />} />
                                    <Bar dataKey="value" name="Previsão" radius={[4, 4, 0, 0]}>
                                        {futureForecast.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index + 2 % COLORS.length]} />)}
                                    </Bar>
                                </RechartsBarChart>
                            </ChartContainer>
                        </CardContent>
                    </Card>
                </div>
                <div className="lg:col-span-2 grid md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Gasto por Categoria</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={150}>
                                <RechartsBarChart layout="vertical" data={byCategory.sort((a,b) => a.value - b.value)} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} width={80} />
                                    <ChartTooltip cursor={{ fill: 'rgba(206, 213, 224, 0.2)' }} content={<CustomTooltip />} />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                         {byCategory.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </RechartsBarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Top 5 Fornecedores</CardTitle>
                        </CardHeader>
                         <CardContent>
                            <ResponsiveContainer width="100%" height={150}>
                                <RechartsBarChart layout="vertical" data={bySupplier} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tick={{ fontSize: 10, width: 140 }} width={150} />
                                    <ChartTooltip cursor={{ fill: 'rgba(206, 213, 224, 0.2)' }} content={<CustomTooltip />} />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                        {bySupplier.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </RechartsBarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DialogContent>
    );

    return (
        <Card className="mt-4">
             <CardHeader className="print:hidden">
                 <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <CardTitle>{title}</CardTitle>
                        <CardDescription>Filtre os dados abaixo e exporte o relatório completo.</CardDescription>
                    </div>
                     <div className="flex flex-wrap items-center gap-2">
                        <TooltipProvider>
                            <Dialog>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                         <DialogTrigger asChild>
                                            <Button variant="outline" size="icon">
                                                <BarChart2 className="h-4 w-4" />
                                            </Button>
                                        </DialogTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Ver Resumo Visual</p>
                                    </TooltipContent>
                                </Tooltip>
                                <AnalyticsModalContent />
                            </Dialog>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="outline" size="icon">
                                        <Download className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Exportar para Excel</p>
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                     <Button variant="outline" size="icon" onClick={handleGeneratePdf} disabled={isLoadingPdf}>
                                        {isLoadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Gerar Relatório PDF</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div ref={reportRef} className="p-4 bg-background">
                    <h2 className="text-xl font-bold text-center mb-6">{`${title} - ${format(parseISO(activeMonth + '-01'), 'MMMM/yyyy', { locale: ptBR })}`}</h2>
                
                    <Tabs defaultValue={activeMonth} onValueChange={setActiveMonth} className="w-full mt-6">
                        <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-6 print:hidden">
                            {monthOptions.map(month => (
                                 <TabsTrigger key={month} value={month}>{format(parseISO(month + '-01'), 'MMM/yyyy', { locale: ptBR })}</TabsTrigger>
                            ))}
                        </TabsList>
                        
                        <TabsContent value={activeMonth}>
                            {isLoading ? (
                                <div className="h-64 flex items-center justify-center">
                                    <Loader2 className="h-8 w-8 animate-spin" />
                                </div>
                            ) : (
                            <Card>
                                <CardHeader className="border-b print:hidden">
                                    <div className="flex flex-wrap items-end gap-4">
                                        <div className="flex-1 min-w-[180px] space-y-2">
                                            <Label htmlFor="filter-company-internal">Empresa</Label>
                                            <Select value={filterCompany} onValueChange={setFilterCompany}>
                                                <SelectTrigger id="filter-company-internal"><SelectValue placeholder="Todas as Empresas" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">Todas as Empresas</SelectItem>
                                                    {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                         <div className="flex-1 min-w-[180px] space-y-2">
                                            <Label htmlFor="filter-cost-center-internal">Centro de Custo</Label>
                                            <Select value={filterCostCenter} onValueChange={setFilterCostCenter}>
                                                <SelectTrigger id="filter-cost-center-internal"><SelectValue placeholder="Todos os Centros" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">Todos os Centros de Custo</SelectItem>
                                                    {allCostCenters.map(cc => <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                         <div className="flex-1 min-w-[180px] space-y-2">
                                            <Label htmlFor="filter-category-internal">Categoria</Label>
                                            <Select value={filterCategory} onValueChange={setFilterCategory}>
                                                <SelectTrigger id="filter-category-internal"><SelectValue placeholder="Todas as Categorias" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">Todas as Categorias</SelectItem>
                                                    {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    <div className="overflow-x-auto">
                                        <Table className="min-w-full text-xs">
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="p-2 w-[7%]">Venc.</TableHead>
                                                    <TableHead className="p-2 w-[12%]">Categoria</TableHead>
                                                    <TableHead className="p-2 w-[8%]">Unid.</TableHead>
                                                    <TableHead className="p-2 w-[20%]">Fornecedor</TableHead>
                                                    <TableHead className="p-2 w-[7%]">Docto.</TableHead>
                                                    <TableHead className="p-2 w-[7%]">Parc.</TableHead>
                                                    <TableHead className="p-2 w-[8%] text-right">Valor NF</TableHead>
                                                    <TableHead className="p-2 w-[8%] text-right">Valor Pago</TableHead>
                                                    <TableHead className="p-2 w-[7%]">Banco</TableHead>
                                                    <TableHead className="p-2 w-[7%]">Data Pgto</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredData.length > 0 ? (
                                                    filteredData.map((row, index) => (
                                                    <TableRow key={index} style={{ pageBreakInside: 'avoid' }}>
                                                        <TableCell className="p-2">{row.venc}</TableCell>
                                                        <TableCell className="p-2 break-words">{row.categoria}</TableCell>
                                                        <TableCell className="p-2">{companies.find(c => c.id === row.unid)?.name || row.unid}</TableCell>
                                                        <TableCell className="p-2 font-medium break-words">{row.fornec}</TableCell>
                                                        <TableCell className="p-2">{row.docto}</TableCell>
                                                        <TableCell className="p-2">{row.parc}</TableCell>
                                                        <TableCell className="p-2 text-right">R$ {row.valorNf.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                                                        <TableCell className="p-2 text-right">R$ {row.valorPg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                                                        <TableCell className="p-2">{row.banco}</TableCell>
                                                        <TableCell className="p-2">{format(parseISO(row.dataPgto), 'dd/MM/yyyy')}</TableCell>
                                                    </TableRow>
                                                ))
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={10} className="h-24 text-center">Nenhum lançamento para os filtros selecionados.</TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    <div style={{ pageBreakBefore: 'always' }} />
                                     <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6" style={{ pageBreakInside: 'avoid' }}>
                                        <Card style={{ pageBreakInside: 'avoid' }}>
                                            <CardHeader>
                                                <CardTitle className="text-base flex items-center gap-2"><PieChartIcon className="h-5 w-5" />Despesas por Categoria</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <ChartContainer config={chartConfig} className="w-full h-[250px]">
                                                    <RechartsPieChart>
                                                        <ChartTooltip content={<CustomTooltip />} />
                                                        <Pie data={byCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60}>
                                                            {byCategory.map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                            ))}
                                                        </Pie>
                                                        <ChartLegend content={<ChartLegendContent nameKey="name" className="flex-wrap gap-2 [&>*]:basis-auto [&>*]:justify-center"/>} />
                                                    </RechartsPieChart>
                                                </ChartContainer>
                                            </CardContent>
                                        </Card>
                                        <Card style={{ pageBreakInside: 'avoid' }}>
                                            <CardHeader>
                                                <CardTitle className="text-base flex items-center gap-2"><PieChartIcon className="h-5 w-5" />Despesas por Unidade</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <ChartContainer config={chartConfig} className="w-full h-[250px]">
                                                    <RechartsPieChart>
                                                        <ChartTooltip content={<CustomTooltip />} />
                                                        <Pie data={byUnit} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60}>
                                                            {byUnit.map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                            ))}
                                                        </Pie>
                                                        <ChartLegend content={<ChartLegendContent nameKey="name" className="flex-wrap gap-2 [&>*]:basis-auto [&>*]:justify-center"/>} />
                                                    </RechartsPieChart>
                                                </ChartContainer>
                                            </CardContent>
                                        </Card>
                                        <Card style={{ pageBreakInside: 'avoid' }}>
                                            <CardHeader>
                                                <CardTitle className="text-base flex items-center gap-2"><BarChart2 className="h-5 w-5" />Previsão Futura</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <ChartContainer config={chartConfig} className="w-full h-[250px]">
                                                    <RechartsBarChart data={futureForecast} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}>
                                                        <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value/1000}k`} />
                                                        <ChartTooltip content={<CustomTooltip />} />
                                                        <Bar dataKey="value" name="Previsão" radius={[4, 4, 0, 0]}>
                                                            {futureForecast.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index + 2 % COLORS.length]} />)}
                                                        </Bar>
                                                    </RechartsBarChart>
                                                </ChartContainer>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </CardContent>
                            </Card>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>
            </CardContent>
        </Card>
    );
};
