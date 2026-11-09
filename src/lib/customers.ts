import "server-only";
import { notFound } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

type Context = { shop: { id: string }; isOwner: boolean; barberId: string | null };

export function customerWhere(context: Context): Prisma.CustomerWhereInput {
  return {
    shopId: context.shop.id,
    ...(!context.isOwner ? { appointments: { some: { shopId: context.shop.id, barberId: context.barberId ?? "" } } } : {}),
  };
}

export async function requireCustomer(context: Context, id: string) {
  if (!context.isOwner && !context.barberId) notFound();
  const customer = await db.customer.findFirst({ where: { ...customerWhere(context), id } });
  if (!customer) notFound();
  return customer;
}

type CustomerRow = { id: string; name: string; phone: string | null; visits: number; noShows: number; lastVisit: Date | null };

export async function listCustomers(context: Context, q: string, page: number) {
  if (!context.isOwner && !context.barberId) return [];
  // Primero se pagina (ordenando por la última cita, que sale del índice por
  // cliente) y solo después se cuentan las visitas de esas 51 filas; la fila
  // extra indica si hay otra página. Escapamos comodines para buscar el texto
  // literal escrito por el usuario.
  const term = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const barberFilter = context.isOwner ? Prisma.empty : Prisma.sql`AND a."barberId" = ${context.barberId}`;
  return db.$queryRaw<CustomerRow[]>(Prisma.sql`
    SELECT c.id, c.name, c.phone, s.visits, s."noShows", s."lastVisit"
    FROM (
      SELECT c.id, c.name, c.phone, c."shopId", l.last
      FROM "Customer" c
      LEFT JOIN LATERAL (
        SELECT MAX(a."startsAt") AS last FROM "Appointment" a
        WHERE a."customerId" = c.id AND a."shopId" = c."shopId" ${barberFilter}
      ) l ON true
      WHERE c."shopId" = ${context.shop.id}
        AND (c.name ILIKE ${term} OR c.phone ILIKE ${term})
        ${context.isOwner ? Prisma.empty : Prisma.sql`AND l.last IS NOT NULL`}
      ORDER BY l.last DESC NULLS LAST, c.id ASC
      LIMIT 51 OFFSET ${(page - 1) * 50}
    ) c
    CROSS JOIN LATERAL (
      SELECT COUNT(*) FILTER (WHERE a.status = 'COMPLETED')::int AS visits,
        COUNT(*) FILTER (WHERE a.status = 'NO_SHOW')::int AS "noShows",
        MAX(a."startsAt") FILTER (WHERE a.status = 'COMPLETED') AS "lastVisit"
      FROM "Appointment" a
      WHERE a."customerId" = c.id AND a."shopId" = c."shopId" ${barberFilter}
    ) s
    ORDER BY c.last DESC NULLS LAST, c.id ASC
  `);
}

export async function customerDetails(context: Context, id: string) {
  const customer = await requireCustomer(context, id);
  const where = { shopId: context.shop.id, customerId: id, ...(!context.isOwner ? { barberId: context.barberId! } : {}) };
  const statuses = await db.appointment.groupBy({ by: ["status"], where, _count: { _all: true }, _sum: { priceCents: true } });
  const dates = await db.appointment.aggregate({ where, _min: { startsAt: true }, _count: true });
  const regular = await db.appointment.groupBy({
    by: ["barberId"], where: { ...where, status: "COMPLETED" }, _count: { _all: true },
    orderBy: [{ _count: { barberId: "desc" } }, { barberId: "asc" }], take: 1,
  });
  const barber = regular[0] ? await db.barber.findFirst({ where: { id: regular[0].barberId, shopId: context.shop.id }, select: { name: true } }) : null;
  const appointments = await db.appointment.findMany({ where, include: { service: true, barber: true }, orderBy: [{ startsAt: "desc" }, { id: "asc" }], take: 50 });
  return { customer, statuses, dates, barber, appointments };
}
