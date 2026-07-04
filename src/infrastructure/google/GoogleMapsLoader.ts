import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

type GoogleMapsLibraryName = Parameters<typeof importLibrary>[0];

declare global {
    interface Window {
        gm_authFailure?: () => void;
    }
}

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined;
const FALLBACK_MAP_ID = "DEMO_MAP_ID";

let isConfigured = false;
let isAuthFailureHandlerInstalled = false;
let authFailureError: Error | null = null;
const authFailureListeners = new Set<(error: Error) => void>();

const GOOGLE_MAPS_AUTH_FAILURE_MESSAGE =
    "RefererNotAllowedMapError: Google Maps authentication failed";

function notifyAuthFailure(): void {
    authFailureError ??= new Error(GOOGLE_MAPS_AUTH_FAILURE_MESSAGE);
    authFailureListeners.forEach((listener) => listener(authFailureError as Error));
}

function installAuthFailureHandler(): void {
    if (typeof window === "undefined" || isAuthFailureHandlerInstalled) {
        return;
    }

    const previousHandler = window.gm_authFailure;
    window.gm_authFailure = () => {
        notifyAuthFailure();
        previousHandler?.();
    };
    isAuthFailureHandlerInstalled = true;
}

function ensureGoogleMapsConfigured(): void {
    if (isConfigured) {
        return;
    }

    if (!API_KEY) {
        throw new Error("VITE_GOOGLE_MAPS_API_KEY no está definido en el .env");
    }

    installAuthFailureHandler();

    setOptions({
        key: API_KEY,
        v: "beta",
        ...(MAP_ID ? { mapIds: [MAP_ID] } : {}),
    });

    isConfigured = true;
}

export function getGoogleMapsMapId(): string {
    return MAP_ID ?? FALLBACK_MAP_ID;
}

export function subscribeGoogleMapsAuthFailure(
    listener: (error: Error) => void,
): () => void {
    authFailureListeners.add(listener);

    if (authFailureError) {
        queueMicrotask(() => listener(authFailureError as Error));
    }

    return () => {
        authFailureListeners.delete(listener);
    };
}

/**
 * Carga Google Maps una sola vez usando el loader oficial y permite
 * pedir librerías bajo demanda sin duplicar scripts.
 */
export async function loadGoogleMaps(
    libraries: GoogleMapsLibraryName[] = [],
): Promise<typeof google> {
    ensureGoogleMapsConfigured();

    if (authFailureError) {
        throw authFailureError;
    }

    await Promise.all(libraries.map((library) => importLibrary(library)));

    if (authFailureError) {
        throw authFailureError;
    }

    if (!window.google?.maps) {
        throw new Error("Google Maps no se inicializó correctamente");
    }

    return window.google;
}
