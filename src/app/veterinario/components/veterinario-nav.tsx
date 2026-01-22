
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
import {
  FileText
} from 'lucide-react';
import { UserNav } from '@/components/app/user-nav';
import { useSidebar } from '@/components/ui/sidebar';
import Image from 'next/image';
import placeholderImages from '@/lib/placeholder-images.json';

const clientLogo = placeholderImages.placeholderImages.find(p => p.id === 'client-logo');

export function VeterinarioNav() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  const isActive = (path: string) => {
    return pathname === path;
  };

  const handleLinkClick = () => {
    setOpenMobile(false);
  }

  return (
    <>
      <SidebarHeader className="p-4">
          <Link href="/veterinario/notas" className="flex items-center justify-center">
             {clientLogo && (
                <Image
                    src={clientLogo.imageUrl}
                    width={140}
                    height={40}
                    alt="Client Logo"
                    className="rounded-sm"
                    data-ai-hint={clientLogo.imageHint}
                    priority
                    style={{ height: 'auto' }}
                />
            )}
          </Link>
      </SidebarHeader>

      <SidebarContent className="flex-1 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive('/veterinario/notas')} onClick={handleLinkClick}>
              <Link href="/veterinario/notas">
                <FileText />
                Minhas Notas
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="hidden p-2 md:hidden">
        <UserNav />
      </SidebarFooter>
    </>
  );
}
