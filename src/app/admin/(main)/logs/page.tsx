
'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";


export default function LogsPage() {
    const [selectedClient, setSelectedClient] = useState<string | null>(null);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-primary">Logs do Sistema</h1>
                <p className="text-muted-foreground">Audite as ações realizadas pelos usuários em cada cliente.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Filtrar Logs</CardTitle>
                    <CardDescription>Selecione um cliente para começar a visualizar os logs de atividade.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="max-w-xs">
                         <Select onValueChange={setSelectedClient}>
                            <SelectTrigger id="client-select">
                            <SelectValue placeholder="Selecione o cliente" />
                            </SelectTrigger>
                            <SelectContent>
                                {/* No futuro, estes dados virão do banco */}
                                <SelectItem value="acme-inc">Acme Inc.</SelectItem>
                                <SelectItem value="monsters-inc">Monsters Inc.</SelectItem>
                                <SelectItem value="stark-industries">Stark Industries</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedClient && (
                         <Tabs defaultValue="user" className="w-full">
                            <TabsList>
                                <TabsTrigger value="user">Por Usuário</TabsTrigger>
                                <TabsTrigger value="sector">Por Setor</TabsTrigger>
                            </TabsList>
                            <TabsContent value="user">
                                <Card className="mt-4">
                                    <CardHeader>
                                        <CardTitle className="text-lg">Logs por Usuário</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground">A tabela de logs de atividades dos usuários para o cliente "{selectedClient}" aparecerá aqui.</p>
                                        {/* Tabela de logs por usuário */}
                                    </CardContent>
                                </Card>
                            </TabsContent>
                            <TabsContent value="sector">
                                 <Card className="mt-4">
                                    <CardHeader>
                                        <CardTitle className="text-lg">Logs por Setor</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground">A tabela de logs de atividades agrupadas por setor (ex: Compras, Financeiro) para o cliente "{selectedClient}" aparecerá aqui.</p>
                                         {/* Tabela de logs por setor */}
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    )}

                </CardContent>
            </Card>

        </div>
    );
}
