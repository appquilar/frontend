import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    COMPANY_USER_ROLES,
    useCompanyUsers,
    useCreateCompany,
    useInviteCompanyUser,
    useRemoveCompanyUser,
    useUpdateCompanyUserRole,
} from "@/application/hooks/useCompanyMembership";
import {
    useCreateCheckoutSession,
    useCreateCustomerPortalSession,
    useMigrateCompanyToExplorer,
    useReactivateSubscription,
    useSynchronizeCheckoutSession,
} from "@/application/hooks/useBilling";
import {
    getProductAvailabilityLabel,
    useAdjustProductInventory,
    useProductAvailability,
    useProductInventory,
    useProductInventoryAllocations,
    useProductInventoryUnits,
    useProductRentability,
    useUpdateInventoryUnit,
} from "@/application/hooks/useProductInventory";
import {
    RENT_CONVERSATIONS_KEY,
    RENT_MESSAGES_KEY,
    RENT_UNREAD_KEY,
    useCreateRentalMessage,
    useMarkRentMessagesAsRead,
    useRentalMessages,
    useUnreadCountForRent,
    useUnreadCountMap,
    useUnreadRentMessagesCount,
    useUnreadRentMessagesTotal,
    useUpdateRentStatusFromMessages,
} from "@/application/hooks/useRentalMessages";
import { useRentalForm } from "@/application/hooks/useRentalForm";
import { ApiError } from "@/infrastructure/http/ApiClient";
import { createTestQueryClient } from "@/test/utils/renderWithProviders";

const {
    billingServiceMock,
    companyMembershipServiceMock,
    productInventoryServiceMock,
    rentalServiceMock,
    navigateMock,
    toastMock,
} = vi.hoisted(() => ({
    billingServiceMock: {
        createCheckoutSession: vi.fn(),
        createCustomerPortalSession: vi.fn(),
        reactivateSubscription: vi.fn(),
        synchronizeCheckoutSession: vi.fn(),
        migrateCompanyToExplorer: vi.fn(),
    },
    companyMembershipServiceMock: {
        listCompanyUsers: vi.fn(),
        createCompany: vi.fn(),
        inviteCompanyUser: vi.fn(),
        updateCompanyUserRole: vi.fn(),
        removeCompanyUser: vi.fn(),
    },
    productInventoryServiceMock: {
        getInventorySummary: vi.fn(),
        getInventoryAllocations: vi.fn(),
        getInventoryUnits: vi.fn(),
        checkAvailability: vi.fn(),
        adjustInventory: vi.fn(),
        updateInventoryUnit: vi.fn(),
    },
    rentalServiceMock: {
        listRentMessages: vi.fn(),
        createRentMessage: vi.fn(),
        markRentMessagesAsRead: vi.fn(),
        getUnreadRentMessagesCount: vi.fn(),
        updateRentStatus: vi.fn(),
        createRent: vi.fn(),
    },
    navigateMock: vi.fn(),
    toastMock: vi.fn(),
}));

vi.mock("@/compositionRoot", () => ({
    billingService: billingServiceMock,
    companyMembershipService: companyMembershipServiceMock,
    productInventoryService: productInventoryServiceMock,
    rentalService: rentalServiceMock,
}));

vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

    return {
        ...actual,
        useNavigate: () => navigateMock,
    };
});

vi.mock("@/components/ui/use-toast", () => ({
    toast: (...args: unknown[]) => toastMock(...args),
}));

const createWrapper = () => {
    const queryClient = createTestQueryClient();
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    const refetchQueriesSpy = vi.spyOn(queryClient, "refetchQueries");

    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return {
        wrapper,
        invalidateQueriesSpy,
        refetchQueriesSpy,
    };
};

describe("application hook coverage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("loads inventory queries, handles empty product ids and invalidates cached inventory keys after mutations", async () => {
        productInventoryServiceMock.getInventorySummary.mockResolvedValueOnce({
            productId: "product-1",
            totalQuantity: 4,
            reservedQuantity: 1,
            availableQuantity: 3,
            isRentalEnabled: true,
            isInventoryEnabled: true,
            capabilityState: "enabled",
            inventoryMode: "managed_serialized",
            isRentableNow: true,
            unavailabilityReason: null,
        });
        productInventoryServiceMock.getInventoryAllocations.mockResolvedValueOnce([
            { allocationId: "allocation-1" },
        ]);
        productInventoryServiceMock.getInventoryUnits.mockResolvedValueOnce([
            { unitId: "unit-1", productId: "product-1", code: "A-01", status: "available", sortOrder: 1 },
        ]);
        productInventoryServiceMock.checkAvailability.mockResolvedValueOnce({
            canRequest: true,
            status: "available",
            message: "",
            managedByPlatform: true,
        });
        productInventoryServiceMock.adjustInventory.mockResolvedValue(undefined);
        productInventoryServiceMock.updateInventoryUnit.mockResolvedValue({
            unitId: "unit-1",
            productId: "product-1",
            code: "B-02",
            status: "reserved",
            sortOrder: 2,
            nextAllocation: null,
        });

        const queryClientA = createWrapper();
        const { result: summaryResult } = renderHook(() => useProductInventory("product-1"), {
            wrapper: queryClientA.wrapper,
        });

        await waitFor(() => {
            expect(summaryResult.current.data?.availableQuantity).toBe(3);
        });

        const queryClientB = createWrapper();
        const { result: allocationsResult } = renderHook(
            () => useProductInventoryAllocations("product-1"),
            { wrapper: queryClientB.wrapper }
        );

        await waitFor(() => {
            expect(allocationsResult.current.data).toEqual([{ allocationId: "allocation-1" }]);
        });

        const queryClientC = createWrapper();
        const { result: unitsResult } = renderHook(() => useProductInventoryUnits("product-1"), {
            wrapper: queryClientC.wrapper,
        });

        await waitFor(() => {
            expect(unitsResult.current.data?.[0]?.unitId).toBe("unit-1");
        });

        const queryClientD = createWrapper();
        const { result: availabilityResult } = renderHook(
            () => useProductAvailability("product-1", "2026-04-20", "2026-04-22", 2),
            { wrapper: queryClientD.wrapper }
        );

        await waitFor(() => {
            expect(availabilityResult.current.data?.canRequest).toBe(true);
        });

        const emptyQuery = renderHook(() => useProductInventory(null), {
            wrapper: createWrapper().wrapper,
        });

        expect(emptyQuery.result.current.fetchStatus).toBe("idle");

        const adjustWrapper = createWrapper();
        const { result: adjustMutation } = renderHook(() => useAdjustProductInventory(), {
            wrapper: adjustWrapper.wrapper,
        });

        await act(async () => {
            await adjustMutation.current.mutateAsync({ productId: "product-1", totalQuantity: 9 });
        });

        expect(productInventoryServiceMock.adjustInventory).toHaveBeenCalledWith("product-1", 9);
        expect(adjustWrapper.invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: ["productInventory", "product-1"],
        });
        expect(adjustWrapper.invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: ["productInventory", "product-1", "allocations"],
        });
        expect(adjustWrapper.invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: ["productInventory", "product-1", "units"],
        });
        expect(adjustWrapper.invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: ["product", "product-1"],
        });
        expect(adjustWrapper.invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: ["products"],
        });

        const updateWrapper = createWrapper();
        const { result: updateMutation } = renderHook(() => useUpdateInventoryUnit(), {
            wrapper: updateWrapper.wrapper,
        });

        await act(async () => {
            await updateMutation.current.mutateAsync({
                productId: "product-1",
                unitId: "unit-1",
                data: {
                    code: "B-02",
                    status: "maintenance",
                },
            });
        });

        expect(productInventoryServiceMock.updateInventoryUnit).toHaveBeenCalledWith(
            "product-1",
            "unit-1",
            {
                code: "B-02",
                status: "maintenance",
            }
        );
        expect(updateWrapper.invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: ["productInventory", "product-1"],
        });
        expect(updateWrapper.invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: ["productInventory", "product-1", "units"],
        });
    });

    it("exposes rentability helpers for public product inventory cards", () => {
        expect(
            getProductAvailabilityLabel(
                {
                    inventorySummary: {
                        availableQuantity: 5,
                        reservedQuantity: 0,
                        totalQuantity: 5,
                        inventoryMode: "managed_serialized",
                        capabilityState: "enabled",
                        isRentalEnabled: true,
                        isInventoryEnabled: true,
                        isRentableNow: true,
                        productId: "product-1",
                        productInternalId: "P-001",
                        unavailabilityReason: null,
                    },
                } as never,
                true
            )
        ).toContain("5");

        const { result } = renderHook(() =>
            useProductRentability({
                inventorySummary: {
                    availableQuantity: 0,
                    reservedQuantity: 3,
                    totalQuantity: 3,
                    inventoryMode: "managed_serialized",
                    capabilityState: "enabled",
                    isRentalEnabled: true,
                    isInventoryEnabled: true,
                    isRentableNow: false,
                    productId: "product-1",
                    productInternalId: "P-001",
                    unavailabilityReason: "Sin stock",
                },
            } as never)
        );

        expect(result.current.isRentalEnabled).toBe(false);
        expect(result.current.availabilityLabel).toBe("No disponible");
    });

    it("maps rental message queries, unread counters and invalidation side effects", async () => {
        rentalServiceMock.listRentMessages
            .mockResolvedValueOnce({
                data: [
                    {
                        id: "message-1",
                        content: "Hola",
                    },
                ],
                total: 1,
                page: 2,
                perPage: 10,
            })
            .mockResolvedValueOnce({
                data: [],
                total: 0,
                page: 1,
                perPage: 1,
            });
        rentalServiceMock.getUnreadRentMessagesCount.mockResolvedValue({
            totalUnread: 4,
            byRent: [
                { rentId: "rent-1", unreadCount: 3 },
                { rentId: "rent-2", unreadCount: 1 },
            ],
        });
        rentalServiceMock.createRentMessage.mockResolvedValue(undefined);
        rentalServiceMock.markRentMessagesAsRead.mockResolvedValue(undefined);

        const queryWrapper = createWrapper();
        const { result: messagesResult } = renderHook(
            () => useRentalMessages("rent-1", { page: 2, perPage: 10 }, { pollingEnabled: false }),
            { wrapper: queryWrapper.wrapper }
        );

        await waitFor(() => {
            expect(messagesResult.current.messages).toHaveLength(1);
        });

        expect(messagesResult.current.total).toBe(1);
        expect(messagesResult.current.page).toBe(2);
        expect(messagesResult.current.perPage).toBe(10);
        expect(rentalServiceMock.listRentMessages).toHaveBeenCalledWith("rent-1", {
            page: 2,
            perPage: 10,
        });

        const emptyMessages = renderHook(
            () => useRentalMessages(undefined, { page: 3, perPage: 7 }),
            { wrapper: createWrapper().wrapper }
        );
        expect(emptyMessages.result.current.messages).toEqual([]);
        expect(emptyMessages.result.current.total).toBe(0);
        expect(emptyMessages.result.current.page).toBe(1);
        expect(emptyMessages.result.current.perPage).toBe(7);

        const unreadCountResult = renderHook(() => useUnreadRentMessagesCount(), {
            wrapper: createWrapper().wrapper,
        });
        await waitFor(() => {
            expect(unreadCountResult.result.current.totalUnread).toBe(4);
        });

        const unreadTotalResult = renderHook(() => useUnreadRentMessagesTotal(), {
            wrapper: createWrapper().wrapper,
        });
        await waitFor(() => {
            expect(unreadTotalResult.result.current.totalUnread).toBe(4);
        });

        const unreadByRentResult = renderHook(() => useUnreadCountForRent("rent-1"), {
            wrapper: createWrapper().wrapper,
        });
        await waitFor(() => {
            expect(unreadByRentResult.result.current).toBe(3);
        });

        const unreadMapResult = renderHook(() => useUnreadCountMap(), {
            wrapper: createWrapper().wrapper,
        });
        await waitFor(() => {
            expect(unreadMapResult.result.current).toEqual({
                "rent-1": 3,
                "rent-2": 1,
            });
        });

        const createWrapperData = createWrapper();
        const { result: createMessageResult } = renderHook(
            () => useCreateRentalMessage("rent-1"),
            { wrapper: createWrapperData.wrapper }
        );

        await act(async () => {
            await createMessageResult.current.mutateAsync("Necesito disponibilidad");
        });

        expect(rentalServiceMock.createRentMessage).toHaveBeenCalledWith("rent-1", {
            content: "Necesito disponibilidad",
        });
        expect(createWrapperData.invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: [RENT_MESSAGES_KEY, "rent-1"],
            exact: false,
        });
        expect(createWrapperData.invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: [RENT_UNREAD_KEY],
            exact: false,
        });
        expect(createWrapperData.invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: [RENT_CONVERSATIONS_KEY],
            exact: false,
        });

        const markWrapper = createWrapper();
        const { result: markAsReadResult } = renderHook(
            () => useMarkRentMessagesAsRead("rent-1"),
            { wrapper: markWrapper.wrapper }
        );

        await act(async () => {
            await markAsReadResult.current.mutateAsync();
        });

        expect(rentalServiceMock.markRentMessagesAsRead).toHaveBeenCalledWith("rent-1");
        expect(markWrapper.invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: [RENT_UNREAD_KEY],
            exact: false,
        });
        expect(markWrapper.invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: [RENT_CONVERSATIONS_KEY],
            exact: false,
        });
    });

    it("updates rent status from messages and shows a stock-aware destructive toast on conflicts", async () => {
        rentalServiceMock.updateRentStatus
            .mockRejectedValueOnce(
                new ApiError("Conflict", 409, {
                    error: ["product.inventory.unavailable"],
                })
            )
            .mockResolvedValueOnce(undefined);

        const errorWrapper = createWrapper();
        const { result: errorMutation } = renderHook(
            () => useUpdateRentStatusFromMessages("rent-1"),
            { wrapper: errorWrapper.wrapper }
        );

        await expect(
            errorMutation.current.mutateAsync({
                status: "accepted",
            } as never)
        ).rejects.toBeInstanceOf(ApiError);

        await waitFor(() => {
            expect(toastMock).toHaveBeenCalledWith({
                title: "Error",
                description: "No hay stock disponible para confirmar o activar este alquiler.",
                variant: "destructive",
            });
        });

        const successWrapper = createWrapper();
        const { result: successMutation } = renderHook(
            () => useUpdateRentStatusFromMessages("rent-1"),
            { wrapper: successWrapper.wrapper }
        );

        await act(async () => {
            await successMutation.current.mutateAsync({
                status: "confirmed",
                proposalValidUntil: new Date("2026-04-23T12:00:00.000Z"),
            } as never);
        });

        expect(rentalServiceMock.updateRentStatus).toHaveBeenCalledWith("rent-1", {
            status: "confirmed",
            proposalValidUntil: new Date("2026-04-23T12:00:00.000Z"),
        });
        expect(successWrapper.invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: [RENT_MESSAGES_KEY, "rent-1"],
            exact: false,
        });
        expect(successWrapper.invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: [RENT_CONVERSATIONS_KEY],
            exact: false,
        });
        expect(successWrapper.invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: [RENT_UNREAD_KEY],
            exact: false,
        });
        expect(successWrapper.invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: ["rents"],
            exact: false,
        });
        expect(successWrapper.invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: ["rent", "rent-1"],
        });
    });

    it("submits rentals, refetches the dashboard list and reports inventory conflicts as field errors", async () => {
        rentalServiceMock.createRent
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(
                new ApiError("Conflict", 409, {
                    error: ["product.inventory.unavailable"],
                })
            )
            .mockRejectedValueOnce(new Error("boom"));

        const successWrapper = createWrapper();
        const { result: successResult } = renderHook(() => useRentalForm(), {
            wrapper: successWrapper.wrapper,
        });

        await act(async () => {
            await successResult.current.onSubmit({
                rentId: "rent-1",
                productId: "product-1",
                renterEmail: "renter@appquilar.test",
                renterName: "Victor",
                startDate: new Date("2026-04-24T00:00:00.000Z"),
                endDate: new Date("2026-04-26T00:00:00.000Z"),
                requestedQuantity: 2,
                depositAmount: 12.5,
                depositCurrency: "eur",
                priceAmount: 34.5,
                priceCurrency: "usd",
            } as never);
        });

        expect(rentalServiceMock.createRent).toHaveBeenCalledWith({
            rentId: "rent-1",
            productId: "product-1",
            renterEmail: "renter@appquilar.test",
            renterName: "Victor",
            startDate: new Date("2026-04-24T00:00:00.000Z"),
            endDate: new Date("2026-04-26T00:00:00.000Z"),
            requestedQuantity: 2,
            deposit: {
                amount: 1250,
                currency: "EUR",
            },
            price: {
                amount: 3450,
                currency: "USD",
            },
            isLead: false,
        });
        expect(toastMock).toHaveBeenCalledWith({
            title: "Alquiler creado",
            description: "El alquiler ha sido creado exitosamente",
        });
        expect(successWrapper.invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: ["rents"],
        });
        expect(successWrapper.refetchQueriesSpy).toHaveBeenCalledWith({
            queryKey: ["rents"],
            type: "all",
        });
        expect(navigateMock).toHaveBeenCalledWith("/dashboard/rentals");

        const conflictWrapper = createWrapper();
        const { result: conflictResult } = renderHook(() => useRentalForm(), {
            wrapper: conflictWrapper.wrapper,
        });

        await act(async () => {
            await conflictResult.current.onSubmit({
                rentId: "rent-2",
                productId: "product-2",
                renterEmail: "renter@appquilar.test",
                renterName: "",
                startDate: new Date("2026-04-24T00:00:00.000Z"),
                endDate: new Date("2026-04-26T00:00:00.000Z"),
                requestedQuantity: 1,
                depositAmount: 0,
                depositCurrency: "eur",
                priceAmount: 10,
                priceCurrency: "eur",
            } as never);
        });

        expect(
            conflictResult.current.form.getFieldState("productId").error?.message
        ).toBe("No hay stock disponible para ese producto en este momento.");

        const failureWrapper = createWrapper();
        const { result: failureResult } = renderHook(() => useRentalForm(), {
            wrapper: failureWrapper.wrapper,
        });

        await act(async () => {
            await failureResult.current.onSubmit({
                rentId: "rent-3",
                productId: "product-3",
                renterEmail: "renter@appquilar.test",
                renterName: "",
                startDate: new Date("2026-04-24T00:00:00.000Z"),
                endDate: new Date("2026-04-26T00:00:00.000Z"),
                requestedQuantity: 1,
                depositAmount: 0,
                depositCurrency: "eur",
                priceAmount: 10,
                priceCurrency: "eur",
            } as never);
        });

        expect(toastMock).toHaveBeenCalledWith({
            title: "Error",
            description: "No se pudo crear el alquiler",
            variant: "destructive",
        });
    });

    it("queries and mutates company membership records while invalidating the company user cache", async () => {
        companyMembershipServiceMock.listCompanyUsers.mockResolvedValueOnce([
            {
                companyId: "company-1",
                userId: "user-1",
                email: "admin@appquilar.test",
                role: "ROLE_ADMIN",
                status: "ACCEPTED",
            },
        ]);
        companyMembershipServiceMock.createCompany.mockResolvedValue(undefined);
        companyMembershipServiceMock.inviteCompanyUser.mockResolvedValue(undefined);
        companyMembershipServiceMock.updateCompanyUserRole.mockResolvedValue(undefined);
        companyMembershipServiceMock.removeCompanyUser.mockResolvedValue(undefined);

        const listWrapper = createWrapper();
        const { result: listResult } = renderHook(() => useCompanyUsers("company-1", 2, 25), {
            wrapper: listWrapper.wrapper,
        });

        await waitFor(() => {
            expect(listResult.current.data?.[0]?.email).toBe("admin@appquilar.test");
        });

        expect(companyMembershipServiceMock.listCompanyUsers).toHaveBeenCalledWith(
            "company-1",
            2,
            25
        );
        expect(COMPANY_USER_ROLES).toEqual([
            { value: "ROLE_CONTRIBUTOR", label: "Colaborador" },
            { value: "ROLE_ADMIN", label: "Administrador" },
        ]);

        const emptyListResult = renderHook(() => useCompanyUsers(null), {
            wrapper: createWrapper().wrapper,
        });
        expect(emptyListResult.result.current.fetchStatus).toBe("idle");

        const createCompanyResult = renderHook(() => useCreateCompany(), {
            wrapper: createWrapper().wrapper,
        });
        await act(async () => {
            await createCompanyResult.result.current.mutateAsync({
                companyId: "company-1",
                ownerId: "user-1",
                name: "Appquilar Pro",
            });
        });
        expect(companyMembershipServiceMock.createCompany).toHaveBeenCalled();

        const inviteWrapper = createWrapper();
        const inviteResult = renderHook(() => useInviteCompanyUser(), {
            wrapper: inviteWrapper.wrapper,
        });
        await act(async () => {
            await inviteResult.result.current.mutateAsync({
                companyId: "company-1",
                email: "invite@appquilar.test",
                role: "ROLE_CONTRIBUTOR",
            });
        });
        expect(inviteWrapper.invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: ["companyUsers", "company-1"],
        });

        const updateWrapper = createWrapper();
        const updateRoleResult = renderHook(() => useUpdateCompanyUserRole(), {
            wrapper: updateWrapper.wrapper,
        });
        await act(async () => {
            await updateRoleResult.result.current.mutateAsync({
                companyId: "company-1",
                userId: "user-1",
                role: "ROLE_ADMIN",
            });
        });
        expect(updateWrapper.invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: ["companyUsers", "company-1"],
        });

        const removeWrapper = createWrapper();
        const removeResult = renderHook(() => useRemoveCompanyUser(), {
            wrapper: removeWrapper.wrapper,
        });
        await act(async () => {
            await removeResult.result.current.mutateAsync({
                companyId: "company-1",
                userId: "user-1",
            });
        });
        expect(removeWrapper.invalidateQueriesSpy).toHaveBeenCalledWith({
            queryKey: ["companyUsers", "company-1"],
        });
    });

    it("delegates billing mutations through the billing service wrappers", async () => {
        billingServiceMock.createCheckoutSession.mockResolvedValueOnce({
            url: "https://checkout.test",
        });
        billingServiceMock.createCustomerPortalSession.mockResolvedValueOnce({
            url: "https://portal.test",
        });
        billingServiceMock.reactivateSubscription.mockResolvedValueOnce({
            reactivated: true,
        });
        billingServiceMock.synchronizeCheckoutSession.mockResolvedValueOnce({
            synchronized: true,
        });
        billingServiceMock.migrateCompanyToExplorer.mockResolvedValueOnce({
            migratedOwnerUserId: "user-2",
            companyDeleted: true,
        });

        const checkoutResult = renderHook(() => useCreateCheckoutSession(), {
            wrapper: createWrapper().wrapper,
        });
        await act(async () => {
            await checkoutResult.result.current.mutateAsync({
                scope: "user",
                planType: "user_pro",
                successUrl: "https://appquilar.test/success",
                cancelUrl: "https://appquilar.test/cancel",
            });
        });

        const portalResult = renderHook(() => useCreateCustomerPortalSession(), {
            wrapper: createWrapper().wrapper,
        });
        await act(async () => {
            await portalResult.result.current.mutateAsync({
                scope: "company",
                returnUrl: "https://appquilar.test/dashboard",
            });
        });

        const reactivateResult = renderHook(() => useReactivateSubscription(), {
            wrapper: createWrapper().wrapper,
        });
        await act(async () => {
            await reactivateResult.result.current.mutateAsync({
                scope: "user",
            });
        });

        const syncResult = renderHook(() => useSynchronizeCheckoutSession(), {
            wrapper: createWrapper().wrapper,
        });
        await act(async () => {
            await syncResult.result.current.mutateAsync({
                scope: "company",
                sessionId: "cs_test_123",
            });
        });

        const migrateResult = renderHook(() => useMigrateCompanyToExplorer(), {
            wrapper: createWrapper().wrapper,
        });
        await act(async () => {
            await migrateResult.result.current.mutateAsync({
                confirm: true,
                targetOwnerUserId: "user-2",
            });
        });

        expect(billingServiceMock.createCheckoutSession).toHaveBeenCalledWith({
            scope: "user",
            planType: "user_pro",
            successUrl: "https://appquilar.test/success",
            cancelUrl: "https://appquilar.test/cancel",
        });
        expect(billingServiceMock.createCustomerPortalSession).toHaveBeenCalledWith({
            scope: "company",
            returnUrl: "https://appquilar.test/dashboard",
        });
        expect(billingServiceMock.reactivateSubscription).toHaveBeenCalledWith({
            scope: "user",
        });
        expect(billingServiceMock.synchronizeCheckoutSession).toHaveBeenCalledWith({
            scope: "company",
            sessionId: "cs_test_123",
        });
        expect(billingServiceMock.migrateCompanyToExplorer).toHaveBeenCalledWith({
            confirm: true,
            targetOwnerUserId: "user-2",
        });
    });
});
