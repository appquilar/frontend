import { beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";

import AuthModal from "@/components/auth/AuthModal";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { queryClient } from "@/composition/queryClient";
import { server } from "@/test/mocks/server";

const apiBaseUrl = "http://localhost:8000";

const encodeBase64Url = (value: string): string =>
  btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

const makeJwt = (payload: Record<string, unknown>): string => {
  const header = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = encodeBase64Url(JSON.stringify(payload));
  return `${header}.${body}.signature`;
};

const AuthProbe = () => {
  const auth = useAuth();

  return <div data-testid="auth-email">{auth.currentUser?.email ?? "none"}</div>;
};

const renderSignupModal = (onClose = vi.fn()) => {
  sessionStorage.setItem("auth:initialTab", "signup");

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/producto/taladro-profesional"]}>
        <AuthProvider>
          <AuthModal isOpen onClose={onClose} />
          <AuthProbe />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );

  return { onClose };
};

describe("AuthModal signup recovery", () => {
  beforeEach(() => {
    queryClient.clear();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("creates the user and returns to login without starting a session", async () => {
    let loginAttempts = 0;

    server.use(
      http.get(`${apiBaseUrl}/api/captcha/config`, () =>
        HttpResponse.json({
          success: true,
          data: { enabled: false, site_key: null },
        })
      ),
      http.post(`${apiBaseUrl}/api/auth/register`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;

        expect(body).toMatchObject({
          first_name: "Victor",
          last_name: "Saavedra",
          email: "victor@appquilar.com",
          password: "Password123!",
          captcha_token: "captcha-disabled",
        });

        return new HttpResponse(null, { status: 201 });
      }),
      http.post(`${apiBaseUrl}/api/auth/login`, async () => {
        loginAttempts += 1;
        return HttpResponse.error();
      })
    );

    const user = userEvent.setup();
    const { onClose } = renderSignupModal();

    await user.type(await screen.findByLabelText("Nombre"), "Victor");
    await user.type(screen.getByLabelText("Apellido"), "Saavedra");
    await user.type(screen.getByLabelText("Correo electrónico"), "victor@appquilar.com");
    await user.type(screen.getByLabelText("Contraseña"), "Password123!");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() => {
      expect(screen.getByText("Cuenta creada correctamente. Ya puedes iniciar sesión.")).toBeInTheDocument();
    });

    expect(loginAttempts).toBe(0);
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(screen.getByTestId("auth-email")).toHaveTextContent("none");
    expect(onClose).not.toHaveBeenCalled();
  });
});
