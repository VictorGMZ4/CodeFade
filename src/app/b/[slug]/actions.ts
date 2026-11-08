"use server";

import { clientIp, consume, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { redirect } from "next/navigation";
import * as z from "zod";
import { bookableDays, getDaySlots, getSlots } from "@/lib/availability";
import { bookAppointment, MAX_UPCOMING_PER_PHONE, TOO_MANY_UPCOMING } from "@/lib/booking";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/format";
import { isValidDay } from "@/lib/time";

// Acciones públicas: no requieren sesión, así que validan todo lo que llega.
const IdSchema = z.string().min(1).max(64);
const AvailabilitySchema = z.object({ slug: IdSchema, serviceId: IdSchema, barberId: IdSchema.nullable() });

async function shopBySlug(slug: string) {
  return db.shop.findUnique({ where: { slug } });
}

export async function fetchSlots(slug: string, serviceId: string, barberId: string | null, day: string) {
  if (!AvailabilitySchema.extend({ day: z.string().refine(isValidDay) }).safeParse({ slug, serviceId, barberId, day }).success) return [];
  const ip = await clientIp();
  if (ip !== "desconocida" && (await consume(`availability:ip:${ip}`, 120, 5 * 60 * 1000)).limited) return [];
  const shop = await shopBySlug(slug);
  if (!shop || !isValidDay(day)) return [];
  const service = await db.service.findFirst({ where: { id: serviceId, shopId: shop.id, active: true } });
  if (!service) return [];
  const barbers = await db.barber.findMany({
    where: { shopId: shop.id, active: true, ...(barberId ? { id: barberId } : {}) },
    select: { id: true },
  });
  const slots = await getDaySlots(shop, day, service.durationMin, barbers.map((b) => b.id));
  return slots.map((s) => s.start);
}

/** Días del rango reservable en los que hay al menos un turno libre. */
export async function fetchOpenDays(slug: string, serviceId: string, barberId: string | null) {
  if (!AvailabilitySchema.safeParse({ slug, serviceId, barberId }).success) return [];
  const ip = await clientIp();
  if (ip !== "desconocida" && (await consume(`availability:ip:${ip}`, 120, 5 * 60 * 1000)).limited) return [];
  const shop = await shopBySlug(slug);
  if (!shop) return [];
  const service = await db.service.findFirst({ where: { id: serviceId, shopId: shop.id, active: true } });
  if (!service) return [];
  const barbers = await db.barber.findMany({
    where: { shopId: shop.id, active: true, ...(barberId ? { id: barberId } : {}) },
    select: { id: true },
  });
  const slots = await getSlots(shop, bookableDays(shop, 60), service.durationMin, barbers.map((b) => b.id));
  return [...slots.entries()].filter(([, list]) => list.length > 0).map(([day]) => day);
}

const BookingSchema = z.object({
  serviceId: z.string().min(1),
  barberId: z.string().optional(),
  start: z.iso.datetime(),
  name: z.string().trim().min(2, { error: "Escribe tu nombre." }).max(60),
  phone: z.string().trim().min(6, { error: "Escribe tu número." }).max(25),
  email: z.union([z.literal(""), z.email({ error: "Correo no válido." })]).optional(),
  notes: z.string().trim().max(200).optional(),
  privacy: z.literal("on", { error: "Acepta el aviso de privacidad para reservar." }),
  // Campo trampa: los humanos no lo ven, los bots lo rellenan.
  website: z.string().max(0).optional(),
});

export type BookingState = { error?: string; code?: "SLOT_TAKEN"; errors?: Record<string, string[] | undefined> } | undefined;

export async function book(slug: string, _state: BookingState, formData: FormData): Promise<BookingState> {
  if (!IdSchema.safeParse(slug).success) return { error: "Este negocio no existe." };
  const shop = await shopBySlug(slug);
  if (!shop) return { error: "Este negocio no existe." };

  const parsed = BookingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const errors = z.flattenError(parsed.error).fieldErrors;
    if (errors.website) return { error: "No se pudo completar la reserva." };
    return { errors };
  }
  const data = parsed.data;

  const phone = normalizePhone(data.phone, shop.countryCode);
  if (!phone) return { errors: { phone: ["Número no válido."] } };

  if ((await consume(`book:ip:${await clientIp()}`, 10, 60 * 60 * 1000)).limited) return { error: RATE_LIMIT_MESSAGE };

  // Evita que un mismo número acapare la agenda.
  const upcoming = await db.appointment.count({
    where: { shopId: shop.id, status: "BOOKED", startsAt: { gt: new Date() }, customer: { phone } },
  });
  // Comprobación rápida; la definitiva se hace al crear la cita (bookAppointment).
  if (upcoming >= MAX_UPCOMING_PER_PHONE) return { error: TOO_MANY_UPCOMING };

  const result = await bookAppointment(shop, {
    serviceId: data.serviceId,
    barberId: data.barberId || null,
    start: new Date(data.start),
    name: data.name,
    phone,
    email: data.email || null,
    notes: data.notes || null,
    privacyAccepted: true,
  });
  if (!result.ok) return { error: result.error, code: result.code };

  redirect(`/cita/${result.manageToken}?nueva=1`);
}
