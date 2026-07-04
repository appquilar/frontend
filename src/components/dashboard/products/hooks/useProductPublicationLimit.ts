import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useActiveProductsCount } from "@/application/hooks/useProducts";
import { useCreateCheckoutSession, useCreateCustomerPortalSession } from "@/application/hooks/useBilling";
import { useAuth } from "@/context/AuthContext";
import {
    getCompanyPlanProductLimit,
    getEffectiveUserPlan,
    getUserPlanProductLimit,
    type CompanyUserRoleType,
} from "@/domain/models/Subscription";
import { isPlatformAdminUser } from "@/domain/models/User";
import {
    buildBillingBaseUrl,
    buildBillingCheckoutSuccessUrl,
    buildBillingPortalReturnUrl,
    buildBillingReturnUrl,
} from "@/hooks/useBillingReturnSync";
import {
    getUserProCheckoutErrorMessage,
    useUserProCheckout,
} from "@/hooks/useUserProCheckout";
import { extractBackendErrorMessage } from "@/utils/backendError";

type PublicationLimitCta =
    | {
        label: "Hazte Pro";
        action: "upgrade_user_pro";
    }
    | {
        label: "Hazte empresa";
        action: "upgrade_to_company";
    }
    | {
        label: "Hazte Pro";
        action: "upgrade_company";
    }
    | {
        label: "Hazte Enterprise";
        action: "upgrade_company";
    };

export function useProductPublicationLimit() {
    const navigate = useNavigate();
    const { currentUser, isLoading: isAuthLoading } = useAuth();
    const createCheckoutMutation = useCreateCheckoutSession();
    const createPortalMutation = useCreateCustomerPortalSession();
    const userProCheckout = useUserProCheckout();

    const normalizedUser = currentUser as (typeof currentUser & {
        company_id?: string | null;
        user_id?: string;
    }) | null;
    const companyId = normalizedUser?.companyId ?? normalizedUser?.company_id ?? null;
    const userId = normalizedUser?.id ?? normalizedUser?.user_id ?? null;
    const isPlatformAdmin = isPlatformAdminUser(normalizedUser);
    const ownerId = companyId ?? userId;
    const ownerType: "company" | "user" = companyId ? "company" : "user";
    const effectiveUserPlan = getEffectiveUserPlan(
        normalizedUser?.planType ?? "explorer",
        normalizedUser?.subscriptionStatus ?? "active"
    );

    const slotLimit = useMemo(() => {
        if (isPlatformAdmin) {
            return null;
        }

        if (companyId) {
            return normalizedUser?.companyContext?.productSlotLimit
                ?? getCompanyPlanProductLimit(normalizedUser?.companyContext ?? null);
        }

        return normalizedUser?.productSlotLimit
            ?? getUserPlanProductLimit(
                normalizedUser?.planType ?? "explorer",
                normalizedUser?.subscriptionStatus ?? "active",
                normalizedUser?.entitlements ?? null
            );
    }, [
        companyId,
        normalizedUser?.companyContext,
        normalizedUser?.productSlotLimit,
        normalizedUser?.entitlements,
        normalizedUser?.planType,
        normalizedUser?.subscriptionStatus,
        isPlatformAdmin,
    ]);

    const activeProductsCountQuery = useActiveProductsCount({
        ownerId,
        ownerType,
    });

    const hasReachedProductPublicationLimit = useMemo(() => {
        if (slotLimit == null) {
            return false;
        }

        const activeProducts = activeProductsCountQuery.data ?? 0;
        return activeProducts >= slotLimit;
    }, [activeProductsCountQuery.data, slotLimit]);

    const companyRole =
        (normalizedUser?.companyContext?.companyRole ?? normalizedUser?.companyRole ?? null) as CompanyUserRoleType | null;
    const isCompanyAdmin = companyRole === "ROLE_ADMIN";
    const publicationLimitCta = useMemo<PublicationLimitCta | null>(() => {
        if (!hasReachedProductPublicationLimit) {
            return null;
        }

        if (!companyId) {
            if (effectiveUserPlan === "user_pro") {
                return {
                    label: "Hazte empresa",
                    action: "upgrade_to_company",
                };
            }

            return {
                label: "Hazte Pro",
                action: "upgrade_user_pro",
            };
        }

        const companyPlan = normalizedUser?.companyContext?.planType ?? null;
        if (!isCompanyAdmin) {
            return null;
        }

        if (companyPlan === "starter") {
            return {
                label: "Hazte Pro",
                action: "upgrade_company",
            };
        }

        if (companyPlan === "pro") {
            return {
                label: "Hazte Enterprise",
                action: "upgrade_company",
            };
        }

        return null;
    }, [
        companyId,
        hasReachedProductPublicationLimit,
        isCompanyAdmin,
        normalizedUser?.companyContext?.planType,
        effectiveUserPlan,
    ]);

    const handlePublicationLimitCta = useCallback(async () => {
        if (!publicationLimitCta) {
            return;
        }

        if (publicationLimitCta.action === "upgrade_to_company") {
            navigate("/dashboard/upgrade");
            return;
        }

        const currentUrl = typeof window !== "undefined" ? window.location.href : "/dashboard/products";
        const currentBaseUrl = buildBillingBaseUrl(currentUrl);

        try {
            if (publicationLimitCta.action === "upgrade_user_pro") {
                if (!userProCheckout.isCheckoutAvailable) {
                    toast.error(
                        userProCheckout.unavailableMessage ??
                            "User Pro no esta disponible para activar ahora mismo."
                    );
                    return;
                }

                const checkoutSession = await createCheckoutMutation.mutateAsync({
                    scope: "user",
                    planType: "user_pro",
                    successUrl: buildBillingCheckoutSuccessUrl(
                        currentBaseUrl,
                        "user",
                        "user_pro"
                    ),
                    cancelUrl: currentBaseUrl,
                });

                window.location.assign(checkoutSession.url);
                return;
            }

            const newTab = window.open("", "_blank");
            if (!newTab) {
                toast.error("No se pudo abrir una nueva pestana. Revisa el bloqueador de ventanas emergentes.");
                return;
            }
            newTab.opener = null;

            try {
                const portalSession = await createPortalMutation.mutateAsync({
                    scope: "company",
                    returnUrl: normalizedUser?.companyContext
                        ? buildBillingPortalReturnUrl(currentBaseUrl, "company", {
                              planType: normalizedUser.companyContext.planType,
                              subscriptionStatus:
                                  normalizedUser.companyContext.subscriptionStatus,
                              subscriptionCancelAtPeriodEnd:
                                  normalizedUser.companyContext.subscriptionCancelAtPeriodEnd,
                          })
                        : buildBillingReturnUrl(currentBaseUrl, "company"),
                });

                newTab.location.href = portalSession.url;
            } catch (error) {
                newTab.close();
                throw error;
            }
        } catch (error) {
            toast.error(
                publicationLimitCta.action === "upgrade_user_pro"
                    ? getUserProCheckoutErrorMessage(
                          error,
                          "No se pudo iniciar el proceso de mejora del plan."
                      )
                    : (extractBackendErrorMessage(error) ??
                      "No se pudo iniciar el proceso de mejora del plan.")
            );
        }
    }, [
        createCheckoutMutation,
        createPortalMutation,
        navigate,
        normalizedUser?.companyContext,
        publicationLimitCta,
        userProCheckout.isCheckoutAvailable,
        userProCheckout.unavailableMessage,
    ]);

    return {
        ownerId,
        ownerType,
        isAuthLoading,
        slotLimit,
        activeProductsCountQuery,
        publicationLimitCta,
        publicationLimitCtaLabel: publicationLimitCta?.label ?? null,
        isPublicationLimitLoading: isAuthLoading || activeProductsCountQuery.isLoading,
        hasReachedProductPublicationLimit,
        handlePublicationLimitCta,
        isProcessingPublicationLimitCta:
            createCheckoutMutation.isPending ||
            createPortalMutation.isPending ||
            userProCheckout.isLoading,
    };
}
