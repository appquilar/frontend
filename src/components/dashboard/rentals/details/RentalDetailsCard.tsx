import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Hash, LucideIcon, Tag, Wallet } from 'lucide-react';
import { Rental } from '@/domain/models/Rental';
import { RentActorRole } from '@/domain/services/RentalStateMachineService';
import { Link } from 'react-router-dom';
import { buildProductPath } from '@/domain/config/publicRoutes';
import { cn } from '@/lib/utils';

interface RentalDetailsCardProps {
  rental: Rental;
  viewerRole: RentActorRole;
  durationDays: number;
  formattedStartDate: string;
  formattedEndDate: string;
}

const formatMoneyFromCents = (amount: number, currency: string): string => {
  const value = amount / 100;
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
  }).format(value);
};

const getDepositResolution = (rental: Rental): string => {
  if (rental.deposit.amount <= 0) {
    return 'Sin fianza';
  }

  if (!rental.depositReturned || rental.depositReturned.amount <= 0) {
    return 'Pendiente';
  }

  if (rental.depositReturned.amount >= rental.deposit.amount) {
    return 'Devuelta';
  }

  return `Devuelta parcialmente (${formatMoneyFromCents(rental.depositReturned.amount, rental.depositReturned.currency)})`;
};

const getDepositResolutionDetail = (rental: Rental): string => {
  if (rental.deposit.amount <= 0) {
    return 'No se ha requerido fianza para esta operacion.';
  }

  if (!rental.depositReturned || rental.depositReturned.amount <= 0) {
    return 'Todavia no se ha registrado la devolucion de la fianza.';
  }

  if (rental.depositReturned.amount >= rental.deposit.amount) {
    return 'La devolucion de la fianza ya se ha completado.';
  }

  return `Se han devuelto ${formatMoneyFromCents(rental.depositReturned.amount, rental.depositReturned.currency)} y queda una retencion parcial.`;
};

interface SummaryTileProps {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  className?: string;
}

const SummaryTile = ({ icon: Icon, label, value, hint, className }: SummaryTileProps) => (
  <div className={cn('rounded-2xl border bg-muted/30 px-4 py-4', className)}>
    <div className="flex items-start gap-3">
      <div className="rounded-full bg-background p-2 text-muted-foreground shadow-sm">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
        {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      </div>
    </div>
  </div>
);

const RentalDetailsCard = ({
  rental,
  viewerRole,
  durationDays,
  formattedStartDate,
  formattedEndDate
}: RentalDetailsCardProps) => {
  const publicProductHref = buildProductPath(rental.productSlug ?? rental.productId);
  const ownerEditProductHref = `/dashboard/products/${rental.productId}`;
  const canOwnerEditProduct = viewerRole === 'owner' || viewerRole === 'admin';
  const shouldShowRenterPublicButton = viewerRole === 'renter';
  const actionLinkLabel = canOwnerEditProduct ? 'Abrir producto' : 'Ver producto publico';
  const actionLinkHref = canOwnerEditProduct ? ownerEditProductHref : publicProductHref;
  const actionLinkIsExternal = !canOwnerEditProduct;
  const requestedQuantityLabel = `${rental.requestedQuantity} ${rental.requestedQuantity === 1 ? 'unidad' : 'unidades'}`;
  const summaryTypeLabel = rental.isLead ? 'Consulta / lead' : 'Reserva / alquiler';

  return (
    <Card>
      <CardHeader className="p-5 pb-4 sm:p-6 sm:pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardDescription className="text-sm font-medium">Resumen del alquiler</CardDescription>
            <CardTitle className="mt-2 text-xl font-semibold leading-tight sm:text-2xl">
              {canOwnerEditProduct ? (
                <Link to={ownerEditProductHref} className="hover:underline">
                  {rental.productName || 'Producto sin nombre'}
                </Link>
              ) : (
                rental.productName || 'Producto sin nombre'
              )}
            </CardTitle>
            {rental.productInternalId && (
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1">
                  <Tag className="h-3 w-3 mr-1" />
                  Ref. {rental.productInternalId}
                </span>
              </p>
            )}
          </div>

          {(shouldShowRenterPublicButton || canOwnerEditProduct) && (
            <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
              {actionLinkIsExternal ? (
                <a href={actionLinkHref} target="_blank" rel="noopener noreferrer">
                  {actionLinkLabel}
                </a>
              ) : (
                <Link to={actionLinkHref}>
                  {actionLinkLabel}
                </Link>
              )}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-5 pb-5 pt-0 sm:px-6 sm:pb-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <SummaryTile
            icon={Calendar}
            label="Fechas"
            value={`${formattedStartDate} - ${formattedEndDate}`}
            hint="Periodo acordado para este alquiler."
            className="sm:col-span-2"
          />

          <SummaryTile
            icon={Clock}
            label="Duracion"
            value={`${durationDays} ${durationDays === 1 ? 'dia' : 'dias'}`}
          />

          <SummaryTile
            icon={Hash}
            label="Cantidad"
            value={requestedQuantityLabel}
          />

          <SummaryTile
            icon={Wallet}
            label="Precio"
            value={formatMoneyFromCents(rental.price.amount, rental.price.currency)}
          />

          <SummaryTile
            icon={Tag}
            label="Tipo de operacion"
            value={summaryTypeLabel}
          />

          <SummaryTile
            icon={Wallet}
            label="Fianza"
            value={formatMoneyFromCents(rental.deposit.amount, rental.deposit.currency)}
            hint={getDepositResolutionDetail(rental)}
          />

          <SummaryTile
            icon={Wallet}
            label="Estado de la fianza"
            value={getDepositResolution(rental)}
            hint={
              rental.depositReturned && rental.depositReturned.amount > 0
                ? `Devuelta: ${formatMoneyFromCents(rental.depositReturned.amount, rental.depositReturned.currency)}`
                : 'Sin devolucion registrada todavia.'
            }
          />
        </div>

        {!shouldShowRenterPublicButton && !canOwnerEditProduct && (
          <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
            <a href={publicProductHref} target="_blank" rel="noopener noreferrer">
              Ver producto publico
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default RentalDetailsCard;
