"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { notifyBarber } from "@/lib/barber-notifications";
import * as z from "zod";
import { bookableDays, getSlots, type Slot } from "@/lib/availability";
import { canReschedule, rescheduleAppointment, type RescheduleResult } from "@/lib/reschedule";
import { clientIp, consume, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { isValidDay } from "@/lib/time";

const RescheduleSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
  barberId: z.string().min(1).max(64).nullable(),
});

async function rescheduleSlots(token: string, barberId: string | null, day?: string): Promise<Map<string, Slot[]>> {
  const ip = await clientIp();
  if (ip !== "desconocida" && (await consume(`availability:ip:${ip}`, 120, 5 * 60 * 1000)).limited) return new Map();
  const a = await db.appointment.findUnique({
    where: { manageToken: token },
    include: { shop: { include: { barbers: {
      where: { active: true, ...(barberId ? { id: barberId } : {}) }, select: { id: true },
    } } } },
  });
  const now = new Date();
  if (!a || !canReschedule(a, a.shop, now).ok) return new Map();
  return getSlots(a.shop, day ? [day] : bookableDays(a.shop, 60, now),
    (+a.endsAt - +a.startsAt) / 60_000, a.shop.barbers.map(b => b.id), now, { excludeAppointmentId: a.id });
}

export async function fetchRescheduleDays(token: string, barberId: string | null): Promise<{ days: string[]; firstSlots: string[] }> {
  if (!RescheduleSchema.safeParse({ token, barberId }).success) return { days: [], firstSlots: [] };
  const slots = await rescheduleSlots(token, barberId);
  const open = [...slots.entries()].filter(([, list]) => list.length > 0);
  return { days: open.map(([day]) => day), firstSlots: open[0]?.[1].map(s => s.start) ?? [] };
}

export async function fetchRescheduleSlots(token: string, barberId: string | null, day: string): Promise<string[]> {
  if (!RescheduleSchema.extend({ day: z.string().refine(isValidDay) }).safeParse({ token, barberId, day }).success) return [];
  return (await rescheduleSlots(token, barberId, day)).get(day)?.map(s => s.start) ?? [];
}

export async function rescheduleByToken(token: string, barberId: string | null, startIso: string): Promise<RescheduleResult> {
  const parsed = RescheduleSchema.extend({ startIso: z.iso.datetime() }).safeParse({ token, barberId, startIso });
  if (!parsed.success) return { ok: false, error: "Los datos de la cita no son válidos." };
  try {
    // Por IP primero: con tokens inventados la clave por token nunca se repetiría.
    const ip = await clientIp();
    if (ip !== "desconocida" && (await consume(`reschedule:ip:${ip}`, 30, 60 * 60 * 1000)).limited) return { ok: false, error: RATE_LIMIT_MESSAGE };
    if ((await consume(`reschedule:token:${token}`, 10, 60 * 60 * 1000)).limited) return { ok: false, error: RATE_LIMIT_MESSAGE };
    const result = await rescheduleAppointment(token, barberId, new Date(startIso));
    if (result.ok) revalidatePath(`/cita/${token}`);
    return result;
  } catch (error) {
    console.error("[reprogramar] No se pudo cambiar la cita", error);
    return { ok: false, error: "No se pudo cambiar la cita. Inténtalo de nuevo." };
  }
}

export async function cancelByToken(token: string): Promise<{ ok: true } | { error: string }> {
  if (!z.string().regex(/^[A-Za-z0-9_-]{16,64}$/).safeParse(token).success) return { error: "El enlace de la cita no es válido." };
  try {
    // Solo citas activas y futuras; el token largo y aleatorio es la autorización.
    const { count } = await db.appointment.updateMany({
      where: { manageToken: token, status: "BOOKED", startsAt: { gt: new Date() } },
      data: { status: "CANCELLED" },
    });
    if (count === 0) {
      const appointment = await db.appointment.findUnique({ where: { manageToken: token } });
      if (appointment?.status === "CANCELLED") return { ok: true };
      return { error: "Esta cita ya no se puede cancelar." };
    }
    try {
      const appointment = await db.appointment.findUnique({ where: { manageToken: token } });
      if (appointment) await notifyBarber(appointment, "CLIENT_CANCELLED");
    } catch (error) {
      console.error("[avisos] No se pudo notificar la cancelación", error);
    }
    revalidatePath(`/cita/${token}`);
    return { ok: true };
  } catch {
    return { error: "No se pudo cancelar la cita. Inténtalo de nuevo." };
  }
}
