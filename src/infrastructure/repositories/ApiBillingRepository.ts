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
import { ApiClient } from "@/infrastructure/http/ApiClient";
import type { AuthSession } from "@/domain/models/AuthSession";
import { toAuthorizationHeader } from "@/domain/models/AuthSession";

interface ApiResponse<T> {
    success: boolean;
    data: T;
}

interface BillingSessionDto {
    url: string;
}

interface CheckoutSessionRequestDto {
    scope: "user" | "company";
    plan_type: string;
    success_url: string;
    cancel_url: string;
}

interface CompanyUpgradeCheckoutSessionRequestDto {
    name: string;
    description?: string | null;
    fiscal_identifier?: string | null;
    contact_email?: string | null;
    phone_number_country_code?: string;
    phone_number_prefix?: string;
    phone_number_number?: string;
    address?: {
        street: string;
        street2?: string | null;
        city: string;
        postal_code: string;
        state: string;
        country: string;
    } | null;
    location?: {
        latitude: number;
        longitude: number;
    } | null;
    plan_type: string;
    success_url: string;
    cancel_url: string;
}

interface CustomerPortalSessionRequestDto {
    scope: "user" | "company";
    return_url: string;
}

interface MigrateCompanyToExplorerRequestDto {
    target_owner_user_id?: string;
    confirm: boolean;
}

interface MigrateCompanyToExplorerResponseDto {
    migrated_owner_user_id: string;
    company_deleted: boolean;
}

interface SynchronizeCheckoutSessionRequestDto {
    scope: "user" | "company";
    session_id: string;
}

interface SynchronizeCheckoutSessionResponseDto {
    synchronized: boolean;
}

interface ReactivateSubscriptionRequestDto {
    scope: "user" | "company";
}

interface ReactivateSubscriptionResponseDto {
    reactivated: boolean;
}

export class ApiBillingRepository implements BillingRepository {
    private readonly apiClient: ApiClient;
    private readonly getSession: () => AuthSession | null;

    constructor(apiClient: ApiClient, getSession: () => AuthSession | null) {
        this.apiClient = apiClient;
        this.getSession = getSession;
    }

    private async authHeaders(): Promise<Record<string, string>> {
        const session = this.getSession();
        const authHeader = toAuthorizationHeader(session);
        return authHeader ? { Authorization: authHeader } : {};
    }

    async createCheckoutSession(
        input: CreateCheckoutSessionInput
    ): Promise<BillingSessionResult> {
        const headers = await this.authHeaders();

        const payload: CheckoutSessionRequestDto = {
            scope: input.scope,
            plan_type: input.planType,
            success_url: input.successUrl,
            cancel_url: input.cancelUrl,
        };

        const response = await this.apiClient.post<ApiResponse<BillingSessionDto>>(
            "/api/billing/checkout-session",
            payload,
            { headers }
        );

        return {
            url: response.data.url,
        };
    }

    async createCompanyUpgradeCheckoutSession(
        input: CreateCompanyUpgradeCheckoutSessionInput
    ): Promise<BillingSessionResult> {
        const headers = await this.authHeaders();

        const payload: CompanyUpgradeCheckoutSessionRequestDto = {
            name: input.name,
            description: input.description ?? null,
            fiscal_identifier: input.fiscalIdentifier ?? null,
            contact_email: input.contactEmail ?? null,
            plan_type: input.planType,
            success_url: input.successUrl,
            cancel_url: input.cancelUrl,
        };

        if (input.phoneNumber) {
            payload.phone_number_country_code = input.phoneNumber.countryCode;
            payload.phone_number_prefix = input.phoneNumber.prefix;
            payload.phone_number_number = input.phoneNumber.number;
        }

        if (input.address) {
            payload.address = {
                street: input.address.street,
                street2: input.address.street2 ?? null,
                city: input.address.city,
                postal_code: input.address.postalCode,
                state: input.address.state,
                country: input.address.country,
            };
        }

        if (input.location) {
            payload.location = input.location;
        }

        const response = await this.apiClient.post<ApiResponse<BillingSessionDto>>(
            "/api/billing/company-upgrade-checkout-session",
            payload,
            { headers }
        );

        return {
            url: response.data.url,
        };
    }

    async createCustomerPortalSession(
        input: CreateCustomerPortalSessionInput
    ): Promise<BillingSessionResult> {
        const headers = await this.authHeaders();

        const payload: CustomerPortalSessionRequestDto = {
            scope: input.scope,
            return_url: input.returnUrl,
        };

        const response = await this.apiClient.post<ApiResponse<BillingSessionDto>>(
            "/api/billing/customer-portal-session",
            payload,
            { headers }
        );

        return {
            url: response.data.url,
        };
    }

    async reactivateSubscription(
        input: ReactivateSubscriptionInput
    ): Promise<SubscriptionReactivationResult> {
        const headers = await this.authHeaders();

        const payload: ReactivateSubscriptionRequestDto = {
            scope: input.scope,
        };

        const response = await this.apiClient.post<ApiResponse<ReactivateSubscriptionResponseDto>>(
            "/api/billing/subscription/reactivate",
            payload,
            { headers }
        );

        return {
            reactivated: response.data.reactivated,
        };
    }

    async synchronizeCheckoutSession(
        input: SynchronizeCheckoutSessionInput
    ): Promise<CheckoutSessionSynchronizationResult> {
        const headers = await this.authHeaders();

        const payload: SynchronizeCheckoutSessionRequestDto = {
            scope: input.scope,
            session_id: input.sessionId,
        };

        const response = await this.apiClient.post<ApiResponse<SynchronizeCheckoutSessionResponseDto>>(
            "/api/billing/checkout-session/sync",
            payload,
            { headers }
        );

        return {
            synchronized: response.data.synchronized,
        };
    }

    async migrateCompanyToExplorer(
        input: MigrateCompanyToExplorerInput
    ): Promise<CompanyMigrationResult> {
        const headers = await this.authHeaders();

        const payload: MigrateCompanyToExplorerRequestDto = {
            confirm: input.confirm,
        };

        if (input.targetOwnerUserId) {
            payload.target_owner_user_id = input.targetOwnerUserId;
        }

        const response = await this.apiClient.post<ApiResponse<MigrateCompanyToExplorerResponseDto>>(
            "/api/billing/company/migrate-to-explorer",
            payload,
            { headers }
        );

        return {
            migratedOwnerUserId: response.data.migrated_owner_user_id,
            companyDeleted: response.data.company_deleted,
        };
    }
}
