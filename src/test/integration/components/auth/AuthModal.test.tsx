import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/components/auth/SignInForm", () => ({
  default: ({
    infoMessage,
    onForgotPassword,
    onSuccess,
  }: {
    infoMessage?: string | null;
    onForgotPassword?: () => void;
    onSuccess?: () => void;
  }) => (
    <div data-testid="signin-form">
      <span>signin:{infoMessage ?? "none"}</span>
      <button type="button" onClick={onForgotPassword}>
        ¿Has olvidado tu contraseña?
      </button>
      <button type="button" onClick={onSuccess}>
        Completar acceso
      </button>
    </div>
  ),
}));

vi.mock("@/components/auth/SignUpForm", () => ({
  default: ({ onSuccess }: { onSuccess?: () => void }) => (
    <div data-testid="signup-form">
      signup
      <button type="button" onClick={onSuccess}>
        Completar registro
      </button>
    </div>
  ),
}));

vi.mock("@/components/auth/ForgotPasswordForm", () => ({
  default: ({ onBack, onSuccess }: { onBack: () => void; onSuccess?: () => void }) => (
    <div data-testid="forgot-form">
      forgot
      <button type="button" onClick={onBack}>
        Volver a iniciar sesión
      </button>
      <button type="button" onClick={onSuccess}>
        Enviar recuperación
      </button>
    </div>
  ),
}));

import AuthModal from "@/components/auth/AuthModal";

const renderAuthModal = (onClose = vi.fn()) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AuthModal isOpen onClose={onClose} />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe("AuthModal", () => {
  it("renders sign in tab by default", () => {
    renderAuthModal();

    expect(screen.getByText("Accede a tu cuenta")).toBeInTheDocument();
    expect(screen.getByTestId("signin-form")).toHaveTextContent("signin:none");
  });

  it("switches between login/register and opens recovery from the forgot password link", async () => {
    renderAuthModal();

    await userEvent.click(screen.getByRole("button", { name: "Registrarse" }));
    expect(screen.getByTestId("signup-form")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    await userEvent.click(
      screen.getByRole("button", { name: "¿Has olvidado tu contraseña?" }),
    );
    expect(screen.getByTestId("forgot-form")).toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: "Recuperar" }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Volver a iniciar sesión" }),
    );
    expect(screen.getByTestId("signin-form")).toBeInTheDocument();
  });

  it("reads info message from session storage when opening, including password-change messages", () => {
    sessionStorage.setItem("auth:postChangePasswordMessage", "Contraseña actualizada");

    renderAuthModal();

    expect(screen.getByTestId("signin-form")).toHaveTextContent(
      "signin:Contraseña actualizada"
    );
    expect(sessionStorage.getItem("auth:postChangePasswordMessage")).toBeNull();
  });

  it("can open directly on the signup tab when requested from session storage", () => {
    sessionStorage.setItem("auth:initialTab", "signup");

    renderAuthModal();

    expect(screen.getByTestId("signup-form")).toBeInTheDocument();
    expect(sessionStorage.getItem("auth:initialTab")).toBeNull();
  });

  it("returns to login after signup and shows the recovery confirmation", async () => {
    const onClose = vi.fn();
    renderAuthModal(onClose);

    await userEvent.click(screen.getByRole("button", { name: "Registrarse" }));
    await userEvent.click(screen.getByRole("button", { name: "Completar registro" }));
    expect(screen.getByTestId("signin-form")).toHaveTextContent(
      "signin:Cuenta creada correctamente. Ya puedes iniciar sesión."
    );
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", { name: "¿Has olvidado tu contraseña?" })
    );
    await userEvent.click(screen.getByRole("button", { name: "Enviar recuperación" }));
    expect(screen.getByTestId("signin-form")).toHaveTextContent(
      "signin:Te hemos enviado un correo con instrucciones para restablecer tu contraseña."
    );
  });

  it("calls onClose when the dialog close button is pressed", async () => {
    const onClose = vi.fn();

    renderAuthModal(onClose);

    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
