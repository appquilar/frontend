import type {
    BillingSessionResult,
    CheckoutSessionSynchronizationResult,
    CompanyMigrationResult,
    CreateCompanyUpgradeCheckoutSessionInput,
    CreateCheckoutSessionInput,
    CreateCustomerPortalSessionInput,
    MigrateCompanyToExplorerInput,
    ReactivateSubscriptionInput,
    SubscriptionReactivationResult,
    SynchronizeCheckoutSessionInput,
} from "@/domain/models/Billing";

export interface BillingRepository {
    createCheckoutSession(input: CreateCheckoutSessionInput): Promise<BillingSessionResult>;
    createCompanyUpgradeCheckoutSession(input: CreateCompanyUpgradeCheckoutSessionInput): Promise<BillingSessionResult>;
    createCustomerPortalSession(input: CreateCustomerPortalSessionInput): Promise<BillingSessionResult>;
    reactivateSubscription(input: ReactivateSubscriptionInput): Promise<SubscriptionReactivationResult>;
    synchronizeCheckoutSession(input: SynchronizeCheckoutSessionInput): Promise<CheckoutSessionSynchronizationResult>;
    migrateCompanyToExplorer(input: MigrateCompanyToExplorerInput): Promise<CompanyMigrationResult>;
}
