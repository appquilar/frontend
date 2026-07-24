import { useMemo } from "react";
import { Link } from "react-router-dom";

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { usePublicSiteCategories } from "@/application/hooks/usePublicSiteCategories";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import { useSeo } from "@/hooks/useSeo";
import { getPublicMediaUrl } from "@/application/hooks/usePublicMediaUrl";
import { PUBLIC_PATHS, buildAbsolutePublicUrl, buildCategoryPath } from "@/domain/config/publicRoutes";

const CategoriesPage = () => {
    useScrollToTop();
    useSeo({
        title: "Categorías de alquiler | Appquilar",
        description: "Explora todas las categorías disponibles en Appquilar y encuentra productos de alquiler para trabajo, eventos, bricolaje y mucho más.",
        canonicalUrl: buildAbsolutePublicUrl(PUBLIC_PATHS.categories),
    });

    const { allCategories, isLoading } = usePublicSiteCategories();

    const categories = useMemo(() => {
        return [...allCategories].sort((a, b) => a.name.localeCompare(b.name));
    }, [allCategories]);

    return (
        <div className="public-marketplace min-h-screen flex flex-col">
            <Header />
            <main className="public-main public-section flex-1">
                <div className="public-container">
                    <div className="mb-8">
                        <h1 className="text-2xl md:text-3xl font-display font-semibold tracking-tight">
                            Todas las categorías
                        </h1>
                        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
                            Recorre las categorías del marketplace y descubre productos de alquiler pensados para profesionales,
                            particulares, eventos y necesidades puntuales.
                        </p>
                    </div>

                    {isLoading ? (
                        <div className="text-sm text-muted-foreground">
                            Cargando categorías...
                        </div>
                    ) : categories.length > 0 ? (
                        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
                            {categories.map((category, index) => (
                                <Link
                                    key={category.id}
                                    to={buildCategoryPath(category.slug)}
                                    className="group relative overflow-hidden rounded-xl aspect-[5/4] border border-border/60 bg-muted hover:border-primary/30 transition-all duration-300"
                                    style={{ animationDelay: `${index * 40}ms` }}
                                >
                                    <div className="absolute inset-0">
                                        {getPublicMediaUrl(category.featuredImageId ?? category.landscapeImageId, "LARGE") ? (
                                            <img
                                                src={getPublicMediaUrl(category.featuredImageId ?? category.landscapeImageId, "LARGE") ?? ""}
                                                alt={category.name}
                                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
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

                                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-black/10 opacity-80 group-hover:opacity-90 transition-opacity duration-300" />

                                    <div className="absolute inset-0 p-4 md:p-5 flex flex-col justify-end">
                                        <h2 className="text-base md:text-lg font-medium text-white font-display">
                                            {category.name}
                                        </h2>
                                        {category.description ? (
                                            <p className="mt-1 line-clamp-2 text-xs text-white/80">
                                                {category.description}
                                            </p>
                                        ) : null}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="text-sm text-muted-foreground">
                            No hay categorías disponibles.
                        </div>
                    )}
                </div>
            </main>
            <Footer />
        </div>
    );
};

export default CategoriesPage;
