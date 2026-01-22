
'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bell, LogOut, Settings, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { getAuth, signOut } from 'firebase/auth';
import { app } from '@/firebase/config';

export function UserNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useUser();
  
  const isAdmin = pathname.startsWith('/admin');

  const handleLogout = async () => {
    const auth = getAuth(app);
    try {
      await signOut(auth);
      // Clean up local storage on manual logout
      localStorage.removeItem('sessionToken');
      localStorage.removeItem('clientName');

      if (isAdmin) {
        router.push('/admin/login');
      } else {
        router.push('/');
      }
    } catch (error) {
      // Handle logout error
      console.error("Logout failed:", error);
    }
  };

  const userName = user?.displayName || user?.email || (isAdmin ? "Super Admin" : "Usuário");
  const userEmail = user?.email || (isAdmin ? "admin@fluxoadm.com" : "email@example.com");
  
  const getInitials = (name: string) => {
    const names = name.split(' ');
    const firstName = names[0] ?? '';
    const lastName = names.length > 1 ? names[names.length - 1] : '';
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const userInitials = getInitials(userName);

  const profilePath = isAdmin ? '/settings/profile' : '/settings/profile';
  const settingsPath = isAdmin ? '/settings' : '/settings';


  return (
    <>
      <Button variant="ghost" size="icon" className="rounded-full">
        <Bell className="h-5 w-5" />
        <span className="sr-only">Toggle notifications</span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full">
            <Avatar className="h-10 w-10 border-2 border-secondary">
              <AvatarImage src={user?.photoURL ?? undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground">{userInitials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{userName}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {userEmail}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={profilePath}>
              <User className="mr-2 h-4 w-4" />
              <span>Perfil</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={settingsPath}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Configurações</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sair</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
