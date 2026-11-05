"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { notifyBarber } from "@/lib/barber-notifications";

export async function cancelByToken(token: string) {
  if (typeof token !== "string" || token.length < 16) return;
  // Solo citas activas y futuras; el token largo y aleatorio es la autorización.
  const { count } = await db.appointment.updateMany({
    where: { manageToken: token, status: "BOOKED", startsAt: { gt: new Date() } },
    data: { status: "CANCELLED" },
  });
  if (count > 0) {
    try {
      const appointment = await db.appointment.findUnique({ where: { manageToken: token } });
      if (appointment) await notifyBarber(appointment, "CLIENT_CANCELLED");
    } catch (error) {
      console.error("[avisos] No se pudo notificar la cancelación", error);
    }
  }
  revalidatePath(`/cita/${token}`);
}
