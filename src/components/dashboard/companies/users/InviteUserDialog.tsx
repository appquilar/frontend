import { useForm } from "react-hook-form";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COMPANY_USER_ROLES } from "@/application/hooks/useCompanyMembership";
import type { CompanyUserRole } from "@/domain/models/CompanyMembership";

interface InviteUserDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: { email: string; role: CompanyUserRole }) => Promise<void>;
    disabled?: boolean;
}

interface InviteUserFormData {
    email: string;
    role: CompanyUserRole;
}

export const InviteUserDialog = ({
    open,
    onOpenChange,
    onSubmit,
    disabled = false,
}: InviteUserDialogProps) => {
    const form = useForm<InviteUserFormData>({
        defaultValues: {
            email: "",
            role: "ROLE_CONTRIBUTOR",
        },
    });

    const handleSubmit = async (data: InviteUserFormData) => {
        await onSubmit(data);
        form.reset({
            email: "",
            role: "ROLE_CONTRIBUTOR",
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Invitar usuario</DialogTitle>
                    <DialogDescription>
                        Envia una invitacion para que otra persona acceda a esta empresa.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form
                        className="space-y-4"
                        onSubmit={form.handleSubmit(handleSubmit)}
                    >
                        <FormField
                            control={form.control}
                            name="email"
                            rules={{
                                required: "El email es obligatorio",
                                pattern: {
                                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                                    message: "Introduce un email válido",
                                },
                            }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            type="email"
                                            placeholder="usuario@ejemplo.com"
                                            disabled={disabled}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="role"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Rol</FormLabel>
                                    <Select
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        disabled={disabled}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecciona rol" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {COMPANY_USER_ROLES.map((role) => (
                                                <SelectItem key={role.value} value={role.value}>
                                                    {role.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter className="mt-6">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={disabled}>
                                Enviar invitación
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};
