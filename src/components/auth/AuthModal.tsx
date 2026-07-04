import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { X } from "lucide-react";

import SignInForm from "./SignInForm";
import SignUpForm from "./SignUpForm";
import ForgotPasswordForm from "./ForgotPasswordForm";
import AppLogo from "@/components/common/AppLogo";
import { authModalReturnToStorageKey } from "@/hooks/useAuthModalLauncher";

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AuthModal = ({ isOpen, onClose }: AuthModalProps) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<"signin" | "signup" | "forgot">(
        "signin",
    );

    /**
     * Mensaje informativo que se muestra sobre el formulario de login.
     * Se usa para:
     * - Contraseña cambiada (vía dashboard)
     * - Registro correcto
     * - Envío de email de recuperación
     */
    const [infoMessage, setInfoMessage] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            const requestedTab = sessionStorage.getItem("auth:initialTab");
            if (requestedTab === "signup") {
                setActiveTab("signup");
            } else {
                // Siempre abrimos en login salvo que se solicite registro explícitamente
                setActiveTab("signin");
            }
            sessionStorage.removeItem("auth:initialTab");

            // Leer mensaje informativo (si existe)
            const infoMessageFromSession =
                sessionStorage.getItem("auth:infoMessage") ??
                sessionStorage.getItem("auth:postChangePasswordMessage");

            if (infoMessageFromSession) {
                setInfoMessage(infoMessageFromSession);
                sessionStorage.removeItem("auth:infoMessage");
                sessionStorage.removeItem("auth:postChangePasswordMessage");
            } else {
                // Si abrimos "normal", limpiamos cualquier mensaje anterior
                setInfoMessage(null);
            }
        } else {
            // Al cerrar el modal limpiamos el mensaje
            setInfoMessage(null);
        }
    }, [isOpen]);

    const resolveReturnTo = (returnTo: string | null) => {
        if (!returnTo?.startsWith("/")) {
            return null;
        }

        if (
            activeTab === "signup" &&
            (/^\/dashboard\/(?:products|rentals)\/[^/?]+/.test(returnTo) ||
                returnTo.startsWith("/dashboard/messages"))
        ) {
            return "/dashboard";
        }

        return returnTo;
    };

    const handleAuthSuccess = async () => {
        const returnTo = sessionStorage.getItem(authModalReturnToStorageKey);
        sessionStorage.removeItem(authModalReturnToStorageKey);
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["product"] }),
            queryClient.invalidateQueries({ queryKey: ["products"] }),
        ]);
        await queryClient.refetchQueries({ queryKey: ["product"], type: "active" });
        onClose();

        const target = resolveReturnTo(returnTo);
        if (target) {
            navigate(target);
        }
    };

    const isSignInFlowActive = activeTab === "signin" || activeTab === "forgot";

    return (
        <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="auth-modal-content w-[92vw] max-w-[450px] overflow-hidden rounded-[18px] border border-border/70 bg-white p-0 shadow-[0_24px_60px_rgba(15,23,42,0.16)] duration-150 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 [&>button]:hidden">
                {/* Header accesible (no visible) */}
                <DialogHeader className="sr-only">
                    <DialogTitle>Autenticación</DialogTitle>
                    <DialogDescription>
                        Cuadro de diálogo para iniciar sesión, registrarse o recuperar tu
                        contraseña.
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[88vh] overflow-y-auto">
                    <div className="sticky top-0 z-20 border-b border-border/70 bg-white/95 backdrop-blur-md">
                        <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-5">
                            <div className="min-w-0">
                                <div className="mb-2">
                                    <AppLogo imageClassName="h-7 w-auto" textClassName="text-lg font-display font-semibold tracking-tight text-primary" />
                                </div>
                                <h3 className="text-lg font-semibold tracking-tight text-foreground">Accede a tu cuenta</h3>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Gestiona tus alquileres, mensajes y perfil.
                                </p>
                            </div>

                            <DialogClose asChild>
                                <button
                                    type="button"
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/70 bg-white text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                    aria-label="Cerrar"
                                >
                                    <X size={16} />
                                </button>
                            </DialogClose>
                        </div>

                        <div className="px-5 pb-1">
                            <div
                                aria-label="Seleccionar modo de autenticación"
                                className="grid grid-cols-2"
                            >
                                <button
                                    type="button"
                                    aria-pressed={isSignInFlowActive}
                                    className={`relative flex h-11 items-center justify-center text-sm font-medium transition-colors after:absolute after:bottom-[-1px] after:left-5 after:right-5 after:h-0.5 after:rounded-full ${
                                        isSignInFlowActive
                                            ? "text-foreground after:bg-primary"
                                            : "text-muted-foreground hover:text-foreground after:bg-transparent"
                                    }`}
                                    onClick={() => setActiveTab("signin")}
                                >
                                    Iniciar sesión
                                </button>

                                <button
                                    type="button"
                                    aria-pressed={activeTab === "signup"}
                                    className={`relative flex h-11 items-center justify-center text-sm font-medium transition-colors after:absolute after:bottom-[-1px] after:left-5 after:right-5 after:h-0.5 after:rounded-full ${
                                        activeTab === "signup"
                                            ? "text-foreground after:bg-primary"
                                            : "text-muted-foreground hover:text-foreground after:bg-transparent"
                                    }`}
                                    onClick={() => setActiveTab("signup")}
                                >
                                    Registrarse
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="px-5 pb-5 pt-4">
                        {activeTab === "signin" && (
                            <SignInForm
                                onSuccess={handleAuthSuccess}
                                onForgotPassword={() => setActiveTab("forgot")}
                                infoMessage={infoMessage}
                            />
                        )}

                        {activeTab === "signup" && (
                            <SignUpForm
                                onSuccess={handleAuthSuccess}
                            />
                        )}

                        {activeTab === "forgot" && (
                            <ForgotPasswordForm
                                onBack={() => setActiveTab("signin")}
                                onSuccess={() => {
                                    // Tras enviar el email, volvemos al login con mensaje
                                    setActiveTab("signin");
                                    setInfoMessage(
                                        "Te hemos enviado un correo con instrucciones para restablecer tu contraseña.",
                                    );
                                }}
                            />
                        )}

                        <div className="mt-5 border-t border-border/70 pt-4 text-center text-xs text-muted-foreground">
                            {activeTab === "signin" ? (
                                <>
                                    ¿No tienes cuenta?{" "}
                                    <button
                                        type="button"
                                        className="font-medium text-primary hover:underline"
                                        onClick={() => setActiveTab("signup")}
                                    >
                                        Regístrate
                                    </button>
                                </>
                            ) : activeTab === "signup" ? (
                                <>
                                    ¿Ya tienes cuenta?{" "}
                                    <button
                                        type="button"
                                        className="font-medium text-primary hover:underline"
                                        onClick={() => setActiveTab("signin")}
                                    >
                                        Inicia sesión
                                    </button>
                                </>
                            ) : (
                                <>
                                    ¿Recuerdas tu contraseña?{" "}
                                    <button
                                        type="button"
                                        className="font-medium text-primary hover:underline"
                                        onClick={() => setActiveTab("signin")}
                                    >
                                        Volver al acceso
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default AuthModal;
