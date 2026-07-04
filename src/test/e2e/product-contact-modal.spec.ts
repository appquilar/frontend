import { expect, test } from "./fixtures";
import { selectAvailableRentalDates } from "./dateRangePicker";
import { registerNetworkMocks } from "./networkMocks";

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

test("logged-in users can calculate and send a contact request from the product page", async ({ page }) => {
  await registerNetworkMocks(page);

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

  await page.route("**/api/products/taladro-profesional", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
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
      }),
    });
  });

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
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(breakdownPayload),
    });
  });

  await page.route("**/api/rents", async (route) => {
    await route.fulfill({ status: 204 });
  });

  await page.goto("/producto/taladro-profesional");

  await page.getByRole("button", { name: "Seleccionar fechas de alquiler" }).click();
  const { startLabel, endLabel } = await selectAvailableRentalDates(page);

  await expect(page.getByText("Disponible para esa cantidad y esas fechas.")).toBeVisible();
  await page.getByRole("button", { name: "Calcular coste" }).click();

  await expect(page.getByText("225.00 EUR")).toBeVisible();
  await page.getByRole("button", { name: "Solicitar alquiler" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Solicitar alquiler")).toBeVisible();
  await expect(dialog.getByText(startLabel)).toBeVisible();
  await expect(dialog.getByText(endLabel)).toBeVisible();

  await dialog.locator("form").evaluate((form) => {
    (form as HTMLFormElement).requestSubmit();
  });
  await expect(dialog.getByText("El mensaje debe tener al menos 10 caracteres")).toBeVisible();

  await dialog.getByLabel("Mensaje").fill("Necesito reservarlo para una reforma completa.");
  await dialog.locator("form").evaluate((form) => {
    (form as HTMLFormElement).requestSubmit();
  });

  await expect(dialog).toBeHidden();
});
