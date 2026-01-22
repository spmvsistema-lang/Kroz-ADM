

'use client'

import { useState, useEffect } from 'react';
import { z } from 'zod';
import { columns } from './components/columns';
import { DataTable } from './components/data-table';
import { userSchema, User, Role } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, ArrowLeft } from 'lucide-react';
import { PageHeader, PageHeaderDescription, PageHeaderHeading } from '@/components/app/page-header';
import { useToast } from '@/hooks/use-toast';
import { DataTableRowActions } from './components/data-table-row-actions';
import { AddUserDialog } from './components/add-user-dialog';
import { db, app } from '@/firebase/config';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import Link from 'next/link';


export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [clientRoles, setClientRoles] = useState<Role[]>([]);
    const [userToEdit, setUserToEdit] = useState<User | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const clientName = typeof window !== 'undefined' ? localStorage.getItem('clientName') : null;


    useEffect(() => {
        const fetchData = async () => {
            if (!clientName) {
                setIsLoading(false);
                return;
            };

            setIsLoading(true);
            try {
                // Fetch Users for the specific client
                const usersQuery = query(collection(db, "clients", clientName, "users"));
                const usersSnapshot = await getDocs(usersQuery);
                const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
                
                // Zod validation can be tricky with Firestore Timestamps, so we handle it carefully
                const parsedUsers = z.array(userSchema).parse(usersData.map(u => ({...u, createdAt: u.createdAt?.toDate() || new Date() })));
                setUsers(parsedUsers);
                
                // Fetch Roles for the specific client
                const rolesQuery = query(collection(db, "clients", clientName, "roles"));
                const rolesSnapshot = await getDocs(rolesQuery);
                const rolesData = rolesSnapshot.docs.map(doc => ({ id: doc.id, value: doc.data().name, label: doc.data().name } as Role));
                setClientRoles(rolesData);

            } catch (error) {
                if (error instanceof z.ZodError) {
                     console.error("Zod validation error:", error.issues);
                     toast({ variant: 'destructive', title: 'Erro de Dados', description: 'Os dados de usuários recebidos são inválidos.' });
                } else {
                    toast({ variant: 'destructive', title: 'Erro de Conexão', description: 'Não foi possível carregar os usuários e funções.' });
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [clientName, toast]);

    const handleOpenAddModal = () => {
        setUserToEdit(null);
        setIsModalOpen(true);
    };
    
    const handleOpenEditModal = (user: User) => {
        setUserToEdit(user);
        setIsModalOpen(true);
    };

    const handleAddUser = async (newUserData: Omit<User, 'id'>, password?: string) => {
        if (!clientName || !newUserData.email || !password) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Email e senha são obrigatórios para criar um usuário.' });
            return;
        }

        const functions = getFunctions(app, 'southamerica-east1');
        const createClientUser = httpsCallable(functions, 'createClientUser');

        try {
            const result = await createClientUser({
                email: newUserData.email,
                password: password,
                displayName: newUserData.name,
                clientId: clientName,
                role: newUserData.role,
            });

            const data = result.data as { success: boolean; message?: string, uid?: string };

            if (data.success && data.uid) {
                const newUserWithId: User = { id: data.uid, ...newUserData };
                setUsers(prev => [newUserWithId, ...prev]);
                setIsModalOpen(false);
                toast({
                    title: "Usuário Adicionado!",
                    description: `${newUserData.name} foi cadastrado com sucesso.`,
                    className: "bg-accent text-accent-foreground",
                });
            } else {
                 throw new Error(data.message || "A função de criação retornou um erro inesperado.");
            }

        } catch (error: any) {
             let errorMessage = "Ocorreu um erro ao tentar criar o usuário.";
            if (error.code === 'functions/already-exists') {
                errorMessage = "Este endereço de e-mail já está em uso por outra conta.";
            } else if (error.message) {
                errorMessage = error.message;
            }
            toast({ variant: 'destructive', title: 'Erro ao Criar Usuário', description: errorMessage });
        }
    };

    const handleEditUser = async (updatedUser: User) => {
        if (!clientName) return;

        const functions = getFunctions(app, 'southamerica-east1');
        const updateUserFn = httpsCallable(functions, 'updateClientUser');

        try {
            await updateUserFn({ clientId: clientName, userData: updatedUser });

            setUsers(prev => prev.map(s => s.id === updatedUser.id ? updatedUser : s));
            setUserToEdit(null);
            setIsModalOpen(false);
            toast({
                title: "Usuário Atualizado!",
                description: `${updatedUser.name} foi atualizado com sucesso.`,
                className: "bg-accent text-accent-foreground",
            });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro', description: error.message || 'Não foi possível editar o usuário.' });
        }
    };

    const handleDeleteUser = async (userToDelete: User) => {
       if (!clientName) return;
        
       const functions = getFunctions(app, 'southamerica-east1');
       const deleteUserFn = httpsCallable(functions, 'deleteClientUser');

       try {
            await deleteUserFn({ clientId: clientName, userId: userToDelete.id });
            setUsers(prev => prev.filter(s => s.id !== userToDelete.id));
            toast({
                title: "Usuário Excluído!",
                description: `${userToDelete.name} foi removido com sucesso.`,
            });
       } catch(error: any) {
            toast({ variant: 'destructive', title: 'Erro', description: error.message || 'Não foi possível excluir o usuário.' });
       }
    };

    const dynamicColumns = columns.map(col => {
      if (col.id === 'actions') {
        return {
          ...col,
          cell: ({ row }: { row: { original: User } }) => (
            <DataTableRowActions 
              row={row} 
              onEdit={() => handleOpenEditModal(row.original)}
              onDelete={() => handleDeleteUser(row.original)}
            />
          ),
        };
      }
      return col;
    });

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <PageHeader>
                 <div>
                    <PageHeaderHeading>Usuários</PageHeaderHeading>
                    <PageHeaderDescription>
                        Adicione, edite e gerencie os usuários do sistema.
                    </PageHeaderDescription>
                </div>
                 <div className='flex gap-2'>
                     <Button variant="outline" asChild>
                        <Link href="/settings">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Voltar
                        </Link>
                    </Button>
                    <Button variant="secondary" onClick={handleOpenAddModal}>
                        <PlusCircle className="mr-2 h-4 w-4"/>
                        Adicionar Usuário
                    </Button>
                 </div>
            </PageHeader>
            <DataTable 
                columns={dynamicColumns} 
                data={users} 
                clientRoles={clientRoles} 
                onRowClick={handleOpenEditModal}
            />
            
            <AddUserDialog 
              open={isModalOpen} 
              onOpenChange={setIsModalOpen}
              onUserAdd={(userData, password) => handleAddUser(userData, password)} 
              onUserEdit={handleEditUser} 
              userToEdit={userToEdit}
              clientRoles={clientRoles}
            />
        </div>
    );
}
