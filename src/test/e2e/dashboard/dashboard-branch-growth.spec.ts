import { expect, test } from "./fixtures";

const jsonHeaders = { "content-type": "application/json" };
const nestedCategoriesPayload = {
  data: [
    { id: "cat-1", name: "Vehículos", slug: "vehiculos", parent_id: null },
    { id: "cat-2", name: "Accesorios", slug: "accesorios", parent_id: "cat-1" },
    { id: "cat-3", name: "Remolques", slug: "remolques", parent_id: "cat-1" },
  ],
  total: 3,
  page: 1,
  per_page: 50,
};

const dynamicFiltersPayload = {
  success: true,
  data: {
    dynamic_filters_enabled: true,
    disabled_reason: null,
    definitions: [
      {
        code: "color",
        label: "Color",
        type: "select",
        filterable: true,
        options: [
          { value: "rojo", label: "Rojo" },
          { value: "azul", label: "Azul" },
        ],
      },
      {
        code: "potencia",
        label: "Potencia",
        type: "number",
        filterable: true,
        unit: "cv",
      },
    ],
  },
};
const sitePayload = {
  success: true,
  data: {
    site_id: "test-site",
    name: "Appquilar",
    title: "Appquilar",
    url: "http://localhost:4173",
    description: "Marketplace",
    category_ids: ["cat-1", "cat-2", "cat-3"],
    menu_category_ids: ["cat-1", "cat-2", "cat-3"],
    featured_category_ids: ["cat-1", "cat-2", "cat-3"],
  },
};

const emptyCompanyStatsPayload = {
  success: true,
  data: {
    company_id: "company-1",
    period: {
      from: "2026-03-22",
      to: "2026-04-20",
    },
    summary: {
      total_views: 0,
      unique_visitors: 0,
      repeat_visitors: 0,
      repeat_visitor_ratio: 0,
      logged_views: 0,
      anonymous_views: 0,
      messages_total: 0,
      message_threads: 0,
      message_to_rental_ratio: 0,
      average_first_response_minutes: null,
    },
    top_locations: [],
    series: {
      daily_views: [],
      daily_messages: [],
    },
    by_product: [],
    opportunities: {
      high_interest_low_conversion: null,
    },
  },
};

test.describe("Dashboard branch growth", () => {
  test.beforeEach(async ({ seed, request, page }) => {
    await seed.reset(request);
    await seed.clearToken(page);
  });

  test("dashboard suite covers public category and product fallback states", async ({ page }, testInfo) => {
    testInfo.setTimeout(60_000);
    testInfo.annotations.push({
      type: "skipCoverageExploration",
      description: "Branch assertions already exercise the terminal public fallback states explicitly.",
    });

    await page.route("**/api/categories/fantasma", async (route) => {
      await route.fulfill({
        status: 404,
        headers: jsonHeaders,
        body: JSON.stringify({
          success: false,
          error: ["category.not_found"],
        }),
      });
    });

    await page.route("**/api/products/error-product", async (route) => {
      await route.fulfill({
        status: 500,
        headers: jsonHeaders,
        body: JSON.stringify({
          success: false,
          error: ["product.unavailable"],
        }),
      });
    });

    await page.goto("/categoria/fantasma");
    await expect(page.getByRole("heading", { name: "Categoría no encontrada" })).toBeVisible({
      timeout: 10_000,
    });

    await page.goto("/producto/error-product");
    await expect(page.getByRole("heading", { name: "Producto no encontrado" })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("dashboard suite covers the generic public search empty state", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);
    testInfo.annotations.push({
      type: "skipCoverageExploration",
      description: "Search empty-state assertions already end on the covered public UI branch.",
    });

    await page.route("**/api/products/search?**", async (route) => {
      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          success: true,
          data: {
            data: [],
            total: 0,
            page: 1,
            available_dynamic_filters: [],
          },
        }),
      });
    });

    await page.goto("/buscar");
    await expect(page.getByText("Ahora mismo no hay productos publicados.")).toBeVisible();
  });

  test("admin company stats surfaces the empty-data states", async ({
    page,
    request,
    seed,
  }) => {
    await seed.loginAs(page, request, "admin");

    await page.route("**/api/companies/company-1/stats/engagement**", async (route) => {
      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify(emptyCompanyStatsPayload),
      });
    });

    await page.goto("/dashboard/companies/company-1");
    await expect(page.getByText("Mi empresa")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Sin datos que mostrar").first()).toBeVisible();
    await expect(page.getByText("Sin datos de productos para el período.")).toBeVisible();
    await expect(page.getByText("Sin ubicación disponible todavía.")).toBeVisible();
    await expect(page.getByText("Oportunidad detectada")).toHaveCount(0);
    await expect(page.getByText("N/D").first()).toBeVisible();
  });

  test("dashboard suite covers public search no-results and distance reset branches", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);
    testInfo.annotations.push({
      type: "skipCoverageExploration",
      description: "The search no-results and distance-reset states are already asserted directly.",
    });

    await page.route("**/api/products/search**", async (route) => {
      const url = new URL(route.request().url());
      const query = url.searchParams.get("text");

      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          success: true,
          data: {
            data: query === "sin resultados"
              ? []
              : [
                  {
                    id: "product-1",
                    internal_id: "P-001",
                    name: "Taladro profesional",
                    slug: "taladro-profesional",
                    description: "Taladro",
                    publication_status: "published",
                    image_ids: [],
                    categories: [{ id: "cat-1", name: "Vehículos", slug: "vehiculos" }],
                    owner_data: {
                      owner_id: "company-1",
                      type: "company",
                      name: "Alquileres Norte",
                    },
                  },
                ],
            total: query === "sin resultados" ? 0 : 1,
            page: 1,
            available_dynamic_filters: [],
          },
        }),
      });
    });

    await page.goto("/buscar?q=sin%20resultados");
    await expect(page.getByText('No encontramos productos para "sin resultados".')).toBeVisible();

    await page.goto("/buscar?radius=10&latitude=40.4168&longitude=-3.7038");
    await page.locator("aside select").selectOption("any");
    await page.getByRole("button", { name: "Aplicar filtros" }).click();

    await expect(page).not.toHaveURL(/radius=/);
    await expect(page).not.toHaveURL(/latitude=/);
    await expect(page).not.toHaveURL(/longitude=/);
  });

  test("dashboard suite covers category drawer search states and nested category navigation", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);
    testInfo.annotations.push({
      type: "skipCoverageExploration",
      description: "The category drawer is asserted directly across its search and navigation branches.",
    });

    await page.route("**/api/sites/**", async (route) => {
      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify(sitePayload),
      });
    });

    await page.route("**/api/categories**", async (route) => {
      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify(nestedCategoriesPayload),
      });
    });

    await page.goto("/");
    await expect(page.getByRole("heading", { name: /La Forma Inteligente de Alquilar/i })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole("button", { name: "Todas las categorías" }).first().click();
    await expect(page.getByText("Cargando categorías…")).toHaveCount(0);
    await page.getByPlaceholder("Buscar categoría...").fill("zzzzz");
    await expect(page.getByText(/No hay resultados para/)).toBeVisible();

    await page.getByPlaceholder("Buscar categoría...").fill("acces");
    await expect(page.getByText("Resultados")).toBeVisible();
    await page.getByRole("link", { name: "Accesorios" }).first().click();

    await expect.poll(() => new URL(page.url()).pathname).toBe("/categoria/accesorios");
  });

  test("dashboard suite covers search filter cleanup and the mobile location-error branch", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);
    testInfo.annotations.push({
      type: "skipCoverageExploration",
      description: "The search filter cleanup and mobile geolocation error branches are asserted in-place.",
    });

    await page.route("**/api/sites/**", async (route) => {
      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify(sitePayload),
      });
    });

    await page.route("**/api/categories**", async (route) => {
      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify(nestedCategoriesPayload),
      });
    });

    await page.route("**/api/categories/dynamic-properties?**", async (route) => {
      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify(dynamicFiltersPayload),
      });
    });

    await page.route("**/api/products/search**", async (route) => {
      const url = new URL(route.request().url());
      const categories = url.searchParams.getAll("categories[]");

      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          success: true,
          data: {
            data: [
              {
                id: "product-1",
                internal_id: "VH-001",
                name: "Furgoneta de carga",
                slug: "furgoneta-carga",
                description: "Vehículo industrial",
                publication_status: "published",
                image_ids: [],
                categories: [{ id: "cat-1", name: "Vehículos", slug: "vehiculos" }],
                owner_data: {
                  owner_id: "company-1",
                  type: "company",
                  name: "Alquileres Norte",
                },
              },
            ],
            total: 1,
            page: 1,
            available_dynamic_filters: categories.length > 0
              ? [
                  {
                    code: "color",
                    label: "Color",
                    type: "select",
                    options: [
                      { value: "rojo", label: "Rojo", count: 1 },
                      { value: "azul", label: "Azul", count: 1 },
                    ],
                  },
                  {
                    code: "potencia",
                    label: "Potencia",
                    type: "number",
                    range: {
                      min: 10,
                      max: 90,
                    },
                  },
                ]
              : [],
          },
        }),
      });
    });

    await page.goto(
      "/buscar?categories=cat-2&property_values[color][]=rojo&property_ranges[potencia][min]=20&property_ranges[potencia][max]=80&radius=abc&latitude=nope&longitude=bad"
    );

    await expect(page.locator("aside select")).toHaveValue("any");
    await expect(page.getByText("Propiedades")).toBeVisible();

    await page.getByRole("button", { name: "Accesorios" }).first().click();
    await page.getByRole("button", { name: "Aplicar filtros" }).click();

    await expect(page).not.toHaveURL(/categories=/);
    await expect(page).not.toHaveURL(/property_values/);
    await expect(page).not.toHaveURL(/property_ranges/);

    await page.setViewportSize({ width: 390, height: 844 });
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

    await page.goto("/buscar");
    await page.getByRole("button", { name: "Filtros" }).click();
    const filtersDialog = page.locator("[role='dialog']");
    await filtersDialog.locator("select").selectOption("10");
    await page.getByRole("button", { name: "Aplicar filtros" }).click();

    await expect(page.getByRole("heading", { name: "Filtros de búsqueda" })).toBeVisible();
    await expect(filtersDialog.getByText("No se pudo obtener tu ubicación.")).toBeVisible();
  });

  test("dashboard suite covers the public company guest prompt and approximate-location branch", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);
    testInfo.annotations.push({
      type: "skipCoverageExploration",
      description: "The public company guest prompt and approximate map branch are asserted directly.",
    });

    await page.route("**/api/me", async (route) => {
      await route.fulfill({
        status: 401,
        headers: jsonHeaders,
        body: JSON.stringify({
          success: false,
          error: ["auth.unauthorized"],
        }),
      });
    });

    await page.route("**/api/public/companies/alquileres-norte", async (route) => {
      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          success: true,
          data: {
            name: "Alquileres Norte",
            slug: "alquileres-norte",
            description: null,
            profile_picture_id: null,
            header_image_id: null,
            location: {
              city: "Madrid",
              state: "Comunidad de Madrid",
              country: "España",
              display_label: "Madrid, Comunidad de Madrid, España",
            },
            address: null,
            geo_location: null,
          },
        }),
      });
    });

    await page.route("**/api/public/companies/alquileres-norte/products?**", async (route) => {
      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          success: true,
          total: 0,
          page: 1,
          data: [],
        }),
      });
    });

    await page.goto("/empresa/alquileres-norte");
    await expect(page.getByRole("heading", { name: "Ubicación aproximada" })).toBeVisible();
    await expect(
      page.getByText("Crea tu cuenta para ver la ubicación exacta y contactar con este proveedor.")
    ).toBeVisible();
    await expect(page.getByText("Esta empresa todavía no tiene productos publicados.")).toBeVisible();
  });

  test("dashboard suite covers the authenticated public company exact-location and empty-catalog branches", async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(60_000);
    testInfo.annotations.push({
      type: "skipCoverageExploration",
      description: "The authenticated public company exact-location and empty-catalog branches are asserted directly.",
    });

    await page.addInitScript(() => {
      window.localStorage.setItem(
        "auth_token",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEiLCJyb2xlcyI6WyJST0xFX1VTRVIiXSwiZXhwIjo0MTAyNDQ0ODAwfQ.signature"
      );
    });

    await page.route("**/api/me", async (route) => {
      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
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

    await page.route("**/api/public/companies/alquileres-norte", async (route) => {
      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          success: true,
          data: {
            name: "Alquileres Norte",
            slug: "alquileres-norte",
            description: null,
            profile_picture_id: null,
            header_image_id: null,
            location: {
              city: "Madrid",
              state: "Comunidad de Madrid",
              country: "España",
              display_label: "Madrid, Comunidad de Madrid, España",
            },
            address: {
              street: "Calle Mayor 7",
              street2: "2ºB",
              city: "Madrid",
              postal_code: "28013",
              state: "Comunidad de Madrid",
              country: "España",
            },
            geo_location: {
              latitude: 40.4168,
              longitude: -3.7038,
            },
          },
        }),
      });
    });

    await page.route("**/api/public/companies/alquileres-norte/products?**", async (route) => {
      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          success: true,
          total: 0,
          page: 1,
          data: [],
        }),
      });
    });

    await page.goto("/empresa/alquileres-norte");

    await expect(page.getByRole("heading", { name: "Ubicación" })).toBeVisible();
    await expect(page.getByText("Calle Mayor 7 2ºB").first()).toBeVisible();
    await expect(page.getByText("28013").first()).toBeVisible();
    await expect(
      page.getByText("Crea tu cuenta para ver la ubicación exacta y contactar con este proveedor.")
    ).toHaveCount(0);
    await expect(page.getByText("Esta empresa todavía no tiene productos publicados.")).toBeVisible();
  });

  test("dashboard company form surfaces backend save failures", async ({
    page,
    request,
    seed,
  }, testInfo) => {
    testInfo.setTimeout(60_000);
    testInfo.annotations.push({
      type: "skipCoverageExploration",
      description: "The company-form save-error state is asserted directly in the test body.",
    });

    await seed.loginAs(page, request, "company_admin");

    await page.route("**/api/companies/company-1", async (route) => {
      if (route.request().method() !== "PATCH") {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 500,
        headers: jsonHeaders,
        body: JSON.stringify({
          success: false,
          error: ["company.update_failed"],
        }),
      });
    });

    await page.goto("/dashboard/companies/company-1");
    await expect(page.getByText("Mi empresa")).toBeVisible({ timeout: 15_000 });

    await page.getByLabel("Nombre").fill("Herramientas Norte");
    await page.getByLabel("Email de contacto").fill("hola@herramientasnorte.test");
    await page.getByLabel("Ciudad").fill("Barcelona");
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await expect(page.getByText("No se pudo guardar la empresa.")).toBeVisible();
  });

});
