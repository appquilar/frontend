import { expect, test } from "./fixtures";
import { registerNetworkMocks } from "./networkMocks";

test.beforeEach(async ({ page }) => {
  await registerNetworkMocks(page);
});

test("authentication modal supports login/register and recovery from forgot password", async ({ page }) => {
  await page.goto("/");

  await page.locator("[data-trigger-login]:visible").click();

  const modal = page.getByRole("dialog");

  await expect(modal.getByText("Accede a tu cuenta")).toBeVisible();
  await expect(modal.locator("button[type='submit']").first()).toHaveText("Iniciar sesión");

  await modal.getByRole("button", { name: "Registrarse" }).click();
  await expect(modal.getByRole("button", { name: "Crear cuenta" })).toBeVisible();

  await expect(modal.getByRole("button", { name: "Recuperar" })).toHaveCount(0);

  await modal.getByRole("button", { name: "Iniciar sesión" }).click();
  await modal.getByRole("button", { name: "¿Has olvidado tu contraseña?" }).click();
  await expect(modal.getByRole("button", { name: "Enviar enlace de recuperación" })).toBeVisible();
});

test("login surfaces invalid credentials, forgot-password returns with an info banner and a valid login restores the public session UI", async ({
  page,
}) => {
  let loginAttempts = 0;

  await page.route("**/api/auth/login", async (route) => {
    loginAttempts += 1;

    if (loginAttempts === 1) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          message: "login.invalid",
          error: ["login.invalid"],
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          token:
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEiLCJyb2xlcyI6WyJST0xFX1VTRVIiXSwiZXhwIjo0MTAyNDQ0ODAwfQ.signature",
        },
      }),
    });
  });

  await page.route("**/api/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          id: "user-1",
          email: "victor@appquilar.test",
          first_name: "Victor",
          last_name: "Saavedra",
          roles: ["ROLE_USER"],
        },
      }),
    });
  });

  await page.goto("/");
  await page.locator("[data-trigger-login]:visible").click();

  const modal = page.getByRole("dialog");
  await modal.getByPlaceholder("tu@email.com").first().fill("victor@appquilar.test");
  await modal.getByPlaceholder("••••••••").fill("bad-password");
  await modal.locator("form").getByRole("button", { name: "Iniciar sesión" }).click();

  await expect(
    modal.getByText("El correo electrónico o la contraseña no son correctos.")
  ).toBeVisible();

  await modal.getByRole("button", { name: "¿Has olvidado tu contraseña?" }).click();
  await modal.getByPlaceholder("tu@email.com").first().fill("victor@appquilar.test");
  await modal.getByRole("button", { name: "Enviar enlace de recuperación" }).click();

  await expect(
    modal.getByText(
      "Te hemos enviado un correo con instrucciones para restablecer tu contraseña."
    )
  ).toBeVisible();

  await modal.getByPlaceholder("tu@email.com").first().fill("victor@appquilar.test");
  await modal.getByPlaceholder("••••••••").fill("E2Epass!123");
  await modal.locator("form").getByRole("button", { name: "Iniciar sesión" }).click();

  await expect(modal).toBeHidden();
  await expect(page.getByRole("button", { name: /Hola Victor Saavedra/i })).toBeVisible();

  await page.getByRole("button", { name: /Hola Victor Saavedra/i }).click();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();

  await expect(page.locator("[data-trigger-login]:visible")).toBeVisible();
});

test("register shows server-side validation errors and then returns to login", async ({
  page,
}) => {
  let registerAttempts = 0;

  await page.route("**/api/captcha/config", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          enabled: false,
          site_key: null,
        },
      }),
    });
  });

  await page.route("**/api/auth/register", async (route) => {
    registerAttempts += 1;

    if (registerAttempts === 1) {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Validation failed",
          errors: {
            email: ["Ese correo ya está registrado."],
            password: ["La contraseña debe ser más segura."],
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });

  await page.route("**/api/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          id: "user-2",
          email: "nuevo@appquilar.test",
          first_name: "Nuevo",
          last_name: "Usuario",
          roles: ["ROLE_USER"],
        },
      }),
    });
  });

  await page.goto("/");
  await page.locator("[data-trigger-login]:visible").click();

  const modal = page.getByRole("dialog");
  await modal.getByRole("button", { name: "Registrarse" }).click();
  await modal.getByPlaceholder("Tu nombre").fill("Victor");
  await modal.getByPlaceholder("Tus apellidos").fill("Saavedra");
  await modal.getByPlaceholder("tu@email.com").fill("victor@appquilar.test");
  await modal.getByPlaceholder("••••••••").fill("Password1!");
  await modal.getByRole("button", { name: "Crear cuenta" }).click();

  await expect(modal.getByText("Ese correo ya está registrado.")).toBeVisible();
  await expect(modal.getByText("La contraseña debe ser más segura.")).toBeVisible();

  await modal.getByPlaceholder("tu@email.com").fill("nuevo@appquilar.test");
  await modal.getByPlaceholder("••••••••").fill("AnotherPass1!");
  await modal.getByRole("button", { name: "Crear cuenta" }).click();

  await expect(modal).toBeVisible();
  await expect(
    modal.getByText("Cuenta creada correctamente. Ya puedes iniciar sesión.")
  ).toBeVisible();
  await expect(
    modal.locator("form").getByRole("button", { name: "Iniciar sesión" })
  ).toBeVisible();
});
