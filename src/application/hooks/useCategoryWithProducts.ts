import { useQuery } from "@tanstack/react-query";
import { compositionRoot } from "@/compositionRoot";
import type { Category } from "@/domain/models/Category";
import type { Product as DomainProduct } from "@/domain/models/Product";
import type { AvailableDynamicFilter } from "@/domain/models/DynamicProperty";

type CategoryWithProducts = {
    category: Category;
    products: DomainProduct[];
    availableDynamicFilters: AvailableDynamicFilter[];
};

type SearchGeoFilters = {
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
};

type DynamicSearchFilters = {
    propertyValues?: Record<string, string[]>;
    propertyRanges?: Record<string, { min?: number; max?: number }>;
};

export const useCategoryWithProducts = (slug: string | undefined) => {
    return useCategoryWithProductsByText(slug, "", {}, {});
};

export const useCategoryWithProductsByText = (
    slug: string | undefined,
    text: string,
    geoFilters: SearchGeoFilters,
    dynamicFilters: DynamicSearchFilters
) => {
    const trimmedText = text.trim();
    const latitude = geoFilters.latitude;
    const longitude = geoFilters.longitude;
    const radiusKm = geoFilters.radiusKm;
    const propertyValueEntries = Object.entries(
        dynamicFilters.propertyValues ?? {}
    ) as Array<[string, string[]]>;
    const normalizedPropertyValues = Object.fromEntries(
        propertyValueEntries
            .map(([code, values]): [string, string[]] => [code, [...values].sort()])
            .sort(([left], [right]) => left.localeCompare(right))
    );
    const normalizedPropertyRanges = Object.fromEntries(
        Object.entries(dynamicFilters.propertyRanges ?? {})
            .sort(([left], [right]) => left.localeCompare(right))
    );

    return useQuery<CategoryWithProducts>({
        queryKey: [
            "category",
            "public",
            slug,
            trimmedText,
            latitude,
            longitude,
            radiusKm,
            normalizedPropertyValues,
            normalizedPropertyRanges,
        ],
        enabled: Boolean(slug),
        queryFn: async () => {
            const category = await compositionRoot.categoryService.getBySlug(slug!);
            const searchResult = await compositionRoot.productService.search({
                text: trimmedText.length > 0 ? trimmedText : undefined,
                categories: [category.id],
                latitude,
                longitude,
                radius: radiusKm,
                property_values: Object.keys(normalizedPropertyValues).length > 0 ? normalizedPropertyValues : undefined,
                property_ranges: Object.keys(normalizedPropertyRanges).length > 0 ? normalizedPropertyRanges : undefined,
                page: 1,
                per_page: 50,
            });

            return {
                category,
                products: searchResult.data,
                availableDynamicFilters: searchResult.availableDynamicFilters ?? [],
            };
        },
    });
};
