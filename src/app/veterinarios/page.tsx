
'use client'

import { useState, useEffect } from 'react';
import { z } from 'zod';
import { columns } from './components/columns';
import { DataTable } from './components/data-table';
import { PageHeader, PageHeaderDescription, PageHeaderHeading } from '@/components/app/page-header';
import { AddVeterinarianDialog } from './components/add-veterinarian-dialog';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DataTableRowActions } from './components/data-table-row-actions';
import { db, app } from '@/firebase/config';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getFunctions, httpsCallable } from "firebase/functions";


const veterinarianSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Nome é obrigatório"),
  cnpj: z.string().optional().nullable(),
  fantasyName: z.string().optional().nullable(),
  email: z.string().email("Email inválido"),
  clinics: z.array(z.string()).min(1, "É necessário pelo menos uma clínica."),
  status: z.enum(['Ativo', 'Inativo']),
  role: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  bankAgency: z.string().optional().nullable(),
  bankAccount: z.string().optional().nullable(),
  pixKey: z.string().optional().nullable(),
  closingDay: z.number().optional().nullable(),
  issuesInvoice: z.boolean().optional().nullable(),
});

export type Veterinarian = z.infer<typeof veterinarianSchema>;

interface Company {
    id: string;
    name: string;
}

export default function VeterinariosPage() {
    const [veterinarians, setVeterinarians] = useState<Veterinarian[]>([]);
    const [veterinarianToEdit, setVeterinarianToEdit] = useState<Veterinarian | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const [companies, setCompanies] = useState<Company[]>([]);

    const clientName = typeof window !== 'undefined' ? localStorage.getItem('clientName') : null;


    useEffect(() => {
        const fetchVeterinariansAndCompanies = async () => {
            if (!clientName) {
                setIsLoading(false);
                return;
            };

            setIsLoading(true);
            try {
                // Fetch companies
                const companiesQuery = query(collection(db, `clients/${clientName}/companies`));
                const companiesSnapshot = await getDocs(companiesQuery);
                const companiesData = companiesSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name } as Company));
                setCompanies(companiesData);

                const q = query(collection(db, "clients", clientName, "veterinarians"));
                const querySnapshot = await getDocs(q);
                const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Veterinarian));
                const parsedData = z.array(veterinarianSchema).parse(data);
                setVeterinarians(parsedData);
            } catch (error) {
                if (error instanceof z.ZodError) {
                    console.error("Erro de validação do Zod:", error.issues);
                     toast({ variant: 'destructive', title: 'Erro de Dados', description: 'Os dados de veterinários recebidos são inválidos.' });
                } else {
                    toast({ variant: 'destructive', title: 'Erro de Conexão', description: 'Não foi possível carregar os dados.' });
                }
            } finally {
                setIsLoading(false);
            }
        };

        if(clientName) fetchVeterinariansAndCompanies();
        else setIsLoading(false);
    }, [clientName, toast]);

    const handleOpenAddModal = () => {
        setVeterinarianToEdit(null);
        setIsModalOpen(true);
    };
    
    const handleOpenEditModal = (vet: Veterinarian) => {
        setVeterinarianToEdit(vet);
        setIsModalOpen(true);
    };

    const handleAddVeterinarian = async (newVetData: Omit<Veterinarian, 'id'>, password?: string) => {
        if (!clientName) return;

        const functions = getFunctions(app, 'southamerica-east1');
        const createVeterinarianUser = httpsCallable(functions, 'createVeterinarianUser');
        
        try {
            const { name, email, clinics, status, ...vetData } = newVetData;
            const result = await createVeterinarianUser({
                email: email,
                password: password,
                displayName: name,
                clientId: clientName,
                clinics: clinics,
                status: status,
                vetData: vetData, // Pass remaining vet data
            });
            
            const data = result.data as { success: boolean; message?: string, uid?: string };

            if (data.success && data.uid) {
                const newVet: Veterinarian = { id: data.uid, ...newVetData };
                setVeterinarians(prev => [newVet, ...prev]);
                setIsModalOpen(false);
                 toast({
                    title: "Veterinário Adicionado!",
                    description: `${newVet.name} foi cadastrado com sucesso.`,
                    className: "bg-accent text-accent-foreground",
                });
            } else {
                 throw new Error(data.message || "A função de criação retornou um erro inesperado.");
            }

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro', description: error.message || 'Não foi possível adicionar o veterinário.' });
        }
    };

    const handleEditVeterinarian = async (updatedVet: Veterinarian, finalPaymentDate?: Date) => {
        if (!clientName) return;
        
        const functions = getFunctions(app, 'southamerica-east1');
        const updateVeterinarianUser = httpsCallable(functions, 'updateVeterinarianUser');
        const scheduleFinalVetPayment = httpsCallable(functions, 'scheduleFinalVetPayment');

        try {
            await updateVeterinarianUser({ clientId: clientName, vetData: updatedVet });

            if (finalPaymentDate) {
                await scheduleFinalVetPayment({
                    clientId: clientName,
                    veterinarianId: updatedVet.id,
                    dueDate: finalPaymentDate.toISOString(),
                });
            }

            setVeterinarians(prev => prev.map(s => s.id === updatedVet.id ? updatedVet : s));
            setVeterinarianToEdit(null);
            setIsModalOpen(false);
            toast({
                title: "Veterinário Atualizado!",
                description: `${updatedVet.name} foi atualizado com sucesso. ${finalPaymentDate ? 'O pagamento final foi agendado.' : ''}`,
                className: "bg-accent text-accent-foreground",
            });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro', description: error.message || 'Não foi possível editar o veterinário.' });
        }
    };

    const handleDeleteVeterinarian = async (vetToDelete: Veterinarian) => {
       if (!clientName) return;
       try {
            // NOTE: This only deletes the Firestore record.
            // For a full implementation, you'd need a Cloud Function
            // to delete the user from Firebase Auth as well.
            await deleteDoc(doc(db, "clients", clientName, "veterinarians", vetToDelete.id));
            setVeterinarians(prev => prev.filter(s => s.id !== vetToDelete.id));
            toast({
                title: "Veterinário Excluído!",
                description: `${vetToDelete.name} foi removido com sucesso.`,
            });
       } catch(error) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível excluir o veterinário.' });
       }
    };

    const dynamicColumns = columns.map(col => {
      if (col.id === 'actions') {
        return {
          ...col,
          cell: ({ row }: { row: { original: Veterinarian } }) => (
            <DataTableRowActions 
              row={row} 
              onEdit={() => handleOpenEditModal(row.original)}
              onDelete={() => handleDeleteVeterinarian(row.original)}
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
                    <PageHeaderHeading>Veterinários</PageHeaderHeading>
                    <PageHeaderDescription>
                        Gerencie os veterinários, adicione novos e consulte informações.
                    </PageHeaderDescription>
                </div>
                 <Button variant="secondary" onClick={handleOpenAddModal}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Adicionar Veterinário
                </Button>
            </PageHeader>
            
            <Card>
                <CardHeader>
                    <CardTitle>Lista de Veterinários</CardTitle>
                    <CardDescription>Filtre, ordene e gerencie seus veterinários cadastrados.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex h-64 items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <DataTable 
                            columns={dynamicColumns} 
                            data={veterinarians} 
                            companies={companies} 
                            onRowClick={handleOpenEditModal}
                        />
                    )}
                </CardContent>
            </Card>
            
            <AddVeterinarianDialog
              open={isModalOpen} 
              onOpenChange={setIsModalOpen}
              onVeterinarianAdd={handleAddVeterinarian}
              onVeterinarianEdit={handleEditVeterinarian} 
              veterinarianToEdit={veterinarianToEdit}
              companies={companies}
            />
        </div>
    );
}
