"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { notifyBarber } from "@/lib/barber-notifications";
import * as z from "zod";

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
