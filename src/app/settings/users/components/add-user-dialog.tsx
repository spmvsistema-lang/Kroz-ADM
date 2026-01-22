
'use client';

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Role } from "@/lib/data";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { userSchema } from "@/lib/data";

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserAdd: (newUser: Omit<User, 'id'>, password?: string) => void;
  onUserEdit: (updatedUser: User) => void;
  userToEdit?: User | null;
  clientRoles: Role[];
}

export function AddUserDialog({ open, onOpenChange, onUserAdd, onUserEdit, userToEdit, clientRoles }: AddUserDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<User>>({});
  const [password, setPassword] = useState('');
  
  const isEditMode = !!userToEdit;

  useEffect(() => {
    if (userToEdit && open) {
      setFormData(userToEdit);
    } else {
      setFormData({
        status: 'Ativo' // Default status for new users
      });
      setPassword('');
    }
  }, [userToEdit, open]);

  const handleInputChange = (field: keyof User, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataToValidate = {
      id: formData.id || `temp-id-${Date.now()}`,
      name: formData.name || '',
      email: formData.email || '',
      role: formData.role || '',
      status: formData.status || 'Ativo',
    };

    const result = userSchema.safeParse(dataToValidate);

    if (!result.success) {
        toast({
            variant: "destructive",
            title: "Erro de Validação",
            description: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
        });
        return;
    }
    
    if (isEditMode) {
      onUserEdit(result.data as User);
    } else {
      const { id, ...newUserData } = result.data;
      onUserAdd(newUserData, password);
    }
    
    onOpenChange(false);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Editar Usuário' : 'Adicionar Novo Usuário'}</DialogTitle>
          <DialogDescription>
            Preencha os dados abaixo para {isEditMode ? 'atualizar o' : 'criar um novo'} usuário.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
             <div className="space-y-2">
                <Label htmlFor="user-name">Nome</Label>
                <Input id="user-name" value={formData.name || ''} onChange={(e) => handleInputChange('name', e.target.value)} placeholder="Nome completo" required />
            </div>
             <div className="space-y-2">
                <Label htmlFor="user-email">Email</Label>
                <Input id="user-email" type="email" value={formData.email || ''} onChange={(e) => handleInputChange('email', e.target.value)} placeholder="email@exemplo.com" required disabled={isEditMode} />
            </div>

            {!isEditMode && (
                <div className="space-y-2">
                    <Label htmlFor="user-password">Senha</Label>
                    <Input id="user-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Defina uma senha de acesso" required />
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="user-role">Função</Label>
                    <Select value={formData.role} onValueChange={(value) => handleInputChange('role', value)} required>
                        <SelectTrigger id="user-role">
                            <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                            {clientRoles.map(role => (
                                <SelectItem key={role.id} value={role.value}>{role.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="user-status">Status</Label>
                    <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)} required>
                        <SelectTrigger id="user-status">
                            <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Ativo">Ativo</SelectItem>
                            <SelectItem value="Inativo">Inativo</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <DialogFooter className="pt-4">
                <DialogClose asChild>
                    <Button type="button" variant="outline">Cancelar</Button>
                </DialogClose>
                <Button type="submit">{isEditMode ? 'Salvar Alterações' : 'Criar Usuário'}</Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
