// Límites de las reglas de reserva de cada barbería. Los usan el formulario de
// Ajustes y la validación del servidor, para que nunca se contradigan.

export const BOOKING_RULES = {
  /** Cada cuántos minutos se ofrece un turno */
  slotMinutes: { min: 5, max: 120 },
  /** Antelación mínima para reservar, en minutos (hasta 7 días) */
  leadTimeMinutes: { min: 0, max: 7 * 24 * 60 },
  /** Hasta cuántos días hacia adelante se puede reservar */
  bookingWindowDays: { min: 1, max: 15 },
  /** Cuántas horas antes de la cita sale el recordatorio */
  reminderHours: { min: 1, max: 72 },
} as const;

export type BookingRule = keyof typeof BOOKING_RULES;
