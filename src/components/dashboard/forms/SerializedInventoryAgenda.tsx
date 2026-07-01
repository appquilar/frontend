import type { InventoryAllocation, InventoryUnit } from "@/domain/models/Product";

interface SerializedInventoryAgendaProps {
    units: InventoryUnit[];
    allocations: InventoryAllocation[];
    startDate: string;
    endDate: string;
}

const MAX_TIMELINE_DAYS = 62;

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const endOfDay = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const addDays = (date: Date, offset: number) => {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + offset);
    return nextDate;
};

const formatShortDay = (date: Date) =>
    date.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" });

const formatMonthLabel = (date: Date) =>
    date.toLocaleDateString("es-ES", { month: "short" });

const formatRangeLabel = (startsAt: string, endsAt: string) => {
    const start = new Date(startsAt);
    const end = new Date(endsAt);

    return `${start.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
    })} - ${end.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
    })}`;
};

const getAllocationTone = (state: InventoryAllocation["state"]) =>
    state === "active"
        ? "border-emerald-200 bg-emerald-100 text-emerald-800"
        : "border-amber-200 bg-amber-100 text-amber-800";

const overlapsDay = (allocation: InventoryAllocation, day: Date) => {
    const allocationStart = new Date(allocation.startsAt);
    const allocationEnd = new Date(allocation.endsAt);

    return allocationStart <= endOfDay(day) && allocationEnd >= startOfDay(day);
};

const getTimelineDays = (startDateValue: string, endDateValue: string) => {
    const today = startOfDay(new Date());
    const parsedStartDate = startOfDay(new Date(`${startDateValue}T00:00:00`));
    const parsedEndDate = startOfDay(new Date(`${endDateValue}T00:00:00`));
    const startDate = Number.isNaN(parsedStartDate.getTime()) ? today : parsedStartDate;
    const endDate = Number.isNaN(parsedEndDate.getTime()) ? startDate : parsedEndDate;
    const diffDays = Math.max(
        0,
        Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
    );
    const daysToShow = Math.min(diffDays + 1, MAX_TIMELINE_DAYS);

    return Array.from({ length: daysToShow }, (_value, index) => addDays(startDate, index));
};

const getUpcomingAllocationsForUnit = (
    unit: InventoryUnit,
    allocations: InventoryAllocation[],
) =>
    allocations
        .filter((allocation) =>
            allocation.state !== "released" && allocation.assignedUnitIds?.includes(unit.unitId))
        .sort((left, right) => left.startsAt.localeCompare(right.startsAt));

const getAllocationForDay = (allocations: InventoryAllocation[], day: Date) =>
    allocations.find((allocation) => overlapsDay(allocation, day)) ?? null;

const TimelineLegend = () => (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Leyenda</span>
        <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-1 text-emerald-800">
            Activa
        </span>
        <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-1 text-amber-800">
            Reservada
        </span>
        <span className="rounded-full border border-dashed border-border px-2 py-1">
            Libre
        </span>
    </div>
);

const SerializedInventoryAgenda = ({
    units,
    allocations,
    startDate,
    endDate,
}: SerializedInventoryAgendaProps) => {
    const timelineDays = getTimelineDays(startDate, endDate);

    return (
        <div className="space-y-4 rounded-xl border border-border p-4">
            <div className="space-y-1">
                <p className="font-medium">Calendario de ocupacion</p>
                <p className="text-sm text-muted-foreground">
                    Cada unidad tiene su propia agenda para el rango seleccionado. Si hay muchos dias, puedes desplazarte en horizontal.
                </p>
            </div>

            <TimelineLegend />

            <div className="md:hidden space-y-3">
                {units.map((unit) => {
                    const unitAllocations = getUpcomingAllocationsForUnit(unit, allocations);

                    return (
                        <div key={unit.unitId} className="rounded-xl border border-border bg-muted/10 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="font-medium">{unit.code}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {unitAllocations.length > 0
                                            ? `${unitAllocations.length} reserva(s) proxima(s)`
                                            : "Sin reservas proximas"}
                                    </p>
                                </div>
                                <span className="rounded-full border border-border px-2 py-1 text-xs capitalize text-muted-foreground">
                                    {unit.status}
                                </span>
                            </div>

                            <div className="mt-3 overflow-x-auto">
                                <div
                                    className="grid min-w-[340px] gap-2"
                                    style={{ gridTemplateColumns: `repeat(${timelineDays.length}, minmax(44px, 1fr))` }}
                                >
                                    {timelineDays.map((day) => {
                                        const allocation = getAllocationForDay(unitAllocations, day);

                                        return (
                                            <div key={`${unit.unitId}-${day.toISOString()}`} className="space-y-1">
                                                <div className="text-center text-[11px] font-medium text-muted-foreground">
                                                    {day.toLocaleDateString("es-ES", { weekday: "narrow" })}
                                                </div>
                                                <div
                                                    className={`flex h-12 items-center justify-center rounded-lg border text-[11px] font-medium ${
                                                        allocation
                                                            ? getAllocationTone(allocation.state)
                                                            : "border-border bg-background text-muted-foreground"
                                                    }`}
                                                    title={allocation ? formatRangeLabel(allocation.startsAt, allocation.endsAt) : "Libre"}
                                                >
                                                    {allocation ? "Ocup." : "Libre"}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                                {unitAllocations.length > 0 ? (
                                    unitAllocations.slice(0, 3).map((allocation) => (
                                        <span
                                            key={allocation.allocationId}
                                            className={`rounded-full border px-2 py-1 text-xs ${getAllocationTone(allocation.state)}`}
                                        >
                                            {formatRangeLabel(allocation.startsAt, allocation.endsAt)}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-xs text-muted-foreground">Sin bloqueos proximos.</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="hidden md:block overflow-x-auto">
                <div className="min-w-[980px] space-y-2">
                    <div
                        className="grid gap-2"
                        style={{ gridTemplateColumns: `220px repeat(${timelineDays.length}, minmax(56px, 1fr))` }}
                    >
                        <div className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Unidad
                        </div>
                        {timelineDays.map((day) => (
                            <div
                                key={day.toISOString()}
                                className="rounded-lg border border-border bg-muted/20 px-2 py-2 text-center"
                            >
                                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                    {formatMonthLabel(day)}
                                </p>
                                <p className="text-sm font-semibold text-foreground">{formatShortDay(day)}</p>
                            </div>
                        ))}
                    </div>

                    {units.map((unit) => {
                        const unitAllocations = getUpcomingAllocationsForUnit(unit, allocations);

                        return (
                            <div
                                key={unit.unitId}
                                className="grid gap-2"
                                style={{ gridTemplateColumns: `220px repeat(${timelineDays.length}, minmax(56px, 1fr))` }}
                            >
                                <div className="rounded-xl border border-border bg-background p-3">
                                    <p className="font-medium">{unit.code}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {unitAllocations.length > 0
                                            ? `${unitAllocations.length} reserva(s) en agenda`
                                            : "Sin reservas proximas"}
                                    </p>
                                </div>

                                {timelineDays.map((day) => {
                                    const allocation = getAllocationForDay(unitAllocations, day);

                                    return (
                                        <div
                                            key={`${unit.unitId}-${day.toISOString()}`}
                                            className={`flex min-h-[72px] items-center justify-center rounded-xl border px-2 text-center text-xs font-medium ${
                                                allocation
                                                    ? getAllocationTone(allocation.state)
                                                    : "border-border bg-background text-muted-foreground"
                                            }`}
                                            title={allocation ? formatRangeLabel(allocation.startsAt, allocation.endsAt) : "Libre"}
                                        >
                                            {allocation ? (
                                                <div>
                                                    <p>{allocation.state === "active" ? "Activa" : "Reserv."}</p>
                                                    <p className="mt-1 text-[10px] opacity-80">
                                                        {formatRangeLabel(allocation.startsAt, allocation.endsAt)}
                                                    </p>
                                                </div>
                                            ) : (
                                                "Libre"
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default SerializedInventoryAgenda;
