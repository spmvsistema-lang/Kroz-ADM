
"use client"

import { Row } from "@tanstack/react-table"
import { Pen, Trash } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { z } from "zod";

const veterinarianSchema = z.object({
  id: z.string(),
  name: z.string(),
  cnpj: z.string().optional(),
  fantasyName: z.string().optional(),
  email: z.string().email(),
  clinics: z.array(z.string()),
  status: z.enum(['Ativo', 'Inativo']),
  role: z.string().optional(),
});

type Veterinarian = z.infer<typeof veterinarianSchema>;

interface DataTableRowActionsProps {
  row: Row<Veterinarian>
  onEdit: (vet: Veterinarian) => void;
  onDelete: (vet: Veterinarian) => void;
}

export function DataTableRowActions({
  row,
  onEdit,
  onDelete
}: DataTableRowActionsProps) {
  const vet = row.original

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        variant="ghost"
        className="flex h-8 w-8 p-0"
        onClick={(e) => {
            e.stopPropagation(); // Impede que o clique na linha seja acionado
            onEdit(vet);
        }}
      >
        <Pen className="h-4 w-4" />
        <span className="sr-only">Editar</span>
      </Button>
      
      <AlertDialog onOpenChange={(open) => { if (open) event?.stopPropagation() }}>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            className="flex h-8 w-8 p-0 text-destructive hover:text-destructive"
            onClick={(e) => e.stopPropagation()} // Impede que o clique na linha seja acionado
          >
            <Trash className="h-4 w-4" />
            <span className="sr-only">Excluir</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente o veterinário
              <span className="font-semibold"> {vet.name}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDelete(vet)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
