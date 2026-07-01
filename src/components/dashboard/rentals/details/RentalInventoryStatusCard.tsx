import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useProductInventory,
  useProductInventoryAllocations,
  useProductInventoryUnits,
} from "@/application/hooks/useProductInventory";
import type { InventoryAllocation, InventoryUnit } from "@/domain/models/Product";
import type { Rental } from "@/domain/models/Rental";
import type { RentActorRole } from "@/domain/services/RentalStateMachineService";
import { Link } from "react-router-dom";

interface RentalInventoryStatusCardProps {
  rental: Rental;
  viewerRole: RentActorRole;
}

const toDateInputValue = (date: Date): string => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const formatAllocationState = (state: InventoryAllocation["state"]): string => {
  if (state === "active") {
    return "En alquiler";
  }

  if (state === "reserved") {
    return "Reservada";
  }

  return "Liberada";
};

const getAllocationBadgeClassName = (state: InventoryAllocation["state"]): string =>
  state === "active"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : state === "reserved"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-slate-200 bg-slate-50 text-slate-700";

const getUnitStatusLabel = (status: InventoryUnit["status"]): string => {
  if (status === "available") {
    return "Disponible";
  }

  if (status === "maintenance") {
    return "Mantenimiento";
  }

  return "Retirada";
};

const RentalInventoryStatusCard = ({ rental, viewerRole }: RentalInventoryStatusCardProps) => {
  const canViewInventory = viewerRole === "owner" || viewerRole === "admin";
  const range = {
    startDate: toDateInputValue(rental.startDate),
    endDate: toDateInputValue(rental.endDate),
  };
  const shouldLoadInventory = canViewInventory && Boolean(rental.productId);
  const inventoryQuery = useProductInventory(rental.productId, shouldLoadInventory, range);
  const allocationsQuery = useProductInventoryAllocations(rental.productId, shouldLoadInventory);
  const unitsQuery = useProductInventoryUnits(
    rental.productId,
    shouldLoadInventory && inventoryQuery.data?.inventoryMode === "managed_serialized",
  );

  if (!canViewInventory) {
    return null;
  }

  const inventory = inventoryQuery.data ?? null;
  const currentAllocation = (allocationsQuery.data ?? []).find(
    (allocation) => allocation.rentId === rental.id && allocation.state !== "released",
  ) ?? null;
  const assignedUnitIds = currentAllocation?.assignedUnitIds ?? [];
  const assignedUnits = (unitsQuery.data ?? []).filter((unit) => assignedUnitIds.includes(unit.unitId));
  const productHref = `/dashboard/products/${rental.productId}`;

  return (
    <Card>
      <CardHeader className="p-5 pb-4 sm:p-6 sm:pb-4">
        <CardDescription className="text-sm font-medium">Inventario del alquiler</CardDescription>
        <CardTitle className="text-lg font-semibold">Estado de producto y unidades</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 px-5 pb-5 pt-0 sm:px-6 sm:pb-6">
        {inventoryQuery.isLoading ? (
          <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
            Cargando estado de inventario...
          </p>
        ) : !inventory ? (
          <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
            No hay informacion de inventario disponible para este producto.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total</p>
                <p className="mt-1 text-2xl font-semibold">{inventory.totalQuantity}</p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bloqueado</p>
                <p className="mt-1 text-2xl font-semibold">{inventory.reservedQuantity}</p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Libre</p>
                <p className="mt-1 text-2xl font-semibold">{inventory.availableQuantity}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {inventory.inventoryMode === "managed_serialized" ? "Unidades identificadas" : "Gestion manual"}
              </Badge>
              <Badge variant="outline" className={inventory.isInventoryEnabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ""}>
                {inventory.isInventoryEnabled ? "Inventario activo" : "Inventario inactivo"}
              </Badge>
              {currentAllocation && (
                <Badge variant="outline" className={getAllocationBadgeClassName(currentAllocation.state)}>
                  {formatAllocationState(currentAllocation.state)}
                </Badge>
              )}
            </div>

            {inventory.inventoryMode === "managed_serialized" && (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold">Unidades aplicadas a este alquiler</p>
                  <p className="text-sm text-muted-foreground">
                    Appquilar las asigna desde backend al confirmar o activar la reserva.
                  </p>
                </div>

                {currentAllocation && assignedUnits.length > 0 ? (
                  <div className="overflow-hidden rounded-xl border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Codigo interno</TableHead>
                          <TableHead>Estado unidad</TableHead>
                          <TableHead>Estado alquiler</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assignedUnits.map((unit) => (
                          <TableRow key={unit.unitId}>
                            <TableCell className="font-medium">{unit.code}</TableCell>
                            <TableCell>{getUnitStatusLabel(unit.status)}</TableCell>
                            <TableCell>{formatAllocationState(currentAllocation.state)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
                    Todavia no hay unidades concretas asignadas a este alquiler.
                  </p>
                )}
              </div>
            )}

            <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
              <Link to={productHref}>Abrir inventario del producto</Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default RentalInventoryStatusCard;
