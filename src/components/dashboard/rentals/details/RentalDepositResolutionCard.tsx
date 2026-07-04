import { useEffect, useState, type FormEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Rental } from '@/domain/models/Rental';
import { Money } from '@/domain/models/Money';
import { toast } from '@/components/ui/use-toast';

interface RentalDepositResolutionCardProps {
  rental: Rental;
  isSaving: boolean;
  onResolve: (depositReturned: Money) => Promise<void>;
}

const formatMoneyFromCents = (amount: number, currency: string): string => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
  }).format(amount / 100);
};

const toAmountInput = (amount: number): string => {
  return String(amount / 100);
};

const parseAmountToCents = (value: string): number | null => {
  const parsed = Number(value.replace(',', '.').trim());
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed * 100);
};

const getResolutionLabel = (rental: Rental): string => {
  const returnedAmount = rental.depositReturned?.amount ?? 0;

  if (returnedAmount <= 0) {
    return 'Pendiente';
  }

  if (returnedAmount >= rental.deposit.amount) {
    return 'Devuelta completa';
  }

  return 'Retención parcial';
};

const RentalDepositResolutionCard = ({
  rental,
  isSaving,
  onResolve,
}: RentalDepositResolutionCardProps) => {
  const [amount, setAmount] = useState(() =>
    toAmountInput(rental.depositReturned?.amount ?? rental.deposit.amount)
  );
  const maxAmount = rental.deposit.amount / 100;
  const returnedAmount = rental.depositReturned?.amount ?? 0;

  useEffect(() => {
    setAmount(toAmountInput(rental.depositReturned?.amount ?? rental.deposit.amount));
  }, [rental.deposit.amount, rental.depositReturned?.amount]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amountInCents = parseAmountToCents(amount);

    if (amountInCents === null) {
      toast({
        title: 'Importe inválido',
        description: 'Introduce un importe devuelto válido.',
        variant: 'destructive',
      });
      return;
    }

    if (amountInCents > rental.deposit.amount) {
      toast({
        title: 'Importe inválido',
        description: 'La fianza devuelta no puede superar la fianza acordada.',
        variant: 'destructive',
      });
      return;
    }

    await onResolve({
      amount: amountInCents,
      currency: rental.deposit.currency,
    });
  };

  return (
    <Card>
      <CardHeader className="space-y-2 p-5 pb-4 sm:p-6 sm:pb-4">
        <CardTitle className="text-lg font-semibold">Resolver fianza</CardTitle>
        <CardDescription>
          Registra el importe devuelto. Un importe inferior a la fianza implica retención parcial.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 px-5 pb-5 pt-0 sm:px-6 sm:pb-6">
        <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
          <p>
            Estado actual: <span className="font-medium text-foreground">{getResolutionLabel(rental)}</span>
          </p>
          <p>
            Fianza acordada: <span className="font-medium text-foreground">{formatMoneyFromCents(rental.deposit.amount, rental.deposit.currency)}</span>
          </p>
          <p>
            Devuelto registrado: <span className="font-medium text-foreground">{formatMoneyFromCents(returnedAmount, rental.deposit.currency)}</span>
          </p>
        </div>

        <p className="text-sm text-muted-foreground">
          Appquilar coordina el alquiler; pago y fianza se acuerdan directamente entre proveedor y cliente fuera de la plataforma.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="deposit-returned">Importe devuelto ({rental.deposit.currency})</Label>
            <Input
              id="deposit-returned"
              type="number"
              inputMode="decimal"
              min={0}
              max={maxAmount}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>

          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Guardando...' : 'Guardar resolución'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default RentalDepositResolutionCard;
