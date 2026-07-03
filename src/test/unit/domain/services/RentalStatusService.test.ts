import { describe, expect, it } from "vitest";

import { RentalStatusService } from "@/domain/services/RentalStatusService";
import type { Rental } from "@/domain/models/Rental";

const createRental = (status: Rental["status"]): Rental => ({
  id: "rent-1",
  productId: "product-1",
  ownerId: "owner-1",
  ownerType: "company",
  renterId: "renter-1",
  startDate: new Date("2026-05-01T10:00:00.000Z"),
  endDate: new Date("2026-05-02T10:00:00.000Z"),
  requestedQuantity: 1,
  deposit: { amount: 10000, currency: "EUR" },
  price: { amount: 5000, currency: "EUR" },
  status,
  isLead: status === "lead_pending" || status === "proposal_pending_renter",
});

describe("RentalStatusService", () => {
  it("updates rental status immutably", () => {
    const rental = createRental("lead_pending");

    const updated = RentalStatusService.updateRentalStatus(
      rental,
      "rental_confirmed"
    );

    expect(updated).toEqual({
      ...rental,
      status: "rental_confirmed",
    });
    expect(updated).not.toBe(rental);
  });

  it("maps human-readable labels for known and unknown statuses", () => {
    expect(RentalStatusService.getStatusLabel("lead_pending")).toBe(
      "Solicitud recibida"
    );
    expect(RentalStatusService.getStatusLabel("proposal_pending_renter")).toBe(
      "Propuesta enviada"
    );
    expect(RentalStatusService.getStatusLabel("rental_confirmed")).toBe(
      "Reserva confirmada"
    );
    expect(RentalStatusService.getStatusLabel("rental_active")).toBe(
      "Producto recogido"
    );
    expect(RentalStatusService.getStatusLabel("rental_completed")).toBe(
      "Producto devuelto"
    );
    expect(RentalStatusService.getStatusLabel("cancelled")).toBe("Cancelado");
    expect(RentalStatusService.getStatusLabel("rejected")).toBe(
      "Rechazado"
    );
    expect(RentalStatusService.getStatusLabel("expired")).toBe(
      "Propuesta expirada"
    );
    expect(RentalStatusService.getStatusLabel("custom-status")).toBe(
      "custom-status"
    );
  });

  it("returns badge classes for each known state and a safe default", () => {
    expect(
      RentalStatusService.getStatusBadgeClasses("lead_pending")
    ).toContain("bg-amber-100");
    expect(
      RentalStatusService.getStatusBadgeClasses("proposal_pending_renter")
    ).toContain("text-amber-800");
    expect(
      RentalStatusService.getStatusBadgeClasses("rental_confirmed")
    ).toContain("bg-cyan-100");
    expect(
      RentalStatusService.getStatusBadgeClasses("rental_active")
    ).toContain("bg-emerald-100");
    expect(
      RentalStatusService.getStatusBadgeClasses("rental_completed")
    ).toContain("bg-slate-100");
    expect(
      RentalStatusService.getStatusBadgeClasses("cancelled")
    ).toContain("bg-rose-100");
    expect(
      RentalStatusService.getStatusBadgeClasses("rejected")
    ).toContain("bg-orange-100");
    expect(
      RentalStatusService.getStatusBadgeClasses("expired")
    ).toContain("bg-zinc-100");
    expect(
      RentalStatusService.getStatusBadgeClasses("custom-status")
    ).toContain("bg-gray-100");
  });

  it("detects terminal statuses", () => {
    expect(RentalStatusService.isTerminalStatus("rental_completed")).toBe(true);
    expect(RentalStatusService.isTerminalStatus("cancelled")).toBe(true);
    expect(RentalStatusService.isTerminalStatus("rejected")).toBe(true);
    expect(RentalStatusService.isTerminalStatus("expired")).toBe(true);
    expect(RentalStatusService.isTerminalStatus("rental_active")).toBe(false);
  });
});
