"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { requireShop } from "@/lib/auth";
import { db, isOverlapError } from "@/lib/db";
import { BUSINESS_TYPES } from "@/lib/business-types";
import { BOOKING_RULES, type BookingRule } from "@/lib/booking-rules";
import { parsePrice, parseWhatsApp, slugify } from "@/lib/format";
import { hhmmToMinutes, isValidDay, localToUtc } from "@/lib/time";
import { RESERVED_SLUGS } from "@/lib/reserved-slugs";

// Todas las acciones obtienen la barbería de la sesión y filtran por shopId:
// nunca confiamos en un id de barbería que venga del formulario.

export type FormResult = { ok?: boolean; error?: string; errors?: Record<string, string[] | undefined> } | undefined;
const IdSchema = z.string().min(1).max(64);

// ── Servicios ──────────────────────────────────────────────────────────────

const ServiceSchema = z.object({
  name: z.string().trim().min(2, { error: "Escribe un nombre." }).max(60),
  durationMin: z.coerce.number().int().min(5, { error: "Mínimo 5 minutos." }).max(480),
  price: z.string().trim(),
});

export async function saveService(_s: FormResult, formData: FormData): Promise<FormResult> {
  const { shop, isOwner } = await requireShop();
  if (!isOwner) return { error: "No tienes permiso para esta acción." };
  const parsed = ServiceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  const priceCents = parsePrice(parsed.data.price);
  if (priceCents === null) return { errors: { price: ["Precio no válido."] } };
  if (typeof priceCents === "object") return { errors: { price: [priceCents.error] } };

  const id = formData.get("id");
  const data = { name: parsed.data.name, durationMin: parsed.data.durationMin, priceCents };
  if (typeof id === "string" && id) {
    const { count } = await db.service.updateMany({ where: { id, shopId: shop.id }, data });
    if (!count) return { error: "Servicio no encontrado." };
  } else {
    await db.service.create({ data: { ...data, shopId: shop.id } });
  }
  revalidatePath("/panel/servicios");
  return { ok: true };
}

export async function setServiceActive(id: string, active: boolean) {
  if (!z.object({ id: IdSchema, active: z.boolean() }).safeParse({ id, active }).success) return { error: "Datos no válidos." };
  const { shop, isOwner } = await requireShop();
  if (!isOwner) return { error: "No tienes permiso para esta acción." };
  await db.service.updateMany({ where: { id, shopId: shop.id }, data: { active } });
  revalidatePath("/panel/servicios");
}

// ── Equipo ─────────────────────────────────────────────────────────────────

export async function createBarber(_s: FormResult, formData: FormData): Promise<FormResult> {
  const { shop, isOwner } = await requireShop();
  if (!isOwner) return { error: "No tienes permiso para esta acción." };
  const name = z.string().trim().min(2).max(60).safeParse(formData.get("name"));
  if (!name.success) return { errors: { name: ["Escribe un nombre."] } };

  const whatsapp = parseWhatsApp(formData.get("phone"), shop.countryCode);
  if ("error" in whatsapp) return { errors: { phone: [whatsapp.error] } };
  const phone = whatsapp.phone;

  // Copiamos el horario del primer barbero para no empezar de cero.
  const template = await db.barber.findFirst({
    where: { shopId: shop.id },
    orderBy: { createdAt: "asc" },
    include: { workingHours: true },
  });
  await db.barber.create({
    data: {
      shopId: shop.id,
      name: name.data,
      phone,
      workingHours: {
        create: (template?.workingHours ?? []).map(({ weekday, startMin, endMin }) => ({ weekday, startMin, endMin })),
      },
    },
  });
  revalidatePath("/panel/equipo");
  return { ok: true };
}

export async function updateBarber(_s: FormResult, formData: FormData): Promise<FormResult> {
  const { shop, isOwner, barberId } = await requireShop();
  const id = String(formData.get("id") ?? "");
  if (!isOwner && (!barberId || id !== barberId)) return { error: "No tienes permiso para esta acción." };
  const barber = await db.barber.findFirst({ where: { id, shopId: shop.id } });
  if (!barber) return { error: "Profesional no encontrado." };

  // El WhatsApp es obligatorio y lo puede cambiar el propio profesional.
  // STAFF solo puede modificar eso y su horario; ignoramos los demás campos.
  const whatsapp = parseWhatsApp(formData.get("phone"), shop.countryCode);
  if ("error" in whatsapp) return { errors: { phone: [whatsapp.error] } };
  let profile: { phone: string; name?: string; active?: boolean } = { phone: whatsapp.phone };
  if (isOwner) {
    const name = z.string().trim().min(2).max(60).safeParse(formData.get("name"));
    if (!name.success) return { errors: { name: ["Escribe un nombre."] } };
    profile = { ...profile, name: name.data, active: formData.get("active") === "on" };
  }

  // El formulario envía, por día, una lista de franjas "HH:MM-HH:MM".
  const hours: { weekday: number; startMin: number; endMin: number }[] = [];
  for (let weekday = 0; weekday < 7; weekday++) {
    if (formData.get(`on-${weekday}`) !== "on") continue;
    const starts = formData.getAll(`start-${weekday}`).map(String);
    const ends = formData.getAll(`end-${weekday}`).map(String);
    const ranges = starts
      .map((s, i) => ({ startMin: hhmmToMinutes(s), endMin: hhmmToMinutes(ends[i] ?? "") }))
      .filter((r) => r.startMin !== null || r.endMin !== null);
    for (const r of ranges) {
      if (r.startMin === null || r.endMin === null || r.endMin <= r.startMin) {
        return { error: "Revisa las horas: la hora de fin debe ser posterior a la de inicio." };
      }
    }
    const sorted = ranges.sort((a, b) => a.startMin! - b.startMin!);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].startMin! < sorted[i - 1].endMin!) return { error: "Hay franjas que se solapan en un mismo día." };
    }
    hours.push(...sorted.map((r) => ({ weekday, startMin: r.startMin!, endMin: r.endMin! })));
  }

  await db.$transaction([
    db.barber.update({ where: { id, shopId: shop.id }, data: profile }),
    db.workingHours.deleteMany({ where: { barberId: id } }),
    db.workingHours.createMany({ data: hours.map((h) => ({ ...h, barberId: id })) }),
  ]);
  revalidatePath("/panel/equipo");
  revalidatePath(`/panel/equipo/${id}`);
  return { ok: true };
}

export async function addTimeOff(_s: FormResult, formData: FormData): Promise<FormResult> {
  const { shop, isOwner, barberId: ownBarberId } = await requireShop();
  const barberId = String(formData.get("barberId") ?? "");
  if (!isOwner && (!ownBarberId || barberId !== ownBarberId)) return { error: "No tienes permiso para esta acción." };
  const barber = await db.barber.findFirst({ where: { id: barberId, shopId: shop.id } });
  if (!barber) return { error: "Profesional no encontrado." };

  const fromDay = String(formData.get("fromDay") ?? "");
  const toDay = String(formData.get("toDay") ?? "") || fromDay;
  const allDay = formData.get("allDay") === "on";
  const fromMin = allDay ? 0 : hhmmToMinutes(String(formData.get("fromTime") ?? ""));
  const toMin = allDay ? 24 * 60 : hhmmToMinutes(String(formData.get("toTime") ?? ""));
  if (![fromDay, toDay].every((day) => isValidDay(day) && new Date(day).toISOString().slice(0, 10) === day) || fromMin === null || toMin === null) {
    return { error: "Completa las fechas y horas." };
  }
  const startsAt = localToUtc(fromDay, fromMin, shop.timezone);
  const endsAt = localToUtc(toDay, toMin, shop.timezone);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return { error: "Completa las fechas y horas." };
  if (endsAt <= startsAt) return { error: "El fin debe ser posterior al inicio." };
  if (endsAt.getTime() - startsAt.getTime() > 366 * 24 * 60 * 60 * 1000) return { error: "La ausencia no puede superar 366 días." };

  const reason = String(formData.get("reason") ?? "").trim().slice(0, 100) || null;
  await db.timeOff.create({ data: { barberId, startsAt, endsAt, reason } });
  revalidatePath(`/panel/equipo/${barberId}`);
  return { ok: true };
}

export async function deleteTimeOff(id: string) {
  if (!IdSchema.safeParse(id).success) return { error: "Identificador no válido." };
  const { shop, isOwner, barberId } = await requireShop();
  const item = await db.timeOff.findFirst({ where: { id, barber: { shopId: shop.id } } });
  if (!item) return;
  if (!isOwner && (!barberId || item.barberId !== barberId)) return { error: "No tienes permiso para esta acción." };
  await db.timeOff.delete({ where: { id } });
  revalidatePath(`/panel/equipo/${item.barberId}`);
}

// ── Agenda ─────────────────────────────────────────────────────────────────

const STATUSES = ["BOOKED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;

export async function setAppointmentStatus(id: string, status: (typeof STATUSES)[number]) {
  if (!z.object({ id: IdSchema, status: z.enum(STATUSES) }).safeParse({ id, status }).success) return { error: "Datos no válidos." };
  const { shop, isOwner, barberId } = await requireShop();
  if (!isOwner && !barberId) return { error: "No tienes permiso para esta acción." };
  const permission = { id, shopId: shop.id, ...(!isOwner ? { barberId: barberId! } : {}) };
  const appointment = await db.appointment.findFirst({
    where: permission, select: { status: true, startsAt: true },
  });
  if (!appointment) return { error: "No tienes permiso para esta acción." };
  const now = new Date();
  const current = appointment.status;
  if (status === "COMPLETED" || status === "NO_SHOW") {
    if (current !== "BOOKED" && current !== "COMPLETED" && current !== "NO_SHOW") return { error: "No se puede marcar así una cita cancelada." };
    if (appointment.startsAt > now) return { error: "No se puede marcar así una cita futura." };
  } else if (status === "CANCELLED") {
    if (current !== "BOOKED") return { error: "Solo se puede cancelar una cita reservada." };
  } else {
    if (current !== "CANCELLED" && current !== "COMPLETED" && current !== "NO_SHOW") return { error: "Esta cita ya está reservada." };
    if (current === "CANCELLED" && appointment.startsAt <= now) return { error: "Esa cita ya pasó." };
  }
  try {
    const { count } = await db.appointment.updateMany({
      where: {
        ...permission, status: current,
      }, data: { status },
    });
    if (!count) return { error: "La cita cambió. Recarga la agenda e inténtalo de nuevo." };
  } catch (error) {
    if (!isOverlapError(error)) throw error;
    // Reactivar una cita cancelada puede chocar con otra que ocupó su hueco.
    return { error: "Ese horario ya está ocupado por otra cita." };
  }
  revalidatePath("/panel");
  return { ok: true };
}

// ── Ajustes ────────────────────────────────────────────────────────────────

const SettingsSchema = z.object({
  businessType: z.enum(BUSINESS_TYPES.map((type) => type.value), { error: "Elige el tipo de negocio." }),
  name: z.string().trim().min(2, { error: "Escribe un nombre." }).max(60),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, { error: "Mínimo 3 caracteres." })
    .max(40)
    .regex(/^[a-z0-9-]+$/, { error: "Solo letras, números y guiones." }),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(120).optional(),
  slotMinutes: ruleField("slotMinutes", "Entre 5 y 120 minutos."),
  leadTimeMinutes: ruleField("leadTimeMinutes", "Entre 0 minutos y 7 días."),
  bookingWindowDays: ruleField("bookingWindowDays", "Entre 1 y 15 días."),
  reminderHours: ruleField("reminderHours", "Entre 1 y 72 horas."),
});

function ruleField(rule: BookingRule, message: string) {
  const { min, max } = BOOKING_RULES[rule];
  return z.coerce
    .number({ error: "Escribe un número." })
    .int({ error: "Usa un número entero." })
    .min(min, { error: message })
    .max(max, { error: message });
}

export async function saveSettings(_s: FormResult, formData: FormData): Promise<FormResult> {
  const { shop, isOwner } = await requireShop();
  if (!isOwner) return { error: "No tienes permiso para esta acción." };
  const parsed = SettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  const data = parsed.data;
  const slug = slugify(data.slug);

  if (RESERVED_SLUGS.has(slug)) return { errors: { slug: ["Ese enlace no está disponible."] } };
  if (slug !== shop.slug) {
    const taken = await db.shop.findUnique({ where: { slug }, select: { id: true } });
    if (taken) return { errors: { slug: ["Ese enlace ya lo usa otro negocio."] } };
  }

  try {
    await db.shop.update({
      where: { id: shop.id },
      data: { ...data, slug, phone: data.phone || null, address: data.address || null },
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return { errors: { slug: ["Ese enlace ya lo usa otro negocio."] } };
    }
    throw error;
  }
  revalidatePath("/panel", "layout");
  return { ok: true };
}

/** El profesional completa su propio WhatsApp (pantalla obligatoria al entrar). */
export async function saveMyWhatsApp(_s: FormResult, formData: FormData): Promise<FormResult> {
  const { shop, barberId } = await requireShop();
  if (!barberId) return { error: "Tu cuenta no está vinculada a ningún profesional." };
  const whatsapp = parseWhatsApp(formData.get("phone"), shop.countryCode);
  if ("error" in whatsapp) return { errors: { phone: [whatsapp.error] } };
  await db.barber.update({ where: { id: barberId, shopId: shop.id }, data: { phone: whatsapp.phone } });
  revalidatePath("/panel", "layout");
  redirect("/panel");
}
