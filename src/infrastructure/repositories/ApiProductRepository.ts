import {
    InventoryAllocation,
    InventoryUnit,
    Product,
    ProductFormData,
    ProductPublicAvailability,
    ProductInventorySummary,
    PublicationStatusType
} from '@/domain/models/Product';
import type {
    AvailableDynamicFilter,
    AvailableDynamicFilterOption,
    ProductDynamicProperties,
} from '@/domain/models/DynamicProperty';
import {
    ProductRepository,
    ProductSearchCriteria,
    ProductListResponse,
    ProductFilters,
    ProductOwnerSummary,
    RentalCostBreakdown
} from '@/domain/repositories/ProductRepository';
import { ApiClient } from '@/infrastructure/http/ApiClient';
import { AuthSession } from '@/domain/models/AuthSession';

export class ApiProductRepository implements ProductRepository {
    private client: ApiClient;
    private getSession: () => AuthSession | null;
    private baseUrl: string;

    constructor(client: ApiClient, getSession: () => AuthSession | null) {
        this.client = client;
        this.getSession = getSession;
        this.baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    }

    private getAuthHeaders(): Record<string, string> {
        const session = this.getSession();
        if (session?.token) {
            return { Authorization: `Bearer ${session.token}` };
        }
        return {};
    }

    private unwrapCollectionPayload<T>(response: T): T | any {
        if (!response || typeof response !== "object") {
            return response;
        }

        const payload = response as Record<string, unknown>;
        const hasWrappedData = payload.success !== undefined && payload.data !== undefined;
        if (!hasWrappedData) {
            return response;
        }

        const hasTopLevelCollectionMetadata =
            Array.isArray(payload.data)
            || typeof payload.total === "number"
            || typeof payload.page === "number"
            || typeof payload.per_page === "number"
            || Array.isArray(payload.available_dynamic_filters);

        return hasTopLevelCollectionMetadata ? response : payload.data;
    }

    private unwrapListPayload<T>(response: unknown): T[] {
        if (Array.isArray(response)) {
            return response as T[];
        }

        if (!response || typeof response !== "object") {
            return [];
        }

        const payload = response as Record<string, unknown>;
        if (Array.isArray(payload.data)) {
            return payload.data as T[];
        }

        if (!payload.data || typeof payload.data !== "object") {
            return [];
        }

        const nestedPayload = payload.data as Record<string, unknown>;
        return Array.isArray(nestedPayload.data) ? (nestedPayload.data as T[]) : [];
    }

    private resolveInventoryMode(apiData: any): "unmanaged" | "managed_serialized" {
        const explicitMode = apiData.inventory_mode ?? apiData.inventory_summary?.inventory_mode;
        const inventoryEnabled = apiData.is_inventory_enabled ?? apiData.inventory_summary?.is_inventory_enabled ?? false;

        if (explicitMode === "managed_serialized") {
            return "managed_serialized";
        }

        if (explicitMode === "unmanaged") {
            return "unmanaged";
        }

        return inventoryEnabled ? "managed_serialized" : "unmanaged";
    }

    async search(criteria: ProductSearchCriteria): Promise<ProductListResponse> {
        const queryParams = new URLSearchParams();
        if (criteria.text) queryParams.append('text', criteria.text);
        if (criteria.latitude !== undefined) queryParams.append('latitude', criteria.latitude.toString());
        if (criteria.longitude !== undefined) queryParams.append('longitude', criteria.longitude.toString());
        if (criteria.radius !== undefined) queryParams.append('radius', criteria.radius.toString());
        if (criteria.page) queryParams.append('page', criteria.page.toString());
        if (criteria.per_page) queryParams.append('per_page', criteria.per_page.toString());
        if (criteria.categories?.length) {
            criteria.categories.forEach(c => queryParams.append('categories[]', c));
        }
        if (criteria.property_values) {
            Object.entries(criteria.property_values).forEach(([code, values]) => {
                values.forEach((value) => queryParams.append(`property_values[${code}][]`, value));
            });
        }
        if (criteria.property_ranges) {
            Object.entries(criteria.property_ranges).forEach(([code, range]) => {
                if (range.min !== undefined) {
                    queryParams.append(`property_ranges[${code}][min]`, range.min.toString());
                }
                if (range.max !== undefined) {
                    queryParams.append(`property_ranges[${code}][max]`, range.max.toString());
                }
            });
        }

        try {
            const response = await this.client.get<{ data: any[], total: number, page: number, available_dynamic_filters?: any[] }>(
                `/api/products/search?${queryParams.toString()}`
            );

            const payload = this.unwrapCollectionPayload(response);

            const items = Array.isArray(payload.data) ? payload.data : (Array.isArray(payload) ? payload : []);

            return {
                data: items.map((item: any) => this.mapToDomain(item)),
                total: payload.total || items.length,
                page: payload.page || 1,
                availableDynamicFilters: Array.isArray(payload.available_dynamic_filters)
                    ? payload.available_dynamic_filters.map((filter: any) => this.mapAvailableDynamicFilter(filter))
                    : [],
            };
        } catch (error) {
            console.error('Search failed', error);
            return { data: [], total: 0, page: 1 };
        }
    }

    async getAllProducts(): Promise<Product[]> {
        const result = await this.search({ page: 1, per_page: 50 });
        return result.data;
    }

    async getById(id: string): Promise<Product | null> {
        try {
            const response = await this.client.get<any>(
                `/api/products/${id}`,
                {
                    headers: this.getAuthHeaders(),
                }
            );
            const data = (response as any).data ? (response as any).data : response;
            return this.mapToDomain(data);
        } catch (error) {
            console.error(`Error fetching product ${id}`, error);
            return null;
        }
    }

    async getProductById(id: string): Promise<Product | null> {
        return this.getById(id);
    }

    async getBySlug(slug: string): Promise<Product | null> {
        try {
            const response = await this.client.get<any>(
                `/api/products/${slug}`,
                {
                    headers: this.getAuthHeaders(),
                }
            );
            const data = (response as any).data ? (response as any).data : response;
            return this.mapToDomain(data);
        } catch (error) {
            console.error(`Error fetching product slug ${slug}`, error);
            return null;
        }
    }

    async getProductsByCompanyId(companyId: string): Promise<Product[]> {
        const result = await this.listByOwnerPaginated(companyId, 'company', 1, 100);
        return result.data;
    }

    async listByOwner(ownerId: string): Promise<Product[]> {
        const result = await this.listByOwnerPaginated(ownerId, 'company', 1, 100);
        return result.data;
    }

    async listByOwnerPaginated(
        ownerId: string,
        ownerType: 'company' | 'user',
        page: number,
        perPage: number,
        filters?: ProductFilters
    ): Promise<ProductListResponse> {
        try {
            const endpoint = ownerType === 'company'
                ? `/api/companies/${ownerId}/products`
                : `/api/users/${ownerId}/products`;

            const queryParams = new URLSearchParams();
            queryParams.append('page', page.toString());
            queryParams.append('per_page', perPage.toString());

            if (filters?.name) queryParams.append('name', filters.name);
            if (filters?.id) queryParams.append('id', filters.id);
            if (filters?.internalId) queryParams.append('internalId', filters.internalId);
            if (filters?.categoryId) queryParams.append('categoryId', filters.categoryId);
            if (filters?.publicationStatus) {
                const publicationStatuses = Array.isArray(filters.publicationStatus)
                    ? filters.publicationStatus
                    : [filters.publicationStatus];

                if (publicationStatuses.length > 0) {
                    queryParams.append('publicationStatus', publicationStatuses.join(','));
                }
            }

            const response = await this.client.get<any>(`${endpoint}?${queryParams.toString()}`, {
                headers: this.getAuthHeaders()
            });

            const payload = this.unwrapCollectionPayload(response);

            const items: any[] = Array.isArray(payload?.data)
                ? payload.data
                : Array.isArray(payload?.data?.data)
                    ? payload.data.data
                    : Array.isArray(payload)
                        ? payload
                        : [];

            const total = payload?.total ?? payload?.data?.total ?? items.length;
            const currentPage = payload?.page ?? payload?.data?.page ?? 1;

            return {
                data: items.map((item: any) => this.mapToDomain(item)),
                total: total,
                page: currentPage
            };
        } catch (error) {
            console.error(`Error listing products for owner ${ownerId}`, error);
            return { data: [], total: 0, page: 1 };
        }
    }

    async getOwnerSummary(
        ownerId: string,
        ownerType: 'company' | 'user'
    ): Promise<ProductOwnerSummary> {
        const endpoint = ownerType === 'company'
            ? `/api/companies/${ownerId}/products/summary`
            : `/api/users/${ownerId}/products/summary`;

        const response = await this.client.get<any>(endpoint, {
            headers: this.getAuthHeaders(),
        });

        const payload = (response as any).data ? (response as any).data : response;

        return {
            total: Number(payload?.total ?? 0),
            draft: Number(payload?.draft ?? 0),
            published: Number(payload?.published ?? 0),
            archived: Number(payload?.archived ?? 0),
            active: Number(payload?.active ?? 0),
        };
    }

    async getProductsByCategoryId(categoryId: string): Promise<Product[]> {
        try {
            const response = await this.client.get<{ data: any[] }>(`/api/categories/${categoryId}/products`, {
                headers: this.getAuthHeaders()
            });
            const data = (response as any).data && Array.isArray((response as any).data)
                ? (response as any).data
                : ((response as any).data?.data || []);

            return data.map((item: any) => this.mapToDomain(item));
        } catch (error) {
            console.error(`Error fetching category products`, error);
            return [];
        }
    }

    async createProduct(data: ProductFormData): Promise<Product> {
        const dto = this.mapToDto(data);

        if (!dto.product_id) {
            dto.product_id = crypto.randomUUID();
        }

        dto.publication_status = data.publicationStatus;

        const response = await this.client.post<any>(
            '/api/products',
            dto,
            {
                headers: this.getAuthHeaders(),
            }
        );

        const payload = response?.data && response?.success !== undefined
            ? response.data
            : response;
        const createdProductId = payload?.product_id ?? dto.product_id;
        const createdProduct = await this.getById(createdProductId);

        if (!createdProduct) {
            throw new Error('Failed to retrieve created product');
        }

        return createdProduct;
    }

    async updateProduct(id: string, data: ProductFormData): Promise<Product> {
        const dto = this.mapToDto(data, false);

        // 1. Update basic data
        await this.client.patch(
            `/api/products/${id}`,
            dto,
            { headers: this.getAuthHeaders() }
        );

        await this.adjustInventory(id, data.quantity);

        // 2. Handle Status Transition
        if (data.publicationStatus) {
            let statusEndpoint = '';
            if (data.publicationStatus === 'published') {
                statusEndpoint = `/api/products/${id}/publish`;
            } else if (data.publicationStatus === 'draft') {
                statusEndpoint = `/api/products/${id}/unpublish`;
            } else if (data.publicationStatus === 'archived') {
                statusEndpoint = `/api/products/${id}/archive`;
            }

            if (statusEndpoint) {
                await this.client.patch(statusEndpoint, {}, { headers: this.getAuthHeaders() });
            }
        }

        const updated = await this.getById(id);
        if (!updated) throw new Error('Failed to retrieve updated product');
        return updated;
    }

    async deleteProduct(id: string): Promise<boolean> {
        await this.client.delete(
            `/api/products/${id}`,
            undefined,
            {
                headers: this.getAuthHeaders(),
                skipParseJson: true,
            }
        );

        return true;
    }

    async publishProduct(id: string): Promise<boolean> {
        await this.client.patch(
            `/api/products/${id}/publish`,
            {},
            { headers: this.getAuthHeaders() }
        );

        return true;
    }

    async calculateRentalCost(id: string, startDate: string, endDate: string, quantity: number): Promise<RentalCostBreakdown> {
        const queryParams = new URLSearchParams();
        queryParams.append('start_date', startDate);
        queryParams.append('end_date', endDate);
        queryParams.append('quantity', String(Math.max(1, quantity)));

        const response = await this.client.get<any>(
            `/api/products/${id}/rental-cost?${queryParams.toString()}`,
            { headers: this.getAuthHeaders() }
        );

        const payload = (response as any).data && (response as any).success !== undefined
            ? (response as any).data
            : response;

        return {
            productId: payload.product_id,
            startDate: payload.start_date,
            endDate: payload.end_date,
            requestedQuantity: Number(payload.requested_quantity ?? quantity ?? 1),
            days: payload.days,
            pricePerDay: payload.price_per_day,
            rentalPrice: payload.rental_price,
            deposit: payload.deposit,
            totalPrice: payload.total_price,
        };
    }

    async checkAvailability(productId: string, startDate: string, endDate: string, quantity: number): Promise<ProductPublicAvailability> {
        const queryParams = new URLSearchParams();
        queryParams.append('start_date', startDate);
        queryParams.append('end_date', endDate);
        queryParams.append('quantity', String(Math.max(1, quantity)));

        const response = await this.client.get<any>(
            `/api/products/${productId}/availability?${queryParams.toString()}`,
            { headers: this.getAuthHeaders() }
        );

        const payload = (response as any).data && (response as any).success !== undefined
            ? (response as any).data
            : response;

        return this.mapProductAvailability(payload);
    }

    async getInventorySummary(
        productId: string,
        range?: { startDate?: string | null; endDate?: string | null }
    ): Promise<ProductInventorySummary | null> {
        try {
            const queryParams = new URLSearchParams();
            if (range?.startDate) {
                queryParams.append("start_date", range.startDate);
            }
            if (range?.endDate) {
                queryParams.append("end_date", range.endDate);
            }
            const querySuffix = queryParams.toString();
            const response = await this.client.get<any>(
                `/api/products/${productId}/inventory${querySuffix ? `?${querySuffix}` : ""}`,
                { headers: this.getAuthHeaders() }
            );

            const payload = (response as any).data && (response as any).success !== undefined
                ? (response as any).data
                : response;

            return this.mapInventorySummary(payload);
        } catch (error) {
            console.error(`Error fetching inventory summary for product ${productId}`, error);
            return null;
        }
    }

    async getInventoryAllocations(productId: string): Promise<InventoryAllocation[]> {
        try {
            const response = await this.client.get<any>(
                `/api/products/${productId}/inventory/allocations`,
                { headers: this.getAuthHeaders() }
            );

            const items = this.unwrapListPayload<any>(response);
            return items.map((item: any) => this.mapInventoryAllocation(item));
        } catch (error) {
            console.error(`Error fetching inventory allocations for product ${productId}`, error);
            return [];
        }
    }

    async getInventoryUnits(productId: string): Promise<InventoryUnit[]> {
        try {
            const response = await this.client.get<any>(
                `/api/products/${productId}/inventory/units`,
                { headers: this.getAuthHeaders() }
            );

            const items = this.unwrapListPayload<any>(response);
            return items.map((item: any) => this.mapInventoryUnit(item));
        } catch (error) {
            console.error(`Error fetching inventory units for product ${productId}`, error);
            return [];
        }
    }

    async updateInventoryUnit(
        productId: string,
        unitId: string,
        data: { code?: string; status?: InventoryUnit["status"] }
    ): Promise<InventoryUnit> {
        const response = await this.client.patch<any>(
            `/api/products/${productId}/inventory/units/${unitId}`,
            {
                ...(data.code ? { code: data.code } : {}),
                ...(data.status ? { status: data.status } : {}),
            },
            {
                headers: this.getAuthHeaders(),
            }
        );

        const payload = (response as any).data && (response as any).success !== undefined
            ? (response as any).data
            : response;

        return this.mapInventoryUnit(payload);
    }

    async adjustInventory(productId: string, totalQuantity: number): Promise<void> {
        await this.client.post<void>(
            `/api/products/${productId}/inventory/adjustments`,
            { total_quantity: totalQuantity },
            {
                headers: this.getAuthHeaders(),
                skipParseJson: true,
            }
        );
    }

    private mapToDomain(apiData: any): Product {
        const imageIds = Array.isArray(apiData.image_ids) ? apiData.image_ids : [];
        const primaryImageId = imageIds[0];
        const categories = Array.isArray(apiData.categories) ? apiData.categories : [];
        const primaryCategory = categories[0];

        let status: PublicationStatusType = 'draft';
        if (typeof apiData.publication_status === 'string') {
            status = apiData.publication_status as PublicationStatusType;
        } else if (apiData.publication_status && typeof apiData.publication_status === 'object') {
            status = apiData.publication_status.status || 'draft';
        } else if (typeof apiData.status === 'string') {
            status = apiData.status as PublicationStatusType;
        }

        return {
            id: apiData.id || apiData.product_id,
            internalId: apiData.internal_id || '',
            name: apiData.name || '',
            slug: apiData.slug || '',
            description: apiData.description || '',
            quantity: Number(apiData.quantity ?? apiData.inventory_summary?.total_quantity ?? 1),
            isRentalEnabled: Boolean(apiData.is_rental_enabled ?? apiData.inventory_summary?.is_rental_enabled ?? true),
            isInventoryEnabled: Boolean(apiData.is_inventory_enabled ?? apiData.inventory_summary?.is_inventory_enabled ?? false),
            inventoryMode: this.resolveInventoryMode(apiData),
            bookingPolicy: apiData.booking_policy ?? 'owner_managed',
            allowsQuantityRequest: Boolean(apiData.allows_quantity_request ?? true),
            imageUrl: primaryImageId ? `${this.baseUrl}/api/media/images/${primaryImageId}/MEDIUM` : '',
            thumbnailUrl: primaryImageId ? `${this.baseUrl}/api/media/images/${primaryImageId}/THUMBNAIL` : '',

            image_ids: imageIds,

            publicationStatus: status,
            dynamicProperties: this.mapDynamicProperties(apiData.dynamic_properties),

            price: this.mapPrice(apiData),
            productType: 'rental',
            category: {
                id: apiData.category_id || primaryCategory?.id || '',
                name: apiData.category_name || primaryCategory?.name || '',
                slug: apiData.category_slug || primaryCategory?.slug || ''
            },

            rating: apiData.rating || 0,
            reviewCount: apiData.review_count || 0,
            createdAt: apiData.created_at,
            updatedAt: apiData.updated_at,
            inventorySummary: this.mapInventorySummary(apiData.inventory_summary),
            circle: Array.isArray(apiData.circle)
                ? apiData.circle.map((point: any) => ({
                    latitude: point.latitude,
                    longitude: point.longitude,
                }))
                : undefined,
            ownerData: apiData.owner_data
                ? {
                    ownerId: apiData.owner_data.owner_id,
                    type: apiData.owner_data.type,
                    name: apiData.owner_data.name,
                    lastName: apiData.owner_data?.last_name,
                    slug: apiData.owner_data?.slug,
                    address: apiData.owner_data.address
                        ? {
                            street: apiData.owner_data.address.street,
                            street2: apiData.owner_data.address.street2,
                            city: apiData.owner_data.address?.city,
                            postalCode: apiData.owner_data.address?.postal_code,
                            state: apiData.owner_data.address?.state,
                            country: apiData.owner_data.address?.country,
                        }
                        : undefined,
                    geoLocation: apiData.owner_data.geo_location
                        ? {
                            latitude: apiData.owner_data.geo_location.latitude,
                            longitude: apiData.owner_data.geo_location.longitude,
                            circle: apiData.owner_data.geo_location.circle,
                        }
                        : undefined,
                }: undefined
        };
    }

    private mapPrice(apiData: any): Product["price"] {
        const pricePayload = apiData.price && typeof apiData.price === "object" ? apiData.price : {};
        const rawTiers = Array.isArray(apiData.tiers)
            ? apiData.tiers
            : (Array.isArray(pricePayload.tiers) ? pricePayload.tiers : []);

        const tiers = rawTiers.map((tier: any) => ({
            daysFrom: Number(tier.days_from ?? tier.daysFrom ?? 1),
            daysTo: tier.days_to ?? tier.daysTo,
            pricePerDay: this.moneyLikeToEuros(tier.price_per_day ?? tier.pricePerDay),
        }));

        return {
            daily: tiers.find((tier) => tier.pricePerDay > 0)?.pricePerDay
                ?? this.moneyLikeToEuros(pricePayload.daily ?? apiData.daily ?? apiData.price_per_day),
            deposit: this.moneyLikeToEuros(apiData.deposit ?? pricePayload.deposit),
            tiers,
        };
    }

    private moneyLikeToEuros(value: any): number {
        if (typeof value === "number" && Number.isFinite(value)) {
            return value;
        }

        if (typeof value === "string" && value.trim() !== "") {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : 0;
        }

        if (value && typeof value === "object" && typeof value.amount === "number") {
            return value.amount / 100;
        }

        return 0;
    }

    private mapToDto(data: ProductFormData, includeQuantity: boolean = true): any {
        const product = data as any;
        const imageIds = Array.isArray(product.images)
            ? product.images.map((img: any) => img.id).filter(Boolean)
            : Array.isArray(product.image_ids)
                ? product.image_ids.filter((imageId: unknown): imageId is string =>
                    typeof imageId === 'string' && imageId.length > 0
                )
                : [];

        const dto: any = {
            product_id: product.id,
            name: data.name,
            slug: data.slug,
            internal_id: data.internalId || data.slug || product.id,
            description: data.description,
            is_rental_enabled: true,
            inventory_mode: data.inventoryMode ?? 'unmanaged',
            is_inventory_enabled: (data.inventoryMode ?? 'unmanaged') !== 'unmanaged',
            company_id: product.company?.id || data.companyId,
            category_id: product.category?.id || data.categoryId,
            image_ids: imageIds,
            dynamic_properties: data.dynamicProperties ?? product.dynamicProperties ?? {},

            deposit: {
                amount: Math.round((data.price.deposit || 0) * 100),
                currency: 'EUR'
            },

            tiers: (data.price.tiers || []).map(tier => ({
                price_per_day: { amount: Math.round(tier.pricePerDay * 100), currency: 'EUR' },
                days_from: tier.daysFrom,
                days_to: tier.daysTo
            }))
        };

        if (includeQuantity) {
            dto.quantity = data.quantity;
        }

        return dto;
    }

    private mapInventorySummary(apiData: any): ProductInventorySummary | null {
        if (!apiData || typeof apiData !== 'object') {
            return null;
        }

        return {
            productId: apiData.product_id ?? '',
            productInternalId: apiData.product_internal_id ?? '',
            totalQuantity: Number(apiData.total_quantity ?? 1),
            reservedQuantity: Number(apiData.reserved_quantity ?? 0),
            availableQuantity: Number(apiData.available_quantity ?? 0),
            isRentalEnabled: Boolean(apiData.is_rental_enabled ?? true),
            isInventoryEnabled: Boolean(apiData.is_inventory_enabled ?? false),
            capabilityState: apiData.capability_state ?? 'disabled',
            inventoryMode: this.resolveInventoryMode(apiData),
            isRentableNow: Boolean(apiData.is_rentable_now ?? false),
            unavailabilityReason: apiData.unavailability_reason ?? null,
        };
    }

    private mapInventoryAllocation(apiData: any): InventoryAllocation {
        return {
            allocationId: apiData.allocation_id,
            rentId: apiData.rent_id,
            productId: apiData.product_id,
            productInternalId: apiData.product_internal_id,
            allocatedQuantity: Number(apiData.allocated_quantity ?? 1),
            assignedUnitIds: Array.isArray(apiData.assigned_unit_ids)
                ? apiData.assigned_unit_ids.map((unitId: unknown) => String(unitId))
                : [],
            state: apiData.state,
            startsAt: apiData.starts_at,
            endsAt: apiData.ends_at,
            createdAt: apiData.created_at,
            releasedAt: apiData.released_at ?? null,
        };
    }

    private mapInventoryUnit(apiData: any): InventoryUnit {
        return {
            unitId: apiData.unit_id ?? '',
            productId: apiData.product_id ?? '',
            code: apiData.code ?? '',
            status: apiData.status ?? 'available',
            sortOrder: Number(apiData.sort_order ?? 1),
            nextAllocation: apiData.next_allocation
                ? {
                    rentId: apiData.next_allocation.rent_id ?? '',
                    startsAt: apiData.next_allocation.starts_at ?? '',
                    endsAt: apiData.next_allocation.ends_at ?? '',
                    state: apiData.next_allocation.state ?? 'reserved',
                }
                : null,
        };
    }

    private mapProductAvailability(apiData: any): ProductPublicAvailability {
        return {
            canRequest: Boolean(apiData.can_request ?? false),
            status: apiData.status ?? 'unavailable',
            message: apiData.message ?? '',
            managedByPlatform: Boolean(apiData.managed_by_platform ?? false),
        };
    }

    private mapDynamicProperties(apiData: any): ProductDynamicProperties | undefined {
        if (!apiData || typeof apiData !== "object" || Array.isArray(apiData)) {
            return undefined;
        }

        return apiData as ProductDynamicProperties;
    }

    private mapAvailableDynamicFilter(apiData: any): AvailableDynamicFilter {
        return {
            code: apiData.code ?? "",
            label: apiData.label ?? "",
            type: apiData.type ?? "select",
            unit: apiData.unit ?? null,
            options: Array.isArray(apiData.options)
                ? apiData.options.map((option: any): AvailableDynamicFilterOption => ({
                    value: option.value ?? "",
                    label: option.label ?? option.value ?? "",
                    count: Number(option.count ?? 0),
                    selected: Boolean(option.selected ?? false),
                }))
                : undefined,
            range: apiData.range
                ? {
                    min: apiData.range.min ?? null,
                    max: apiData.range.max ?? null,
                }
                : undefined,
            selectedRange: apiData.selected_range
                ? {
                    min: apiData.selected_range.min ?? null,
                    max: apiData.selected_range.max ?? null,
                }
                : undefined,
        };
    }
}
