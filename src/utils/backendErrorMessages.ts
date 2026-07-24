import { extractBackendErrorCode, extractBackendErrorMessage } from "@/utils/backendError";

const KNOWN_BACKEND_MESSAGES: Record<string, string> = {
    "subscription.company.team_limit_reached":
        "Tu plan Starter incluye solo el propietario. Sube a Pro para invitar equipo.",
    "subscription.company.team_limit_owner_only":
        "Tu plan Starter incluye solo el propietario. Sube a Pro para invitar equipo.",
    "company.user.access_denied":
        "No tienes permisos para gestionar usuarios de esta empresa.",
    "company.accept_invitation.user_already_exists":
        "Ese email ya tiene cuenta. Usa \"Ya tengo cuenta\" para aceptar la invitación.",
    "company.accept_invitation.login_required":
        "Esta invitación está asociada a una cuenta existente. Usa \"Ya tengo cuenta\".",
    "company.accept_invitation.already_accepted":
        "Esta invitación ya fue aceptada.",
    "company.accept_invitation.expired":
        "Esta invitación ha caducado. Solicita una nueva invitación.",
    "company.accept_invitation.suspended":
        "Esta invitación está suspendida. Contacta con un administrador de la empresa.",
    "company.accept_invitation.email_mismatch":
        "El email de la cuenta no coincide con el email invitado.",
    "company.invitation.already_exists":
        "Ya existe una invitación para este correo electrónico.",
    "company.accept_invitation.credentials_required":
        "Completa tus datos para aceptar la invitación.",
};

export const getKnownBackendErrorMessage = (
    error: unknown,
    fallback: string
): string => {
    const code = extractBackendErrorCode(error);
    if (code && KNOWN_BACKEND_MESSAGES[code]) {
        return KNOWN_BACKEND_MESSAGES[code];
    }

    const message = extractBackendErrorMessage(error);
    return message && KNOWN_BACKEND_MESSAGES[message]
        ? KNOWN_BACKEND_MESSAGES[message]
        : fallback;
};
