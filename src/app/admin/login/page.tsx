
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
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { app } from "@/firebase/config";

export default function AdminLoginPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { toast } = useToast();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        const auth = getAuth(app);
        const firestore = getFirestore(app);

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Force refresh to get custom claims
            const idTokenResult = await user.getIdTokenResult(true);
            const claims = idTokenResult.claims;

            // 1. Check for Superadmin claim
            if (claims.role !== 'Superadmin') {
                await signOut(auth);
                throw new Error("Permissão negada. Você não é um Super Administrador.");
            }

            // 2. Verify user exists in the root 'users' collection
            const userDocRef = doc(firestore, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (!userDocSnap.exists() || userDocSnap.data().role !== 'Superadmin') {
                 await signOut(auth);
                 throw new Error("Configuração de conta de administrador inválida ou permissões insuficientes.");
            }

            // 3. Success, proceed to dashboard
            const sessionToken = crypto.randomUUID();
            localStorage.setItem('sessionToken', sessionToken);
            
            router.push('/admin/dashboard');

        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Acesso Negado",
                description: error.message || "Credenciais inválidas ou você não tem permissão para acessar esta área.",
            });
        } finally {
            setIsLoading(false);
        }
    }

  return (
    <div className="flex flex-col min-h-screen bg-muted items-center justify-center">
        <Card className="w-full max-w-sm">
            <CardHeader className="text-center pt-6">
                <div className="flex justify-center mb-6 h-16 items-center">
                    <Logo />
                </div>
            <CardTitle>Login do Super Admin</CardTitle>
            <CardDescription>Acesse o painel de controle principal.</CardDescription>
            </CardHeader>
            <CardContent className="pb-2">
            <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                    id="email" 
                    type="email" 
                    placeholder="admin@krozadm.com" 
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
                <div className="flex gap-2">
                     <Button variant="secondary" className="w-full" asChild>
                        <Link href="/admin/signup">Cadastre-se</Link>
                    </Button>
                    <Button variant="link" className="w-full" asChild>
                        <Link href="/">Voltar para a Landing Page</Link>
                    </Button>
                </div>
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
