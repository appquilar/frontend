import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import { rentalService } from '@/compositionRoot';
import { RentListParams } from '@/domain/repositories/RentalRepository';
import { Money } from '@/domain/models/Money';
import { useCurrentUser } from '@/application/hooks/useCurrentUser';

interface UseRentalsOptions {
  enabled?: boolean;
}

interface UseRentSummaryParams {
  ownerId?: string | null;
  enabled?: boolean;
}

export const useRentals = (params: RentListParams = {}, options: UseRentalsOptions = {}) => {
  const enabled = options.enabled ?? true;

  const query = useQuery({
    queryKey: ['rents', params],
    queryFn: () => rentalService.listRents(params),
    enabled,
    placeholderData: (previousData) => previousData,
  });

  return {
    rentals: query.data?.data ?? [],
    total: query.data?.total ?? 0,
    page: query.data?.page ?? 1,
    perPage: query.data?.perPage ?? params.perPage ?? 0,
    isLoading: query.isLoading,
    error: query.error ? 'Error al cargar alquileres' : null,
  };
};

export const useRentSummary = ({
  ownerId,
  enabled = true,
}: UseRentSummaryParams = {}) => {
  return useQuery({
    queryKey: ['rents', 'summary', ownerId ?? null],
    queryFn: () => rentalService.getSummary(ownerId ?? undefined),
    enabled,
    placeholderData: (previousData) => previousData,
  });
};

interface UseOwnerRentalsCountParams {
  ownerId?: string | null;
}

export const useOwnerRentalsCount = ({
  ownerId,
}: UseOwnerRentalsCountParams) => {
  const rentSummaryQuery = useRentSummary({
    ownerId,
    enabled: Boolean(ownerId),
  });

  return {
    ...rentSummaryQuery,
    data: rentSummaryQuery.data?.owner.total ?? 0,
  };
};

export const useCreateLead = () => {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  const toDateAtTime = (value: string, endOfDay: boolean): Date => {
    const [year, month, day] = value.split('-').map((part) => Number(part));
    return endOfDay
      ? new Date(year, month - 1, day, 23, 59, 59)
      : new Date(year, month - 1, day, 0, 0, 0);
  };

  return useMutation({
    mutationFn: async ({
      productId,
      startDate,
      endDate,
      deposit,
      price,
      message,
      renterEmail,
      renterName,
      requestedQuantity,
    }: {
      productId: string;
      startDate: string;
      endDate: string;
      requestedQuantity: number;
      deposit: Money;
      price: Money;
      message: string;
      renterEmail?: string;
      renterName?: string;
    }) => {
      const rentId = uuidv4();
      const resolvedRenterEmail = (renterEmail ?? user?.email ?? '').trim();

      if (!resolvedRenterEmail) {
        throw new Error('renter_email_required');
      }

      await rentalService.createRent({
        rentId,
        productId,
        renterEmail: resolvedRenterEmail,
        renterName: renterName?.trim() || undefined,
        startDate: toDateAtTime(startDate, false),
        endDate: toDateAtTime(endDate, true),
        requestedQuantity,
        deposit,
        price,
        isLead: true,
      });

      const firstMessage = message.trim();
      if (firstMessage) {
        await rentalService.createRentMessage(rentId, { content: firstMessage });
      }

      return rentId;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['rents'] });
    },
  });
};
