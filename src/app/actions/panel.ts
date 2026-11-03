"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { requireShop } from "@/lib/auth";
import { db } from "@/lib/db";
import { parsePrice, slugify } from "@/lib/format";
import { hhmmToMinutes, localToUtc } from "@/lib/time";

// Todas las acciones obtienen la barbería de la sesión y filtran por shopId:
// nunca confiamos en un id de barbería que venga del formulario.

export type FormResult = { ok?: boolean; error?: string; errors?: Record<string, string[] | undefined> } | undefined;

// ── Servicios ──────────────────────────────────────────────────────────────

const ServiceSchema = z.object({
  name: z.string().trim().min(2, { error: "Escribe un nombre." }).max(60),
  durationMin: z.coerce.number().int().min(5, { error: "Mínimo 5 minutos." }).max(480),
  price: z.string().trim(),
});

export async function saveService(_s: FormResult, formData: FormData): Promise<FormResult> {
  const { shop } = await requireShop();
  const parsed = ServiceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  const priceCents = parsePrice(parsed.data.price);
  if (priceCents === null) return { errors: { price: ["Precio no válido."] } };

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
  const { shop } = await requireShop();
  await db.service.updateMany({ where: { id, shopId: shop.id }, data: { active } });
  revalidatePath("/panel/servicios");
}

// ── Equipo ─────────────────────────────────────────────────────────────────

export async function createBarber(_s: FormResult, formData: FormData): Promise<FormResult> {
  const { shop } = await requireShop();
  const name = z.string().trim().min(2).max(60).safeParse(formData.get("name"));
  if (!name.success) return { errors: { name: ["Escribe un nombre."] } };

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
      workingHours: {
        create: (template?.workingHours ?? []).map(({ weekday, startMin, endMin }) => ({ weekday, startMin, endMin })),
      },
    },
  });
  revalidatePath("/panel/equipo");
  return { ok: true };
}

export async function updateBarber(_s: FormResult, formData: FormData): Promise<FormResult> {
  const { shop } = await requireShop();
  const id = String(formData.get("id") ?? "");
  const name = z.string().trim().min(2).max(60).safeParse(formData.get("name"));
  if (!name.success) return { errors: { name: ["Escribe un nombre."] } };

  const barber = await db.barber.findFirst({ where: { id, shopId: shop.id } });
  if (!barber) return { error: "Barbero no encontrado." };

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
    db.barber.update({ where: { id }, data: { name: name.data, active: formData.get("active") === "on" } }),
    db.workingHours.deleteMany({ where: { barberId: id } }),
    db.workingHours.createMany({ data: hours.map((h) => ({ ...h, barberId: id })) }),
  ]);
  revalidatePath("/panel/equipo");
  revalidatePath(`/panel/equipo/${id}`);
  return { ok: true };
}

export async function addTimeOff(_s: FormResult, formData: FormData): Promise<FormResult> {
  const { shop } = await requireShop();
  const barberId = String(formData.get("barberId") ?? "");
  const barber = await db.barber.findFirst({ where: { id: barberId, shopId: shop.id } });
  if (!barber) return { error: "Barbero no encontrado." };

  const fromDay = String(formData.get("fromDay") ?? "");
  const toDay = String(formData.get("toDay") ?? "") || fromDay;
  const allDay = formData.get("allDay") === "on";
  const fromMin = allDay ? 0 : hhmmToMinutes(String(formData.get("fromTime") ?? ""));
  const toMin = allDay ? 24 * 60 : hhmmToMinutes(String(formData.get("toTime") ?? ""));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDay) || !/^\d{4}-\d{2}-\d{2}$/.test(toDay) || fromMin === null || toMin === null) {
    return { error: "Completa las fechas y horas." };
  }
  const startsAt = localToUtc(fromDay, fromMin, shop.timezone);
  const endsAt = localToUtc(toDay, toMin, shop.timezone);
  if (endsAt <= startsAt) return { error: "El fin debe ser posterior al inicio." };

  const reason = String(formData.get("reason") ?? "").trim().slice(0, 100) || null;
  await db.timeOff.create({ data: { barberId, startsAt, endsAt, reason } });
  revalidatePath(`/panel/equipo/${barberId}`);
  return { ok: true };
}

export async function deleteTimeOff(id: string) {
  const { shop } = await requireShop();
  const item = await db.timeOff.findFirst({ where: { id, barber: { shopId: shop.id } } });
  if (!item) return;
  await db.timeOff.delete({ where: { id } });
  revalidatePath(`/panel/equipo/${item.barberId}`);
}

// ── Agenda ─────────────────────────────────────────────────────────────────

const STATUSES = ["BOOKED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;

export async function setAppointmentStatus(id: string, status: (typeof STATUSES)[number]) {
  const { shop } = await requireShop();
  if (!STATUSES.includes(status)) return { error: "Estado no válido." };
  try {
    await db.appointment.updateMany({ where: { id, shopId: shop.id }, data: { status } });
  } catch {
    // Reactivar una cita cancelada puede chocar con otra que ocupó su hueco.
    return { error: "Ese horario ya está ocupado por otra cita." };
  }
  revalidatePath("/panel");
  return { ok: true };
}

// ── Ajustes ────────────────────────────────────────────────────────────────

const SettingsSchema = z.object({
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
  slotMinutes: z.coerce.number().int().refine((n) => [5, 10, 15, 20, 30, 60].includes(n)),
  leadTimeMinutes: z.coerce.number().int().min(0).max(7 * 24 * 60),
  bookingWindowDays: z.coerce.number().int().min(1).max(180),
  reminderHours: z.coerce.number().int().min(1).max(72),
});

const RESERVED_SLUGS = new Set(["panel", "api", "registro", "ingresar", "cita", "admin", "b"]);

export async function saveSettings(_s: FormResult, formData: FormData): Promise<FormResult> {
  const { shop } = await requireShop();
  const parsed = SettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  const data = parsed.data;
  const slug = slugify(data.slug);

  if (RESERVED_SLUGS.has(slug)) return { errors: { slug: ["Ese enlace no está disponible."] } };
  if (slug !== shop.slug) {
    const taken = await db.shop.findUnique({ where: { slug }, select: { id: true } });
    if (taken) return { errors: { slug: ["Ese enlace ya lo usa otra barbería."] } };
  }

  await db.shop.update({
    where: { id: shop.id },
    data: { ...data, slug, phone: data.phone || null, address: data.address || null },
  });
  revalidatePath("/panel", "layout");
  return { ok: true };
}
