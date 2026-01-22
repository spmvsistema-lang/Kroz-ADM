'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, UserCog } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/firebase/config";
import { PageHeader, PageHeaderDescription, PageHeaderHeading } from "@/components/app/page-header";

export default function SuperAdminsPage() {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [accessCode, setAccessCode] = useState('');

    const handleCreateSuperAdmin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);

        const functions = getFunctions(app, 'southamerica-east1'); 
        const createSuperadmin = httpsCallable(functions, 'createSuperadmin');
        
        try {
            const result = await createSuperadmin({ name, email, password, accessCode });
            
            const data = result.data as { success: boolean; message?: string, uid?: string };

            if (data.success) {
                toast({
                    title: "Cadastro Realizado com Sucesso!",
                    description: `O usuário ${name} agora é um Super Admin.`,
                    className: "bg-accent text-accent-foreground",
                });
                // Limpar o formulário
                setName('');
                setEmail('');
                setPassword('');
                setAccessCode('');
            } else {
                 throw new Error(data.message || "A função de criação retornou um erro inesperado.");
            }

        } catch (error: any) {
             toast({
                variant: "destructive",
                title: "Erro no Cadastro",
                description: error.message || "Ocorreu um erro ao tentar criar a conta.",
            });
        } finally {
            setIsLoading(false);
        }
    }

  return (
    <div className="space-y-6">
         <PageHeader>
            <PageHeaderHeading>Gerenciamento de Super Admins</PageHeaderHeading>
            <PageHeaderDescription>
                Adicione novos administradores à plataforma.
            </PageHeaderDescription>
        </PageHeader>
        <Card className="w-full max-w-2xl">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <UserCog className="h-5 w-5"/>
                    Criar Novo Super Admin
                </CardTitle>
                <CardDescription>Crie uma nova conta com privilégios de Super Administrador.</CardDescription>
            </CardHeader>
            <form onSubmit={handleCreateSuperAdmin}>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nome Completo</Label>
                        <Input id="name" name="name" type="text" placeholder="Nome completo do novo admin" required disabled={isLoading} value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" name="email" type="email" placeholder="email.admin@exemplo.com" required disabled={isLoading} value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Senha</Label>
                        <Input id="password" name="password" type="password" required disabled={isLoading} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Defina uma senha segura"/>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="access-code">Código de Acesso</Label>
                        <Input id="access-code" name="access-code" type="password" required disabled={isLoading} value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder="Código de segurança da plataforma"/>
                    </div>
                </CardContent>
                <CardFooter className="justify-end">
                     <Button type="submit" className="w-full sm:w-auto" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Criar Super Admin
                    </Button>
                </CardFooter>
            </form>
        </Card>
    </div>
  );
}
