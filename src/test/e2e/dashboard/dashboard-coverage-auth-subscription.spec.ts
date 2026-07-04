import { expect, test, type Page } from "./fixtures";

const jsonHeaders = { "content-type": "application/json" };
const appBaseUrl = "http://127.0.0.1:4173";

const installPopupHarness = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const state = {
      block: false,
      closed: 0,
      lastHref: "about:blank",
    };

    (window as typeof window & { __e2ePopupState?: typeof state }).__e2ePopupState = state;

    window.open = () => {
      if (state.block) {
        return null;
      }

      return {
        opener: null,
        location: {
          get href() {
            return state.lastHref;
          },
          set href(value: string) {
            state.lastHref = String(value);
          },
        },
        close() {
          state.closed += 1;
        },
      } as unknown as Window;
    };
  });
};

const setPopupBlocked = async (page: Page, blocked: boolean): Promise<void> => {
  await page.evaluate((value) => {
    const popupState = (
      window as typeof window & {
        __e2ePopupState?: { block: boolean };
      }
    ).__e2ePopupState;

    if (popupState) {
      popupState.block = value;
    }
  }, blocked);
};

const getPopupState = async (
  page: Page
): Promise<{ block: boolean; closed: number; lastHref: string }> => {
  return page.evaluate(() => {
    const popupState = (
      window as typeof window & {
        __e2ePopupState?: { block: boolean; closed: number; lastHref: string };
      }
    ).__e2ePopupState;

    return popupState ?? { block: false, closed: 0, lastHref: "" };
  });
};

test.describe("Dashboard Coverage Auth + Subscription Matrix", () => {
  test.describe.configure({ mode: "parallel" });

  test.beforeEach(async ({ seed, request, page }) => {
    await seed.reset(request);
    await seed.clearToken(page);
  });

  test("protected route maps inactive company subscription 401 into block message", async ({
    page,
    request,
    seed,
  }) => {
    await seed.loginAs(page, request, "company_admin");

    await page.route("**/api/me", async (route) => {
      await route.fulfill({
        status: 401,
        headers: jsonHeaders,
        body: JSON.stringify({
          success: false,
          error: ["subscription.company.inactive.contact_account_manager"],
        }),
      });
    });

    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: "Acceso restringido" })).toBeVisible();
    await expect(page.getByText(/problema con la suscripci[oó]n de tu empresa/i)).toBeVisible();

    await page.getByRole("link", { name: "Volver al inicio" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("auth modal covers session notice, login failures, signup server errors and forgot flow", async ({
    page,
  }, testInfo) => {
    testInfo.annotations.push({
      type: "skipCoverageExploration",
      description: "Modal branch test already exercises the terminal states explicitly.",
    });

    const registeredEmail = "new.auth.coverage@appquilar.test";
    let loginAttempts = 0;
    await page.route("**/api/auth/login", async (route) => {
      const body = route.request().postDataJSON() as { email?: string } | null;
      if (body?.email === registeredEmail) {
        await route.fulfill({
          status: 200,
          headers: jsonHeaders,
          body: JSON.stringify({
            success: true,
            data: { token: "registered-auth-token" },
          }),
        });
        return;
      }

      loginAttempts += 1;

      if (loginAttempts === 1) {
        await route.fulfill({
          status: 200,
          headers: jsonHeaders,
          body: JSON.stringify({
            success: true,
            data: {},
          }),
        });
        return;
      }

      await route.fulfill({
        status: 401,
        headers: jsonHeaders,
        body: JSON.stringify({
          success: false,
          error: ["auth.invalid_credentials"],
        }),
      });
    });

    await page.route("**/api/me", async (route) => {
      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          success: true,
          data: {
            id: "new-auth-coverage-user",
            email: registeredEmail,
            first_name: "Auth",
            last_name: "Coverage",
            roles: ["ROLE_USER"],
          },
        }),
      });
    });

    let registerAttempts = 0;
    await page.route("**/api/auth/register", async (route) => {
      registerAttempts += 1;

      if (registerAttempts === 1) {
        await route.fulfill({
          status: 422,
          headers: jsonHeaders,
          body: JSON.stringify({
            success: false,
            errors: {
              firstName: ["Nombre invalido"],
              lastName: ["Apellido invalido"],
              email: ["Email ya registrado"],
              password: ["Password invalida"],
            },
          }),
        });
        return;
      }

      if (registerAttempts === 2) {
        await route.fulfill({
          status: 422,
          headers: jsonHeaders,
          body: JSON.stringify({
            success: false,
            errors: {
              captchaToken: ["captcha.invalid"],
            },
          }),
        });
        return;
      }

      if (registerAttempts === 3) {
        await route.fulfill({
          status: 500,
          headers: jsonHeaders,
          body: JSON.stringify({
            message: "Registro temporalmente deshabilitado",
          }),
        });
        return;
      }

      await route.fulfill({ status: 201 });
    });

    await page.route("**/api/auth/forgot-password", async (route) => {
      await route.fulfill({ status: 200 });
    });

    await page.addInitScript(() => {
      window.sessionStorage.setItem(
        "auth:postChangePasswordMessage",
        "Contrasena actualizada correctamente."
      );
    });

    const modal = page.getByRole("dialog").last();
    await page.goto("/");
    await expect(modal).toBeVisible();

    await expect(modal.getByText(/Contrasena actualizada correctamente/i)).toBeVisible();

    await modal.locator("button[type='submit']").first().click();
    await expect(modal.getByText("El email es obligatorio")).toBeVisible();
    await expect(modal.getByText(/La contrase(?:n|ñ)a es obligatoria/i)).toBeVisible();

    await modal.getByPlaceholder("tu@email.com").fill("user.e2e@appquilar.test");
    await modal.getByPlaceholder("••••••••").fill("E2Epass!123");
    await modal.locator("button[type='submit']").first().click();
    await expect(
      modal.getByText(/No se pudo iniciar sesi[oó]n\. Int[ée]ntalo de nuevo\./i)
    ).toBeVisible();

    await modal.locator("button[type='submit']").first().click();
    await expect(
      modal.getByText(/(correo electr[oó]nico o la contrase(?:n|ñ)a no son correctos|No se pudo iniciar sesi[oó]n\. Int[ée]ntalo de nuevo\.)/i)
    ).toBeVisible();

    await expect(modal.getByRole("button", { name: "Recuperar" })).toHaveCount(0);
    await modal.getByRole("button", { name: "¿Has olvidado tu contraseña?" }).click();
    await modal.getByPlaceholder("tu@email.com").fill("user.e2e@appquilar.test");
    await modal.getByRole("button", { name: /Enviar enlace de recuperaci[oó]n/ }).click();

    await expect(
      modal.getByText(/Te hemos enviado un correo con instrucciones para restablecer tu contrase(?:n|ñ)a/i)
    ).toBeVisible();

    await modal.getByRole("button", { name: "Registrarse" }).click();

    await modal.getByPlaceholder("Tu nombre").fill("Auth");
    await modal.getByPlaceholder("Tus apellidos").fill("Coverage");
    await modal.getByPlaceholder("tu@email.com").fill(registeredEmail);
    await modal.getByPlaceholder("••••••••").fill("E2Epass!123");

    await modal.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(modal.getByText("Nombre invalido")).toBeVisible();
    await expect(modal.getByText("Apellido invalido")).toBeVisible();
    await expect(modal.getByText("Email ya registrado")).toBeVisible();
    await expect(modal.getByText("Password invalida")).toBeVisible();

    await modal.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(modal.getByText(/No se pudo validar reCAPTCHA/i)).toBeVisible();

    await modal.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(modal.getByText("Registro temporalmente deshabilitado")).toBeVisible();

    await modal.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(modal).toBeHidden();
    await expect(page.getByRole("button", { name: /Hola Auth Coverage/i })).toBeVisible();
  });

  test("reset password covers mismatch, backend error and success branches", async ({ page }, testInfo) => {
    testInfo.annotations.push({
      type: "skipCoverageExploration",
      description: "Reset-password flow ends on a simple confirmation screen after explicit assertions.",
    });

    let resetAttempts = 0;

    await page.route("**/api/auth/change-password", async (route) => {
      resetAttempts += 1;

      if (resetAttempts === 1) {
        await route.fulfill({
          status: 500,
          headers: jsonHeaders,
          body: JSON.stringify({
            success: false,
            error: ["auth.reset_failed"],
          }),
        });
        return;
      }

      await route.fulfill({ status: 204 });
    });

    await page.goto("/reset-password?token=seed-reset-token");

    const passwordInputs = page.locator("input[type='password']");

    await passwordInputs.first().fill("E2Epass!123");
    await passwordInputs.nth(1).fill("Distinta!123");
    await page.getByRole("button", { name: "Cambiar contraseña" }).click();
    await expect(page.getByText(/Las contrase(?:n|ñ)as no coinciden/i)).toBeVisible();

    await passwordInputs.nth(1).fill("E2Epass!123");
    await page.getByRole("button", { name: "Cambiar contraseña" }).click();
    await expect(page.getByText(/No se pudo actualizar la contrase(?:n|ñ)a/i)).toBeVisible();

    await page.getByRole("button", { name: "Cambiar contraseña" }).click();
    await expect(page.getByText(/Contrase(?:n|ñ)a actualizada correctamente/i)).toBeVisible();
  });

  test("user subscription checkout matrix covers backend error and success", async ({
    page,
    request,
    seed,
  }) => {
    await seed.loginAs(page, request, "user");

    let checkoutAttempts = 0;
    await page.route("**/api/billing/checkout-session", async (route) => {
      checkoutAttempts += 1;

      if (checkoutAttempts === 1) {
        await route.fulfill({
          status: 500,
          headers: jsonHeaders,
          body: JSON.stringify({
            success: false,
            error: ["billing.checkout.unavailable"],
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          success: true,
          data: {
            url: `${appBaseUrl}/dashboard/config?checkout=user-pro-ok`,
          },
        }),
      });
    });

    await page.goto("/dashboard/config");
    await expect(page.getByRole("heading", { name: /Configuraci[oó]n/ })).toBeVisible();

    await page.getByRole("button", { name: "Hazte User Pro" }).click();
    await expect(page.getByText("billing.checkout.unavailable")).toBeVisible();

    await page.getByRole("button", { name: "Hazte User Pro" }).click();
    await expect(page).toHaveURL(/\/dashboard\/config\?checkout=user-pro-ok/);
  });

  test("user subscription portal matrix covers popup blocked, backend error and success", async ({
    page,
    request,
    seed,
  }) => {
    await seed.loginAs(page, request, "user");

    await page.route("**/api/me", async (route) => {
      const response = await route.fetch();
      const payload = await response.json();

      if (payload?.data) {
        payload.data.subscription_status = "paused";
      }

      await route.fulfill({
        status: response.status(),
        headers: jsonHeaders,
        body: JSON.stringify(payload),
      });
    });

    let portalAttempts = 0;
    await page.route("**/api/billing/customer-portal-session", async (route) => {
      portalAttempts += 1;

      if (portalAttempts === 1) {
        await route.fulfill({
          status: 500,
          headers: jsonHeaders,
          body: JSON.stringify({
            success: false,
            error: ["billing.user_portal.unavailable"],
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          success: true,
          data: {
            url: "https://example.test/user-portal-ok",
          },
        }),
      });
    });

    await page.goto("/dashboard/config");
    await expect(page.getByRole("button", { name: "Gestionar suscripcion" })).toBeVisible();

    await installPopupHarness(page);
    await setPopupBlocked(page, true);

    await page.getByRole("button", { name: "Gestionar suscripcion" }).click();
    await expect(page.getByText(/No se pudo abrir una nueva pestana/i)).toBeVisible();

    await setPopupBlocked(page, false);
    await page.getByRole("button", { name: "Gestionar suscripcion" }).click();
    await expect(page.getByText("billing.user_portal.unavailable")).toBeVisible();

    await expect
      .poll(async () => {
        const failedState = await getPopupState(page);
        return failedState.closed;
      })
      .toBe(1);

    await page.getByRole("button", { name: "Gestionar suscripcion" }).click();
    await expect
      .poll(async () => {
        const successState = await getPopupState(page);
        return successState.lastHref;
      })
      .toBe("https://example.test/user-portal-ok");
  });

  test("company subscription matrix covers portal and migration error branches", async ({
    page,
    request,
    seed,
  }) => {
    await seed.loginAs(page, request, "company_admin");

    await page.route("**/api/me", async (route) => {
      const response = await route.fetch();
      const payload = await response.json();

      if (payload?.data) {
        payload.data.company_subscription_status = "paused";
        payload.data.company_context = {
          ...payload.data.company_context,
          subscription_status: "paused",
        };
      }

      await route.fulfill({
        status: response.status(),
        headers: jsonHeaders,
        body: JSON.stringify(payload),
      });
    });

    await page.route("**/api/companies/company-1/users**", async (route) => {
      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          success: true,
          data: [
            {
              company_id: "company-1",
              user_id: "22222222-2222-4222-8222-222222222222",
              email: "company.admin.e2e@appquilar.test",
              role: "ROLE_ADMIN",
              status: "ACCEPTED",
            },
            {
              company_id: "company-1",
              user_id: "11111111-1111-4111-8111-111111111111",
              email: "admin.e2e@appquilar.test",
              role: "ROLE_ADMIN",
              status: "ACCEPTED",
            },
          ],
        }),
      });
    });

    let companyPortalAttempts = 0;
    await page.route("**/api/billing/customer-portal-session", async (route) => {
      companyPortalAttempts += 1;

      if (companyPortalAttempts === 1) {
        await route.fulfill({
          status: 500,
          headers: jsonHeaders,
          body: JSON.stringify({
            success: false,
            error: ["billing.company_portal.unavailable"],
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          success: true,
          data: {
            url: "https://example.test/company-portal-ok",
          },
        }),
      });
    });

    let migrationAttempts = 0;
    await page.route("**/api/billing/company/migrate-to-explorer", async (route) => {
      migrationAttempts += 1;

      if (migrationAttempts === 1) {
        await route.fulfill({
          status: 500,
          headers: jsonHeaders,
          body: JSON.stringify({
            success: false,
            error: ["billing.company_migrate.failed"],
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          success: true,
          data: {
            migrated_owner_user_id: "11111111-1111-4111-8111-111111111111",
            company_deleted: true,
          },
        }),
      });
    });

    await page.goto("/dashboard/companies/company-1");
    await expect(page.getByText("Suscripcion de empresa", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Migrar a Explorador" })).toBeVisible();

    await installPopupHarness(page);
    await setPopupBlocked(page, true);
    await page.getByRole("button", { name: "Gestionar suscripcion" }).click();
    await expect(page.getByText(/No se pudo abrir una nueva pestana/i)).toBeVisible();

    await setPopupBlocked(page, false);
    await page.getByRole("button", { name: "Gestionar suscripcion" }).click();
    await expect(page.getByText("billing.company_portal.unavailable")).toBeVisible();

    await expect
      .poll(async () => {
        const afterCompanyPortalFail = await getPopupState(page);
        return afterCompanyPortalFail.closed;
      })
      .toBe(1);

    await page.getByRole("button", { name: "Gestionar suscripcion" }).click();
    await expect
      .poll(async () => {
        const afterCompanyPortalSuccess = await getPopupState(page);
        return afterCompanyPortalSuccess.lastHref;
      })
      .toBe("https://example.test/company-portal-ok");

    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "admin.e2e@appquilar.test", exact: true }).click();

    await page.evaluate(() => {
      window.confirm = () => false;
    });
    await page.getByRole("button", { name: "Migrar a Explorador" }).click();
    await expect(page).toHaveURL(/\/dashboard\/companies\/company-1$/);

    await page.evaluate(() => {
      window.confirm = () => true;
    });
    await page.getByRole("button", { name: "Migrar a Explorador" }).click();
    await expect(page.getByText("billing.company_migrate.failed")).toBeVisible();

    await page.getByRole("button", { name: "Migrar a Explorador" }).click();
    await expect(page).toHaveURL(/\/dashboard\/config$/);
  });
});
