import { test, expect, type Page } from "./fixtures";

const jsonHeaders = { "content-type": "application/json" };

const mockCurrentUserPayload = async (
  page: Page,
  mutate: (data: Record<string, unknown>) => Record<string, unknown> | void
) => {
  await page.route("**/api/me", async (route) => {
    try {
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
    } catch {
      await route.abort().catch(() => undefined);
    }
  });
};

test.describe("Dashboard Core (seeded API)", () => {
  test.beforeEach(async ({ seed, request, page }) => {
    await seed.reset(request);
    await seed.clearToken(page);
  });

  test("redirects unauthenticated users from /dashboard to public home", async ({ page }, testInfo) => {
    testInfo.annotations.push({
      type: "skipCoverageExploration",
      description: "Redirect smoke test does not benefit from post-test page exploration.",
    });

    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("[data-trigger-login]:visible")).toBeVisible();
  });

  test("admin can access overview and admin-only sections", async ({ page, request, seed }) => {
    await seed.loginAs(page, request, "admin");

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Resumen", exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Señales rápidas de plataforma para admins.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Analítica plataforma" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Ver analítica completa/i })).toBeVisible();
    await expect(page.getByText(/Ventajas de User Pro/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Hazte Pro" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Hazte empresa" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Gestionar suscripcion/i })).toHaveCount(0);

    await page.goto("/dashboard/users");
    await expect(page).toHaveURL(/\/dashboard\/users$/);
    await expect(page.getByRole("heading", { name: "Usuarios" })).toBeVisible();

    await page.goto("/dashboard/companies");
    await expect(page).toHaveURL(/\/dashboard\/companies$/);
    await expect(page.getByRole("heading", { name: "Empresas", exact: true })).toBeVisible();

    await page.goto("/dashboard/sites");
    await expect(page).toHaveURL(/\/dashboard\/sites$/);
    await expect(page.getByRole("heading", { name: "Sitio" })).toBeVisible();

    await page.goto("/dashboard/categories");
    await expect(page).toHaveURL(/\/dashboard\/categories$/);
    await expect(page.getByRole("heading", { name: "Categorías" })).toBeVisible();

    await page.goto("/dashboard/blog");
    await expect(page).toHaveURL(/\/dashboard\/blog$/);
    await expect(page.getByRole("heading", { level: 1, name: "Blog" })).toBeVisible();

    await page.goto("/dashboard/platform-analytics");
    await expect(page).toHaveURL(/\/dashboard\/platform-analytics$/);
    await expect(page.getByRole("heading", { name: "Analítica de plataforma" })).toBeVisible();
  });

  test("admin can search users and companies", async ({ page, request, seed }) => {
    await seed.loginAs(page, request, "admin");

    await page.goto("/dashboard/users");
    await page.getByPlaceholder("Nombre o apellidos").fill("Ada");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(
      page.getByRole("cell", { name: "admin.e2e@appquilar.test", exact: true })
    ).toBeVisible();

    await page.goto("/dashboard/companies");
    await page.getByPlaceholder("Buscar por nombre").fill("Herramientas");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page.getByText("Herramientas Norte")).toBeVisible();
  });

  test("company admin is redirected when trying admin-only pages", async ({ page, request, seed }) => {
    await seed.loginAs(page, request, "company_admin");

    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: "Empresa" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Usuarios" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Analítica plataforma" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Categorías" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Blog" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Sitio" })).toHaveCount(0);

    await page.goto("/dashboard/users");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible();

    await page.goto("/dashboard/companies");
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/dashboard/sites");
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/dashboard/categories");
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/dashboard/blog");
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/dashboard/platform-analytics");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("sanitizes contaminated ROLE_ADMIN payload for a user pro account", async ({ page, request, seed }) => {
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
      data.company_id = null;
      data.company_name = null;
      data.company_role = null;
      data.is_company_owner = false;
      data.company_context = null;

      return data;
    });

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible();
    await expect(page.getByText("Señales rápidas de plataforma para admins.")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Analítica plataforma" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Usuarios", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Empresas", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Categorías" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Blog" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Sitio" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Hazte Pro" })).toHaveCount(0);

    await page.goto("/dashboard/users");
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/dashboard/blog");
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/dashboard/platform-analytics");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("sanitizes contaminated ROLE_ADMIN payload for an explorer account", async ({ page, request, seed }) => {
    await seed.loginAs(page, request, "user");

    await mockCurrentUserPayload(page, (data) => {
      data.roles = ["ROLE_ADMIN"];
      data.plan_type = "explorer";
      data.subscription_status = "active";
      data.product_slot_limit = 2;
      data.entitlements = {
        plan_type: "explorer",
        subscription_status: "active",
        quotas: {
          active_products: 2,
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
      data.company_id = null;
      data.company_name = null;
      data.company_role = null;
      data.is_company_owner = false;
      data.company_context = null;

      return data;
    });

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible();
    await expect(page.getByText("Señales rápidas de plataforma para admins.")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Analítica plataforma" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Usuarios", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Empresas", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Categorías" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Blog" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Sitio" })).toHaveCount(0);

    await page.goto("/dashboard/users");
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/dashboard/blog");
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/dashboard/platform-analytics");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("sanitizes contaminated ROLE_ADMIN payload for a company admin", async ({ page, request, seed }) => {
    await seed.loginAs(page, request, "company_admin");

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
          is_company_owner: true,
          is_company_admin: true,
          is_founding_account: false,
        },
      };
      data.company_id = "company-1";
      data.company_name = "Herramientas Norte";
      data.company_role = "ROLE_ADMIN";
      data.is_company_owner = true;
      data.company_plan_type = "pro";
      data.company_subscription_status = "active";
      data.company_is_founding_account = true;
      data.company_product_slot_limit = 30;
      data.company_context = {
        company_id: "company-1",
        company_name: "Herramientas Norte",
        company_role: "ROLE_ADMIN",
        is_company_owner: true,
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
            is_company_owner: true,
            is_company_admin: true,
            is_founding_account: true,
          },
        },
      };

      return data;
    });

    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: "Empresa" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Usuarios" })).toBeVisible();
    await expect(page.getByText("Señales rápidas de plataforma para admins.")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Analítica plataforma" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Categorías" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Blog" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Sitio" })).toHaveCount(0);

    await page.goto("/dashboard/companies");
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/dashboard/sites");
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/dashboard/platform-analytics");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("company contributor never sees or opens company user management", async ({ page, request, seed }) => {
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
    await expect(page.getByRole("link", { name: "Analítica plataforma" })).toHaveCount(0);

    await page.goto("/dashboard/users");
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/dashboard/companies/company-1/users");
    await expect(page.getByRole("heading", { name: "Acceso Restringido" })).toBeVisible();
  });

  test("company admin can use rentals flow and open details", async ({ page, request, seed }) => {
    await seed.loginAs(page, request, "company_admin");

    await page.goto("/dashboard/rentals");
    const detailsButton = page.getByRole("button", { name: "Ver detalles" }).first();
    const canOpenFromList = await detailsButton.isVisible().catch(() => false);

    if (canOpenFromList) {
      await detailsButton.click();
    } else {
      await page.goto("/dashboard/rentals/rent-1");
    }

    await expect(page).toHaveURL(/\/dashboard\/rentals\/rent-/);
    await expect(page.getByRole("heading", { name: "Estado y acciones" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Deal room", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Ir al inbox" }).click();
    await expect(page).toHaveURL(/\/dashboard\/messages\?rent_id=/);
    await expect(page.getByRole("heading", { name: "Mensajes" })).toBeVisible();
  });

  test("deal room keeps a clean mobile layout", async ({ page, request, seed }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seed.loginAs(page, request, "company_admin");

    await page.goto("/dashboard/rentals/rent-1");

    await expect(page.getByRole("heading", { name: "Estado y acciones" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Deal room", { exact: true })).toBeVisible();
    await expect(page.getByText("Resumen del alquiler", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Conversacion" })).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    expect(hasHorizontalOverflow).toBe(false);

    const inboxButton = page.getByRole("button", { name: "Ir al inbox" });
    const boundingBox = await inboxButton.boundingBox();

    expect(boundingBox?.width ?? 0).toBeGreaterThan(220);
  });

  test("company admin can view conversations and open one thread", async ({ page, request, seed }) => {
    await seed.loginAs(page, request, "company_admin");

    await page.goto("/dashboard/messages");
    await expect(page.getByRole("heading", { name: "Mensajes" })).toBeVisible();

    await page.getByRole("button", { name: /Taladro percutor 18V/i }).first().click();
    await expect(page.getByText("Conversacion del alquiler")).toBeVisible();
  });

  test("regular user can access personal configuration but not admin pages", async ({ page, request, seed }) => {
    await seed.loginAs(page, request, "user");

    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: "Usuarios", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Empresas", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Categorías" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Blog" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Sitio" })).toHaveCount(0);

    await page.goto("/dashboard/config");
    await expect(page).toHaveURL(/\/dashboard\/config$/);
    await expect(page.getByRole("heading", { name: "Configuración" })).toBeVisible();

    await page.goto("/dashboard/companies");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible();

    await page.goto("/dashboard/blog");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Resumen" })).toBeVisible();
  });
});
