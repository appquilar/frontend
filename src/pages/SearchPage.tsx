import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Search, SlidersHorizontal, Square } from "lucide-react";

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ProductGrid from "@/components/category/ProductGrid";
import LoadingState from "@/components/category/LoadingState";
import DynamicPropertyFiltersSection, {
    type DynamicRangeFilters,
    type DynamicValueFilters,
} from "@/components/category/DynamicPropertyFiltersSection";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";

import type { Product as DomainProduct } from "@/domain/models/Product";
import type { Category } from "@/domain/models/Category";
import type { AvailableDynamicFilter } from "@/domain/models/DynamicProperty";
import { usePublicProductSearchWithCategories } from "@/application/hooks/usePublicProductSearch";
import { useCategoryDynamicProperties } from "@/application/hooks/useCategoryDynamicProperties";
import { usePublicSiteCategories } from "@/application/hooks/usePublicSiteCategories";
import { useSeo } from "@/hooks/useSeo";
import { buildAbsolutePublicUrl, buildSearchPath } from "@/domain/config/publicRoutes";

const EMPTY_PRODUCTS: DomainProduct[] = [];
const EMPTY_CATEGORY_IDS: string[] = [];
const DISTANCE_OPTIONS = [
    { value: "any", label: "Cualquier distancia" },
    { value: "5", label: "Dentro de 5 km" },
    { value: "10", label: "Dentro de 10 km" },
    { value: "20", label: "Dentro de 20 km" },
    { value: "50", label: "Dentro de 50 km" },
    { value: "100", label: "Dentro de 100 km" },
] as const;

type CategoryTreeNode = Category & {
    children: CategoryTreeNode[];
};

type CheckboxState = {
    checked: boolean;
    indeterminate: boolean;
};

const buildCategoryTree = (categories: Category[]): CategoryTreeNode[] => {
    const byId = new Map<string, CategoryTreeNode>();
    const roots: CategoryTreeNode[] = [];

    for (const category of categories) {
        byId.set(category.id, { ...category, children: [] });
    }

    for (const node of byId.values()) {
        if (node.parentId && byId.has(node.parentId)) {
            byId.get(node.parentId)!.children.push(node);
        } else {
            roots.push(node);
        }
    }

    const sortNodes = (nodes: CategoryTreeNode[]) => {
        nodes.sort((a, b) => a.name.localeCompare(b.name));
        for (const node of nodes) {
            sortNodes(node.children);
        }
    };

    sortNodes(roots);
    return roots;
};

const getLeafIds = (node: CategoryTreeNode): string[] => {
    if (node.children.length === 0) return [node.id];
    return node.children.flatMap(getLeafIds);
};

const getNodeCheckboxState = (
    node: CategoryTreeNode,
    selectedIds: Set<string>
): CheckboxState => {
    if (node.children.length === 0) {
        return {
            checked: selectedIds.has(node.id),
            indeterminate: false,
        };
    }

    const leafIds = getLeafIds(node);
    const selectedLeaves = leafIds.filter((id) => selectedIds.has(id)).length;
    const allLeavesSelected = selectedLeaves === leafIds.length && leafIds.length > 0;

    return {
        checked: selectedIds.has(node.id) || allLeavesSelected,
        indeterminate: !allLeavesSelected && selectedLeaves > 0,
    };
};

const parseDynamicValueFilters = (searchParams: URLSearchParams): DynamicValueFilters => {
    const filters: DynamicValueFilters = {};

    searchParams.forEach((value, key) => {
        const match = key.match(/^property_values\[(.+)\]\[\]$/);
        if (!match || value.trim().length === 0) {
            return;
        }

        const code = match[1];
        filters[code] = [...(filters[code] ?? []), value.trim()];
    });

    return filters;
};

const parseDynamicRangeFilters = (searchParams: URLSearchParams): DynamicRangeFilters => {
    const filters: DynamicRangeFilters = {};

    searchParams.forEach((value, key) => {
        const match = key.match(/^property_ranges\[(.+)\]\[(min|max)\]$/);
        if (!match || value.trim().length === 0) {
            return;
        }

        const parsedValue = Number.parseFloat(value);
        if (!Number.isFinite(parsedValue)) {
            return;
        }

        const [, code, boundary] = match;
        filters[code] = {
            ...(filters[code] ?? {}),
            [boundary]: parsedValue,
        };
    });

    return filters;
};

interface SearchFiltersPanelProps {
    hasActiveFilters: boolean;
    availableDynamicFilters: AvailableDynamicFilter[];
    categoryTree: CategoryTreeNode[];
    locationError: string | null;
    isLocating: boolean;
    selectedCategorySet: Set<string>;
    selectedDynamicRangeFilters: DynamicRangeFilters;
    selectedDynamicValueFilters: DynamicValueFilters;
    selectedRadius: string;
    showDynamicFilterBlock: boolean;
    onApply: () => Promise<boolean> | boolean;
    onClear: () => void;
    onRadiusChange: (value: string) => void;
    onToggleCategoryTreeNode: (node: CategoryTreeNode) => void;
    onToggleDynamicOption: (filterCode: string, optionValue: string, checked: boolean) => void;
    onUpdateDynamicRangeFilter: (filterCode: string, boundary: "min" | "max", rawValue: string) => void;
}

const SearchFiltersPanel = ({
    availableDynamicFilters,
    categoryTree,
    hasActiveFilters,
    locationError,
    isLocating,
    selectedCategorySet,
    selectedDynamicRangeFilters,
    selectedDynamicValueFilters,
    selectedRadius,
    showDynamicFilterBlock,
    onApply,
    onClear,
    onRadiusChange,
    onToggleCategoryTreeNode,
    onToggleDynamicOption,
    onUpdateDynamicRangeFilter,
}: SearchFiltersPanelProps) => {
    const renderNode = (currentNode: CategoryTreeNode, depth: number): JSX.Element => {
        const state = getNodeCheckboxState(currentNode, selectedCategorySet);

        return (
            <div key={currentNode.id}>
                <button
                    type="button"
                    onClick={() => onToggleCategoryTreeNode(currentNode)}
                    className="flex w-full items-center gap-2 rounded py-1.5 text-left text-sm hover:bg-muted/40"
                    style={{ paddingLeft: `${depth * 14}px` }}
                >
                    <span
                        className={`flex h-4 w-4 items-center justify-center rounded border ${
                            state.checked || state.indeterminate
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border"
                        }`}
                    >
                        {state.checked ? (
                            <Check size={12} />
                        ) : state.indeterminate ? (
                            <Square size={8} fill="currentColor" />
                        ) : null}
                    </span>
                    <span className="truncate">{currentNode.name}</span>
                </button>

                {currentNode.children.length > 0 && (
                    <div className="space-y-0.5">
                        {currentNode.children.map((child) => renderNode(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-5">
            <Button
                type="button"
                onClick={() => {
                    void onApply();
                }}
                disabled={isLocating}
                variant="outline"
                className="h-10 w-full justify-center"
            >
                {isLocating ? "Obteniendo ubicación..." : "Aplicar filtros"}
            </Button>
            {hasActiveFilters && (
                <Button
                    type="button"
                    variant="ghost"
                    className="h-9 w-full justify-center"
                    onClick={onClear}
                >
                    Limpiar todos los filtros
                </Button>
            )}

            <div>
                <h2 className="mb-1 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Filtros
                </h2>
                <p className="text-sm text-muted-foreground">Refina tu búsqueda</p>
            </div>

            <div>
                <label className="mb-1 block text-sm font-medium">Distancia</label>
                <select
                    value={selectedRadius}
                    onChange={(event) => onRadiusChange(event.target.value)}
                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    {DISTANCE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>

            <div>
                <h3 className="mb-2 text-sm font-medium">Categorías</h3>
                {locationError && (
                    <p className="mb-3 text-xs text-destructive">{locationError}</p>
                )}

                <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1 sm:max-h-[60vh]">
                    {categoryTree.map((node) => renderNode(node, 0))}
                </div>
            </div>

            {showDynamicFilterBlock && (
                <DynamicPropertyFiltersSection
                    availableDynamicFilters={availableDynamicFilters}
                    selectedDynamicRangeFilters={selectedDynamicRangeFilters}
                    selectedDynamicValueFilters={selectedDynamicValueFilters}
                    onToggleDynamicOption={onToggleDynamicOption}
                    onUpdateDynamicRangeFilter={onUpdateDynamicRangeFilter}
                />
            )}
        </div>
    );
};

const SearchPage = () => {
    const [params, setParams] = useSearchParams();
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const queryFromUrl = (params.get("q") ?? "").trim();
    const categoriesFromUrl = useMemo(() => {
        const raw = params.get("categories");
        if (!raw) return EMPTY_CATEGORY_IDS;
        return raw
            .split(",")
            .map((item) => item.trim())
            .filter((item) => item.length > 0);
    }, [params]);
    const radiusFromUrl = useMemo(() => {
        const raw = params.get("radius");
        if (!raw) return "any";
        if (DISTANCE_OPTIONS.some((option) => option.value === raw)) return raw;
        return "any";
    }, [params]);
    const latitudeFromUrl = useMemo(() => {
        const raw = params.get("latitude");
        if (!raw) return undefined;
        const parsed = Number.parseFloat(raw);
        return Number.isFinite(parsed) ? parsed : undefined;
    }, [params]);
    const longitudeFromUrl = useMemo(() => {
        const raw = params.get("longitude");
        if (!raw) return undefined;
        const parsed = Number.parseFloat(raw);
        return Number.isFinite(parsed) ? parsed : undefined;
    }, [params]);
    const dynamicValueFiltersFromUrl = useMemo(
        () => parseDynamicValueFilters(params),
        [params]
    );
    const dynamicRangeFiltersFromUrl = useMemo(
        () => parseDynamicRangeFilters(params),
        [params]
    );

    const [inputValue, setInputValue] = useState(queryFromUrl);
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(categoriesFromUrl);
    const [selectedRadius, setSelectedRadius] = useState(radiusFromUrl);
    const [selectedDynamicValueFilters, setSelectedDynamicValueFilters] =
        useState<DynamicValueFilters>(dynamicValueFiltersFromUrl);
    const [selectedDynamicRangeFilters, setSelectedDynamicRangeFilters] =
        useState<DynamicRangeFilters>(dynamicRangeFiltersFromUrl);
    const [isLocating, setIsLocating] = useState(false);
    const [locationError, setLocationError] = useState<string | null>(null);

    const { allCategories } = usePublicSiteCategories();
    const dynamicPropertiesQuery = useCategoryDynamicProperties(categoriesFromUrl);

    useEffect(() => {
        setInputValue(queryFromUrl);
    }, [queryFromUrl]);

    useEffect(() => {
        setSelectedCategoryIds(categoriesFromUrl);
    }, [categoriesFromUrl]);
    useEffect(() => {
        setSelectedRadius(radiusFromUrl);
    }, [radiusFromUrl]);
    useEffect(() => {
        setSelectedDynamicValueFilters(dynamicValueFiltersFromUrl);
    }, [dynamicValueFiltersFromUrl]);
    useEffect(() => {
        setSelectedDynamicRangeFilters(dynamicRangeFiltersFromUrl);
    }, [dynamicRangeFiltersFromUrl]);

    const { data, isLoading, isFetching } = usePublicProductSearchWithCategories(
        queryFromUrl,
        categoriesFromUrl,
        {
            latitude: latitudeFromUrl,
            longitude: longitudeFromUrl,
            radiusKm: radiusFromUrl === "any" ? undefined : Number.parseInt(radiusFromUrl, 10),
        },
        {
            propertyValues: dynamicValueFiltersFromUrl,
            propertyRanges: dynamicRangeFiltersFromUrl,
        }
    );
    const categoryTree = useMemo(() => buildCategoryTree(allCategories), [allCategories]);
    const selectedCategorySet = useMemo(
        () => new Set(selectedCategoryIds),
        [selectedCategoryIds]
    );
    const domainProducts = data?.products ?? EMPTY_PRODUCTS;
    const availableDynamicFilters = data?.availableDynamicFilters ?? [];
    const showDynamicFilterBlock =
        Boolean(dynamicPropertiesQuery.data?.dynamicFiltersEnabled)
        && availableDynamicFilters.length > 0;
    const hasActiveFilters =
        queryFromUrl.length > 0
        || categoriesFromUrl.length > 0
        || radiusFromUrl !== "any"
        || Object.keys(dynamicValueFiltersFromUrl).length > 0
        || Object.keys(dynamicRangeFiltersFromUrl).length > 0;

    const products = useMemo(() => {
        return domainProducts.map((product) => ({
            id: product.id,
            internalId: product.internalId,
            name: product.name,
            slug: product.slug,
            imageUrl: product.imageUrl,
            thumbnailUrl: product.thumbnailUrl,
            description: product.description ?? "",
            price: {
                daily: product.price?.daily ?? 0,
                deposit: product.price?.deposit,
                tiers: product.price?.tiers,
            },
            company: {
                id: product.ownerData?.ownerId ?? "",
                name: product.ownerData?.name ?? "",
                slug: "",
            },
            category: {
                id: product.category?.id ?? "",
                name: product.category?.name ?? "",
                slug: product.category?.slug ?? "",
            },
            rating: product.rating ?? 0,
            reviewCount: product.reviewCount ?? 0,
        }));
    }, [domainProducts]);

    useSeo({
        title: queryFromUrl
            ? `Buscar "${queryFromUrl}" | Appquilar`
            : "Buscar productos | Appquilar",
        description: "Busca productos en Appquilar.",
        canonicalUrl: buildAbsolutePublicUrl(buildSearchPath(queryFromUrl)),
        robots: "noindex,follow",
    });

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        applyFilters();
    };

    const toggleCategoryTreeNode = (node: CategoryTreeNode) => {
        const state = getNodeCheckboxState(node, selectedCategorySet);
        const leafIds = getLeafIds(node);

        setSelectedCategoryIds((previous) => {
            const next = new Set(previous);
            if (state.checked || state.indeterminate) {
                next.delete(node.id);
                for (const id of leafIds) next.delete(id);
            } else {
                next.add(node.id);
                for (const id of leafIds) next.add(id);
            }

            setSelectedDynamicValueFilters({});
            setSelectedDynamicRangeFilters({});

            return Array.from(next);
        });
    };

    const applyFilters = async (): Promise<boolean> => applyFiltersAsync();

    const requestUserLocation = async (): Promise<{ latitude: number; longitude: number }> => {
        if (!("geolocation" in navigator)) {
            throw new Error("El navegador no soporta geolocalización.");
        }

        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                (position) =>
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    }),
                () => reject(new Error("No se pudo obtener tu ubicación.")),
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
            );
        });
    };

    const applyFiltersAsync = async (): Promise<boolean> => {
        const nextQuery = inputValue.trim();
        const nextCategories = selectedCategoryIds;
        const nextRadius = selectedRadius;
        const nextParams = new URLSearchParams();
        let nextLatitude = latitudeFromUrl;
        let nextLongitude = longitudeFromUrl;

        setLocationError(null);

        if (nextRadius !== "any") {
            if (nextLatitude === undefined || nextLongitude === undefined) {
                try {
                    setIsLocating(true);
                    const location = await requestUserLocation();
                    nextLatitude = location.latitude;
                    nextLongitude = location.longitude;
                } catch (error) {
                    setLocationError(
                        error instanceof Error
                            ? error.message
                            : "No se pudo obtener tu ubicación."
                    );
                    nextLatitude = undefined;
                    nextLongitude = undefined;
                } finally {
                    setIsLocating(false);
                }
            }
        } else {
            nextLatitude = undefined;
            nextLongitude = undefined;
        }

        if (nextQuery.length > 0) {
            nextParams.set("q", nextQuery);
        }

        if (nextCategories.length > 0) {
            nextParams.set("categories", nextCategories.join(","));
        }

        if (nextRadius !== "any") {
            nextParams.set("radius", nextRadius);
        }
        if (nextLatitude !== undefined && nextLongitude !== undefined) {
            nextParams.set("latitude", String(nextLatitude));
            nextParams.set("longitude", String(nextLongitude));
        }

        if (nextCategories.length > 0) {
            Object.entries(selectedDynamicValueFilters).forEach(([code, values]) => {
                values.forEach((value) => {
                    if (value.trim().length > 0) {
                        nextParams.append(`property_values[${code}][]`, value);
                    }
                });
            });

            Object.entries(selectedDynamicRangeFilters).forEach(([code, range]) => {
                if (range.min !== undefined) {
                    nextParams.set(`property_ranges[${code}][min]`, String(range.min));
                }

                if (range.max !== undefined) {
                    nextParams.set(`property_ranges[${code}][max]`, String(range.max));
                }
            });
        }

        setParams(nextParams);
        return true;
    };

    const clearFilters = () => {
        setInputValue("");
        setSelectedCategoryIds([]);
        setSelectedRadius("any");
        setSelectedDynamicValueFilters({});
        setSelectedDynamicRangeFilters({});
        setLocationError(null);
        setParams(new URLSearchParams());
        setMobileFiltersOpen(false);
    };

    const toggleDynamicOption = (filterCode: string, optionValue: string, checked: boolean) => {
        setSelectedDynamicValueFilters((previous) => {
            const currentValues = previous[filterCode] ?? [];
            const nextValues = checked
                ? Array.from(new Set([...currentValues, optionValue]))
                : currentValues.filter((value) => value !== optionValue);

            if (nextValues.length === 0) {
                const { [filterCode]: _removed, ...rest } = previous;
                return rest;
            }

            return {
                ...previous,
                [filterCode]: nextValues,
            };
        });
    };

    const updateDynamicRangeFilter = (filterCode: string, boundary: "min" | "max", rawValue: string) => {
        setSelectedDynamicRangeFilters((previous) => {
            const parsedValue = rawValue.trim().length === 0 ? undefined : Number.parseFloat(rawValue);
            const nextRange = {
                ...(previous[filterCode] ?? {}),
                [boundary]: Number.isFinite(parsedValue as number) ? parsedValue : undefined,
            };

            if (nextRange.min === undefined && nextRange.max === undefined) {
                const { [filterCode]: _removed, ...rest } = previous;
                return rest;
            }

            return {
                ...previous,
                [filterCode]: nextRange,
            };
        });
    };

    return (
        <div className="public-marketplace min-h-screen flex flex-col">
            <Header />
            <main className="public-main public-section flex-1">
                <div className="public-container grid grid-cols-1 gap-6 lg:grid-cols-[250px_1fr] xl:grid-cols-[270px_1fr]">
                    <aside className="hidden h-fit rounded-xl border border-border/70 bg-card p-4 lg:sticky lg:top-[var(--public-sticky-offset)] lg:block">
                        <SearchFiltersPanel
                            availableDynamicFilters={availableDynamicFilters}
                            categoryTree={categoryTree}
                            hasActiveFilters={hasActiveFilters}
                            locationError={locationError}
                            isLocating={isLocating}
                            selectedCategorySet={selectedCategorySet}
                            selectedDynamicRangeFilters={selectedDynamicRangeFilters}
                            selectedDynamicValueFilters={selectedDynamicValueFilters}
                            selectedRadius={selectedRadius}
                            showDynamicFilterBlock={showDynamicFilterBlock}
                            onApply={applyFilters}
                            onClear={clearFilters}
                            onRadiusChange={setSelectedRadius}
                            onToggleCategoryTreeNode={toggleCategoryTreeNode}
                            onToggleDynamicOption={toggleDynamicOption}
                            onUpdateDynamicRangeFilter={updateDynamicRangeFilter}
                        />
                    </aside>

                    <section className="lg:pl-1">
                        <div className="mb-4 lg:hidden">
                            <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                                <SheetTrigger asChild>
                                    <Button type="button" variant="outline" className="w-full justify-center gap-2">
                                        <SlidersHorizontal className="h-4 w-4" />
                                        Filtros
                                    </Button>
                                </SheetTrigger>
                                <SheetContent side="left" className="flex w-[92vw] max-w-sm flex-col p-0">
                                    <div className="sticky top-0 z-10 border-b bg-background px-5 py-4">
                                        <SheetHeader>
                                            <SheetTitle>Filtros de búsqueda</SheetTitle>
                                        </SheetHeader>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-5">
                                        <SearchFiltersPanel
                                            availableDynamicFilters={availableDynamicFilters}
                                            categoryTree={categoryTree}
                                            hasActiveFilters={hasActiveFilters}
                                            locationError={locationError}
                                            isLocating={isLocating}
                                            selectedCategorySet={selectedCategorySet}
                                            selectedDynamicRangeFilters={selectedDynamicRangeFilters}
                                            selectedDynamicValueFilters={selectedDynamicValueFilters}
                                            selectedRadius={selectedRadius}
                                            showDynamicFilterBlock={showDynamicFilterBlock}
                                            onApply={async () => {
                                                const applied = await applyFilters();
                                                if (applied) {
                                                    setMobileFiltersOpen(false);
                                                }
                                                return applied;
                                            }}
                                            onClear={clearFilters}
                                            onRadiusChange={setSelectedRadius}
                                            onToggleCategoryTreeNode={toggleCategoryTreeNode}
                                            onToggleDynamicOption={toggleDynamicOption}
                                            onUpdateDynamicRangeFilter={updateDynamicRangeFilter}
                                        />
                                    </div>
                                </SheetContent>
                            </Sheet>
                        </div>

                        <h1 className="mb-5 text-2xl md:text-3xl font-semibold">Buscar productos</h1>

                        <form onSubmit={handleSubmit} className="mb-6">
                            <div className="relative w-full">
                                <Search
                                    className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                                    size={17}
                                />
                                <input
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder="Buscar herramientas, equipos o categorías..."
                                    className="h-11 w-full rounded-xl border border-border/80 bg-background pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                            </div>
                        </form>

                        {isFetching && (
                            <div className="mb-4 text-sm text-muted-foreground">
                                Actualizando resultados...
                            </div>
                        )}

                        {isLoading && !data ? (
                            <LoadingState />
                        ) : products.length > 0 ? (
                            <ProductGrid products={products} />
                        ) : (
                            <div className="rounded-xl bg-muted/30 py-16 text-center">
                                <h3 className="text-lg font-medium mb-2">No hay resultados</h3>
                                <p className="text-muted-foreground">
                                    {queryFromUrl
                                        ? `No encontramos productos para "${queryFromUrl}".`
                                        : "Ahora mismo no hay productos publicados."}
                                </p>
                            </div>
                        )}
                    </section>
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default SearchPage;
