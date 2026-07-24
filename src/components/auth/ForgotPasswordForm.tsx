import { useForm } from "react-hook-form";
import { useAuth } from "@/context/AuthContext";
import { Mail } from "lucide-react";

import {
    Form,
    FormField,
    FormItem,
    FormLabel,
    FormControl,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ForgotPasswordFormProps {
    onBack: () => void;
    onSuccess?: () => void;
}

type ForgotPasswordFormValues = {
    email: string;
};

const ForgotPasswordForm = ({ onBack, onSuccess }: ForgotPasswordFormProps) => {
    const { requestPasswordReset } = useAuth();

    const form = useForm<ForgotPasswordFormValues>({
        defaultValues: {
            email: "",
        },
    });

    const onSubmit = async (values: ForgotPasswordFormValues) => {
        await requestPasswordReset(values.email);
        // La navegación y el mensaje los gestiona AuthModal
        onSuccess?.();
    };

    const isSubmitting = form.formState.isSubmitting;

    return (
        <div className="space-y-4">
            <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                <p className="text-sm text-muted-foreground">
                    Introduce tu correo y te enviaremos un enlace para crear una nueva contraseña.
                </p>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                    <FormField
                        control={form.control}
                        name="email"
                        rules={{
                            required: "El email es obligatorio",
                            pattern: {
                                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                                message: "Introduce un correo electrónico válido",
                            },
                        }}
                        render={({ field }) => (
                            <FormItem className="space-y-1.5">
                                <FormLabel className="text-[12px] font-medium text-muted-foreground">
                                    Correo electrónico
                                </FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <Mail
                                            size={16}
                                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                        />
                                        <Input
                                            type="email"
                                            placeholder="tu@email.com"
                                            className="h-11 rounded-lg border-border/80 pl-10"
                                            {...field}
                                        />
                                    </div>
                                </FormControl>
                                <FormMessage className="text-xs" />
                            </FormItem>
                        )}
                    />

                    <Button
                        type="submit"
                        className="h-11 w-full rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.99]"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Enviando correo..." : "Enviar enlace de recuperación"}
                    </Button>

                    <Button
                        type="button"
                        variant="ghost"
                        className="w-full text-xs text-muted-foreground hover:text-foreground"
                        onClick={onBack}
                    >
                        Volver a iniciar sesión
                    </Button>
                </form>
            </Form>
        </div>
    );
};

export default ForgotPasswordForm;
