
'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/app/logo";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/firebase/config";

export default function AdminSignupPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);

        const formData = new FormData(e.currentTarget);
        const name = formData.get("name") as string;
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;
        const accessCode = formData.get("access-code") as string;

        const functions = getFunctions(app, 'southamerica-east1');
        const createSuperadmin = httpsCallable(functions, 'createSuperadmin');
        
        try {
            const result = await createSuperadmin({ name, email, password, accessCode });
            
            const data = result.data as { success: boolean; message?: string };

            if (data.success) {
                toast({
                    title: "Cadastro Realizado com Sucesso!",
                    description: "Você já pode fazer o login com suas novas credenciais.",
                    className: "bg-accent text-accent-foreground",
                });
                router.push('/admin/login');
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
    <div className="flex flex-col min-h-screen bg-muted items-center justify-center p-4 sm:p-6">
        <Card className="w-full max-w-sm">
            <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                    <Logo />
                </div>
            <CardTitle>Cadastro de Super Admin</CardTitle>
            <CardDescription>Crie sua conta para gerenciar a plataforma.</CardDescription>
            </CardHeader>
            <CardContent className="pb-2">
            <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Nome Completo</Label>
                    <Input id="name" name="name" type="text" placeholder="Seu nome completo" required disabled={isLoading} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" placeholder="seu-email@exemplo.com" required disabled={isLoading} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input id="password" name="password" type="password" required disabled={isLoading} />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="access-code">Código de Acesso</Label>
                    <Input id="access-code" name="access-code" type="password" required disabled={isLoading} />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Cadastrar
                </Button>
                <Button variant="link" className="w-full" asChild>
                    <Link href="/admin/login">Já tem uma conta? Faça o login</Link>
                </Button>
            </form>
            </CardContent>
             <CardFooter className="flex-col pt-4">
                <div className="flex items-center gap-4">
                    <Image src="/Logo PrayTech.png" alt="PrayTech Logo" width={80} height={27} className="dark:invert" style={{ height: 'auto' }} />
                </div>
                <p className="text-xs text-muted-foreground mt-4">&copy; 2024 <a href="https://pray-tech.com" target="_blank" rel="noopener noreferrer" className="hover:underline">PrayTech Solutions</a>. Todos os direitos reservados.</p>
            </CardFooter>
        </Card>
    </div>
  );
}
