import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@/domain/models/UserRole";
import { ApiError } from "@/infrastructure/http/ApiClient";
import { createTestQueryClient } from "@/test/utils/renderWithProviders";

let activeQueryClient = createTestQueryClient();

const {
  mockInvalidateQueries,
  mockFetchQuery,
  mockSetQueryData,
  mockGetQueryData,
  mockCreateCompany,
  mockAuthService,
} = vi.hoisted(() => ({
  mockInvalidateQueries: vi.fn(),
  mockFetchQuery: vi.fn(),
  mockSetQueryData: vi.fn(),
  mockGetQueryData: vi.fn(),
  mockCreateCompany: vi.fn(),
  mockAuthService: {
    getCurrentUser: vi.fn(),
    refreshCurrentUser: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    requestPasswordReset: vi.fn(),
    resetPassword: vi.fn(),
    getCurrentSession: vi.fn(),
    getCurrentSessionSync: vi.fn(),
    changePassword: vi.fn(),
  },
}));

vi.mock("@/composition/auth", () => ({
  authService: mockAuthService,
  companyMembershipService: {
    createCompany: mockCreateCompany,
  },
}));

vi.mock("@/composition/queryClient", () => ({
  queryClient: {
    invalidateQueries: mockInvalidateQueries,
    fetchQuery: mockFetchQuery,
    setQueryData: mockSetQueryData,
    getQueryData: mockGetQueryData,
  },
}));

import { AuthProvider, useAuth } from "@/context/AuthContext";

const AuthBehaviorProbe = () => {
  const auth = useAuth();
  const [lastError, setLastError] = useState("none");

  return (
    <div>
      <div data-testid="email">{auth.currentUser?.email ?? "none"}</div>
      <div data-testid="block">{auth.authBlockMessage ?? "none"}</div>
      <div data-testid="has-admin">{String(auth.hasRole(UserRole.ADMIN))}</div>
      <div data-testid="can-access-admin">
        {String(auth.canAccess([UserRole.ADMIN]))}
      </div>
      <div data-testid="can-access-user">
        {String(auth.canAccess([UserRole.REGULAR_USER]))}
      </div>
      <div data-testid="last-error">{lastError}</div>
      <button
        type="button"
        onClick={() => {
          void auth
            .register(
              "Victor",
              "Saavedra",
              "victor@appquilar.com",
              "Password123!",
              "captcha-token"
            )
            .catch((error: unknown) => {
              setLastError(error instanceof Error ? error.message : String(error));
            });
        }}
      >
        register
      </button>
      <button
        type="button"
        onClick={() => {
          void auth.requestPasswordReset("victor@appquilar.com").catch((error: unknown) => {
            setLastError(error instanceof Error ? error.message : String(error));
          });
        }}
      >
        request-reset
      </button>
      <button
        type="button"
        onClick={() => {
          void auth.resetPassword("reset-token", "new-password").catch((error: unknown) => {
            setLastError(error instanceof Error ? error.message : String(error));
          });
        }}
      >
        reset-password
      </button>
      <button
        type="button"
        onClick={() => {
          void auth.changePassword("old-password", "new-password").catch((error: unknown) => {
            setLastError(error instanceof Error ? error.message : String(error));
          });
        }}
      >
        change-password
      </button>
      <button
        type="button"
        onClick={() => {
          void auth
            .upgradeToCompany({
              name: "  Herramientas Norte  ",
              description: "  Alquiler profesional  ",
              fiscalIdentifier: "  B12345678  ",
              contactEmail: "  team@appquilar.com  ",
              phoneNumber: {
                countryCode: "ES",
                prefix: "+34",
                number: "911222333",
              },
              address: {
                street: "Calle Mayor 1",
                street2: null,
                city: "Madrid",
                postalCode: "28001",
                state: "Madrid",
                country: "España",
              },
              location: {
                latitude: 40.4168,
                longitude: -3.7038,
              },
            })
            .catch((error: unknown) => {
              setLastError(error instanceof Error ? error.message : String(error));
            });
        }}
      >
        upgrade
      </button>
      <button
        type="button"
        onClick={() => {
          void auth.upgradeToCompany("   ").catch((error: unknown) => {
            setLastError(error instanceof Error ? error.message : String(error));
          });
        }}
      >
        upgrade-empty
      </button>
      <button
        type="button"
        onClick={() => {
          void auth.refreshCurrentUser().catch((error: unknown) => {
            setLastError(error instanceof Error ? error.message : String(error));
          });
        }}
      >
        refresh
      </button>
    </div>
  );
};

const renderAuthProvider = () =>
  render(
    <QueryClientProvider client={activeQueryClient}>
      <AuthProvider>
        <AuthBehaviorProbe />
      </AuthProvider>
    </QueryClientProvider>
  );

describe("AuthContext behavior", () => {
  beforeEach(() => {
    activeQueryClient = createTestQueryClient();

    mockInvalidateQueries.mockReset();
    mockFetchQuery.mockReset();
    mockSetQueryData.mockReset();
    mockGetQueryData.mockReset();
    mockCreateCompany.mockReset();

    mockAuthService.getCurrentUser.mockReset();
    mockAuthService.refreshCurrentUser.mockReset();
    mockAuthService.login.mockReset();
    mockAuthService.logout.mockReset();
    mockAuthService.register.mockReset();
    mockAuthService.requestPasswordReset.mockReset();
    mockAuthService.resetPassword.mockReset();
    mockAuthService.getCurrentSession.mockReset();
    mockAuthService.getCurrentSessionSync.mockReset();
    mockAuthService.changePassword.mockReset();

    mockAuthService.getCurrentSessionSync.mockReturnValue({ token: "jwt-token" });
    mockAuthService.getCurrentSession.mockResolvedValue({ token: "jwt-token" });
    mockAuthService.getCurrentUser.mockResolvedValue(null);
    mockAuthService.refreshCurrentUser.mockResolvedValue(null);

    mockInvalidateQueries.mockImplementation((filters) =>
      activeQueryClient.invalidateQueries(filters)
    );
    mockFetchQuery.mockImplementation((options) => activeQueryClient.fetchQuery(options));
    mockSetQueryData.mockImplementation((queryKey, updater) => {
      activeQueryClient.setQueryData(queryKey, updater);
    });
    mockGetQueryData.mockImplementation((queryKey) => activeQueryClient.getQueryData(queryKey));
  });

  it("derives role access from platform-admin entitlement overrides", async () => {
    mockAuthService.getCurrentUser.mockResolvedValueOnce({
      id: "admin-override",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@appquilar.com",
      roles: [UserRole.REGULAR_USER],
      address: null,
      location: null,
      entitlements: {
        plan_type: "user_pro",
        subscription_status: "active",
        quotas: {
          active_products: 5,
          team_members: null,
        },
        capabilities: {},
        overrides: {
          isPlatformAdmin: true,
          isCompanyOwner: false,
          isCompanyAdmin: false,
          isFoundingAccount: false,
        },
      },
    });

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("email")).toHaveTextContent("ada@appquilar.com");
    });

    expect(screen.getByTestId("has-admin")).toHaveTextContent("true");
    expect(screen.getByTestId("can-access-admin")).toHaveTextContent("true");
    expect(screen.getByTestId("can-access-user")).toHaveTextContent("true");
  });

  it("delegates registration and password reset flows to the auth service", async () => {
    const user = userEvent.setup();

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("email")).toHaveTextContent("none");
    });

    await user.click(screen.getByRole("button", { name: "register" }));
    await user.click(screen.getByRole("button", { name: "request-reset" }));
    await user.click(screen.getByRole("button", { name: "reset-password" }));

    await waitFor(() => {
      expect(mockAuthService.register).toHaveBeenCalledWith({
        firstName: "Victor",
        lastName: "Saavedra",
        email: "victor@appquilar.com",
        password: "Password123!",
        captchaToken: "captcha-token",
      });
      expect(mockAuthService.requestPasswordReset).toHaveBeenCalledWith("victor@appquilar.com");
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith({
        token: "reset-token",
        newPassword: "new-password",
      });
    });
  });

  it("does not attempt autologin when registration fails", async () => {
    const user = userEvent.setup();
    mockAuthService.getCurrentSessionSync.mockReturnValue(null);
    mockAuthService.getCurrentSession.mockResolvedValue(null);
    mockAuthService.register.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("email")).toHaveTextContent("none");
    });

    await user.click(screen.getByRole("button", { name: "register" }));

    await waitFor(() => {
      expect(mockAuthService.login).not.toHaveBeenCalled();
      expect(screen.getByTestId("email")).toHaveTextContent("none");
      expect(screen.getByTestId("last-error")).toHaveTextContent("Failed to fetch");
    });
  });

  it("keeps registration and login as separate flows", async () => {
    const user = userEvent.setup();
    mockAuthService.getCurrentSessionSync.mockReturnValue(null);
    mockAuthService.getCurrentSession.mockResolvedValue(null);
    mockAuthService.register.mockResolvedValueOnce(undefined);

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("email")).toHaveTextContent("none");
    });

    await user.click(screen.getByRole("button", { name: "register" }));

    await waitFor(() => {
      expect(mockAuthService.register).toHaveBeenCalledTimes(1);
      expect(mockAuthService.login).not.toHaveBeenCalled();
      expect(screen.getByTestId("email")).toHaveTextContent("none");
      expect(screen.getByTestId("last-error")).toHaveTextContent("none");
    });
  });

  it("forwards the current session token when changing password", async () => {
    const user = userEvent.setup();

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("email")).toHaveTextContent("none");
    });

    await user.click(screen.getByRole("button", { name: "change-password" }));

    await waitFor(() => {
      expect(mockAuthService.changePassword).toHaveBeenCalledWith({
        oldPassword: "old-password",
        newPassword: "new-password",
        token: "jwt-token",
      });
    });
  });

  it("upgrades the current user to a company with trimmed fields and refreshes the session user", async () => {
    const user = userEvent.setup();
    const upgradedUser = {
      id: "user-1",
      firstName: "Victor",
      lastName: "Saavedra",
      email: "owner@appquilar.com",
      roles: [UserRole.REGULAR_USER],
      address: null,
      location: null,
      companyContext: {
        companyId: "company-1",
        companyName: "Herramientas Norte",
        companyRole: "ROLE_ADMIN",
        isCompanyOwner: true,
        planType: "starter",
        subscriptionStatus: "active",
        isFoundingAccount: false,
        productSlotLimit: 30,
        capabilities: {},
        entitlements: {
          plan_type: "starter",
          subscription_status: "active",
          quotas: {
            active_products: 30,
            team_members: 5,
          },
          capabilities: {},
          overrides: {
            isPlatformAdmin: false,
            isCompanyOwner: true,
            isCompanyAdmin: true,
            isFoundingAccount: false,
          },
        },
      },
    };

    mockAuthService.getCurrentUser
      .mockResolvedValueOnce({
        id: "user-1",
        firstName: "Victor",
        lastName: "Saavedra",
        email: "victor@appquilar.com",
        roles: [UserRole.REGULAR_USER],
        address: null,
        location: null,
      })
      .mockResolvedValueOnce(upgradedUser);
    mockAuthService.refreshCurrentUser.mockResolvedValueOnce(upgradedUser);

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("email")).toHaveTextContent("victor@appquilar.com");
    });

    await user.click(screen.getByRole("button", { name: "upgrade" }));

    await waitFor(() => {
      expect(mockCreateCompany).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: "user-1",
          name: "Herramientas Norte",
          description: "Alquiler profesional",
          fiscalIdentifier: "B12345678",
          contactEmail: "team@appquilar.com",
          phoneNumber: {
            countryCode: "ES",
            prefix: "+34",
            number: "911222333",
          },
          companyId: expect.any(String),
        })
      );
      expect(screen.getByTestId("email")).toHaveTextContent("owner@appquilar.com");
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["currentUser"],
    });
  });

  it("clears the current user and exposes the block message when refresh is rejected by an inactive company subscription", async () => {
    const user = userEvent.setup();

    mockAuthService.getCurrentUser.mockResolvedValueOnce({
      id: "user-1",
      firstName: "Victor",
      lastName: "Saavedra",
      email: "victor@appquilar.com",
      roles: [UserRole.REGULAR_USER],
      address: null,
      location: null,
    });
    mockAuthService.refreshCurrentUser.mockRejectedValueOnce(
      new ApiError("blocked", 401, {
        error: ["subscription.company.inactive.contact_account_manager"],
      })
    );

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("email")).toHaveTextContent("victor@appquilar.com");
    });

    await user.click(screen.getByRole("button", { name: "refresh" }));

    await waitFor(() => {
      expect(screen.getByTestId("email")).toHaveTextContent("none");
      expect(screen.getByTestId("block")).toHaveTextContent(
        "Hay un problema con la suscripción de tu empresa. Contacta con el gestor de la cuenta."
      );
    });
  });

  it("rejects company upgrades when there is no authenticated user or the name is blank", async () => {
    const user = userEvent.setup();

    mockAuthService.getCurrentSessionSync.mockReturnValue(null);
    mockAuthService.getCurrentSession.mockResolvedValue(null);

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("email")).toHaveTextContent("none");
    });

    await user.click(screen.getByRole("button", { name: "upgrade" }));

    await waitFor(() => {
      expect(screen.getByTestId("last-error")).toHaveTextContent("Not authenticated");
    });

    mockAuthService.getCurrentSessionSync.mockReturnValue({ token: "jwt-token" });
    mockAuthService.getCurrentSession.mockResolvedValue({ token: "jwt-token" });
    mockAuthService.getCurrentUser.mockResolvedValueOnce({
      id: "user-2",
      firstName: "Victor",
      lastName: "Saavedra",
      email: "victor-2@appquilar.com",
      roles: [UserRole.REGULAR_USER],
      address: null,
      location: null,
    });

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getAllByTestId("email")[1]).toHaveTextContent("victor-2@appquilar.com");
    });

    await user.click(screen.getAllByRole("button", { name: "upgrade-empty" })[1]);

    await waitFor(() => {
      expect(screen.getAllByTestId("last-error")[1]).toHaveTextContent(
        "El nombre de la empresa es obligatorio."
      );
    });
  });
});
