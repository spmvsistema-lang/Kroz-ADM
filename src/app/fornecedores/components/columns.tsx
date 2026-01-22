
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Supplier } from "@/lib/clients-data"
import { DataTableRowActions } from "./data-table-row-actions"
import { Package } from "lucide-react"

export const columns: ColumnDef<Supplier>[] = [
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
    header: "Fornecedor",
    cell: ({ row }) => {
      const supplier = row.original

      return (
        <div className="flex items-center gap-3">
            <div className="p-2 bg-muted rounded-md">
              <Package className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex flex-col">
                <span className="font-medium">{supplier.name}</span>
                <span className="text-muted-foreground text-sm">{supplier.cnpj}</span>
            </div>
        </div>
      )
    }
  },
  {
    accessorKey: "category",
    header: "Categoria",
    cell: ({ row }) => {
        const category = row.getValue("category") as string;
        return <Badge variant="outline">{category}</Badge>
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
