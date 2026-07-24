import { useEffect, useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { MapPin } from "lucide-react";

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ProductGrid from "@/components/category/ProductGrid";
import PublicBreadcrumbs from "@/components/common/PublicBreadcrumbs";
import PublicCompanyLocationMap from "@/components/company/PublicCompanyLocationMap";
import { Button } from "@/components/ui/button";
import { usePublicCompanyProfile } from "@/application/hooks/usePublicCompanyProfile";
import { usePublicCompanyProducts } from "@/application/hooks/usePublicCompanyProducts";
import { getPublicMediaUrl } from "@/application/hooks/usePublicMediaUrl";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import { useSeo } from "@/hooks/useSeo";
import { useAuthModalLauncher } from "@/hooks/useAuthModalLauncher";
import { useAuth } from "@/context/AuthContext";
import type { Product as DomainProduct } from "@/domain/models/Product";
import {
  PUBLIC_PATHS,
  buildAbsolutePublicUrl,
  buildCompanyPagePath,
  buildProductPath,
} from "@/domain/config/publicRoutes";
const PRODUCTS_PER_PAGE = 12;
const EMPTY_PRODUCTS: DomainProduct[] = [];

const stripHtml = (value: string | null | undefined): string =>
  (value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const joinLocationParts = (...parts: Array<string | null | undefined>): string =>
  parts
    .filter((item): item is string => Boolean(item && item.trim().length > 0))
    .join(", ");

const buildAddressLabel = (
  address:
    | {
        street: string | null;
        street2: string | null;
        city: string | null;
        postalCode: string | null;
        state: string | null;
        country: string | null;
      }
    | null
    | undefined
): string =>
  joinLocationParts(
    [address?.street, address?.street2].filter(Boolean).join(" ").trim() || null,
    address?.postalCode,
    address?.city,
    address?.state,
    address?.country
  );

const buildOrganizationAddress = (
  company:
    | {
        address: {
          street: string | null;
          street2: string | null;
          city: string | null;
          postalCode: string | null;
          state: string | null;
          country: string | null;
        } | null;
        location: {
          city: string | null;
          state: string | null;
          country: string | null;
        };
      }
    | null
) => {
  if (!company) {
    return undefined;
  }

  if (company.address) {
    return {
      "@type": "PostalAddress",
      streetAddress: joinLocationParts(company.address.street, company.address.street2) || undefined,
      addressLocality: company.address.city ?? undefined,
      addressRegion: company.address.state ?? undefined,
      postalCode: company.address.postalCode ?? undefined,
      addressCountry: company.address.country ?? undefined,
    };
  }

  if (company.location.city || company.location.state || company.location.country) {
    return {
      "@type": "PostalAddress",
      addressLocality: company.location.city ?? undefined,
      addressRegion: company.location.state ?? undefined,
      addressCountry: company.location.country ?? undefined,
    };
  }

  return undefined;
};

const PublicCompanyPage = () => {
  useScrollToTop();

  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const { openSignIn, openSignUp } = useAuthModalLauncher();
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const companyProfileQuery = usePublicCompanyProfile(slug ?? null);
  const companyProductsQuery = usePublicCompanyProducts(slug ?? null, page, PRODUCTS_PER_PAGE);
  const company = companyProfileQuery.data ?? null;
  const domainProducts = companyProductsQuery.data?.data ?? EMPTY_PRODUCTS;
  const totalProducts = companyProductsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalProducts / PRODUCTS_PER_PAGE));

  const approximateLocationLabel =
    company?.location.displayLabel ??
    joinLocationParts(company?.location.city, company?.location.state, company?.location.country);
  const exactLocationLabel = buildAddressLabel(company?.address);
  const displayLocationLabel = exactLocationLabel || approximateLocationLabel;
  const shouldShowApproximateLocation = !isAuthenticated || !company?.address || !company?.geoLocation;
  const mapLocationLabel =
    (shouldShowApproximateLocation ? approximateLocationLabel : displayLocationLabel) ||
    displayLocationLabel ||
    "";

  const companyLogoUrl = useMemo(
    () => getPublicMediaUrl(company?.profilePictureId, "MEDIUM"),
    [company?.profilePictureId]
  );
  const companyHeaderUrl = useMemo(
    () => getPublicMediaUrl(company?.headerImageId, "LARGE"),
    [company?.headerImageId]
  );

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
        name: company?.name ?? product.ownerData?.name ?? "",
        slug: company?.slug ?? slug ?? "",
      },
      category: {
        id: product.category?.id ?? "",
        name: product.category?.name ?? "",
        slug: product.category?.slug ?? "",
      },
      rating: product.rating ?? 0,
      reviewCount: product.reviewCount ?? 0,
    }));
  }, [company?.name, company?.slug, domainProducts, slug]);

  const breadcrumbItems = useMemo(
    () => [
      { label: "Inicio", to: PUBLIC_PATHS.home },
      ...(company?.name ? [{ label: company.name }] : []),
    ],
    [company?.name]
  );

  const seoConfig = useMemo(() => {
    if (!slug) {
      return {
        title: "Empresas de alquiler | Appquilar",
        description: "Perfiles públicos de empresas y catálogos de alquiler en Appquilar.",
        canonicalUrl: buildAbsolutePublicUrl(PUBLIC_PATHS.home),
      };
    }

    if (companyProfileQuery.isError) {
      return {
        title: "Empresa no encontrada | Appquilar",
        description: "La empresa que buscas no existe o ya no está disponible.",
        canonicalUrl: buildAbsolutePublicUrl(buildCompanyPagePath(slug, page)),
        robots: "noindex,follow" as const,
      };
    }

    if (!company) {
      return {
        title: "Empresa | Appquilar",
        description: "Catálogo público de empresa en Appquilar.",
        canonicalUrl: buildAbsolutePublicUrl(buildCompanyPagePath(slug, page)),
      };
    }

    const canonicalPath = buildCompanyPagePath(company.slug, page);
    const plainDescription = stripHtml(company.description);
    const description =
      plainDescription ||
      (approximateLocationLabel
        ? `Explora los productos publicados por ${company.name} en ${approximateLocationLabel}.`
        : `Explora los productos publicados por ${company.name} en Appquilar.`);

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
      products.length > 0
        ? {
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: products.map((product, index) => ({
              "@type": "ListItem",
              position: (page - 1) * PRODUCTS_PER_PAGE + index + 1,
              url: buildAbsolutePublicUrl(buildProductPath(product.slug)),
              name: product.name,
            })),
          }
        : null;

    return {
      title: `${company.name} | Appquilar`,
      description,
      canonicalUrl: buildAbsolutePublicUrl(canonicalPath),
      jsonLd: [
        breadcrumbJsonLd,
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          name: company.name,
          description: plainDescription || undefined,
          url: buildAbsolutePublicUrl(buildCompanyPagePath(company.slug)),
          logo: companyLogoUrl ?? undefined,
          address: buildOrganizationAddress(company),
        },
        ...(itemListJsonLd ? [itemListJsonLd] : []),
      ],
    };
  }, [
    approximateLocationLabel,
    breadcrumbItems,
    company,
    companyLogoUrl,
    companyProfileQuery.isError,
    page,
    products,
    slug,
  ]);

  useSeo(seoConfig);

  const setPage = (nextPage: number) => {
    const params = new URLSearchParams(searchParams);
    if (nextPage <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(nextPage));
    }

    setSearchParams(params);
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  useEffect(() => {
    if (companyProductsQuery.isLoading || totalProducts === 0 || page <= totalPages) {
      return;
    }

    const params = new URLSearchParams(searchParams);
    if (totalPages <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(totalPages));
    }

    setSearchParams(params);
  }, [companyProductsQuery.isLoading, page, searchParams, setSearchParams, totalPages, totalProducts]);

  const isLoading = companyProfileQuery.isLoading || companyProductsQuery.isLoading;
  const isError = companyProfileQuery.isError;
  const hasCatalogError = companyProductsQuery.isError;

  return (
    <div className="public-marketplace min-h-screen flex flex-col">
      <Header />

      <main className="public-main public-section flex-1">
        <div className="public-container space-y-6">
          <PublicBreadcrumbs items={breadcrumbItems} />

          {isLoading && (
            <div className="space-y-4">
              <div className="h-56 animate-pulse rounded-3xl bg-muted" />
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="h-72 animate-pulse rounded-2xl bg-muted" />
                ))}
              </div>
            </div>
          )}

          {!isLoading && isError && (
            <div className="rounded-3xl border bg-card p-8 text-center">
              <h1 className="text-2xl font-semibold">Empresa no encontrada</h1>
              <p className="mt-3 text-sm text-muted-foreground">
                No hemos podido cargar el perfil público de esta empresa.
              </p>
            </div>
          )}

          {!isLoading && !isError && company && (
            <>
              <section className="overflow-hidden rounded-3xl border border-border/60 bg-card">
                <div className="relative h-28 overflow-hidden sm:h-36">
                  {companyHeaderUrl ? (
                    <>
                      <img
                        src={companyHeaderUrl}
                        alt={`Cabecera de ${company.name}`}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.08),rgba(15,23,42,0.5))]" />
                    </>
                  ) : (
                    <div className="h-full w-full bg-[linear-gradient(120deg,rgba(246,158,101,0.22),rgba(250,242,236,0.95),rgba(32,41,57,0.08))]" />
                  )}
                </div>

                <div className="px-5 pb-6 pt-5 sm:px-7 sm:pt-6">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-background shadow-sm sm:h-24 sm:w-24">
                        {companyLogoUrl ? (
                          <img
                            src={companyLogoUrl}
                            alt={company.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-3xl font-semibold text-primary">
                            {company.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                          Empresa
                        </p>
                        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                          {company.name}
                        </h1>
                        {displayLocationLabel ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin size={16} />
                            <span>{displayLocationLabel}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <Button asChild variant="outline" className="w-full sm:w-auto xl:self-center">
                      <Link to={PUBLIC_PATHS.search}>Explorar más productos</Link>
                    </Button>
                  </div>

                  <div className="mt-5 max-w-3xl">
                    <p className="text-sm leading-7 text-muted-foreground">
                      {stripHtml(company.description) || "Catálogo público de productos publicados en Appquilar."}
                    </p>
                  </div>
                </div>
              </section>

              {!isAuthenticated && (
                <section className="rounded-3xl border border-primary/10 bg-[linear-gradient(135deg,rgba(250,242,236,0.95),rgba(255,255,255,0.98))] p-5 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="max-w-2xl">
                      <p className="text-base font-medium text-foreground">
                        Crea tu cuenta para ver la ubicación exacta y contactar con este proveedor.
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        La ficha pública sigue siendo indexable, pero reservamos los datos más sensibles para usuarios registrados.
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Button
                        variant="outline"
                        onClick={() => openSignIn("Inicia sesión para contactar con este proveedor.")}
                      >
                        Contactar proveedor
                      </Button>
                      <Button onClick={() => openSignUp("Crea tu cuenta para ver la ubicación exacta del proveedor.")}>
                        Crear cuenta gratis
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => openSignIn("Inicia sesión para ver la ubicación exacta del proveedor.")}
                      >
                        Ya tengo cuenta
                      </Button>
                    </div>
                  </div>
                </section>
              )}

              {displayLocationLabel ? (
                <PublicCompanyLocationMap
                  title={shouldShowApproximateLocation ? "Ubicación aproximada" : "Ubicación"}
                  locationLabel={mapLocationLabel}
                  isApproximate={shouldShowApproximateLocation}
                  coordinates={shouldShowApproximateLocation ? null : company.geoLocation}
                />
              ) : null}

              <section className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight">Productos publicados</h2>
                    <p className="text-sm text-muted-foreground">
                      Catálogo público paginado de esta empresa.
                    </p>
                  </div>
                </div>

                {hasCatalogError ? (
                  <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-6 text-sm text-destructive">
                    No se pudo cargar el catálogo público de esta empresa.
                  </div>
                ) : products.length > 0 ? (
                  <>
                    <ProductGrid products={products} />

                    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
                      <Button
                        variant="outline"
                        onClick={() => setPage(page - 1)}
                        disabled={page <= 1}
                        className="w-full sm:w-auto"
                      >
                        Anterior
                      </Button>

                      <p className="text-center text-sm text-muted-foreground">
                        Página {page} de {totalPages}
                      </p>

                      <Button
                        variant="outline"
                        onClick={() => setPage(page + 1)}
                        disabled={page >= totalPages}
                        className="w-full sm:w-auto"
                      >
                        Siguiente
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
                    Esta empresa todavía no tiene productos publicados.
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PublicCompanyPage;
