
import { z } from "zod"
import initialClients from './clients-data.json';

export const clientSchema = z.object({
  id: z.string(),
  name: z.string(),
  contact: z.string().email(),
  plan: z.enum(['Administrativo', 'Clinica', 'Administrativo e Clinica']),
  planPrice: z.number().optional().default(0),
  licenseActive: z.boolean(),
  paymentVerified: z.boolean(),
  licenseExpiration: z.string(),
  logoUrl: z.string().url().optional().nullable(),
  maxCompanies: z.number().optional().default(1),
})

export type Client = z.infer<typeof clientSchema>

export const clients: Client[] = z.array(clientSchema).parse(initialClients);

export const plans = [
  {
    value: "Administrativo",
    label: "Administrativo",
  },
  {
    value: "Clinica",
    label: "Clinica",
  },
  {
    value: "Administrativo e Clinica",
    label: "Administrativo e Clinica",
  },
]

export const licenseStatuses = [
  {
    value: "Ativa",
    label: "Ativa",
  },
  {
    value: "Inativa",
    label: "Inativa",
  },
]

export const supplierSchema = z.object({
  id: z.string(),
  name: z.string(),
  cnpj: z.string(),
  fantasyName: z.string().optional(),
  cnae: z.string().optional(),
  category: z.string(),
  status: z.string(),
  cep: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  contactName: z.string().optional(),
  contactRole: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  accessLogin: z.string().optional(),
  authUid: z.string().optional().nullable(),
})

export type Supplier = z.infer<typeof supplierSchema>


export const categories = [
  {
    value: "matriz",
    label: "Matriz",
  },
  {
    value: "filial",
    label: "Filial",
  },
  {
    value: "servicos",
    label: "Serviços",
  },
    {
    value: "material-escritorio",
    label: "Material de Escritório",
  }
]

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
