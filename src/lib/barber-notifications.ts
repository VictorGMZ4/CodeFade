import "server-only";
import { after } from "next/server";
import { db } from "@/lib/db";
import { sendBarberNotice } from "@/lib/notify";
import type { NotificationType } from "@/generated/prisma/client";

/** Se ejecuta después de confirmar la cita, fuera de su transacción. */
export async function notifyBarber(appointment: { id: string; shopId: string; barberId: string }, type: NotificationType) {
  try {
    await db.notification.create({ data: {
      shopId: appointment.shopId, barberId: appointment.barberId, appointmentId: appointment.id, type,
    } });
  } catch (error) {
    console.error("[avisos] No se pudo guardar el aviso", error);
  }

  // El envío es independiente: un fallo al guardar no impide intentar WhatsApp.
  try {
    after(async () => {
      try {
        const data = await db.appointment.findUnique({
          where: { id: appointment.id },
          include: { barber: true, customer: true, service: true, shop: true },
        });
        if (!data?.barber.phone || data.shop.isDemo) return;
        await sendBarberNotice({
          type, barberName: data.barber.name, barberPhone: data.barber.phone,
          customerName: data.customer.name, serviceName: data.service.name,
          startsAt: data.startsAt, timezone: data.shop.timezone,
        });
      } catch (error) {
        console.error("[avisos] No se pudo enviar WhatsApp", error);
      }
    });
  } catch (error) {
    console.error("[avisos] No se pudo programar WhatsApp", error);
  }
}
