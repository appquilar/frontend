import {
    InventoryAllocation,
    InventoryUnit,
    Product,
    ProductFormData,
    ProductInventorySummary,
    ProductPublicAvailability,
    PublicationStatusType,
} from '../models/Product';
import type { AvailableDynamicFilter } from '../models/DynamicProperty';

export interface ProductSearchCriteria {
    text?: string;
    latitude?: number;
    longitude?: number;
    radius?: number;
    categories?: string[];
    property_values?: Record<string, string[]>;
    property_ranges?: Record<string, { min?: number; max?: number }>;
    page?: number;
    per_page?: number;
}

export interface ProductListResponse {
    data: Product[];
    total: number;
    page: number;
    availableDynamicFilters?: AvailableDynamicFilter[];
}

export interface ProductOwnerSummary {
    total: number;
    draft: number;
    published: number;
    archived: number;
    active: number;
}

export interface RentalCostBreakdown {
    productId: string;
    startDate: string;
    endDate: string;
    requestedQuantity: number;
    days: number;
    pricePerDay: {
        amount: number;
        currency: string;
    };
    rentalPrice: {
        amount: number;
        currency: string;
    };
    deposit: {
        amount: number;
        currency: string;
    };
    totalPrice: {
        amount: number;
        currency: string;
    };
}

export interface ProductFilters {
    name?: string;
    id?: string;
    internalId?: string;
    categoryId?: string;
    publicationStatus?: PublicationStatusType | PublicationStatusType[];
}

export const DEFAULT_PRODUCT_PUBLICATION_STATUSES: PublicationStatusType[] = ['draft', 'published'];

/**
 * Repository interface for accessing and managing Product data
 */
export interface ProductRepository {
    /**
     * Search products with filters
     */
    search(criteria: ProductSearchCriteria): Promise<ProductListResponse>;

    /**
     * Get all products (legacy/simple list)
     */
    getAllProducts(): Promise<Product[]>;

    /**
     * Get a product by ID (Legacy alias)
     */
    getProductById(id: string): Promise<Product | null>;

    /**
     * Get a product by ID
     */
    getById(id: string): Promise<Product | null>;

    /**
     * Get a product by Slug
     */
    getBySlug(slug: string): Promise<Product | null>;

    /**
     * Get products by company ID
     */
    getProductsByCompanyId(companyId: string): Promise<Product[]>;

    /**
     * List products by owner (Legacy array return)
     */
    listByOwner(ownerId: string): Promise<Product[]>;

    /**
     * List products by owner with pagination and filters
     */
    listByOwnerPaginated(
        ownerId: string,
        ownerType: 'company' | 'user',
        page: number,
        perPage: number,
        filters?: ProductFilters
    ): Promise<ProductListResponse>;

    /**
     * Fast owner-level counters for dashboard availability and navigation decisions.
     */
    getOwnerSummary(ownerId: string, ownerType: 'company' | 'user'): Promise<ProductOwnerSummary>;

    /**
     * Get products by category ID
     */
    getProductsByCategoryId(categoryId: string): Promise<Product[]>;

    /**
     * Create a new product
     */
    createProduct(productData: ProductFormData): Promise<void>;

    /**
     * Update an existing product
     */
    updateProduct(id: string, productData: ProductFormData): Promise<Product>;

    /**
     * Delete a product
     */
    deleteProduct(id: string): Promise<boolean>;

    /**
     * Publish a product
     */
    publishProduct(id: string): Promise<boolean>;

    /**
     * Calculate rental cost for a product in a date range
     */
    calculateRentalCost(id: string, startDate: string, endDate: string, quantity: number): Promise<RentalCostBreakdown>;

    /**
     * Public availability contract used by web and mobile product detail flows.
     * Backend route: GET /api/products/{product_id}/availability
     */
    checkAvailability(productId: string, startDate: string, endDate: string, quantity: number): Promise<ProductPublicAvailability>;

    /**
     * Dashboard-only inventory summary loaded from the product "Inventario" tab.
     * Backend route: GET /api/products/{product_id}/inventory
     */
    getInventorySummary(
        productId: string,
        range?: { startDate?: string | null; endDate?: string | null }
    ): Promise<ProductInventorySummary | null>;

    /**
     * Dashboard-only agenda feed used to explain which rents occupy serialized units.
     * Backend route: GET /api/products/{product_id}/inventory/allocations
     */
    getInventoryAllocations(productId: string): Promise<InventoryAllocation[]>;

    /**
     * Dashboard-only serialized unit list used for inline code/status editing.
     * Backend route: GET /api/products/{product_id}/inventory/units
     */
    getInventoryUnits(productId: string): Promise<InventoryUnit[]>;

    /**
     * Dashboard-only inline update for one serialized unit.
     * Backend route: PATCH /api/products/{product_id}/inventory/units/{unit_id}
     */
    updateInventoryUnit(
        productId: string,
        unitId: string,
        data: { code?: string; status?: InventoryUnit['status'] }
    ): Promise<InventoryUnit>;

    /**
     * Synchronizes the operational quantity after product save.
     * Backend route: POST /api/products/{product_id}/inventory/adjustments
     */
    adjustInventory(productId: string, totalQuantity: number): Promise<void>;
}
