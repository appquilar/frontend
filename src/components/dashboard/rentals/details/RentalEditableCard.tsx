import { type ReactNode, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Rental } from '@/domain/models/Rental';
import { useCalculateRentalCost } from '@/application/hooks/useProducts';
import { toast } from '@/components/ui/use-toast';
import { Money } from '@/domain/models/Money';
import { RentActorRole } from '@/domain/services/RentalStateMachineService';

const normalizeDecimalInput = (value: string) => value.replace(',', '.').trim();

const requiredNonNegativeAmountSchema = (requiredMessage: string, invalidMessage: string) =>
  z.union([z.string(), z.number()]).transform((value, ctx) => {
    if (typeof value === 'number') {
      if (Number.isFinite(value) && value >= 0) {
        return value;
      }

      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: invalidMessage,
      });

      return z.NEVER;
    }

    const normalized = normalizeDecimalInput(value);

    if (normalized === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: requiredMessage,
      });

      return z.NEVER;
    }

    const parsedValue = Number(normalized);

    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: invalidMessage,
      });

      return z.NEVER;
    }

    return parsedValue;
  });

const rentalEditSchema = z.object({
  startDate: z.string().min(1, 'Fecha de inicio obligatoria'),
  endDate: z.string().min(1, 'Fecha de fin obligatoria'),
  requestedQuantity: z.coerce.number().int().min(1, 'La cantidad debe ser al menos 1'),
  priceAmount: requiredNonNegativeAmountSchema('El precio es obligatorio', 'El precio no puede ser negativo'),
  depositAmount: requiredNonNegativeAmountSchema('La fianza es obligatoria', 'La fianza no puede ser negativa'),
}).refine((data) => data.endDate >= data.startDate, {
  message: 'La fecha de fin debe ser igual o posterior a la de inicio',
  path: ['endDate'],
});

type RentalEditValues = z.input<typeof rentalEditSchema>;
type RentalEditSubmitValues = z.output<typeof rentalEditSchema>;

interface RentalEditableCardProps {
  rental: Rental;
  viewerRole: RentActorRole;
  isSaving: boolean;
  embedded?: boolean;
  submitLabel?: string;
  extraFields?: ReactNode;
  extraActions?: ReactNode;
  onSave: (data: {
    startDate: Date;
    endDate: Date;
    requestedQuantity: number;
    deposit?: Money;
    price?: Money;
  }) => Promise<void>;
  onSaved?: () => Promise<void>;
}

const toDateInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const fromDateInput = (dateText: string, endOfDay: boolean): Date => {
  const [year, month, day] = dateText.split('-').map((value) => Number(value));
  return endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59)
    : new Date(year, month - 1, day, 0, 0, 0);
};

const toCents = (value: number): number => Math.round((Number.isFinite(value) ? value : 0) * 100);

const RentalEditableCard = ({
  rental,
  viewerRole,
  isSaving,
  embedded = false,
  submitLabel = 'Guardar cambios',
  extraFields,
  extraActions,
  onSave,
  onSaved,
}: RentalEditableCardProps) => {
  const canEditPrice = viewerRole === 'owner' || viewerRole === 'admin';
  const twoColumnGridClassName = embedded
    ? 'grid grid-cols-1 gap-3 sm:grid-cols-2'
    : 'grid grid-cols-1 md:grid-cols-2 gap-3';
  const actionClassName = embedded
    ? extraActions
      ? 'grid gap-2 sm:grid-cols-3'
      : 'grid gap-2 sm:grid-cols-2'
    : 'flex flex-col sm:flex-row gap-2';
  const form = useForm<RentalEditValues, undefined, RentalEditSubmitValues>({
    resolver: zodResolver(rentalEditSchema),
    defaultValues: {
      startDate: toDateInput(rental.startDate),
      endDate: toDateInput(rental.endDate),
      requestedQuantity: rental.requestedQuantity,
      priceAmount: rental.price.amount / 100,
      depositAmount: rental.deposit.amount / 100,
    },
  });

  const { mutateAsync: calculateRentalCost, isPending: isCalculating } = useCalculateRentalCost();

  useEffect(() => {
    form.reset({
      startDate: toDateInput(rental.startDate),
      endDate: toDateInput(rental.endDate),
      requestedQuantity: rental.requestedQuantity,
      priceAmount: rental.price.amount / 100,
      depositAmount: rental.deposit.amount / 100,
    });
  }, [rental, form]);

  const handleRecalculate = async () => {
    const values = form.getValues();
    if (!values.startDate || !values.endDate) {
      return;
    }

    try {
      const result = await calculateRentalCost({
        productId: rental.productId,
        startDate: values.startDate,
        endDate: values.endDate,
        quantity: values.requestedQuantity,
      });

      form.setValue('priceAmount', result.rentalPrice.amount / 100, { shouldValidate: true });
      form.setValue('depositAmount', result.deposit.amount / 100, { shouldValidate: true });
    } catch (_error) {
      toast({
        title: 'No se pudo recalcular',
        description: 'Revisa las fechas seleccionadas.',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (values: RentalEditSubmitValues) => {
    const payload: {
      startDate: Date;
      endDate: Date;
      requestedQuantity: number;
      deposit?: Money;
      price?: Money;
    } = {
      startDate: fromDateInput(values.startDate, false),
      endDate: fromDateInput(values.endDate, true),
      requestedQuantity: values.requestedQuantity,
    };

    if (canEditPrice) {
      payload.deposit = {
        amount: toCents(values.depositAmount),
        currency: rental.deposit.currency,
      };
      payload.price = {
        amount: toCents(values.priceAmount),
        currency: rental.price.currency,
      };
    }

    await onSave({ ...payload });
    await onSaved?.();
  };

  const editForm = (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
      <div className={twoColumnGridClassName}>
        <div className="space-y-1">
          <Label htmlFor="edit-start-date">Fecha de inicio</Label>
          <Input id="edit-start-date" type="date" lang="es-ES" {...form.register('startDate')} />
          {form.formState.errors.startDate?.message && (
            <p className="text-sm text-destructive">{form.formState.errors.startDate.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="edit-end-date">Fecha de fin</Label>
          <Input id="edit-end-date" type="date" lang="es-ES" {...form.register('endDate')} />
          {form.formState.errors.endDate?.message && (
            <p className="text-sm text-destructive">{form.formState.errors.endDate.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="edit-requested-quantity">Cantidad solicitada</Label>
        <Input
          id="edit-requested-quantity"
          type="number"
          min={1}
          step={1}
          {...form.register('requestedQuantity')}
        />
        {form.formState.errors.requestedQuantity?.message && (
          <p className="text-sm text-destructive">{form.formState.errors.requestedQuantity.message}</p>
        )}
      </div>

      <div className={twoColumnGridClassName}>
        <div className="space-y-1">
          <Label htmlFor="edit-price">Precio ({rental.price.currency})</Label>
          <Input
            id="edit-price"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            disabled={!canEditPrice}
            {...form.register('priceAmount')}
          />
          {form.formState.errors.priceAmount?.message && (
            <p className="text-sm text-destructive">{form.formState.errors.priceAmount.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="edit-deposit">Fianza ({rental.deposit.currency})</Label>
          <Input
            id="edit-deposit"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            disabled={!canEditPrice}
            {...form.register('depositAmount')}
          />
          {form.formState.errors.depositAmount?.message && (
            <p className="text-sm text-destructive">{form.formState.errors.depositAmount.message}</p>
          )}
        </div>
      </div>

      {extraFields && (
        <div className={twoColumnGridClassName}>
          {extraFields}
        </div>
      )}

      <div className={actionClassName}>
        <Button
          type="button"
          variant="outline"
          onClick={handleRecalculate}
          disabled={isCalculating || isSaving || !canEditPrice}
        >
          {isCalculating ? 'Calculando...' : 'Recalcular desde producto'}
        </Button>
        <Button type="submit" disabled={isSaving || isCalculating}>
          {isSaving ? 'Guardando...' : submitLabel}
        </Button>
        {extraActions}
      </div>
    </form>
  );

  if (embedded) {
    return (
      <section className="space-y-4 border-t pt-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Editar condiciones</h3>
          <p className="text-sm text-muted-foreground">
            Ajusta fechas, cantidad y precios desde esta misma vista.
          </p>
        </div>
        {editForm}
      </section>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-2 p-5 pb-4 sm:p-6 sm:pb-4">
        <CardTitle className="text-lg font-semibold">Editar condiciones</CardTitle>
        <CardDescription>
          Ajusta fechas, cantidad y precios desde esta misma vista.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 px-5 pb-5 pt-0 sm:px-6 sm:pb-6">
        {editForm}
      </CardContent>
    </Card>
  );
};

export default RentalEditableCard;
