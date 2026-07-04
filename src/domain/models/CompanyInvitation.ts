export interface AcceptCompanyInvitationInput {
    companyId: string;
    token: string;
    email?: string | null;
    password?: string | null;
    firstName?: string | null;
    lastName?: string | null;
}

export interface GetCompanyInvitationStatusInput {
    companyId: string;
    token: string;
}

export type CompanyInvitationStatusValue = "PENDING" | "ACCEPTED" | "SUSPENDED" | "EXPIRED";

export interface CompanyInvitationStatus {
    email: string;
    companyName: string;
    role: string;
    status: CompanyInvitationStatusValue;
    expiresAt: string | null;
}
