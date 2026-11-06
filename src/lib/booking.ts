import "server-only";
import { randomBytes } from "node:crypto";
import { db, isOverlapError } from "@/lib/db";
import { getDaySlots } from "@/lib/availability";
import { notifyBarber } from "@/lib/barber-notifications";
import { addDaysToDay, localDay, localToUtc } from "@/lib/time";
import type { Shop } from "@/generated/prisma/client";

export type BookingInput = {
  serviceId: string;
  /** null = cualquier barbero disponible */
  barberId: string | null;
  start: Date;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
};

export type BookingResult =
  | { ok: true; appointmentId: string; manageToken: string }
  | { ok: false; error: string };

/**
 * Crea una cita validando de nuevo la disponibilidad en el servidor. La
 * restricción de exclusión de Postgres es la última defensa contra dos
 * reservas simultáneas del mismo hueco.
 */
export async function bookAppointment(shop: Shop, input: BookingInput): Promise<BookingResult> {
  const service = await db.service.findFirst({
    where: { id: input.serviceId, shopId: shop.id, active: true },
  });
  if (!service) return { ok: false, error: "El servicio ya no está disponible." };

  const barbers = await db.barber.findMany({
    where: { shopId: shop.id, active: true, ...(input.barberId ? { id: input.barberId } : {}) },
    select: { id: true },
  });
  if (barbers.length === 0) return { ok: false, error: "El profesional ya no está disponible." };

  const day = localDay(input.start, shop.timezone);
  const slots = await getDaySlots(shop, day, service.durationMin, barbers.map((b) => b.id));
  const slot = slots.find((s) => s.start === input.start.toISOString());
  if (!slot) return { ok: false, error: "Ese horario ya no está disponible. Elige otro." };

  // Con "cualquier barbero" repartimos: primero quien tenga menos citas ese día.
  const candidates = slot.barberIds.length > 1 ? await byLoad(slot.barberIds, input.start, shop) : slot.barberIds;

  const customer = await db.customer.upsert({
    where: { shopId_phone: { shopId: shop.id, phone: input.phone } },
    create: { shopId: shop.id, name: input.name, phone: input.phone, email: input.email },
    update: { name: input.name, ...(input.email ? { email: input.email } : {}) },
  });

  for (const barberId of candidates) {
    try {
      const appointment = await db.appointment.create({
        data: {
          shopId: shop.id,
          barberId,
          serviceId: service.id,
          customerId: customer.id,
          startsAt: input.start,
          endsAt: new Date(input.start.getTime() + service.durationMin * 60_000),
          priceCents: service.priceCents,
          notes: input.notes,
          manageToken: randomBytes(18).toString("base64url"),
        },
      });
      await notifyBarber(appointment, "NEW_BOOKING");
      return { ok: true, appointmentId: appointment.id, manageToken: appointment.manageToken };
    } catch (error) {
      if (!isOverlapError(error)) throw error;
      // Alguien reservó este hueco con este barbero hace un instante; probamos el siguiente.
    }
  }
  return { ok: false, error: "Alguien acaba de reservar ese horario. Elige otro." };
}

async function byLoad(barberIds: string[], start: Date, shop: Shop) {
  const day = localDay(start, shop.timezone);
  const counts = await db.appointment.groupBy({
    by: ["barberId"],
    where: {
      barberId: { in: barberIds },
      status: "BOOKED",
      startsAt: {
        gte: localToUtc(day, 0, shop.timezone),
        lt: localToUtc(addDaysToDay(day, 1, shop.timezone), 0, shop.timezone),
      },
    },
    _count: true,
  });
  const load = new Map(counts.map((c) => [c.barberId, c._count]));
  return [...barberIds].sort((a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0));
}
