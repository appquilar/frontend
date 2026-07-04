import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/infrastructure/http/ApiClient";
import { createTestQueryClient } from "@/test/utils/renderWithProviders";

let activeQueryClient = createTestQueryClient();

const {
  mockInvalidateQueries,
  mockFetchQuery,
  mockSetQueryData,
  mockClearQueryClient,
  mockCreateCompany,
  mockAuthService,
} = vi.hoisted(() => ({
  mockInvalidateQueries: vi.fn(),
  mockFetchQuery: vi.fn(),
  mockSetQueryData: vi.fn(),
  mockClearQueryClient: vi.fn(),
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
    clear: mockClearQueryClient,
  },
}));

import { AuthProvider, useAuth } from "@/context/AuthContext";

const AuthProbe = () => {
  const auth = useAuth();

  return (
    <div>
      <div data-testid="loading">{String(auth.isLoading)}</div>
      <div data-testid="authenticated">{String(auth.isAuthenticated)}</div>
      <div data-testid="email">{auth.currentUser?.email ?? "none"}</div>
      <div data-testid="block">{auth.authBlockMessage ?? "none"}</div>
      <button onClick={() => auth.login("victor@appquilar.com", "secret")}>login</button>
      <button onClick={() => auth.refreshCurrentUser()}>refresh</button>
      <button onClick={() => auth.logout()}>logout</button>
    </div>
  );
};

const renderAuthProvider = () =>
  render(
    <QueryClientProvider client={activeQueryClient}>
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    </QueryClientProvider>
  );

describe("AuthContext", () => {
  beforeEach(() => {
    activeQueryClient = createTestQueryClient();

    mockInvalidateQueries.mockReset();
    mockFetchQuery.mockReset();
    mockSetQueryData.mockReset();
    mockClearQueryClient.mockReset();
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
    mockAuthService.logout.mockImplementation(async () => {
      mockAuthService.getCurrentSessionSync.mockReturnValue(null);
      mockAuthService.getCurrentSession.mockResolvedValue(null);
      mockAuthService.getCurrentUser.mockResolvedValue(null);
    });

    mockInvalidateQueries.mockImplementation((filters) =>
      activeQueryClient.invalidateQueries(filters)
    );
    mockFetchQuery.mockImplementation((options) =>
      activeQueryClient.fetchQuery(options)
    );
    mockSetQueryData.mockImplementation((queryKey, updater) => {
      activeQueryClient.setQueryData(queryKey, updater);
    });
    mockClearQueryClient.mockImplementation(() => {
      activeQueryClient.clear();
    });
  });

  it("loads current user on mount", async () => {
    mockAuthService.getCurrentUser.mockResolvedValueOnce({
      id: "user-1",
      firstName: "Victor",
      lastName: "Saavedra",
      email: "victor@appquilar.com",
      roles: ["ROLE_USER"],
      address: null,
      location: null,
    });

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
      expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
      expect(screen.getByTestId("email")).toHaveTextContent("victor@appquilar.com");
    });
  });

  it("keeps public children rendered while restoring a persisted session", async () => {
    let resolveCurrentUser: (value: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      roles: string[];
      address: null;
      location: null;
    }) => void = () => undefined;

    mockAuthService.getCurrentUser.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCurrentUser = resolve;
      })
    );

    renderAuthProvider();

    expect(screen.queryByText("Restaurando tu sesion...")).not.toBeInTheDocument();
    expect(screen.getByTestId("email")).toHaveTextContent("none");
    expect(screen.getByTestId("loading")).toHaveTextContent("true");

    resolveCurrentUser({
      id: "user-1",
      firstName: "Victor",
      lastName: "Saavedra",
      email: "victor@appquilar.com",
      roles: ["ROLE_USER"],
      address: null,
      location: null,
    });

    await waitFor(() => {
      expect(screen.getByTestId("email")).toHaveTextContent("victor@appquilar.com");
    });
  });

  it("shows auth block message when backend returns inactive company subscription code", async () => {
    mockAuthService.getCurrentUser.mockRejectedValueOnce(
      new ApiError("blocked", 401, {
        error: ["subscription.company.inactive.contact_account_manager"],
      })
    );

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
      expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
      expect(screen.getByTestId("block")).toHaveTextContent(
        "Hay un problema con la suscripción de tu empresa. Contacta con el gestor de la cuenta."
      );
    });
  });

  it("logs in and out without clearing currentUser observers", async () => {
    const loggedInUser = {
      id: "user-1",
      firstName: "Victor",
      lastName: "Saavedra",
      email: "victor@appquilar.com",
      roles: ["ROLE_USER"],
      address: null,
      location: null,
    };

    mockAuthService.getCurrentUser.mockResolvedValueOnce(null);
    mockAuthService.login.mockResolvedValue(loggedInUser);

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });

    await userEvent.click(screen.getByRole("button", { name: "login" }));

    await waitFor(() => {
      expect(mockAuthService.login).toHaveBeenCalledWith({
        email: "victor@appquilar.com",
        password: "secret",
      });
      expect(mockClearQueryClient).not.toHaveBeenCalled();
      expect(mockSetQueryData).toHaveBeenCalledWith(["currentUser"], loggedInUser);
    });

    await userEvent.click(screen.getByRole("button", { name: "logout" }));

    await waitFor(() => {
      expect(mockAuthService.logout).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
      expect(mockSetQueryData).toHaveBeenCalledWith(["currentUser"], null);
      expect(mockInvalidateQueries).toHaveBeenCalled();
    });
  });

  it("refreshes current user against the backend and updates the auth state", async () => {
    mockAuthService.getCurrentUser.mockResolvedValueOnce({
      id: "user-1",
      firstName: "Victor",
      lastName: "Saavedra",
      email: "victor-old@appquilar.com",
      roles: ["ROLE_USER"],
      address: null,
      location: null,
    });

    mockAuthService.refreshCurrentUser.mockResolvedValueOnce({
      id: "user-1",
      firstName: "Victor",
      lastName: "Saavedra",
      email: "victor-new@appquilar.com",
      roles: ["ROLE_USER"],
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
    });

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("email")).toHaveTextContent("victor-old@appquilar.com");
    });

    await userEvent.click(screen.getByRole("button", { name: "refresh" }));

    await waitFor(() => {
      expect(mockAuthService.refreshCurrentUser).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("email")).toHaveTextContent("victor-new@appquilar.com");
    });
  });
});
