import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAuthSession } from "@/domain/models/AuthSession";
import { ApiRentalRepository } from "@/infrastructure/repositories/ApiRentalRepository";

const createApiClientMock = () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
});

describe("ApiRentalRepository", () => {
  let apiClient: ReturnType<typeof createApiClientMock>;
  let repository: ApiRentalRepository;

  beforeEach(() => {
    apiClient = createApiClientMock();
    repository = new ApiRentalRepository(
      apiClient as never,
      () => createAuthSession({ token: "jwt-token" })
    );
  });

  it("serializes list queries and maps wrapped rent payloads", async () => {
    apiClient.get.mockResolvedValueOnce({
      data: {
        data: [
          {
            rent_id: "rent-1",
            product_id: "product-1",
            product_name: "Taladro",
            product_slug: "taladro",
            product_internal_id: "P-001",
            owner_id: "owner-1",
            owner_type: "COMPANY",
            owner_name: "Acme",
            renter_id: "renter-1",
            renter_name: "Maria",
            renter_email: "maria@test.com",
            owner_location: {
              street: "Calle 1",
              street2: null,
              city: "Madrid",
              postal_code: "28001",
              state: "Madrid",
              country: "ES",
              latitude: 40.4,
              longitude: -3.7,
              label: "Showroom",
            },
            start_date: "2026-01-10 08:00:00",
            end_date: "2026-01-12",
            requested_quantity: 3,
            deposit: { amount: 10000, currency: "EUR" },
            price: { amount: 20000, currency: "EUR" },
            deposit_returned: { amount: 5000, currency: "EUR" },
            status: "confirmed",
            is_lead: true,
            proposal_valid_until: "2026-01-13",
            owner_proposal_accepted: true,
            renter_proposal_accepted: false,
          },
        ],
        total: 1,
        page: 3,
        per_page: 25,
      },
    });

    const result = await repository.listRents({
      productId: "product-1",
      search: "Taladro",
      statusGroup: "pending",
      startDate: new Date(2026, 0, 10),
      endDate: new Date(2026, 0, 12),
      status: "rental_confirmed",
      isLead: true,
      timeline: "upcoming",
      role: "owner",
      ownerId: "owner-1",
      page: 3,
      perPage: 25,
    });

    expect(apiClient.get).toHaveBeenCalledWith(
      "/api/rents?product_id=product-1&search=Taladro&status_group=pending&start_date=2026-01-10&end_date=2026-01-12&status=rental_confirmed&is_lead=true&timeline=upcoming&role=owner&owner_id=owner-1&page=3&per_page=25",
      {
        headers: {
          Authorization: "Bearer jwt-token",
        },
      }
    );
    expect(result.total).toBe(1);
    expect(result.page).toBe(3);
    expect(result.perPage).toBe(25);
    expect(result.data[0]).toMatchObject({
      id: "rent-1",
      ownerType: "company",
      ownerLocation: {
        postalCode: "28001",
        label: "Showroom",
      },
      requestedQuantity: 3,
      isLead: true,
      proposalValidUntil: new Date(2026, 0, 13, 23, 59, 59),
      ownerProposalAccepted: true,
      renterProposalAccepted: false,
    });
    expect(result.data[0].startDate).toEqual(new Date(2026, 0, 10, 0, 0, 0));
    expect(result.data[0].endDate).toEqual(new Date(2026, 0, 12, 23, 59, 59));
  });

  it("loads the rent summary endpoint and normalizes numeric fields", async () => {
    apiClient.get.mockResolvedValueOnce({
      data: {
        owner: {
          total: 11,
          upcoming: 7,
          past: 4,
        },
        renter: {
          total: 3,
          upcoming: 2,
          past: 1,
        },
      },
    });

    await expect(repository.getSummary("owner-1")).resolves.toEqual({
      owner: {
        total: 11,
        upcoming: 7,
        past: 4,
      },
      renter: {
        total: 3,
        upcoming: 2,
        past: 1,
      },
    });

    expect(apiClient.get).toHaveBeenCalledWith(
      "/api/rents/summary?owner_id=owner-1",
      {
        headers: {
          Authorization: "Bearer jwt-token",
        },
      }
    );
  });

  it("handles fallback date parsing, single rent fetch errors and message mapping", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    apiClient.get
      .mockResolvedValueOnce({
        data: {
          rent_id: "rent-2",
          product_id: "product-2",
          owner_id: "owner-2",
          owner_type: "user",
          renter_id: null,
          start_date: "2026-01-10T12:00:00Z",
          end_date: "2026-01-11T12:00:00Z",
          deposit: { amount: 1000, currency: "EUR" },
          price: { amount: 2000, currency: "EUR" },
          status: "pending",
        },
      })
      .mockRejectedValueOnce(new Error("missing"))
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              message_id: "message-1",
              rent_id: "rent-1",
              sender_role: "owner",
              sender_name: "Acme",
              content: "Hola",
              created_at: "2026-01-10T08:15:00Z",
              is_mine: true,
            },
          ],
          total: 1,
          page: 2,
          per_page: 10,
        },
      })
      .mockResolvedValueOnce({
        data: {
          total_unread: 4,
          by_rent: [
            {
              rent_id: "rent-1",
              unread_count: 3,
            },
          ],
        },
      });

    const rent = await repository.getRentById("rent-2");
    const missing = await repository.getRentById("missing");
    const messages = await repository.listRentMessages("rent-1", {
      page: 2,
      perPage: 10,
    });
    const unread = await repository.getUnreadRentMessagesCount();

    expect(rent?.startDate.getFullYear()).toBe(2026);
    expect(rent?.startDate.getMonth()).toBe(0);
    expect(rent?.startDate.getDate()).toBe(10);
    expect(rent?.startDate.getHours()).toBe(0);
    expect(rent?.endDate.getFullYear()).toBe(2026);
    expect(rent?.endDate.getMonth()).toBe(0);
    expect(rent?.endDate.getDate()).toBe(11);
    expect(rent?.endDate.getHours()).toBe(23);
    expect(rent?.endDate.getMinutes()).toBe(59);
    expect(rent?.endDate.getSeconds()).toBe(59);
    expect(missing).toBeNull();
    expect(messages).toMatchObject({
      total: 1,
      page: 2,
      perPage: 10,
    });
    expect(messages.data[0]).toMatchObject({
      id: "message-1",
      rentId: "rent-1",
      senderRole: "owner",
      content: "Hola",
      isMine: true,
    });
    expect(unread).toEqual({
      totalUnread: 4,
      byRent: [
        {
          rentId: "rent-1",
          unreadCount: 3,
        },
      ],
    });

    consoleErrorSpy.mockRestore();
  });

  it("serializes create, update and status mutations", async () => {
    apiClient.post.mockResolvedValue(undefined);
    apiClient.patch.mockResolvedValue(undefined);

    await repository.createRent({
      rentId: "rent-1",
      productId: "product-1",
      startDate: new Date(2026, 0, 10),
      endDate: new Date(2026, 0, 12),
      requestedQuantity: 0,
      deposit: { amount: 1000, currency: "EUR" },
      price: { amount: 2000, currency: "EUR" },
      renterEmail: "renter@appquilar.test",
      renterName: "Renter",
      isLead: true,
    });
    await repository.updateRent("rent-1", {
      startDate: new Date(2026, 1, 1),
      endDate: null,
      requestedQuantity: 0,
      deposit: { amount: 3000, currency: "EUR" },
      price: { amount: 4000, currency: "EUR" },
      depositReturned: { amount: 1000, currency: "EUR" },
      status: "rental_confirmed",
      proposalValidUntil: null,
    });
    await repository.updateRentStatus("rent-1", {
      status: "cancelled",
      proposalValidUntil: new Date(2026, 1, 3),
    });
    await repository.createRentMessage("rent-1", {
      content: "Mensaje",
    });
    await repository.markRentMessagesAsRead("rent-1");

    expect(apiClient.post).toHaveBeenNthCalledWith(
      1,
      "/api/rents",
      {
        rent_id: "rent-1",
        product_id: "product-1",
        start_date: "2026-01-10",
        end_date: "2026-01-12",
        requested_quantity: 1,
        deposit: { amount: 1000, currency: "EUR" },
        price: { amount: 2000, currency: "EUR" },
        renter_email: "renter@appquilar.test",
        renter_name: "Renter",
        is_lead: true,
      },
      {
        headers: {
          Authorization: "Bearer jwt-token",
        },
        skipParseJson: true,
      }
    );
    expect(apiClient.patch).toHaveBeenNthCalledWith(
      1,
      "/api/rents/rent-1",
      {
        start_date: "2026-02-01",
        end_date: null,
        requested_quantity: 1,
        deposit: { amount: 3000, currency: "EUR" },
        price: { amount: 4000, currency: "EUR" },
        deposit_returned: { amount: 1000, currency: "EUR" },
        status: "rental_confirmed",
        proposal_valid_until: null,
      },
      {
        headers: {
          Authorization: "Bearer jwt-token",
        },
        skipParseJson: true,
      }
    );
    expect(apiClient.patch).toHaveBeenNthCalledWith(
      2,
      "/api/rents/rent-1/status",
      {
        rent_status: "cancelled",
        proposal_valid_until: "2026-02-03",
      },
      {
        headers: {
          Authorization: "Bearer jwt-token",
        },
        skipParseJson: true,
      }
    );
    expect(apiClient.post).toHaveBeenNthCalledWith(
      2,
      "/api/rents/rent-1/messages",
      {
        content: "Mensaje",
      },
      {
        headers: {
          Authorization: "Bearer jwt-token",
        },
        skipParseJson: true,
      }
    );
    expect(apiClient.post).toHaveBeenNthCalledWith(
      3,
      "/api/rents/rent-1/messages/read",
      undefined,
      {
        headers: {
          Authorization: "Bearer jwt-token",
        },
        skipParseJson: true,
      }
    );
  });
});
