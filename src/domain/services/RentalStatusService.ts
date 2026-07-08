
/**
 * @fileoverview Servicio de dominio para operaciones con estados de alquileres
 */

import { Rental, RentStatus } from '../models/Rental';

export class RentalStatusService {
  /**
   * Actualiza el estado de un alquiler
   * @param rental El alquiler actual
   * @param newStatus El nuevo estado
   * @returns El alquiler actualizado
   */
  static updateRentalStatus(
    rental: Rental, 
    newStatus: RentStatus
  ): Rental {
    return {
      ...rental,
      status: newStatus
    };
  }

  /**
   * Obtiene la etiqueta legible en español para un estado
   */
  static getStatusLabel(status: string): string {
    switch (status) {
      case 'lead_pending': return 'Solicitud recibida';
      case 'proposal_pending_renter': return 'Propuesta enviada';
      case 'rental_confirmed': return 'Reserva confirmada';
      case 'rental_active': return 'Producto recogido';
      case 'rental_completed': return 'Producto devuelto';
      case 'cancelled': return 'Cancelado';
      case 'rejected': return 'Rechazado';
      case 'expired': return 'Propuesta expirada';
      default: return status;
    }
  }

  static getStatusLabelForRole(
    status: string,
    role: 'owner' | 'renter' | 'admin' | 'viewer'
  ): string {
    if (status === 'lead_pending' && role === 'renter') {
      return 'Solicitud enviada';
    }

    return this.getStatusLabel(status);
  }

  /**
   * Obtiene las clases CSS para una insignia de estado
   */
  static getStatusBadgeClasses(status: string): string {
    switch (status) {
      case 'lead_pending':
        return 'bg-amber-100 text-amber-800 hover:bg-amber-100';
      case 'proposal_pending_renter':
        return 'bg-amber-100 text-amber-800 hover:bg-amber-100';
      case 'rental_confirmed':
        return 'bg-cyan-100 text-cyan-800 hover:bg-cyan-100';
      case 'rental_active':
        return 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100';
      case 'rental_completed':
        return 'bg-slate-100 text-slate-800 hover:bg-slate-100';
      case 'cancelled':
        return 'bg-rose-100 text-rose-800 hover:bg-rose-100';
      case 'rejected':
        return 'bg-orange-100 text-orange-800 hover:bg-orange-100';
      case 'expired':
        return 'bg-zinc-100 text-zinc-800 hover:bg-zinc-100';
      default: 
        return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
    }
  }

  static isTerminalStatus(status: RentStatus): boolean {
    return ['rental_completed', 'cancelled', 'rejected', 'expired'].includes(status);
  }
}
