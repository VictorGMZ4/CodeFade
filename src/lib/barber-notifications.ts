import "server-only";
import { after } from "next/server";
import { db } from "@/lib/db";
import { sendBarberNotice } from "@/lib/notify";
import type { NotificationType } from "@/generated/prisma/client";

/** Se ejecuta después de confirmar la cita, fuera de su transacción. */
export async function notifyBarber(
  appointment: { id: string; shopId: string; barberId: string; startsAt?: Date }, type: NotificationType,
  options: { barberId?: string; previousStartsAt?: Date } = {},
) {
  const barberId = options.barberId ?? appointment.barberId;
  // La cancelación por cambio de profesional se refiere a la hora anterior.
  const noticeStartsAt = type === "CLIENT_CANCELLED" && options.previousStartsAt ? options.previousStartsAt : appointment.startsAt;
  try {
    await db.notification.create({ data: {
      shopId: appointment.shopId, barberId, appointmentId: appointment.id, type,
      previousStartsAt: options.previousStartsAt, startsAt: noticeStartsAt,
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
          include: { customer: true, service: true, shop: true },
        });
        if (!data || data.shop.isDemo) return;
        const barber = await db.barber.findUnique({ where: { id: barberId } });
        if (!barber?.phone) return;
        await sendBarberNotice({
          type, barberName: barber.name, barberPhone: barber.phone,
          customerName: data.customer.name, serviceName: data.service.name,
          startsAt: noticeStartsAt ?? data.startsAt,
          previousStartsAt: options.previousStartsAt, timezone: data.shop.timezone,
        });
      } catch (error) {
        console.error("[avisos] No se pudo enviar WhatsApp", error);
      }
    });
  } catch (error) {
    console.error("[avisos] No se pudo programar WhatsApp", error);
  }
}
