import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import FormHeader from "../common/FormHeader";
import { CompanyUsersTable } from "./users/CompanyUsersTable";
import { InviteUserDialog } from "./users/InviteUserDialog";
import { useAuth } from "@/context/AuthContext";
import {
    useCompanyUsers,
    useInviteCompanyUser,
    useRemoveCompanyUser,
    useUpdateCompanyUserRole,
} from "@/application/hooks/useCompanyMembership";
import type { CompanyUserRole } from "@/domain/models/CompanyMembership";
import type { GenericCapabilityLimits } from "@/domain/models/Subscription";
import { UserRole } from "@/domain/models/UserRole";
import {
    getUserCompanyId,
    getUserCompanyName,
    isCompanyAdminUser,
    isCompanyOwnerUser,
} from "@/domain/models/User";
import AccessRestricted from "@/components/dashboard/user-management/AccessRestricted";
import { getKnownBackendErrorMessage } from "@/utils/backendErrorMessages";

const getNumericLimit = (
    limits: GenericCapabilityLimits | null | undefined,
    key: string
): number | null => {
    const value = limits?.[key];
    return typeof value === "number" ? value : null;
};

const CompanyUsersPage = () => {
    const { companyId: routeCompanyId } = useParams();
    const { currentUser, hasRole } = useAuth();
    const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

    const userCompanyId = getUserCompanyId(currentUser);
    const effectiveCompanyId = routeCompanyId ?? userCompanyId ?? null;
    const isPlatformAdmin = hasRole(UserRole.ADMIN);
    const isCompanyOwner = isCompanyOwnerUser(currentUser);
    const isCompanyAdmin = isCompanyAdminUser(currentUser);
    const canManage = isPlatformAdmin || isCompanyOwner || isCompanyAdmin;

    const usersQuery = useCompanyUsers(canManage ? effectiveCompanyId : null);
    const inviteMutation = useInviteCompanyUser();
    const removeMutation = useRemoveCompanyUser();
    const updateRoleMutation = useUpdateCompanyUserRole();
    const companyContext = currentUser?.companyContext ?? null;

    const companyName = useMemo(() => {
        return getUserCompanyName(currentUser) ?? "Empresa";
    }, [currentUser]);

    const teamMemberLimit =
        companyContext?.entitlements?.quotas.teamMembers
        ?? getNumericLimit(companyContext?.entitlements?.capabilities?.teamManagement?.limits, "teamMembers")
        ?? getNumericLimit(companyContext?.capabilities?.teamManagement?.limits, "teamMembers");

    const countedTeamMembers = (usersQuery.data ?? []).filter(
        (user) => user.status !== "SUSPENDED"
    ).length;
    const isTeamLimitReached =
        typeof teamMemberLimit === "number" && countedTeamMembers >= teamMemberLimit;
    const teamLimitMessage =
        "Tu plan Starter incluye solo el propietario. Sube a Pro para invitar equipo.";

    if (!effectiveCompanyId) {
        return (
            <div className="space-y-6">
                <p className="text-sm text-muted-foreground">
                    No hay empresa asociada a tu usuario.
                </p>
            </div>
        );
    }

    if (userCompanyId && userCompanyId !== effectiveCompanyId && !isPlatformAdmin) {
        return (
            <div className="space-y-6">
                <p className="text-sm text-muted-foreground">
                    No tienes permisos para gestionar esta empresa.
                </p>
            </div>
        );
    }

    if (!canManage) {
        return <AccessRestricted />;
    }

    const handleInviteUser = async (data: { email: string; role: CompanyUserRole }) => {
        try {
            await inviteMutation.mutateAsync({
                companyId: effectiveCompanyId,
                email: data.email,
                role: data.role,
            });
            toast.success("Invitación enviada correctamente.");
            setInviteDialogOpen(false);
        } catch (error) {
            console.error("Error inviting company user", error);
            toast.error(getKnownBackendErrorMessage(error, "No se pudo enviar la invitación."));
        }
    };

    const handleRoleChange = async (userId: string, role: CompanyUserRole) => {
        try {
            await updateRoleMutation.mutateAsync({
                companyId: effectiveCompanyId,
                userId,
                role,
            });
            toast.success("Rol actualizado correctamente.");
        } catch (error) {
            console.error("Error updating user role", error);
            toast.error("No se pudo actualizar el rol.");
        }
    };

    const handleRemoveUser = async (userId: string) => {
        try {
            await removeMutation.mutateAsync({
                companyId: effectiveCompanyId,
                userId,
            });
            toast.success("Usuario eliminado de la empresa.");
        } catch (error) {
            console.error("Error removing company user", error);
            toast.error("No se pudo eliminar el usuario.");
        }
    };

    return (
        <div className="space-y-6">
            <FormHeader
                title={`Gestión de usuarios - ${companyName}`}
                backUrl={isPlatformAdmin ? "/dashboard/companies" : `/dashboard/companies/${effectiveCompanyId}`}
            />

            <div className="mb-6 flex items-center justify-between">
                <h2 className="text-lg font-medium">Usuarios de la empresa</h2>
                <Button
                    onClick={() => setInviteDialogOpen(true)}
                    className="gap-2"
                    disabled={inviteMutation.isPending || isTeamLimitReached}
                >
                    <Mail size={16} />
                    Invitar usuario
                </Button>
            </div>

            {isTeamLimitReached && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <p className="font-medium">{teamLimitMessage}</p>
                    <Button asChild size="sm" variant="outline" className="mt-3 bg-white">
                        <Link to="/dashboard/upgrade">Ver planes</Link>
                    </Button>
                </div>
            )}

            {usersQuery.isLoading && (
                <div className="flex justify-center py-8">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
            )}

            {usersQuery.isError && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    No se pudieron cargar los usuarios de empresa.
                </div>
            )}

            {!usersQuery.isLoading && !usersQuery.isError && (
                <CompanyUsersTable
                    users={usersQuery.data ?? []}
                    canManage={true}
                    onRoleChange={handleRoleChange}
                    onRemoveUser={handleRemoveUser}
                    isMutating={removeMutation.isPending || updateRoleMutation.isPending}
                />
            )}

            <InviteUserDialog
                open={inviteDialogOpen && !isTeamLimitReached}
                onOpenChange={setInviteDialogOpen}
                onSubmit={handleInviteUser}
                disabled={inviteMutation.isPending || isTeamLimitReached}
            />
        </div>
    );
};

export default CompanyUsersPage;
