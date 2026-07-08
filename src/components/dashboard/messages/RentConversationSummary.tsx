import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RentConversation } from '@/domain/models/RentConversation';
import { RentalStateMachineService } from '@/domain/services/RentalStateMachineService';
import { RentalStatusService } from '@/domain/services/RentalStatusService';
import { buildProductPath } from '@/domain/config/publicRoutes';
import { useIsMobile } from '@/hooks/use-mobile';

interface RentConversationSummaryProps {
  conversation: RentConversation;
  onBackToConversation?: () => void;
}

const formatMoney = (amount: number, currency: string): string => {
  const value = amount / 100;
  return `${value.toFixed(2)} ${currency}`;
};

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const RentConversationSummary = ({
  conversation,
  onBackToConversation,
}: RentConversationSummaryProps) => {
  const isMobile = useIsMobile();
  const rental = conversation.rental;
  const isPublicProductAvailable = rental.productPublicationStatus === 'published' && Boolean(rental.productSlug);
  const publicProductHref = isPublicProductAvailable ? buildProductPath(rental.productSlug as string) : null;
  const estimatedTotal = rental.price.amount + rental.deposit.amount;
  const ownerName = rental.ownerName ?? 'Sin nombre';
  const ownerAddress = rental.ownerLocation?.label ?? 'Dirección no disponible';
  const nextStepInfo = RentalStateMachineService.getNextStepInfo(rental);
  const actionRequiredLabel =
    nextStepInfo.actionRequiredBy === 'owner'
      ? 'Tienda'
      : nextStepInfo.actionRequiredBy === 'renter'
      ? 'Cliente'
      : 'Sin acción pendiente';

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base">Resumen del alquiler</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 space-y-3 overflow-y-auto text-sm">
        {isMobile && onBackToConversation && (
          <div>
            <Button
              type="button"
              variant="default"
              className="w-full"
              onClick={onBackToConversation}
            >
              Volver a la conversación
            </Button>
          </div>
        )}

        <div>
          <p className="text-muted-foreground">Producto</p>
          <p className="font-medium">{conversation.productName}</p>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <div className="rounded-md border border-border bg-background px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Inicio</p>
            <p className="font-semibold text-foreground">{formatDate(rental.startDate)}</p>
          </div>
          <div className="rounded-md border border-border bg-background px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Fin</p>
            <p className="font-semibold text-foreground">{formatDate(rental.endDate)}</p>
          </div>
        </div>

        <div>
          <p className="text-muted-foreground">Estado</p>
          <Badge className={RentalStatusService.getStatusBadgeClasses(rental.status)}>
            {RentalStatusService.getStatusLabelForRole(rental.status, conversation.role)}
          </Badge>
        </div>

        <div className="rounded-md border border-border bg-background px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Siguiente paso</p>
          <p className="mt-1 font-semibold text-foreground">{nextStepInfo.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{nextStepInfo.description}</p>
          <p className="mt-2 text-xs text-muted-foreground">Pendiente de: {actionRequiredLabel}</p>
        </div>

        <div>
          <p className="text-muted-foreground mb-1">Precio (desglosado)</p>
          <div className="rounded-md border border-border bg-background">
            <div className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="text-muted-foreground">Alquiler</span>
              <span className="font-medium">{formatMoney(rental.price.amount, rental.price.currency)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-border px-3 py-2 text-sm">
              <span className="text-muted-foreground">Fianza</span>
              <span className="font-medium">{formatMoney(rental.deposit.amount, rental.deposit.currency)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-border px-3 py-2 text-sm">
              <span className="font-semibold">Total estimado</span>
              <span className="font-semibold">{formatMoney(estimatedTotal, rental.price.currency)}</span>
            </div>
          </div>
        </div>

        <div>
          <p className="text-muted-foreground">Propietario</p>
          <p className="font-medium">{ownerName}</p>
          <p className="text-sm text-muted-foreground">{ownerAddress}</p>
        </div>

        <div className="space-y-2 pt-1">
          <Button asChild className="w-full">
            <Link to={`/dashboard/rentals/${conversation.rentId}`}>
              Abrir deal room
            </Link>
          </Button>

          {conversation.role === 'renter' && publicProductHref && (
            <Button asChild variant="outline" className="w-full">
              <a href={publicProductHref} target="_blank" rel="noopener noreferrer">
                Ver producto público
              </a>
            </Button>
          )}
          {conversation.role === 'renter' && !publicProductHref && (
            <p className="text-sm text-muted-foreground">
              El producto ya no está publicado.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RentConversationSummary;
