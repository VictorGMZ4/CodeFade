import "server-only";
import { db, isOverlapError } from "@/lib/db";
import { getDaySlots } from "@/lib/availability";
import { byLoad } from "@/lib/booking";
import { notifyBarber } from "@/lib/barber-notifications";
import { localDay } from "@/lib/time";
import type { Appointment } from "@/generated/prisma/client";

export const MAX_RESCHEDULES = 2;
type Eligibility = { ok: true } | { ok: false; reason: "LIMIT" | "TOO_LATE" | "NOT_ACTIVE" };
export type RescheduleResult = { ok: true } | { ok: false; error: string; code?: "SLOT_TAKEN" };
export const RESCHEDULE_REASONS = {
  LIMIT: "Ya cambiaste esta cita 2 veces. Si necesitas otro cambio, cancélala y reserva de nuevo.",
  TOO_LATE: "Ya no se puede cambiar: falta muy poco para tu cita.",
  NOT_ACTIVE: "Esta cita ya no se puede cambiar.",
};

export function canReschedule(
  appointment: Pick<Appointment, "status" | "startsAt" | "rescheduleCount">,
  shop: { leadTimeMinutes: number }, now: Date,
): Eligibility {
  if (appointment.status !== "BOOKED") return { ok: false, reason: "NOT_ACTIVE" };
  if (appointment.rescheduleCount >= MAX_RESCHEDULES) return { ok: false, reason: "LIMIT" };
  if (+appointment.startsAt <= +now + shop.leadTimeMinutes * 60_000) return { ok: false, reason: "TOO_LATE" };
  return { ok: true };
}

export async function rescheduleAppointment(token: string, barberId: string | null, start: Date): Promise<RescheduleResult> {
  const a = await db.appointment.findUnique({ where: { manageToken: token }, include: { shop: true, customer: true } });
  if (!a) return { ok: false, error: "El enlace de la cita no es válido." };
  const now = new Date();
  const allowed = canReschedule(a, a.shop, now);
  if (!allowed.ok) return { ok: false, error: RESCHEDULE_REASONS[allowed.reason] };
  if (barberId === a.barberId && +start === +a.startsAt) return { ok: false, error: "Elige una hora distinta a la actual." };
  const barbers = await db.barber.findMany({
    where: { shopId: a.shopId, active: true, ...(barberId ? { id: barberId } : {}) }, select: { id: true },
  });
  const durationMin = (+a.endsAt - +a.startsAt) / 60_000;
  const slots = await getDaySlots(a.shop, localDay(start, a.shop.timezone), durationMin, barbers.map(b => b.id), now, { excludeAppointmentId: a.id });
  const slot = slots.find(s => s.start === start.toISOString());
  if (!slot) return { ok: false, code: "SLOT_TAKEN", error: "Ese horario ya no está disponible. Elige otro." };
  const preferCurrent = barberId === null && slot.barberIds.includes(a.barberId);
  const rest = slot.barberIds.filter(id => !preferCurrent || id !== a.barberId);
  const ordered = rest.length > 1 ? await byLoad(rest, start, a.shop) : rest;
  const candidates = preferCurrent ? [a.barberId, ...ordered] : ordered;
  if (+start === +a.startsAt && candidates[0] === a.barberId) return { ok: false, error: "Elige una hora distinta a la actual." };
  return updateAppointment(a, candidates, start);
}

async function updateAppointment(a: Appointment, candidates: string[], start: Date): Promise<RescheduleResult> {
  const endsAt = new Date(+start + (+a.endsAt - +a.startsAt));
  for (const barberId of candidates) {
    try {
      const { count } = await db.appointment.updateMany({
        where: { id: a.id, status: "BOOKED", rescheduleCount: a.rescheduleCount, startsAt: a.startsAt },
        data: { barberId, startsAt: start, endsAt, rescheduleCount: { increment: 1 }, reminderSentAt: null },
      });
      if (count === 0) return { ok: false, error: "Tu cita cambió mientras elegías. Recarga la página." };
    } catch (error) {
      if (!isOverlapError(error)) throw error;
      continue;
    }
    await notifyReschedule(a, { ...a, barberId, startsAt: start, endsAt });
    return { ok: true };
  }
  return { ok: false, code: "SLOT_TAKEN", error: "Alguien acaba de reservar ese horario. Elige otro." };
}

async function notifyReschedule(before: Appointment, after: Appointment) {
  const notices = before.barberId === after.barberId
    ? [() => notifyBarber(after, "CLIENT_RESCHEDULED", { previousStartsAt: before.startsAt })]
    : [() => notifyBarber(after, "CLIENT_CANCELLED", { barberId: before.barberId, previousStartsAt: before.startsAt }),
      () => notifyBarber(after, "NEW_BOOKING")];
  for (const send of notices) {
    try { await send(); }
    catch (error) { console.error("[avisos] No se pudo notificar la reprogramación", error); }
  }
}
