import {
    InventoryAllocation,
    InventoryUnit,
    Product,
    ProductFormData,
    ProductInventorySummary,
    ProductPublicAvailability,
} from '@/domain/models/Product';
import {
    ProductRepository,
    ProductSearchCriteria,
    ProductListResponse,
    ProductFilters,
    ProductOwnerSummary,
    RentalCostBreakdown
} from '@/domain/repositories/ProductRepository';

/**
 * Service for managing product data
 */
export class ProductService {
    constructor(private repository: ProductRepository) {}

    async search(criteria: ProductSearchCriteria): Promise<ProductListResponse> {
        return this.repository.search(criteria);
    }

    async getAllProducts(): Promise<Product[]> {
        return this.repository.getAllProducts();
    }

    async getProductById(id: string): Promise<Product | null> {
        return this.repository.getProductById(id);
    }

    async getBySlug(slug: string): Promise<Product | null> {
        return this.repository.getBySlug(slug);
    }

    async getProductsByCompanyId(companyId: string): Promise<Product[]> {
        return this.repository.getProductsByCompanyId(companyId);
    }

    async listByOwner(ownerId: string): Promise<Product[]> {
        return this.repository.listByOwner(ownerId);
    }

    async listByOwnerPaginated(
        ownerId: string,
        ownerType: 'company' | 'user',
        page: number,
        perPage: number,
        filters?: ProductFilters
    ): Promise<ProductListResponse> {
        return this.repository.listByOwnerPaginated(ownerId, ownerType, page, perPage, filters);
    }

    async getOwnerSummary(ownerId: string, ownerType: 'company' | 'user'): Promise<ProductOwnerSummary> {
        return this.repository.getOwnerSummary(ownerId, ownerType);
    }

    async getProductsByCategoryId(categoryId: string): Promise<Product[]> {
        return this.repository.getProductsByCategoryId(categoryId);
    }

    async createProduct(productData: ProductFormData): Promise<void> {
        return this.repository.createProduct(productData);
    }

    async updateProduct(id: string, productData: ProductFormData): Promise<Product> {
        return this.repository.updateProduct(id, productData);
    }

    async deleteProduct(id: string): Promise<boolean> {
        return this.repository.deleteProduct(id);
    }

    async publishProduct(id: string): Promise<boolean> {
        return this.repository.publishProduct(id);
    }

    async calculateRentalCost(id: string, startDate: string, endDate: string, quantity: number): Promise<RentalCostBreakdown> {
        return this.repository.calculateRentalCost(id, startDate, endDate, quantity);
    }

    async checkAvailability(productId: string, startDate: string, endDate: string, quantity: number): Promise<ProductPublicAvailability> {
        return this.repository.checkAvailability(productId, startDate, endDate, quantity);
    }

    async getInventorySummary(
        productId: string,
        range?: { startDate?: string | null; endDate?: string | null }
    ): Promise<ProductInventorySummary | null> {
        return this.repository.getInventorySummary(productId, range);
    }

    async getInventoryAllocations(productId: string): Promise<InventoryAllocation[]> {
        return this.repository.getInventoryAllocations(productId);
    }

    async getInventoryUnits(productId: string): Promise<InventoryUnit[]> {
        return this.repository.getInventoryUnits(productId);
    }

    async updateInventoryUnit(
        productId: string,
        unitId: string,
        data: { code?: string; status?: InventoryUnit['status'] }
    ): Promise<InventoryUnit> {
        return this.repository.updateInventoryUnit(productId, unitId, data);
    }

    async adjustInventory(productId: string, totalQuantity: number): Promise<void> {
        return this.repository.adjustInventory(productId, totalQuantity);
    }
}
