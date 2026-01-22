import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Palette, Users, ShieldCheck } from "lucide-react";
import Link from 'next/link';

export default function SettingsPage() {
    const settingsOptions = [
        {
            href: "/settings/users",
            icon: Users,
            title: "Usuários",
            description: "Gerencie os membros da sua equipe e suas funções."
        },
        {
            href: "/settings/roles",
            icon: ShieldCheck,
            title: "Funções e Permissões",
            description: "Defina o que cada função de usuário pode ver e fazer no sistema."
        },
        {
            href: "/coming-soon?from=settings",
            icon: Palette,
            title: "Espaço de Trabalho",
            description: "Personalize a aparência com seu logotipo e cores."
        }
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-primary">Configurações</h1>
                <p className="text-muted-foreground">Gerencie as configurações do seu espaço de trabalho e equipe.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {settingsOptions.map((option) => (
                    <Card key={option.title} className="flex flex-col">
                        <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary/10">
                                <option.icon className="h-6 w-6 text-secondary" />
                            </div>
                            <div>
                                <CardTitle>{option.title}</CardTitle>
                                <CardDescription>{option.description}</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="mt-auto flex">
                            <Button asChild variant="link" className="p-0 text-secondary">
                                <Link href={option.href}>
                                    Acessar
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
