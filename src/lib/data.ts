import { z } from "zod"

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.string(),
  status: z.string(),
  clientId: z.string().optional(),
  createdAt: z.any().optional()
})

export type User = z.infer<typeof userSchema>

export const allRoles = [
  {
    value: "Superadmin",
    label: "Superadmin",
  },
  {
    value: "Admin",
    label: "Admin",
  },
  {
    value: "Gestor",
    label: "Gestor",
  },
  {
    value: "Compras",
    label: "Compras",
  },
  {
    value: "Financeiro",
    label: "Financeiro",
  },
  {
    value: "Estoque",
    label: "Estoque",
  },
  {
    value: "Recepcionista",
    label: "Recepcionista",
  },
]

// Roles available for clients to assign
export const clientRoles = allRoles.filter(role => role.value !== 'Superadmin');

export type Role = {
    id: string;
    label: string;
    value: string;
}


export const statuses = [
  {
    value: "Ativo",
    label: "Ativo",
  },
  {
    value: "Inativo",
    label: "Inativo",
  },
]
