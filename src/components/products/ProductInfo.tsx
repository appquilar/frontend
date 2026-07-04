import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import CompanyInfo from './CompanyInfo';
import ProductRentalCostCalculator from './ProductRentalCostCalculator';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProductRentability } from '@/application/hooks/useProductInventory';
import type { ProductInventorySummary, ProductPublicAvailability } from '@/domain/models/Product';
import { RentalCostBreakdown } from '@/domain/repositories/ProductRepository';
import { getVisibleProductDailyPricing } from '@/domain/services/ProductPricingService';
import { useAuthModalLauncher } from "@/hooks/useAuthModalLauncher";

interface ProductInfoProps {
    product: {
        id: string;
        name: string;
        publicationStatus?: string;
        quantity: number;
        isRentalEnabled: boolean;
        inventoryMode?: 'unmanaged' | 'managed_serialized';
        bookingPolicy?: 'platform_managed' | 'owner_managed';
        allowsQuantityRequest?: boolean;
        inventorySummary?: ProductInventorySummary | null;
        category: {
            id: string;
            name: string;
            slug: string;
        };
        company: {
            id: string;
            name: string;
            slug: string;
        };
        price: {
            daily?: number;
            deposit?: number;
            tiers?: Array<{
                daysFrom: number;
                daysTo?: number;
                pricePerDay: number;
            }>;
        };
        providerLocationLabel?: string;
    };
    onContact: () => void;
    isLoggedIn: boolean;
    leadStartDate: string;
    leadEndDate: string;
    leadRequestedQuantity: number;
    leadAvailability?: ProductPublicAvailability | null;
    onLeadStartDateChange: (value: string) => void;
    onLeadEndDateChange: (value: string) => void;
    onLeadRequestedQuantityChange: (value: number) => void;
    onLeadCalculationChange: (value: RentalCostBreakdown | null) => void;
}

const ProductInfo = ({
    product,
    onContact,
    isLoggedIn,
    leadStartDate,
    leadEndDate,
    leadRequestedQuantity,
    leadAvailability,
    onLeadStartDateChange,
    onLeadEndDateChange,
    onLeadRequestedQuantityChange,
    onLeadCalculationChange,
}: ProductInfoProps) => {
    const { openSignIn, openSignUp } = useAuthModalLauncher();
    const productReturnTo = typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : undefined;
    const rentability = useProductRentability({
        id: product.id,
        internalId: product.inventorySummary?.productInternalId ?? "",
        name: product.name,
        slug: "",
        description: "",
        quantity: product.quantity,
        isRentalEnabled: product.isRentalEnabled,
        inventoryMode: product.inventoryMode,
        bookingPolicy: product.bookingPolicy,
        allowsQuantityRequest: product.allowsQuantityRequest,
        imageUrl: "",
        thumbnailUrl: "",
        publicationStatus: (product.publicationStatus as "draft" | "published" | "archived") ?? "draft",
        price: product.price,
        category: product.category,
        rating: 0,
        reviewCount: 0,
        inventorySummary: product.inventorySummary ?? null,
    });

    const handleContact = () => {
        if (!isLoggedIn) {
            openSignUp(
                "Crea tu cuenta para solicitar el alquiler.",
                productReturnTo,
            );
            return;
        }

        onContact();
    };

    const price = product.price || { daily: 0, deposit: 0, tiers: [] };
    const tiers = price.tiers || [];
    const hasDeposit = typeof price.deposit === "number" && price.deposit > 0;
    const providerLocationLabel = product.providerLocationLabel;
    const visibleDailyPricing = getVisibleProductDailyPricing(price);
    const hasVisibleDailyPrice = visibleDailyPricing.amount !== null;
    const pricingTitle = visibleDailyPricing.isFromLaterTier ? "Primera tarifa pública" : "Precio Base";
    const pricingDescription = visibleDailyPricing.isFromLaterTier && visibleDailyPricing.daysFrom
        ? `Disponible a partir de ${visibleDailyPricing.daysFrom} días`
        : "Precio del primer tier disponible";
    const paymentPolicyCopy =
        "Appquilar coordina la solicitud. El pago del alquiler y la fianza se acuerdan y gestionan directamente entre proveedor y cliente fuera de la plataforma.";
    return (
        <div className="space-y-8">
            {product.publicationStatus && product.publicationStatus !== 'published' && (
                <Alert variant="warning" className="bg-yellow-50 border-yellow-200">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertTitle className="text-yellow-800">Producto no publicado</AlertTitle>
                    <AlertDescription className="text-yellow-700">
                        Este producto está en estado <strong>{product.publicationStatus === 'draft' ? 'Borrador' : 'Archivado'}</strong>.
                        Solo tú puedes ver esta página.
                    </AlertDescription>
                </Alert>
            )}

            <div>
                <div className="mb-3 flex items-center gap-2">
                    {product.category?.name && (
                        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                            {product.category.name}
                        </span>
                    )}
                    <Badge
                        variant="outline"
                        className={
                            rentability.availabilityTone === "success"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : rentability.availabilityTone === "warning"
                                    ? "border-amber-200 bg-amber-50 text-amber-700"
                                    : "border-slate-200 bg-slate-50 text-slate-700"
                        }
                    >
                        {rentability.availabilityLabel}
                    </Badge>
                </div>

                <h1 className="mb-3 text-2xl sm:text-3xl font-display font-bold tracking-tight text-foreground">
                    {product.name}
                </h1>
            </div>

            {!rentability.isRentableNow && (
                <Alert variant="warning" className="bg-amber-50/70 border-amber-200">
                    <AlertTriangle className="h-4 w-4 text-amber-700" />
                    <AlertTitle>{rentability.availabilityLabel}</AlertTitle>
                    <AlertDescription className="space-y-3">
                        <p>{rentability.availabilityMessage}</p>
                        <Button type="button" disabled className="w-full sm:w-auto">
                            Alquiler no disponible ahora
                        </Button>
                        <p className="text-xs text-muted-foreground">
                            Puedes seguir contactando con el proveedor para consultar disponibilidad futura o condiciones.
                        </p>
                    </AlertDescription>
                </Alert>
            )}

            <div>
                {isLoggedIn ? (
                    <>
                        <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
                            Tarifas de Alquiler
                        </h3>

                        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                            <div className="p-5 border-b border-border bg-muted/30 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{pricingTitle}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{pricingDescription}</p>
                                </div>
                                <div className="text-left sm:text-right">
                                    <span className="text-2xl font-bold text-foreground">
                                        {hasVisibleDailyPrice ? `${visibleDailyPricing.amount!.toFixed(2)}€` : "Consultar"}
                                    </span>
                                    {hasVisibleDailyPrice && <span className="text-muted-foreground ml-1">/ día</span>}
                                </div>
                            </div>

                            {hasDeposit && (
                                <div className="px-5 py-3 border-b border-border flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-white">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">Fianza</span>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    <Info size={14} className="text-muted-foreground cursor-help" />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Importe reembolsable al finalizar el alquiler</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                    <span className="font-medium text-foreground">{price.deposit!.toFixed(2)}€</span>
                                </div>
                            )}

                            {tiers.length > 0 && (
                                <div className="p-0">
                                    <div className="px-5 py-3 bg-muted/10 border-b border-border">
                                        <p className="text-sm font-semibold text-foreground">Descuentos por duración</p>
                                    </div>
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent border-border">
                                                <TableHead className="w-1/2 pl-5">Duración</TableHead>
                                                <TableHead className="text-right pr-5">Precio por día</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {tiers.map((tier, index) => (
                                                <TableRow key={index} className="hover:bg-muted/5 border-border">
                                                    <TableCell className="pl-5 font-medium">
                                                        {tier.daysFrom} {tier.daysTo ? `a ${tier.daysTo}` : '+'} días
                                                    </TableCell>
                                                    <TableCell className="text-right pr-5 text-foreground font-semibold">
                                                        {Number(tier.pricePerDay || 0).toFixed(2)}€
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </div>
                        <div className="mt-3 flex gap-2 rounded-lg border border-border bg-muted/20 p-3 text-sm leading-6 text-muted-foreground">
                            <Info size={16} className="mt-0.5 shrink-0 text-primary" />
                            <p>{paymentPolicyCopy}</p>
                        </div>
                    </>
                ) : (
                    <div className="rounded-lg bg-secondary p-4 sm:p-5">
                        <p className="max-w-xl text-[15px] leading-6 text-foreground">
                            Crea tu cuenta para ver tarifas, calcular el alquiler y contactar con el proveedor.
                        </p>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">
                            {paymentPolicyCopy}
                        </p>
                        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                            <Button
                                type="button"
                                className="h-10 px-4 text-sm sm:flex-1"
                                onClick={() => openSignUp(undefined, productReturnTo)}
                            >
                                Crear cuenta gratis
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                className="h-10 border-border/80 bg-background text-sm sm:flex-1"
                                onClick={() => openSignIn(undefined, productReturnTo)}
                            >
                                Ya tengo cuenta
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {isLoggedIn ? (
                <ProductRentalCostCalculator
                    productId={product.id}
                    isLoggedIn={isLoggedIn}
                    startDate={leadStartDate}
                    endDate={leadEndDate}
                    requestedQuantity={leadRequestedQuantity}
                    availability={leadAvailability}
                    onStartDateChange={onLeadStartDateChange}
                    onEndDateChange={onLeadEndDateChange}
                    onRequestedQuantityChange={onLeadRequestedQuantityChange}
                    onCalculationChange={onLeadCalculationChange}
                />
            ) : null}

            <div className="pt-4 border-t border-border">
                <CompanyInfo
                    company={product.company}
                    locationLabel={providerLocationLabel}
                    onContact={handleContact}
                    isLoggedIn={isLoggedIn}
                />
            </div>
        </div>
    );
};

export default ProductInfo;
