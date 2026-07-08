import { expect, test } from "./fixtures";
import { registerNetworkMocks } from "./networkMocks";

test.beforeEach(async ({ page }) => {
  await registerNetworkMocks(page);
});

test("public header dismisses the category panel, sends empty searches to /buscar and opens auth from add product CTA", async ({
  page,
}) => {
  await page.goto("/producto/taladro-profesional");

  const allCategoriesButton = page.getByRole("button", { name: "Todas las categorías" }).first();
  await allCategoriesButton.click();
  await expect(page.getByPlaceholder("Buscar categoría...")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByPlaceholder("Buscar categoría...")).toBeHidden();

  await page.getByPlaceholder("Busca productos para alquilar").press("Enter");
  await expect
    .poll(() => new URL(page.url()).pathname)
    .toBe("/buscar");

  await page.getByRole("button", { name: "Añadir producto" }).click();
  await expect(page.getByRole("dialog").getByText("Accede a tu cuenta")).toBeVisible();
});

test("authenticated mobile header opens the session sheet and logs out cleanly", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

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

  await page.route("**/api/rents/messages/unread-count", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          total_unread: 3,
          by_rent: [{ rent_id: "rent-1", unread_count: 3 }],
        },
      }),
    });
  });

  await page.goto("/");

  await page.locator("header button:visible").nth(1).click();
  await expect(page.getByText("Hola, Victor Saavedra")).toBeVisible();
  await expect(page.getByRole("link", { name: "Mensajes (3 pendientes)" })).toBeVisible();

  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
});
