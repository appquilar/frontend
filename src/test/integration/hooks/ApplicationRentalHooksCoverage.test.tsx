import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRentConversations } from "@/application/hooks/useRentConversations";
import { useRentalDetails } from "@/application/hooks/useRentalDetails";
import { ApiError } from "@/infrastructure/http/ApiClient";
import { createTestQueryClient } from "@/test/utils/renderWithProviders";

const {
    rentalServiceMock,
    useCurrentUserMock,
    useUnreadRentMessagesCountMock,
    toastMock,
} = vi.hoisted(() => ({
    rentalServiceMock: {
        getRentById: vi.fn(),
        updateRentStatus: vi.fn(),
        updateRent: vi.fn(),
        listRents: vi.fn(),
        listRentMessages: vi.fn(),
    },
    useCurrentUserMock: vi.fn(),
    useUnreadRentMessagesCountMock: vi.fn(),
    toastMock: vi.fn(),
}));

vi.mock("@/compositionRoot", () => ({
    rentalService: rentalServiceMock,
}));

vi.mock("@/application/hooks/useCurrentUser", () => ({
    useCurrentUser: () => useCurrentUserMock(),
}));

vi.mock("@/application/hooks/useRentalMessages", async () => {
    const actual = await vi.importActual<typeof import("@/application/hooks/useRentalMessages")>(
        "@/application/hooks/useRentalMessages"
    );

    return {
        ...actual,
        useUnreadRentMessagesCount: () => useUnreadRentMessagesCountMock(),
    };
});

vi.mock("@/components/ui/use-toast", () => ({
    toast: (...args: unknown[]) => toastMock(...args),
}));

const createWrapper = () => {
    const queryClient = createTestQueryClient();
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return {
        wrapper,
        invalidateQueriesSpy,
    };
};

const buildRental = (overrides: Record<string, unknown> = {}) => ({
    id: "rent-1",
    productId: "product-1",
    productName: "Taladro Pro",
    ownerId: "company-1",
    ownerName: "Appquilar",
    ownerType: "company",
    renterId: "user-2",
    renterName: "Victor",
    startDate: new Date("2026-04-20T00:00:00.000Z"),
    endDate: new Date("2026-04-22T00:00:00.000Z"),
    requestedQuantity: 2,
    deposit: { amount: 1000, currency: "EUR" },
    price: { amount: 3000, currency: "EUR" },
    status: "lead_pending",
    isLead: false,
    ...overrides,
});

describe("application rental hooks coverage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("derives rental detail actions, viewer role and invalidation side effects", async () => {
        useCurrentUserMock.mockReturnValue({
            user: {
                id: "user-1",
                companyId: "company-1",
                roles: [],
            },
        });
        rentalServiceMock.getRentById.mockResolvedValue(buildRental());
        rentalServiceMock.updateRentStatus
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(
                new ApiError("Conflict", 409, {
                    error: ["product.inventory.unavailable"],
                })
            );
        rentalServiceMock.updateRent
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error("boom"));

        const wrapperData = createWrapper();
        const { result } = renderHook(() => useRentalDetails("rent-1"), {
            wrapper: wrapperData.wrapper,
        });

        await waitFor(() => {
            expect(result.current.rental?.id).toBe("rent-1");
        });

        expect(result.current.viewerRole).toBe("owner");
        expect(result.current.canEditRental).toBe(true);
        expect(result.current.nextTransitions.length).toBeGreaterThan(0);
        expect(result.current.calculateDurationDays()).toBe(2);
        expect(result.current.formatDate(new Date("2026-04-20T00:00:00.000Z"))).toBe("20/04/2026");

        await act(async () => {
            await result.current.handleStatusChange({
                status: "rental_confirmed",
            });
        });

        expect(wrapperData.invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: ["rent", "rent-1"],
        });
        expect(wrapperData.invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: ["rents"],
        });
        expect(wrapperData.invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: ["rentUnreadMessages"],
        });
        expect(wrapperData.invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: ["rentConversations"],
        });
        expect(toastMock).toHaveBeenCalledWith({
            title: "Accion aplicada",
            description: "Se proceso la accion sobre Reserva confirmada.",
        });

        await expect(
            result.current.handleStatusChange({
                status: "rental_active",
            })
        ).rejects.toBeInstanceOf(ApiError);
        expect(toastMock).toHaveBeenCalledWith({
            title: "Error",
            description: "No hay stock disponible para confirmar o activar este alquiler.",
            variant: "destructive",
        });

        await act(async () => {
            await result.current.handleRentalUpdate({
                startDate: new Date("2026-04-24T00:00:00.000Z"),
                endDate: new Date("2026-04-26T00:00:00.000Z"),
                requestedQuantity: 3,
            });
        });
        expect(toastMock).toHaveBeenCalledWith({
            title: "Alquiler actualizado",
            description: "Se guardaron fechas y precios correctamente.",
        });

        await expect(
            result.current.handleRentalUpdate({
                startDate: new Date("2026-04-24T00:00:00.000Z"),
                endDate: new Date("2026-04-26T00:00:00.000Z"),
                requestedQuantity: 3,
            })
        ).rejects.toThrow("boom");
        expect(toastMock).toHaveBeenCalledWith({
            title: "Error",
            description: "No se pudo actualizar el alquiler",
            variant: "destructive",
        });
    });

    it("resolves a completed rental deposit with a dedicated patch payload", async () => {
        useCurrentUserMock.mockReturnValue({
            user: {
                id: "user-1",
                companyId: "company-1",
                roles: [],
            },
        });
        rentalServiceMock.getRentById.mockResolvedValue(buildRental({
            status: "rental_completed",
            deposit: { amount: 1000, currency: "EUR" },
            depositReturned: null,
        }));
        rentalServiceMock.updateRent.mockResolvedValue(undefined);

        const wrapperData = createWrapper();
        const { result } = renderHook(() => useRentalDetails("rent-1"), {
            wrapper: wrapperData.wrapper,
        });

        await waitFor(() => {
            expect(result.current.rental?.status).toBe("rental_completed");
        });

        expect(result.current.canEditRental).toBe(false);
        expect(result.current.canResolveDeposit).toBe(true);

        await act(async () => {
            await result.current.handleDepositResolution({
                amount: 500,
                currency: "EUR",
            });
        });

        expect(rentalServiceMock.updateRent).toHaveBeenCalledWith("rent-1", {
            depositReturned: {
                amount: 500,
                currency: "EUR",
            },
        });
        expect(wrapperData.invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: ["rent", "rent-1"],
        });
        expect(wrapperData.invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: ["rents"],
        });
        expect(toastMock).toHaveBeenCalledWith({
            title: "Fianza actualizada",
            description: "Se ha registrado la resolución de la fianza.",
        });
    });

    it("builds rent conversations for owner and renter roles, preserving unread counters and message ordering", async () => {
        useCurrentUserMock.mockReturnValue({
            user: {
                id: "user-1",
                companyId: "company-1",
            },
        });
        useUnreadRentMessagesCountMock.mockReturnValue({
            byRent: [
                { rentId: "rent-1", unreadCount: 4 },
                { rentId: "rent-2", unreadCount: 2 },
            ],
            totalUnread: 6,
        });
        rentalServiceMock.listRents
            .mockResolvedValueOnce({
                data: [
                    buildRental({
                        id: "rent-1",
                        ownerId: "company-1",
                        status: "lead_pending",
                    }),
                    buildRental({
                        id: "rent-2",
                        ownerId: "company-1",
                        status: "cancelled",
                    }),
                ],
            })
            .mockResolvedValueOnce({
                data: [
                    buildRental({
                        id: "rent-3",
                        ownerId: "company-9",
                        ownerType: "user",
                        ownerName: "Propietario",
                        renterId: "user-1",
                        renterName: "Victor",
                    }),
                ],
            });
        rentalServiceMock.listRentMessages.mockImplementation(
            async (rentId: string, params?: { page?: number; perPage?: number }) => {
                if (rentId === "rent-1" && params?.page === 1) {
                    return {
                        total: 2,
                        data: [{ createdAt: new Date("2026-04-22T10:00:00.000Z") }],
                    };
                }

                if (rentId === "rent-1" && params?.page === 2) {
                    return {
                        total: 1,
                        data: [{ createdAt: new Date("2026-04-23T10:00:00.000Z") }],
                    };
                }

                if (rentId === "rent-2") {
                    return {
                        total: 0,
                        data: [],
                    };
                }

                return {
                    total: 1,
                    data: [{ createdAt: new Date("2026-04-24T10:00:00.000Z") }],
                };
            }
        );

        const { result } = renderHook(() => useRentConversations(), {
            wrapper: createWrapper().wrapper,
        });

        await waitFor(() => {
            expect(result.current.conversations).toHaveLength(3);
        });

        expect(result.current.totalUnread).toBe(6);
        expect(result.current.unreadMap).toEqual({
            "rent-1": 4,
            "rent-2": 2,
        });
        expect(result.current.conversations.map((conversation) => conversation.rentId)).toEqual([
            "rent-3",
            "rent-1",
            "rent-2",
        ]);
        expect(result.current.conversations[0]).toMatchObject({
            rentId: "rent-3",
            role: "renter",
            unreadCount: 0,
            counterpartName: "Propietario",
        });
        expect(result.current.conversations[1]).toMatchObject({
            rentId: "rent-1",
            role: "owner",
            unreadCount: 4,
            counterpartName: "Victor",
        });
        expect(result.current.conversations[2]).toMatchObject({
            rentId: "rent-2",
            unreadCount: 0,
            productName: "Taladro Pro",
        });
    });
});
