import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { selectAvailableRentalDates } from "./dateRangePicker";
import { registerNetworkMocks } from "./networkMocks";

const authenticatedUserPayload = {
  success: true,
  data: {
    id: "user-1",
    email: "victor@appquilar.test",
    first_name: "Victor",
    last_name: "Saavedra",
    roles: ["ROLE_USER"],
  },
};

const productPayload = {
  success: true,
  data: {
    id: "product-1",
    internal_id: "P-001",
    name: "Taladro profesional",
    slug: "taladro-profesional",
    description: "Taladro para obra y reformas.",
    publication_status: "published",
    is_rental_enabled: true,
    tiers: [
      {
        days_from: 1,
        days_to: 3,
        price_per_day: {
          amount: 2500,
          currency: "EUR",
        },
      },
    ],
    deposit: {
      amount: 15000,
      currency: "EUR",
    },
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
  },
};

const breakdownPayload = {
  success: true,
  data: {
    product_id: "product-1",
    start_date: "2026-04-20",
    end_date: "2026-04-22",
    requested_quantity: 1,
    days: 3,
    price_per_day: {
      amount: 2500,
      currency: "EUR",
    },
    rental_price: {
      amount: 7500,
      currency: "EUR",
    },
    deposit: {
      amount: 15000,
      currency: "EUR",
    },
    total_price: {
      amount: 22500,
      currency: "EUR",
    },
  },
};

const authenticatePublicUser = async (page: Page) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "auth_token",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEiLCJyb2xlcyI6WyJST0xFX1VTRVIiXSwiZXhwIjo0MTAyNDQ0ODAwfQ.signature"
    );
  });

  await page.route("**/api/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(authenticatedUserPayload),
    });
  });
};

test.beforeEach(async ({ page }) => {
  await registerNetworkMocks(page);
  await authenticatePublicUser(page);

  await page.route("**/api/products/taladro-profesional", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(productPayload),
    });
  });
});

test("contact modal blocks submits when availability says the request cannot be created", async ({
  page,
}) => {
  let leadRequests = 0;

  await page.route("**/api/products/product-1/availability?**", async (route) => {
    const quantity = new URL(route.request().url()).searchParams.get("quantity");
    const blocked = quantity === "4";

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          can_request: !blocked,
          status: blocked ? "limited" : "available",
          managed_by_platform: blocked,
          message: blocked
            ? "No hay stock suficiente para 4 unidades en esas fechas."
            : "Disponible para esa cantidad y esas fechas.",
        },
      }),
    });
  });

  await page.route("**/api/rents", async (route) => {
    leadRequests += 1;
    await route.fulfill({ status: 204 });
  });

  await page.goto("/producto/taladro-profesional");
  await page.getByRole("button", { name: "Seleccionar fechas de alquiler" }).click();
  await selectAvailableRentalDates(page);

  await page.locator("#rental-requested-quantity").fill("4");
  await expect(page.getByText("No hay stock suficiente para 4 unidades en esas fechas.")).toBeVisible();

  await page.getByRole("button", { name: "Contactar con el proveedor" }).click();
  const dialog = page.getByRole("dialog");

  await dialog.getByLabel("Mensaje").fill("Necesito confirmar si se puede ampliar el stock.");
  await dialog.locator("form").evaluate((form) => {
    (form as HTMLFormElement).requestSubmit();
  });

  await expect(dialog.locator("p.text-sm.text-destructive").last()).toContainText(
    "No hay stock suficiente para 4 unidades en esas fechas."
  );
  expect(leadRequests).toBe(0);
});

test("contact modal recovers from rental-cost and send failures before succeeding", async ({ page }) => {
  let calculationAttempts = 0;
  let leadAttempts = 0;

  await page.route("**/api/products/product-1/availability?**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          can_request: true,
          status: "available",
          managed_by_platform: true,
          message: "Disponible para esa cantidad y esas fechas.",
        },
      }),
    });
  });

  await page.route("**/api/products/product-1/rental-cost?**", async (route) => {
    calculationAttempts += 1;

    if (calculationAttempts === 1) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error: ["pricing.unavailable"],
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(breakdownPayload),
    });
  });

  await page.route("**/api/rents", async (route) => {
    leadAttempts += 1;

    if (leadAttempts === 1) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error: ["lead.send_failed"],
        }),
      });
      return;
    }

    await route.fulfill({ status: 204 });
  });

  await page.goto("/producto/taladro-profesional");
  await page.getByRole("button", { name: "Seleccionar fechas de alquiler" }).click();
  await selectAvailableRentalDates(page);

  await page.getByRole("button", { name: "Contactar con el proveedor" }).click();
  const dialog = page.getByRole("dialog");

  await dialog.getByRole("button", { name: "Calcular precio" }).click();
  await expect(page.getByText("No se pudo calcular el precio")).toBeVisible();

  await dialog.getByRole("button", { name: "Calcular precio" }).click();
  await expect(dialog.getByText("225.00 EUR")).toBeVisible();

  await dialog.getByLabel("Mensaje").fill("Necesito reservarlo para una obra esta semana.");
  await dialog.locator("form").evaluate((form) => {
    (form as HTMLFormElement).requestSubmit();
  });

  await expect(
    dialog.getByText("No se pudo enviar el mensaje. Revisa las fechas y vuelve a intentarlo.")
  ).toBeVisible();

  await dialog.locator("form").evaluate((form) => {
    (form as HTMLFormElement).requestSubmit();
  });

  await expect(dialog).toBeHidden();
});
