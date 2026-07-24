import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Product, ProductFormData } from '@/domain/models/Product';
import ProductEditForm from '@/components/dashboard/ProductEditForm';
import { toast } from 'sonner';
import { Uuid } from '@/domain/valueObject/uuidv4';
import { useCreateProduct, useProduct, useUpdateProduct } from '@/application/hooks/useProducts';
import FormHeader from '@/components/dashboard/common/FormHeader';
import { Card, CardContent } from '@/components/ui/card';
import { useProductOwnerAddress } from '@/application/hooks/useProductOwnerAddress';
import { buildProductPath } from '@/domain/config/publicRoutes';
import { useProductPublicationLimit } from '@/components/dashboard/products/hooks/useProductPublicationLimit';

const createDraftProduct = (): Product => ({
    id: Uuid.generate().toString(),
    internalId: '',
    name: '',
    slug: '',
    description: '',
    quantity: 1,
    isRentalEnabled: true,
    isInventoryEnabled: false,
    inventoryMode: 'unmanaged',
    imageUrl: '',
    thumbnailUrl: '',
    publicationStatus: 'draft',
    price: {
        daily: 0,
        deposit: 0,
        tiers: []
    },
    dynamicProperties: {},
    category: { id: '', name: '', slug: '' },
    rating: 0,
    reviewCount: 0,
    productType: 'rental',
});

const ProductFormPage = () => {
    const { productId } = useParams();
    const navigate = useNavigate();
    const [lastSavedProduct, setLastSavedProduct] = useState<{
        id: string;
        slug: string | null;
        publicationStatus: Product['publicationStatus'];
    } | null>(null);
    const isAddMode = !productId || productId === 'new';
    const {
        hasRequiredAddress,
        isLoading: isProductOwnerAddressLoading,
        ownerType,
        companyId,
        settingsHref,
    } = useProductOwnerAddress();
    const inventoryOwnerType: 'company' | 'user' = ownerType;
    const {
        hasReachedProductPublicationLimit,
        publicationLimitCtaLabel,
        handlePublicationLimitCta,
        isProcessingPublicationLimitCta,
        isPublicationLimitLoading,
    } = useProductPublicationLimit();
    const canSubmitProduct = !isProductOwnerAddressLoading;
    const productQuery = useProduct(isAddMode ? undefined : productId);
    const product: Product | null = isAddMode
        ? createDraftProduct()
        : productQuery.data
            ? {
                ...productQuery.data,
                category: productQuery.data.category || { id: '', name: '', slug: '' },
                price: {
                    daily: productQuery.data.price?.daily ?? productQuery.data.price?.tiers?.[0]?.pricePerDay ?? 0,
                    deposit: productQuery.data.price?.deposit || 0,
                    tiers: productQuery.data.price?.tiers || []
                },
                productType: 'rental' as const
            }
            : null;

    // Usamos los hooks de mutación que gestionan la invalidación de caché
    const { mutateAsync: createProduct } = useCreateProduct();
    const { mutateAsync: updateProduct } = useUpdateProduct();

    useEffect(() => {
        if (isAddMode) {
            setLastSavedProduct(null);
        }
    }, [isAddMode]);

    const handleSaveProduct = async (updatedProduct: Partial<Product>) => {
        try {
            if (updatedProduct.publicationStatus === 'published' && !hasRequiredAddress) {
                toast.error(
                    ownerType === "company"
                        ? "Debes añadir la dirección de la empresa antes de publicar productos."
                        : "Debes añadir una dirección en tu perfil antes de publicar productos."
                );
                return;
            }

            if (isAddMode) {
                const fallbackCreatedProductId = typeof updatedProduct.id === 'string' && updatedProduct.id.length > 0
                    ? updatedProduct.id
                    : null;
                const createPayload = {
                    ...(updatedProduct as Partial<ProductFormData>),
                };

                if (ownerType === "company" && companyId) {
                    createPayload.companyId = companyId;
                } else {
                    delete createPayload.companyId;
                }

                // Al usar mutateAsync, se ejecutará el onSuccess del hook que hace invalidateQueries(['products'])
                const createdProduct = await createProduct(createPayload as ProductFormData) as Product | undefined;
                const createdProductId = typeof createdProduct?.id === 'string' && createdProduct.id.length > 0
                    ? createdProduct.id
                    : fallbackCreatedProductId;

                if (createdProductId) {
                    toast.success("Producto guardado correctamente");
                    navigate('/dashboard/products', { replace: true });
                }
            } else {
                const savedProduct = await updateProduct({
                    id: productId as string,
                    data: updatedProduct as ProductFormData
                });
                const savedProductSlug = typeof savedProduct?.slug === 'string' && savedProduct.slug.length > 0
                    ? savedProduct.slug
                    : typeof updatedProduct.slug === 'string' && updatedProduct.slug.length > 0
                        ? updatedProduct.slug
                        : product?.slug || (productId as string);

                setLastSavedProduct({
                    id: productId as string,
                    slug: savedProductSlug,
                    publicationStatus: savedProduct?.publicationStatus ?? updatedProduct.publicationStatus ?? product?.publicationStatus ?? 'draft',
                });
            }
        } catch (error) {
            console.error("Error saving product:", error);
            // El hook ya muestra el toast de error, pero si fallara algo antes de la llamada:
            // toast.error(...)
        }
    };

    const handleCancel = () => {
        navigate('/dashboard/products');
    };

    if (!isAddMode && productQuery.isLoading) {
        return (
            <div className="flex justify-center py-10">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!isAddMode && productQuery.error) {
        toast.error("Error al cargar el producto");
    }

    if (isAddMode && isPublicationLimitLoading) {
        return (
            <div className="flex justify-center py-10">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (isAddMode && hasReachedProductPublicationLimit) {
        return (
            <div className="space-y-6">
                <FormHeader
                    title="Añadir Nuevo Producto"
                    backUrl="/dashboard/products"
                />
                <Alert variant="warning" className="mb-6">
                    <AlertTitle>Límite de productos alcanzado</AlertTitle>
                    <AlertDescription>
                        Has alcanzado el límite de productos publicados de tu plan. Libera un producto publicado o mejora tu plan antes de crear otro.
                        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                            {publicationLimitCtaLabel && (
                                <Button
                                    type="button"
                                    onClick={handlePublicationLimitCta}
                                    disabled={isProcessingPublicationLimitCta}
                                >
                                    {isProcessingPublicationLimitCta ? "Redirigiendo..." : publicationLimitCtaLabel}
                                </Button>
                            )}
                            <Button type="button" variant="outline" onClick={() => navigate('/dashboard/products')}>
                                Volver a productos
                            </Button>
                        </div>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    if (!product && !isAddMode) {
        return (
            <div className="space-y-6">
                <FormHeader
                    title="Producto no encontrado"
                    backUrl="/dashboard/products"
                />
                <div className="flex flex-col items-center justify-center p-8 text-center">
                    <Button onClick={() => navigate('/dashboard/products')}>
                        Volver a Productos
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <FormHeader
                title={isAddMode ? 'Añadir Nuevo Producto' : 'Editar Producto'}
                backUrl="/dashboard/products"
            />

            {isAddMode && !isProductOwnerAddressLoading && !hasRequiredAddress && (
                <Alert variant="warning" className="mb-6">
                    <MapPin className="h-4 w-4" />
                    <AlertTitle>
                        {ownerType === "company"
                            ? "Necesitas la dirección de la empresa para publicar productos"
                            : "Necesitas una dirección para publicar productos"}
                    </AlertTitle>
                    <AlertDescription>
                        {ownerType === "company"
                            ? "Puedes guardar un borrador, pero antes de publicar debes completar la dirección de la empresa. "
                            : "Puedes guardar un borrador, pero antes de publicar debes completar tu dirección en el perfil. "}
                        <Link to={settingsHref} className="underline font-medium">
                            {ownerType === "company"
                                ? "Ir a la empresa"
                                : "Ir a Configuración de dirección"}
                        </Link>
                        .
                    </AlertDescription>
                </Alert>
            )}

            {lastSavedProduct && (
                <Alert className="border-primary/30 bg-primary/10">
                    <AlertTitle>Producto guardado</AlertTitle>
                    <AlertDescription>
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                            <Button asChild size="sm" variant="outline">
                                <a href={buildProductPath(lastSavedProduct.slug ?? lastSavedProduct.id)} target="_blank" rel="noreferrer">
                                    {lastSavedProduct.publicationStatus === 'published' ? 'Ver publicación' : 'Ver borrador'}
                                </a>
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => navigate('/dashboard/products/new')}>
                                Crear otro producto
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => navigate('/dashboard/products')}>
                                Volver a productos
                            </Button>
                        </div>
                    </AlertDescription>
                </Alert>
            )}

            {product && (
                <Card>
                    <CardContent className="!p-4 sm:!p-6">
                        <ProductEditForm
                            product={product}
                            onSave={handleSaveProduct}
                            onCancel={handleCancel}
                            disableSubmit={!canSubmitProduct}
                            inventoryOwnerType={inventoryOwnerType}
                            enableInventoryQuery={!isAddMode}
                        />
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default ProductFormPage;
