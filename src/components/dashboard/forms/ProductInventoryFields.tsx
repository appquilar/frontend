import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { type Control, useFormContext, useWatch } from "react-hook-form";
import { toast } from "sonner";

import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useCanManageInventory } from "@/application/hooks/useCapabilities";
import {
    useProductInventory,
    useProductInventoryAllocations,
    useProductInventoryUnits,
    useProductRentability,
    useUpdateInventoryUnit,
} from "@/application/hooks/useProductInventory";
import type { ProductInventorySummary } from "@/domain/models/Product";
import SerializedInventoryAgenda from "./SerializedInventoryAgenda";
import type { ProductFormValues } from "./productFormSchema";

interface ProductInventoryFieldsProps {
    control: Control<ProductFormValues>;
    productId?: string;
    ownerType: "company" | "user";
    enableInventoryQuery?: boolean;
}

const getCapabilityMessage = (
    capabilityState: "enabled" | "read_only" | "disabled",
    ownerType: "company" | "user",
) => {
    switch (capabilityState) {
        case "read_only":
            return {
                title: "Inventario en modo lectura",
                description:
                    "Tu plan actual mantiene el inventario operativo, pero no permite editar modos ni capacidad.",
                ctaLabel: null,
            };
        case "disabled":
            if (ownerType === "user") {
                return {
                    title: "Hazte empresa para activar inventario gestionado",
                    description:
                        "Con una cuenta personal este producto solo puede funcionar en gestión manual.",
                    ctaLabel: "Hazte empresa",
                };
            }

            return {
                title: "Inventario no incluido en tu plan",
                description:
                    "Puedes mantener la gestión manual. Para bloquear disponibilidad con unidades identificadas necesitas un plan con inventario.",
                ctaLabel: "Cambiar al plan superior",
            };
        default:
            return null;
    }
};

const formatReservationLabel = (value?: { startsAt: string; endsAt: string } | null) => {
    if (!value) {
        return "-";
    }

    const start = new Date(value.startsAt);
    const end = new Date(value.endsAt);

    return `${start.toLocaleDateString("es-ES")} - ${end.toLocaleDateString("es-ES")}`;
};

const toDateInputValue = (date: Date): string => {
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const addDays = (date: Date, days: number): Date => {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + days);
    return nextDate;
};

const ProductInventoryFields = ({
    control,
    productId,
    ownerType,
    enableInventoryQuery = true,
}: ProductInventoryFieldsProps) => {
    const { setValue } = useFormContext<ProductFormValues>();
    const quantity = useWatch({ control, name: "quantity" }) ?? 1;
    const publicationStatus = useWatch({ control, name: "publicationStatus" }) ?? "draft";
    const inventoryMode = useWatch({ control, name: "inventoryMode" }) ?? "unmanaged";

    const { capability } = useCanManageInventory(ownerType);
    const shouldLoadInventorySummary =
        ownerType === "company" && enableInventoryQuery && Boolean(productId);
    const [inventoryRange, setInventoryRange] = useState(() => {
        const today = new Date();
        return {
            startDate: toDateInputValue(today),
            endDate: toDateInputValue(addDays(today, 13)),
        };
    });
    const normalizedInventoryRange = inventoryRange.endDate < inventoryRange.startDate
        ? { startDate: inventoryRange.startDate, endDate: inventoryRange.startDate }
        : inventoryRange;
    const inventoryQuery = useProductInventory(
        productId ?? null,
        shouldLoadInventorySummary,
        normalizedInventoryRange,
    );
    const allocationsQuery = useProductInventoryAllocations(
        productId ?? null,
        shouldLoadInventorySummary && inventoryMode === "managed_serialized",
    );
    const unitsQuery = useProductInventoryUnits(
        productId ?? null,
        shouldLoadInventorySummary && inventoryMode === "managed_serialized",
    );
    const updateInventoryUnitMutation = useUpdateInventoryUnit();
    const [unitCodeDrafts, setUnitCodeDrafts] = useState<Record<string, string>>({});

    useEffect(() => {
        if (ownerType === "user" && inventoryMode !== "unmanaged") {
            setValue("inventoryMode", "unmanaged", { shouldDirty: true, shouldValidate: true });
        }
    }, [inventoryMode, ownerType, setValue]);

    useEffect(() => {
        setUnitCodeDrafts((currentDrafts) => {
            const nextDrafts: Record<string, string> = {};

            for (const unit of unitsQuery.data ?? []) {
                nextDrafts[unit.unitId] = currentDrafts[unit.unitId] ?? unit.code;
            }

            return nextDrafts;
        });
    }, [unitsQuery.data]);

    const capabilityState = ownerType === "company"
        ? inventoryQuery.data?.capabilityState ?? capability?.state ?? "disabled"
        : "disabled";
    const capabilityMessage = getCapabilityMessage(capabilityState, ownerType);
    const canEditInventory = capabilityState === "enabled";
    const canUseManagedModes = ownerType === "company" && capabilityState === "enabled";
    const inventoryManaged = inventoryMode !== "unmanaged" && capabilityState !== "disabled";
    const effectiveReservedQuantity = inventoryManaged ? (inventoryQuery.data?.reservedQuantity ?? 0) : 0;
    const availableQuantity = inventoryManaged
        ? Math.max(0, quantity - effectiveReservedQuantity)
        : Math.max(1, quantity);

    const localSummary: ProductInventorySummary = {
        productId: productId ?? "",
        productInternalId: inventoryQuery.data?.productInternalId ?? "",
        totalQuantity: quantity,
        reservedQuantity: effectiveReservedQuantity,
        availableQuantity,
        isRentalEnabled: true,
        isInventoryEnabled: inventoryMode !== "unmanaged",
        capabilityState,
        inventoryMode,
        isRentableNow: publicationStatus === "published" && (!inventoryManaged || availableQuantity > 0),
        unavailabilityReason: publicationStatus !== "published"
            ? "unpublished"
            : inventoryManaged && availableQuantity <= 0
                ? "out_of_stock"
                : null,
    };

    const effectiveSummary: ProductInventorySummary = {
        ...(inventoryQuery.data ?? localSummary),
        totalQuantity: quantity,
        reservedQuantity: effectiveReservedQuantity,
        availableQuantity,
        isRentalEnabled: true,
        isInventoryEnabled: inventoryMode !== "unmanaged",
        capabilityState,
        inventoryMode,
        isRentableNow: publicationStatus === "published" && (!inventoryManaged || availableQuantity > 0),
        unavailabilityReason: publicationStatus !== "published"
            ? "unpublished"
            : inventoryManaged && availableQuantity <= 0
                ? "out_of_stock"
                : null,
    };

    const rentability = useProductRentability({
        id: productId ?? "",
        internalId: effectiveSummary.productInternalId,
        name: "",
        slug: "",
        description: "",
        quantity,
        isRentalEnabled: true,
        isInventoryEnabled: inventoryMode !== "unmanaged",
        inventoryMode,
        bookingPolicy: inventoryMode === "unmanaged" ? "owner_managed" : "platform_managed",
        allowsQuantityRequest: true,
        imageUrl: "",
        thumbnailUrl: "",
        publicationStatus,
        price: { daily: 0, tiers: [] },
        category: { id: "", name: "", slug: "" },
        rating: 0,
        reviewCount: 0,
        inventorySummary: effectiveSummary,
    });

    const visibleUnits = (unitsQuery.data ?? []).filter((unit) => unit.status !== "retired");
    const visibleAllocations = (allocationsQuery.data ?? []).filter((allocation) => allocation.state !== "released");
    const unitsMismatch = visibleUnits.length !== quantity;
    const serializedUnitsMessage = !enableInventoryQuery
        ? `Al guardar el producto se crearán automáticamente ${quantity} unidades con códigos únicos.`
        : visibleUnits.length === 0
            ? `Guarda el producto para que Appquilar cree automáticamente ${quantity} unidades con códigos únicos.`
            : unitsMismatch
                ? `Ahora hay ${visibleUnits.length} unidades guardadas. Cuando guardes el producto, se sincronizarán automáticamente hasta ${quantity}.`
                : "Cada fila es una unidad distinta con su propia ocupación por fechas. Si cambias el total y guardas, Appquilar creará o retirará unidades automáticamente.";

    const modeOptions: Array<{
        value: ProductFormValues["inventoryMode"];
        title: string;
        description: string;
        disabled: boolean;
    }> = [
        {
            value: "unmanaged",
            title: "Gestión manual por propietario",
            description: "La plataforma no bloquea stock. El proveedor confirma cada solicitud.",
            disabled: false,
        },
        {
            value: "managed_serialized",
            title: "Unidades identificadas",
            description: "Cada unidad puede tener código propio y la plataforma asigna unidades concretas.",
            disabled: !canUseManagedModes && inventoryMode !== "managed_serialized",
        },
    ];

    const handleUnitCodeDraftChange = (unitId: string, value: string) => {
        setUnitCodeDrafts((currentDrafts) => ({
            ...currentDrafts,
            [unitId]: value,
        }));
    };

    const handleSaveUnitCode = async (unitId: string, currentCode: string) => {
        const nextCode = (unitCodeDrafts[unitId] ?? currentCode).trim();

        if (!productId || nextCode === "" || nextCode === currentCode) {
            return;
        }

        try {
            await updateInventoryUnitMutation.mutateAsync({
                productId,
                unitId,
                data: { code: nextCode },
            });
            toast.success("Codigo interno actualizado");
        } catch (_error) {
            toast.error("No se pudo actualizar el codigo interno");
        }
    };

    return (
        <Card className="border-border/70">
            <CardHeader className="pb-4">
                <CardTitle className="text-lg">Alquiler e inventario</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {capabilityMessage && (
                    <Alert variant="warning" className="border-amber-200 bg-amber-50/70">
                        <AlertTitle>{capabilityMessage.title}</AlertTitle>
                        <AlertDescription className="space-y-2">
                            <p>{capabilityMessage.description}</p>
                            {capabilityMessage.ctaLabel && (
                                <Link
                                    to="/dashboard/upgrade"
                                    className="inline-flex text-sm font-medium text-primary underline underline-offset-4"
                                >
                                    {capabilityMessage.ctaLabel}
                                </Link>
                            )}
                        </AlertDescription>
                    </Alert>
                )}

                <FormField
                    control={control}
                    name="inventoryMode"
                    render={({ field }) => (
                        <FormItem className="space-y-4">
                            <div className="space-y-1">
                                <FormLabel className="text-base">Modo de alquiler</FormLabel>
                                <FormDescription>
                                    Elige si Appquilar gestiona el stock o si prefieres confirmarlo manualmente.
                                </FormDescription>
                            </div>
                            <FormControl>
                                <RadioGroup
                                    value={field.value}
                                    onValueChange={(value) => field.onChange(value)}
                                    className="grid gap-3"
                                >
                                    {modeOptions.map((option) => (
                                        <label
                                            key={option.value}
                                            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${
                                                field.value === option.value ? "border-primary bg-primary/5" : "border-border"
                                            } ${option.disabled ? "cursor-not-allowed opacity-60" : ""}`}
                                        >
                                            <RadioGroupItem
                                                value={option.value}
                                                disabled={option.disabled || capabilityState === "read_only"}
                                                className="mt-1"
                                            />
                                            <div className="space-y-1">
                                                <p className="font-medium">{option.title}</p>
                                                <p className="text-sm text-muted-foreground">{option.description}</p>
                                            </div>
                                        </label>
                                    ))}
                                </RadioGroup>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {inventoryMode === "unmanaged" && (
                    <div className="rounded-xl border border-dashed border-border p-4">
                        <p className="font-medium">Gestión manual activa</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            El cliente podrá pedir fechas y cantidad, pero la disponibilidad final quedará sujeta a tu confirmación.
                        </p>
                    </div>
                )}

                {inventoryMode !== "unmanaged" && (
                    <>
                        <FormField
                            control={control}
                            name="quantity"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Unidades totales</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min={1}
                                            step={1}
                                            value={field.value ?? 1}
                                            onChange={(event) => {
                                                const nextValue = Number.parseInt(event.target.value, 10);
                                                field.onChange(Number.isNaN(nextValue) ? 1 : nextValue);
                                            }}
                                            disabled={!canEditInventory}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        La cantidad marca cuántas unidades quieres tener operativas; las reservas asignarán unidades concretas.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="rounded-xl border border-border bg-muted/20 p-4">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
                                <p className="mt-1 text-2xl font-semibold">{effectiveSummary.totalQuantity}</p>
                            </div>
                            <div className="rounded-xl border border-border bg-muted/20 p-4">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Reservado / activo</p>
                                <p className="mt-1 text-2xl font-semibold">{effectiveSummary.reservedQuantity}</p>
                            </div>
                            <div className="rounded-xl border border-border bg-muted/20 p-4">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Disponible</p>
                                <p className="mt-1 text-2xl font-semibold">{effectiveSummary.availableQuantity}</p>
                            </div>
                        </div>

                        {enableInventoryQuery && (
                            <div className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                                <div className="space-y-1 sm:col-span-2">
                                    <p className="font-medium">Rango de disponibilidad</p>
                                    <p className="text-sm text-muted-foreground">
                                        El resumen y el calendario se calculan para estas fechas.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="inventory-range-start" className="text-sm font-medium">
                                        Desde
                                    </label>
                                    <Input
                                        id="inventory-range-start"
                                        type="date"
                                        value={inventoryRange.startDate}
                                        onChange={(event) =>
                                            setInventoryRange((currentRange) => ({
                                                ...currentRange,
                                                startDate: event.target.value,
                                            }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="inventory-range-end" className="text-sm font-medium">
                                        Hasta
                                    </label>
                                    <Input
                                        id="inventory-range-end"
                                        type="date"
                                        min={inventoryRange.startDate}
                                        value={normalizedInventoryRange.endDate}
                                        onChange={(event) =>
                                            setInventoryRange((currentRange) => ({
                                                ...currentRange,
                                                endDate: event.target.value,
                                            }))}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-4">
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
                            <p className="text-sm text-muted-foreground">{rentability.availabilityMessage}</p>
                        </div>
                    </>
                )}

                {inventoryMode === "managed_serialized" && (
                    <div className="space-y-4 rounded-xl border border-border p-4">
                        <div className="space-y-1">
                            <p className="font-medium">Unidades serializadas</p>
                            <p className="text-sm text-muted-foreground">
                                Cada unidad funciona con su propia disponibilidad por fechas; el cliente nunca ve estos códigos.
                            </p>
                        </div>

                        <div className="rounded-lg border border-dashed border-border bg-muted/10 p-3">
                            <p className="text-sm text-muted-foreground">{serializedUnitsMessage}</p>
                        </div>

                        {visibleUnits.length > 0 && (
                            <div className="overflow-hidden rounded-xl border border-border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Codigo interno</TableHead>
                                            <TableHead>Estado</TableHead>
                                            <TableHead>Próxima reserva</TableHead>
                                            <TableHead className="w-[140px] text-right">Accion</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {visibleUnits.map((unit) => (
                                            <TableRow key={unit.unitId}>
                                                <TableCell className="font-medium">
                                                    <Input
                                                        value={unitCodeDrafts[unit.unitId] ?? unit.code}
                                                        onChange={(event) =>
                                                            handleUnitCodeDraftChange(unit.unitId, event.target.value)}
                                                        aria-label={`Codigo interno de la unidad ${unit.code}`}
                                                        disabled={!canEditInventory || updateInventoryUnitMutation.isPending}
                                                    />
                                                </TableCell>
                                                <TableCell className="w-[220px]">
                                                    <Select
                                                        value={unit.status}
                                                        onValueChange={async (value) => {
                                                            try {
                                                                await updateInventoryUnitMutation.mutateAsync({
                                                                    productId: productId ?? "",
                                                                    unitId: unit.unitId,
                                                                    data: { status: value as typeof unit.status },
                                                                });
                                                            } catch (_error) {
                                                                toast.error("No se pudo actualizar el estado de la unidad");
                                                            }
                                                        }}
                                                        disabled={!canEditInventory || updateInventoryUnitMutation.isPending}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="available">Disponible</SelectItem>
                                                            <SelectItem value="maintenance">Mantenimiento</SelectItem>
                                                            <SelectItem value="retired">Retirada</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {formatReservationLabel(unit.nextAllocation)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        aria-label={`Guardar codigo de la unidad ${unit.code}`}
                                                        disabled={
                                                            !canEditInventory
                                                            || updateInventoryUnitMutation.isPending
                                                            || (unitCodeDrafts[unit.unitId] ?? unit.code).trim() === unit.code
                                                            || (unitCodeDrafts[unit.unitId] ?? unit.code).trim() === ""
                                                        }
                                                        onClick={() => handleSaveUnitCode(unit.unitId, unit.code)}
                                                    >
                                                        Guardar
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        {visibleUnits.length > 0 && (
                            <SerializedInventoryAgenda
                                units={visibleUnits}
                                allocations={visibleAllocations}
                                startDate={normalizedInventoryRange.startDate}
                                endDate={normalizedInventoryRange.endDate}
                            />
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default ProductInventoryFields;
