import { ApiClient } from "@/infrastructure/http/ApiClient";
import type {
    AcceptCompanyInvitationInput,
    CompanyInvitationStatus,
    CompanyInvitationStatusValue,
    GetCompanyInvitationStatusInput,
} from "@/domain/models/CompanyInvitation";
import type { CompanyInvitationRepository } from "@/domain/repositories/CompanyInvitationRepository";
import type { AuthSession } from "@/domain/models/AuthSession";
import { toAuthorizationHeader } from "@/domain/models/AuthSession";

interface CompanyInvitationStatusDto {
    email?: string;
    company_name?: string;
    role?: string;
    status?: string;
    expires_at?: string | null;
}

type CompanyInvitationStatusResponseDto =
    | { success?: boolean; data?: CompanyInvitationStatusDto }
    | CompanyInvitationStatusDto;

const normalizeStatus = (status: string | undefined): CompanyInvitationStatusValue => {
    if (status === "ACCEPTED" || status === "SUSPENDED" || status === "EXPIRED") {
        return status;
    }

    return "PENDING";
};

export class ApiCompanyInvitationRepository implements CompanyInvitationRepository {
    constructor(
        private readonly apiClient: ApiClient,
        private readonly getSession: () => AuthSession | null
    ) {
    }

    async getInvitationStatus(input: GetCompanyInvitationStatusInput): Promise<CompanyInvitationStatus> {
        const response = await this.apiClient.get<CompanyInvitationStatusResponseDto>(
            `/api/companies/${encodeURIComponent(input.companyId)}/invitations/${encodeURIComponent(input.token)}`,
            {
                headers: this.authHeaders(),
            }
        );
        const payload: CompanyInvitationStatusDto =
            "data" in response && response.data ? response.data : response as CompanyInvitationStatusDto;

        return {
            email: payload.email ?? "",
            companyName: payload.company_name ?? "",
            role: payload.role ?? "",
            status: normalizeStatus(payload.status),
            expiresAt: payload.expires_at ?? null,
        };
    }

    async acceptInvitation(input: AcceptCompanyInvitationInput): Promise<void> {
        const payload: Record<string, string> = {};

        if (input.email) {
            payload.email = input.email;
        }

        if (input.password) {
            payload.password = input.password;
        }

        if (input.firstName) {
            payload.first_name = input.firstName;
        }

        if (input.lastName) {
            payload.last_name = input.lastName;
        }

        await this.apiClient.post<void>(
            `/api/companies/${encodeURIComponent(input.companyId)}/invitations/${encodeURIComponent(input.token)}/accept`,
            payload,
            {
                headers: this.authHeaders(),
                skipParseJson: true
            }
        );
    }

    private authHeaders(): Record<string, string> {
        const authHeader = toAuthorizationHeader(this.getSession());
        if (!authHeader) {
            return {};
        }

        return {
            Authorization: authHeader,
        };
    }
}
