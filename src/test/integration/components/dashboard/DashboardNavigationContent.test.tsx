import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";

import DashboardNavigationContent from "@/components/dashboard/navigation/DashboardNavigationContent";
import { UserRole } from "@/domain/models/UserRole";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

const useAuthMock = vi.fn();

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/components/dashboard/navigation/UserProfile", () => ({
  default: () => <div data-testid="user-profile" />,
}));

vi.mock("@/components/ui/sidebar", async () => {
  const actual = await vi.importActual<typeof import("@/components/ui/sidebar")>(
    "@/components/ui/sidebar"
  );

  return {
    ...actual,
    useSidebar: () => ({
      state: "expanded",
      open: true,
      setOpen: vi.fn(),
      isMobile: false,
      openMobile: false,
      setOpenMobile: vi.fn(),
      toggleSidebar: vi.fn(),
    }),
  };
});

vi.mock("@/application/hooks/useProductOwnerAddress", () => ({
  useProductOwnerAddress: () => ({
    hasRequiredAddress: true,
    isLoading: false,
    ownerType: "user",
    settingsHref: "/dashboard/config",
  }),
}));

vi.mock("@/application/hooks/useProducts", () => ({
  useOwnerProductSummary: () => ({
    data: { total: 0 },
    isLoading: false,
  }),
}));

vi.mock("@/application/hooks/useRentalMessages", () => ({
  useUnreadRentMessagesTotal: () => ({ totalUnread: 0 }),
}));

vi.mock("@/application/hooks/useBilling", () => ({
  useCreateCheckoutSession: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
  useCreateCustomerPortalSession: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
}));

vi.mock("@/hooks/useUserProCheckout", () => ({
  getUserProCheckoutErrorMessage: (_error: unknown, fallback: string) => fallback,
  useUserProCheckout: () => ({
    isLoading: false,
    isCheckoutAvailable: true,
    unavailableMessage: null,
    userProPlan: null,
  }),
}));

vi.mock("@/components/dashboard/hooks/useProfilePicture.ts", () => ({
  useProfilePicture: () => ({ profilePicture: null }),
}));

describe("DashboardNavigationContent", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
  });

  it("shows the User Pro CTA for direct non-Pro users without products", () => {
    useAuthMock.mockReturnValue({
      currentUser: {
        id: "user-1",
        firstName: "Test",
        lastName: "User",
        email: "starter@appquilar.test",
        roles: [UserRole.REGULAR_USER],
        address: null,
        location: null,
        companyId: null,
        companyContext: null,
        planType: "explorer",
        subscriptionStatus: "active",
      },
      hasRole: (role: UserRole) => role === UserRole.REGULAR_USER,
      canAccess: () => true,
    });

    renderWithProviders(<DashboardNavigationContent />, {
      route: "/dashboard",
    });

    expect(
      screen.getByRole("button", { name: /Hazte Pro/i })
    ).toBeInTheDocument();
  });
});
