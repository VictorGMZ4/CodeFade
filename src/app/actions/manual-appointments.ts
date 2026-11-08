"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { requireShop } from "@/lib/auth";
import { db, isOverlapError } from "@/lib/db";
import { getDaySlots, type Slot } from "@/lib/availability";
import { notifyBarber } from "@/lib/barber-notifications";
import { normalizePhone } from "@/lib/format";
import { addDaysToDay, isValidDay, localDay } from "@/lib/time";
import type { FormResult } from "./panel";

const options = { ignoreLeadTime: true, windowDays: 60 };
const occupied = "Ese horario se acaba de ocupar. Elige otro.";
const selectionSchema = z.object({
  barberId: z.string().min(1, "Elige un profesional."),
  serviceId: z.string().min(1, "Elige un servicio."),
  day: z.string().refine((day) => isValidDay(day) && new Date(day).toISOString().slice(0, 10) === day, "Elige un día válido."),
});
const appointmentSchema = selectionSchema.extend({
  start: z.iso.datetime({ error: "Elige una hora." }),
  name: z.string().trim().min(2, "Escribe entre 2 y 60 caracteres.").max(60, "Escribe entre 2 y 60 caracteres."),
  phone: z.string().trim().max(50, "Número no válido."),
  notes: z.string().trim().max(200, "Máximo 200 caracteres."),
});

// Compartimos las comprobaciones entre la consulta de horas y la creación.
async function selection(input: z.infer<typeof selectionSchema>) {
  const context = await requireShop();
  const { shop, isOwner, barberId } = context;
  if (!isOwner && (!barberId || input.barberId !== barberId)) return { error: "No tienes permiso para esta acción." } as const;
  const today = localDay(new Date(), shop.timezone);
  if (input.day < today || input.day > addDaysToDay(today, 60, shop.timezone)) {
    return { errors: { day: ["Elige un día entre hoy y los próximos 60 días."] } };
  }
  const barber = await db.barber.findFirst({ where: { id: input.barberId, shopId: shop.id, active: true } });
  if (!barber) return { errors: { barberId: ["El profesional ya no está disponible."] } };
  const service = await db.service.findFirst({ where: { id: input.serviceId, shopId: shop.id, active: true } });
  if (!service) return { errors: { serviceId: ["El servicio ya no está disponible."] } };
  const slots = await getDaySlots(shop, input.day, service.durationMin, [barber.id], new Date(), options);
  return { context, service, slots };
}

export async function getManualSlots(input: { barberId: string; serviceId: string; day: string }): Promise<{ slots: Slot[]; error?: string }> {
  const parsed = selectionSchema.safeParse(input);
  if (!parsed.success) return { slots: [], error: "Revisa el profesional, servicio y día." };
  const result = await selection(parsed.data);
  if (!result.context) return { slots: [], error: result.error ?? Object.values(result.errors ?? {}).flat()[0] };
  return { slots: result.slots };
}

export async function createManualAppointment(_state: FormResult, formData: FormData): Promise<FormResult> {
  const parsed = appointmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  const data = parsed.data;
  const result = await selection(data);
  if (!result.context) return { error: result.error, errors: result.errors };
  const { context: { shop, isOwner, barberId }, service, slots } = result;
  const phone = data.phone ? normalizePhone(data.phone, shop.countryCode) : null;
  if (data.phone && !phone) return { errors: { phone: ["Número no válido."] } };
  const startsAt = new Date(data.start);
  if (localDay(startsAt, shop.timezone) !== data.day) return { errors: { start: ["Elige una hora del día seleccionado."] } };
  if (!slots.some((slot) => slot.start === startsAt.toISOString() && slot.barberIds.includes(data.barberId))) return { error: occupied };

  let appointment;
  try {
    // Si hay solape, tampoco queda un cliente sin teléfono huérfano.
    appointment = await db.$transaction(async (tx) => {
      const customer = phone
        ? await tx.customer.upsert({
          where: { shopId_phone: { shopId: shop.id, phone } },
          create: { shopId: shop.id, name: data.name, phone }, update: {},
        })
        : await tx.customer.create({ data: { shopId: shop.id, name: data.name, phone: null } });
      return tx.appointment.create({ data: {
        shopId: shop.id, barberId: data.barberId, serviceId: service.id, customerId: customer.id,
        startsAt, endsAt: new Date(startsAt.getTime() + service.durationMin * 60_000),
        source: "MANUAL", priceCents: service.priceCents, notes: data.notes || null,
        manageToken: randomBytes(18).toString("base64url"),
      } });
    });
  } catch (error) {
    if (isOverlapError(error)) return { error: occupied };
    throw error;
  }
  if (isOwner && data.barberId !== barberId) {
    try { await notifyBarber(appointment, "MANUAL_BY_OWNER"); }
    catch (error) { console.error("[avisos] No se pudo avisar de la cita manual", error); }
  }
  revalidatePath("/panel");
  redirect(`/panel?dia=${data.day}`);
}
