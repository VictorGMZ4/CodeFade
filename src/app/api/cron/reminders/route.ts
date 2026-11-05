import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { sendReminder } from "@/lib/notify";

// Llamar cada 10-15 minutos desde un cron (Vercel Cron, GitHub Actions, cron-job.org...)
// con la cabecera  Authorization: Bearer <CRON_SECRET>.

const MAX_REMINDER_HOURS = 72;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function GET(request: Request) {
  if (!authorized(request)) return new Response("No autorizado", { status: 401 });

  const now = new Date();
  const candidates = await db.appointment.findMany({
    where: {
      status: "BOOKED",
      source: "ONLINE",
      reminderSentAt: null,
      startsAt: { gt: now, lte: new Date(now.getTime() + MAX_REMINDER_HOURS * 3600_000) },
    },
    include: { shop: true, customer: true, service: true, barber: true },
    orderBy: { startsAt: "asc" },
    take: 200,
  });

  // Cada barbería decide con cuántas horas de antelación avisa.
  const due = candidates.filter(
    (a) => a.startsAt.getTime() - now.getTime() <= a.shop.reminderHours * 3600_000,
  );

  const appUrl = process.env.APP_URL ?? new URL(request.url).origin;
  let sent = 0;
  const failures: { id: string; detail?: string }[] = [];

  for (const a of due) {
    // Marcamos antes de enviar: si dos crons coinciden, solo uno gana la fila.
    const claimed = await db.appointment.updateMany({
      where: { id: a.id, reminderSentAt: null, status: "BOOKED", source: "ONLINE" },
      data: { reminderSentAt: now },
    });
    if (claimed.count === 0) continue;

    const results = await sendReminder({
      customerName: a.customer.name,
      customerPhone: a.customer.phone,
      customerEmail: a.customer.email,
      shopName: a.shop.name,
      shopAddress: a.shop.address,
      serviceName: a.service.name,
      barberName: a.barber.name,
      startsAt: a.startsAt,
      timezone: a.shop.timezone,
      manageUrl: `${appUrl}/cita/${a.manageToken}`,
    });

    if (results.some((r) => r.ok)) sent++;
    else {
      // Ningún canal funcionó: liberamos la cita para reintentar en la próxima pasada.
      await db.appointment.update({ where: { id: a.id }, data: { reminderSentAt: null } });
      failures.push({ id: a.id, detail: results.map((r) => r.detail).join(" | ") });
    }
  }

  return Response.json({ checked: candidates.length, due: due.length, sent, failures });
}
