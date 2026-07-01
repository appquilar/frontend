import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PublicCompanyLocationMap from "@/components/company/PublicCompanyLocationMap";

const useProductLocationMapMock = vi.fn();

vi.mock("@/hooks/useProductLocationMap", () => ({
  useProductLocationMap: (...args: unknown[]) => useProductLocationMapMock(...args),
}));

describe("PublicCompanyLocationMap", () => {
  beforeEach(() => {
    useProductLocationMapMock.mockReset();
  });

  it("renders the public location map without using the Google Maps embed iframe", () => {
    const { container } = render(
      <PublicCompanyLocationMap
        title="Ubicación aproximada"
        locationLabel="Mataró, Catalunya, España"
        isApproximate
      />
    );

    expect(screen.getByText("Mataró, Catalunya, España")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir en Google Maps" })).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=Matar%C3%B3%2C%20Catalunya%2C%20Espa%C3%B1a"
    );
    expect(
      container.querySelector('[aria-label="Mapa de ubicación aproximada"]')
    ).toBeInTheDocument();
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("returns nothing when the location label is empty after trimming", () => {
    const { container } = render(
      <PublicCompanyLocationMap
        title="Ubicación"
        locationLabel="   "
        isApproximate={false}
      />
    );

    expect(container).toBeEmptyDOMElement();
    expect(useProductLocationMapMock).toHaveBeenCalledWith(
      expect.objectContaining({
        locationLabel: "",
      })
    );
  });

  it("uses exact coordinates for the maps link and renders the exact-location copy", () => {
    const { container } = render(
      <PublicCompanyLocationMap
        title="Ubicación"
        locationLabel="Madrid, España"
        isApproximate={false}
        coordinates={{
          latitude: 40.4168,
          longitude: -3.7038,
        }}
      />
    );

    expect(screen.getByText("Madrid, España")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Ubicación exacta disponible para ayudarte a ubicar al proveedor con precisión."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir en Google Maps" })).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=40.4168%2C-3.7038"
    );
    expect(container.querySelector('[aria-label="Mapa de ubicación"]')).toBeInTheDocument();
    expect(useProductLocationMapMock).toHaveBeenCalledWith(
      expect.objectContaining({
        locationLabel: "Madrid, España",
        coordinates: [-3.7038, 40.4168],
        zoom: 13,
      })
    );
  });

  it("shows the fallback message when the map hook reports an error", () => {
    useProductLocationMapMock.mockImplementation(
      ({ onError }: { onError?: (message: string | null) => void }) => {
        queueMicrotask(() => {
          onError?.("No se pudo cargar el mapa.");
        });
      }
    );

    const { container } = render(
      <PublicCompanyLocationMap
        title="Ubicación aproximada"
        locationLabel="Mataró, Catalunya, España"
        isApproximate
      />
    );

    return waitFor(() => {
      expect(screen.getByText("No se pudo cargar el mapa.")).toBeInTheDocument();
      expect(
        container.querySelector('[aria-label="Mapa de ubicación aproximada"]')
      ).not.toBeInTheDocument();
    });
  });
});
