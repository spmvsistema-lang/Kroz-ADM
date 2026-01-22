
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
import { User } from "@/lib/data"


interface DataTableRowActionsProps {
  row: Row<User>
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
}

export function DataTableRowActions({
  row,
  onEdit,
  onDelete
}: DataTableRowActionsProps) {
  const user = row.original

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        variant="ghost"
        className="flex h-8 w-8 p-0"
        onClick={(e) => {
          e.stopPropagation();
          onEdit(user);
        }}
      >
        <Pen className="h-4 w-4" />
        <span className="sr-only">Editar</span>
      </Button>
      
      <AlertDialog onOpenChange={(open) => { if (open) event?.stopPropagation(); }}>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            className="flex h-8 w-8 p-0 text-destructive hover:text-destructive"
            onClick={(e) => e.stopPropagation()}
          >
            <Trash className="h-4 w-4" />
            <span className="sr-only">Excluir</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente o usuário
              <span className="font-semibold"> {user.name}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onDelete(user)}
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
