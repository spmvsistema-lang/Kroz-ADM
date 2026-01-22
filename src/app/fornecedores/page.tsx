
'use client'

import { useState, useEffect } from 'react';
import { z } from 'zod';
import { columns } from './components/columns';
import { DataTable } from './components/data-table';
import { supplierSchema, Supplier } from '@/lib/clients-data';
import { PageHeader, PageHeaderDescription, PageHeaderHeading } from '@/components/app/page-header';
import { AddSupplierDialog } from './components/add-supplier-dialog';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DataTableRowActions } from './components/data-table-row-actions';
import { db, app } from '@/firebase/config';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getFunctions, httpsCallable } from "firebase/functions";


export default function FornecedoresPage() {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    // Em uma aplicação real, o clientName viria do contexto de autenticação.
    const clientName = typeof window !== 'undefined' ? localStorage.getItem('clientName') : null;


    useEffect(() => {
        const fetchSuppliers = async () => {
            if (!clientName) {
                setIsLoading(false);
                return;
            };

            setIsLoading(true);
            try {
                const q = query(collection(db, "clients", clientName, "suppliers"));
                const querySnapshot = await getDocs(q);
                const suppliersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
                const parsedSuppliers = z.array(supplierSchema).parse(suppliersData);
                setSuppliers(parsedSuppliers);
            } catch (error) {
                if (error instanceof z.ZodError) {
                    console.error("Erro de validação do Zod:", error.issues);
                     toast({ variant: 'destructive', title: 'Erro de Dados', description: 'Os dados de fornecedores recebidos são inválidos.' });
                } else if ((error as any).code) {
                    // Firestore/network error
                    toast({ variant: 'destructive', title: 'Erro de Conexão', description: 'Não foi possível carregar os fornecedores.' });
                }
            } finally {
                setIsLoading(false);
            }
        };

        if(clientName) fetchSuppliers();
        else setIsLoading(false);
    }, [clientName, toast]);

    const handleOpenAddModal = () => {
        setSupplierToEdit(null);
        setIsModalOpen(true);
    };
    
    const handleOpenEditModal = (supplier: Supplier) => {
        setSupplierToEdit(supplier);
        setIsModalOpen(true);
    };

    const handleAddSupplier = async (newSupplierData: Omit<Supplier, 'id'>, password?: string) => {
        if (!clientName) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Cliente não identificado.' });
            return;
        }

        try {
            // First, create the supplier document to get an ID
            const docRef = await addDoc(collection(db, "clients", clientName, "suppliers"), newSupplierData);
            
            const supplierId = docRef.id;

            // If a password is provided, create the auth user
            if (password && newSupplierData.contactEmail) {
                const functions = getFunctions(app, 'southamerica-east1');
                const createSupplierUser = httpsCallable(functions, 'createSupplierUser');

                await createSupplierUser({
                    email: newSupplierData.contactEmail,
                    password: password,
                    displayName: newSupplierData.contactName || newSupplierData.name,
                    supplierId: supplierId,
                    clientId: clientName // for permission check in cloud function
                });
            }

            const newSupplier: Supplier = { id: supplierId, ...newSupplierData };
            setSuppliers(prev => [newSupplier, ...prev]);
            setIsModalOpen(false);
            toast({
                title: "Fornecedor Adicionado!",
                description: `${newSupplierData.name} foi cadastrado com sucesso.`,
                className: "bg-accent text-accent-foreground",
            });

        } catch (error: any) {
            let errorMessage = "Ocorreu um erro ao adicionar o fornecedor.";
            if (error.code === 'functions/already-exists') {
                errorMessage = "Este endereço de e-mail já está em uso por outra conta.";
            } else if (error.message) {
                errorMessage = error.message;
            }
            toast({ variant: 'destructive', title: 'Erro ao Adicionar Fornecedor', description: errorMessage });
        }
    };

    const handleEditSupplier = async (updatedSupplier: Supplier) => {
        if (!clientName) return;

        try {
            const supplierRef = doc(db, "clients", clientName, "suppliers", updatedSupplier.id);
            const { id, ...dataToUpdate } = updatedSupplier;
            await updateDoc(supplierRef, dataToUpdate);
            
            setSuppliers(prev => prev.map(s => s.id === updatedSupplier.id ? updatedSupplier : s));
            setSupplierToEdit(null);
            setIsModalOpen(false);
            toast({
                title: "Fornecedor Atualizado!",
                description: `${updatedSupplier.name} foi atualizado com sucesso.`,
                className: "bg-accent text-accent-foreground",
            });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro', description: error.message || 'Não foi possível editar o fornecedor.' });
        }
    };

    const handleDeleteSupplier = async (supplierToDelete: Supplier) => {
       try {
            await deleteDoc(doc(db, "clients", clientName!, "suppliers", supplierToDelete.id));
            setSuppliers(prev => prev.filter(s => s.id !== supplierToDelete.id));
            toast({
                title: "Fornecedor Excluído!",
                description: `${supplierToDelete.name} foi removido com sucesso.`,
            });
       } catch(error) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível excluir o fornecedor.' });
       }
    };
    
    const handleDuplicateSupplier = async (supplierToDuplicate: Supplier) => {
        if (!clientName) return;
        const { id, ...supplierData } = supplierToDuplicate;
        const newSupplierData = {
            ...supplierData,
            name: `${supplierToDuplicate.name} (Cópia)`,
        };
        try {
            const docRef = await addDoc(collection(db, "clients", clientName, "suppliers"), newSupplierData);
            const newSupplier = { id: docRef.id, ...newSupplierData } as Supplier;
            setSuppliers(prev => [newSupplier, ...prev]);
             toast({
                title: "Fornecedor Duplicado!",
                description: `Uma cópia de ${supplierToDuplicate.name} foi criada.`,
                className: "bg-accent text-accent-foreground",
            });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível duplicar o fornecedor.' });
        }
    };

    const dynamicColumns = columns.map(col => {
      if (col.id === 'actions') {
        return {
          ...col,
          cell: ({ row }: { row: { original: Supplier } }) => (
            <DataTableRowActions 
              row={row} 
              onEdit={() => handleOpenEditModal(row.original)}
              onDuplicate={() => handleDuplicateSupplier(row.original)}
              onDelete={() => handleDeleteSupplier(row.original)}
            />
          ),
        };
      }
      return col;
    });

    return (
        <div className="space-y-6">
            <PageHeader>
                <div>
                    <PageHeaderHeading>Fornecedores</PageHeaderHeading>
                    <PageHeaderDescription>
                        Gerencie seus fornecedores, adicione novos e consulte informações.
                    </PageHeaderDescription>
                </div>
                 <Button variant="secondary" onClick={handleOpenAddModal}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Adicionar Fornecedor
                </Button>
            </PageHeader>
            
            <Card>
                <CardHeader>
                    <CardTitle>Lista de Fornecedores</CardTitle>
                    <CardDescription>Filtre, ordene e gerencie seus fornecedores cadastrados.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex h-64 items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <DataTable columns={dynamicColumns} data={suppliers} />
                    )}
                </CardContent>
            </Card>
            
            <AddSupplierDialog 
              open={isModalOpen} 
              onOpenChange={setIsModalOpen}
              onSupplierAdd={(userData, password) => handleAddSupplier(userData, password)} 
              onSupplierEdit={handleEditSupplier} 
              supplierToEdit={supplierToEdit}
            />
        </div>
    );
}
