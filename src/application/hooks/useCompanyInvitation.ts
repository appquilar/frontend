import { useMutation, useQuery } from "@tanstack/react-query";
import { companyInvitationService } from "@/compositionRoot";
import type { AcceptCompanyInvitationInput } from "@/domain/models/CompanyInvitation";

export const useCompanyInvitationStatus = (
    companyId: string,
    token: string,
    enabled = true
) => {
    return useQuery({
        queryKey: ["companyInvitationStatus", companyId, token],
        queryFn: () => companyInvitationService.getInvitationStatus({ companyId, token }),
        enabled: enabled && Boolean(companyId && token),
        retry: false,
        staleTime: 30_000,
    });
};

export const useAcceptCompanyInvitation = () => {
    return useMutation({
        mutationFn: (input: AcceptCompanyInvitationInput) =>
            companyInvitationService.acceptInvitation(input),
    });
};
