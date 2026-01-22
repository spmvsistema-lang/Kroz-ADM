
'use client';

import { useState, useEffect } from "react";
import { PageHeader, PageHeaderDescription, PageHeaderHeading } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Upload, Download, File, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/firebase/auth/use-user";
import { db } from "@/firebase/config";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, query, where, getDocs, serverTimestamp, Timestamp } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface ServiceNote {
  id: string;
  clinic: string;
  serviceDate: string;
  value: number;
  status: 'Pendente' | 'Verificado';
  fileUrl: string;
  fileName: string;
  createdAt: Timestamp;
}

export default function VeterinarioNotasPage() {
    const { user, isLoading: isUserLoading } = useUser();
    const { toast } = useToast();
    const clientId = typeof window !== 'undefined' ? localStorage.getItem('clientName') : null;

    const [clinics, setClinics] = useState<string[]>([]);
    const [selectedClinic, setSelectedClinic] = useState('');
    const [serviceDate, setServiceDate] = useState<Date>();
    const [value, setValue] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [notes, setNotes] = useState<ServiceNote[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isUserLoading || !user || !clientId) {
            if(!isUserLoading) setIsLoading(false);
            return;
        }
        
        const fetchInitialData = async () => {
            setIsLoading(true);
            try {
                // Fetch vet details to get their clinics
                const vetQuery = query(collection(db, `clients/${clientId}/veterinarians`), where("email", "==", user.email));
                const vetSnapshot = await getDocs(vetQuery);
                if (!vetSnapshot.empty) {
                    const vetData = vetSnapshot.docs[0].data();
                    setClinics(vetData.clinics || []);
                }

                // Fetch existing notes
                const notesQuery = query(collection(db, `clients/${clientId}/serviceNotes`), where("veterinarianId", "==", user.uid));
                const notesSnapshot = await getDocs(notesQuery);
                const notesData = notesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ServiceNote))
                    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
                setNotes(notesData);

            } catch (error) {
                toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar seus dados.' });
            } finally {
                setIsLoading(false);
            }
        };

        fetchInitialData();
    }, [user, isUserLoading, clientId, toast]);
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            if(e.target.files[0].type !== 'application/pdf') {
                toast({ variant: 'destructive', title: 'Arquivo Inválido', description: 'Por favor, anexe apenas arquivos PDF.' });
                return;
            }
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !selectedClinic || !serviceDate || !value || !user || !clientId) {
            toast({ variant: 'destructive', title: 'Campos Incompletos', description: 'Por favor, preencha todos os campos e anexe o PDF da nota.' });
            return;
        }

        setIsSubmitting(true);
        try {
            // 1. Upload file to Firebase Storage
            const storage = getStorage();
            const storageRef = ref(storage, `service-notes/${clientId}/${user.uid}/${Date.now()}-${file.name}`);
            const uploadResult = await uploadBytes(storageRef, file);
            const fileUrl = await getDownloadURL(uploadResult.ref);

            // 2. Add document to Firestore
            const newNote = {
                veterinarianId: user.uid,
                clinic: selectedClinic,
                serviceDate: format(serviceDate, 'yyyy-MM-dd'),
                value: Number(value),
                status: 'Pendente' as const,
                fileUrl,
                fileName: file.name,
                createdAt: serverTimestamp(),
            };

            const docRef = await addDoc(collection(db, `clients/${clientId}/serviceNotes`), newNote);
            
            // @ts-ignore - serverTimestamp resolves on the server
            setNotes(prev => [{ id: docRef.id, ...newNote, createdAt: Timestamp.now() }, ...prev]);

            toast({ title: 'Sucesso!', description: 'Nota de serviço enviada com sucesso.', className: 'bg-accent text-accent-foreground' });
            
            // Reset form
            setSelectedClinic('');
            setServiceDate(undefined);
            setValue('');
            setFile(null);
            // This is a way to reset the file input
            const fileInput = document.getElementById('note-file') as HTMLInputElement;
            if(fileInput) fileInput.value = '';

        } catch (error) {
            console.error("Error submitting note:", error);
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível enviar sua nota de serviço.' });
        } finally {
            setIsSubmitting(false);
        }
    };


    return (
        <div className="space-y-6">
            <PageHeader>
                <PageHeaderHeading>Minhas Notas de Serviço</PageHeaderHeading>
                <PageHeaderDescription>
                    Envie suas notas de serviço para os hospitais e clínicas que você atende.
                </PageHeaderDescription>
            </PageHeader>
            <div className="grid gap-6 lg:grid-cols-5">
                <div className="lg:col-span-2">
                    <form onSubmit={handleSubmit}>
                    <Card>
                        <CardHeader>
                            <CardTitle>Enviar Nova Nota</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="clinic">Hospital/Clínica</Label>
                                <Select value={selectedClinic} onValueChange={setSelectedClinic} required>
                                    <SelectTrigger id="clinic">
                                        <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {clinics.map(clinic => <SelectItem key={clinic} value={clinic}>{clinic}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="service-date">Data do Serviço</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button id="service-date" variant="outline" className={cn("w-full justify-start text-left font-normal", !serviceDate && "text-muted-foreground")}>
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {serviceDate ? format(serviceDate, 'dd/MM/yyyy') : <span>Selecione a data</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={serviceDate} onSelect={setServiceDate} /></PopoverContent>
                                </Popover>
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="value">Valor (R$)</Label>
                                <Input id="value" type="number" placeholder="350.00" value={value} onChange={e => setValue(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="note-file">Anexo (PDF)</Label>
                                <Input id="note-file" type="file" accept=".pdf" onChange={handleFileChange} required />
                                {file && <p className="text-sm text-muted-foreground flex items-center gap-2"><File className="h-4 w-4" />{file.name}</p>}
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                Enviar Nota
                            </Button>
                        </CardFooter>
                    </Card>
                    </form>
                </div>
                <div className="lg:col-span-3">
                    <Card>
                        <CardHeader>
                            <CardTitle>Histórico de Envios</CardTitle>
                        </CardHeader>
                        <CardContent>
                             {isLoading ? (
                                <div className="flex h-48 items-center justify-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Clínica</TableHead>
                                        <TableHead>Data</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Valor</TableHead>
                                        <TableHead className="text-center">Ação</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {notes.length > 0 ? (
                                        notes.map(note => (
                                            <TableRow key={note.id}>
                                                <TableCell className="font-medium">{note.clinic}</TableCell>
                                                <TableCell>{format(new Date(note.serviceDate), 'dd/MM/yyyy')}</TableCell>
                                                <TableCell>
                                                    <Badge variant={note.status === 'Verificado' ? 'default' : 'secondary'} className={note.status === 'Verificado' ? 'bg-accent text-accent-foreground' : ''}>
                                                        {note.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">R$ {note.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</TableCell>
                                                <TableCell className="text-center">
                                                    <Button asChild variant="ghost" size="icon">
                                                        <a href={note.fileUrl} target="_blank" rel="noopener noreferrer">
                                                            <Download className="h-4 w-4" />
                                                        </a>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-24 text-center">Nenhuma nota enviada ainda.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
