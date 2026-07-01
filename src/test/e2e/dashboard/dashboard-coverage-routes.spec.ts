import { expect, test, type SeedRole } from "./fixtures";

type CoverageRole = SeedRole | "anonymous";

type CoverageRoute = {
  path: string;
  role: CoverageRole;
};

const routes: CoverageRoute[] = [
  { role: "anonymous", path: "/" },
  { role: "anonymous", path: "/search?q=taladro" },
  { role: "anonymous", path: "/categories" },
  { role: "anonymous", path: "/category/taladros" },
  { role: "anonymous", path: "/product/taladro-percutor-18v" },
  { role: "anonymous", path: "/about" },
  { role: "anonymous", path: "/contact" },
  { role: "anonymous", path: "/partners" },
  { role: "anonymous", path: "/blog" },
  { role: "anonymous", path: "/legal/aviso-legal" },
  { role: "anonymous", path: "/legal/terminos" },
  { role: "anonymous", path: "/legal/cookies" },
  { role: "anonymous", path: "/legal/privacidad" },
  { role: "anonymous", path: "/dashboard" },
  { role: "admin", path: "/dashboard" },
  { role: "admin", path: "/dashboard/products" },
  { role: "admin", path: "/dashboard/products/new" },
  { role: "admin", path: "/dashboard/rentals" },
  { role: "admin", path: "/dashboard/rentals/new" },
  { role: "admin", path: "/dashboard/rentals/rent-1" },
  { role: "admin", path: "/dashboard/messages?rent_id=rent-1" },
  { role: "admin", path: "/dashboard/config" },
  { role: "admin", path: "/dashboard/users" },
  { role: "admin", path: "/dashboard/users/33333333-3333-4333-8333-333333333333" },
  { role: "admin", path: "/dashboard/companies" },
  { role: "admin", path: "/dashboard/companies/company-1" },
  { role: "admin", path: "/dashboard/companies/company-1/users" },
  { role: "admin", path: "/dashboard/categories" },
  { role: "admin", path: "/dashboard/categories/new" },
  { role: "admin", path: "/dashboard/categories/cat-1" },
  { role: "admin", path: "/dashboard/blog" },
  { role: "admin", path: "/dashboard/blog/new" },
  { role: "admin", path: "/dashboard/sites" },
  { role: "admin", path: "/dashboard/platform-analytics" },
  { role: "company_admin", path: "/dashboard" },
  { role: "company_admin", path: "/dashboard/products" },
  { role: "company_admin", path: "/dashboard/rentals" },
  { role: "company_admin", path: "/dashboard/rentals/rent-1" },
  { role: "company_admin", path: "/dashboard/messages" },
  { role: "company_admin", path: "/dashboard/config" },
  { role: "company_admin", path: "/dashboard/companies/company-1" },
  { role: "company_admin", path: "/dashboard/companies/company-1/users" },
  { role: "company_admin", path: "/dashboard/platform-analytics" },
  { role: "company_admin", path: "/dashboard/upgrade" },
  { role: "user", path: "/dashboard" },
  { role: "user", path: "/dashboard/products" },
  { role: "user", path: "/dashboard/rentals" },
  { role: "user", path: "/dashboard/messages" },
  { role: "user", path: "/dashboard/config?tab=address" },
  { role: "user", path: "/dashboard/platform-analytics" },
  { role: "user", path: "/dashboard/upgrade" },
];

test.describe("Dashboard Coverage Routes", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page: _page }, testInfo) => {
    testInfo.annotations.push({
      type: "skipCoverageExploration",
      description: "Route sweep tests already validate route reachability without extra exploration.",
    });
  });

  for (const route of routes) {
    test(`${route.role} explores ${route.path}`, async ({ page, request, seed }) => {
      await seed.reset(request);
      await seed.clearToken(page);

      if (route.role !== "anonymous") {
        await seed.loginAs(page, request, route.role);
      }

      await page.goto(route.path, { waitUntil: "domcontentloaded", timeout: 15000 });
      await expect(page.locator("body")).toHaveCount(1);

      if (route.role === "anonymous" && route.path.startsWith("/dashboard")) {
        await expect(page).toHaveURL(/\/$/);
      }

    });
  }
});
