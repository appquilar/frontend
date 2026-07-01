import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { productInventoryService } from "@/compositionRoot";
import type { InventoryUnit, Product } from "@/domain/models/Product";
import {
    formatProductAvailabilityLabel,
    resolveProductRentability,
} from "@/domain/services/ProductRentabilityService";

export const useProductInventory = (
    productId?: string | null,
    enabled: boolean = true,
    range?: { startDate?: string | null; endDate?: string | null },
) => {
    return useQuery({
        queryKey: ["productInventory", productId, range?.startDate ?? null, range?.endDate ?? null],
        queryFn: async () => {
            if (!productId) {
                return null;
            }

            return productInventoryService.getInventorySummary(productId, range);
        },
        enabled: enabled && Boolean(productId),
    });
};

export const useProductInventoryAllocations = (productId?: string | null, enabled: boolean = true) => {
    return useQuery({
        queryKey: ["productInventory", productId, "allocations"],
        queryFn: async () => {
            if (!productId) {
                return [];
            }

            return productInventoryService.getInventoryAllocations(productId);
        },
        enabled: enabled && Boolean(productId),
    });
};

export const useProductInventoryUnits = (productId?: string | null, enabled: boolean = true) => {
    return useQuery({
        queryKey: ["productInventory", productId, "units"],
        queryFn: async () => {
            if (!productId) {
                return [];
            }

            return productInventoryService.getInventoryUnits(productId);
        },
        enabled: enabled && Boolean(productId),
    });
};

export const useProductAvailability = (
    productId?: string | null,
    startDate?: string | null,
    endDate?: string | null,
    quantity: number = 1,
    enabled: boolean = true,
) => {
    return useQuery({
        queryKey: ["productAvailability", productId, startDate, endDate, quantity],
        queryFn: async () => {
            if (!productId || !startDate || !endDate) {
                return null;
            }

            return productInventoryService.checkAvailability(productId, startDate, endDate, quantity);
        },
        enabled: enabled && Boolean(productId && startDate && endDate),
    });
};

export const useAdjustProductInventory = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ productId, totalQuantity }: { productId: string; totalQuantity: number }) =>
            productInventoryService.adjustInventory(productId, totalQuantity),
        onSuccess: async (_data, variables) => {
            await queryClient.invalidateQueries({ queryKey: ["productInventory", variables.productId] });
            await queryClient.invalidateQueries({ queryKey: ["productInventory", variables.productId, "allocations"] });
            await queryClient.invalidateQueries({ queryKey: ["productInventory", variables.productId, "units"] });
            await queryClient.invalidateQueries({ queryKey: ["product", variables.productId] });
            await queryClient.invalidateQueries({ queryKey: ["products"] });
        },
    });
};

export const useUpdateInventoryUnit = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            productId,
            unitId,
            data,
        }: {
            productId: string;
            unitId: string;
            data: { code?: string; status?: InventoryUnit["status"] };
        }) => productInventoryService.updateInventoryUnit(productId, unitId, data),
        onSuccess: async (_data, variables) => {
            await queryClient.invalidateQueries({ queryKey: ["productInventory", variables.productId] });
            await queryClient.invalidateQueries({ queryKey: ["productInventory", variables.productId, "units"] });
        },
    });
};

export const getProductAvailabilityLabel = (product: Product | null, includeQuantity: boolean = false) =>
    formatProductAvailabilityLabel(product, { includeQuantity });

export const useProductRentability = (product: Product | null) => {
    const rentability = resolveProductRentability(product);

    return {
        ...rentability,
        isRentalEnabled: rentability.isRentableNow,
    };
};
