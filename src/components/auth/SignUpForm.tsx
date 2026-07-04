import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Mail, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { authPasswordSchema } from "@/domain/schemas/authSchema";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { useRecaptchaToken } from "@/application/hooks/useCaptcha";

const schema = z.object({
    firstName: z.string().min(2),
    lastName: z.string().min(1),
    email: z.string().email(),
    password: authPasswordSchema,
});

type FormValues = z.infer<typeof schema>;

interface SignUpFormProps {
    onSuccess?: () => void;
}

const SignUpForm = ({ onSuccess }: SignUpFormProps) => {
    const { register } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const { execute, isLoadingConfig } = useRecaptchaToken();

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            firstName: "",
            lastName: "",
            email: "",
            password: "",
        },
    });

    const handleSubmit = async (data: FormValues) => {
        setSubmitError(null);

        try {
            setIsLoading(true);
            const captchaToken = await execute("register");
            await register(data.firstName, data.lastName, data.email, data.password, captchaToken);
            onSuccess?.();
        } catch (error) {
            const fields = (error as { payload?: { errors?: Record<string, string[]> } })?.payload?.errors;
            if (fields) {
                const firstNameError = fields.firstName?.[0];
                const lastNameError = fields.lastName?.[0];
                const emailError = fields.email?.[0];
                const passwordError = fields.password?.[0];
                const captchaError = fields.captchaToken?.[0];

                if (firstNameError) form.setError("firstName", { type: "server", message: firstNameError });
                if (lastNameError) form.setError("lastName", { type: "server", message: lastNameError });
                if (emailError) form.setError("email", { type: "server", message: emailError });
                if (passwordError) form.setError("password", { type: "server", message: passwordError });

                if (captchaError) {
                    setSubmitError("No se pudo validar reCAPTCHA. Vuelve a intentarlo.");
                    return;
                }
            }

            setSubmitError(
                error instanceof Error ? error.message : "No se pudo crear la cuenta. Inténtalo de nuevo."
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Form {...form}>
            <form className="space-y-3" onSubmit={form.handleSubmit(handleSubmit)}>
                {submitError && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {submitError}
                    </div>
                )}

                <FormField
                    name="firstName"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem className="space-y-1.5">
                            <FormLabel htmlFor="signup-first-name" className="text-[12px] font-medium text-muted-foreground">Nombre</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <User
                                        size={16}
                                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                    />
                                    <Input
                                        id="signup-first-name"
                                        {...field}
                                        placeholder="Tu nombre"
                                        className="h-11 rounded-lg border-border/80 pl-10"
                                    />
                                </div>
                            </FormControl>
                            <FormMessage className="text-xs" />
                        </FormItem>
                    )}
                />

                <FormField
                    name="lastName"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem className="space-y-1.5">
                            <FormLabel htmlFor="signup-last-name" className="text-[12px] font-medium text-muted-foreground">Apellido</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <User
                                        size={16}
                                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                    />
                                    <Input
                                        id="signup-last-name"
                                        {...field}
                                        placeholder="Tus apellidos"
                                        className="h-11 rounded-lg border-border/80 pl-10"
                                    />
                                </div>
                            </FormControl>
                            <FormMessage className="text-xs" />
                        </FormItem>
                    )}
                />

                <FormField
                    name="email"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem className="space-y-1.5">
                            <FormLabel htmlFor="signup-email" className="text-[12px] font-medium text-muted-foreground">Correo electrónico</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Mail
                                        size={16}
                                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                    />
                                    <Input
                                        id="signup-email"
                                        {...field}
                                        type="email"
                                        placeholder="tu@email.com"
                                        className="h-11 rounded-lg border-border/80 pl-10"
                                    />
                                </div>
                            </FormControl>
                            <FormMessage className="text-xs" />
                        </FormItem>
                    )}
                />

                <FormField
                    name="password"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem className="space-y-1.5">
                            <FormLabel htmlFor="signup-password" className="text-[12px] font-medium text-muted-foreground">Contraseña</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Lock
                                        size={16}
                                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                    />
                                    <Input
                                        id="signup-password"
                                        {...field}
                                        type="password"
                                        placeholder="••••••••"
                                        className="h-11 rounded-lg border-border/80 pl-10"
                                    />
                                </div>
                            </FormControl>
                            <FormMessage className="text-xs" />
                        </FormItem>
                    )}
                />

                <Button
                    disabled={isLoading || isLoadingConfig}
                    className="h-11 w-full rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.99]"
                    type="submit"
                >
                    {isLoading ? "Creando..." : "Crear cuenta"}
                </Button>
            </form>
        </Form>
    );
};

export default SignUpForm;
