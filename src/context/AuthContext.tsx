import {
    createContext,
    ReactNode,
    useContext,
    useState,
} from "react";

import type { User } from "@/domain/models/User";
import type {
    ChangePasswordData,
    LoginCredentials,
    RegisterUserData,
    ResetPasswordData,
} from "@/domain/models/AuthCredentials";

import { authService, companyMembershipService } from "@/composition/auth";
import { queryClient } from "@/composition/queryClient";
import { UserRole } from "@/domain/models/UserRole";
import type { AuthSession } from "@/domain/models/AuthSession";
import { isAuthenticated as hasAuthenticatedSession } from "@/domain/models/AuthSession";
import { Uuid } from "@/domain/valueObject/uuidv4";
import type { CreateCompanyInput } from "@/domain/models/CompanyMembership";
import {
    extractBackendErrorCode,
    extractBackendErrorStatus,
} from "@/utils/backendError";
import { useCurrentUser } from "@/application/hooks/useCurrentUser";
import { isPlatformAdminUser, isRegularUser } from "@/domain/models/User";

interface AuthContextType {
    isAuthenticated: boolean;
    isLoading: boolean;
    currentUser: User | null;
    authBlockMessage: string | null;

    isLoggedIn: boolean;
    hasRole: (role: UserRole) => boolean;
    canAccess: (required: UserRole[]) => boolean;

    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    register: (
        firstName: string,
        lastName: string,
        email: string,
        password: string,
        captchaToken: string,
    ) => Promise<void>;
    requestPasswordReset: (email: string) => Promise<void>;
    resetPassword: (
        token: string,
        newPassword: string
    ) => Promise<void>;
    changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
    refreshCurrentUser: () => Promise<User | null>;
    getCurrentSession: () => Promise<AuthSession | null>;
    upgradeToCompany: (
        input: string | Omit<CreateCompanyInput, "companyId" | "ownerId">
    ) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const COMPANY_SUBSCRIPTION_INACTIVE_ERROR_CODE = "subscription.company.inactive.contact_account_manager";
const COMPANY_SUBSCRIPTION_INACTIVE_MESSAGE =
    "Hay un problema con la suscripción de tu empresa. Contacta con el gestor de la cuenta.";

const resolveAuthBlockMessage = (error: unknown): string | null => {
    if (extractBackendErrorStatus(error) !== 401) {
        return null;
    }

    const errorCode = extractBackendErrorCode(error);

    if (errorCode === COMPANY_SUBSCRIPTION_INACTIVE_ERROR_CODE) {
        return COMPANY_SUBSCRIPTION_INACTIVE_MESSAGE;
    }

    return null;
};

const isFetchNetworkError = (error: unknown): boolean =>
    error instanceof Error &&
    /Failed to fetch|fetch failed|Load failed|NetworkError/i.test(error.message);

const shouldPreserveCurrentUserAfterRefreshError = (error: unknown): boolean => {
    const status = extractBackendErrorStatus(error);

    return isFetchNetworkError(error) || (status !== null && status >= 500);
};

export const useAuth = (): AuthContextType => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
    return ctx;
};

//
// PROVIDER
//
export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [authBlockMessage, setAuthBlockMessage] = useState<string | null>(null);
    const [, forceAuthRender] = useState(0);

    const { user: currentUser, isLoading: isCurrentUserLoading, error } = useCurrentUser();
    const hasSession = hasAuthenticatedSession(authService.getCurrentSessionSync());
    const resolvedAuthBlockMessage = error
        ? resolveAuthBlockMessage(error)
        : authBlockMessage;
    const isLoading = hasSession && isCurrentUserLoading;

    const setCurrentUserQueryData = (user: User | null) => {
        queryClient.setQueryData(["currentUser"], user);
    };

    const getCurrentUserQueryData = (): User | null =>
        queryClient.getQueryData<User | null>(["currentUser"]) ?? null;

    const invalidateAuthQueries = (
        filters: Parameters<typeof queryClient.invalidateQueries>[0],
    ) => {
        void queryClient.invalidateQueries(filters).catch((error) => {
            console.error("Post-auth cache refresh failed", error);
        });
    };

    const resetQueryCacheForIdentity = (user: User | null) => {
        setCurrentUserQueryData(user);
        forceAuthRender((current) => current + 1);
        invalidateAuthQueries({
            predicate: (query) => query.queryKey[0] !== "currentUser",
        });
    };

    const invalidatePublicSessionQueries = () => {
        invalidateAuthQueries({ queryKey: ["product"] });
        invalidateAuthQueries({ queryKey: ["products"] });
        invalidateAuthQueries({ queryKey: ["category", "public"] });
    };

    //
    // Refrescar /me manualmente
    //
    const refreshCurrentUser = async (): Promise<User | null> => {
        try {
            const user = await authService.refreshCurrentUser();
            setCurrentUserQueryData(user);
            setAuthBlockMessage(null);
            return user;
        } catch (error) {
            const blockMessage = resolveAuthBlockMessage(error);

            if (blockMessage) {
                setCurrentUserQueryData(null);
                setAuthBlockMessage(blockMessage);
                return null;
            }

            const userToPreserve = currentUser ?? getCurrentUserQueryData();
            if (userToPreserve && shouldPreserveCurrentUserAfterRefreshError(error)) {
                setCurrentUserQueryData(userToPreserve);
                setAuthBlockMessage(null);
                return userToPreserve;
            }

            setCurrentUserQueryData(null);
            setAuthBlockMessage(null);
            return null;
        }
    };

    //
    // LOGIN
    //
    const login = async (email: string, password: string): Promise<void> => {
        setAuthBlockMessage(null);
        const previousToken = authService.getCurrentSessionSync()?.token ?? null;

        try {
            const credentials: LoginCredentials = { email, password };

            const user = await authService.login(credentials);
            resetQueryCacheForIdentity(user);
            invalidatePublicSessionQueries();
        } catch (error) {
            const session = authService.getCurrentSessionSync();
            if (
                session &&
                hasAuthenticatedSession(session) &&
                session.token !== previousToken
            ) {
                const user = await authService.refreshCurrentUser().catch(() => null);
                if (user) {
                    resetQueryCacheForIdentity(user);
                    invalidatePublicSessionQueries();
                    setAuthBlockMessage(null);
                    return;
                }
            }

            setAuthBlockMessage(resolveAuthBlockMessage(error));
            throw error;
        }
    };

    //
    // SIGNUP
    //
    const register = async (
        firstName: string,
        lastName: string,
        email: string,
        password: string,
        captchaToken: string,
    ): Promise<void> => {
        const data: RegisterUserData = {
            firstName,
            lastName,
            email,
            password,
            captchaToken,
        };

        await authService.register(data);
    };

    //
    // FORGOT PASSWORD
    //
    const requestPasswordReset = async (email: string): Promise<void> => {
        await authService.requestPasswordReset(email);
    };

    const resetPassword = async (
        token: string,
        newPassword: string
    ): Promise<void> => {
        const data: ResetPasswordData = { token, newPassword };
        await authService.resetPassword(data);
    };

    //
    // CHANGE PASSWORD (usuario autenticado)
    //
    const changePassword = async (
        oldPassword: string,
        newPassword: string
    ): Promise<void> => {
        const session = await authService.getCurrentSession();
        if (!session?.token) throw new Error("Not authenticated");

        const data: ChangePasswordData = {
            oldPassword,
            newPassword,
            token: session.token,
        };

        await authService.changePassword(data);
    };

    //
    // LOGOUT
    //
    const logout = async () => {
        await authService.logout();
        setAuthBlockMessage(null);

        resetQueryCacheForIdentity(null);
    };

    const upgradeToCompany = async (
        input: string | Omit<CreateCompanyInput, "companyId" | "ownerId">
    ): Promise<void> => {
        if (!currentUser) {
            throw new Error("Not authenticated");
        }

        const payload =
            typeof input === "string"
                ? { name: input }
                : input;

        const trimmedName = payload.name.trim();
        if (!trimmedName) {
            throw new Error("El nombre de la empresa es obligatorio.");
        }

        await companyMembershipService.createCompany({
            companyId: Uuid.generate().toString(),
            ownerId: currentUser.id,
            name: trimmedName,
            description: payload.description?.trim() || null,
            fiscalIdentifier: payload.fiscalIdentifier?.trim() || null,
            contactEmail: payload.contactEmail?.trim() || null,
            phoneNumber: payload.phoneNumber ?? null,
            address: payload.address ?? null,
            location: payload.location ?? null,
        });

        await refreshCurrentUser();
        await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    };

    //
    // ROLES
    //
    const hasRole = (role: UserRole): boolean => {
        if (!currentUser) {
            return false;
        }

        if (role === UserRole.ADMIN) {
            return isPlatformAdminUser(currentUser);
        }

        if (role === UserRole.REGULAR_USER) {
            return isRegularUser(currentUser);
        }

        return currentUser.roles?.includes(role) ?? false;
    };

    const canAccess = (required: UserRole[]): boolean => {
        if (!required || required.length === 0) return true;
        if (!currentUser) return false;

        if (isPlatformAdminUser(currentUser)) {
            return true;
        }

        return required.some((role) => hasRole(role));
    };

    return (
        <AuthContext.Provider
            value={{
                isLoggedIn: Boolean(currentUser),
                isAuthenticated: hasSession && !resolvedAuthBlockMessage,
                currentUser,
                authBlockMessage: resolvedAuthBlockMessage,
                isLoading,
                login,
                logout,
                register,
                requestPasswordReset,
                resetPassword,
                refreshCurrentUser,
                getCurrentSession: authService.getCurrentSession.bind(authService),
                hasRole,
                canAccess,
                changePassword,
                upgradeToCompany,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
