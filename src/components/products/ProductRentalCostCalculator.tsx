import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCalculateRentalCost } from "@/application/hooks/useProducts";
import { RentalCostBreakdown } from "@/domain/repositories/ProductRepository";
import { ProductPublicAvailability } from "@/domain/models/Product";
import SpanishDateRangePicker from "./SpanishDateRangePicker";
import { useAuthModalLauncher } from "@/hooks/useAuthModalLauncher";

type ProductRentalCostCalculatorProps = {
    productId: string;
    isLoggedIn: boolean;
    startDate?: string;
    endDate?: string;
    requestedQuantity?: number;
    availability?: ProductPublicAvailability | null;
    onStartDateChange?: (value: string) => void;
    onEndDateChange?: (value: string) => void;
    onRequestedQuantityChange?: (value: number) => void;
    onCalculationChange?: (value: RentalCostBreakdown | null) => void;
};

const formatMoneyFromCents = (amount: number, currency: string): string => {
    const value = Number(amount || 0) / 100;
    return `${value.toFixed(2)} ${currency}`;
};

const ProductRentalCostCalculator = ({
    productId,
    isLoggedIn,
    startDate: controlledStartDate,
    endDate: controlledEndDate,
    requestedQuantity: controlledRequestedQuantity,
    availability,
    onStartDateChange,
    onEndDateChange,
    onRequestedQuantityChange,
    onCalculationChange,
}: ProductRentalCostCalculatorProps) => {
    const [internalStartDate, setInternalStartDate] = useState<string>("");
    const [internalEndDate, setInternalEndDate] = useState<string>("");
    const [internalRequestedQuantity, setInternalRequestedQuantity] = useState<number>(1);
    const [lastCalculation, setLastCalculation] = useState<RentalCostBreakdown | null>(null);
    const { openSignUp } = useAuthModalLauncher();

    const { mutateAsync: calculateRentalCost, isPending } = useCalculateRentalCost();
    const startDate = controlledStartDate ?? internalStartDate;
    const endDate = controlledEndDate ?? internalEndDate;
    const requestedQuantity = controlledRequestedQuantity ?? internalRequestedQuantity;
    const hasSelectedDateRange = startDate.length > 0 && endDate.length > 0 && endDate > startDate;

    const canCalculate = useMemo(() => {
        return productId.length > 0 && hasSelectedDateRange && requestedQuantity > 0;
    }, [hasSelectedDateRange, productId, requestedQuantity]);

    const handleCalculate = async () => {
        if (!canCalculate) return;
        if (!isLoggedIn) {
            openSignUp(
                "Crea tu cuenta para calcular el coste del alquiler.",
            );
            return;
        }

        const result = await calculateRentalCost({
            productId,
            startDate,
            endDate,
            quantity: requestedQuantity,
        });

        setLastCalculation(result);
        onCalculationChange?.(result);
    };

    return (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-2">
                <Calculator size={16} className="text-primary" />
                <h4 className="font-semibold">Calcula tu alquiler</h4>
            </div>

            <div className="space-y-1">
                <label htmlFor="rental-date-range" className="text-sm text-muted-foreground">
                    Fechas del alquiler
                </label>
                <SpanishDateRangePicker
                    id="rental-date-range"
                    startDate={startDate}
                    endDate={endDate}
                    onStartDateChange={(value) => {
                        setLastCalculation(null);
                        onCalculationChange?.(null);
                        if (controlledStartDate === undefined) {
                            setInternalStartDate(value);
                        }
                        onStartDateChange?.(value);
                    }}
                    onEndDateChange={(value) => {
                        setLastCalculation(null);
                        onCalculationChange?.(null);
                        if (controlledEndDate === undefined) {
                            setInternalEndDate(value);
                        }
                        onEndDateChange?.(value);
                    }}
                />
            </div>

            <div className="space-y-1">
                <label htmlFor="rental-requested-quantity" className="text-sm text-muted-foreground">
                    Cantidad
                </label>
                <Input
                    id="rental-requested-quantity"
                    type="number"
                    min={1}
                    step={1}
                    value={requestedQuantity}
                    onChange={(event) => {
                        const nextValue = Number.parseInt(event.target.value, 10);
                        const safeValue = Number.isNaN(nextValue) ? 1 : nextValue;
                        setLastCalculation(null);
                        onCalculationChange?.(null);
                        if (controlledRequestedQuantity === undefined) {
                            setInternalRequestedQuantity(safeValue);
                        }
                        onRequestedQuantityChange?.(safeValue);
                    }}
                />
            </div>

            {hasSelectedDateRange && availability && (
                <div className={`rounded-lg border p-3 text-sm ${
                    availability.canRequest
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : availability.managedByPlatform
                            ? "border-amber-200 bg-amber-50 text-amber-800"
                            : "border-slate-200 bg-slate-50 text-slate-700"
                }`}>
                    {availability.message}
                </div>
            )}

            <Button
                type="button"
                onClick={handleCalculate}
                disabled={!canCalculate || isPending}
                className="w-full"
            >
                {isPending ? "Calculando..." : "Calcular coste"}
            </Button>

            {lastCalculation && (
                <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Cantidad</span>
                        <span className="font-medium">{lastCalculation.requestedQuantity}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Días de alquiler</span>
                        <span className="font-medium">{lastCalculation.days}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Precio por día</span>
                        <span className="font-medium">
                            {formatMoneyFromCents(
                                lastCalculation.pricePerDay.amount,
                                lastCalculation.pricePerDay.currency
                            )}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Subtotal alquiler</span>
                        <span className="font-medium">
                            {formatMoneyFromCents(
                                lastCalculation.rentalPrice.amount,
                                lastCalculation.rentalPrice.currency
                            )}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Fianza</span>
                        <span className="font-medium">
                            {formatMoneyFromCents(
                                lastCalculation.deposit.amount,
                                lastCalculation.deposit.currency
                            )}
                        </span>
                    </div>
                    <div className="border-t border-border pt-2 mt-2 flex justify-between text-base">
                        <span className="font-semibold">Total</span>
                        <span className="font-semibold">
                            {formatMoneyFromCents(
                                lastCalculation.totalPrice.amount,
                                lastCalculation.totalPrice.currency
                            )}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductRentalCostCalculator;
