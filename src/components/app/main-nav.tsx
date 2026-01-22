

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Logo } from '@/components/app/logo';
import {
  BarChart2,
  Building2,
  LayoutDashboard,
  Settings,
  Truck,
  ShoppingCart,
  DollarSign,
  CreditCard,
  ReceiptText,
  FileText,
  Landmark,
  TrendingUp,
  Tags,
  FileArchive,
  Stethoscope,
  Loader2,
} from 'lucide-react';
import { UserNav } from './user-nav';
import { useSidebar } from '../ui/sidebar';
import { useEffect, useState } from 'react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { useUser } from '@/firebase/auth/use-user';

const allMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { id: 'cadastros', label: 'Empresas', icon: Building2, href: '/cadastros' },
    { id: 'receitas', label: 'Receitas', icon: TrendingUp, href: '/receitas' },
    { id: 'fornecedores', label: 'Fornecedores', icon: Truck, href: '/fornecedores' },
    { id: 'veterinarios', label: 'Veterinários', icon: Stethoscope, href: '/veterinarios' },
    { id: 'cotacoes', label: 'Cotações', icon: Tags, href: '/cotacoes' },
    { id: 'compras', label: 'Compras', icon: ShoppingCart, href: '/compras' },
    { id: 'financeiro', label: 'Financeiro', icon: DollarSign, href: '/financeiro' },
    { id: 'pagamentos', label: 'Pagamentos', icon: CreditCard, href: '/pagamentos' },
    { id: 'fiscal', label: 'Fiscal', icon: FileArchive, href: '/fiscal' },
    { id: 'despesas', label: 'Despesas', icon: ReceiptText, href: '/despesas' },
    { id: 'contas-bancarias', label: 'Contas Bancárias', icon: Landmark, href: '/contas-bancarias' },
    { id: 'prestacao-de-contas', label: 'Prestação de Contas', icon: FileText, href: '/prestacao-de-contas' },
    { id: 'settings', label: 'Configurações', icon: Settings, href: '/settings' },
];

export function MainNav() {
  const pathname = usePathname();
  const { setOpenMobile, state: sidebarState } = useSidebar();
  const { user } = useUser();
  const [permissions, setPermissions] = useState<{[key: string]: any} | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPermissions = async () => {
        if (!user) return;
        const clientId = localStorage.getItem('clientName');
        if (!clientId) {
            setPermissions({});
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const userDocRef = doc(db, 'clients', clientId, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (!userDocSnap.exists()) {
                setPermissions({});
                setIsLoading(false);
                return;
            }
            const userRole = userDocSnap.data().role;
            if (userRole === 'Admin') {
                const clientRef = doc(db, "clients", clientId);
                const clientSnap = await getDoc(clientRef);
                if (clientSnap.exists()) {
                    setPermissions(clientSnap.data().permissions || {});
                } else {
                    setPermissions({});
                }
            } else {
                const rolesQuery = query(collection(db, "clients", clientId, "roles"), where("name", "==", userRole));
                const rolesSnapshot = await getDocs(rolesQuery);
                if (!rolesSnapshot.empty) {
                    setPermissions(rolesSnapshot.docs[0].data().permissions || {});
                } else {
                    setPermissions({});
                }
            }
        } catch (error) {
            console.error("Error fetching permissions:", error);
            setPermissions({});
        } finally {
            setIsLoading(false);
        }
    };
    if (user) fetchPermissions();
  }, [user]);

  const isActive = (path: string) => {
    return pathname.startsWith(path);
  };

  const handleLinkClick = () => {
    setOpenMobile(false);
  }
  
  const visibleMenuItems = allMenuItems.filter(item => {
    if (!permissions) return true; // Show all if no permissions object
    const permission = permissions[item.id];
    if (permission === undefined) return true; // Show if not specified
    if (permission === false) return false; // Hide if explicitly false
    if (typeof permission === 'object' && permission !== null && (permission as any).enabled === false) {
        return false; // Hide if it's an object with enabled: false
    }
    return true; // Show otherwise
  });

  return (
    <>
      <SidebarHeader className="p-4">
          <Link href="/dashboard" className="flex items-center justify-center">
            {sidebarState === 'expanded' && <Logo />}
          </Link>
      </SidebarHeader>

      <SidebarContent className="flex-1 p-2">
        <SidebarMenu>
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-sidebar-foreground" />
            </div>
          ) : (
            visibleMenuItems.map(item => (
                 <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton asChild isActive={isActive(item.href)} onClick={handleLinkClick} tooltip={item.label}>
                    <Link href={item.href}>
                        <item.icon />
                        {item.label}
                    </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            ))
          )}
        </SidebarMenu>

      </SidebarContent>

      <SidebarFooter className="hidden p-2 md:hidden">
        <UserNav />
      </SidebarFooter>
    </>
  );
}
