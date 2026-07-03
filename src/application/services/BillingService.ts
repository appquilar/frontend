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
import type { BillingRepository } from "@/domain/repositories/BillingRepository";

export class BillingService {
    constructor(private readonly billingRepository: BillingRepository) {}

    async createCheckoutSession(
        input: CreateCheckoutSessionInput
    ): Promise<BillingSessionResult> {
        return this.billingRepository.createCheckoutSession(input);
    }

    async createCompanyUpgradeCheckoutSession(
        input: CreateCompanyUpgradeCheckoutSessionInput
    ): Promise<BillingSessionResult> {
        return this.billingRepository.createCompanyUpgradeCheckoutSession(input);
    }

    async createCustomerPortalSession(
        input: CreateCustomerPortalSessionInput
    ): Promise<BillingSessionResult> {
        return this.billingRepository.createCustomerPortalSession(input);
    }

    async reactivateSubscription(
        input: ReactivateSubscriptionInput
    ): Promise<SubscriptionReactivationResult> {
        return this.billingRepository.reactivateSubscription(input);
    }

    async synchronizeCheckoutSession(
        input: SynchronizeCheckoutSessionInput
    ): Promise<CheckoutSessionSynchronizationResult> {
        return this.billingRepository.synchronizeCheckoutSession(input);
    }

    async migrateCompanyToExplorer(
        input: MigrateCompanyToExplorerInput
    ): Promise<CompanyMigrationResult> {
        return this.billingRepository.migrateCompanyToExplorer(input);
    }
}
