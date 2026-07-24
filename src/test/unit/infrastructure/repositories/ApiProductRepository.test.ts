import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiProductRepository } from "@/infrastructure/repositories/ApiProductRepository";

describe("ApiProductRepository", () => {
    const createApiClientMock = () => ({
        get: vi.fn(),
        post: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
    });

    let apiClient: ReturnType<typeof createApiClientMock>;

    beforeEach(() => {
        apiClient = createApiClientMock();
    });

    it("keeps top-level available dynamic filters from public search responses", async () => {
        apiClient.get.mockResolvedValue({
            success: true,
            data: [
                {
                    id: "product-1",
                    name: "Castillo inflable",
                    slug: "castillo-inflable",
                    description: "Pues un castillo tremendo",
                    publication_status: "published",
                    image_ids: [],
                    categories: [
                        {
                            id: "category-1",
                            name: "Inflables",
                            slug: "inflables",
                        },
                    ],
                    dynamic_properties: {
                        capacidad_personas: 20,
                    },
                },
            ],
            total: 1,
            page: 1,
            available_dynamic_filters: [
                {
                    code: "capacidad_personas",
                    label: "Capacidad",
                    type: "integer",
                    range: {
                        min: 10,
                        max: 30,
                    },
                },
            ],
        });

        const repository = new ApiProductRepository(
            apiClient as unknown as ConstructorParameters<typeof ApiProductRepository>[0],
            () => null
        );

        const result = await repository.search({
            categories: ["category-1"],
            page: 1,
            per_page: 50,
        });

        expect(apiClient.get).toHaveBeenCalledWith(
            "/api/products/search?page=1&per_page=50&categories%5B%5D=category-1"
        );
        expect(result.total).toBe(1);
        expect(result.page).toBe(1);
        expect(result.data).toHaveLength(1);
        expect(result.availableDynamicFilters).toEqual([
            {
                code: "capacidad_personas",
                label: "Capacidad",
                type: "integer",
                unit: null,
                options: undefined,
                range: {
                    min: 10,
                    max: 30,
                },
                selectedRange: undefined,
            },
        ]);
    });

    it("defaults omitted public inventory fields to unmanaged inventory", async () => {
        apiClient.get.mockResolvedValue({
            success: true,
            data: [
                {
                    id: "product-1",
                    name: "Silla plegable",
                    slug: "silla-plegable",
                    description: "Sin campos de inventario público",
                    publication_status: "published",
                    image_ids: [],
                    categories: [
                        {
                            id: "category-1",
                            name: "Eventos",
                            slug: "eventos",
                        },
                    ],
                },
            ],
            total: 1,
            page: 1,
        });

        const repository = new ApiProductRepository(
            apiClient as unknown as ConstructorParameters<typeof ApiProductRepository>[0],
            () => null
        );

        const result = await repository.search({
            page: 1,
            per_page: 50,
        });

        expect(result.data[0].isInventoryEnabled).toBe(false);
        expect(result.data[0].inventoryMode).toBe("unmanaged");
    });

    it("does not forward auth headers on public search even when a session exists", async () => {
        apiClient.get.mockResolvedValue({
            success: true,
            data: [],
            total: 0,
            page: 1,
        });

        const repository = new ApiProductRepository(
            apiClient as unknown as ConstructorParameters<typeof ApiProductRepository>[0],
            () => ({
                token: "jwt-token",
                userId: null,
                roles: [],
                expiresAt: null,
            })
        );

        await repository.search({ page: 1, per_page: 20 });

        expect(apiClient.get).toHaveBeenCalledWith(
            "/api/products/search?page=1&per_page=20"
        );
    });

    it("serializes multi-status owner filters as a comma-separated query param", async () => {
        apiClient.get.mockResolvedValue({
            success: true,
            data: {
                data: [],
                total: 0,
                page: 1,
            },
        });

        const repository = new ApiProductRepository(
            apiClient as unknown as ConstructorParameters<typeof ApiProductRepository>[0],
            () => null
        );

        await repository.listByOwnerPaginated("owner-1", "company", 2, 10, {
            publicationStatus: ["draft", "published"],
        });

        expect(apiClient.get).toHaveBeenCalledWith(
            "/api/companies/owner-1/products?page=2&per_page=10&publicationStatus=draft%2Cpublished",
            { headers: {} }
        );
    });

    it("loads owner product summaries from the dedicated summary endpoints", async () => {
        apiClient.get.mockResolvedValueOnce({
            data: {
                total: 9,
                draft: 2,
                published: 5,
                archived: 2,
                active: 5,
            },
        });

        const repository = new ApiProductRepository(
            apiClient as unknown as ConstructorParameters<typeof ApiProductRepository>[0],
            () => null
        );

        await expect(repository.getOwnerSummary("owner-1", "user")).resolves.toEqual({
            total: 9,
            draft: 2,
            published: 5,
            archived: 2,
            active: 5,
        });

        expect(apiClient.get).toHaveBeenCalledWith(
            "/api/users/owner-1/products/summary",
            { headers: {} }
        );
    });

    it("sends auth headers when loading a dashboard product by id", async () => {
        apiClient.get.mockResolvedValueOnce({
            success: true,
            data: {
                id: "product-1",
                name: "Castillo inflable",
                slug: "castillo-inflable",
                description: "Inflable para fiestas",
                publication_status: "draft",
                image_ids: [],
                categories: [],
            },
        });

        const repository = new ApiProductRepository(
            apiClient as unknown as ConstructorParameters<typeof ApiProductRepository>[0],
            () => ({
                token: "jwt-token",
                userId: null,
                roles: [],
                expiresAt: null,
            })
        );

        await expect(repository.getById("product-1")).resolves.toMatchObject({
            id: "product-1",
            slug: "castillo-inflable",
        });

        expect(apiClient.get).toHaveBeenCalledWith(
            "/api/products/product-1",
            {
                headers: {
                    Authorization: "Bearer jwt-token",
                },
            }
        );
    });

    it("sends auth headers when loading a public product by slug", async () => {
        apiClient.get.mockResolvedValueOnce({
            success: true,
            data: {
                id: "product-1",
                name: "Castillo inflable",
                slug: "castillo-inflable",
                description: "Inflable para fiestas",
                publication_status: "draft",
                image_ids: [],
                categories: [],
            },
        });

        const repository = new ApiProductRepository(
            apiClient as unknown as ConstructorParameters<typeof ApiProductRepository>[0],
            () => ({
                token: "jwt-token",
                userId: null,
                roles: [],
                expiresAt: null,
            })
        );

        await expect(repository.getBySlug("castillo-inflable")).resolves.toMatchObject({
            id: "product-1",
            publicationStatus: "draft",
        });

        expect(apiClient.get).toHaveBeenCalledWith(
            "/api/products/castillo-inflable",
            {
                headers: {
                    Authorization: "Bearer jwt-token",
                },
            }
        );
    });

    it("uses DELETE for product removal", async () => {
        apiClient.delete.mockResolvedValue(undefined);

        const repository = new ApiProductRepository(
            apiClient as unknown as ConstructorParameters<typeof ApiProductRepository>[0],
            () => ({
                token: "jwt-token",
                userId: null,
                roles: [],
                expiresAt: null,
            })
        );

        await expect(repository.deleteProduct("product-1")).resolves.toBe(true);

        expect(apiClient.delete).toHaveBeenCalledWith(
            "/api/products/product-1",
            undefined,
            {
                headers: { Authorization: "Bearer jwt-token" },
                skipParseJson: true,
            }
        );
    });

    it("creates products with a generated id and inventory-aware dto fields", async () => {
        const randomUuidSpy = vi
            .spyOn(globalThis.crypto, "randomUUID")
            .mockReturnValue("00000000-0000-4000-8000-000000000123");
        apiClient.post.mockResolvedValue(undefined);
        apiClient.get.mockResolvedValueOnce({
            data: {
                id: "00000000-0000-4000-8000-000000000123",
                name: "Taladro",
                slug: "taladro",
                description: "Taladro percutor",
                quantity: 4,
                is_inventory_enabled: true,
                inventory_mode: "managed_serialized",
                publication_status: "published",
                image_ids: ["image-1"],
                categories: [{ id: "category-1", name: "Herramientas", slug: "herramientas" }],
            },
        });

        const repository = new ApiProductRepository(
            apiClient as unknown as ConstructorParameters<typeof ApiProductRepository>[0],
            () => null
        );

        await repository.createProduct({
            id: "",
            name: "Taladro",
            slug: "taladro",
            internalId: "",
            description: "Taladro percutor",
            quantity: 4,
            inventoryMode: "managed_serialized",
            companyId: "company-1",
            categoryId: "category-1",
            dynamicProperties: {
                potencia: 900,
            },
            images: [
                {
                    id: "image-1",
                },
            ],
            price: {
                daily: 0,
                deposit: 120,
                tiers: [
                    {
                        daysFrom: 1,
                        daysTo: 3,
                        pricePerDay: 30,
                    },
                ],
            },
            publicationStatus: "published",
        } as never);

        expect(apiClient.post).toHaveBeenCalledWith(
            "/api/products",
            {
                product_id: "00000000-0000-4000-8000-000000000123",
                name: "Taladro",
                slug: "taladro",
                internal_id: "taladro",
                description: "Taladro percutor",
                is_rental_enabled: true,
                inventory_mode: "managed_serialized",
                is_inventory_enabled: true,
                company_id: "company-1",
                category_id: "category-1",
                image_ids: ["image-1"],
                dynamic_properties: {
                    potencia: 900,
                },
                deposit: {
                    amount: 12000,
                    currency: "EUR",
                },
                tiers: [
                    {
                        price_per_day: {
                            amount: 3000,
                            currency: "EUR",
                        },
                        days_from: 1,
                        days_to: 3,
                    },
                ],
                quantity: 4,
                publication_status: "published",
            },
            {
                headers: {},
            }
        );

        randomUuidSpy.mockRestore();
    });

    it("maps product reads, inventory state and availability helpers", async () => {
        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        apiClient.get
            .mockResolvedValueOnce({
                data: {
                    id: "product-1",
                    internal_id: "P-001",
                    name: "Escenario",
                    slug: "escenario",
                    description: "Escenario modular",
                    quantity: 6,
                    publication_status: {
                        status: "published",
                    },
                    image_ids: ["image-1"],
                    categories: [
                        {
                            id: "category-1",
                            name: "Eventos",
                            slug: "eventos",
                        },
                    ],
                    tiers: [
                        {
                            days_from: 1,
                            days_to: 2,
                            price_per_day: {
                                amount: 5000,
                            },
                        },
                    ],
                    deposit: {
                        amount: 25000,
                    },
                    inventory_summary: {
                        product_id: "product-1",
                        product_internal_id: "P-001",
                        total_quantity: 6,
                        reserved_quantity: 2,
                        available_quantity: 4,
                        is_inventory_enabled: true,
                        is_rental_enabled: true,
                        capability_state: "enabled",
                        inventory_mode: "managed_serialized",
                        is_rentable_now: true,
                        unavailability_reason: null,
                    },
                    owner_data: {
                        owner_id: "company-1",
                        type: "company",
                        name: "Acme",
                        last_name: "Rentals",
                        slug: "acme",
                        address: {
                            street: "Calle 1",
                            city: "Madrid",
                            postal_code: "28001",
                            state: "Madrid",
                            country: "ES",
                        },
                        geo_location: {
                            latitude: 40.4,
                            longitude: -3.7,
                            circle: [{ latitude: 40.4, longitude: -3.7 }],
                        },
                    },
                },
            })
            .mockResolvedValueOnce({
                success: true,
                data: {
                    product_id: "product-2",
                    name: "Foco",
                    slug: "foco",
                    status: "draft",
                    is_inventory_enabled: true,
                    quantity: 2,
                },
            })
            .mockResolvedValueOnce({
                success: true,
                data: {
                    product_id: "product-1",
                    start_date: "2026-01-10",
                    end_date: "2026-01-12",
                    requested_quantity: 2,
                    days: 3,
                    price_per_day: {
                        amount: 1000,
                        currency: "EUR",
                    },
                    rental_price: {
                        amount: 3000,
                        currency: "EUR",
                    },
                    deposit: {
                        amount: 2000,
                        currency: "EUR",
                    },
                    total_price: {
                        amount: 5000,
                        currency: "EUR",
                    },
                },
            })
            .mockResolvedValueOnce({
                success: true,
                data: {
                    can_request: true,
                    status: "available",
                    message: "Disponible",
                    managed_by_platform: true,
                },
            })
            .mockResolvedValueOnce({
                success: true,
                data: {
                    product_id: "product-1",
                    product_internal_id: "P-001",
                    total_quantity: 8,
                    reserved_quantity: 3,
                    available_quantity: 5,
                    is_inventory_enabled: true,
                    is_rental_enabled: true,
                    capability_state: "read_only",
                    is_rentable_now: false,
                    unavailability_reason: "out_of_stock",
                },
            })
            .mockResolvedValueOnce({
                success: true,
                data: [
                    {
                        allocation_id: "allocation-1",
                        rent_id: "rent-1",
                        product_id: "product-1",
                        product_internal_id: "P-001",
                        allocated_quantity: 2,
                        assigned_unit_ids: ["unit-1", 2],
                        state: "reserved",
                        starts_at: "2026-01-10",
                        ends_at: "2026-01-12",
                        created_at: "2026-01-01",
                    },
                ],
            })
            .mockResolvedValueOnce({
                success: true,
                data: {
                    data: [
                        {
                            unit_id: "unit-1",
                            product_id: "product-1",
                            code: "A-1",
                            status: "reserved",
                            sort_order: 4,
                            next_allocation: {
                                rent_id: "rent-1",
                                starts_at: "2026-01-10",
                                ends_at: "2026-01-12",
                                state: "reserved",
                            },
                        },
                    ],
                },
            })
            .mockRejectedValueOnce(new Error("missing"))
            .mockRejectedValueOnce(new Error("no inventory"))
            .mockRejectedValueOnce(new Error("no allocations"))
            .mockRejectedValueOnce(new Error("no units"));
        apiClient.patch.mockResolvedValueOnce({
            success: true,
            data: {
                unit_id: "unit-1",
                product_id: "product-1",
                code: "A-2",
                status: "maintenance",
                sort_order: 5,
            },
        });

        const repository = new ApiProductRepository(
            apiClient as unknown as ConstructorParameters<typeof ApiProductRepository>[0],
            () => ({
                token: "jwt-token",
                userId: null,
                roles: [],
                expiresAt: null,
            })
        );

        const product = await repository.getById("product-1");
        const productBySlug = await repository.getBySlug("foco");
        const rentalCost = await repository.calculateRentalCost("product-1", "2026-01-10", "2026-01-12", 0);
        const availability = await repository.checkAvailability("product-1", "2026-01-10", "2026-01-12", 0);
        const inventorySummary = await repository.getInventorySummary("product-1");
        const allocations = await repository.getInventoryAllocations("product-1");
        const units = await repository.getInventoryUnits("product-1");
        const updatedUnit = await repository.updateInventoryUnit("product-1", "unit-1", {
            code: "A-2",
            status: "maintenance",
        });
        const missingProduct = await repository.getById("missing");
        const missingSummary = await repository.getInventorySummary("missing");
        const missingAllocations = await repository.getInventoryAllocations("missing");
        const missingUnits = await repository.getInventoryUnits("missing");

        expect(product).toMatchObject({
            id: "product-1",
            slug: "escenario",
            publicationStatus: "published",
            inventoryMode: "managed_serialized",
            imageUrl: "http://localhost:8000/api/media/images/image-1/MEDIUM",
            thumbnailUrl: "http://localhost:8000/api/media/images/image-1/THUMBNAIL",
            price: {
                daily: 50,
                deposit: 250,
            },
            ownerData: {
                ownerId: "company-1",
                lastName: "Rentals",
            },
        });
        expect(productBySlug).toMatchObject({
            id: "product-2",
            publicationStatus: "draft",
            inventoryMode: "managed_serialized",
        });
        expect(rentalCost).toEqual({
            productId: "product-1",
            startDate: "2026-01-10",
            endDate: "2026-01-12",
            requestedQuantity: 2,
            days: 3,
            pricePerDay: {
                amount: 1000,
                currency: "EUR",
            },
            rentalPrice: {
                amount: 3000,
                currency: "EUR",
            },
            deposit: {
                amount: 2000,
                currency: "EUR",
            },
            totalPrice: {
                amount: 5000,
                currency: "EUR",
            },
        });
        expect(availability).toEqual({
            canRequest: true,
            status: "available",
            message: "Disponible",
            managedByPlatform: true,
        });
        expect(inventorySummary).toMatchObject({
            availableQuantity: 5,
            capabilityState: "read_only",
            inventoryMode: "managed_serialized",
            unavailabilityReason: "out_of_stock",
        });
        expect(allocations).toEqual([
            {
                allocationId: "allocation-1",
                rentId: "rent-1",
                productId: "product-1",
                productInternalId: "P-001",
                allocatedQuantity: 2,
                assignedUnitIds: ["unit-1", "2"],
                state: "reserved",
                startsAt: "2026-01-10",
                endsAt: "2026-01-12",
                createdAt: "2026-01-01",
                releasedAt: null,
            },
        ]);
        expect(units).toEqual([
            {
                unitId: "unit-1",
                productId: "product-1",
                code: "A-1",
                status: "reserved",
                sortOrder: 4,
                nextAllocation: {
                    rentId: "rent-1",
                    startsAt: "2026-01-10",
                    endsAt: "2026-01-12",
                    state: "reserved",
                },
            },
        ]);
        expect(updatedUnit).toEqual({
            unitId: "unit-1",
            productId: "product-1",
            code: "A-2",
            status: "maintenance",
            sortOrder: 5,
            nextAllocation: null,
        });
        expect(missingProduct).toBeNull();
        expect(missingSummary).toBeNull();
        expect(missingAllocations).toEqual([]);
        expect(missingUnits).toEqual([]);
        expect(apiClient.get).toHaveBeenNthCalledWith(
            3,
            "/api/products/product-1/rental-cost?start_date=2026-01-10&end_date=2026-01-12&quantity=1",
            {
                headers: {
                    Authorization: "Bearer jwt-token",
                },
            }
        );

        consoleErrorSpy.mockRestore();
    });

    it("rejects updateProduct when the publish status transition fails", async () => {
        apiClient.patch
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error("publish limit reached"));
        apiClient.post.mockResolvedValueOnce(undefined);

        const repository = new ApiProductRepository(
            apiClient as unknown as ConstructorParameters<typeof ApiProductRepository>[0],
            () => null
        );

        await expect(
            repository.updateProduct("product-11", {
                name: "Escenario",
                slug: "escenario",
                internalId: "ESC-001",
                description: "Escenario modular",
                quantity: 6,
                inventoryMode: "managed_serialized",
                companyId: "company-1",
                categoryId: "category-1",
                dynamicProperties: {},
                images: [],
                price: {
                    daily: 0,
                    deposit: 0,
                    tiers: [],
                },
                publicationStatus: "published",
            } as never)
        ).rejects.toThrow("publish limit reached");

        expect(apiClient.patch).toHaveBeenNthCalledWith(
            1,
            "/api/products/product-11",
            expect.any(Object),
            { headers: {} }
        );
        expect(apiClient.patch).toHaveBeenNthCalledWith(
            2,
            "/api/products/product-11/publish",
            {},
            { headers: {} }
        );
    });

    it("updates products, applies status transitions and falls back on listing errors", async () => {
        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        apiClient.get
            .mockResolvedValueOnce({
                success: true,
                data: {
                    data: [
                        {
                            id: "product-1",
                            name: "Taladro",
                            slug: "taladro",
                        },
                    ],
                    total: 1,
                    page: 2,
                },
            })
            .mockRejectedValueOnce(new Error("list failed"))
            .mockResolvedValueOnce({
                success: true,
                data: [
                    {
                        id: "product-3",
                        name: "Escalera",
                        slug: "escalera",
                    },
                ],
            })
            .mockResolvedValueOnce({
                success: true,
                data: {
                    id: "product-1",
                    name: "Taladro actualizado",
                    slug: "taladro-actualizado",
                    quantity: 10,
                    publication_status: "published",
                },
            })
            .mockResolvedValueOnce({
                success: true,
                data: {
                    id: "product-2",
                    name: "Archivo",
                    slug: "archivo",
                    quantity: 1,
                    publication_status: "archived",
                },
            });
        apiClient.patch
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error("status failure"));
        apiClient.post.mockResolvedValue(undefined);

        const repository = new ApiProductRepository(
            apiClient as unknown as ConstructorParameters<typeof ApiProductRepository>[0],
            () => null
        );

        const listed = await repository.listByOwnerPaginated("user-1", "user", 2, 20, {
            name: "Taladro",
            id: "product-1",
            internalId: "P-001",
            categoryId: "category-1",
            publicationStatus: "draft",
        });
        const failedList = await repository.listByOwnerPaginated("company-1", "company", 1, 10);
        const categoryProducts = await repository.getProductsByCategoryId("category-1");
        const updated = await repository.updateProduct("product-1", {
            name: "Taladro actualizado",
            slug: "taladro-actualizado",
            internalId: "P-001",
            description: "Nueva descripcion",
            quantity: 10,
            inventoryMode: "unmanaged",
            companyId: "company-1",
            categoryId: "category-1",
            dynamicProperties: {},
            images: [],
            price: {
                daily: 0,
                deposit: 0,
                tiers: [],
            },
            publicationStatus: "published",
        } as never);
        const archived = await repository.updateProduct("product-2", {
            name: "Archivo",
            slug: "archivo",
            internalId: "P-002",
            description: "Archivado",
            quantity: 1,
            inventoryMode: "unmanaged",
            companyId: "company-1",
            categoryId: "category-1",
            dynamicProperties: {},
            images: [],
            price: {
                daily: 0,
                deposit: 0,
                tiers: [],
            },
            publicationStatus: "archived",
        } as never);
        const published = await repository.publishProduct("product-3");

        expect(listed.total).toBe(1);
        expect(listed.page).toBe(2);
        expect(failedList).toEqual({
            data: [],
            total: 0,
            page: 1,
        });
        expect(categoryProducts).toHaveLength(1);
        expect(updated?.publicationStatus).toBe("published");
        expect(archived?.publicationStatus).toBe("archived");
        expect(published).toBe(true);
        await expect(repository.publishProduct("product-4")).rejects.toThrow("status failure");
        expect(apiClient.get).toHaveBeenNthCalledWith(
            1,
            "/api/users/user-1/products?page=2&per_page=20&name=Taladro&id=product-1&internalId=P-001&categoryId=category-1&publicationStatus=draft",
            { headers: {} }
        );
        expect(apiClient.patch).toHaveBeenCalledWith(
            "/api/products/product-1/publish",
            {},
            { headers: {} }
        );
        expect(apiClient.patch).toHaveBeenCalledWith(
            "/api/products/product-2/archive",
            {},
            { headers: {} }
        );

        consoleErrorSpy.mockRestore();
    });

    it("builds search filters for dynamic properties and handles wrapped payload metadata", async () => {
        apiClient.get.mockResolvedValue({
            success: true,
            data: {
                data: [
                    {
                        product_id: "product-5",
                        name: "Carpa",
                        slug: "carpa",
                        dynamic_properties: ["ignored"],
                        publication_status: "published",
                        inventory_mode: "unmanaged",
                    },
                ],
                total: 1,
                page: 3,
                available_dynamic_filters: [
                    {
                        code: "capacidad",
                        label: "Capacidad",
                        type: "integer",
                        options: [
                            {
                                value: "100",
                                count: 2,
                            },
                        ],
                        range: {
                            min: 50,
                            max: 300,
                        },
                        selected_range: {
                            min: 100,
                            max: null,
                        },
                    },
                ],
            },
        });

        const repository = new ApiProductRepository(
            apiClient as unknown as ConstructorParameters<typeof ApiProductRepository>[0],
            () => null
        );

        const result = await repository.search({
            text: "carpa",
            latitude: 40.4,
            longitude: -3.7,
            radius: 20,
            page: 3,
            per_page: 12,
            categories: ["cat-1", "cat-2"],
            property_values: {
                color: ["rojo", "azul"],
            },
            property_ranges: {
                capacidad: {
                    min: 100,
                    max: 300,
                },
                precio: {
                    min: 10,
                },
            },
        });

        expect(apiClient.get).toHaveBeenCalledWith(
            "/api/products/search?text=carpa&latitude=40.4&longitude=-3.7&radius=20&page=3&per_page=12&categories%5B%5D=cat-1&categories%5B%5D=cat-2&property_values%5Bcolor%5D%5B%5D=rojo&property_values%5Bcolor%5D%5B%5D=azul&property_ranges%5Bcapacidad%5D%5Bmin%5D=100&property_ranges%5Bcapacidad%5D%5Bmax%5D=300&property_ranges%5Bprecio%5D%5Bmin%5D=10"
        );
        expect(result).toEqual({
            data: [
                expect.objectContaining({
                    id: "product-5",
                    dynamicProperties: undefined,
                }),
            ],
            total: 1,
            page: 3,
            availableDynamicFilters: [
                {
                    code: "capacidad",
                    label: "Capacidad",
                    type: "integer",
                    unit: null,
                    options: [
                        {
                            value: "100",
                            label: "100",
                            count: 2,
                            selected: false,
                        },
                    ],
                    range: {
                        min: 50,
                        max: 300,
                    },
                    selectedRange: {
                        min: 100,
                        max: null,
                    },
                },
            ],
        });
    });

    it("delegates convenience methods and covers draft status refresh failures", async () => {
        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        apiClient.patch.mockResolvedValue(undefined);
        apiClient.post.mockResolvedValue(undefined);
        apiClient.get.mockResolvedValueOnce({
            success: true,
            data: {
                id: "company-product",
                name: "Taladro",
                slug: "taladro",
            },
        });

        const repository = new ApiProductRepository(
            apiClient as unknown as ConstructorParameters<typeof ApiProductRepository>[0],
            () => null
        );

        const searchSpy = vi.spyOn(repository, "search").mockResolvedValue({
            data: [{ id: "all-product" } as never],
            total: 1,
            page: 1,
        });
        const listSpy = vi
            .spyOn(repository, "listByOwnerPaginated")
            .mockResolvedValueOnce({
                data: [{ id: "company-product" } as never],
                total: 1,
                page: 1,
            })
            .mockResolvedValueOnce({
                data: [{ id: "owner-product" } as never],
                total: 1,
                page: 1,
            });
        const getByIdSpy = vi
            .spyOn(repository, "getById")
            .mockResolvedValueOnce({ id: "product-9", publicationStatus: "published" } as never)
            .mockResolvedValueOnce({ id: "product-9", publicationStatus: "published" } as never)
            .mockResolvedValueOnce(null);

        await expect(repository.getAllProducts()).resolves.toEqual([{ id: "all-product" }]);
        await expect(repository.getProductById("product-9")).resolves.toEqual({
            id: "product-9",
            publicationStatus: "published",
        });
        await expect(repository.getProductsByCompanyId("company-1")).resolves.toEqual([
            { id: "company-product" },
        ]);
        await expect(repository.listByOwner("owner-1")).resolves.toEqual([
            { id: "owner-product" },
        ]);

        await expect(
            repository.updateProduct("product-9", {
                name: "Borrador",
                slug: "borrador",
                internalId: "B-1",
                description: "Draft",
                quantity: 1,
                inventoryMode: "unmanaged",
                companyId: "company-1",
                categoryId: "category-1",
                dynamicProperties: {},
                images: [],
                price: {
                    daily: 0,
                    deposit: 0,
                    tiers: [],
                },
                publicationStatus: "draft",
            } as never)
        ).resolves.toEqual({
            id: "product-9",
            publicationStatus: "published",
        });

        await expect(
            repository.updateProduct("product-10", {
                name: "Sin refresh",
                slug: "sin-refresh",
                internalId: "B-2",
                description: "Draft",
                quantity: 1,
                inventoryMode: "unmanaged",
                companyId: "company-1",
                categoryId: "category-1",
                dynamicProperties: {},
                images: [],
                price: {
                    daily: 0,
                    deposit: 0,
                    tiers: [],
                },
                publicationStatus: undefined,
            } as never)
        ).rejects.toThrow("Failed to retrieve updated product");

        expect(searchSpy).toHaveBeenCalledWith({ page: 1, per_page: 50 });
        expect(listSpy).toHaveBeenNthCalledWith(1, "company-1", "company", 1, 100);
        expect(listSpy).toHaveBeenNthCalledWith(2, "owner-1", "company", 1, 100);
        expect(apiClient.patch).toHaveBeenCalledWith(
            "/api/products/product-9/unpublish",
            {},
            { headers: {} }
        );
        expect(getByIdSpy).toHaveBeenNthCalledWith(1, "product-9");
        expect(getByIdSpy).toHaveBeenNthCalledWith(2, "product-9");
        expect(getByIdSpy).toHaveBeenNthCalledWith(3, "product-10");

        consoleErrorSpy.mockRestore();
    });
});
