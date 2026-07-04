// src/components/dashboard/hooks/useAddressMap.ts

import { useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import {
    getMarkerCoordinates,
    mountAddressAutocomplete,
    createMapWithDraggableMarker,
    reverseGeocode,
    type LatLngLiteral,
} from "@/infrastructure/google/GoogleMapsAdapter";
import { subscribeGoogleMapsAuthFailure } from "@/infrastructure/google/GoogleMapsLoader";

/**
 * Hook que encapsula toda la lógica de:
 * - carga de Google Maps
 * - creación del mapa + marker arrastrable
 * - autocomplete para buscar dirección
 * - sincronización con el formulario RHF
 */
type AddressMapFormValues = {
    street?: string;
    street2?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
};

export function useAddressMap<T extends AddressMapFormValues>(
    addressForm: UseFormReturn<T>,
    enabled: boolean = true
) {
    const autocompleteContainerRef = useRef<HTMLDivElement | null>(null);
    const mapContainerRef = useRef<HTMLDivElement | null>(null);

    const [isMapsLoading, setIsMapsLoading] = useState(false);
    const [mapsError, setMapsError] = useState<string | null>(null);

    useEffect(() => {
        let disposeAutocomplete: (() => void) | null = null;
        let marker: google.maps.marker.AdvancedMarkerElement | null = null;
        let map: google.maps.Map | null = null;
        let isMounted = true;

        if (!enabled || !mapContainerRef.current) return;

        const unsubscribeAuthFailure = subscribeGoogleMapsAuthFailure(() => {
            if (!isMounted) {
                return;
            }

            mapContainerRef.current?.replaceChildren();
            setIsMapsLoading(false);
            setMapsError(
                "Google Maps no permite este dominio. Puedes guardar la dirección manualmente o abrir la ubicación en Google Maps.",
            );
        });

        const init = async () => {
            try {
                setIsMapsLoading(true);
                setMapsError(null);

                const latFromForm = addressForm.getValues("latitude" as any) as number | undefined;
                const lngFromForm = addressForm.getValues("longitude" as any) as number | undefined;

                const hasCoords =
                    typeof latFromForm === "number" && typeof lngFromForm === "number";

                const initialPosition: LatLngLiteral = hasCoords
                    ? { lat: latFromForm as number, lng: lngFromForm as number }
                    : { lat: 40.4168, lng: -3.7038 }; // Madrid

                const { map: createdMap, marker: createdMarker } =
                    await createMapWithDraggableMarker({
                        container: mapContainerRef.current as HTMLDivElement,
                        initialPosition,
                        zoom: hasCoords ? 15 : 6,
                        draggable: true,
                    });

                if (!isMounted) return;

                map = createdMap;
                marker = createdMarker;

                if (hasCoords) {
                    addressForm.setValue("latitude" as any, initialPosition.lat as any);
                    addressForm.setValue("longitude" as any, initialPosition.lng as any);
                }

                // Cuando se suelta el marker -> coords + reverse geocode
                marker.addListener("dragend", async () => {
                    if (!marker) return;
                    const coords = getMarkerCoordinates(marker);
                    if (!coords) return;

                    addressForm.setValue("latitude" as any, coords.lat as any, { shouldValidate: true });
                    addressForm.setValue("longitude" as any, coords.lng as any, { shouldValidate: true });

                    const addr = await reverseGeocode(coords);

                    if (addr.street) {
                        addressForm.setValue("street" as any, addr.street as any, { shouldValidate: true });
                    }
                    if (addr.city) {
                        addressForm.setValue("city" as any, addr.city as any, { shouldValidate: true });
                    }
                    if (addr.state) {
                        addressForm.setValue("state" as any, addr.state as any, { shouldValidate: true });
                    }
                    if (addr.country) {
                        addressForm.setValue("country" as any, addr.country as any, { shouldValidate: true });
                    }
                    if (addr.postalCode) {
                        addressForm.setValue("postalCode" as any, addr.postalCode as any, {
                            shouldValidate: true,
                        });
                    }
                });

                // Autocomplete en el buscador
                if (autocompleteContainerRef.current) {
                    disposeAutocomplete = await mountAddressAutocomplete({
                        container: autocompleteContainerRef.current,
                        placeholder: "Empieza a escribir y selecciona tu dirección…",
                        onError: (message) => {
                            setMapsError(message);
                        },
                        onSelect: async ({ street, city, state, country, postalCode, location }) => {
                            setMapsError(null);
                            addressForm.setValue("street" as any, street as any, {
                                shouldValidate: true,
                            });
                            addressForm.setValue("city" as any, city as any, {
                                shouldValidate: true,
                            });
                            addressForm.setValue("state" as any, state as any, {
                                shouldValidate: true,
                            });
                            addressForm.setValue("country" as any, country as any, {
                                shouldValidate: true,
                            });
                            addressForm.setValue("postalCode" as any, postalCode as any, {
                                shouldValidate: true,
                            });

                            if (!location || !map || !marker) {
                                return;
                            }

                            addressForm.setValue("latitude" as any, location.lat as any, {
                                shouldValidate: true,
                            });
                            addressForm.setValue("longitude" as any, location.lng as any, {
                                shouldValidate: true,
                            });

                            map.panTo(location);
                            map.setZoom(17);
                            marker.position = location;
                        },
                    });
                }
            } catch (error) {
                console.error("Error inicializando Google Maps:", error);
                if (isMounted) {
                    setMapsError(
                        "No se pudo cargar Google Maps. Puedes guardar la dirección manualmente y revisar la configuración de la API key o los dominios autorizados.",
                    );
                }
            } finally {
                if (isMounted) setIsMapsLoading(false);
            }
        };

        void init();

        return () => {
            isMounted = false;
            unsubscribeAuthFailure();
            disposeAutocomplete?.();
            if (marker && (window as any).google?.maps?.event) {
                (window as any).google.maps.event.clearInstanceListeners(marker);
            }
        };
    }, [addressForm, enabled]);

    return {
        autocompleteContainerRef,
        mapContainerRef,
        isMapsLoading,
        mapsError,
    };
}
