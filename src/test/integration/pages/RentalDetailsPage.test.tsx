import { StrictMode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Rental } from "@/domain/models/Rental";
import RentalDetails from "@/pages/dashboard/rentals/RentalDetails";
import { createTestQueryClient } from "@/test/utils/renderWithProviders";

const { rentalServiceMock, useCurrentUserMock } = vi.hoisted(() => ({
  rentalServiceMock: {
    getRentById: vi.fn(),
    updateRentStatus: vi.fn(),
    updateRent: vi.fn(),
    createRentMessage: vi.fn(),
    listRentMessages: vi.fn(),
    markRentMessagesAsRead: vi.fn(),
  },
  useCurrentUserMock: vi.fn(),
}));

vi.mock("@/compositionRoot", () => ({
  rentalService: rentalServiceMock,
  productInventoryService: {},
  productService: {},
}));

vi.mock("@/application/hooks/useCurrentUser", () => ({
  useCurrentUser: () => useCurrentUserMock(),
}));

vi.mock("@/components/ui/use-toast", () => ({
  toast: vi.fn(),
}));

const buildRenterRental = (): Rental => ({
  id: "7df21b92-renter-rent",
  productId: "product-1",
  productName: "Bicicleta gravel talla M",
  productSlug: "bicicleta-gravel",
  productPublicationStatus: "published",
  productInternalId: "MTP-001",
  ownerId: "company-1",
  ownerType: "company",
  ownerName: "Mountain Pro Rentals",
  renterId: "renter-1",
  renterName: "Explorer Renter",
  renterEmail: "explorer.renter@appquilar.test",
  ownerLocation: {
    city: "Bilbao",
    state: "Bizkaia",
    country: "España",
  },
  startDate: new Date(2026, 6, 15, 0, 0, 0),
  endDate: new Date(2026, 6, 17, 23, 59, 59),
  requestedQuantity: 1,
  deposit: { amount: 65000, currency: "EUR" },
  price: { amount: 14700, currency: "EUR" },
  depositReturned: { amount: 0, currency: "EUR" },
  status: "proposal_pending_renter",
  isLead: true,
  proposalValidUntil: new Date(2026, 6, 30, 23, 59, 59),
  ownerProposalAccepted: true,
  renterProposalAccepted: false,
});

const renderRentalDetails = () => {
  const queryClient = createTestQueryClient();

  return render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/dashboard/rentals/7df21b92-renter-rent"]}>
          <Routes>
            <Route path="/dashboard/rentals/:id" element={<RentalDetails />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </StrictMode>
  );
};

describe("RentalDetails page", () => {
  beforeEach(() => {
    useCurrentUserMock.mockReturnValue({
      user: {
        id: "renter-1",
        email: "explorer.renter@appquilar.test",
        roles: [],
      },
    });
    rentalServiceMock.getRentById.mockResolvedValue(buildRenterRental());
    rentalServiceMock.listRentMessages.mockResolvedValue({
      data: [
        {
          id: "message-system",
          rentId: "7df21b92-renter-rent",
          senderRole: "system",
          senderName: "Appquilar",
          content:
            "Actualización de propuesta por Mountain Pro Rentals:\n- Fecha fin: 2026-07-17 → 2026-07-20\n- Precio: 147.00 EUR → 155.00 EUR",
          createdAt: new Date(2026, 6, 10, 9, 30, 0),
          isMine: false,
        },
        {
          id: "message-owner",
          rentId: "7df21b92-renter-rent",
          senderRole: "owner",
          senderName: "Mountain Pro Rentals",
          content: "Puedes revisar la propuesta.",
          createdAt: new Date(2026, 6, 10, 9, 35, 0),
          isMine: false,
        },
      ],
      total: 2,
      page: 1,
      perPage: 200,
    });
    rentalServiceMock.markRentMessagesAsRead.mockResolvedValue(undefined);
  });

  it("opens a renter rental detail without loading owner-only inventory or looping read markers", async () => {
    renderRentalDetails();

    expect(await screen.findByRole("heading", { name: "Estado y acciones" })).toBeInTheDocument();

    expect(screen.getAllByText("Propuesta enviada").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Aceptar propuesta" })).toBeInTheDocument();
    expect(await screen.findByText("Actividad")).toBeInTheDocument();
    expect(await screen.findByText("Actualización de propuesta por Mountain Pro Rentals")).toBeInTheDocument();
    expect(screen.getByText("Fecha fin")).toBeInTheDocument();
    expect(screen.getByText("2026-07-17")).toBeInTheDocument();
    expect(screen.getByText("2026-07-20")).toBeInTheDocument();
    expect(screen.queryByText("Inventario del alquiler")).not.toBeInTheDocument();
    expect(screen.queryByText("Editar condiciones")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(rentalServiceMock.markRentMessagesAsRead).toHaveBeenCalledTimes(1);
    });
  });
});
