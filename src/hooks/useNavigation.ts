import {useLocation} from "react-router-dom";
import { useMemo } from "react";
import {
    BarChart3,
    Building2,
    Calendar,
    CreditCard,
    Grid2X2Plus,
    Home,
    MessageCircle,
    Newspaper,
    Package,
    Settings,
    Users,
    type LucideIcon,
} from "lucide-react";
import type { NavigationIconKey, NavSection } from "@/domain/services/navigation/types";
import { useAuth } from "@/context/AuthContext";
import { buildDashboardNavigationSections } from "@/domain/services/navigation/NavigationConfig";
import {
    getUserCompanyId,
    hasCompanyMembership,
    isCompanyAdminUser,
    isCompanyOwnerUser,
    isPlatformAdminUser,
    isRegularUser,
} from "@/domain/models/User";

const navigationIcons: Record<NavigationIconKey, LucideIcon> = {
    home: Home,
    package: Package,
    calendar: Calendar,
    "message-circle": MessageCircle,
    "grid-2x2-plus": Grid2X2Plus,
    newspaper: Newspaper,
    "building-2": Building2,
    users: Users,
    "credit-card": CreditCard,
    "bar-chart-3": BarChart3,
    settings: Settings,
};

export const useNavigation = () => {
    const location = useLocation();
    const { currentUser } = useAuth();
    const companyId = getUserCompanyId(currentUser);

    const isAdmin = isPlatformAdminUser(currentUser);
    const isRegularAccount = isRegularUser(currentUser);
    const isCompanyMember = hasCompanyMembership(currentUser);
    const isCompanyOwner = isCompanyOwnerUser(currentUser);
    const isCompanyAdmin = isCompanyAdminUser(currentUser);
    const shouldShowRentalsItem = Boolean(currentUser) && !isAdmin;
    const showCompanyManagement = !isAdmin && isCompanyMember && Boolean(companyId) && (isCompanyOwner || isCompanyAdmin);
    const canManageCompanyUsers = showCompanyManagement;

    const canUpgradeToCompany = isRegularAccount && !isAdmin && !isCompanyMember;

    const navSections: NavSection[] = useMemo(() => {
        const sections = buildDashboardNavigationSections({
            companyId,
            shouldShowRentalsItem,
            showCompanyManagement,
            canManageCompanyUsers,
        });

        return sections.map((section) => ({
            ...section,
            items: section.items.map((item) => ({
                ...item,
                icon: item.iconKey ? navigationIcons[item.iconKey] : undefined,
            })),
        }));
    }, [canManageCompanyUsers, companyId, shouldShowRentalsItem, showCompanyManagement]);

    const normalizePath = (path: string): string => {
        if (path.length > 1 && path.endsWith("/")) {
            return path.slice(0, -1);
        }

        return path;
    };

    const pathname = normalizePath(location.pathname);
    const allNavItems = navSections.flatMap((section) => section.items);

    const activeItemHref = useMemo(() => {
        const matchingItems = allNavItems
            .filter((item) => {
                const itemHref = normalizePath(item.href);

                if (item.exact) {
                    return pathname === itemHref;
                }

                return pathname === itemHref || pathname.startsWith(`${itemHref}/`);
            })
            .sort((a, b) => b.href.length - a.href.length);

        return matchingItems[0]?.href ?? null;
    }, [allNavItems, pathname]);

    const isActive = (href: string, exact = false): boolean => {
        const normalizedHref = normalizePath(href);

        if (activeItemHref) {
            return normalizePath(activeItemHref) === normalizedHref;
        }

        if (exact) {
            return pathname === normalizedHref;
        }

        return (
            pathname === normalizedHref ||
            pathname.startsWith(`${normalizedHref}/`)
        );
    };

    return {
        navSections,
        canUpgradeToCompany,
        isActive,
    };
};
