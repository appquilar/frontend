export type SubscriptionStatus = "active" | "paused" | "canceled";

export type UserPlanType = "explorer" | "user_pro";
export type CompanyPlanType = "starter" | "pro" | "enterprise" | "early_bird";

export type CompanyUserRoleType = "ROLE_ADMIN" | "ROLE_CONTRIBUTOR";
export type CapabilityState = "enabled" | "read_only" | "disabled";
export type CapabilityKey = keyof FeatureCapabilities;

export interface GenericCapabilityLimits {
    [key: string]: number | null;
}

export interface FeatureCapability {
    state: CapabilityState;
    limits?: GenericCapabilityLimits | null;
}

export interface CapabilityLimits {
    maxProductsWithInventory: number | null;
    maxQuantityPerProduct: number | null;
}

export interface InventoryManagementCapability {
    state: CapabilityState;
    limits: CapabilityLimits;
}

export interface FeatureCapabilities {
    inventoryManagement?: InventoryManagementCapability | null;
    basicAnalytics?: FeatureCapability | null;
    advancedAnalytics?: FeatureCapability | null;
    teamManagement?: FeatureCapability | null;
    customDomain?: FeatureCapability | null;
    branding?: FeatureCapability | null;
    apiAccess?: FeatureCapability | null;
}

export interface SubscriptionQuotaSet {
    activeProducts: number | null;
    teamMembers: number | null;
}

export interface SubscriptionOverrides {
    isPlatformAdmin: boolean;
    isCompanyOwner: boolean;
    isCompanyAdmin: boolean;
    isFoundingAccount: boolean;
}

export interface SubscriptionEntitlements<TPlanType extends string = string> {
    planType: TPlanType;
    subscriptionStatus: SubscriptionStatus;
    quotas: SubscriptionQuotaSet;
    capabilities: FeatureCapabilities;
    overrides: SubscriptionOverrides;
}

export interface CompanyContext {
    companyId: string;
    companyName: string;
    companyRole: CompanyUserRoleType;
    isCompanyOwner: boolean;
    planType: CompanyPlanType;
    subscriptionStatus: SubscriptionStatus;
    subscriptionCancelAtPeriodEnd?: boolean | null;
    isFoundingAccount: boolean;
    productSlotLimit?: number | null;
    capabilities?: FeatureCapabilities | null;
    entitlements?: SubscriptionEntitlements<CompanyPlanType> | null;
}

export interface UserSubscriptionContext {
    planType?: UserPlanType | null;
    subscriptionStatus?: SubscriptionStatus | null;
    capabilities?: FeatureCapabilities | null;
    entitlements?: SubscriptionEntitlements<UserPlanType> | null;
}

export const isSubscriptionActive = (status: SubscriptionStatus | string | null | undefined): boolean => {
    return status === "active";
};

export const getEffectiveUserPlan = (
    planType: UserPlanType | null | undefined,
    subscriptionStatus: SubscriptionStatus | string | null | undefined
): UserPlanType => {
    if (planType === "user_pro" && isSubscriptionActive(subscriptionStatus)) {
        return "user_pro";
    }

    return "explorer";
};

export const getUserPlanProductLimit = (
    planType: UserPlanType | null | undefined,
    subscriptionStatus?: SubscriptionStatus | string | null,
    entitlements?: SubscriptionEntitlements<UserPlanType> | null
): number | null => {
    if (entitlements) {
        return entitlements.quotas.activeProducts;
    }

    const effectivePlan = getEffectiveUserPlan(planType, subscriptionStatus);

    if (effectivePlan === "user_pro") {
        return 5;
    }

    return 2;
};

export const getCompanyPlanProductLimit = (context: CompanyContext | null | undefined): number | null => {
    if (!context) {
        return null;
    }

    if (context.entitlements) {
        return context.entitlements.quotas.activeProducts;
    }

    if (context.isFoundingAccount) {
        return null;
    }

    const effectivePlan = isSubscriptionActive(context.subscriptionStatus)
        ? context.planType
        : "starter";

    switch (effectivePlan) {
        case "starter":
            return 10;
        case "pro":
            return 10;
        default:
            return null;
    }
};

export const isCompanyAdvancedAnalyticsEnabled = (
    context: CompanyContext | null | undefined
): boolean => {
    return hasCompanyCapabilityAccess(context, "advancedAnalytics");
};

export const isCompanyPremiumAdvancedStatsEnabled = (
    context: CompanyContext | null | undefined,
    isPlatformAdmin = false
): boolean => {
    if (isPlatformAdmin) {
        return true;
    }

    if (!context) {
        return false;
    }

    return hasCompanyCapabilityAccess(context, "apiAccess");
};

export const canManageInventoryCapability = (
    capability: InventoryManagementCapability | null | undefined
): boolean => capability?.state === "enabled";

export const hasInventoryReadAccess = (
    capability: InventoryManagementCapability | null | undefined
): boolean => capability?.state === "enabled" || capability?.state === "read_only";

type ResolvedCapability =
    | FeatureCapability
    | InventoryManagementCapability
    | null;

const resolveCapabilityAccess = (
    capability: ResolvedCapability,
    allowedStates: CapabilityState[] = ["enabled", "read_only"]
): boolean => {
    if (!capability) {
        return false;
    }

    return allowedStates.includes(capability.state);
};

export const getCompanyCapability = <TKey extends CapabilityKey>(
    context: CompanyContext | null | undefined,
    capabilityKey: TKey
): NonNullable<FeatureCapabilities[TKey]> | null => {
    const entitlementCapability = context?.entitlements?.capabilities?.[capabilityKey];
    if (entitlementCapability != null) {
        return entitlementCapability as NonNullable<FeatureCapabilities[TKey]>;
    }

    const legacyCapability = context?.capabilities?.[capabilityKey];
    return legacyCapability != null
        ? (legacyCapability as NonNullable<FeatureCapabilities[TKey]>)
        : null;
};

export const getUserCapability = <TKey extends CapabilityKey>(
    user: UserSubscriptionContext | null | undefined,
    capabilityKey: TKey
): NonNullable<FeatureCapabilities[TKey]> | null => {
    const entitlementCapability = user?.entitlements?.capabilities?.[capabilityKey];
    if (entitlementCapability != null) {
        return entitlementCapability as NonNullable<FeatureCapabilities[TKey]>;
    }

    const legacyCapability = user?.capabilities?.[capabilityKey];
    return legacyCapability != null
        ? (legacyCapability as NonNullable<FeatureCapabilities[TKey]>)
        : null;
};

export const hasCompanyCapabilityAccess = (
    context: CompanyContext | null | undefined,
    capabilityKey: CapabilityKey,
    allowedStates: CapabilityState[] = ["enabled", "read_only"]
): boolean => {
    if (isActiveEarlyBirdCompany(context) && isEarlyBirdAdvancedCapability(capabilityKey)) {
        return allowedStates.includes("enabled");
    }

    return resolveCapabilityAccess(
        getCompanyCapability(context, capabilityKey) as ResolvedCapability,
        allowedStates
    );
};

export const hasUserCapabilityAccess = (
    user: UserSubscriptionContext | null | undefined,
    capabilityKey: CapabilityKey,
    allowedStates: CapabilityState[] = ["enabled", "read_only"]
): boolean => {
    return resolveCapabilityAccess(
        getUserCapability(user, capabilityKey) as ResolvedCapability,
        allowedStates
    );
};

export const isUserBasicAnalyticsEnabled = (
    user: UserSubscriptionContext | null | undefined
): boolean => hasUserCapabilityAccess(user, "basicAnalytics");

const isActiveEarlyBirdCompany = (context: CompanyContext | null | undefined): boolean => {
    if (!context || !isSubscriptionActive(context.subscriptionStatus)) {
        return false;
    }

    return context.planType === "early_bird"
        || context.isFoundingAccount
        || context.entitlements?.planType === "early_bird"
        || context.entitlements?.overrides.isFoundingAccount === true;
};

const isEarlyBirdAdvancedCapability = (capabilityKey: CapabilityKey): boolean => {
    return capabilityKey === "advancedAnalytics" || capabilityKey === "apiAccess";
};
