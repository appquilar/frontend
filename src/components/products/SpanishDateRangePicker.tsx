import { useMemo, useState } from 'react';
import { format, isSameDay, parseISO, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { CalendarRange } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface SpanishDateRangePickerProps {
  id?: string;
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
}

const parseIsoDate = (value: string): Date | undefined => {
  if (!value) {
    return undefined;
  }

  const parsedDate = startOfDay(parseISO(value));
  return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
};

const formatDisplayDate = (value: string): string => {
  const parsedDate = parseIsoDate(value);
  return parsedDate ? format(parsedDate, 'dd/MM/yyyy') : 'Selecciona';
};

const toIsoDate = (date: Date): string => format(startOfDay(date), 'yyyy-MM-dd');

const SpanishDateRangePicker = ({
  id,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  disabled,
  invalid,
  className,
}: SpanishDateRangePickerProps) => {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const today = useMemo(() => startOfDay(new Date()), []);

  const selectedRange = useMemo<DateRange | undefined>(() => {
    const from = parseIsoDate(startDate);
    const to = parseIsoDate(endDate);

    if (!from && !to) {
      return undefined;
    }

    return {
      from,
      to,
    };
  }, [endDate, startDate]);

  const rangeLabel = useMemo(() => {
    if (startDate && endDate) {
      return `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`;
    }

    if (startDate) {
      return `${formatDisplayDate(startDate)} - Elige la devolución`;
    }

    return 'Elige primero la recogida';
  }, [endDate, startDate]);

  const handleSelect = (range: DateRange | undefined) => {
    if (!range?.from) {
      onStartDateChange('');
      onEndDateChange('');
      return;
    }

    onStartDateChange(toIsoDate(range.from));

    if (!range.to || isSameDay(range.from, range.to)) {
      onEndDateChange('');
      return;
    }

    onEndDateChange(toIsoDate(range.to));
    setIsCalendarOpen(false);
  };

  return (
    <Popover modal open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={invalid}
          aria-label="Seleccionar fechas de alquiler"
          className={cn(
            'h-auto w-full justify-between gap-4 px-4 py-3 text-left',
            invalid ? 'border-destructive focus-visible:ring-destructive/30' : undefined,
            className
          )}
        >
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <span className="block text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Inicio
              </span>
              <span className={cn(
                'block text-sm font-medium',
                startDate ? 'text-foreground' : 'text-muted-foreground'
              )}>
                {formatDisplayDate(startDate)}
              </span>
            </div>
            <div className="space-y-1">
              <span className="block text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Fin
              </span>
              <span className={cn(
                'block text-sm font-medium',
                endDate ? 'text-foreground' : 'text-muted-foreground'
              )}>
                {endDate ? formatDisplayDate(endDate) : 'Selecciona'}
              </span>
            </div>
          </div>

          <CalendarRange className="h-5 w-5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="rental-date-range-popover w-auto max-w-[92vw] p-0"
        align="start"
      >
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Selecciona las fechas</p>
          <p className="text-xs text-muted-foreground">
            Primero elige la recogida y después una devolución posterior.
          </p>
          <p className="mt-1 text-xs font-medium text-foreground/80">{rangeLabel}</p>
        </div>

        <Calendar
          mode="range"
          selected={selectedRange}
          onSelect={handleSelect}
          disabled={{ before: today }}
          numberOfMonths={2}
          locale={es}
          initialFocus
          className="rounded-b-xl"
          classNames={{
            cell:
              'h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-range-middle)]:bg-slate-200/80 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20',
            day_selected:
              'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
            day_range_start: 'day-range-start',
            day_range_middle:
              'day-range-middle aria-selected:bg-slate-200 aria-selected:text-slate-900',
            day_range_end: 'day-range-end',
            day_today: 'bg-slate-100 text-slate-900',
          }}
        />
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button type="button" variant="ghost" onClick={() => setIsCalendarOpen(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => setIsCalendarOpen(false)}
            disabled={!startDate || !endDate}
          >
            Aplicar fechas
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default SpanishDateRangePicker;
