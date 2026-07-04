import { useParams } from 'react-router-dom';
import { useRentalDetails } from '@/application/hooks/useRentalDetails';
import RentalDetailsHeader from '@/components/dashboard/rentals/details/RentalDetailsHeader';
import RentalDetailsCard from '@/components/dashboard/rentals/details/RentalDetailsCard';
import CustomerInfoCard from '@/components/dashboard/rentals/details/CustomerInfoCard';
import RentalEditableCard from '@/components/dashboard/rentals/details/RentalEditableCard';
import RentalStateWizard from '@/components/dashboard/rentals/details/RentalStateWizard';
import RentalInventoryStatusCard from '@/components/dashboard/rentals/details/RentalInventoryStatusCard';
import RentalMessagesCard from '@/components/dashboard/rentals/details/RentalMessagesCard';
import RentalDepositResolutionCard from '@/components/dashboard/rentals/details/RentalDepositResolutionCard';
import LoadingSpinner from '@/components/dashboard/rentals/details/LoadingSpinner';
import ErrorDisplay from '@/components/dashboard/rentals/details/ErrorDisplay';
import { useEffect } from 'react';

const RentalDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { 
    rental, 
    isLoading, 
    error, 
    isUpdatingStatus,
    isUpdatingRental,
    isResolvingDeposit,
    canEditRental,
    canResolveDeposit,
    viewerRole,
    nextTransitions,
    handleStatusChange,
    handleRentalUpdate,
    handleDepositResolution,
    calculateDurationDays,
    formatDate
  } = useRentalDetails(id);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    const mainContainer = document.querySelector('main');
    if (mainContainer) {
      mainContainer.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [id]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error || !rental) {
    return <ErrorDisplay errorMessage={error} />;
  }

  const durationDays = calculateDurationDays();
  const formattedStartDate = formatDate(rental.startDate);
  const formattedEndDate = formatDate(rental.endDate);

  return (
    <div className="space-y-4 pb-2 pt-2 md:space-y-6 md:pb-3 md:pt-3">
      <RentalDetailsHeader rental={rental} />

      <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.95fr)] xl:items-start">
        <div className="contents xl:block xl:space-y-6">
          <div className="order-1">
            <RentalStateWizard
              rental={rental}
              viewerRole={viewerRole}
              transitions={nextTransitions}
              isUpdatingStatus={isUpdatingStatus}
              onTransition={handleStatusChange}
            />
          </div>

          <div className={canEditRental ? 'order-4' : 'order-3'}>
            <RentalMessagesCard rentId={rental.id} />
          </div>
        </div>

        <div className="contents xl:block xl:space-y-6">
          <div className="order-2">
            <RentalDetailsCard 
              rental={rental}
              viewerRole={viewerRole}
              durationDays={durationDays}
              formattedStartDate={formattedStartDate}
              formattedEndDate={formattedEndDate}
            />
          </div>

          {canResolveDeposit && (
            <div className="order-3">
              <RentalDepositResolutionCard
                rental={rental}
                isSaving={isResolvingDeposit}
                onResolve={handleDepositResolution}
              />
            </div>
          )}

          <div className="order-4">
            <RentalInventoryStatusCard rental={rental} viewerRole={viewerRole} />
          </div>

          {canEditRental && (
            <div className="order-5">
              <RentalEditableCard
                rental={rental}
                viewerRole={viewerRole}
                isSaving={isUpdatingRental}
                onSave={handleRentalUpdate}
              />
            </div>
          )}

          <div className={canEditRental ? 'order-6' : 'order-5'}>
            <CustomerInfoCard rental={rental} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RentalDetails;
