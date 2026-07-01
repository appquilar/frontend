import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ProductRentalCostCalculator from "@/components/products/ProductRentalCostCalculator";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

const calculateRentalCostMock = vi.fn();
const openSignUpMock = vi.fn();

vi.mock("@/application/hooks/useProducts", () => ({
    useCalculateRentalCost: () => ({
        mutateAsync: calculateRentalCostMock,
        isPending: false,
    }),
}));

vi.mock("@/hooks/useAuthModalLauncher", () => ({
    useAuthModalLauncher: () => ({
        openSignUp: openSignUpMock,
    }),
}));

vi.mock("@/components/products/SpanishDateRangePicker", () => ({
    default: ({
        startDate,
        endDate,
        onStartDateChange,
        onEndDateChange,
    }: {
        startDate: string;
        endDate: string;
        onStartDateChange: (value: string) => void;
        onEndDateChange: (value: string) => void;
    }) => (
        <div>
            <span>{startDate || "sin inicio"}</span>
            <span>{endDate || "sin fin"}</span>
            <button type="button" onClick={() => onStartDateChange("2026-04-20")}>
                Elegir inicio
            </button>
            <button type="button" onClick={() => onEndDateChange("2026-04-22")}>
                Elegir fin
            </button>
            <button type="button" onClick={() => onEndDateChange("2026-04-24")}>
                Cambiar fin
            </button>
        </div>
    ),
}));

const calculation = {
    requestedQuantity: 2,
    days: 3,
    pricePerDay: { amount: 8000, currency: "EUR" },
    rentalPrice: { amount: 24000, currency: "EUR" },
    deposit: { amount: 10000, currency: "EUR" },
    totalPrice: { amount: 34000, currency: "EUR" },
};

describe("ProductRentalCostCalculator behavior", () => {
    it("opens signup instead of calculating for guests", async () => {
        const user = userEvent.setup();

        renderWithProviders(
            <ProductRentalCostCalculator
                productId="product-1"
                isLoggedIn={false}
                startDate="2026-04-20"
                endDate="2026-04-22"
                requestedQuantity={1}
            />
        );

        await user.click(screen.getByRole("button", { name: "Calcular coste" }));

        expect(openSignUpMock).toHaveBeenCalledWith(
            "Crea tu cuenta para calcular el coste del alquiler."
        );
        expect(calculateRentalCostMock).not.toHaveBeenCalled();
    });

    it("calculates and renders the rental breakdown for authenticated users", async () => {
        const user = userEvent.setup();
        const onCalculationChange = vi.fn();
        calculateRentalCostMock.mockResolvedValueOnce(calculation);

        renderWithProviders(
            <ProductRentalCostCalculator
                productId="product-1"
                isLoggedIn={true}
                startDate="2026-04-20"
                endDate="2026-04-22"
                requestedQuantity={2}
                availability={{
                    canRequest: false,
                    managedByPlatform: true,
                    status: "unavailable",
                    message: "Solo quedan pocas unidades para esas fechas.",
                }}
                onCalculationChange={onCalculationChange}
            />
        );

        expect(screen.getByText("Solo quedan pocas unidades para esas fechas.")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Calcular coste" }));

        await screen.findByText("340.00 EUR");
        expect(calculateRentalCostMock).toHaveBeenCalledWith({
            productId: "product-1",
            startDate: "2026-04-20",
            endDate: "2026-04-22",
            quantity: 2,
        });
        expect(onCalculationChange).toHaveBeenCalledWith(calculation);
        expect(screen.getByText("80.00 EUR")).toBeInTheDocument();
        expect(screen.getByText("240.00 EUR")).toBeInTheDocument();
        expect(screen.getByText("100.00 EUR")).toBeInTheDocument();
    });

    it("supports uncontrolled values, sanitizes quantity input and clears stale calculations", async () => {
        const user = userEvent.setup();
        const onRequestedQuantityChange = vi.fn();
        const onCalculationChange = vi.fn();
        calculateRentalCostMock.mockResolvedValueOnce(calculation);

        renderWithProviders(
            <ProductRentalCostCalculator
                productId="product-1"
                isLoggedIn={true}
                availability={{
                    canRequest: false,
                    managedByPlatform: false,
                    status: "unavailable",
                    message: "No disponible para esas fechas.",
                }}
                onRequestedQuantityChange={onRequestedQuantityChange}
                onCalculationChange={onCalculationChange}
            />
        );

        const actionButton = screen.getByRole("button", { name: "Calcular coste" });
        expect(actionButton).toBeDisabled();

        await user.click(screen.getByRole("button", { name: "Elegir inicio" }));
        await user.click(screen.getByRole("button", { name: "Elegir fin" }));

        const quantityInput = screen.getByRole("spinbutton");
        await user.clear(quantityInput);
        expect(onRequestedQuantityChange).toHaveBeenLastCalledWith(1);

        await waitFor(() => {
            expect(actionButton).toBeEnabled();
        });

        await user.click(actionButton);
        await screen.findByText("340.00 EUR");
        expect(screen.getByText("No disponible para esas fechas.")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Cambiar fin" }));

        await waitFor(() => {
            expect(screen.queryByText("340.00 EUR")).not.toBeInTheDocument();
        });
        expect(onCalculationChange).toHaveBeenCalledWith(calculation);
        expect(onCalculationChange).toHaveBeenLastCalledWith(null);
    });
});
