import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import RentalEditableCard from "@/components/dashboard/rentals/details/RentalEditableCard";
import type { Rental } from "@/domain/models/Rental";

const calculateRentalCostMock = vi.fn();
const toastMock = vi.fn();

vi.mock("@/application/hooks/useProducts", () => ({
  useCalculateRentalCost: () => ({
    mutateAsync: calculateRentalCostMock,
    isPending: false,
  }),
}));

vi.mock("@/components/ui/use-toast", () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

const sampleRental = (): Rental => ({
  id: "rent-1",
  productId: "product-1",
  productName: "Taladro",
  ownerId: "owner-1",
  ownerName: "Victor",
  ownerType: "user",
  renterId: "renter-1",
  renterName: "Cliente",
  renterEmail: "cliente@ejemplo.com",
  startDate: new Date("2026-04-14T00:00:00.000Z"),
  endDate: new Date("2026-04-20T00:00:00.000Z"),
  requestedQuantity: 1,
  deposit: { amount: 5500, currency: "EUR" },
  price: { amount: 12500, currency: "EUR" },
  status: "lead_pending",
  isLead: true,
  proposalValidUntil: null,
});

describe("RentalEditableCard", () => {
  it("renders the editable form in embedded mode", () => {
    render(
      <RentalEditableCard
        rental={sampleRental()}
        viewerRole="owner"
        isSaving={false}
        embedded
        onSave={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Editar condiciones" })).toBeInTheDocument();
    expect(screen.getByLabelText("Fecha de inicio")).toHaveValue("2026-04-14");
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeInTheDocument();
  });

  it("can run an action after saving", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onSaved = vi.fn().mockResolvedValue(undefined);

    render(
      <RentalEditableCard
        rental={sampleRental()}
        viewerRole="owner"
        isSaving={false}
        submitLabel="Guardar y enviar propuesta"
        onSave={onSave}
        onSaved={onSaved}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Guardar y enviar propuesta" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
      expect(onSaved).toHaveBeenCalled();
    });
  });

  it("lets price fields be cleared and rewritten naturally", async () => {
    const user = userEvent.setup();

    render(
      <RentalEditableCard
        rental={sampleRental()}
        viewerRole="owner"
        isSaving={false}
        onSave={vi.fn()}
      />
    );

    const priceInput = screen.getByLabelText(/Precio \(EUR\)/i) as HTMLInputElement;
    const depositInput = screen.getByLabelText(/Fianza \(EUR\)/i) as HTMLInputElement;

    expect(priceInput.value).toBe("125");
    expect(depositInput.value).toBe("55");

    await user.clear(priceInput);
    expect(priceInput.value).toBe("");

    await user.type(priceInput, "49.95");
    expect(priceInput.value).toBe("49.95");

    await user.clear(depositInput);
    expect(depositInput.value).toBe("");

    await user.type(depositInput, "12.5");
    expect(depositInput.value).toBe("12.5");
  });

  it("recalculates rental pricing from the product data", async () => {
    const user = userEvent.setup();

    calculateRentalCostMock.mockResolvedValueOnce({
      requestedQuantity: 1,
      days: 6,
      pricePerDay: { amount: 832, currency: "EUR" },
      rentalPrice: { amount: 4995, currency: "EUR" },
      deposit: { amount: 1250, currency: "EUR" },
      totalPrice: { amount: 6245, currency: "EUR" },
    });

    render(
      <RentalEditableCard
        rental={sampleRental()}
        viewerRole="owner"
        isSaving={false}
        onSave={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Recalcular desde producto" }));

    await waitFor(() => {
      expect(calculateRentalCostMock).toHaveBeenCalledWith({
        productId: "product-1",
        startDate: "2026-04-14",
        endDate: "2026-04-20",
        quantity: 1,
      });
    });

    expect(screen.getByLabelText(/Precio \(EUR\)/i)).toHaveValue("49.95");
    expect(screen.getByLabelText(/Fianza \(EUR\)/i)).toHaveValue("12.5");
  });

  it("shows a destructive toast when recalculation fails", async () => {
    const user = userEvent.setup();

    calculateRentalCostMock.mockRejectedValueOnce(new Error("boom"));

    render(
      <RentalEditableCard
        rental={sampleRental()}
        viewerRole="owner"
        isSaving={false}
        onSave={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Recalcular desde producto" }));

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "No se pudo recalcular",
          description: "Revisa las fechas seleccionadas.",
          variant: "destructive",
        })
      );
    });
  });

  it("submits editable prices and converts the dates to the expected boundaries", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <RentalEditableCard
        rental={sampleRental()}
        viewerRole="owner"
        isSaving={false}
        onSave={onSave}
      />
    );

    fireEvent.change(screen.getByLabelText("Fecha de inicio"), {
      target: { value: "2026-04-15" },
    });
    fireEvent.change(screen.getByLabelText("Fecha de fin"), {
      target: { value: "2026-04-18" },
    });
    fireEvent.change(screen.getByLabelText("Cantidad solicitada"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByLabelText(/Precio \(EUR\)/i), {
      target: { value: "49,95" },
    });
    fireEvent.change(screen.getByLabelText(/Fianza \(EUR\)/i), {
      target: { value: "12.5" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        startDate: new Date(2026, 3, 15, 0, 0, 0),
        endDate: new Date(2026, 3, 18, 23, 59, 59),
        requestedQuantity: 3,
        price: { amount: 4995, currency: "EUR" },
        deposit: { amount: 1250, currency: "EUR" },
      });
    });
  });

  it("keeps price fields disabled for renters and omits monetary fields on save", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <RentalEditableCard
        rental={sampleRental()}
        viewerRole="renter"
        isSaving={false}
        onSave={onSave}
      />
    );

    expect(screen.getByLabelText(/Precio \(EUR\)/i)).toBeDisabled();
    expect(screen.getByLabelText(/Fianza \(EUR\)/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: "Recalcular desde producto" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        startDate: new Date(2026, 3, 14, 0, 0, 0),
        endDate: new Date(2026, 3, 20, 23, 59, 59),
        requestedQuantity: 1,
      });
    });
  });

  it("shows a validation error when the end date is before the start date", async () => {
    render(
      <RentalEditableCard
        rental={sampleRental()}
        viewerRole="owner"
        isSaving={false}
        onSave={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText("Fecha de inicio"), {
      target: { value: "2026-04-20" },
    });
    fireEvent.change(screen.getByLabelText("Fecha de fin"), {
      target: { value: "2026-04-18" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(
      await screen.findByText("La fecha de fin debe ser igual o posterior a la de inicio")
    ).toBeInTheDocument();
  });
});
