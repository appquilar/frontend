import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUpdateCompanyProfile } from "@/application/hooks/useCompanyProfile";
import { createTestQueryClient } from "@/test/utils/renderWithProviders";

const { updateCompanyProfileMock } = vi.hoisted(() => ({
  updateCompanyProfileMock: vi.fn(),
}));

vi.mock("@/compositionRoot", () => ({
  companyProfileService: {
    update: updateCompanyProfileMock,
  },
  publicCompanyProfileService: {
    getBySlug: vi.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = createTestQueryClient();
  const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { wrapper, invalidateQueriesSpy };
};

describe("useUpdateCompanyProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateCompanyProfileMock.mockResolvedValue(undefined);
  });

  it("invalidates private, public and current-user profile data after saving company images", async () => {
    const { wrapper, invalidateQueriesSpy } = createWrapper();
    const { result } = renderHook(() => useUpdateCompanyProfile(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        companyId: "company-1",
        name: "Alquileres Norte",
        slug: "alquileres-norte",
        profilePictureId: "00000000-0000-4000-8000-000000000001",
        headerImageId: "00000000-0000-4000-8000-000000000002",
      });
    });

    await waitFor(() => {
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["companyProfile", "company-1"],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["publicCompanyProfile"],
      });
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["currentUser"],
      });
    });
  });
});
