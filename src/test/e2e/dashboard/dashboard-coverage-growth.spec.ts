import { expect, test, type Page } from "./fixtures";
import { selectAvailableRentalDates } from "../dateRangePicker";

const invitationBasePath = "/company-invitation?company_id=company-1&token=seed-token";

const jsonHeaders = { "content-type": "application/json" };

const routePendingInvitationStatus = async (page: Page, email: string) => {
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

test.describe("Dashboard Coverage Growth", () => {
  test.describe.configure({ mode: "parallel" });

  test.beforeEach(async ({ seed, request, page }) => {
    await seed.reset(request);
    await seed.clearToken(page);
  });

  test("company invitation maps API error branches and server field errors", async ({ page }) => {
    await routePendingInvitationStatus(page, "coverage.new@appquilar.test");

    let acceptAttempts = 0;

    await page.route("**/api/companies/company-1/invitations/seed-token/accept", async (route) => {
      acceptAttempts += 1;

      if (acceptAttempts === 1) {
        await route.fulfill({
          status: 409,
          headers: jsonHeaders,
          body: JSON.stringify({
            success: false,
            error: ["company.accept_invitation.user_already_exists"],
          }),
        });
        return;
      }

      await route.fulfill({
        status: 422,
        headers: jsonHeaders,
        body: JSON.stringify({
          success: false,
          errors: {
            first_name: ["Nombre inválido"],
            last_name: ["Apellido inválido"],
            password: ["Password inválida"],
          },
        }),
      });
    });

    await page.goto(`${invitationBasePath}&email=coverage.new@appquilar.test`);
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await page.getByPlaceholder("Tu nombre").fill("Cove");
    await page.getByPlaceholder("Tus apellidos").fill("Rage");
    await page.getByPlaceholder("Mínimo 8 caracteres").fill("E2Epass!123");
    await page.getByRole("button", { name: "Crear cuenta y aceptar invitación" }).click();

    await expect(page.getByRole("button", { name: "Acceder y aceptar invitación" })).toBeVisible({
      timeout: 15000,
    });

    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await page.getByRole("button", { name: "Crear cuenta y aceptar invitación" }).click();

    await expect(page.getByText("Nombre inválido")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Apellido inválido")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Password inválida")).toBeVisible({ timeout: 15000 });
  });

  test("company invitation creates account and falls back to home when login fails", async ({ page }, testInfo) => {
    testInfo.annotations.push({
      type: "skipCoverageExploration",
      description: "Invitation success flow already asserts the final redirected state.",
    });

    await routePendingInvitationStatus(page, "brand.new@appquilar.test");

    await page.route("**/api/companies/company-1/invitations/seed-token/accept", async (route) => {
      await route.fulfill({ status: 204 });
    });

    await page.goto(`${invitationBasePath}&email=brand.new@appquilar.test`);
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await page.getByPlaceholder("Tu nombre").fill("Brand");
    await page.getByPlaceholder("Tus apellidos").fill("New");
    await page.getByPlaceholder("Mínimo 8 caracteres").fill("E2Epass!123");
    await page.getByRole("button", { name: "Crear cuenta y aceptar invitación" }).click();

    await expect(page).toHaveURL(/\/$/);
  });

  test("overview exercises date-range validation, sort and search branches", async ({ page, request, seed }) => {
    await seed.loginAs(page, request, "company_admin");

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible();

    await page.getByRole("button", { name: "Fechas" }).click();

    const rangeInputs = page.getByPlaceholder("dd/mm/aaaa");
    await rangeInputs.first().fill("01/01/2026");
    await rangeInputs.nth(1).fill("15/02/2026");

    await rangeInputs.nth(1).fill("20/01/2026");

    await page.getByRole("button", { name: "Aplicar" }).click();

    await page.getByRole("button", { name: /^Producto/ }).first().click();
    await page.getByRole("button", { name: /^Producto/ }).first().click();
    await page.getByRole("button", { name: /^Visitas/ }).first().click();

    const searchInput = page.getByPlaceholder("Buscar por nombre o ID interno...");
    await searchInput.fill("PRD-001");
    await expect(searchInput).toHaveValue("PRD-001");

    await page.getByRole("button", { name: "Restablecer rango" }).click();
  });

  test("user overview upgrade handles checkout error and success", async ({ page, request, seed }) => {
    await seed.loginAs(page, request, "user");

    let attempts = 0;
    await page.route("**/api/billing/checkout-session", async (route) => {
      attempts += 1;

      if (attempts === 1) {
        await route.fulfill({
          status: 500,
          headers: jsonHeaders,
          body: JSON.stringify({ success: false, error: ["billing.checkout_error"] }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          success: true,
          data: { url: "http://127.0.0.1:4173/dashboard?checkout=ok" },
        }),
      });
    });

    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: "Hazte User Pro" })).toBeVisible();

    await page.getByRole("button", { name: "Hazte User Pro" }).click();
    await page.getByRole("button", { name: "Hazte User Pro" }).click();

    await expect(page).toHaveURL(/\/dashboard\?checkout=ok/);
  });

  test("blog editor create mode validates scheduled date and creates post", async ({ page, request, seed }) => {
    await seed.loginAs(page, request, "admin");

    await page.route("**/api/admin/blog/categories", async (route) => {
      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          success: true,
          data: [
            {
              category_id: "blog-cat-1",
              name: "Noticias",
              slug: "noticias",
            },
          ],
        }),
      });
    });

    await page.route("**/api/admin/blog/posts", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({ status: 204 });
        return;
      }

      await route.continue();
    });

    await page.goto("/dashboard/blog/new");
    await expect(page.getByRole("heading", { name: "Nuevo post" })).toBeVisible();

    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Noticias" }).click();

    await page.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: "Programado" }).click();

    await page.getByLabel("Título").fill("Cobertura blog e2e");
    await page.getByLabel("Extracto").fill("Extracto de cobertura para validar ramas del editor.");
    await page.getByLabel("Keywords SEO (separadas por coma)").fill("cobertura,playwright,blog");

    await page.locator("[contenteditable='true']").first().fill("Contenido de cobertura para blog.");
    await page.getByRole("button", { name: "Crear post" }).click();

    await expect(
      page.getByText("La fecha de programación es obligatoria cuando el estado es programado.")
    ).toBeVisible();

    await page.getByLabel("Programar para (fecha)").fill("2026-04-01");
    await page.getByRole("button", { name: "Crear post" }).click();

    await expect(page).toHaveURL(/\/dashboard\/blog$/);
  });

  test("blog editor edit mode runs publish/draft/schedule and delete actions", async ({
    page,
    request,
    seed,
  }) => {
    await seed.loginAs(page, request, "admin");

    await page.route("**/api/admin/blog/categories", async (route) => {
      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          success: true,
          data: [
            {
              category_id: "blog-cat-1",
              name: "Noticias",
              slug: "noticias",
            },
          ],
        }),
      });
    });

    await page.route("**/api/admin/blog/posts/post-coverage", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          headers: jsonHeaders,
          body: JSON.stringify({
            success: true,
            data: {
              post_id: "post-coverage",
              title: "Post existente",
              slug: "post-existente",
              body: "<p>Contenido actual</p>",
              excerpt: "Extracto actual",
              keywords: ["seed", "coverage"],
              category: { category_id: "blog-cat-1", name: "Noticias", slug: "noticias" },
              header_image_id: null,
              hero_image_id: null,
              status: "draft",
              scheduled_for: null,
              published_at: null,
              created_at: "2026-02-01T12:00:00Z",
              updated_at: "2026-02-01T12:00:00Z",
              google_preview: {
                title: "Post existente",
                slug: "/blog/post-existente",
                description: "Extracto actual",
              },
            },
          }),
        });
        return;
      }

      if (route.request().method() === "PATCH") {
        await route.fulfill({ status: 204 });
        return;
      }

      if (route.request().method() === "DELETE") {
        await route.fulfill({ status: 204 });
        return;
      }

      await route.continue();
    });

    await page.route("**/api/admin/blog/posts/post-coverage/publish", async (route) => {
      await route.fulfill({ status: 204 });
    });

    await page.route("**/api/admin/blog/posts/post-coverage/draft", async (route) => {
      await route.fulfill({ status: 204 });
    });

    await page.route("**/api/admin/blog/posts/post-coverage/schedule", async (route) => {
      await route.fulfill({ status: 204 });
    });

    await page.goto("/dashboard/blog/post-coverage");
    await expect(page.getByRole("heading", { name: "Editar post" })).toBeVisible();

    await page.getByRole("button", { name: "Publicar ahora" }).click();
    await page.getByRole("button", { name: "Pasar a borrador" }).click();

    await page.getByLabel("Programar publicación").fill("2026-04-05");
    await page.getByRole("button", { name: "Programar" }).click();

    await page.getByRole("button", { name: "Eliminar post" }).click();
    await expect(page).toHaveURL(/\/dashboard\/blog$/);
  });

  test("subscription cards cover user portal/checkout and company migration branches", async ({
    page,
    request,
    seed,
  }) => {
    await page.addInitScript(() => {
      window.confirm = () => true;
    });

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

    await page.route("**/api/billing/customer-portal-session", async (route) => {
      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          success: true,
          data: { url: "http://127.0.0.1:4173/dashboard/config?portal=ok" },
        }),
      });
    });

    await page.route("**/api/billing/company/migrate-to-explorer", async (route) => {
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
    await expect(
      page.getByText("Hay un problema con el cobro de la suscripcion", { exact: true })
    ).toBeVisible();

    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "admin.e2e@appquilar.test", exact: true }).click();

    await page.getByRole("button", { name: "Migrar a Explorador" }).click();
    await expect(page).toHaveURL(/\/dashboard\/config$/);
  });

  test("messages dashboard covers status transitions, cancelled state and rich-editor controls", async ({
    page,
    request,
    seed,
  }) => {
    test.info().annotations.push({
      type: "skipCoverageExploration",
      description: "Avoid post-test navigation noise on the messages dashboard coverage path.",
    });

    await seed.loginAs(page, request, "admin");
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/);

    let statusAttempts = 0;
    await page.route("**/api/rents/rent-3/status", async (route) => {
      statusAttempts += 1;
      if (statusAttempts === 1) {
        await route.fulfill({
          status: 500,
          headers: jsonHeaders,
          body: JSON.stringify({ success: false, error: ["rent.status.update_failed"] }),
        });
        return;
      }

      await route.fulfill({ status: 204 });
    });

    await page.goto("/dashboard/messages?rent_id=rent-3");
    await expect(page.getByRole("heading", { name: "Conversacion del alquiler" })).toBeVisible();

    await page.getByRole("button", { name: "Insertar emoji" }).click();
    await page.getByRole("button", { name: "😀" }).click();

    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByText("Enviado").first()).toBeVisible();

    await page.getByRole("link", { name: "Abrir deal room" }).first().click();
    await expect(page.getByRole("heading", { name: "Estado y acciones" })).toBeVisible();

    await page.getByRole("button", { name: "Marcar recogida" }).click();
    await expect(
      page.getByText("No se pudo actualizar el estado del alquiler", { exact: true }).first()
    ).toBeVisible();

    await page.getByRole("button", { name: "Marcar recogida" }).click();
    await expect.poll(() => statusAttempts).toBe(2);

    await page.goto("/dashboard/messages?rent_id=rent-4");
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Cancelados" }).click();
    await page.getByRole("button", { name: /Escalera telescopica/ }).first().click();
    await expect(page.getByText("El alquiler ha sido cancelado.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar" })).toBeDisabled();
  });

  test("category drawer, contact modal and rental details exercise additional branches", async ({
    page,
    request,
    seed,
  }, testInfo) => {
    testInfo.annotations.push({
      type: "skipCoverageExploration",
      description: "This branch test already asserts the terminal states it needs.",
    });

    await page.route("**/api/categories**", async (route) => {
      const response = await route.fetch();
      const payload = await response.json();

      if (Array.isArray(payload?.data) && payload.data.length > 0) {
        payload.data = payload.data.map((category: Record<string, unknown>, index: number) => ({
          ...category,
          icon_name: index === 0 ? "Package" : null,
        }));
      }

      await route.fulfill({
        status: response.status(),
        headers: jsonHeaders,
        body: JSON.stringify(payload),
      });
    });

    await seed.loginAs(page, request, "user");
    await page.goto("/");
    await page.locator("[data-desktop-categories-trigger]").click();
    await expect(page.getByText("Cargando categorías…")).toHaveCount(0, { timeout: 15000 });
    await expect(page.getByPlaceholder("Buscar categoría...")).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: "Expandir" }).first().click();
    await expect(page.getByRole("banner").getByRole("link", { name: "Taladros" })).toBeVisible();

    await page.getByPlaceholder("Buscar categoría...").fill("zzzz-no-match");
    await expect(page.getByText("No hay resultados para")).toBeVisible();

    await page.goto("/product/taladro-percutor-18v");
    await page.getByRole("button", { name: "Solicitar alquiler" }).click();
    await expect(page.getByRole("heading", { name: "Solicitar alquiler" })).toBeVisible();

    await page.getByRole("button", { name: "Calcular precio" }).click();
    await page.getByLabel("Mensaje").fill("corto");
    await page.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(page.getByText("El mensaje debe tener al menos 10 caracteres")).toBeVisible();

    await page.getByRole("button", { name: "Seleccionar fechas de alquiler" }).click();
    await selectAvailableRentalDates(page);
    await expect(page.getByText("La fecha de inicio es obligatoria")).toHaveCount(0);

    await page.getByLabel("Mensaje").fill("Mensaje de cobertura suficientemente largo para crear el lead.");
    await page.getByRole("button", { name: "Enviar mensaje" }).click();
    await page.waitForTimeout(300);

    await seed.loginAs(page, request, "company_admin");
    await page.route("**/api/products/product-1/rental-cost**", async (route) => {
      await route.fulfill({
        status: 500,
        headers: jsonHeaders,
        body: JSON.stringify({ success: false, error: ["product.rental_cost.error"] }),
      });
    });

    await page.goto("/dashboard/rentals/new");
    await expect(
      page.getByText("Selecciona primero un producto publicado para habilitar fechas y cálculo automático del coste.")
    ).toBeVisible();

    const productSearch = page.getByPlaceholder("Buscar por nombre, ID o referencia interna...");
    await productSearch.fill("Taladro");
    await page.getByText("Taladro percutor 18V").first().click();
    await expect(page.getByText("No se pudo calcular el coste del alquiler con esas fechas.")).toBeVisible();
  });
});
