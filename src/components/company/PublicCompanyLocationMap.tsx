import { useRef, useState } from "react";
import { MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useProductLocationMap } from "@/hooks/useProductLocationMap";

type PublicCompanyLocationMapProps = {
  title: string;
  locationLabel: string;
  isApproximate: boolean;
  coordinates?: {
    latitude: number;
    longitude: number;
  } | null;
};

const buildMapQuery = (
  locationLabel: string,
  coordinates?: { latitude: number; longitude: number } | null
): string => {
  if (coordinates) {
    return `${coordinates.latitude},${coordinates.longitude}`;
  }

  return locationLabel;
};

const PublicCompanyLocationMap = ({
  title,
  locationLabel,
  isApproximate,
  coordinates = null,
}: PublicCompanyLocationMapProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const normalizedLocationLabel = locationLabel.trim();
  const mapQuery = buildMapQuery(normalizedLocationLabel, coordinates);
  const searchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;
  const coordinateTuple = coordinates
    ? ([coordinates.longitude, coordinates.latitude] as [number, number])
    : null;

  useProductLocationMap({
    containerRef: mapContainerRef,
    city: "",
    state: "",
    coordinates: coordinateTuple,
    locationLabel: normalizedLocationLabel,
    zoom: isApproximate ? 10 : 13,
    onError: setMapsError,
  });

  if (!normalizedLocationLabel) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-foreground">
            <MapPin className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">{title}</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {normalizedLocationLabel}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isApproximate
              ? "Mostramos una referencia aproximada para proteger la ubicación exacta hasta que inicies sesión."
              : "Ubicación exacta disponible para ayudarte a ubicar al proveedor con precisión."}
          </p>
        </div>

        {!mapsError && (
          <Button asChild variant="outline" className="shrink-0">
            <a href={searchUrl} target="_blank" rel="noreferrer">
              Abrir en Google Maps
            </a>
          </Button>
        )}
      </div>

      {mapsError ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>{mapsError}</p>
          <a href={searchUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex font-medium underline">
            Abrir en Google Maps
          </a>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-border/50 bg-muted/40">
          <div
            ref={mapContainerRef}
            aria-label={isApproximate ? "Mapa de ubicación aproximada" : "Mapa de ubicación"}
            className="h-72 w-full"
          />
        </div>
      )}
    </section>
  );
};

export default PublicCompanyLocationMap;
