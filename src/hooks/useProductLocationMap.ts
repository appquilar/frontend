import { RefObject, useEffect, useRef } from "react";

import {
    getGoogleMapsMapId,
    loadGoogleMaps,
    subscribeGoogleMapsAuthFailure,
} from "@/infrastructure/google/GoogleMapsLoader";

type ProductLocationPolygonPoint = {
    latitude: number;
    longitude: number;
};

type UseProductLocationMapOptions = {
    containerRef: RefObject<HTMLDivElement | null>;
    city: string;
    state: string;
    coordinates?: [number, number] | null;
    polygon?: ProductLocationPolygonPoint[];
    locationLabel?: string;
    zoom?: number;
    onError?: (message: string | null) => void;
};

type GoogleMapOverlay = google.maps.Polygon | google.maps.marker.AdvancedMarkerElement;

const resolveMapErrorMessage = (error: unknown): string => {
    const message = error instanceof Error ? error.message : String(error ?? "");

    if (message.includes("RefererNotAllowedMapError")) {
        return "Google Maps no permite este dominio. Revisa los referrers autorizados de la API key o abre la ubicación en Google Maps.";
    }

    return "No se pudo cargar el mapa en esta ficha. Puedes abrir la ubicación en Google Maps.";
};

const clearOverlay = (overlay: GoogleMapOverlay | null) => {
    if (!overlay) {
        return;
    }

    if ("setMap" in overlay) {
        overlay.setMap(null);
        return;
    }

    overlay.map = null;
};

export const useProductLocationMap = ({
    containerRef,
    city,
    state,
    coordinates = null,
    polygon,
    locationLabel,
    zoom,
    onError,
}: UseProductLocationMapOptions) => {
    const mapRef = useRef<google.maps.Map | null>(null);
    const overlayRef = useRef<GoogleMapOverlay | null>(null);

    useEffect(() => {
        if (!containerRef.current) {
            return;
        }

        let cancelled = false;

        const reportMapError = (error: unknown) => {
            clearOverlay(overlayRef.current);
            overlayRef.current = null;
            mapRef.current = null;
            containerRef.current?.replaceChildren();
            onError?.(resolveMapErrorMessage(error));
        };

        const unsubscribeAuthFailure = subscribeGoogleMapsAuthFailure((error) => {
            if (!cancelled) {
                reportMapError(error);
            }
        });

        const initMap = async () => {
            try {
                onError?.(null);
                const googleMaps = await loadGoogleMaps(["maps", "marker"]);
                if (cancelled || !containerRef.current) {
                    return;
                }

                const resolvedLocationLabel =
                    locationLabel?.trim() || [city, state].filter(Boolean).join(", ").trim();
                const center = coordinates
                    ? { lat: coordinates[1], lng: coordinates[0] }
                    : await geocodeLocationLabel(googleMaps, resolvedLocationLabel);

                if (!center) {
                    throw new Error("No se pudo resolver una ubicación válida para mostrar el mapa.");
                }

                if (!mapRef.current) {
                    const { Map } = await googleMaps.maps.importLibrary("maps") as google.maps.MapsLibrary;

                    if (cancelled || !containerRef.current) {
                        return;
                    }

                    mapRef.current = new Map(containerRef.current, {
                        center,
                        zoom: zoom ?? (coordinates ? 13 : 10),
                        mapId: getGoogleMapsMapId(),
                        disableDefaultUI: false,
                        streetViewControl: false,
                        mapTypeControl: false,
                    });
                } else {
                    mapRef.current.setCenter(center);
                    mapRef.current.setZoom(zoom ?? (coordinates ? 13 : 10));
                }

                clearOverlay(overlayRef.current);
                overlayRef.current = null;

                if (polygon && polygon.length > 0) {
                    const polygonPath = polygon.map((point) => ({
                        lat: point.latitude,
                        lng: point.longitude,
                    }));

                    const polygonOverlay = new googleMaps.maps.Polygon({
                        paths: polygonPath,
                        strokeColor: "#FF5A1F",
                        strokeOpacity: 0.8,
                        strokeWeight: 2,
                        fillColor: "#FF5A1F",
                        fillOpacity: 0.35,
                        map: mapRef.current,
                    });

                    overlayRef.current = polygonOverlay;

                    const bounds = new googleMaps.maps.LatLngBounds();
                    polygonPath.forEach((point) => bounds.extend(point));
                    mapRef.current.fitBounds(bounds);
                    return;
                }

                const { AdvancedMarkerElement, PinElement } =
                    await googleMaps.maps.importLibrary("marker") as google.maps.MarkerLibrary;

                if (cancelled || !mapRef.current) {
                    return;
                }

                const marker = new AdvancedMarkerElement({
                    position: center,
                    map: mapRef.current,
                    title: resolvedLocationLabel || `${city}, ${state}`,
                });

                marker.append(
                    new PinElement({
                        background: "#F19D70",
                        borderColor: "#F19D70",
                        scale: 1.1,
                    })
                );

                overlayRef.current = marker;
            } catch (error) {
                console.error("Error initializing Google Maps:", error);
                reportMapError(error);
            }
        };

        void initMap();

        return () => {
            cancelled = true;
            unsubscribeAuthFailure();
            clearOverlay(overlayRef.current);
            overlayRef.current = null;
        };
    }, [city, containerRef, coordinates, locationLabel, onError, polygon, state, zoom]);
};

const geocodeLocationLabel = async (
    googleMaps: typeof google,
    locationLabel: string
): Promise<{ lat: number; lng: number } | null> => {
    if (!locationLabel) {
        return null;
    }

    const geocoder = new googleMaps.maps.Geocoder();

    return new Promise((resolve) => {
        geocoder.geocode({ address: locationLabel }, (results, status) => {
            if (status !== "OK" || !results?.length) {
                resolve(null);
                return;
            }

            const location = results[0]?.geometry?.location;
            if (!location) {
                resolve(null);
                return;
            }

            resolve({ lat: location.lat(), lng: location.lng() });
        });
    });
};
