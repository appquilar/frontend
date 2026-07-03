export type BillingScope = "user" | "company";

export type UserBillingPlanType = "user_pro";
export type CompanyBillingPlanType = "starter" | "pro" | "enterprise" | "early_bird";
export type BillingPlanType = UserBillingPlanType | CompanyBillingPlanType;

export interface CreateCheckoutSessionInput {
    scope: BillingScope;
    planType: BillingPlanType;
    successUrl: string;
    cancelUrl: string;
}

export interface CreateCompanyUpgradeCheckoutSessionInput {
    name: string;
    description?: string | null;
    fiscalIdentifier?: string | null;
    contactEmail?: string | null;
    phoneNumber?: {
        countryCode: string;
        prefix: string;
        number: string;
    } | null;
    address?: {
        street: string;
        street2?: string | null;
        city: string;
        postalCode: string;
        state: string;
        country: string;
    } | null;
    location?: {
        latitude: number;
        longitude: number;
    } | null;
    planType: CompanyBillingPlanType;
    successUrl: string;
    cancelUrl: string;
}

export interface CreateCustomerPortalSessionInput {
    scope: BillingScope;
    returnUrl: string;
}

export interface ReactivateSubscriptionInput {
    scope: BillingScope;
}

export interface SynchronizeCheckoutSessionInput {
    scope: BillingScope;
    sessionId: string;
}

export interface MigrateCompanyToExplorerInput {
    targetOwnerUserId?: string | null;
    confirm: boolean;
}

export interface CompanyMigrationResult {
    migratedOwnerUserId: string;
    companyDeleted: boolean;
}

export interface BillingSessionResult {
    url: string;
}

export interface CheckoutSessionSynchronizationResult {
    synchronized: boolean;
}

export interface SubscriptionReactivationResult {
    reactivated: boolean;
}
