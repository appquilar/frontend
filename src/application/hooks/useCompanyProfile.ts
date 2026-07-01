import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { companyProfileService } from "@/compositionRoot";
import type { UpdateCompanyProfileInput } from "@/domain/models/CompanyProfile";
import { PUBLIC_COMPANY_PROFILE_QUERY_KEY } from "@/application/hooks/usePublicCompanyProfile";

const COMPANY_PROFILE_QUERY_KEY = ["companyProfile"] as const;

export const useCompanyProfile = (companyId: string | null | undefined) => {
    return useQuery({
        queryKey: [...COMPANY_PROFILE_QUERY_KEY, companyId],
        queryFn: () => companyProfileService.getById(companyId!),
        enabled: Boolean(companyId),
    });
};

export const useUpdateCompanyProfile = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: UpdateCompanyProfileInput) => companyProfileService.update(input),
        onSuccess: async (_, variables) => {
            await queryClient.invalidateQueries({
                queryKey: [...COMPANY_PROFILE_QUERY_KEY, variables.companyId],
            });
            await queryClient.invalidateQueries({
                queryKey: PUBLIC_COMPANY_PROFILE_QUERY_KEY,
            });
            await queryClient.invalidateQueries({
                queryKey: ["currentUser"],
            });
        },
    });
};
