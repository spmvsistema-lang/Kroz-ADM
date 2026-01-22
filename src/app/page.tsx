
'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { generateSlug } from "@/lib/utils";
import { Logo } from "@/components/app/logo";
import { Check } from "lucide-react";

export default function LandingPage() {
    const router = useRouter();

    const planoAdministrativoFeatures = [
        "Gestão de Compras e Cotações",
        "Controle Financeiro Completo",
        "Gestão de Fornecedores",
        "Contas a Pagar e Receber",
        "Relatórios Gerenciais",
    ];

    const planoClinicaFeatures = [
        "Agenda Médica Inteligente",
        "Prontuário Eletrônico do Paciente (PEP)",
        "Faturamento de Convênios (TISS/TUSS)",
        "Controle de Estoque de Materiais",
        "Assinatura Digital e Laudos",
    ];

    return (
        <div className="flex flex-col min-h-screen bg-background">
            <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur-sm">
                <div className="container flex h-16 items-center justify-end gap-4 px-4 md:px-6">
                     <Button asChild variant="ghost">
                        <Link href="/login/fornecedores">Portal do Fornecedor</Link>
                    </Button>
                    <Button asChild>
                        <Link href="/login">Entrar</Link>
                    </Button>
                </div>
            </header>

            <main className="flex-1 flex flex-col">
                {/* Hero Section */}
                <section className="relative w-full h-[60vh] flex items-center justify-center text-center text-white">
                    <Image
                        src="/landing.png"
                        alt="Background image of an office"
                        layout="fill"
                        objectFit="cover"
                        className="absolute inset-0 z-0"
                        priority
                    />
                    <div className="absolute inset-0 bg-primary/80 z-10"></div>
                    <div className="z-20 relative flex flex-col items-center space-y-6 px-4">
                        <div className="mb-4">
                            <Logo priority />
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                            Otimize sua Gestão com Kroz ADM
                        </h1>
                        <p className="max-w-2xl text-lg md:text-xl text-primary-foreground/90">
                            Nossa plataforma centraliza suas operações, automatiza tarefas, fornece insights e oferece paz para sua tomada de decisão.
                        </p>
                    </div>
                </section>
                
                 {/* Plans Section */}
                <section id="plans" className="w-full py-16 lg:py-24 bg-muted">
                    <div className="container mx-auto px-4">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-bold text-primary">Nossos Planos</h2>
                            <p className="text-muted-foreground">Soluções sob medida para o seu negócio.</p>
                        </div>
                        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                            <Card className="flex flex-col">
                                <CardHeader className="text-center">
                                    <CardTitle className="text-secondary justify-center">Plano Administrativo</CardTitle>
                                    <CardDescription>A solução completa para a gestão do seu negócio.</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1 text-center">
                                    <ul className="space-y-3 inline-block text-left">
                                        {planoAdministrativoFeatures.map(feature => (
                                            <li key={feature} className="flex items-center gap-2">
                                                <Check className="h-5 w-5 text-accent" />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                                <div className="p-6 pt-0">
                                     <Button className="w-full" variant="secondary" asChild>
                                        <Link href="/coming-soon">Saiba Mais</Link>
                                    </Button>
                                </div>
                            </Card>
                            <Card className="flex flex-col">
                                <CardHeader className="text-center">
                                    <CardTitle className="text-secondary justify-center">Plano Clínica</CardTitle>
                                    <CardDescription>Otimize a gestão da sua clínica ou consultório.</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1 text-center">
                                    <ul className="space-y-3 inline-block text-left">
                                        {planoClinicaFeatures.map(feature => (
                                            <li key={feature} className="flex items-center gap-2">
                                                <Check className="h-5 w-5 text-accent" />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                                <div className="p-6 pt-0">
                                    <Button className="w-full" variant="secondary" asChild>
                                        <Link href="/coming-soon">Saiba Mais</Link>
                                    </Button>
                                </div>
                            </Card>
                        </div>
                    </div>
                </section>

            </main>

             <footer className="flex flex-col items-center justify-center gap-2 p-4 border-t bg-background">
                <div className="flex items-center gap-4">
                    <Image src="/Logo PrayTech.png" alt="PrayTech Logo" width={80} height={27} className="dark:invert" style={{ height: 'auto' }} />
                </div>
                <p className="text-xs text-muted-foreground">&copy; 2024 <a href="https://pray-tech.com" target="_blank" rel="noopener noreferrer" className="hover:underline">PrayTech Solutions</a>. Todos os direitos reservados.</p>
            </footer>
        </div>
    );
}
