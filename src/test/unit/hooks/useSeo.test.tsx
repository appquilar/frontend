import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSeo } from "@/hooks/useSeo";
import type { PlatformSeoConfig } from "@/domain/models/PlatformSeo";

const SeoHarness = ({ config }: { config: PlatformSeoConfig }) => {
  useSeo(config);
  return null;
};

describe("useSeo", () => {
  it("writes public seo metadata into the document head", () => {
    render(
      <SeoHarness
        config={{
          title: "Categorías de alquiler | Appquilar",
          description: "Explora categorías de alquiler en España.",
          canonicalUrl: "https://appquilar.com/categorias",
          robots: "index,follow",
          keywords: ["alquiler", "categorías"],
          ogType: "website",
          jsonLd: [{ "@context": "https://schema.org", "@type": "CollectionPage" }],
        }}
      />
    );

    expect(document.title).toBe("Categorías de alquiler | Appquilar");
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(
      "Explora categorías de alquiler en España."
    );
    expect(document.querySelector('meta[name="keywords"]')?.getAttribute("content")).toBe(
      "alquiler, categorías"
    );
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("index,follow");
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      "https://appquilar.com/categorias"
    );
    expect(document.querySelectorAll('script[data-appquilar-seo-jsonld="true"]')).toHaveLength(1);
  });

  it("writes open graph and twitter metadata when available", () => {
    render(
      <SeoHarness
        config={{
          title: "Empresa destacada | Appquilar",
          description: "Perfil público con catálogo y ubicación.",
          canonicalUrl: "https://appquilar.com/empresa/acme",
          ogTitle: "Empresa destacada",
          ogDescription: "Catálogo profesional para alquilar.",
          ogImage: "https://appquilar.com/company.jpg",
          ogUrl: "https://appquilar.com/empresa/acme",
          ogType: "profile",
          twitterCard: "summary_large_image",
          twitterTitle: "Empresa destacada",
          twitterDescription: "Catálogo profesional para alquilar.",
          twitterImage: "https://appquilar.com/company-twitter.jpg",
        }}
      />
    );

    expect(document.querySelector('meta[property="og:title"]')?.getAttribute("content")).toBe(
      "Empresa destacada"
    );
    expect(document.querySelector('meta[property="og:description"]')?.getAttribute("content")).toBe(
      "Catálogo profesional para alquilar."
    );
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute("content")).toBe(
      "https://appquilar.com/company.jpg"
    );
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute("content")).toBe(
      "https://appquilar.com/empresa/acme"
    );
    expect(document.querySelector('meta[property="og:type"]')?.getAttribute("content")).toBe("profile");
    expect(document.querySelector('meta[name="twitter:card"]')?.getAttribute("content")).toBe(
      "summary_large_image"
    );
    expect(document.querySelector('meta[name="twitter:title"]')?.getAttribute("content")).toBe(
      "Empresa destacada"
    );
    expect(document.querySelector('meta[name="twitter:description"]')?.getAttribute("content")).toBe(
      "Catálogo profesional para alquilar."
    );
    expect(document.querySelector('meta[name="twitter:image"]')?.getAttribute("content")).toBe(
      "https://appquilar.com/company-twitter.jpg"
    );
  });

  it("replaces stale JSON-LD scripts on rerender and cleans them up on unmount", () => {
    const { rerender, unmount } = render(
      <SeoHarness
        config={{
          title: "Producto | Appquilar",
          description: "Producto publicado",
          canonicalUrl: "https://appquilar.com/producto/taladro",
          jsonLd: [
            { "@context": "https://schema.org", "@type": "Product" },
            { "@context": "https://schema.org", "@type": "BreadcrumbList" },
          ],
        }}
      />
    );

    expect(document.querySelectorAll('script[data-appquilar-seo-jsonld="true"]')).toHaveLength(2);

    rerender(
      <SeoHarness
        config={{
          title: "Buscar | Appquilar",
          description: "Buscar productos",
          canonicalUrl: "https://appquilar.com/buscar?q=taladro",
          robots: "noindex,follow",
          jsonLd: [{ "@context": "https://schema.org", "@type": "SearchResultsPage" }],
        }}
      />
    );

    const jsonLdScripts = document.querySelectorAll('script[data-appquilar-seo-jsonld="true"]');
    expect(jsonLdScripts).toHaveLength(1);
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex,follow");

    unmount();

    expect(document.querySelectorAll('script[data-appquilar-seo-jsonld="true"]')).toHaveLength(0);
  });

  it("ignores empty configs safely", () => {
    render(<SeoHarness config={undefined as unknown as PlatformSeoConfig} />);

    expect(document.querySelectorAll('script[data-appquilar-seo-jsonld="true"]')).toHaveLength(0);
  });
});
