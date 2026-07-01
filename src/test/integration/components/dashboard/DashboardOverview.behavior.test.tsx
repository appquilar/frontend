import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DashboardOverview from "@/components/dashboard/overview/DashboardOverview";
import { UserRole } from "@/domain/models/UserRole";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

const useAuthMock = vi.fn();
const useCompanyEngagementStatsMock = vi.fn();
const useUserEngagementStatsMock = vi.fn();
const useCreateCheckoutSessionMock = vi.fn();
const useActiveProductsCountMock = vi.fn();
const useUserProCheckoutMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/application/hooks/useCompanyEngagementStats", () => ({
  useCompanyEngagementStats: (...args: unknown[]) => useCompanyEngagementStatsMock(...args),
}));

vi.mock("@/application/hooks/useUserEngagementStats", () => ({
  useUserEngagementStats: (...args: unknown[]) => useUserEngagementStatsMock(...args),
}));

vi.mock("@/application/hooks/useBilling", () => ({
  useCreateCheckoutSession: (...args: unknown[]) => useCreateCheckoutSessionMock(...args),
}));

vi.mock("@/application/hooks/useProducts", () => ({
  useActiveProductsCount: (...args: unknown[]) => useActiveProductsCountMock(...args),
}));

vi.mock("@/hooks/useUserProCheckout", () => ({
  useUserProCheckout: (...args: unknown[]) => useUserProCheckoutMock(...args),
  getUserProCheckoutErrorMessage: (error: unknown, fallback: string) =>
    (error as { payload?: { message?: string } })?.payload?.message ?? fallback,
}));

vi.mock("@/components/dashboard/common/DashboardSectionHeader", () => ({
  default: ({ title, description }: { title: string; description?: string }) => (
    <div>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
  ),
}));

vi.mock("@/components/dashboard/stats/EngagementLineChart", () => ({
  default: ({ label, data }: { label: string; data: Array<unknown> }) => (
    <div data-testid={`engagement-chart-${label}`}>{data.length}</div>
  ),
}));

vi.mock("@/components/dashboard/stats/CompanyAdvancedStatsPremium", () => ({
  CompanyAdvancedStatsPremium: ({ companyId, hasAccess }: { companyId: string; hasAccess: boolean }) => (
    <div data-testid="premium-advanced-stats">
      {companyId}:{String(hasAccess)}
    </div>
  ),
}));

vi.mock("@/components/dashboard/analytics/AdminPlatformAnalyticsHomeSection", () => ({
  default: () => <div data-testid="platform-analytics-home" />,
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

const createExplorerUser = () => ({
  id: "user-1",
  roles: [UserRole.REGULAR_USER],
  planType: "explorer",
  subscriptionStatus: "active",
  productSlotLimit: 2,
  capabilities: {},
  entitlements: {
    planType: "explorer",
    subscriptionStatus: "active",
    quotas: {
      activeProducts: 2,
      teamMembers: null,
    },
    capabilities: {},
    overrides: {
      isPlatformAdmin: false,
      isCompanyOwner: false,
      isCompanyAdmin: false,
      isFoundingAccount: false,
    },
  },
  companyContext: null,
});

const createCompanyAdminUser = (advancedAnalytics = true) => ({
  id: "user-2",
  roles: [UserRole.REGULAR_USER],
  planType: "user_pro",
  subscriptionStatus: "active",
  companyId: "company-1",
  companyContext: {
    companyId: "company-1",
    companyName: "Herramientas Norte",
    companyRole: "ROLE_ADMIN" as const,
    isCompanyOwner: true,
    planType: advancedAnalytics ? ("pro" as const) : ("starter" as const),
    subscriptionStatus: "active" as const,
    isFoundingAccount: false,
    productSlotLimit: advancedAnalytics ? 30 : 10,
    capabilities: {
      advancedAnalytics: { state: advancedAnalytics ? "enabled" : "disabled" },
      apiAccess: { state: advancedAnalytics ? "enabled" : "disabled" },
    },
    entitlements: {
      planType: advancedAnalytics ? ("pro" as const) : ("starter" as const),
      subscriptionStatus: "active" as const,
      quotas: {
        activeProducts: advancedAnalytics ? 30 : 10,
        teamMembers: 5,
      },
      capabilities: {
        advancedAnalytics: { state: advancedAnalytics ? "enabled" : "disabled" },
        apiAccess: { state: advancedAnalytics ? "enabled" : "disabled" },
      },
      overrides: {
        isPlatformAdmin: false,
        isCompanyOwner: true,
        isCompanyAdmin: true,
        isFoundingAccount: false,
      },
    },
  },
});

const createEarlyBirdCompanyAdminUserWithStaleCapabilities = () => ({
  ...createCompanyAdminUser(false),
  companyContext: {
    ...createCompanyAdminUser(false).companyContext,
    planType: "early_bird" as const,
    subscriptionStatus: "active" as const,
    isFoundingAccount: true,
    productSlotLimit: null,
    entitlements: {
      ...createCompanyAdminUser(false).companyContext.entitlements,
      planType: "early_bird" as const,
      subscriptionStatus: "active" as const,
      quotas: {
        activeProducts: null,
        teamMembers: null,
      },
      overrides: {
        isPlatformAdmin: false,
        isCompanyOwner: true,
        isCompanyAdmin: true,
        isFoundingAccount: true,
      },
    },
  },
});

const createCompanyStats = () => ({
  summary: {
    totalViews: 140,
    uniqueVisitors: 90,
    repeatVisitors: 25,
    repeatVisitorRatio: 0.277,
    loggedViews: 55,
    anonymousViews: 85,
    messagesTotal: 17,
    messageThreads: 8,
    messageToRentalRatio: 0.25,
    averageFirstResponseMinutes: 14,
  },
  topLocations: [
    {
      country: "España",
      region: "Madrid",
      city: "Madrid",
      totalViews: 42,
      uniqueVisitors: 25,
    },
    {
      country: "España",
      region: "Cataluña",
      city: "Barcelona",
      totalViews: 16,
      uniqueVisitors: 11,
    },
  ],
  dailyViews: [
    { day: "2026-04-14", views: 18 },
    { day: "2026-04-15", views: 23 },
    { day: "2026-04-16", views: 19 },
  ],
  dailyMessages: [
    { day: "2026-04-14", messages: 2 },
    { day: "2026-04-15", messages: 4 },
    { day: "2026-04-16", messages: 3 },
  ],
  byProduct: [
    {
      productId: "product-9",
      productName: "Zulu 9",
      productSlug: "zulu-9",
      productInternalId: "CP-009",
      totalViews: 9,
      uniqueVisitors: 90,
      loggedViews: 6,
      anonymousViews: 3,
      messagesTotal: 9,
      messageThreads: 4,
      visitToMessageRatio: 0.5,
      messageToRentalRatio: 0.2,
    },
    {
      productId: "product-8",
      productName: "Mike 8",
      productSlug: "mike-8",
      productInternalId: "CP-008",
      totalViews: 8,
      uniqueVisitors: 80,
      loggedViews: 5,
      anonymousViews: 3,
      messagesTotal: 8,
      messageThreads: 3,
      visitToMessageRatio: 0.4,
      messageToRentalRatio: 0.18,
    },
    {
      productId: "product-7",
      productName: "Hotel 7",
      productSlug: "hotel-7",
      productInternalId: "CP-007",
      totalViews: 7,
      uniqueVisitors: 70,
      loggedViews: 4,
      anonymousViews: 3,
      messagesTotal: 7,
      messageThreads: 3,
      visitToMessageRatio: 0.35,
      messageToRentalRatio: 0.16,
    },
    {
      productId: "product-6",
      productName: "Foxtrot 6",
      productSlug: "foxtrot-6",
      productInternalId: "CP-006",
      totalViews: 6,
      uniqueVisitors: 60,
      loggedViews: 4,
      anonymousViews: 2,
      messagesTotal: 6,
      messageThreads: 3,
      visitToMessageRatio: 0.3,
      messageToRentalRatio: 0.14,
    },
    {
      productId: "product-5",
      productName: "Echo 5",
      productSlug: "echo-5",
      productInternalId: "CP-005",
      totalViews: 5,
      uniqueVisitors: 50,
      loggedViews: 3,
      anonymousViews: 2,
      messagesTotal: 5,
      messageThreads: 2,
      visitToMessageRatio: 0.25,
      messageToRentalRatio: 0.12,
    },
    {
      productId: "product-4",
      productName: "Delta 4",
      productSlug: "delta-4",
      productInternalId: "CP-004",
      totalViews: 4,
      uniqueVisitors: 40,
      loggedViews: 2,
      anonymousViews: 2,
      messagesTotal: 4,
      messageThreads: 2,
      visitToMessageRatio: 0.2,
      messageToRentalRatio: 0.1,
    },
    {
      productId: "product-3",
      productName: "Charlie 3",
      productSlug: "charlie-3",
      productInternalId: "CP-003",
      totalViews: 3,
      uniqueVisitors: 30,
      loggedViews: 2,
      anonymousViews: 1,
      messagesTotal: 3,
      messageThreads: 1,
      visitToMessageRatio: 0.15,
      messageToRentalRatio: 0.08,
    },
    {
      productId: "product-2",
      productName: "Bravo 2",
      productSlug: "bravo-2",
      productInternalId: "CP-002",
      totalViews: 2,
      uniqueVisitors: 20,
      loggedViews: 1,
      anonymousViews: 1,
      messagesTotal: 2,
      messageThreads: 1,
      visitToMessageRatio: 0.1,
      messageToRentalRatio: 0.06,
    },
    {
      productId: "product-1",
      productName: "Alpha 1",
      productSlug: "alpha-1",
      productInternalId: "CP-001",
      totalViews: 1,
      uniqueVisitors: 10,
      loggedViews: 1,
      anonymousViews: 0,
      messagesTotal: 1,
      messageThreads: 1,
      visitToMessageRatio: 0.05,
      messageToRentalRatio: 0.04,
    },
  ],
  opportunities: {
    highInterestLowConversion: {
      productName: "Zulu 9",
      uniqueVisitors: 90,
      visitToMessageRatio: 0.5,
    },
  },
});

describe("DashboardOverview behavior", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    useCompanyEngagementStatsMock.mockReset();
    useUserEngagementStatsMock.mockReset();
    useCreateCheckoutSessionMock.mockReset();
    useActiveProductsCountMock.mockReset();
    useUserProCheckoutMock.mockReset();
    toastErrorMock.mockReset();

    useCompanyEngagementStatsMock.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn().mockResolvedValue(undefined),
    });
    useUserEngagementStatsMock.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn().mockResolvedValue(undefined),
    });
    useCreateCheckoutSessionMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    useUserProCheckoutMock.mockReturnValue({
      isLoading: false,
      isCheckoutAvailable: true,
      unavailableMessage: null,
    });
    useActiveProductsCountMock.mockReturnValue({
      data: 0,
      refetch: vi.fn().mockResolvedValue(undefined),
    });
    window.history.replaceState({}, "", "/dashboard");
  });

  it("renders the explorer upgrade preview and redirects to checkout after requesting User Pro", async () => {
    const originalLocation = window.location;
    const assignMock = vi.fn();
    const createCheckoutSession = vi.fn().mockResolvedValue({
      url: "https://billing.appquilar.test/checkout-user-pro",
    });

    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        assign: assignMock,
      },
    });

    useAuthMock.mockReturnValue({
      currentUser: createExplorerUser(),
      isLoading: false,
      hasRole: vi.fn().mockReturnValue(false),
    });
    useActiveProductsCountMock.mockReturnValue({ data: 1 });
    useCreateCheckoutSessionMock.mockReturnValue({
      mutateAsync: createCheckoutSession,
      isPending: false,
    });

    const user = userEvent.setup();
    renderWithProviders(<DashboardOverview />, { route: "/dashboard" });

    expect(screen.getByText("Ventajas de User Pro")).toBeInTheDocument();
    expect(screen.getByText("1 de 2 productos publicados")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hazte User Pro" }));

    await waitFor(() => {
      expect(createCheckoutSession).toHaveBeenCalledTimes(1);
      expect(assignMock).toHaveBeenCalledWith("https://billing.appquilar.test/checkout-user-pro");
    });

    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "user",
        planType: "user_pro",
      })
    );

    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("renders company analytics, supports quick ranges, sorting, pagination and product search", async () => {
    const refetchCompanyStats = vi.fn().mockResolvedValue(undefined);
    const refetchActiveProducts = vi.fn().mockResolvedValue(undefined);

    useAuthMock.mockReturnValue({
      currentUser: createCompanyAdminUser(true),
      isLoading: false,
      hasRole: vi.fn().mockReturnValue(false),
    });
    useCompanyEngagementStatsMock.mockReturnValue({
      data: createCompanyStats(),
      isLoading: false,
      error: null,
      refetch: refetchCompanyStats,
    });
    useActiveProductsCountMock.mockReturnValue({ data: 5, refetch: refetchActiveProducts });

    const user = userEvent.setup();
    renderWithProviders(<DashboardOverview />, { route: "/dashboard" });

    expect(await screen.findByText("5 de 30 productos publicados")).toBeInTheDocument();
    expect(screen.getByText("Madrid, Madrid, España")).toBeInTheDocument();
    expect(screen.getByTestId("premium-advanced-stats")).toHaveTextContent("company-1:true");
    expect(screen.getAllByText(/Zulu 9/).length).toBeGreaterThan(0);
    expect(screen.getByText(/tiene mucho interés/i)).toBeInTheDocument();

    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("link")[0]).toHaveTextContent("Zulu 9");

    await user.click(screen.getByRole("button", { name: "Producto" }));
    expect(within(table).getAllByRole("link")[0]).toHaveTextContent("Alpha 1");

    await user.click(screen.getByRole("button", { name: "7D" }));
    expect(screen.getByText("7 días")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Refrescar datos" }));

    await waitFor(() => {
      expect(refetchCompanyStats).toHaveBeenCalledTimes(1);
      expect(refetchActiveProducts).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument();
    expect(screen.getAllByText("Zulu 9").length).toBeGreaterThan(0);

    const searchInput = screen.getByPlaceholderText("Buscar por nombre o ID interno...");
    await user.clear(searchInput);
    await user.type(searchInput, "CP-009");

    await waitFor(() => {
      expect(screen.queryByText("Página 2 de 2")).not.toBeInTheDocument();
      expect(screen.getAllByText("Zulu 9").length).toBeGreaterThan(0);
      expect(screen.queryByText("Alpha 1")).not.toBeInTheDocument();
    });
  }, 15000);

  it("shows a friendly message instead of triggering checkout when user pro is unavailable", async () => {
    const createCheckoutSession = vi.fn();

    useAuthMock.mockReturnValue({
      currentUser: createExplorerUser(),
      isLoading: false,
      hasRole: vi.fn().mockReturnValue(false),
    });
    useActiveProductsCountMock.mockReturnValue({ data: 1 });
    useCreateCheckoutSessionMock.mockReturnValue({
      mutateAsync: createCheckoutSession,
      isPending: false,
    });
    useUserProCheckoutMock.mockReturnValue({
      isLoading: false,
      isCheckoutAvailable: false,
      unavailableMessage: "User Pro todavia no esta configurado para checkout en Stripe.",
    });

    const user = userEvent.setup();
    renderWithProviders(<DashboardOverview />, { route: "/dashboard" });

    await user.click(screen.getByRole("button", { name: "Hazte User Pro" }));

    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledWith(
      "User Pro todavia no esta configurado para checkout en Stripe."
    );
  });

  it("shows company analytics fallbacks and empty states when advanced features are unavailable", () => {
    useAuthMock.mockReturnValue({
      currentUser: createCompanyAdminUser(false),
      isLoading: false,
      hasRole: vi.fn().mockReturnValue(false),
    });
    useCompanyEngagementStatsMock.mockReturnValue({
      data: {
        summary: {
          totalViews: 0,
          uniqueVisitors: 0,
          repeatVisitors: 0,
          repeatVisitorRatio: 0,
          loggedViews: 0,
          anonymousViews: 0,
          messagesTotal: 0,
          messageThreads: 0,
          messageToRentalRatio: 0,
          averageFirstResponseMinutes: null,
        },
        topLocations: [],
        dailyViews: [],
        dailyMessages: [],
        byProduct: [],
        opportunities: {
          highInterestLowConversion: null,
        },
      },
      isLoading: false,
      error: null,
    });
    useActiveProductsCountMock.mockReturnValue({ data: 0 });

    renderWithProviders(<DashboardOverview />, { route: "/dashboard" });

    expect(screen.getByText("0 de 10 productos publicados")).toBeInTheDocument();
    expect(screen.getAllByText("Sin datos que mostrar")).toHaveLength(2);
    expect(screen.getByText("Sin datos de productos para el período.")).toBeInTheDocument();
    expect(
      screen.getAllByText("Disponible cuando tu plan tenga analítica avanzada habilitada.")
    ).toHaveLength(2);
  });

  it("shows advanced dashboard metrics for active early bird companies with stale capabilities", () => {
    useAuthMock.mockReturnValue({
      currentUser: createEarlyBirdCompanyAdminUserWithStaleCapabilities(),
      isLoading: false,
      hasRole: vi.fn().mockReturnValue(false),
    });
    useCompanyEngagementStatsMock.mockReturnValue({
      data: createCompanyStats(),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    useActiveProductsCountMock.mockReturnValue({ data: 5, refetch: vi.fn() });

    renderWithProviders(<DashboardOverview />, { route: "/dashboard" });

    expect(screen.getByText("Repetición de visitantes")).toBeInTheDocument();
    expect(screen.getByText("1ª respuesta media")).toBeInTheDocument();
    expect(screen.getByText("Top ubicaciones")).toBeInTheDocument();
    expect(screen.getByText("Madrid, Madrid, España")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Visita a mensaje" })).toBeInTheDocument();
    expect(screen.getByTestId("premium-advanced-stats")).toHaveTextContent("company-1:true");
    expect(
      screen.queryByText("Disponible cuando tu plan tenga analítica avanzada habilitada.")
    ).not.toBeInTheDocument();
  });

  it("shows a dashboard error card when the company metrics request fails", () => {
    useAuthMock.mockReturnValue({
      currentUser: createCompanyAdminUser(true),
      isLoading: false,
      hasRole: vi.fn().mockReturnValue(false),
    });
    useCompanyEngagementStatsMock.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error("stats failed"),
    });

    renderWithProviders(<DashboardOverview />, { route: "/dashboard" });

    expect(screen.getByText("Error al cargar métricas.")).toBeInTheDocument();
  });
});
