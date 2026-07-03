import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProductImageGalleryProps {
    images: string[];
    productName: string;
}

const ProductImageGallery = ({ images, productName }: ProductImageGalleryProps) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const sliderRef = useRef<HTMLDivElement>(null);

    const slideToIndex = (index: number) => {
        if (!sliderRef.current) return;

        if (index < 0) {
            setCurrentImageIndex(images.length - 1);
        } else if (index >= images.length) {
            setCurrentImageIndex(0);
        } else {
            setCurrentImageIndex(index);
        }
    };

    if (!images || images.length === 0) {
        return (
            <div className="flex aspect-[16/10] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/60 text-center text-sm text-muted-foreground">
                <ImageIcon className="mb-3 h-10 w-10 opacity-60" />
                <p className="font-medium text-foreground">{productName}</p>
                <p className="mt-1 max-w-xs">Imagen pendiente de publicar por el proveedor.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div
                ref={sliderRef}
                className="relative aspect-[16/10] max-h-[560px] overflow-hidden bg-muted rounded-xl border border-border"
            >
                <div
                    className="flex transition-transform duration-500 ease-spring h-full"
                    style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
                >
                    {images.map((image, index) => (
                        <div key={index} className="w-full h-full flex-shrink-0 flex items-center justify-center bg-black/5">
                            <img
                                src={image}
                                alt={`${productName} - Imagen ${index + 1}`}
                                className="w-full h-full object-contain"
                            />
                        </div>
                    ))}
                </div>

                {images.length > 1 && (
                    <>
                        <Button
                            variant="secondary"
                            size="icon"
                            className="absolute left-3 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full opacity-80 hover:opacity-100 shadow-md bg-white/90"
                            onClick={() => slideToIndex(currentImageIndex - 1)}
                            aria-label="Imagen anterior"
                        >
                            <ChevronLeft size={16} />
                        </Button>
                        <Button
                            variant="secondary"
                            size="icon"
                            className="absolute right-3 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full opacity-80 hover:opacity-100 shadow-md bg-white/90"
                            onClick={() => slideToIndex(currentImageIndex + 1)}
                            aria-label="Siguiente imagen"
                        >
                            <ChevronRight size={16} />
                        </Button>
                    </>
                )}

                {images.length > 1 && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center space-x-2 p-1.5 rounded-full bg-black/30 backdrop-blur-sm">
                        {images.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => slideToIndex(index)}
                                className={`w-1.5 h-1.5 rounded-full transition-all ${
                                    currentImageIndex === index
                                        ? 'bg-white w-2.5 scale-110'
                                        : 'bg-white/60 hover:bg-white/80'
                                }`}
                                aria-label={`Ir a imagen ${index + 1}`}
                            />
                        ))}
                    </div>
                )}
            </div>

            {images.length > 1 && (
                <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
                    {images.map((image, index) => (
                        <button
                            key={index}
                            onClick={() => slideToIndex(index)}
                            className={`relative flex-shrink-0 w-20 h-14 rounded-md overflow-hidden border-2 transition-all ${
                                currentImageIndex === index
                                    ? 'border-primary ring-2 ring-primary/20 opacity-100'
                                    : 'border-transparent hover:border-primary/50 opacity-70 hover:opacity-100'
                            }`}
                        >
                            <img
                                src={image}
                                alt={`Miniatura ${index + 1}`}
                                className="w-full h-full object-cover"
                            />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ProductImageGallery;
