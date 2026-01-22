
import { Suspense } from 'react';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { VeterinarioNav } from './components/veterinario-nav';
import { Header } from '@/components/app/header';
import Image from 'next/image';
import { ClientProviders } from '@/components/app/client-providers';
import { AuthGuard } from '@/components/app/auth-guard';

export default function VeterinarioLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthGuard unauthenticatedRedirectUrl="/veterinario/login">
      <ClientProviders>
        <Sidebar className="border-r">
          <Suspense>
            <VeterinarioNav />
          </Suspense>
        </Sidebar>
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
      </ClientProviders>
    </AuthGuard>
  );
}
