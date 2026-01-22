
'use client'
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { SidebarProvider, Sidebar, SidebarInset, SidebarRail } from '@/components/ui/sidebar';
import { Header } from '@/components/app/header';
import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/app/logo';
import { MainNav } from '@/components/app/main-nav';
import Image from 'next/image';
import { ClientProviders } from '@/components/app/client-providers';
import { AuthProvider } from '@/firebase/auth/provider';
import { AuthGuard } from '@/components/app/auth-guard';

// export const metadata: Metadata = {
//   title: 'Kroz ADM',
//   description: 'Sistema de Gestão Administrativa',
// };

function isAuthPage(pathname: string) {
    const authPaths = [
        '/',
        '/login',
        '/login/fornecedores',
        '/admin/login',
        '/admin/signup',
        '/veterinario/login',
    ];
    return authPaths.includes(pathname);
}

function isAdminArea(pathname: string) {
    return pathname.startsWith('/admin') && !pathname.endsWith('/login');
}

function isSupplierPortal(pathname: string) {
    // Ajustado para ser mais específico e não capturar '/fornecedores'
    return pathname.startsWith('/fornecedor/') && !pathname.endsWith('/login');
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const authPage = isAuthPage(pathname);
  const adminArea = isAdminArea(pathname);
  const supplierPortal = isSupplierPortal(pathname);
  const showAppLayout = !authPage && !adminArea && !supplierPortal;

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <title>Kroz ADM</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <AuthProvider>
            {showAppLayout ? (
                <AuthGuard>
                    <ClientProviders>
                        <Sidebar className="border-r" collapsible="icon">
                            <SidebarRail />
                            <Suspense>
                                <MainNav />
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
            ) : (
                <main className="flex-1">{children}</main>
            )}
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
