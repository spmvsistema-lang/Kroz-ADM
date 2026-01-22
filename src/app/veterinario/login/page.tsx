
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
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { app } from "@/firebase/config";
import { AuthGuard } from "@/components/app/auth-guard";

function VeterinarioLoginPageContent() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { toast } = useToast();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        const auth = getAuth(app);

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const idTokenResult = await user.getIdTokenResult(true);
            const claims = idTokenResult.claims;

            if (claims.role !== 'veterinario') {
                await signOut(auth);
                throw new Error("Acesso negado. Esta área é exclusiva para veterinários.");
            }
            
            const clientId = claims.clientId;

            if (!clientId) {
                await signOut(auth);
                throw new Error("Dados do usuário não encontrados ou usuário não pertence a um cliente ativo.");
            }

            const sessionToken = crypto.randomUUID();
            localStorage.setItem('sessionToken', sessionToken);
            localStorage.setItem('clientName', clientId);
            
            toast({
                title: "Login bem-sucedido!",
                description: `Bem-vindo(a) ao Portal do Veterinário.`,
                className: "bg-accent text-accent-foreground",
            });
            
            router.push('/veterinario/notas');

        } catch (error: any) {
             let errorMessage = "Credenciais inválidas ou erro de conexão.";
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                errorMessage = "Email ou senha incorretos.";
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            toast({
                variant: "destructive",
                title: "Falha no Login",
                description: errorMessage,
            });
        } finally {
            setIsLoading(false);
        }
    }

  return (
    <div className="flex flex-col min-h-screen bg-muted items-center justify-center p-4">
        <Card className="w-full max-w-sm">
            <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                    <Logo />
                </div>
            <CardTitle>Portal do Veterinário</CardTitle>
            <CardDescription>Acesse para enviar suas notas de serviço.</CardDescription>
            </CardHeader>
            <CardContent className="pb-2">
            <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                        id="email" 
                        type="email" 
                        placeholder="seu.email@vet.com" 
                        required 
                        disabled={isLoading} 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input 
                        id="password" 
                        type="password" 
                        required 
                        disabled={isLoading} 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Entrar
                </Button>
                <Button variant="link" className="w-full" asChild>
                    <Link href="/">Voltar para a Página Inicial</Link>
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


export default function VeterinarioLoginPage() {
    return (
        <AuthGuard redirectIfAuthenticated redirectUrl="/veterinario/notas">
            <VeterinarioLoginPageContent />
        </AuthGuard>
    )
}
