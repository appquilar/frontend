import { expect, test } from "./fixtures";
import { registerNetworkMocks } from "./networkMocks";

const jsonHeaders = { "content-type": "application/json" };
const nestedCategoriesPayload = {
  data: [
    { id: "cat-1", name: "Herramientas", slug: "herramientas", parent_id: null },
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

test.beforeEach(async ({ page }) => {
  await registerNetworkMocks(page);
});

test("categories page shows the empty state when the public catalog has no categories", async ({
  page,
}) => {
  await page.route("**/api/categories?**", async (route) => {
    await route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        data: [],
        total: 0,
        page: 1,
        per_page: 50,
      }),
    });
  });

  await page.goto("/categorias");

  await expect(page.getByRole("heading", { name: "Todas las categorías" })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText("No hay categorías disponibles.")).toBeVisible();
});

test("category and product public pages fall back cleanly when the backend cannot resolve the resource", async ({
  page,
}) => {
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
  await expect(
    page.getByText("La categoría que buscas no existe o ya no está disponible.")
  ).toBeVisible();

  await page.goto("/producto/error-product");
  await expect(page.getByRole("heading", { name: "Producto no encontrado" })).toBeVisible({
    timeout: 10_000,
  });
  await expect(
    page.getByText("Lo sentimos, el producto que estás buscando no existe o ha sido eliminado.")
  ).toBeVisible();
});

test("public home category drawer shows a no-results hint for unmatched searches", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /La Forma Inteligente de Alquilar/i })).toBeVisible({
    timeout: 10_000,
  });

  await page.getByRole("button", { name: "Todas las categorías" }).first().click();
  await page.getByPlaceholder("Buscar categoría...").fill("zzzzz");
  await expect(page.getByText(/No hay resultados para/)).toBeVisible();
});

test("public search shows the generic empty-state copy when there is no query and no published products", async ({
  page,
}) => {
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

test("search page keeps mobile filters open on location errors and clears category-driven filters when deselecting the root category", async ({
  page,
}) => {
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
              categories: [{ id: "cat-1", name: "Herramientas", slug: "herramientas" }],
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
    "/buscar?categories=cat-1,cat-2,cat-3&property_values[color][]=rojo&property_ranges[potencia][min]=20&property_ranges[potencia][max]=80&radius=abc&latitude=nope&longitude=bad"
  );

  await expect(page.locator("aside select")).toHaveValue("any");
  await expect(page.getByText("Propiedades")).toBeVisible();

  await page.getByRole("button", { name: "Herramientas" }).click();
  await page.getByRole("button", { name: "Aplicar filtros" }).click();

  await expect(page).not.toHaveURL(/categories=/);
  await expect(page).not.toHaveURL(/property_values/);
  await expect(page).not.toHaveURL(/property_ranges/);
  await expect(page.getByText("Propiedades")).toHaveCount(0);

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

test("category page shows no-results copy and location errors when distance filtering fails", async ({
  page,
}) => {
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

  await page.route("**/api/categories/vehiculos", async (route) => {
    await route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        success: true,
        data: {
          id: "cat-1",
          name: "Vehículos",
          slug: "vehiculos",
          description: "Vehículos para obra y transporte.",
          parent_id: null,
        },
      }),
    });
  });

  await page.route("**/api/categories/dynamic-properties?**", async (route) => {
    await route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        success: true,
        data: {
          dynamic_filters_enabled: false,
          disabled_reason: null,
          definitions: [],
        },
      }),
    });
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

  await page.goto("/categoria/vehiculos");

  await expect(page.getByRole("heading", { name: "Vehículos" })).toBeVisible();
  await expect(page.getByText("Ahora mismo no tenemos productos de la categoría Vehículos")).toBeVisible();

  await page.locator("aside select").selectOption("10");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();

  await expect(page.getByText("No se pudo obtener tu ubicación para filtrar por distancia.")).toBeVisible();
});

test("product page exposes draft visibility warnings and unavailable rental messaging", async ({
  page,
}) => {
  await page.route("**/api/products/producto-borrador", async (route) => {
    await route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        success: true,
        data: {
          id: "product-draft",
          internal_id: "DRAFT-001",
          name: "Producto borrador",
          slug: "producto-borrador",
          description: "Producto todavía no publicado.",
          publication_status: "draft",
          is_rental_enabled: false,
          quantity: 0,
          image_ids: [],
          categories: [{ id: "cat-1", name: "Vehículos", slug: "vehiculos" }],
          owner_data: {
            owner_id: "company-1",
            type: "company",
            name: "Alquileres Norte",
            slug: "alquileres-norte",
            address: {
              street: "Calle Mayor 7",
              street2: null,
              city: "Madrid",
              postal_code: "28013",
              state: "Comunidad de Madrid",
              country: "España",
            },
            geo_location: {
              latitude: 40.4168,
              longitude: -3.7038,
              circle: [],
            },
          },
          tiers: [],
          deposit: null,
        },
      }),
    });
  });

  await page.goto("/producto/producto-borrador");

  await expect(page.getByText("Producto no publicado")).toBeVisible();
  await expect(page.getByText(/Borrador/)).toBeVisible();
  await expect(page.getByText("Alquiler no disponible ahora")).toBeVisible();
});

test("authenticated company page hides auth prompts and falls back to the empty catalog copy when location data is unavailable", async ({
  page,
}) => {
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
          description: "<p></p>",
          profile_picture_id: null,
          header_image_id: null,
          location: {
            city: null,
            state: null,
            country: null,
            display_label: null,
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

  await expect(page.getByText("Catálogo público de productos publicados en Appquilar.")).toBeVisible();
  await expect(page.getByText("Esta empresa todavía no tiene productos publicados.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Crear cuenta gratis" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ya tengo cuenta" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Ubicación aproximada" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Ubicación" })).toHaveCount(0);
});
