import { expect, test, type Page } from "./fixtures";

const invitationPath = "/company-invitation?company_id=company-1&token=seed-token";
const jsonHeaders = { "content-type": "application/json" };

const routeInvitationStatus = async (page: Page, email: string) => {
  await page.route("**/api/companies/company-1/invitations/seed-token", async (route) => {
    await route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        success: true,
        data: {
          email,
          company_name: "Herramientas Norte",
          role: "ROLE_CONTRIBUTOR",
          status: "PENDING",
          expires_at: null,
        },
      }),
    });
  });
};

const routeInvitationAccept = async (page: Page) => {
  await page.route("**/api/companies/company-1/invitations/seed-token/accept", async (route) => {
    await route.fulfill({ status: 204 });
  });
};

test.describe("Dashboard Coverage Targeted", () => {
  test.describe.configure({ mode: "parallel" });

  test.beforeEach(async ({ seed, request, page }) => {
    await seed.reset(request);
    await seed.clearToken(page);
  });

  test("company invitation renders invalid-link and missing-email branches", async ({ page }) => {
    await page.goto("/company-invitation");
    await expect(page.getByText("Falta `company_id` o `token` en el enlace.")).toBeVisible();

    await routeInvitationStatus(page, "");

    await page.goto(invitationPath);
    await expect(
      page.getByText("Falta el email invitado en el enlace. Solicita una nueva invitación.")
    ).toBeVisible();
  });

  test("company invitation accepts with existing account", async ({ page }) => {
    await routeInvitationStatus(page, "user.e2e@appquilar.test");
    await routeInvitationAccept(page);

    await page.goto(`${invitationPath}&email=user.e2e@appquilar.test`);
    await page.getByPlaceholder("••••••••").fill("E2Epass!123");
    await page.getByRole("button", { name: "Acceder y aceptar invitación" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible();
  });

  test("company invitation accepts as already authenticated user", async ({ page, request, seed }) => {
    await seed.loginAs(page, request, "user");
    await routeInvitationStatus(page, "user.e2e@appquilar.test");
    await routeInvitationAccept(page);

    await page.goto(`${invitationPath}&email=user.e2e@appquilar.test`);
    await page.getByRole("button", { name: "Aceptar invitación" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible();
  });

  test("search page applies radius filter with geolocation success", async ({ page }, testInfo) => {
    testInfo.annotations.push({
      type: "skipCoverageExploration",
      description: "Geolocation filter test already completes on a terminal routed state.",
    });

    await page.addInitScript(() => {
      const mockGeolocation: Geolocation = {
        getCurrentPosition: (success) => {
          success({
            coords: {
              latitude: 40.4168,
              longitude: -3.7038,
              accuracy: 10,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
              toJSON: () => ({}),
            },
            timestamp: Date.now(),
            toJSON: () => ({}),
          } as GeolocationPosition);
        },
        watchPosition: () => 1,
        clearWatch: () => undefined,
      };

      Object.defineProperty(window.navigator, "geolocation", {
        configurable: true,
        value: mockGeolocation,
      });
    });

    await page.goto("/search");
    await page.locator("aside select").selectOption("10");
    await page.getByRole("button", { name: "Aplicar filtros" }).click();

    await expect(page).toHaveURL(/radius=10/);
    await expect(page).toHaveURL(/latitude=/);
    await expect(page).toHaveURL(/longitude=/);
  });

  test("search page shows location error when geolocation fails", async ({ page }, testInfo) => {
    testInfo.annotations.push({
      type: "skipCoverageExploration",
      description: "Geolocation error test ends on an explicit inline error state.",
    });

    await page.addInitScript(() => {
      const mockGeolocation: Geolocation = {
        getCurrentPosition: (_success, error) => {
          error?.({
            code: 1,
            message: "blocked",
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError);
        },
        watchPosition: () => 1,
        clearWatch: () => undefined,
      };

      Object.defineProperty(window.navigator, "geolocation", {
        configurable: true,
        value: mockGeolocation,
      });
    });

    await page.goto("/search");
    await page.locator("aside select").selectOption("10");
    await page.getByRole("button", { name: "Aplicar filtros" }).click();

    await expect(page.getByText("No se pudo obtener tu ubicación.")).toBeVisible();
  });

  test("messages panel supports optimistic send and retry", async ({ page, request, seed }) => {
    await seed.loginAs(page, request, "company_admin");

    let shouldFailNextSend = true;
    await page.route("**/api/rents/rent-1/messages", async (route) => {
      if (route.request().method() === "POST" && shouldFailNextSend) {
        shouldFailNextSend = false;
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ success: false, error: ["rent.message.send_failed"] }),
        });
        return;
      }

      await route.continue();
    });

    await page.goto("/dashboard/messages?rent_id=rent-1");
    await expect(page.getByRole("heading", { name: "Mensajes" })).toBeVisible();
    await expect(page.getByText("Conversacion del alquiler")).toBeVisible();

    const editor = page.getByTestId("rent-message-editor");
    await editor.click();
    await editor.fill("mensaje de cobertura");
    await page.getByRole("button", { name: "Negrita" }).click();
    await page.getByRole("button", { name: "Enviar" }).click();

    await expect(page.getByText("Error al enviar")).toBeVisible();
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByText("Enviado")).toBeVisible();
  });

  test("config page submits profile and address forms", async ({ page, request, seed }) => {
    await seed.loginAs(page, request, "user");

    await page.goto("/dashboard/config");
    await expect(page.getByRole("heading", { name: "Configuración" })).toBeVisible();

    await page.getByPlaceholder("Tu nombre").fill("Uri");
    await page.getByPlaceholder("Tus apellidos").fill("Coverage");
    await page.getByRole("button", { name: "Guardar información" }).click();

    await page.getByRole("tab", { name: "Dirección" }).click();
    await page.getByPlaceholder("Calle y número").fill("Calle Cobertura 1");
    await page.getByPlaceholder("Ciudad").fill("Madrid");
    await page.getByPlaceholder("Provincia o estado").fill("Madrid");
    await page.getByPlaceholder("País").fill("ES");
    await page.getByPlaceholder("Código postal").fill("28001");
    await page.getByRole("button", { name: "Guardar dirección" }).click();

    await expect(page).toHaveURL(/\/dashboard\/config/);
  });
});
