import { useQuery } from "@tanstack/react-query";

import { publicCompanyProfileService } from "@/compositionRoot";

export const PUBLIC_COMPANY_PROFILE_QUERY_KEY = ["publicCompanyProfile"] as const;

export const usePublicCompanyProfile = (slug: string | null | undefined) => {
  return useQuery({
    queryKey: [...PUBLIC_COMPANY_PROFILE_QUERY_KEY, slug],
    queryFn: () => publicCompanyProfileService.getBySlug(slug!),
    enabled: Boolean(slug),
    staleTime: 5 * 60 * 1000,
  });
};
