import type {ReactNode} from "react";
import {Link, Navigate, useLocation} from "react-router-dom";
import {useAuth} from "@/context/AuthContext";
import {Loader2} from "lucide-react";
import { authModalReturnToStorageKey } from "@/hooks/useAuthModalLauncher";

interface ProtectedRouteProps {
    children: ReactNode;
}

/**
 * ProtectedRoute
 *
 * Envuelve rutas que requieren sesión iniciada.
 * Usa el estado de AuthContext (que a su vez se basa en /me)
 * para decidir si mostrar el contenido o redirigir.
 */
const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
    const { currentUser, isLoading, authBlockMessage } = useAuth();
    const location = useLocation();

    // Mientras AuthContext está cargando (llamando a /me), no sabemos aún si hay sesión.
    if (isLoading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Comprobando tu sesión...</span>
                </div>
            </div>
        );
    }

    if (!currentUser && authBlockMessage) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center px-4">
                <div className="w-full max-w-xl rounded-2xl border border-[#F19D70]/30 bg-white p-6 shadow-sm sm:p-8">
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                        Acceso restringido
                    </h2>
                    <p className="mt-3 text-sm text-slate-600">
                        {authBlockMessage}
                    </p>
                    <Link
                        to="/"
                        className="mt-6 inline-flex items-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    >
                        Volver al inicio
                    </Link>
                </div>
            </div>
        );
    }

    // Si no hay usuario, no hay sesión válida -> redirigimos fuera del dashboard.
    if (!currentUser) {
        sessionStorage.setItem("auth:initialTab", "signin");
        sessionStorage.setItem("auth:infoMessage", "Inicia sesión para continuar.");
        sessionStorage.setItem(authModalReturnToStorageKey, location.pathname + location.search);

        return (
            <Navigate
                to="/"
                replace
                state={{ from: location.pathname + location.search }}
            />
        );
    }

    // Sesión válida -> mostramos la ruta protegida.
    return <>{children}</>;
};

export default ProtectedRoute;
