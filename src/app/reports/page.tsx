
"use client"

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This page's functionality has been moved to the "Relatório Financeiro" tab
// in the "/financeiro" page. We now redirect to it.
export default function ReportsPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/financeiro');
    }, [router]);

    // You can optionally show a loading or redirecting message
    return (
        <div>
            Redirecionando para a Gestão Financeira...
        </div>
    );
}
