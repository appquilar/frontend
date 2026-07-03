import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateLead } from '@/application/hooks/useRentals';
import { useCalculateRentalCost } from '@/application/hooks/useProducts';
import { useProductAvailability } from '@/application/hooks/useProductInventory';
import { RentalCostBreakdown } from '@/domain/repositories/ProductRepository';
import { useEffect, useState } from 'react';
import SpanishDateRangePicker from './SpanishDateRangePicker';
import { Input } from '@/components/ui/input';

const messageSchema = z.object({
  message: z.string()
    .trim()
    .min(10, { message: 'El mensaje debe tener al menos 10 caracteres' })
    .max(1000, { message: 'El mensaje no puede exceder 1000 caracteres' }),
  startDate: z.string().min(1, { message: 'La fecha de inicio es obligatoria' }),
  endDate: z.string().min(1, { message: 'La fecha de fin es obligatoria' }),
  requestedQuantity: z.coerce.number().int().min(1, { message: 'La cantidad debe ser al menos 1' }).default(1),
}).refine((value) => value.endDate > value.startDate, {
  message: 'La fecha de fin debe ser posterior a la de inicio',
  path: ['endDate'],
});
type ContactFormValues = z.infer<typeof messageSchema>;

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  ownerName: string;
  initialStartDate?: string;
  initialEndDate?: string;
  initialRequestedQuantity?: number;
  initialCalculation?: RentalCostBreakdown | null;
}

const formatMoneyFromCents = (amount: number, currency: string): string => {
  const value = Number(amount || 0) / 100;
  return `${value.toFixed(2)} ${currency}`;
};

const ContactModal = ({
  isOpen,
  onClose,
  productId,
  productName,
  ownerName,
  initialStartDate,
  initialEndDate,
  initialRequestedQuantity,
  initialCalculation,
}: ContactModalProps) => {
  const createLeadMutation = useCreateLead();
  const { mutateAsync: calculateRentalCost, isPending: isCalculating } = useCalculateRentalCost();
  const [calculation, setCalculation] = useState<RentalCostBreakdown | null>(initialCalculation ?? null);
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(messageSchema),
    defaultValues: {
      message: '',
      startDate: initialStartDate ?? '',
      endDate: initialEndDate ?? '',
      requestedQuantity: initialRequestedQuantity ?? 1,
    },
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (initialStartDate) {
      form.setValue('startDate', initialStartDate);
    }
    if (initialEndDate) {
      form.setValue('endDate', initialEndDate);
    }
    if (initialCalculation) {
      setCalculation(initialCalculation);
    }
    if (initialRequestedQuantity) {
      form.setValue('requestedQuantity', initialRequestedQuantity);
    }
  }, [isOpen, initialStartDate, initialEndDate, initialCalculation, initialRequestedQuantity, form]);

  const requestedQuantity = form.watch('requestedQuantity') || 1;
  const watchedStartDate = form.watch('startDate') || '';
  const watchedEndDate = form.watch('endDate') || '';
  const hasValidDateRange = watchedStartDate.length > 0 && watchedEndDate.length > 0 && watchedEndDate > watchedStartDate;
  const availabilityQuery = useProductAvailability(
    productId,
    watchedStartDate || null,
    watchedEndDate || null,
    requestedQuantity,
    isOpen && hasValidDateRange
  );

  const ensureCalculation = async (startDate: string, endDate: string, quantity: number): Promise<RentalCostBreakdown> => {
    const current = calculation;
    if (current && current.startDate === startDate && current.endDate === endDate && current.requestedQuantity === quantity) {
      return current;
    }

    const computed = await calculateRentalCost({
      productId,
      startDate,
      endDate,
      quantity,
    });

    setCalculation(computed);
    return computed;
  };

  const handleCalculate = async () => {
    const values = form.getValues();
    if (!values.startDate || !values.endDate) {
      form.trigger(['startDate', 'endDate']);
      return;
    }

    try {
      await ensureCalculation(values.startDate, values.endDate, values.requestedQuantity);
    } catch (_error) {
      toast.error('No se pudo calcular el precio');
    }
  };

  const handleSubmit = async (data: ContactFormValues) => {
    form.clearErrors('root');

    try {
      if (availabilityQuery.data && !availabilityQuery.data.canRequest) {
        form.setError('root.server', {
          type: 'server',
          message: availabilityQuery.data.message,
        });
        return;
      }

      const computed = await ensureCalculation(data.startDate, data.endDate, data.requestedQuantity);

      const rentId = await createLeadMutation.mutateAsync({
        productId,
        startDate: data.startDate,
        endDate: data.endDate,
        requestedQuantity: data.requestedQuantity,
        deposit: computed.deposit,
        price: computed.rentalPrice,
        message: data.message,
      });

      toast.success('Solicitud enviada', {
        description: `${ownerName} recibirá tu solicitud pronto`,
        action: {
          label: 'Ver alquiler',
          onClick: () => {
            window.location.assign(`/dashboard/rentals/${rentId}`);
          },
        },
      });

      form.reset({
        message: '',
        startDate: data.startDate,
        endDate: data.endDate,
        requestedQuantity: data.requestedQuantity,
      });
      onClose();
    } catch (error) {
      form.setError('root.server', {
        type: 'server',
        message: 'No se pudo enviar el mensaje. Revisa las fechas y vuelve a intentarlo.',
      });
      toast.error('Error al enviar la solicitud');
    }
  };

  const message = form.watch('message') || '';
  const startDate = watchedStartDate;
  const endDate = watchedEndDate;
  const dateRangeError = form.formState.errors.startDate?.message || form.formState.errors.endDate?.message;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-[500px]">
        <DialogHeader className="shrink-0">
          <DialogTitle>Contactar para alquilar</DialogTitle>
          <DialogDescription>
            Envía un mensaje a {ownerName} sobre "{productName}". Esto creará un lead en tu panel.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="mt-4 space-y-4 overflow-y-auto pr-1">
          {form.formState.errors.root?.server?.message && (
            <p className="text-sm text-destructive">{form.formState.errors.root.server.message}</p>
          )}

          <div className="space-y-1">
            <Label htmlFor="lead-date-range">Fechas del alquiler</Label>
            <SpanishDateRangePicker
              id="lead-date-range"
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={(value) => {
                setCalculation(null);
                form.setValue('startDate', value, { shouldDirty: true, shouldValidate: true });
              }}
              onEndDateChange={(value) => {
                setCalculation(null);
                form.setValue('endDate', value, { shouldDirty: true, shouldValidate: true });
              }}
              invalid={Boolean(dateRangeError)}
            />
            {dateRangeError && (
              <p className="text-sm text-destructive">{dateRangeError}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="lead-requested-quantity">Cantidad</Label>
            <Input
              id="lead-requested-quantity"
              type="number"
              min={1}
              step={1}
              {...form.register('requestedQuantity')}
            />
            {form.formState.errors.requestedQuantity?.message && (
              <p className="text-sm text-destructive">{form.formState.errors.requestedQuantity.message}</p>
            )}
          </div>

          {availabilityQuery.data && (
            <div className={`rounded-md border p-3 text-sm ${
              availabilityQuery.data.canRequest
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : availabilityQuery.data.managedByPlatform
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-slate-200 bg-slate-50 text-slate-700'
            }`}>
              {availabilityQuery.data.message}
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={handleCalculate}
            disabled={createLeadMutation.isPending || isCalculating}
          >
            {isCalculating ? 'Calculando...' : 'Calcular precio'}
          </Button>

          {calculation && (
            <div className="rounded-md border bg-muted/20 p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Días</span>
                <span className="font-medium">{calculation.days}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Precio por día</span>
                <span className="font-medium">
                  {formatMoneyFromCents(calculation.pricePerDay.amount, calculation.pricePerDay.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal alquiler</span>
                <span className="font-medium">
                  {formatMoneyFromCents(calculation.rentalPrice.amount, calculation.rentalPrice.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fianza</span>
                <span className="font-medium">
                  {formatMoneyFromCents(calculation.deposit.amount, calculation.deposit.currency)}
                </span>
              </div>
              <div className="border-t pt-2 mt-2 flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-semibold">
                  {formatMoneyFromCents(calculation.totalPrice.amount, calculation.totalPrice.currency)}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="message">Mensaje</Label>
            <Textarea
              id="message"
              placeholder="Escribe tu mensaje aquí..."
              {...form.register('message')}
              rows={6}
              className={form.formState.errors.message ? 'border-destructive' : ''}
            />
            {form.formState.errors.message?.message && (
              <p className="text-sm text-destructive">{form.formState.errors.message.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {message.length}/1000 caracteres
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={createLeadMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createLeadMutation.isPending || isCalculating}
            >
              {createLeadMutation.isPending ? 'Enviando...' : 'Enviar mensaje'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ContactModal;
