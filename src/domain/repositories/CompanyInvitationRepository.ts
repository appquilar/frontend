import type {
    AcceptCompanyInvitationInput,
    CompanyInvitationStatus,
    GetCompanyInvitationStatusInput,
} from "@/domain/models/CompanyInvitation";

export interface CompanyInvitationRepository {
    getInvitationStatus(input: GetCompanyInvitationStatusInput): Promise<CompanyInvitationStatus>;
    acceptInvitation(input: AcceptCompanyInvitationInput): Promise<void>;
}
