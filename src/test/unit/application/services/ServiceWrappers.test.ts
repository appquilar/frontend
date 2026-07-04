import { describe, expect, it, vi } from "vitest";
import { CapabilityService } from "@/application/services/CapabilityService";
import { BillingService } from "@/application/services/BillingService";
import { BlogService } from "@/application/services/BlogService";
import { CaptchaService } from "@/application/services/CaptchaService";
import { CategoryService } from "@/application/services/CategoryService";
import { CompanyAdminService } from "@/application/services/CompanyAdminService";
import { CompanyEngagementService } from "@/application/services/CompanyEngagementService";
import { CompanyInvitationService } from "@/application/services/CompanyInvitationService";
import { CompanyMembershipService } from "@/application/services/CompanyMembershipService";
import { CompanyProfileService } from "@/application/services/CompanyProfileService";
import { ContactService } from "@/application/services/ContactService";
import { MediaService } from "@/application/services/MediaService";
import { PaymentPlanService } from "@/application/services/PaymentPlanService";
import { ProductInventoryService } from "@/application/services/ProductInventoryService";
import { ProductService } from "@/application/services/ProductService";
import { PublicCompanyProductsService } from "@/application/services/PublicCompanyProductsService";
import { PublicCompanyProfileService } from "@/application/services/PublicCompanyProfileService";
import { RentalService } from "@/application/services/RentalService";
import { SiteService } from "@/application/services/SiteService";
import { UserEngagementService } from "@/application/services/UserEngagementService";
import { UserService } from "@/application/services/UserService";
import type { FeatureCapabilities } from "@/domain/models/Subscription";
import type { User } from "@/domain/models/User";
import { UserRole } from "@/domain/models/UserRole";

const createMockFn = <T extends (...args: any[]) => any>(
  implementation?: T
): ReturnType<typeof vi.fn<T>> => vi.fn(implementation);

describe("application service wrappers", () => {
  it("CapabilityService resolves direct and company inventory capabilities safely", () => {
    const service = new CapabilityService();
    const userCapabilities: FeatureCapabilities = {
      inventoryManagement: {
        state: "enabled",
        limits: {
          maxProductsWithInventory: 3,
          maxQuantityPerProduct: 25,
        },
      },
    };

    const currentUser = {
      id: "user-1",
      firstName: "Victor",
      lastName: "Saavedra",
      email: "victor@appquilar.com",
      roles: [UserRole.REGULAR_USER],
      address: null,
      location: null,
      capabilities: {
        inventoryManagement: {
          state: "disabled",
          limits: {
            maxProductsWithInventory: 1,
            maxQuantityPerProduct: 5,
          },
        },
      },
      entitlements: {
        plan_type: "user_pro",
        subscription_status: "active",
        quotas: {
          active_products: 5,
          team_members: null,
        },
        capabilities: userCapabilities,
        overrides: {
          isPlatformAdmin: false,
          isCompanyOwner: false,
          isCompanyAdmin: false,
          isFoundingAccount: false,
        },
      },
      companyContext: {
        companyId: "company-1",
        companyName: "Herramientas Norte",
        companyRole: "ROLE_ADMIN",
        isCompanyOwner: true,
        planType: "starter",
        subscriptionStatus: "active",
        isFoundingAccount: false,
        productSlotLimit: 10,
        capabilities: {
          inventoryManagement: {
            state: "disabled",
            limits: {
              maxProductsWithInventory: 2,
              maxQuantityPerProduct: 10,
            },
          },
        },
        entitlements: {
          plan_type: "starter",
          subscription_status: "active",
          quotas: {
            active_products: 10,
            team_members: 5,
          },
          capabilities: {
            inventoryManagement: {
              state: "read_only",
              limits: {
                maxProductsWithInventory: 10,
                maxQuantityPerProduct: 100,
              },
            },
          },
          overrides: {
            isPlatformAdmin: false,
            isCompanyOwner: true,
            isCompanyAdmin: true,
            isFoundingAccount: false,
          },
        },
      },
    } as unknown as User;

    expect(service.getCapabilities(currentUser)).toEqual(userCapabilities);
    expect(service.getCapabilities(null)).toEqual({});
    expect(service.getInventoryManagementCapability(null)).toBeNull();
    expect(service.getInventoryManagementCapability(currentUser, "user")).toEqual(
      userCapabilities.inventoryManagement
    );
    expect(service.getInventoryManagementCapability(currentUser, "company")).toEqual({
      state: "read_only",
      limits: {
        maxProductsWithInventory: 10,
        maxQuantityPerProduct: 100,
      },
    });
  });

  it("BillingService delegates every billing use case to the repository", async () => {
    const repository = {
      createCheckoutSession: createMockFn(async () => ({ url: "https://checkout.test" })),
      createCustomerPortalSession: createMockFn(async () => ({ url: "https://portal.test" })),
      reactivateSubscription: createMockFn(async () => ({ reactivated: true })),
      synchronizeCheckoutSession: createMockFn(async () => ({ synchronized: true })),
      migrateCompanyToExplorer: createMockFn(async () => ({
        migratedOwnerUserId: "user-2",
        companyDeleted: true,
      })),
    };
    const service = new BillingService(repository as never);

    await expect(
      service.createCheckoutSession({
        scope: "user",
        planType: "user_pro",
        successUrl: "https://appquilar.test/success",
        cancelUrl: "https://appquilar.test/cancel",
      })
    ).resolves.toEqual({ url: "https://checkout.test" });
    await expect(
      service.createCustomerPortalSession({
        scope: "company",
        returnUrl: "https://appquilar.test/return",
      })
    ).resolves.toEqual({ url: "https://portal.test" });
    await expect(
      service.reactivateSubscription({
        scope: "user",
      })
    ).resolves.toEqual({ reactivated: true });
    await expect(
      service.synchronizeCheckoutSession({
        scope: "company",
        sessionId: "cs_test_123",
      })
    ).resolves.toEqual({ synchronized: true });
    await expect(
      service.migrateCompanyToExplorer({
        confirm: true,
        targetOwnerUserId: "user-2",
      })
    ).resolves.toEqual({
      migratedOwnerUserId: "user-2",
      companyDeleted: true,
    });
  });

  it("BlogService delegates repository actions and returns the fixed status catalog", async () => {
    const repository = {
      listPublicPosts: createMockFn(async () => ({ data: [], total: 0, page: 1, perPage: 10 })),
      getPublicPostBySlug: createMockFn(async () => null),
      listAdminPosts: createMockFn(async () => ({ data: [], total: 0, page: 1, perPage: 10 })),
      getAdminPostById: createMockFn(async () => null),
      createPost: createMockFn(async () => undefined),
      updatePost: createMockFn(async () => undefined),
      deletePost: createMockFn(async () => undefined),
      publishPost: createMockFn(async () => undefined),
      draftPost: createMockFn(async () => undefined),
      schedulePost: createMockFn(async () => undefined),
      listCategories: createMockFn(async () => []),
      createCategory: createMockFn(async () => undefined),
      deleteCategory: createMockFn(async () => undefined),
    };
    const service = new BlogService(repository as never);

    await service.listPublicPosts({ page: 2 });
    await service.getPublicPostBySlug("public-post");
    await service.listAdminPosts({ status: "draft" });
    await service.getAdminPostById("post-1");
    await service.createPost({ postId: "post-1" } as never);
    await service.updatePost("post-1", { title: "Updated" } as never);
    await service.deletePost("post-1");
    await service.publishPost("post-1");
    await service.draftPost("post-1");
    await service.schedulePost("post-1", "2026-04-19T10:00:00Z");
    await service.listCategories();
    await service.createCategory({ categoryId: "cat-1", name: "Noticias" });
    await service.deleteCategory("cat-1");

    expect(service.getStatuses()).toEqual(["draft", "scheduled", "published"]);
  });

  it("thin repository-backed services delegate their calls", async () => {
    const captchaRepository = { getConfig: createMockFn(async () => ({ enabled: true, siteKey: "site-key" })) };
    const categoryRepository = {
      getAllCategories: createMockFn(async () => ({ categories: [], total: 0, page: 1, perPage: 50 })),
      getById: createMockFn(async () => ({ id: "cat-1" })),
      getBySlug: createMockFn(async () => ({ id: "cat-1", slug: "tools" })),
      getBreadcrumbs: createMockFn(async () => [{ id: "cat-1", name: "Tools", slug: "tools" }]),
      getDynamicProperties: createMockFn(async () => ({
        dynamicFiltersEnabled: true,
        disabledReason: null,
        definitions: [],
      })),
      create: createMockFn(async () => undefined),
      update: createMockFn(async () => undefined),
    };
    const companyAdminRepository = { listCompanies: createMockFn(async () => ({ data: [], total: 0, page: 1, perPage: 50 })) };
    const companyEngagementRepository = {
      getCompanyStats: createMockFn(async () => ({ summary: { totalViews: 10 } })),
      trackProductView: createMockFn(() => undefined),
    };
    const companyInvitationRepository = {
      getInvitationStatus: createMockFn(async () => ({
        email: "new@appquilar.test",
        companyName: "Rentals QA",
        role: "ROLE_CONTRIBUTOR",
        status: "PENDING",
        expiresAt: null,
      })),
      acceptInvitation: createMockFn(async () => undefined),
    };
    const companyMembershipRepository = {
      createCompany: createMockFn(async () => undefined),
      listCompanyUsers: createMockFn(async () => []),
      inviteCompanyUser: createMockFn(async () => undefined),
      updateCompanyUserRole: createMockFn(async () => undefined),
      removeCompanyUser: createMockFn(async () => undefined),
    };
    const companyProfileRepository = {
      getById: createMockFn(async () => ({ id: "company-1" })),
      update: createMockFn(async () => undefined),
    };
    const contactRepository = { sendMessage: createMockFn(async () => undefined) };
    const mediaRepository = {
      downloadImage: createMockFn(async () => new Blob(["image"])),
      uploadImage: createMockFn(async () => "image-id"),
      deleteImage: createMockFn(async () => undefined),
    };
    const paymentPlanRepository = {
      listPlans: createMockFn(async () => []),
      updatePlan: createMockFn(async () => undefined),
      listSubscribers: createMockFn(async () => []),
      assignPlan: createMockFn(async () => undefined),
    };
    const publicCompanyProductsRepository = {
      listByCompanySlug: createMockFn(async () => ({ data: [], total: 0, page: 1 })),
    };
    const publicCompanyProfileRepository = { getBySlug: createMockFn(async () => ({ slug: "north" })) };
    const siteRepository = {
      getById: createMockFn(async () => ({ id: "site-1" })),
      update: createMockFn(async () => undefined),
    };
    const userEngagementRepository = { getUserStats: createMockFn(async () => ({ summary: { totalViews: 5 } })) };

    const captchaService = new CaptchaService(captchaRepository as never);
    const categoryService = new CategoryService(categoryRepository as never);
    const companyAdminService = new CompanyAdminService(companyAdminRepository as never);
    const companyEngagementService = new CompanyEngagementService(companyEngagementRepository as never);
    const companyInvitationService = new CompanyInvitationService(companyInvitationRepository as never);
    const companyMembershipService = new CompanyMembershipService(companyMembershipRepository as never);
    const companyProfileService = new CompanyProfileService(companyProfileRepository as never);
    const contactService = new ContactService(contactRepository as never);
    const mediaService = new MediaService(mediaRepository as never);
    const paymentPlanService = new PaymentPlanService(paymentPlanRepository as never);
    const publicCompanyProductsService = new PublicCompanyProductsService(
      publicCompanyProductsRepository as never
    );
    const publicCompanyProfileService = new PublicCompanyProfileService(
      publicCompanyProfileRepository as never
    );
    const siteService = new SiteService(siteRepository as never);
    const userEngagementService = new UserEngagementService(userEngagementRepository as never);

    await expect(captchaService.getConfig()).resolves.toEqual({ enabled: true, siteKey: "site-key" });
    await categoryService.getAllCategories({ page: 2 });
    await categoryService.getById("cat-1");
    await categoryService.getBySlug("tools");
    await categoryService.getBreadcrumbs("cat-1");
    await categoryService.getDynamicProperties(["cat-1"]);
    await categoryService.create({ id: "cat-1" } as never);
    await categoryService.update({ id: "cat-1" } as never);
    await companyAdminService.listCompanies({ search: "north" } as never);
    await expect(companyEngagementService.getCompanyStats("company-1")).resolves.toEqual({
      summary: { totalViews: 10 },
    });
    companyEngagementService.trackProductView({ productId: "product-1" } as never);
    await expect(companyInvitationService.getInvitationStatus({
      companyId: "company-1",
      token: "invitation",
    })).resolves.toEqual({
      email: "new@appquilar.test",
      companyName: "Rentals QA",
      role: "ROLE_CONTRIBUTOR",
      status: "PENDING",
      expiresAt: null,
    });
    await companyInvitationService.acceptInvitation({ token: "invitation" } as never);
    await companyMembershipService.createCompany({ companyId: "company-1" } as never);
    await companyMembershipService.listCompanyUsers("company-1", 3, 25);
    await companyMembershipService.inviteCompanyUser({ companyId: "company-1" } as never);
    await companyMembershipService.updateCompanyUserRole({
      companyId: "company-1",
      userId: "user-1",
      role: "ROLE_ADMIN",
    });
    await companyMembershipService.removeCompanyUser({ companyId: "company-1", userId: "user-1" });
    await companyProfileService.getById("company-1");
    await companyProfileService.update({ id: "company-1" } as never);
    await contactService.sendMessage({ subject: "Hola" } as never);
    await expect(mediaService.getImage("image-1")).resolves.toBeInstanceOf(Blob);
    await expect(mediaService.uploadImage(new File(["x"], "file.png"))).resolves.toBe("image-id");
    await paymentPlanService.listPlans("user");
    await paymentPlanService.updatePlan({ scope: "user", planCode: "pro" } as never);
    await paymentPlanService.listSubscribers("user", "pro");
    await paymentPlanService.assignPlan({ scope: "user" } as never);
    await publicCompanyProductsService.listByCompanySlug("north", 2, 12);
    await publicCompanyProfileService.getBySlug("north");
    await siteService.getById("site-1");
    await siteService.update({ id: "site-1" } as never);
    await userEngagementService.getUserStats("user-1", { from: "2026-04-01", to: "2026-04-19" });

    expect(companyEngagementRepository.trackProductView).toHaveBeenCalledWith({
      productId: "product-1",
    });
  });

  it("MediaService defaults image downloads to THUMBNAIL and ProductService delegates every repository method", async () => {
    const mediaRepository = {
      downloadImage: createMockFn(async () => new Blob(["thumb"])),
      uploadImage: createMockFn(async () => "image-id"),
      deleteImage: createMockFn(async () => undefined),
    };
    const productRepository = {
      search: createMockFn(async () => ({ data: [], total: 0, page: 1 })),
      getAllProducts: createMockFn(async () => []),
      getProductById: createMockFn(async () => null),
      getBySlug: createMockFn(async () => null),
      getProductsByCompanyId: createMockFn(async () => []),
      listByOwner: createMockFn(async () => []),
      listByOwnerPaginated: createMockFn(async () => ({ data: [], total: 0, page: 2 })),
      getProductsByCategoryId: createMockFn(async () => []),
      createProduct: createMockFn(async () => undefined),
      updateProduct: createMockFn(async () => ({ id: "product-1" })),
      deleteProduct: createMockFn(async () => true),
      publishProduct: createMockFn(async () => true),
      calculateRentalCost: createMockFn(async () => ({ days: 2 })),
      checkAvailability: createMockFn(async () => ({ canRequest: true })),
      getInventorySummary: createMockFn(async () => ({ productId: "product-1" })),
      getInventoryAllocations: createMockFn(async () => []),
      getInventoryUnits: createMockFn(async () => []),
      updateInventoryUnit: createMockFn(async () => ({ unitId: "unit-1" })),
      adjustInventory: createMockFn(async () => undefined),
    };

    const mediaService = new MediaService(mediaRepository as never);
    const productService = new ProductService(productRepository as never);

    await mediaService.getImage("image-1");
    expect(mediaRepository.downloadImage).toHaveBeenCalledWith("image-1", "THUMBNAIL");
    await mediaService.deleteImage("image-1");

    await productService.search({ text: "taladro" });
    await productService.getAllProducts();
    await productService.getProductById("product-1");
    await productService.getBySlug("taladro");
    await productService.getProductsByCompanyId("company-1");
    await productService.listByOwner("owner-1");
    await productService.listByOwnerPaginated("owner-1", "company", 2, 20, {
      publicationStatus: "published",
    } as never);
    await productService.getProductsByCategoryId("cat-1");
    await productService.createProduct({ name: "Taladro" } as never);
    await productService.updateProduct("product-1", { name: "Taladro" } as never);
    await productService.deleteProduct("product-1");
    await productService.publishProduct("product-1");
    await productService.calculateRentalCost("product-1", "2026-04-20", "2026-04-22", 2);
    await productService.checkAvailability("product-1", "2026-04-20", "2026-04-22", 2);
    await productService.getInventorySummary("product-1");
    await productService.getInventoryAllocations("product-1");
    await productService.getInventoryUnits("product-1");
    await productService.updateInventoryUnit("product-1", "unit-1", { code: "A-1" });
    await productService.adjustInventory("product-1", 8);

    expect(productRepository.listByOwnerPaginated).toHaveBeenCalledWith(
      "owner-1",
      "company",
      2,
      20,
      { publicationStatus: "published" }
    );
  });

  it("ProductInventoryService delegates inventory endpoints and derives rentability", async () => {
    const repository = {
      getInventorySummary: createMockFn(async () => ({ availableQuantity: 0 })),
      getInventoryAllocations: createMockFn(async () => [{ rentId: "rent-1" }]),
      getInventoryUnits: createMockFn(async () => [{ id: "unit-1", code: "U-1", status: "available" }]),
      updateInventoryUnit: createMockFn(async () => ({ id: "unit-1", code: "U-2", status: "maintenance" })),
      checkAvailability: createMockFn(async () => ({ canRequest: false, status: "unavailable" })),
      adjustInventory: createMockFn(async () => undefined),
    };
    const service = new ProductInventoryService(repository as never);

    await service.getInventorySummary("product-1");
    await service.getInventoryAllocations("product-1");
    await service.getInventoryUnits("product-1");
    await service.updateInventoryUnit("product-1", "unit-1", { status: "maintenance" } as never);
    await service.checkAvailability("product-1", "2026-04-20", "2026-04-22", 1);
    await service.adjustInventory("product-1", 6);

    expect(
      service.getRentability({
        publicationStatus: "published",
        quantity: 1,
        inventorySummary: {
          availableQuantity: 0,
          isInventoryEnabled: true,
          capabilityState: "enabled",
          isRentableNow: false,
          unavailabilityReason: "out_of_stock",
        },
      } as never)
    ).toEqual(
      expect.objectContaining({
        inventoryManaged: true,
        isRentableNow: false,
        availableQuantity: 0,
        unavailabilityReason: "out_of_stock",
        availabilityLabel: "Sin stock",
        availabilityTone: "warning",
      })
    );
  });

  it("RentalService delegates list, detail, message and mutation flows", async () => {
    const repository = {
      listRents: createMockFn(async () => ({ data: [], total: 0, page: 1, perPage: 10 })),
      getRentById: createMockFn(async () => null),
      listRentMessages: createMockFn(async () => ({ data: [], total: 0, page: 1, perPage: 10 })),
      createRentMessage: createMockFn(async () => undefined),
      markRentMessagesAsRead: createMockFn(async () => undefined),
      getUnreadRentMessagesCount: createMockFn(async () => ({ totalUnread: 0, byRent: [] })),
      createRent: createMockFn(async () => undefined),
      updateRent: createMockFn(async () => undefined),
      updateRentStatus: createMockFn(async () => undefined),
    };
    const service = new RentalService(repository as never);

    await service.listRents({ search: "taladro" });
    await service.getRentById("rent-1");
    await service.listRentMessages("rent-1", { page: 2 });
    await service.createRentMessage("rent-1", { content: "Hola" });
    await service.markRentMessagesAsRead("rent-1");
    await service.getUnreadRentMessagesCount();
    await service.createRent({ rentId: "rent-1" } as never);
    await service.updateRent("rent-1", { requestedQuantity: 2 } as never);
    await service.updateRentStatus("rent-1", { status: "rental_confirmed" } as never);

    expect(repository.listRents).toHaveBeenCalledWith({ search: "taladro" });
    expect(repository.updateRentStatus).toHaveBeenCalledWith("rent-1", {
      status: "rental_confirmed",
    });
  });

  it("UserService resolves current user from the session and guards unsupported repository methods", async () => {
    const authRepository = {
      getCurrentSession: createMockFn(async () => ({ token: "jwt-token", userId: "user-1" })),
    };
    const userRepository = {
      getById: createMockFn(async () => ({ id: "user-1", email: "victor@appquilar.com" })),
      update: createMockFn(async () => ({ id: "user-1", firstName: "Victor" })),
      updateAddress: createMockFn(async () => ({ id: "user-1", address: { city: "Madrid" } })),
    };
    const service = new UserService(userRepository as never, authRepository as never);

    await expect(service.getUserById("user-1")).resolves.toEqual({
      id: "user-1",
      email: "victor@appquilar.com",
    });
    await expect(service.getCurrentUser()).resolves.toEqual({
      id: "user-1",
      email: "victor@appquilar.com",
    });
    await service.updateUser("user-1", { firstName: "Victor" });
    await service.updateUserAddress("user-1", { address: { city: "Madrid" } } as never);
    await expect(service.getUsersByCompanyId("company-1")).rejects.toThrow(
      "getByCompanyId is not implemented in the current UserRepository."
    );
    await expect(service.getAllUsers({ page: 1 })).rejects.toThrow(
      "getAllUsers is not implemented in the current UserRepository."
    );

    const withListMethods = new UserService(
      {
        ...userRepository,
        getByCompanyId: createMockFn(async () => [{ id: "user-2" }]),
        getAllUsers: createMockFn(async () => ({ data: [], total: 0, page: 1, perPage: 20 })),
      } as never,
      {
        getCurrentSession: createMockFn(async () => null),
      } as never
    );

    await expect(withListMethods.getCurrentUser()).resolves.toBeNull();
    await expect(withListMethods.getUsersByCompanyId("company-1")).resolves.toEqual([{ id: "user-2" }]);
    await expect(withListMethods.getAllUsers({ page: 1 })).resolves.toEqual({
      data: [],
      total: 0,
      page: 1,
      perPage: 20,
    });
  });
});
