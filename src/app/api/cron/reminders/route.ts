import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { sendReminder } from "@/lib/notify";
import { Prisma } from "@/generated/prisma/client";

// Llamar cada 10-15 minutos desde un cron (Vercel Cron, GitHub Actions, cron-job.org...)
// con la cabecera  Authorization: Bearer <CRON_SECRET>.

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  // Sin secreto, o con el de ejemplo, el cron no se puede llamar.
  if (!secret || secret.length < 16 || secret === "cambia-esto") return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function GET(request: Request) {
  if (!authorized(request)) return new Response("No autorizado", { status: 401 });

  const now = new Date();
  // Filtrar antes del límite evita que las citas de otros negocios oculten
  // recordatorios que ya corresponden según la antelación de cada negocio.
  const ids = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT a.id FROM "Appointment" a
    JOIN "Shop" s ON s.id = a."shopId"
    WHERE a.status = 'BOOKED' AND a.source = 'ONLINE'
      AND a."reminderSentAt" IS NULL AND s."isDemo" = false
      AND a."startsAt" > ${now}
      AND a."startsAt" <= ${now} + s."reminderHours" * interval '1 hour'
    ORDER BY a."startsAt" LIMIT 200
  `);
  const candidates = await db.appointment.findMany({
    where: { id: { in: ids.map(({ id }) => id) } },
    include: { shop: true, customer: true, service: true, barber: true },
    orderBy: { startsAt: "asc" },
  });

  const appUrl = process.env.APP_URL ?? new URL(request.url).origin;
  let sent = 0;
  const failures: { id: string; detail?: string }[] = [];

  for (const a of candidates) {
    try {
      // Marcamos antes de enviar: si dos crons coinciden, solo uno gana la fila.
      const claimed = await db.appointment.updateMany({
        where: { id: a.id, reminderSentAt: null, status: "BOOKED", source: "ONLINE" },
        data: { reminderSentAt: now },
      });
      if (claimed.count === 0) continue;

      const results = await sendReminder({
        customerName: a.customer.name,
        customerPhone: a.customer.phone,
        // Las citas nuevas usan el correo escrito al reservar; las antiguas, el del cliente.
        customerEmail: a.contactEmail ?? a.customer.email,
        shopName: a.shop.name,
        shopAddress: a.shop.address,
        serviceName: a.service.name,
        barberName: a.barber.name,
        startsAt: a.startsAt,
        timezone: a.shop.timezone,
        manageUrl: `${appUrl}/cita/${a.manageToken}`,
      });

      if (results.some((r) => r.ok)) sent++;
      else throw new Error(results.map((r) => r.detail).join(" | ") || "Ningún canal pudo enviar el recordatorio.");
    } catch (error) {
      let detail = error instanceof Error ? error.message : String(error);
      try {
        // Solo liberamos la marca de esta pasada, nunca la de otro cron.
        await db.appointment.updateMany({ where: { id: a.id, reminderSentAt: now }, data: { reminderSentAt: null } });
      } catch {
        detail += " | No se pudo liberar el recordatorio para reintentar.";
      }
      failures.push({ id: a.id, detail });
    }
  }

  // La limpieza va aparte: si falla, los recordatorios ya se enviaron.
  let cleaned: Record<string, number> | { error: string };
  try {
    cleaned = await cleanupOldRows(now);
  } catch (error) {
    console.error("[cron] No se pudo limpiar registros antiguos.", error);
    cleaned = { error: "No se pudo limpiar" };
  }

  return Response.json({ checked: candidates.length, due: candidates.length, sent, failures, cleaned });
}

const CLEANUP_BATCH = 5000;
/** Tope de lotes por tabla y ejecución: lo que quede se borra en la siguiente. */
const CLEANUP_MAX_BATCHES = 10;

/** Repite un borrado por lotes mientras llene el lote, hasta el tope. */
async function deleteInBatches(run: () => Promise<number>) {
  let total = 0;
  for (let i = 0; i < CLEANUP_MAX_BATCHES; i++) {
    const deleted = await run();
    total += deleted;
    if (deleted < CLEANUP_BATCH) break;
  }
  return total;
}

/**
 * Borra, por lotes, filas que ya no sirven y que crecerían sin límite:
 * intentos con más de 24 h, enlaces de recuperación caducados hace más de
 * 7 días y avisos leídos hace más de 90 días.
 */
async function cleanupOldRows(now: Date) {
  const hours = (n: number) => new Date(now.getTime() - n * 3_600_000);
  const rateLimitHits = await deleteInBatches(() => db.$executeRaw(Prisma.sql`
    DELETE FROM "RateLimitHit" WHERE id IN (
      SELECT id FROM "RateLimitHit" WHERE "createdAt" < ${hours(24)} LIMIT ${CLEANUP_BATCH}
    )`));
  const resetTokens = await deleteInBatches(() => db.$executeRaw(Prisma.sql`
    DELETE FROM "PasswordResetToken" WHERE id IN (
      SELECT id FROM "PasswordResetToken" WHERE "expiresAt" < ${hours(24 * 7)} LIMIT ${CLEANUP_BATCH}
    )`));
  const notifications = await deleteInBatches(() => db.$executeRaw(Prisma.sql`
    DELETE FROM "Notification" WHERE id IN (
      SELECT id FROM "Notification" WHERE "readAt" < ${hours(24 * 90)} LIMIT ${CLEANUP_BATCH}
    )`));
  return { rateLimitHits, resetTokens, notifications };
}
