import React from "react";
import {useNavigate} from "react-router-dom";
import {useIsMobile} from "@/hooks/use-mobile";
import {DashboardNavigationProps} from "./types";
import UserProfile from "./UserProfile";
import NavSection from "./NavSection";
import UpgradeLink from "./UpgradeLink";
import UpgradeToProLink from "./UpgradeToProLink";
import {useNavigation} from "@/hooks/useNavigation";
import {Alert, AlertDescription} from "@/components/ui/alert";
import {MapPin} from "lucide-react";
import {useAuth} from "@/context/AuthContext";
import {UserRole} from "@/domain/models/UserRole";
import { useSidebar } from "@/components/ui/sidebar";
import { getEffectiveUserPlan } from "@/domain/models/Subscription";
import { useProductOwnerAddress } from "@/application/hooks/useProductOwnerAddress";
import { useOwnerProductSummary } from "@/application/hooks/useProducts";

/**
 * Contenido principal de la navegación del panel de control
 */
const DashboardNavigationContent = ({
                                        activeTab,
                                        onTabChange,
                                        onNavigate,
                                    }: DashboardNavigationProps) => {
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const { navSections, canUpgradeToCompany, isActive } = useNavigation();
    const { setOpenMobile } = useSidebar();

    const { currentUser, hasRole, canAccess } = useAuth();
    const {
        hasRequiredAddress,
        isLoading: isProductOwnerAddressLoading,
        ownerType,
        settingsHref,
    } = useProductOwnerAddress();
    const isAdmin = hasRole(UserRole.ADMIN);
    const isRegularUser = hasRole(UserRole.REGULAR_USER);
    const hasCompany = Boolean(currentUser?.companyContext?.companyId ?? currentUser?.companyId);
    const ownerProductSummaryQuery = useOwnerProductSummary({
        ownerId: !hasCompany && !isAdmin ? currentUser?.id ?? null : null,
        ownerType: "user",
        enabled: Boolean(currentUser?.id && !hasCompany && !isAdmin),
    });
    const hasOwnerProducts = (ownerProductSummaryQuery.data?.total ?? 0) > 0;
    const shouldShowProviderPrompts =
        hasCompany ||
        isAdmin ||
        ownerProductSummaryQuery.isLoading ||
        hasOwnerProducts;
    const effectiveUserPlan = getEffectiveUserPlan(
        currentUser?.planType,
        currentUser?.subscriptionStatus
    );
    const isUserPro = effectiveUserPlan === "user_pro";
    const canUpgradeToUserPro = isRegularUser && !isAdmin && !hasCompany && !isUserPro;

    const handleTabChange = (href: string) => {
        const tabName =
            href === "/dashboard"
                ? "overview"
                : href.split("/").pop() || "overview";

        if (onTabChange) onTabChange(tabName);
        if (onNavigate) onNavigate();
        if (isMobile) {
            setOpenMobile(false);
        }
    };

    const filteredSections = navSections
        .map((section) => {
            const visibleItems = section.items.filter((item) => canAccess(item.requiredRoles ?? []));

            return {
                ...section,
                items: visibleItems,
            };
        })
        .filter((section) => section.items.length > 0);

    return (
        <div className="flex flex-col h-full px-2 pb-3">
            {/* Enlaces de navegación */}
            <nav className={`p-2 flex-grow ${isMobile ? "py-4" : ""}`}>
                <ul className="space-y-1.5">
                    {filteredSections.map((section) => (
                        <NavSection
                            key={section.id}
                            title={section.title}
                            items={section.items}
                            isActive={isActive}
                            onTabChange={handleTabChange}
                        />
                    ))}
                </ul>
            </nav>

            {/* Alerta de dirección vacía */}
            {shouldShowProviderPrompts && !isProductOwnerAddressLoading && !hasRequiredAddress && (
                <div className="px-2 mb-2">
                    <Alert
                        className="cursor-pointer rounded-2xl border border-slate-200/80 bg-white/80 hover:bg-white transition-colors shadow-sm"
                        onClick={() => {
                            navigate(settingsHref);
                            if (isMobile) {
                                setOpenMobile(false);
                            }
                        }}
                    >
                        <MapPin className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                            {ownerType === "company"
                                ? "Añade la dirección de la empresa"
                                : "Añade tu dirección en Configuración"}
                        </AlertDescription>
                    </Alert>
                </div>
            )}

            {shouldShowProviderPrompts && canUpgradeToUserPro && (
                <div className="px-2 mb-2">
                    <UpgradeToProLink
                        onAfterNavigate={() => {
                            if (isMobile) {
                                setOpenMobile(false);
                            }
                        }}
                    />
                </div>
            )}

            {/* Enlace para actualizar a cuenta de empresa (justo antes del perfil) */}
            {shouldShowProviderPrompts && canUpgradeToCompany && (
                <div className="px-2 mb-2">
                    <UpgradeLink
                        onAfterNavigate={() => {
                            if (isMobile) {
                                setOpenMobile(false);
                            }
                        }}
                    />
                </div>
            )}

            {/* Información del usuario/empresa en la parte inferior */}
            <div className="mt-auto pt-2">
                <UserProfile />
            </div>
        </div>
    );
};

export default DashboardNavigationContent;
