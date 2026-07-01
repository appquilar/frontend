import type {
    InventoryAllocation,
    InventoryUnit,
    Product,
    ProductInventorySummary,
    ProductPublicAvailability,
} from "@/domain/models/Product";
import type { ProductRepository } from "@/domain/repositories/ProductRepository";
import { resolveProductRentability } from "@/domain/services/ProductRentabilityService";

/**
 * Inventory application service.
 *
 * Dashboard inventory methods wrap authenticated inventory endpoints that are
 * mounted only when the product "Inventario" tab is opened. Public product
 * detail flows must use `checkAvailability` instead of dashboard inventory
 * endpoints so stock counts and serialized unit data remain private.
 */
export class ProductInventoryService {
    constructor(
        private readonly productRepository: ProductRepository,
    ) {
    }

    getInventorySummary(
        productId: string,
        range?: { startDate?: string | null; endDate?: string | null }
    ): Promise<ProductInventorySummary | null> {
        return this.productRepository.getInventorySummary(productId, range);
    }

    getInventoryAllocations(productId: string): Promise<InventoryAllocation[]> {
        return this.productRepository.getInventoryAllocations(productId);
    }

    getInventoryUnits(productId: string): Promise<InventoryUnit[]> {
        return this.productRepository.getInventoryUnits(productId);
    }

    updateInventoryUnit(
        productId: string,
        unitId: string,
        data: { code?: string; status?: InventoryUnit["status"] }
    ): Promise<InventoryUnit> {
        return this.productRepository.updateInventoryUnit(productId, unitId, data);
    }

    checkAvailability(productId: string, startDate: string, endDate: string, quantity: number): Promise<ProductPublicAvailability> {
        return this.productRepository.checkAvailability(productId, startDate, endDate, quantity);
    }

    adjustInventory(productId: string, totalQuantity: number): Promise<void> {
        return this.productRepository.adjustInventory(productId, totalQuantity);
    }

    getRentability(product: Product | null) {
        return {
            summary: product?.inventorySummary ?? null,
            ...resolveProductRentability(product),
        };
    }
}
