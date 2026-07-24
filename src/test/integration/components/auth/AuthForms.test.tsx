import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const {
  mockUseAuth,
  mockLogin,
  mockRegister,
  mockRequestPasswordReset,
  mockExecuteCaptcha,
} = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockLogin: vi.fn(),
  mockRegister: vi.fn(),
  mockRequestPasswordReset: vi.fn(),
  mockExecuteCaptcha: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: mockUseAuth,
}));

vi.mock("@/application/hooks/useCaptcha", () => ({
  useRecaptchaToken: () => ({
    execute: mockExecuteCaptcha,
    isLoadingConfig: false,
    isEnabled: false,
  }),
}));

import SignInForm from "@/components/auth/SignInForm";
import SignUpForm from "@/components/auth/SignUpForm";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

describe("auth forms", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockLogin.mockReset();
    mockRegister.mockReset();
    mockRequestPasswordReset.mockReset();
    mockExecuteCaptcha.mockReset();

    mockUseAuth.mockReturnValue({
      login: mockLogin,
      register: mockRegister,
      requestPasswordReset: mockRequestPasswordReset,
    });
    mockLogin.mockResolvedValue(undefined);
    mockRegister.mockResolvedValue(undefined);
    mockRequestPasswordReset.mockResolvedValue(undefined);
    mockExecuteCaptcha.mockResolvedValue("captcha-token");
  });

  it("shows the application validation message for an invalid recovery email", async () => {
    const user = userEvent.setup();

    render(<ForgotPasswordForm onBack={vi.fn()} />);

    await user.type(screen.getByLabelText("Correo electrónico"), "correo-invalido");
    await user.click(screen.getByRole("button", { name: "Enviar enlace de recuperación" }));

    expect(await screen.findByText("Introduce un correo electrónico válido")).toBeInTheDocument();
    expect(mockRequestPasswordReset).not.toHaveBeenCalled();
  });

  it("shows invalid-credentials errors and clears them when recovery starts", async () => {
    mockLogin.mockRejectedValue({
      response: {
        data: {
          error: ["login.invalid"],
        },
      },
    });
    const onForgotPassword = vi.fn();
    const user = userEvent.setup();

    render(<SignInForm infoMessage="Revisa tu correo" onForgotPassword={onForgotPassword} />);

    expect(screen.getByText("Revisa tu correo")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Correo electrónico"), "ana@appquilar.test");
    await user.type(screen.getByLabelText("Contraseña"), "bad-password");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByText("El correo electrónico o la contraseña no son correctos.")).toBeInTheDocument();
    expect(screen.queryByText("Revisa tu correo")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "¿Has olvidado tu contraseña?" }));

    expect(onForgotPassword).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("El correo electrónico o la contraseña no son correctos.")).not.toBeInTheDocument();
  });

  it.each([
    ["error message", { message: "login.invalid" }],
    ["direct error code", { error: ["login.invalid"] }],
    ["nested errors list", { data: { errors: ["login.invalid"] } }],
  ])("detects invalid credentials from %s", async (_label, error) => {
    mockLogin.mockRejectedValue(error);
    const user = userEvent.setup();

    render(<SignInForm />);

    await user.type(screen.getByLabelText("Correo electrónico"), "ana@appquilar.test");
    await user.type(screen.getByLabelText("Contraseña"), "bad-password");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByText("El correo electrónico o la contraseña no son correctos.")).toBeInTheDocument();
  });

  it("shows a generic sign-in error for unknown backend failures", async () => {
    mockLogin.mockRejectedValue({ data: { error: [] } });
    const user = userEvent.setup();

    render(<SignInForm />);

    await user.type(screen.getByLabelText("Correo electrónico"), "ana@appquilar.test");
    await user.type(screen.getByLabelText("Contraseña"), "Password123!");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByText("No se pudo iniciar sesión. Inténtalo de nuevo.")).toBeInTheDocument();
  });

  it("continues after login when the post-login refresh fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const onSuccess = vi.fn().mockRejectedValue(new Error("refresh failed"));
    const user = userEvent.setup();

    render(<SignInForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText("Correo electrónico"), "ana@appquilar.test");
    await user.type(screen.getByLabelText("Contraseña"), "Password123!");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("ana@appquilar.test", "Password123!");
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("No se pudo iniciar sesión. Inténtalo de nuevo.")).not.toBeInTheDocument();
  });

  it("registers with a captcha token and calls the success callback", async () => {
    const onSuccess = vi.fn();
    const user = userEvent.setup();

    render(<SignUpForm onSuccess={onSuccess} />);

    await user.type(screen.getByLabelText("Nombre"), "Ana");
    await user.type(screen.getByLabelText("Apellido"), "Lopez");
    await user.type(screen.getByLabelText("Correo electrónico"), "ana@appquilar.test");
    await user.type(screen.getByLabelText("Contraseña"), "Password123!");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() => {
      expect(mockExecuteCaptcha).toHaveBeenCalledWith("register");
    });
    expect(mockRegister).toHaveBeenCalledWith(
      "Ana",
      "Lopez",
      "ana@appquilar.test",
      "Password123!",
      "captcha-token"
    );
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("maps register field errors onto the matching fields", async () => {
    mockRegister.mockRejectedValue({
      payload: {
        errors: {
          firstName: ["Nombre inválido"],
          lastName: ["Apellido inválido"],
          email: ["Email inválido"],
          password: ["Contraseña inválida"],
        },
      },
    });
    const user = userEvent.setup();

    render(<SignUpForm />);

    await user.type(screen.getByLabelText("Nombre"), "Ana");
    await user.type(screen.getByLabelText("Apellido"), "Lopez");
    await user.type(screen.getByLabelText("Correo electrónico"), "ana@appquilar.test");
    await user.type(screen.getByLabelText("Contraseña"), "Password123!");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByText("Nombre inválido")).toBeInTheDocument();
    expect(screen.getByText("Apellido inválido")).toBeInTheDocument();
    expect(screen.getByText("Email inválido")).toBeInTheDocument();
    expect(screen.getByText("Contraseña inválida")).toBeInTheDocument();
  });

  it("shows captcha and generic register errors as form-level failures", async () => {
    mockRegister
      .mockRejectedValueOnce({
        payload: {
          errors: {
            captchaToken: ["captcha invalid"],
          },
        },
      })
      .mockRejectedValueOnce(new Error("El email ya está registrado"));
    const user = userEvent.setup();

    render(<SignUpForm />);

    await user.type(screen.getByLabelText("Nombre"), "Ana");
    await user.type(screen.getByLabelText("Apellido"), "Lopez");
    await user.type(screen.getByLabelText("Correo electrónico"), "ana@appquilar.test");
    await user.type(screen.getByLabelText("Contraseña"), "Password123!");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByText("No se pudo validar reCAPTCHA. Vuelve a intentarlo.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByText("El email ya está registrado")).toBeInTheDocument();
  });
});
