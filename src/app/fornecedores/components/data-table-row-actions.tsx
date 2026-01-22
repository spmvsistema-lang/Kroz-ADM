
"use client"

import { Row } from "@tanstack/react-table"
import { Pen, Copy, Trash } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Supplier } from "@/lib/clients-data"
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

interface DataTableRowActionsProps {
  row: Row<Supplier>
  onEdit: (supplier: Supplier) => void;
  onDuplicate: (supplier: Supplier) => void;
  onDelete: (supplier: Supplier) => void;
}

export function DataTableRowActions({
  row,
  onEdit,
  onDuplicate,
  onDelete
}: DataTableRowActionsProps) {
  const supplier = row.original

  return (
    <div className="flex items-center justify-end gap-2">
       <Button
          variant="ghost"
          className="flex h-8 w-8 p-0"
          onClick={() => onEdit(supplier)}
        >
          <Pen className="h-4 w-4" />
          <span className="sr-only">Editar</span>
        </Button>
         <Button
          variant="ghost"
          className="flex h-8 w-8 p-0"
          onClick={() => onDuplicate(supplier)}
        >
          <Copy className="h-4 w-4" />
          <span className="sr-only">Duplicar</span>
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              className="flex h-8 w-8 p-0"
            >
              <Trash className="h-4 w-4 text-destructive" />
              <span className="sr-only">Excluir</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Isso excluirá permanentemente o fornecedor
                <span className="font-semibold"> {supplier.name}</span>.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(supplier)}
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

    