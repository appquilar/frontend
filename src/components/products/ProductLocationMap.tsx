import { useMemo, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { useProductLocationMap } from '@/hooks/useProductLocationMap';

interface ProductLocationMapProps {
    city: string;
    state: string;
    coordinates?: [number, number];
    polygon?: { latitude: number; longitude: number }[];
}

const ProductLocationMap = ({ city, state, coordinates = [-2.4637, 36.8381], polygon }: ProductLocationMapProps) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const [mapError, setMapError] = useState<string | null>(null);
    const mapsUrl = useMemo(() => {
        const query = [city, state].filter(Boolean).join(', ');
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    }, [city, state]);

    useProductLocationMap({
        containerRef: mapContainer,
        city,
        state,
        coordinates,
        polygon,
        onError: setMapError,
    });

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin size={18} className="text-primary" />
                <span className="font-medium">{city + ', ' + state}</span>
            </div>
            {!mapError && (
                <div
                    ref={mapContainer}
                    className="w-full h-64 rounded-lg border border-border overflow-hidden bg-muted"
                    style={{ minHeight: '256px' }}
                />
            )}
            {mapError && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <p>{mapError}</p>
                    <a href={mapsUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex font-medium underline">
                        Abrir en Google Maps
                    </a>
                </div>
            )}
        </div>
    );
};

export default ProductLocationMap;
