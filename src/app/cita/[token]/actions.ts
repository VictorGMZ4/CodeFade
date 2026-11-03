"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export async function cancelByToken(token: string) {
  if (typeof token !== "string" || token.length < 16) return;
  // Solo citas activas y futuras; el token largo y aleatorio es la autorización.
  await db.appointment.updateMany({
    where: { manageToken: token, status: "BOOKED", startsAt: { gt: new Date() } },
    data: { status: "CANCELLED" },
  });
  revalidatePath(`/cita/${token}`);
}
