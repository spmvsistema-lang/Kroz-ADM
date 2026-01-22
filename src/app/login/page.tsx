
'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { app } from "@/firebase/config";
import { AuthGuard } from "@/components/app/auth-guard";
import { Logo } from "@/components/app/logo";

function LoginPageContent() {
    const router = useRouter();
    const { toast } = useToast();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        const auth = getAuth(app);

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Force refresh to get custom claims
            const idTokenResult = await user.getIdTokenResult(true);
            const claims = idTokenResult.claims;

            if (claims.role === 'Superadmin') {
                await signOut(auth);
                toast({
                    variant: "destructive",
                    title: "Acesso Negado",
                    description: "Superadmins devem acessar pelo portal de administração.",
                });
                router.push('/admin/login');
                setIsLoading(false);
                return;
            }

            const clientId = claims.clientId;

            if (!clientId) {
                await signOut(auth);
                throw new Error("Dados do usuário não encontrados ou usuário não pertence a um cliente ativo.");
            }
            
            // This session token is for client-side session validation, not a security token
            const sessionToken = crypto.randomUUID();
            // We don't need to write it to Firestore anymore for login, but might be useful for session management
            
            localStorage.setItem('clientName', clientId);
            localStorage.setItem('sessionToken', sessionToken);

            toast({
                title: "Login bem-sucedido!",
                description: `Bem-vindo(a) de volta.`,
                className: "bg-accent text-accent-foreground",
            });

            router.push('/dashboard');

        } catch (error: any) {
            let errorMessage = "Credenciais inválidas ou erro de conexão.";
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential' || error.code === 'permission-denied') {
                errorMessage = "Email, senha incorretos ou você não tem permissão para acessar.";
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
                <CardHeader className="text-center space-y-2 pt-6">
                    <div className="flex justify-center mb-6 h-16 items-center">
                        <Logo />
                    </div>
                    <CardTitle>Acesse sua Conta</CardTitle>
                    <CardDescription>
                        Use suas credenciais para acessar o sistema.
                    </CardDescription>
                </CardHeader>
                <CardContent className="py-6">
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input 
                                id="email" 
                                type="email" 
                                placeholder="seu.email@exemplo.com" 
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
                    </form>
                </CardContent>
                <CardFooter className="flex-col gap-4 pt-4">
                     <Button variant="link" className="w-full text-muted-foreground font-normal" asChild>
                        <Link href="/">Voltar para a Página Inicial</Link>
                    </Button>
                    <p className="text-xs text-muted-foreground">&copy; 2024 <a href="https://pray-tech.com" target="_blank" rel="noopener noreferrer" className="hover:underline">PrayTech Solutions</a>. Todos os direitos reservados.</p>
                </CardFooter>
            </Card>
        </div>
      );
}

export default function LoginPage() {
    return (
        <AuthGuard redirectIfAuthenticated redirectUrl="/dashboard">
            <LoginPageContent />
        </AuthGuard>
    )
}
