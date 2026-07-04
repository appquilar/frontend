import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rentalService } from '@/compositionRoot';
import { Rental, RentStatus } from '@/domain/models/Rental';
import { Money } from '@/domain/models/Money';
import { RentalStatusService } from '@/domain/services/RentalStatusService';
import { RentalStateMachineService, RentActorRole, RentTransitionOption } from '@/domain/services/RentalStateMachineService';
import { getUserCompanyId, isPlatformAdminUser } from '@/domain/models/User';
import { toast } from '@/components/ui/use-toast';
import { useCurrentUser } from './useCurrentUser';
import { ApiError } from '@/infrastructure/http/ApiClient';

interface UseRentalDetailsReturn {
  rental: Rental | null;
  isLoading: boolean;
  error: string | null;
  isUpdatingStatus: boolean;
  isUpdatingRental: boolean;
  isResolvingDeposit: boolean;
  canEditRental: boolean;
  canResolveDeposit: boolean;
  viewerRole: RentActorRole;
  nextTransitions: RentTransitionOption[];
  handleStatusChange: (input: { status: RentStatus; proposalValidUntil?: Date | null }) => Promise<void>;
  handleRentalUpdate: (data: {
    startDate: Date;
    endDate: Date;
    requestedQuantity: number;
    deposit?: Money;
    price?: Money;
  }) => Promise<void>;
  handleDepositResolution: (depositReturned: Money) => Promise<void>;
  calculateDurationDays: () => number;
  formatDate: (date: Date) => string;
}

const isInventoryUnavailableError = (error: unknown): boolean =>
  error instanceof ApiError
  && error.status === 409
  && Array.isArray((error.payload as { error?: unknown[] } | undefined)?.error)
  && ((error.payload as { error?: unknown[] }).error ?? []).includes('product.inventory.unavailable');

export const useRentalDetails = (id: string | undefined): UseRentalDetailsReturn => {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  const rentalQuery = useQuery({
    queryKey: ['rent', id],
    queryFn: () => (id ? rentalService.getRentById(id) : null),
    enabled: Boolean(id),
  });

  const statusMutation = useMutation({
    mutationFn: async (input: { status: RentStatus; proposalValidUntil?: Date | null }) => {
      if (!id) return;
      await rentalService.updateRentStatus(id, {
        status: input.status,
        proposalValidUntil: input.proposalValidUntil ?? null,
      });
    },
    onSuccess: async (_, input) => {
      if (!id) return;
      await queryClient.invalidateQueries({ queryKey: ['rent', id] });
      await queryClient.invalidateQueries({ queryKey: ['rents'] });
      await queryClient.invalidateQueries({ queryKey: ['rentUnreadMessages'] });
      await queryClient.invalidateQueries({ queryKey: ['rentConversations'] });
      if (rentalQuery.data?.productId) {
        await queryClient.invalidateQueries({ queryKey: ['productInventory', rentalQuery.data.productId] });
        await queryClient.invalidateQueries({ queryKey: ['productInventory', rentalQuery.data.productId, 'allocations'] });
        await queryClient.invalidateQueries({ queryKey: ['productInventory', rentalQuery.data.productId, 'units'] });
      }

      toast({
        title: 'Accion aplicada',
        description: `Se proceso la accion sobre ${RentalStatusService.getStatusLabel(input.status)}.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: isInventoryUnavailableError(error)
          ? 'No hay stock disponible para confirmar o activar este alquiler.'
          : 'No se pudo actualizar el estado del alquiler',
        variant: 'destructive',
      });
    },
  });

  const updateRentalMutation = useMutation({
    mutationFn: async (data: {
      startDate: Date;
      endDate: Date;
      requestedQuantity: number;
      deposit?: Money;
      price?: Money;
    }) => {
      if (!id) return;
      await rentalService.updateRent(id, {
        startDate: data.startDate,
        endDate: data.endDate,
        requestedQuantity: data.requestedQuantity,
        deposit: data.deposit,
        price: data.price,
      });
    },
    onSuccess: async () => {
      if (!id) return;
      await queryClient.invalidateQueries({ queryKey: ['rent', id] });
      await queryClient.invalidateQueries({ queryKey: ['rents'] });
      if (rentalQuery.data?.productId) {
        await queryClient.invalidateQueries({ queryKey: ['productInventory', rentalQuery.data.productId] });
        await queryClient.invalidateQueries({ queryKey: ['productInventory', rentalQuery.data.productId, 'allocations'] });
        await queryClient.invalidateQueries({ queryKey: ['productInventory', rentalQuery.data.productId, 'units'] });
      }

      toast({
        title: 'Alquiler actualizado',
        description: 'Se guardaron fechas y precios correctamente.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el alquiler',
        variant: 'destructive',
      });
    },
  });

  const depositResolutionMutation = useMutation({
    mutationFn: async (depositReturned: Money) => {
      if (!id) return;
      await rentalService.updateRent(id, {
        depositReturned,
      });
    },
    onSuccess: async () => {
      if (!id) return;
      await queryClient.invalidateQueries({ queryKey: ['rent', id] });
      await queryClient.invalidateQueries({ queryKey: ['rents'] });

      toast({
        title: 'Fianza actualizada',
        description: 'Se ha registrado la resolución de la fianza.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la fianza',
        variant: 'destructive',
      });
    },
  });

  const canEditRental = Boolean(
    rentalQuery.data &&
      user &&
      rentalQuery.data.status === 'lead_pending' &&
      (
        (rentalQuery.data.ownerType === 'company' && getUserCompanyId(user) === rentalQuery.data.ownerId) ||
        (rentalQuery.data.ownerType === 'user' && user.id === rentalQuery.data.ownerId)
      )
  );

  const viewerRole: RentActorRole = (() => {
    const rental = rentalQuery.data;
    if (!rental || !user) {
      return 'viewer';
    }

    if (isPlatformAdminUser(user)) {
      return 'admin';
    }

    const companyId = getUserCompanyId(user);
    const isOwner =
      (rental.ownerType === 'company' && companyId === rental.ownerId) ||
      (rental.ownerType === 'user' && user.id === rental.ownerId);

    if (isOwner) {
      return 'owner';
    }

    if (rental.renterId === user.id) {
      return 'renter';
    }

    return 'viewer';
  })();

  const nextTransitions = rentalQuery.data
    ? RentalStateMachineService.getNextTransitions(rentalQuery.data, viewerRole)
    : [];
  const canResolveDeposit = Boolean(
    rentalQuery.data &&
      rentalQuery.data.status === 'rental_completed' &&
      rentalQuery.data.deposit.amount > 0 &&
      (viewerRole === 'owner' || viewerRole === 'admin')
  );

  const calculateDurationDays = (): number => {
    if (!rentalQuery.data) return 0;
    const start = rentalQuery.data.startDate;
    const end = rentalQuery.data.endDate;
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  return {
    rental: rentalQuery.data ?? null,
    isLoading: rentalQuery.isLoading,
    error: rentalQuery.error ? 'Error al cargar la información del alquiler' : null,
    isUpdatingStatus: statusMutation.isPending,
    isUpdatingRental: updateRentalMutation.isPending,
    isResolvingDeposit: depositResolutionMutation.isPending,
    canEditRental,
    canResolveDeposit,
    viewerRole,
    nextTransitions,
    handleStatusChange: async (input) => {
      await statusMutation.mutateAsync(input);
    },
    handleRentalUpdate: async (data) => {
      await updateRentalMutation.mutateAsync(data);
    },
    handleDepositResolution: async (depositReturned) => {
      await depositResolutionMutation.mutateAsync(depositReturned);
    },
    calculateDurationDays,
    formatDate,
  };
};
