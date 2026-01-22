"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { User, Role } from "@/lib/data"
import { DataTableRowActions } from "./data-table-row-actions"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export const columns: ColumnDef<User>[] = [
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
    header: "Usuário",
    cell: ({ row }) => {
      const user = row.original
      const nameInitial = user.name.charAt(0).toUpperCase();

      return (
        <div className="flex items-center gap-3">
            <Avatar>
                <AvatarImage src={`https://picsum.photos/seed/${user.id}/40/40`} data-ai-hint="person portrait" />
                <AvatarFallback>{nameInitial}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
                <span className="font-medium">{user.name}</span>
                <span className="text-muted-foreground text-sm">{user.email}</span>
            </div>
        </div>
      )
    }
  },
  {
    accessorKey: "role",
    header: "Função",
    cell: ({ row }) => {
        const role = row.getValue("role") as string;
        const variant = role === "Admin" || role === "Superadmin" ? "default" : role === "Gestor" ? "secondary" : "outline";
        
        return <Badge variant={variant} className={variant === 'default' ? 'bg-primary text-primary-foreground' : ''}>{role}</Badge>
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
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
