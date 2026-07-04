import { expect, test, type Page } from "./fixtures";

const jsonHeaders = { "content-type": "application/json" };

const mockCurrentUserPayload = async (
  page: Page,
  mutate: (data: Record<string, unknown>) => Record<string, unknown> | void
) => {
  await page.route("**/api/me", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    const data = payload?.data && typeof payload.data === "object" ? { ...payload.data } : {};
    const nextData = mutate(data) ?? data;

    await route.fulfill({
      status: response.status(),
      headers: jsonHeaders,
      body: JSON.stringify({
        ...payload,
        data: nextData,
      }),
    });
  });
};

test.describe("Dashboard profile happy paths", () => {
  test.beforeEach(async ({ seed, request, page }) => {
    await seed.reset(request);
    await seed.clearToken(page);
  });

  test("platform admin can navigate the core platform management flow", async ({ page, request, seed }) => {
    await seed.loginAs(page, request, "admin");

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible();
    await expect(page.getByText("Señales rápidas de plataforma para admins.")).toBeVisible();

    await page.getByRole("link", { name: "Analítica plataforma" }).click();
    await expect(page).toHaveURL(/\/dashboard\/platform-analytics$/);
    await expect(page.getByRole("heading", { name: "Analítica de plataforma" })).toBeVisible();

    await page.goto("/dashboard/users");
    await expect(page.getByRole("heading", { name: "Usuarios" })).toBeVisible();

    await page.goto("/dashboard/companies");
    await expect(page.getByRole("heading", { name: "Empresas", exact: true })).toBeVisible();

    await page.goto("/dashboard/blog");
    await expect(page.getByRole("heading", { level: 1, name: "Blog" })).toBeVisible();
  });

  test("company admin can complete the standard company operations flow", async ({ page, request, seed }) => {
    await seed.loginAs(page, request, "company_admin");

    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: "Empresa" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Usuarios" })).toBeVisible();

    await page.goto("/dashboard/products");
    await expect(page.getByRole("heading", { name: "Productos", exact: true })).toBeVisible();

    await page.goto("/dashboard/rentals");
    await expect(page.getByRole("heading", { name: "Alquileres", exact: true })).toBeVisible();

    await page.goto("/dashboard/messages");
    await expect(page.getByRole("heading", { name: "Mensajes", exact: true })).toBeVisible();

    await page.goto("/dashboard/companies/company-1/users");
    await expect(page.getByRole("heading", { name: "Usuarios de la empresa" })).toBeVisible();
  });

  test("regular explorer user can manage personal areas but stays out of admin sections", async ({
    page,
    request,
    seed,
  }) => {
    await seed.loginAs(page, request, "user");

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Analítica plataforma" })).toHaveCount(0);

    await page.goto("/dashboard/products");
    await expect(page.getByRole("heading", { name: "Productos", exact: true })).toBeVisible();

    await page.goto("/dashboard/messages");
    await expect(page.getByRole("heading", { name: "Mensajes", exact: true })).toBeVisible();

    await page.goto("/dashboard/config");
    await expect(page.getByRole("heading", { name: "Configuración" })).toBeVisible();

    await page.goto("/dashboard/companies");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("company contributor keeps operational access but not company user management", async ({
    page,
    request,
    seed,
  }) => {
    await seed.loginAs(page, request, "user");

    await mockCurrentUserPayload(page, (data) => {
      data.roles = ["ROLE_ADMIN"];
      data.plan_type = "user_pro";
      data.subscription_status = "active";
      data.entitlements = {
        plan_type: "user_pro",
        subscription_status: "active",
        quotas: {
          active_products: 5,
          team_members: null,
        },
        capabilities: {},
        overrides: {
          is_platform_admin: false,
          is_company_owner: false,
          is_company_admin: false,
          is_founding_account: false,
        },
      };
      data.company_id = "company-1";
      data.company_name = "Herramientas Norte";
      data.company_role = "ROLE_CONTRIBUTOR";
      data.is_company_owner = false;
      data.company_plan_type = "pro";
      data.company_subscription_status = "active";
      data.company_is_founding_account = true;
      data.company_product_slot_limit = 30;
      data.company_context = {
        company_id: "company-1",
        company_name: "Herramientas Norte",
        company_role: "ROLE_CONTRIBUTOR",
        is_company_owner: false,
        plan_type: "pro",
        subscription_status: "active",
        is_founding_account: true,
        product_slot_limit: 30,
        capabilities: {},
        entitlements: {
          plan_type: "pro",
          subscription_status: "active",
          quotas: {
            active_products: 30,
            team_members: 5,
          },
          capabilities: {},
          overrides: {
            is_platform_admin: false,
            is_company_owner: false,
            is_company_admin: false,
            is_founding_account: true,
          },
        },
      };

      return data;
    });

    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: "Empresa" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Usuarios" })).toHaveCount(0);

    await page.goto("/dashboard/products");
    await expect(page.getByRole("heading", { name: "Productos", exact: true })).toBeVisible();

    await page.goto("/dashboard/rentals");
    await expect(page.getByRole("heading", { name: "Alquileres", exact: true })).toBeVisible();

    await page.goto("/dashboard/messages");
    await expect(page.getByRole("heading", { name: "Mensajes", exact: true })).toBeVisible();

    await page.goto("/dashboard/companies/company-1/users");
    await expect(page.getByRole("heading", { name: "Acceso Restringido" })).toBeVisible();
  });
});
