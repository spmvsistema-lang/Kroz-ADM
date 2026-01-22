
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
  SidebarGroup,
  SidebarGroupLabel,
} from '@/components/ui/sidebar';
import { Logo } from '@/components/app/logo';
import {
  LayoutDashboard,
  ShieldCheck,
  History,
  Users,
  UserCog,
  Lock,
} from 'lucide-react';
import { UserNav } from '@/components/app/user-nav';
import { useSidebar } from '@/components/ui/sidebar';

export function AdminNav() {
  const pathname = usePathname();
  const { setOpenMobile, state: sidebarState } = useSidebar();

  const isActive = (path: string) => {
    return pathname === path;
  };

  const handleLinkClick = () => {
    setOpenMobile(false);
  }

  return (
    <>
      <SidebarHeader className="p-4">
          <Link href="/admin/dashboard" className="flex items-center justify-center">
            {sidebarState === 'expanded' && <Logo />}
          </Link>
      </SidebarHeader>

      <SidebarContent className="flex-1 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive('/admin/dashboard')} onClick={handleLinkClick} tooltip="Dashboard">
              <Link href="/admin/dashboard">
                <LayoutDashboard />
                Dashboard
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        
        <SidebarGroup>
            <SidebarGroupLabel>Gestão do Sistema</SidebarGroupLabel>
                <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive('/admin/licenses')} onClick={handleLinkClick} tooltip="Cadastro de Clientes">
                    <Link href="/admin/licenses">
                        <Users />
                        Cadastro de Clientes
                    </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive('/admin/permissions')} onClick={handleLinkClick} tooltip="Permissões do Cliente">
                    <Link href="/admin/permissions">
                        <Lock />
                        Permissões
                    </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive('/admin/logs')} onClick={handleLinkClick} tooltip="Logs">
                    <Link href="/admin/logs">
                        <History />
                        Logs do Sistema
                    </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                 <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive('/admin/superadmins')} onClick={handleLinkClick} tooltip="Super Admins">
                    <Link href="/admin/superadmins">
                        <UserCog />
                        Super Admins
                    </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="hidden p-2 md:hidden">
        <UserNav />
      </SidebarFooter>
    </>
  );
}
