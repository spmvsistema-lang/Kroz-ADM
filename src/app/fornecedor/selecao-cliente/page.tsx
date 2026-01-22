'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase/auth/use-user';
import { db } from '@/firebase/config';
import { collectionGroup, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Building } from 'lucide-react';
import { PageHeader, PageHeaderHeading, PageHeaderDescription } from '@/components/app/page-header';

interface ClientInfo {
    id: string;
    name: string;
    logoUrl?: string | null;
}

export default function SelecaoClientePage() {
    const { user, isLoading: isUserLoading } = useUser();
    const router = useRouter();
    const [clients, setClients] = useState<ClientInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (isUserLoading) return;
        if (!user) {
            router.replace('/login/fornecedores');
            return;
        }

        const fetchClients = async () => {
            setIsLoading(true);
            try {
                const suppliersQuery = query(collectionGroup(db, 'suppliers'), where('authUid', '==', user.uid));
                const querySnapshot = await getDocs(suppliersQuery);

                const clientPromises = querySnapshot.docs.map(async (supplierDoc) => {
                    const clientId = supplierDoc.ref.parent.parent?.id;
                    if (!clientId) return null;

                    const clientDocRef = doc(db, 'clients', clientId);
                    const clientDocSnap = await getDoc(clientDocRef);

                    if (clientDocSnap.exists()) {
                        const clientData = clientDocSnap.data();
                        return {
                            id: clientId,
                            name: clientData.name,
                            logoUrl: clientData.logoUrl,
                        };
                    }
                    return null;
                });

                const clientsData = (await Promise.all(clientPromises)).filter((c): c is ClientInfo => c !== null);
                
                const uniqueClients = Array.from(new Map(clientsData.map(c => [c.id, c])).values());
                
                setClients(uniqueClients);

            } catch (error) {
                console.error("Error fetching supplier's clients:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchClients();

    }, [user, isUserLoading, router]);

    const handleClientSelect = (clientId: string) => {
        localStorage.setItem('clientName', clientId);
        router.push('/fornecedor/pedidos');
    };

    if (isLoading || isUserLoading) {
        return (
            <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <div className="space-y-6">
            <PageHeader>
                <PageHeaderHeading>Bem-vindo, {user?.displayName || 'Fornecedor'}</PageHeaderHeading>
                <PageHeaderDescription>
                    Selecione um cliente para visualizar os pedidos de compra.
                </PageHeaderDescription>
            </PageHeader>
            {clients.length > 0 ? (
                 <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {clients.map((client) => (
                        <Card key={client.id} className="cursor-pointer hover:border-primary transition-colors flex flex-col" onClick={() => handleClientSelect(client.id)}>
                            <CardHeader className="flex-grow">
                                <div className="flex items-center gap-4">
                                     {client.logoUrl ? (
                                        <img src={client.logoUrl} alt={`${client.name} logo`} className="h-12 w-auto max-w-24 object-contain rounded-md" />
                                     ) : (
                                        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
                                            <Building className="h-6 w-6 text-muted-foreground" />
                                        </div>
                                     )}
                                    <CardTitle>{client.name}</CardTitle>
                                </div>
                            </CardHeader>
                             <CardContent>
                                <Button className="w-full">Acessar Pedidos</Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card>
                    <CardContent className="p-8 text-center">
                        <p className="text-muted-foreground">Você ainda não foi cadastrado como fornecedor por nenhum cliente.</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
