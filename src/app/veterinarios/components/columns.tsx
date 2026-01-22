
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { DataTableRowActions } from "./data-table-row-actions"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { z } from "zod";

const veterinarianSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  clinics: z.array(z.string()),
  status: z.enum(['Ativo', 'Inativo']),
  cnpj: z.string().optional(),
  fantasyName: z.string().optional(),
  role: z.string().optional(),
});

type Veterinarian = z.infer<typeof veterinarianSchema>;

export const columns: ColumnDef<Veterinarian>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: "Veterinário",
    cell: ({ row }) => {
      const vet = row.original;
      const nameInitial = vet.name.charAt(0).toUpperCase();

      return (
        <div className="flex items-center gap-3">
            <Avatar>
                <AvatarImage src={`https://picsum.photos/seed/${vet.id}/40/40`} data-ai-hint="person portrait" />
                <AvatarFallback>{nameInitial}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
                <span className="font-medium">{vet.name}</span>
                <span className="text-muted-foreground text-sm">{vet.email}</span>
            </div>
        </div>
      )
    }
  },
  {
    accessorKey: "clinics",
    header: "Clínicas/Hospitais",
    cell: ({ row }) => {
        const clinics = row.getValue("clinics") as string[];
        return (
            <div className="flex flex-wrap gap-1">
                {clinics.map((clinic) => (
                    <Badge key={clinic} variant="outline">{clinic}</Badge>
                ))}
            </div>
        )
    },
    filterFn: (row, id, value) => {
      const rowClinics = row.getValue(id) as string[];
      return (value as string[]).some(val => rowClinics.includes(val));
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return <Badge variant={status === "Ativo" ? "default" : "destructive"} className={status === "Ativo" ? 'bg-accent text-accent-foreground' : ''}>{status}</Badge>
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    id: "actions",
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
]
