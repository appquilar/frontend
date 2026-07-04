import { expect, test } from "./fixtures";
import { registerNetworkMocks } from "./networkMocks";
import { PUBLIC_PATHS } from "@/domain/config/publicRoutes";

test.beforeEach(async ({ page }) => {
  await registerNetworkMocks(page);
});

test("unauthenticated user is redirected from dashboard to home", async ({ page }) => {
  await page.goto("/dashboard");

  await expect
    .poll(() => new URL(page.url()).pathname)
    .toBe(PUBLIC_PATHS.home);
  await expect(page.locator("[data-trigger-login]:visible")).toBeVisible();
});
