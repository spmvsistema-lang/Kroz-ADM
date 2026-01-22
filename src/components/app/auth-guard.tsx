'use client';

import { useUser } from '@/firebase/auth/use-user';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useCallback } from 'react';
import { getFirestore, doc, getDoc, onSnapshot, collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { app, auth } from '@/firebase/config';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useIdleTimeout } from '@/hooks/use-idle-timeout';

interface AuthGuardProps {
  children: React.ReactNode;
  redirectIfAuthenticated?: boolean;
  redirectUrl?: string;
  unauthenticatedRedirectUrl?: string;
}

// Set the inactivity timeout to 30 minutes.
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

export function AuthGuard({
  children,
  redirectIfAuthenticated = false,
  redirectUrl = '/dashboard',
  unauthenticatedRedirectUrl = '/login',
}: AuthGuardProps) {
  const { user, isLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = useCallback(async (message: string) => {
      // Check if user is still logged in to avoid errors on quick navigation
      if(auth.currentUser) {
        await signOut(auth);
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('clientName');
        toast({
            variant: 'destructive',
            title: 'Sessão Encerrada',
            description: message,
        });
      }
  }, [toast]);

  const handleIdle = useCallback(() => {
    handleLogout('Sua sessão expirou por inatividade.');
  }, [handleLogout]);
  
  // This hook will automatically log out the user after a period of inactivity.
  // It's only active when a user is logged in, as the AuthGuard component
  // only renders its children (and thus runs this hook) for authenticated users.
  useIdleTimeout(handleIdle, INACTIVITY_TIMEOUT_MS);

  useEffect(() => {
    if (isLoading) return;

    if (redirectIfAuthenticated && user) {
        router.replace(redirectUrl);
        return;
    } 
    
    if (!redirectIfAuthenticated && !user) {
        router.replace(unauthenticatedRedirectUrl);
        return;
    }
    
    // Session validation logic
    if (user) {
        const firestore = getFirestore(app);
        
        // Function to find the user document, whether in a client's subcollection or root
        const findUserDocRef = async () => {
            const clientName = localStorage.getItem('clientName');
            if (clientName) {
                const userInClientRef = doc(firestore, "clients", clientName, "users", user.uid);
                const userInClientSnap = await getDoc(userInClientRef);
                if (userInClientSnap.exists()) {
                    return userInClientRef;
                }
            }
            
            // Fallback to check the root users collection (for Superadmins)
            const userInRootRef = doc(firestore, "users", user.uid);
            const userInRootSnap = await getDoc(userInRootRef);
            if (userInRootSnap.exists()) {
                return userInRootRef;
            }

            // NEW: Add check for supplier role
            const idTokenResult = await user.getIdTokenResult();
            if (idTokenResult.claims.role === 'fornecedor') {
                const suppliersQuery = query(collectionGroup(firestore, 'suppliers'), where('authUid', '==', user.uid));
                const suppliersSnapshot = await getDocs(suppliersQuery);
                if (!suppliersSnapshot.empty) {
                    // Return the ref of the first found supplier document for session validation.
                    return suppliersSnapshot.docs[0].ref;
                }
            }

            return null; // User not found in any valid collection
        };

        let unsubscribe: (() => void) | null = null;
        
        findUserDocRef().then(userDocRef => {
            if (!userDocRef) {
                handleLogout('Sua conta não foi encontrada. Por favor, faça login novamente.');
                return;
            }

            unsubscribe = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.metadata.hasPendingWrites) {
                    return;
                }
                
                if (!docSnap.exists()) {
                  handleLogout('Sua conta foi removida ou desativada. Por favor, faça login novamente.');
                  if (unsubscribe) unsubscribe();
                  return;
                }
        
                const userData = docSnap.data();
                const localToken = localStorage.getItem('sessionToken');
                
                if (userData.sessionToken && localToken && userData.sessionToken !== localToken) {
                  handleLogout('Uma nova sessão foi iniciada em outro dispositivo. Você foi desconectado.');
                  if (unsubscribe) unsubscribe();
                }
                
            }, (error) => {
                // If the error is 'permission-denied', it's likely due to logout.
                // The user is already being logged out, so we don't need to show an error toast.
                if (error.code === 'permission-denied') {
                    console.log('Snapshot listener permission denied, likely due to logout.');
                    if (unsubscribe) unsubscribe();
                    return; // Do not call handleLogout
                }

                console.error("Error listening to user document:", error);
                handleLogout('Erro de conexão. Por favor, faça login novamente.');
                if (unsubscribe) unsubscribe();
            });
        });

      return () => {
        if (unsubscribe) {
            unsubscribe();
        }
      };
    }
  }, [user, isLoading, router, redirectIfAuthenticated, redirectUrl, unauthenticatedRedirectUrl, handleLogout]);

  // Show a spinner while loading authentication state
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Conditions to prevent rendering children while redirecting
  if ((redirectIfAuthenticated && user) || (!redirectIfAuthenticated && !user)) {
    return null;
  }

  // Otherwise, render the protected children
  return <>{children}</>;
}
