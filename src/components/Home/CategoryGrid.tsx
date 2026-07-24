import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { usePublicSiteCategories } from "@/application/hooks/usePublicSiteCategories";
import { getPublicMediaUrl } from "@/application/hooks/usePublicMediaUrl";
import { PUBLIC_PATHS, buildCategoryPath } from "@/domain/config/publicRoutes";

interface FeaturedCategoryVM {
    id: string;
    name: string;
    slug: string;
    imageUrl: string;
    count?: number;
}

/**
 * Componente de cuadrícula de categorías para la página de inicio
 */
const CategoryGrid = () => {
    const {
        allCategories = [],
        featuredCategories = [],
        isLoading,
    } = usePublicSiteCategories();

    const featuredVM = useMemo<FeaturedCategoryVM[]>(() => {
        if (isLoading) {
            return [];
        }

        const categories = featuredCategories.length > 0
            ? featuredCategories
            : allCategories.slice(0, 3);

        return categories.map((c) => ({
                id: c.id,
                name: c.name,
                slug: c.slug,
                imageUrl: getPublicMediaUrl(c.featuredImageId ?? c.landscapeImageId, "LARGE") ?? "",
            }));
    }, [allCategories, featuredCategories, isLoading]);

    // Precarga (cuando ya tengas urls)
    useEffect(() => {
        featuredVM.forEach((category) => {
            if (!category.imageUrl) return;
            const img = new Image();
            img.src = category.imageUrl;
        });
    }, [featuredVM]);

    return (
        <section className="public-section">
            <div className="public-container">
                <div className="max-w-3xl mx-auto text-center">
                    <div className="inline-flex items-center justify-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-primary">
                        Categorías destacadas
                    </div>
                    <h2 className="mt-4 text-2xl md:text-3xl font-display font-semibold tracking-tight">
                        Explora por categorías
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Encuentra rápido lo que necesitas según el tipo de producto.
                    </p>
                </div>

                <div className="mt-5 flex justify-center">
                    <Link
                        to={PUBLIC_PATHS.categories}
                        className="inline-flex items-center rounded-full border border-border/70 bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
                    >
                        Ver todas las categorías
                    </Link>
                </div>

                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
                    {featuredVM.map((category, index) => (
                        <Link
                            key={category.id}
                            to={buildCategoryPath(category.slug)}
                            className="group relative overflow-hidden rounded-xl aspect-[5/4] md:aspect-[16/10] transition-all duration-350 hover-glow"
                            style={{ animationDelay: `${index * 50}ms` }}
                        >
                            {/* Imagen de categoría */}
                            <div className="absolute inset-0 bg-muted">
                                {category.imageUrl ? (
                                    <img
                                        src={category.imageUrl}
                                        alt={category.name}
                                        className="w-full h-full object-cover transition-transform duration-450 ease-spring group-hover:scale-105"
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/30 via-primary/15 to-muted">
                                        <span className="text-5xl font-semibold text-primary/45" aria-hidden="true">
                                            {category.name.slice(0, 1).toUpperCase()}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Superposición de gradiente */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-black/10 transition-opacity duration-350 group-hover:opacity-90"></div>

                            {/* Contenido */}
                            <div className="absolute inset-0 p-4 md:p-5 flex flex-col justify-end">
                                <h3 className="text-base md:text-lg font-medium text-white font-display">{category.name}</h3>
                                {typeof category.count === "number" ? (
                                    <p className="text-xs text-white/80 mt-1">{category.count} productos</p>
                                ) : null}
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default CategoryGrid;
