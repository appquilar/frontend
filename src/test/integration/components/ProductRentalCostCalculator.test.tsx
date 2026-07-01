import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ProductRentalCostCalculator from "@/components/products/ProductRentalCostCalculator";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

const calculateRentalCostMock = vi.fn();
const openSignUpMock = vi.fn();
const useCalculateRentalCostMock = vi.fn();

vi.mock("@/application/hooks/useProducts", () => ({
  useCalculateRentalCost: (...args: unknown[]) => useCalculateRentalCostMock(...args),
}));

vi.mock("@/hooks/useAuthModalLauncher", () => ({
  useAuthModalLauncher: () => ({
    openSignUp: openSignUpMock,
  }),
}));

describe("ProductRentalCostCalculator", () => {
  beforeEach(() => {
    calculateRentalCostMock.mockReset();
    openSignUpMock.mockReset();
    useCalculateRentalCostMock.mockReset();
    useCalculateRentalCostMock.mockReturnValue({
      mutateAsync: calculateRentalCostMock,
      isPending: false,
    });
  });

  it("starts with empty dates and hides availability until a range is selected", () => {
    renderWithProviders(
      <ProductRentalCostCalculator
        productId="product-1"
        isLoggedIn={true}
        availability={{
          canRequest: true,
          managedByPlatform: true,
          status: "available",
          message: "Disponible para esa cantidad y esas fechas.",
        }}
      />
    );

    expect(screen.getAllByText("Selecciona")).toHaveLength(2);
    expect(screen.queryByText("Disponible para esa cantidad y esas fechas.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Calcular coste" })).toBeDisabled();
  });

  it("shows the availability message once a full range has been chosen", () => {
    renderWithProviders(
      <ProductRentalCostCalculator
        productId="product-1"
        isLoggedIn={true}
        startDate="2026-04-20"
        endDate="2026-04-22"
        requestedQuantity={1}
        availability={{
          canRequest: true,
          managedByPlatform: true,
          status: "available",
          message: "Disponible para esa cantidad y esas fechas.",
        }}
      />
    );

    expect(screen.getByText("20/04/2026")).toBeInTheDocument();
    expect(screen.getByText("22/04/2026")).toBeInTheDocument();
    expect(screen.getByText("Disponible para esa cantidad y esas fechas.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Calcular coste" })).toBeEnabled();
  });

  it("keeps calculation disabled for same-day ranges", () => {
    renderWithProviders(
      <ProductRentalCostCalculator
        productId="product-1"
        isLoggedIn={true}
        startDate="2026-04-20"
        endDate="2026-04-20"
        requestedQuantity={1}
        availability={{
          canRequest: true,
          managedByPlatform: true,
          status: "available",
          message: "Disponible para esa cantidad y esas fechas.",
        }}
      />
    );

    expect(screen.queryByText("Disponible para esa cantidad y esas fechas.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Calcular coste" })).toBeDisabled();
  });

  it("opens the sign-up flow instead of calculating for guests", async () => {
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

  it("calculates the rental cost for authenticated users and renders the breakdown", async () => {
    const user = userEvent.setup();
    const onCalculationChange = vi.fn();

    calculateRentalCostMock.mockResolvedValueOnce({
      requestedQuantity: 2,
      days: 3,
      pricePerDay: { amount: 2500, currency: "EUR" },
      rentalPrice: { amount: 7500, currency: "EUR" },
      deposit: { amount: 12000, currency: "EUR" },
      totalPrice: { amount: 19500, currency: "EUR" },
    });

    renderWithProviders(
      <ProductRentalCostCalculator
        productId="product-1"
        isLoggedIn={true}
        startDate="2026-04-20"
        endDate="2026-04-22"
        requestedQuantity={2}
        onCalculationChange={onCalculationChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "Calcular coste" }));

    await waitFor(() => {
      expect(calculateRentalCostMock).toHaveBeenCalledWith({
        productId: "product-1",
        startDate: "2026-04-20",
        endDate: "2026-04-22",
        quantity: 2,
      });
    });

    expect(await screen.findByText("195.00 EUR")).toBeInTheDocument();
    expect(screen.getByText("75.00 EUR")).toBeInTheDocument();
    expect(screen.getByText("120.00 EUR")).toBeInTheDocument();
    expect(onCalculationChange).toHaveBeenCalledWith(
      expect.objectContaining({
        requestedQuantity: 2,
        days: 3,
      })
    );
  });

  it("renders non-requestable availability messaging when the provider manages availability manually", () => {
    renderWithProviders(
      <ProductRentalCostCalculator
        productId="product-1"
        isLoggedIn={true}
        startDate="2026-04-20"
        endDate="2026-04-22"
        requestedQuantity={1}
        availability={{
          canRequest: false,
          managedByPlatform: false,
          status: "owner_confirmation",
          message: "Consulta con el proveedor antes de enviar la solicitud.",
        }}
      />
    );

    expect(
      screen.getByText("Consulta con el proveedor antes de enviar la solicitud.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Calcular coste" })).toBeEnabled();
  });

  it("shows the pending state and the platform-managed availability message", () => {
    useCalculateRentalCostMock.mockReturnValue({
      mutateAsync: calculateRentalCostMock,
      isPending: true,
    });

    renderWithProviders(
      <ProductRentalCostCalculator
        productId="product-1"
        isLoggedIn={true}
        startDate="2026-04-20"
        endDate="2026-04-22"
        requestedQuantity={1}
        availability={{
          canRequest: false,
          managedByPlatform: true,
          status: "owner_confirmation",
          message: "Revisaremos manualmente la disponibilidad antes de confirmar.",
        }}
      />
    );

    expect(
      screen.getByText("Revisaremos manualmente la disponibilidad antes de confirmar.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Calculando..." })).toBeDisabled();
  });

  it("clears the last calculation and notifies parent callbacks when quantity changes", async () => {
    const user = userEvent.setup();
    const onCalculationChange = vi.fn();
    const onRequestedQuantityChange = vi.fn();

    calculateRentalCostMock.mockResolvedValueOnce({
      requestedQuantity: 2,
      days: 3,
      pricePerDay: { amount: 2500, currency: "EUR" },
      rentalPrice: { amount: 7500, currency: "EUR" },
      deposit: { amount: 12000, currency: "EUR" },
      totalPrice: { amount: 19500, currency: "EUR" },
    });

    renderWithProviders(
      <ProductRentalCostCalculator
        productId="product-1"
        isLoggedIn={true}
        startDate="2026-04-20"
        endDate="2026-04-22"
        requestedQuantity={2}
        onRequestedQuantityChange={onRequestedQuantityChange}
        onCalculationChange={onCalculationChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "Calcular coste" }));
    expect(await screen.findByText("195.00 EUR")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Cantidad"), {
      target: { value: "0" },
    });

    expect(onRequestedQuantityChange).toHaveBeenCalledWith(0);
    expect(onCalculationChange).toHaveBeenLastCalledWith(null);
    expect(screen.queryByText("195.00 EUR")).not.toBeInTheDocument();
  });
});
