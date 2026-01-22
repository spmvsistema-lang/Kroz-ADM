'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Construction } from "lucide-react";
import { Logo } from "@/components/app/logo";
import { useSearchParams } from 'next/navigation';
import { Suspense } from "react";

function ComingSoonContent() {
  const searchParams = useSearchParams();
  const from = searchParams.get('from');

  const isFromSettings = from === 'settings';
  const backLink = isFromSettings ? '/settings' : '/';
  const backText = isFromSettings ? 'Voltar para Configurações' : 'Voltar para a Página Inicial';

  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <Logo />
          </div>
          <div className="flex justify-center mb-4">
            <Construction className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">Página em Construção</CardTitle>
          <CardDescription>
            Estamos trabalhando para trazer novidades para você.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Esta funcionalidade estará disponível em breve. Agradecemos a sua paciência.
          </p>
        </CardContent>
        <CardFooter className="justify-center">
            <Button asChild>
                <Link href={backLink}>{backText}</Link>
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function ComingSoonPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <ComingSoonContent />
    </Suspense>
  );
}
