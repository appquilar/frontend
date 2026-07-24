import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

import CategoryHeader from "@/components/category/CategoryHeader";
import CategorySearch from "@/components/category/CategorySearch";
import DynamicPropertyFiltersSection, {
    type DynamicRangeFilters,
    type DynamicValueFilters,
} from "@/components/category/DynamicPropertyFiltersSection";
import ProductGrid from "@/components/category/ProductGrid";
import NoProductsFound from "@/components/category/NoProductsFound";
import LoadingState from "@/components/category/LoadingState";

import type { Product as DomainProduct } from "@/domain/models/Product";
import { useCategoryWithProductsByText } from "@/application/hooks/useCategoryWithProducts";
import { useCategoryDynamicProperties } from "@/application/hooks/useCategoryDynamicProperties";
import { usePublicSiteCategories } from "@/application/hooks/usePublicSiteCategories";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useSeo } from "@/hooks/useSeo";
import PublicBreadcrumbs from "@/components/common/PublicBreadcrumbs";
import { PUBLIC_PATHS, buildAbsolutePublicUrl, buildCategoryPath, buildProductPath } from "@/domain/config/publicRoutes";
import { getPublicMediaUrl } from "@/application/hooks/usePublicMediaUrl";

const EMPTY_DOMAIN_PRODUCTS: DomainProduct[] = [];
const DISTANCE_OPTIONS = [
    { value: "any", label: "Cualquier distancia" },
    { value: "5", label: "Dentro de 5 km" },
    { value: "10", label: "Dentro de 10 km" },
    { value: "20", label: "Dentro de 20 km" },
    { value: "50", label: "Dentro de 50 km" },
    { value: "100", label: "Dentro de 100 km" },
] as const;

const stripHtml = (value: string | null | undefined): string =>
    (value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const CategoryPage = () => {
    const { slug } = useParams<{ slug: string }>();
    const { allCategories } = usePublicSiteCategories();

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedRadius, setSelectedRadius] = useState<string>("any");
    const [appliedRadius, setAppliedRadius] = useState<string>("any");
    const [selectedDynamicValueFilters, setSelectedDynamicValueFilters] =
        useState<DynamicValueFilters>({});
    const [appliedDynamicValueFilters, setAppliedDynamicValueFilters] =
        useState<DynamicValueFilters>({});
    const [selectedDynamicRangeFilters, setSelectedDynamicRangeFilters] =
        useState<DynamicRangeFilters>({});
    const [appliedDynamicRangeFilters, setAppliedDynamicRangeFilters] =
        useState<DynamicRangeFilters>({});
    const [userLocation, setUserLocation] = useState<{
        latitude: number;
        longitude: number;
    } | null>(null);
    const [isLocating, setIsLocating] = useState(false);
    const [locationError, setLocationError] = useState<string | null>(null);
    const debouncedSearchQuery = useDebouncedValue(searchQuery, 500);

    const geoFilters =
        appliedRadius !== "any" && userLocation
            ? {
                  latitude: userLocation.latitude,
                  longitude: userLocation.longitude,
                  radiusKm: Number.parseInt(appliedRadius, 10),
              }
            : {};

    const { data, isLoading, isFetching, isError } = useCategoryWithProductsByText(
        slug,
        debouncedSearchQuery,
        geoFilters,
        {
            propertyValues: appliedDynamicValueFilters,
            propertyRanges: appliedDynamicRangeFilters,
        }
    );
    const category = data?.category ?? null;
    const domainProducts = data?.products ?? EMPTY_DOMAIN_PRODUCTS;
    const availableDynamicFilters = data?.availableDynamicFilters ?? [];
    const dynamicPropertiesQuery = useCategoryDynamicProperties(
        category?.id ? [category.id] : []
    );
    const notFound = isError || (!isLoading && !category);
    const showDynamicFilterBlock =
        Boolean(dynamicPropertiesQuery.data?.dynamicFiltersEnabled)
        && availableDynamicFilters.length > 0;
    const categoryById = useMemo(() => {
        const map = new Map<string, typeof category>();
        allCategories.forEach((item) => map.set(item.id, item));
        return map;
    }, [allCategories]);

    // Scroll to top on page load
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    useEffect(() => {
        setSelectedDynamicValueFilters({});
        setAppliedDynamicValueFilters({});
        setSelectedDynamicRangeFilters({});
        setAppliedDynamicRangeFilters({});
    }, [slug]);

    const searchProducts = useMemo(() => {
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
                id: category?.id ?? "",
                name: category?.name ?? "",
                slug: category?.slug ?? "",
            },
            rating: product.rating ?? 0,
            reviewCount: product.reviewCount ?? 0,
        }));
    }, [category?.id, category?.name, category?.slug, domainProducts]);

    const categoryHeaderImageUrl = useMemo(() => {
        if (!category) {
            return null;
        }

        return getPublicMediaUrl(
            category.landscapeImageId ?? category.featuredImageId,
            "LARGE"
        );
    }, [category]);

    const breadcrumbItems = useMemo(() => {
        const items: Array<{ label: string; to?: string }> = [{ label: "Inicio", to: "/" }];

        if (!category) {
            return items;
        }

        const chain: Array<{ name: string; slug: string; id: string; parentId?: string | null }> = [];
        let current = categoryById.get(category.id);
        let guard = 0;

        while (current && guard < 20) {
            chain.unshift({ id: current.id, name: current.name, slug: current.slug, parentId: current.parentId });
            current = current.parentId ? categoryById.get(current.parentId) : undefined;
            guard += 1;
        }

        chain.forEach((item, index) => {
            const isLast = index === chain.length - 1;
            items.push({
                label: item.name,
                to: isLast ? undefined : buildCategoryPath(item.slug),
            });
        });

        return items;
    }, [category, categoryById]);

    const seoConfig = useMemo(() => {
        if (notFound) {
            return {
                title: "Categoría no encontrada | Appquilar",
                description: "La categoría que buscas no existe o no está disponible.",
                canonicalUrl: buildAbsolutePublicUrl(slug ? buildCategoryPath(slug) : PUBLIC_PATHS.categories),
                robots: "noindex,follow" as const,
            };
        }

        if (!category || !slug) {
            return {
                title: "Categoría de alquiler | Appquilar",
                description: "Explora productos en alquiler por categoría en Appquilar.",
                canonicalUrl: buildAbsolutePublicUrl(PUBLIC_PATHS.categories),
            };
        }

        const plainDescription = stripHtml(category.description);
        const description =
            plainDescription ||
            (searchProducts.length > 0
                ? `${searchProducts.length} productos de alquiler disponibles en la categoría ${category.name}.`
                : `Explora productos de alquiler en la categoría ${category.name}.`);

        const canonicalPath = buildCategoryPath(slug);
        const breadcrumbJsonLd = {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: breadcrumbItems.map((item, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: item.label,
                item: buildAbsolutePublicUrl(item.to ?? canonicalPath),
            })),
        };

        const itemListJsonLd =
            searchProducts.length > 0
                ? {
                      "@context": "https://schema.org",
                      "@type": "ItemList",
                      itemListElement: searchProducts.map((product, index) => ({
                          "@type": "ListItem",
                          position: index + 1,
                          url: buildAbsolutePublicUrl(buildProductPath(product.slug)),
                          name: product.name,
                      })),
                  }
                : null;

        return {
            title: `${category.name} en alquiler | Appquilar`,
            description,
            canonicalUrl: buildAbsolutePublicUrl(canonicalPath),
            jsonLd: itemListJsonLd ? [breadcrumbJsonLd, itemListJsonLd] : [breadcrumbJsonLd],
        };
    }, [breadcrumbItems, category, notFound, searchProducts, slug]);

    useSeo(seoConfig);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
    };

    const requestUserLocation = async (): Promise<{
        latitude: number;
        longitude: number;
    }> => {
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
                () =>
                    reject(
                        new Error(
                            "No se pudo obtener tu ubicación para filtrar por distancia."
                        )
                    ),
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
            );
        });
    };

    const applyFilters = async () => {
        setLocationError(null);

        if (selectedRadius === "any") {
            setAppliedRadius("any");
            setAppliedDynamicValueFilters(selectedDynamicValueFilters);
            setAppliedDynamicRangeFilters(selectedDynamicRangeFilters);
            return;
        }

        let location = userLocation;

        if (!location) {
            try {
                setIsLocating(true);
                location = await requestUserLocation();
                setUserLocation(location);
            } catch (error) {
                setLocationError(
                    error instanceof Error
                        ? error.message
                        : "No se pudo obtener tu ubicación para filtrar por distancia."
                );
                return;
            } finally {
                setIsLocating(false);
            }
        }

        setAppliedRadius(selectedRadius);
        setAppliedDynamicValueFilters(selectedDynamicValueFilters);
        setAppliedDynamicRangeFilters(selectedDynamicRangeFilters);
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

    if (isLoading && !data) {
        return (
            <div className="public-marketplace min-h-screen flex flex-col">
                <Header />
                <main className="public-main public-section flex-1">
                    <LoadingState />
                </main>
                <Footer />
            </div>
        );
    }

    if (notFound || !category) {
        return (
            <div className="public-marketplace min-h-screen flex flex-col">
                <Header />
                <main className="public-main public-section flex-1 flex flex-col items-center justify-center p-4">
                    <h1 className="text-2xl font-medium mb-4">Categoría no encontrada</h1>
                    <p className="text-muted-foreground">
                        La categoría que buscas no existe o ya no está disponible.
                    </p>
                </main>
                <Footer />
            </div>
        );
    }

    return (
        <div className="public-marketplace min-h-screen flex flex-col">
            <Header />
            <main className="public-main public-section flex-1 animate-fade-in">
                <div className="public-container">
                    <div className="pt-3 md:pt-4">
                        <PublicBreadcrumbs items={breadcrumbItems} className="mb-4" />
                        <div className="mb-6">
                            <CategoryHeader
                                name={category.name}
                                description={category.description ?? ""}
                                imageUrl={categoryHeaderImageUrl}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[250px_1fr] xl:grid-cols-[270px_1fr]">
                            <aside className="h-fit rounded-xl border border-border/70 bg-card p-4 lg:sticky lg:top-[var(--public-sticky-offset)]">
                                <h2 className="mb-1 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Filtros</h2>
                                <p className="mb-4 text-sm text-muted-foreground">Refina tu búsqueda</p>

                                <button
                                    type="button"
                                    onClick={() => void applyFilters()}
                                    disabled={isLocating}
                                    className="mb-4 h-9 w-full rounded-lg border border-border bg-transparent text-sm font-medium transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isLocating ? "Obteniendo ubicación..." : "Aplicar filtros"}
                                </button>

                                <label className="mb-1 block text-sm font-medium">Distancia</label>
                                <select
                                    value={selectedRadius}
                                    onChange={(event) => setSelectedRadius(event.target.value)}
                                    className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                >
                                    {DISTANCE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>

                                {isLocating && (
                                    <div className="mt-3 text-sm text-muted-foreground">
                                        Obteniendo ubicación para filtrar distancia...
                                    </div>
                                )}

                                {locationError && (
                                    <div className="mt-3 text-sm text-destructive">{locationError}</div>
                                )}

                                {showDynamicFilterBlock && (
                                    <div className="mt-4">
                                        <DynamicPropertyFiltersSection
                                            availableDynamicFilters={availableDynamicFilters}
                                            selectedDynamicRangeFilters={selectedDynamicRangeFilters}
                                            selectedDynamicValueFilters={selectedDynamicValueFilters}
                                            onToggleDynamicOption={toggleDynamicOption}
                                            onUpdateDynamicRangeFilter={updateDynamicRangeFilter}
                                        />
                                    </div>
                                )}
                            </aside>

                            <section className="lg:pl-1">
                                <CategorySearch
                                    searchQuery={searchQuery}
                                    categoryName={category.name}
                                    onSearchChange={setSearchQuery}
                                    onSearch={handleSearch}
                                />

                                {isFetching && (
                                    <div className="mb-4 text-sm text-muted-foreground">
                                        Actualizando resultados...
                                    </div>
                                )}

                                {searchProducts.length > 0 ? (
                                    <ProductGrid products={searchProducts} />
                                ) : (
                                    <NoProductsFound
                                        searchQuery={searchQuery}
                                        categoryName={category.name}
                                    />
                                )}
                            </section>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default CategoryPage;
