import { expect, test } from "./fixtures";
import { registerNetworkMocks } from "./networkMocks";

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

test("search page mobile filters apply nested categories and dynamic filters", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.route("**/api/categories**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(nestedCategoriesPayload),
    });
  });

  await page.route("**/api/categories/dynamic-properties?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(dynamicFiltersPayload),
    });
  });

  await page.route("**/api/products/search**", async (route) => {
    const url = new URL(route.request().url());
    const categories = url.searchParams.getAll("categories[]");

    await route.fulfill({
      status: 200,
      contentType: "application/json",
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

  await page.goto("/buscar");

  await page.getByRole("button", { name: "Filtros" }).click();
  await page.getByRole("button", { name: "Herramientas" }).click();
  await page.getByRole("button", { name: "Aplicar filtros" }).click();

  await expect(page).toHaveURL(/categories=cat-1%2Ccat-2%2Ccat-3/);
  await expect(page.getByText("Furgoneta de carga")).toBeVisible();

  await page.getByRole("button", { name: "Filtros" }).click();
  await expect(page.getByRole("heading", { name: "Propiedades" })).toBeVisible();

  const filtersDialog = page.locator("[role='dialog']");
  await filtersDialog.getByRole("checkbox", { name: "Rojo" }).check();
  await filtersDialog.getByPlaceholder("Mín. 10").fill("20");
  await filtersDialog.getByPlaceholder("Máx. 90").fill("80");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();

  await expect(page).toHaveURL(/property_values%5Bcolor%5D%5B%5D=rojo/);
  await expect(page).toHaveURL(/property_ranges%5Bpotencia%5D%5Bmin%5D=20/);
  await expect(page).toHaveURL(/property_ranges%5Bpotencia%5D%5Bmax%5D=80/);
});

test("search page shows no results for a query and clears radius coordinates when the user resets distance", async ({
  page,
}) => {
  await page.route("**/api/products/search**", async (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get("text");

    await route.fulfill({
      status: 200,
      contentType: "application/json",
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
