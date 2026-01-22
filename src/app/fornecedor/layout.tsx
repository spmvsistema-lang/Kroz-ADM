
'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { SupplierNav } from './components/supplier-nav';
import { Header } from '@/components/app/header';
import Image from 'next/image';
import { ClientProviders } from '@/components/app/client-providers';
import { AuthGuard } from '@/components/app/auth-guard';

export default function SupplierLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isSelectionPage = pathname === '/fornecedor/selecao-cliente';

  const LayoutContent = (
    <>
      {!isSelectionPage && (
        <Sidebar className="border-r">
          <Suspense>
            <SupplierNav />
          </Suspense>
        </Sidebar>
      )}
      <SidebarInset>
        <Header />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
        <footer className="flex flex-col items-center justify-center gap-2 p-4 border-t bg-background">
            <div className="flex items-center gap-4">
                <Image src="/Logo PrayTech.png" alt="PrayTech Logo" width={80} height={27} className="dark:invert" style={{ height: 'auto' }} />
            </div>
            <p className="text-xs text-muted-foreground">&copy; 2024 <a href="https://pray-tech.com" target="_blank" rel="noopener noreferrer" className="hover:underline">PrayTech Solutions</a>. Todos os direitos reservados.</p>
        </footer>
      </SidebarInset>
    </>
  );

  return (
    <AuthGuard unauthenticatedRedirectUrl="/login/fornecedores">
      <ClientProviders>
        {LayoutContent}
      </ClientProviders>
    </AuthGuard>
  );
}
