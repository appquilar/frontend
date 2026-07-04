import { describe, expect, it, vi } from "vitest";

import { createAuthSession } from "@/domain/models/AuthSession";
import { ApiCaptchaRepository } from "@/infrastructure/repositories/ApiCaptchaRepository";
import { ApiCategoryRepository } from "@/infrastructure/repositories/ApiCategoryRepository";
import { ApiCompanyAdminRepository } from "@/infrastructure/repositories/ApiCompanyAdminRepository";
import { ApiCompanyEngagementRepository } from "@/infrastructure/repositories/ApiCompanyEngagementRepository";
import { ApiCompanyInvitationRepository } from "@/infrastructure/repositories/ApiCompanyInvitationRepository";
import { ApiCompanyMembershipRepository } from "@/infrastructure/repositories/ApiCompanyMembershipRepository";
import { ApiCompanyProfileRepository } from "@/infrastructure/repositories/ApiCompanyProfileRepository";
import { ApiContactRepository } from "@/infrastructure/repositories/ApiContactRepository";
import { ApiMediaRepository } from "@/infrastructure/repositories/ApiMediaRepository";
import { ApiSiteRepository } from "@/infrastructure/repositories/ApiSiteRepository";
import { ApiUserEngagementRepository } from "@/infrastructure/repositories/ApiUserEngagementRepository";

const createApiClientMock = () => ({
  get: vi.fn(),
  post: vi.fn(),
  postBackground: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
});

describe("ApiRepository coverage helpers", () => {
  it("maps captcha config from wrapped and flat payloads", async () => {
    const apiClient = createApiClientMock();
    apiClient.get
      .mockResolvedValueOnce({
        success: true,
        data: {
          enabled: true,
          site_key: "public-key",
        },
      })
      .mockResolvedValueOnce({
        enabled: false,
        siteKey: "   ",
      });

    const repository = new ApiCaptchaRepository(apiClient as never);

    await expect(repository.getConfig()).resolves.toEqual({
      enabled: true,
      siteKey: "public-key",
    });
    await expect(repository.getConfig()).resolves.toEqual({
      enabled: false,
      siteKey: null,
    });
  });

  it("serializes contact messages with captcha_token", async () => {
    const apiClient = createApiClientMock();
    apiClient.post.mockResolvedValue(undefined);

    const repository = new ApiContactRepository(apiClient as never);

    await repository.sendMessage({
      name: "Victor",
      email: "victor@appquilar.test",
      topic: "support",
      message: "Necesito ayuda",
      captchaToken: "captcha-token",
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/contact",
      {
        name: "Victor",
        email: "victor@appquilar.test",
        topic: "support",
        message: "Necesito ayuda",
        captcha_token: "captcha-token",
      },
      {
        skipParseJson: true,
      }
    );
  });

  it("maps categories, clamps per-page values and serializes dynamic-property endpoints", async () => {
    const apiClient = createApiClientMock();
    apiClient.get
      .mockResolvedValueOnce({
        success: true,
        data: [
          {
            category_id: "category-1",
            name: "Herramientas",
            slug: "herramientas",
            description: "Herramientas pesadas",
            parent_id: "root",
            icon_name: "hammer",
            featured_image_id: "img-featured",
            landscape_image_id: "img-landscape",
            dynamic_property_definitions: [
              {
                code: "peso",
                label: "Peso",
                type: "integer",
                filterable: true,
                unit: "kg",
                options: [
                  {
                    value: "10",
                    label: "10kg",
                  },
                ],
              },
            ],
          },
        ],
        total: 1,
        page: 2,
        per_page: 50,
      })
      .mockResolvedValueOnce({
        data: {
          category_id: "category-2",
          name: "Escenarios",
          slug: "escenarios",
        },
      })
      .mockResolvedValueOnce({
        category_id: "slug-category",
        name: "Iluminacion",
        slug: "iluminacion",
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: "category-root",
            parent_id: null,
            name: "Deportes acuaticos",
            slug: "deportes-acuaticos",
            icon_name: "waves",
            depth: 1,
          },
          {
            id: "category-leaf",
            parent_id: "category-root",
            name: "Snorkel",
            slug: "snorkel",
            icon_name: "mask",
            depth: 2,
          },
        ],
      })
      .mockResolvedValueOnce({
        data: {
          dynamic_filters_enabled: true,
          disabled_reason: null,
          definitions: [
            {
              code: "altura",
              label: "Altura",
              type: "integer",
              filterable: true,
            },
          ],
        },
      });
    apiClient.post.mockResolvedValue(undefined);
    apiClient.patch.mockResolvedValue(undefined);

    const repository = new ApiCategoryRepository(
      apiClient as never,
      () => createAuthSession({ token: "jwt-token" })
    );

    await expect(
      repository.getAllCategories({
        id: "category-1",
        name: "herra",
        page: 2,
        perPage: 999,
      })
    ).resolves.toEqual({
      categories: [
        {
          id: "category-1",
          name: "Herramientas",
          slug: "herramientas",
          description: "Herramientas pesadas",
          parentId: "root",
          iconName: "hammer",
          featuredImageId: "img-featured",
          landscapeImageId: "img-landscape",
          dynamicPropertyDefinitions: [
            {
              code: "peso",
              label: "Peso",
              type: "integer",
              filterable: true,
              unit: "kg",
              options: [
                {
                  value: "10",
                  label: "10kg",
                },
              ],
            },
          ],
        },
      ],
      total: 1,
      page: 2,
      perPage: 50,
    });
    expect(apiClient.get).toHaveBeenNthCalledWith(
      1,
      "/api/categories?id=category-1&name=herra&page=2&per_page=50"
    );
    await expect(repository.getById("category/2")).resolves.toMatchObject({
      id: "category-2",
      slug: "escenarios",
    });
    await expect(repository.getBySlug("iluminacion")).resolves.toMatchObject({
      id: "slug-category",
      slug: "iluminacion",
    });
    await expect(repository.getBreadcrumbs("category-1")).resolves.toEqual([
      {
        id: "category-root",
        name: "Deportes acuaticos",
        slug: "deportes-acuaticos",
        parentId: null,
        iconName: "waves",
        depth: 1,
      },
      {
        id: "category-leaf",
        name: "Snorkel",
        slug: "snorkel",
        parentId: "category-root",
        iconName: "mask",
        depth: 2,
      },
    ]);
    expect(apiClient.get).toHaveBeenNthCalledWith(
      4,
      "/api/categories/category-1/breadcrumbs"
    );
    await expect(repository.getDynamicProperties(["category-1", "category-2"])).resolves.toEqual({
      dynamicFiltersEnabled: true,
      disabledReason: null,
      definitions: [
        {
          code: "altura",
          label: "Altura",
          type: "integer",
          filterable: true,
          unit: null,
          options: undefined,
        },
      ],
    });

    await repository.create({
      id: "new-category",
      name: "Carpas",
      slug: "carpas",
      description: null,
      parentId: null,
      iconName: null,
      featuredImageId: null,
      landscapeImageId: null,
      dynamicPropertyDefinitions: [],
    });

    await repository.update({
      id: "new/category",
      name: "Carpas XL",
      slug: "carpas-xl",
      description: "Amplias",
      parentId: "parent-1",
      iconName: "tent",
      featuredImageId: "img-1",
      landscapeImageId: "img-2",
      dynamicPropertyDefinitions: [
        {
          code: "ancho",
          label: "Ancho",
          type: "integer",
          filterable: false,
          unit: "m",
        },
      ],
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/categories",
      {
        category_id: "new-category",
        name: "Carpas",
        slug: "carpas",
        description: null,
        parent_id: null,
        icon_name: null,
        featured_image_id: null,
        landscape_image_id: null,
        dynamic_property_definitions: [],
      },
      {
        headers: {
          Authorization: "Bearer jwt-token",
        },
      }
    );
    expect(apiClient.patch).toHaveBeenCalledWith(
      "/api/categories/new%2Fcategory",
      {
        category_id: "new/category",
        name: "Carpas XL",
        slug: "carpas-xl",
        description: "Amplias",
        parent_id: "parent-1",
        icon_name: "tent",
        featured_image_id: "img-1",
        landscape_image_id: "img-2",
        dynamic_property_definitions: [
          {
            code: "ancho",
            label: "Ancho",
            type: "integer",
            filterable: false,
            unit: "m",
          },
        ],
      },
      {
        headers: {
          Authorization: "Bearer jwt-token",
        },
      }
    );
  });

  it("maps company admin and profile responses with auth headers", async () => {
    const apiClient = createApiClientMock();
    apiClient.get
      .mockResolvedValueOnce({
        success: true,
        data: [
          {
            company_id: "company-1",
            owner_id: "owner-1",
            name: "Acme",
            slug: "acme",
            description: "Desc",
            fiscal_identifier: "A-1",
            contact_email: "ops@acme.test",
            plan_type: "early_bird",
            subscription_status: "active",
            is_founding_account: true,
          },
        ],
        total: 1,
        page: 3,
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          company_id: "company-1",
          owner_id: "owner-1",
          name: "Acme",
          slug: "acme",
          description: "Desc",
          fiscal_identifier: "A-1",
          contact_email: "ops@acme.test",
          phone_number: {
            country_code: "ES",
            prefix: "+34",
            number: "123456789",
          },
          address: {
            street: "Calle 1",
            street2: "Piso 2",
            city: "Madrid",
            postal_code: "28001",
            state: "Madrid",
            country: "ES",
          },
          location: {
            latitude: 40.4,
            longitude: -3.7,
          },
          profile_picture_id: "profile-1",
          header_image_id: "header-1",
          plan_type: "pro",
          subscription_status: "paused",
          is_founding_account: false,
        },
      });
    apiClient.patch.mockResolvedValue(undefined);

    const session = () => createAuthSession({ token: "jwt-token" });
    const adminRepository = new ApiCompanyAdminRepository(apiClient as never, session);
    const profileRepository = new ApiCompanyProfileRepository(apiClient as never, session);

    await expect(
      adminRepository.listCompanies({
        name: "Ac",
        page: 3,
        perPage: 25,
      })
    ).resolves.toEqual({
      companies: [
        {
          id: "company-1",
          ownerId: "owner-1",
          name: "Acme",
          slug: "acme",
          description: "Desc",
          fiscalIdentifier: "A-1",
          contactEmail: "ops@acme.test",
          planType: "early_bird",
          subscriptionStatus: "active",
          isFoundingAccount: true,
        },
      ],
      total: 1,
      page: 3,
    });

    await expect(profileRepository.getById("company-1")).resolves.toEqual({
      id: "company-1",
      ownerId: "owner-1",
      name: "Acme",
      slug: "acme",
      description: "Desc",
      fiscalIdentifier: "A-1",
      contactEmail: "ops@acme.test",
      phoneNumber: {
        countryCode: "ES",
        prefix: "+34",
        number: "123456789",
      },
      address: {
        street: "Calle 1",
        street2: "Piso 2",
        city: "Madrid",
        postalCode: "28001",
        state: "Madrid",
        country: "ES",
      },
      location: {
        latitude: 40.4,
        longitude: -3.7,
      },
      profilePictureId: "profile-1",
      headerImageId: "header-1",
      planType: "pro",
      subscriptionStatus: "paused",
      isFoundingAccount: false,
    });

    await profileRepository.update({
      companyId: "company/1",
      name: "Acme Updated",
      slug: "acme-updated",
      description: null,
      fiscalIdentifier: null,
      contactEmail: null,
      phoneNumber: {
        countryCode: "ES",
        prefix: "+34",
        number: "987654321",
      },
      address: {
        street: "Nueva 2",
        street2: null,
        city: "Valencia",
        postalCode: "46001",
        state: "Valencia",
        country: "ES",
      },
      location: {
        latitude: 39.4,
        longitude: -0.3,
      },
      profilePictureId: null,
      headerImageId: "header-2",
    });

    expect(apiClient.patch).toHaveBeenCalledWith(
      "/api/companies/company%2F1",
      {
        name: "Acme Updated",
        slug: "acme-updated",
        description: null,
        fiscal_identifier: null,
        contact_email: null,
        phone_number_country_code: "ES",
        phone_number_prefix: "+34",
        phone_number_number: "987654321",
        address: {
          street: "Nueva 2",
          street2: null,
          city: "Valencia",
          postal_code: "46001",
          state: "Valencia",
          country: "ES",
        },
        location: {
          latitude: 39.4,
          longitude: -0.3,
        },
        profile_picture_id: null,
        header_image_id: "header-2",
      },
      {
        headers: {
          Authorization: "Bearer jwt-token",
        },
        skipParseJson: true,
      }
    );
  });

  it("serializes company membership create, list and user management flows", async () => {
    const apiClient = createApiClientMock();
    apiClient.post.mockResolvedValue(undefined);
    apiClient.get
      .mockResolvedValueOnce({
        success: true,
        data: [
          {
            company_id: "company-1",
            user_id: "user-1",
            email: "member@appquilar.test",
            role: "ROLE_ADMIN",
            status: "ACCEPTED",
          },
        ],
      })
      .mockResolvedValueOnce(null);
    apiClient.patch.mockResolvedValue(undefined);
    apiClient.delete.mockResolvedValue(undefined);

    const repository = new ApiCompanyMembershipRepository(
      apiClient as never,
      () => createAuthSession({ token: "jwt-token" })
    );

    await repository.createCompany({
      companyId: "company-1",
      ownerId: "owner-1",
      name: "Acme",
      description: "Desc",
      fiscalIdentifier: "A-1",
      contactEmail: "ops@acme.test",
      phoneNumber: {
        countryCode: "ES",
        prefix: "+34",
        number: "123456789",
      },
      address: {
        street: "Calle 1",
        street2: null,
        city: "Madrid",
        postalCode: "28001",
        state: "Madrid",
        country: "ES",
      },
      location: {
        latitude: 40.4,
        longitude: -3.7,
      },
    });

    await expect(repository.listCompanyUsers("company/1", 2, 25)).resolves.toEqual([
      {
        companyId: "company-1",
        userId: "user-1",
        email: "member@appquilar.test",
        role: "ROLE_ADMIN",
        status: "ACCEPTED",
      },
    ]);
    await expect(repository.listCompanyUsers("company-1")).resolves.toEqual([]);

    await repository.inviteCompanyUser({
      companyId: "company-1",
      email: "invite@appquilar.test",
      role: "ROLE_CONTRIBUTOR",
    });
    await repository.updateCompanyUserRole({
      companyId: "company-1",
      userId: "user/1",
      role: "ROLE_ADMIN",
    });
    await repository.removeCompanyUser({
      companyId: "company-1",
      userId: "user/1",
    });

    expect(apiClient.post).toHaveBeenNthCalledWith(
      1,
      "/api/companies",
      {
        company_id: "company-1",
        owner_id: "owner-1",
        name: "Acme",
        description: "Desc",
        fiscal_identifier: "A-1",
        contact_email: "ops@acme.test",
        phone_number_country_code: "ES",
        phone_number_prefix: "+34",
        phone_number_number: "123456789",
        address: {
          street: "Calle 1",
          street2: null,
          city: "Madrid",
          postal_code: "28001",
          state: "Madrid",
          country: "ES",
        },
        location: {
          latitude: 40.4,
          longitude: -3.7,
        },
      },
      {
        headers: {
          Authorization: "Bearer jwt-token",
        },
        skipParseJson: true,
      }
    );
    expect(apiClient.post).toHaveBeenNthCalledWith(
      2,
      "/api/companies/company-1/users",
      {
        email: "invite@appquilar.test",
        role: "ROLE_CONTRIBUTOR",
      },
      {
        headers: {
          Authorization: "Bearer jwt-token",
        },
        skipParseJson: true,
      }
    );
    expect(apiClient.patch).toHaveBeenCalledWith(
      "/api/companies/company-1/users/user%2F1",
      {
        role: "ROLE_ADMIN",
      },
      {
        headers: {
          Authorization: "Bearer jwt-token",
        },
        skipParseJson: true,
      }
    );
    expect(apiClient.delete).toHaveBeenCalledWith(
      "/api/companies/company-1/users/user%2F1",
      undefined,
      {
        headers: {
          Authorization: "Bearer jwt-token",
        },
        skipParseJson: true,
      }
    );
  });

  it("maps company and user engagement stats and background tracking", async () => {
    const apiClient = createApiClientMock();
    apiClient.get
      .mockResolvedValueOnce({
        success: true,
        data: {
          company_id: "company-1",
          period: {
            from: "2026-01-01",
            to: "2026-01-31",
          },
          summary: {
            total_views: 100,
            unique_visitors: 40,
            repeat_visitors: 10,
            repeat_visitor_ratio: 0.25,
            logged_views: 70,
            anonymous_views: 30,
            messages_total: 12,
            message_threads: 4,
            message_to_rental_ratio: 0.5,
            average_first_response_minutes: 18,
          },
          top_locations: [
            {
              country: "ES",
              region: "Madrid",
              city: "Madrid",
              total_views: 50,
              unique_visitors: 20,
            },
          ],
          series: {
            daily_views: [{ day: "2026-01-01", views: 12 }],
            daily_messages: [{ day: "2026-01-01", messages: 3 }],
          },
          by_product: [
            {
              product_id: "product-1",
              product_name: "Taladro",
              product_slug: "taladro",
              total_views: 40,
              unique_visitors: 15,
              logged_views: 25,
              anonymous_views: 15,
              messages_total: 5,
              message_threads: 2,
              visit_to_message_ratio: 0.12,
              message_to_rental_ratio: 0.5,
            },
          ],
          opportunities: {
            high_interest_low_conversion: {
              product_id: "product-2",
              product_name: "Escalera",
              product_slug: "escalera",
              total_views: 30,
              unique_visitors: 11,
              logged_views: 10,
              anonymous_views: 20,
              messages_total: 1,
              message_threads: 1,
              visit_to_message_ratio: 0.03,
              message_to_rental_ratio: 0.1,
            },
          },
        },
      })
      .mockResolvedValueOnce({
        user_id: "user-1",
        period: {
          from: "2026-01-01",
          to: "2026-01-31",
        },
        summary: {
          total_views: 70,
          unique_visitors: 20,
          messages_total: 8,
          message_threads: 3,
        },
        series: {
          daily_views: [{ day: "2026-01-01", views: 9 }],
          daily_messages: [{ day: "2026-01-01", messages: 1 }],
        },
        by_product: [
          {
            product_id: "product-3",
            product_name: "Foco",
            product_slug: "foco",
            total_views: 22,
            unique_visitors: 10,
            messages_total: 2,
            message_threads: 1,
          },
        ],
      });

    const companyRepository = new ApiCompanyEngagementRepository(
      apiClient as never,
      () => createAuthSession({ token: "jwt-token" })
    );
    const userRepository = new ApiUserEngagementRepository(apiClient as never, () => null);

    await expect(
      companyRepository.getCompanyStats("company/1", {
        from: "2026-01-01",
        to: "2026-01-31",
      })
    ).resolves.toMatchObject({
      companyId: "company-1",
      summary: {
        totalViews: 100,
        uniqueVisitors: 40,
        repeatVisitors: 10,
      },
      topLocations: [
        {
          city: "Madrid",
        },
      ],
      byProduct: [
        {
          productId: "product-1",
          totalViews: 40,
        },
      ],
      opportunities: {
        highInterestLowConversion: {
          productId: "product-2",
        },
      },
    });

    companyRepository.trackProductView({
      productId: "product/1",
      anonymousId: "anon-1",
      sessionId: "session-1",
      dwellTimeMs: 1234,
      occurredAt: "2026-01-10T10:00:00Z",
    });

    await expect(
      userRepository.getUserStats("user/1", {
        from: "2026-01-01",
        to: "2026-01-31",
      })
    ).resolves.toMatchObject({
      userId: "user-1",
      summary: {
        totalViews: 70,
        uniqueVisitors: 20,
      },
      byProduct: [
        {
          productId: "product-3",
          productSlug: "foco",
        },
      ],
    });

    expect(apiClient.postBackground).toHaveBeenCalledWith(
      "/api/public/products/product%2F1/view",
      {
        anonymous_id: "anon-1",
        session_id: "session-1",
        dwell_time_ms: 1234,
        occurred_at: "2026-01-10T10:00:00Z",
      },
      {
        headers: {
          Authorization: "Bearer jwt-token",
        },
      }
    );
  });

  it("serializes invitations and maps site payloads with defaults", async () => {
    const apiClient = createApiClientMock();
    apiClient.post.mockResolvedValue(undefined);
    apiClient.get.mockResolvedValueOnce({
      data: {
        email: "new@appquilar.test",
        company_name: "Rentals QA",
        role: "ROLE_CONTRIBUTOR",
        status: "ACCEPTED",
        expires_at: "2026-07-10T12:00:00+00:00",
      },
    });
    apiClient.get.mockResolvedValueOnce({
      data: {
        site_id: "site-1",
        name: "Main",
        title: "Appquilar",
        url: "https://appquilar.test",
        description: null,
        category_ids: ["category-1"],
        menu_category_ids: ["category-2"],
        featured_category_ids: ["category-3"],
      },
    });
    apiClient.patch.mockResolvedValue(undefined);

    const invitationRepository = new ApiCompanyInvitationRepository(
      apiClient as never,
      () => createAuthSession({ token: "jwt-token" })
    );
    const siteRepository = new ApiSiteRepository(
      apiClient as never,
      () => createAuthSession({ token: "jwt-token" })
    );

    await expect(invitationRepository.getInvitationStatus({
      companyId: "company/1",
      token: "invite/1",
    })).resolves.toEqual({
      email: "new@appquilar.test",
      companyName: "Rentals QA",
      role: "ROLE_CONTRIBUTOR",
      status: "ACCEPTED",
      expiresAt: "2026-07-10T12:00:00+00:00",
    });

    await invitationRepository.acceptInvitation({
      companyId: "company/1",
      token: "invite/1",
      email: "new@appquilar.test",
      password: "secret",
      firstName: "Ana",
      lastName: "Lopez",
    });

    await expect(siteRepository.getById("site/1")).resolves.toEqual({
      id: "site-1",
      name: "Main",
      title: "Appquilar",
      url: "https://appquilar.test",
      description: null,
      logoId: null,
      faviconId: null,
      primaryColor: "#4F46E5",
      categoryIds: ["category-1"],
      menuCategoryIds: ["category-2"],
      featuredCategoryIds: ["category-3"],
    });

    expect(apiClient.get).toHaveBeenCalledWith(
      "/api/companies/company%2F1/invitations/invite%2F1",
      {
        headers: { Authorization: "Bearer jwt-token" },
      }
    );
    expect(apiClient.get).toHaveBeenCalledWith("/api/sites/site%2F1", {
      headers: { Authorization: "Bearer jwt-token" },
    });

    await siteRepository.update({
      id: "site/1",
      name: "Main",
      title: "Appquilar Pro",
      url: "https://pro.appquilar.test",
      description: "Marketplace",
      logoId: "logo-1",
      faviconId: "fav-1",
      primaryColor: "#000000",
      categoryIds: ["category-1"],
      menuCategoryIds: ["category-2"],
      featuredCategoryIds: ["category-3"],
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/companies/company%2F1/invitations/invite%2F1/accept",
      {
        email: "new@appquilar.test",
        password: "secret",
        first_name: "Ana",
        last_name: "Lopez",
      },
      {
        headers: {
          Authorization: "Bearer jwt-token",
        },
        skipParseJson: true,
      }
    );
    expect(apiClient.patch).toHaveBeenCalledWith(
      "/api/sites/site%2F1",
      {
        site_id: "site/1",
        name: "Main",
        title: "Appquilar Pro",
        url: "https://pro.appquilar.test",
        description: "Marketplace",
        logo_id: "logo-1",
        favicon_id: "fav-1",
        primary_color: "#000000",
        category_ids: ["category-1"],
        menu_category_ids: ["category-2"],
        featured_category_ids: ["category-3"],
      },
      {
        headers: { Authorization: "Bearer jwt-token" },
      }
    );
  });

  it("uploads, deletes and downloads media with auth handling", async () => {
    const apiClient = createApiClientMock();
    apiClient.post
      .mockResolvedValueOnce({
        success: true,
        data: {
          image_id: "image-1",
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {},
      });
    apiClient.delete.mockResolvedValue(undefined);
    const blob = new Blob(["image"], { type: "image/png" });
    apiClient.get.mockResolvedValue(blob);

    const repository = new ApiMediaRepository(
      apiClient as never,
      () => createAuthSession({ token: "jwt-token" })
    );

    const imageId = await repository.uploadImage(new File(["test"], "photo.png", { type: "image/png" }));

    expect(imageId).toBe("image-1");
    await repository.deleteImage("image-1");
    await expect(repository.downloadImage("image-1", "MEDIUM")).resolves.toBe(blob);
    await expect(
      repository.uploadImage(new File(["bad"], "bad.png", { type: "image/png" }))
    ).rejects.toThrow("Image upload response did not contain image_id");

    expect(apiClient.delete).toHaveBeenCalledWith("/api/media/images/image-1", undefined, {
      headers: {
        Authorization: "Bearer jwt-token",
      },
    });
    expect(apiClient.get).toHaveBeenCalledWith("/api/media/images/image-1/MEDIUM", {
      headers: {
        Authorization: "Bearer jwt-token",
      },
      format: "blob",
    });
  });

  it("omits optional admin filters and invitation payload fields when they are absent", async () => {
    const apiClient = createApiClientMock();
    apiClient.get.mockResolvedValue({
      success: true,
      data: [],
      total: 0,
      page: 1,
    });
    apiClient.post.mockResolvedValue(undefined);

    const adminRepository = new ApiCompanyAdminRepository(apiClient as never, () => null);
    const invitationRepository = new ApiCompanyInvitationRepository(apiClient as never, () => null);

    await expect(adminRepository.listCompanies()).resolves.toEqual({
      companies: [],
      total: 0,
      page: 1,
    });

    await invitationRepository.acceptInvitation({
      companyId: "company-1",
      token: "invite-1",
    });

    expect(apiClient.get).toHaveBeenCalledWith("/api/companies", {
      headers: {},
    });
    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/companies/company-1/invitations/invite-1/accept",
      {},
      {
        headers: {},
        skipParseJson: true,
      }
    );
  });
});
