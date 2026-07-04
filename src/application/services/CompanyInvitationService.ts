import type {
    AcceptCompanyInvitationInput,
    CompanyInvitationStatus,
    GetCompanyInvitationStatusInput,
} from "@/domain/models/CompanyInvitation";
import type { CompanyInvitationRepository } from "@/domain/repositories/CompanyInvitationRepository";

export class CompanyInvitationService {
    constructor(
        private readonly repository: CompanyInvitationRepository
    ) {
    }

    async getInvitationStatus(input: GetCompanyInvitationStatusInput): Promise<CompanyInvitationStatus> {
        return this.repository.getInvitationStatus(input);
    }

    async acceptInvitation(input: AcceptCompanyInvitationInput): Promise<void> {
        await this.repository.acceptInvitation(input);
    }
}
