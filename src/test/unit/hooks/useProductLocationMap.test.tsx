import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useProductLocationMap } from "@/hooks/useProductLocationMap";

const {
    getGoogleMapsMapIdMock,
    loadGoogleMapsMock,
    mapConstructorMock,
    mapSetCenterMock,
    mapSetZoomMock,
    mapFitBoundsMock,
    polygonSetMapMock,
    polygonConstructorMock,
    markerAppendMock,
    geocodeMock,
    authFailureListeners,
} = vi.hoisted(() => ({
    getGoogleMapsMapIdMock: vi.fn(),
    loadGoogleMapsMock: vi.fn(),
    mapConstructorMock: vi.fn(),
    mapSetCenterMock: vi.fn(),
    mapSetZoomMock: vi.fn(),
    mapFitBoundsMock: vi.fn(),
    polygonSetMapMock: vi.fn(),
    polygonConstructorMock: vi.fn(),
    markerAppendMock: vi.fn(),
    geocodeMock: vi.fn(),
    authFailureListeners: [] as Array<(error: Error) => void>,
}));

vi.mock("@/infrastructure/google/GoogleMapsLoader", () => ({
    getGoogleMapsMapId: () => getGoogleMapsMapIdMock(),
    loadGoogleMaps: (...args: unknown[]) => loadGoogleMapsMock(...args),
    subscribeGoogleMapsAuthFailure: (listener: (error: Error) => void) => {
        authFailureListeners.push(listener);

        return () => {
            const index = authFailureListeners.indexOf(listener);
            if (index >= 0) {
                authFailureListeners.splice(index, 1);
            }
        };
    },
}));

const createGoogleMapsApi = () => {
    class MapMock {
        constructor(...args: unknown[]) {
            mapConstructorMock(...args);
        }

        setCenter = mapSetCenterMock;
        setZoom = mapSetZoomMock;
        fitBounds = mapFitBoundsMock;
    }

    class PolygonMock {
        public map: unknown = null;

        constructor(...args: unknown[]) {
            polygonConstructorMock(...args);
        }

        setMap = polygonSetMapMock;
    }

    class AdvancedMarkerElementMock {
        public map: unknown;
        public title: string;

        constructor(input: { map: unknown; title: string }) {
            this.map = input.map;
            this.title = input.title;
        }

        append = markerAppendMock;
    }

    class PinElementMock {
        constructor(public readonly config: unknown) {}
    }

    class LatLngBoundsMock {
        public readonly points: Array<{ lat: number; lng: number }> = [];

        extend(point: { lat: number; lng: number }) {
            this.points.push(point);
        }
    }

    class GeocoderMock {
        geocode = geocodeMock;
    }

    return {
        maps: {
            Polygon: PolygonMock,
            Geocoder: GeocoderMock,
            LatLngBounds: LatLngBoundsMock,
            importLibrary: vi.fn(async (library: string) => {
                if (library === "maps") {
                    return {
                        Map: MapMock,
                    };
                }

                return {
                    AdvancedMarkerElement: AdvancedMarkerElementMock,
                    PinElement: PinElementMock,
                };
            }),
        },
    };
};

describe("useProductLocationMap", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        authFailureListeners.splice(0, authFailureListeners.length);
        getGoogleMapsMapIdMock.mockReturnValue("map-id");
        loadGoogleMapsMock.mockResolvedValue(createGoogleMapsApi());
    });

    it("does nothing until the map container is mounted", async () => {
        const onError = vi.fn();

        renderHook(() =>
            useProductLocationMap({
                containerRef: {
                    current: null,
                },
                city: "Madrid",
                state: "Madrid",
                onError,
            })
        );

        await act(async () => {
            await Promise.resolve();
        });

        expect(loadGoogleMapsMock).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
    });

    it("creates a marker-based map when coordinates are available and clears the marker on cleanup", async () => {
        const onError = vi.fn();
        const container = document.createElement("div");

        const { unmount } = renderHook(() =>
            useProductLocationMap({
                containerRef: {
                    current: container,
                },
                city: "Madrid",
                state: "Madrid",
                coordinates: [-3.7038, 40.4168],
                locationLabel: "Centro, Madrid",
                onError,
            })
        );

        await waitFor(() => {
            expect(loadGoogleMapsMock).toHaveBeenCalledWith(["maps", "marker"]);
        });

        expect(onError).toHaveBeenCalledWith(null);
        expect(mapConstructorMock).toHaveBeenCalledWith(
            container,
            expect.objectContaining({
                center: {
                    lat: 40.4168,
                    lng: -3.7038,
                },
                zoom: 13,
                mapId: "map-id",
            })
        );
        expect(markerAppendMock).toHaveBeenCalledTimes(1);

        unmount();
        expect(markerAppendMock).toHaveBeenCalledTimes(1);
    });

    it("uses geocoding when coordinates are missing and renders polygon coverage", async () => {
        const onError = vi.fn();
        const container = document.createElement("div");

        geocodeMock.mockImplementation(
            (
                _request: unknown,
                callback: (
                    results: Array<{ geometry: { location: { lat: () => number; lng: () => number } } }>,
                    status: string
                ) => void
            ) => {
                callback(
                    [
                        {
                            geometry: {
                                location: {
                                    lat: () => 41.3874,
                                    lng: () => 2.1686,
                                },
                            },
                        },
                    ],
                    "OK"
                );
            }
        );

        renderHook(() =>
            useProductLocationMap({
                containerRef: {
                    current: container,
                },
                city: "Barcelona",
                state: "Catalunya",
                polygon: [
                    { latitude: 41.39, longitude: 2.17 },
                    { latitude: 41.4, longitude: 2.19 },
                ],
                onError,
            })
        );

        await waitFor(() => {
            expect(polygonConstructorMock).toHaveBeenCalled();
        });

        expect(geocodeMock).toHaveBeenCalled();
        expect(mapFitBoundsMock).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(null);
    });

    it("reports a public-facing error when geocoding cannot resolve a valid location", async () => {
        const onError = vi.fn();
        const container = document.createElement("div");

        geocodeMock.mockImplementation(
            (
                _request: unknown,
                callback: (results: unknown[], status: string) => void
            ) => {
                callback([], "ZERO_RESULTS");
            }
        );

        renderHook(() =>
            useProductLocationMap({
                containerRef: {
                    current: container,
                },
                city: "Unknown",
                state: "",
                onError,
            })
        );

        await waitFor(() => {
            expect(onError).toHaveBeenCalledWith(
                "No se pudo cargar el mapa en esta ficha. Puedes abrir la ubicación en Google Maps."
            );
        });
    });

    it("reports Google auth failures and lets the UI remove the broken map", async () => {
        const onError = vi.fn();
        const container = document.createElement("div");
        container.appendChild(document.createElement("span"));

        renderHook(() =>
            useProductLocationMap({
                containerRef: {
                    current: container,
                },
                city: "Madrid",
                state: "Madrid",
                coordinates: [-3.7038, 40.4168],
                onError,
            })
        );

        await waitFor(() => {
            expect(authFailureListeners).toHaveLength(1);
        });

        act(() => {
            authFailureListeners[0](new Error("RefererNotAllowedMapError"));
        });

        expect(onError).toHaveBeenCalledWith(
            "Google Maps no permite este dominio. Revisa los referrers autorizados de la API key o abre la ubicación en Google Maps."
        );
        expect(container.childElementCount).toBe(0);
    });
});
