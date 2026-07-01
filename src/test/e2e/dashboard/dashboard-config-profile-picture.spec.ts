import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const jsonHeaders = { "content-type": "application/json" };
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9l9xQAAAAASUVORK5CYII=",
  "base64"
);

test.describe("Dashboard Config Profile Picture", () => {
  test.beforeEach(async ({ seed, request, page }) => {
    await seed.reset(request);
    await seed.clearToken(page);
  });

  const registerProfileRoutes = async (page: Page, initialId: string | null) => {
    let currentProfilePictureId: string | null = initialId;
    const uploadedImageId = "00000000-0000-4000-8000-000000000123";
    const currentUserPayload = () => ({
      success: true,
      data: {
        id: "user-1",
        email: "user.e2e@appquilar.test",
        first_name: "Uri",
        last_name: "User",
        roles: ["ROLE_USER"],
        address: null,
        location: null,
        profile_picture_id: currentProfilePictureId,
        plan_type: "explorer",
        subscription_status: "active",
      },
    });

    await page.route("**/api/me", async (route) => {
      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify(currentUserPayload()),
      });
    });

    await page.route("**/api/users/*", async (route) => {
      const requestMethod = route.request().method();

      if (requestMethod === "PATCH") {
        const body = route.request().postDataJSON() as { profile_picture_id?: string | null };
        currentProfilePictureId = body.profile_picture_id ?? null;
        await route.fulfill({
          status: 200,
          headers: jsonHeaders,
          body: JSON.stringify({ success: true, data: null }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify(currentUserPayload()),
      });
    });

    await page.route("**/api/media/images/upload", async (route) => {
      await route.fulfill({
        status: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          success: true,
          data: {
            image_id: uploadedImageId,
          },
        }),
      });
    });

    await page.route("**/api/media/images/*/MEDIUM", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "image/png",
        body: tinyPng,
      });
    });

    await page.route("**/api/media/images/*", async (route) => {
      if (route.request().method() === "DELETE") {
        await route.fulfill({
          status: 200,
          headers: jsonHeaders,
          body: JSON.stringify({ success: true }),
        });
        return;
      }

      await route.continue();
    });

    return {
      getCurrentProfilePictureId: () => currentProfilePictureId,
    };
  };

  const openConfigPage = async (page: Page) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/);
    await expect(page.getByText("Restaurando tu sesion...")).toHaveCount(0, { timeout: 15000 });

    await page.goto("/dashboard/config");
    await expect(page.getByRole("heading", { name: "Configuración" })).toBeVisible();
  };

  test("user removes an existing profile picture", async ({ page, request, seed }) => {
    await seed.loginAs(page, request, "user");
    await registerProfileRoutes(page, "00000000-0000-4000-8000-000000000999");

    await openConfigPage(page);
    await expect(page.getByTitle("Eliminar imagen")).toBeVisible();
    await page.getByTitle("Eliminar imagen").click();
    await expect(page.getByTitle("Eliminar imagen")).toHaveCount(0);
  });
});
