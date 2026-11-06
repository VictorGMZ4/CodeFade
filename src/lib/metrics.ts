import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { addDaysToDay, localDay, localToUtc, weekdayOf } from "@/lib/time";

type Context = { shop: { id: string; timezone: string }; isOwner: boolean; barberId: string | null };
export type MetricsParams = { periodo?: string; desde?: string; hasta?: string; barbero?: string };
export function metricsBarber(context: Pick<Context, "isOwner" | "barberId">, requested?: string) {
  return context.isOwner ? requested || null : context.barberId ?? "";
}
function dateRange(from: string, to: string, timezone: string) {
  return { from, to, start: localToUtc(from, 0, timezone), end: localToUtc(addDaysToDay(to, 1, timezone), 0, timezone) };
}
export function resolvePeriod(params: MetricsParams, timezone: string, now = new Date()) {
  const today = localDay(now, timezone);
  const period = ["hoy", "semana", "mes", "rango"].includes(params.periodo ?? "") ? params.periodo! : "mes";
  let from = today, to = today;
  if (period === "semana") {
    from = addDaysToDay(today, -((weekdayOf(today, timezone) + 6) % 7), timezone);
    to = addDaysToDay(from, 6, timezone);
  } else if (period === "mes") {
    from = today.slice(0, 7) + "-01";
    to = addDaysToDay(addDaysToDay(from, 32, timezone).slice(0, 7) + "-01", -1, timezone);
  } else if (period === "rango") {
    from = params.desde ?? ""; to = params.hasta ?? "";
    for (const day of [from, to]) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < "1900-01-01" || day > "9998-12-31" || Number.isNaN(Date.parse(day)) || new Date(day).toISOString().slice(0, 10) !== day) throw new Error("Introduce fechas válidas para el rango.");
    }
    if (from > to) throw new Error("La fecha desde no puede ser posterior a hasta.");
  }
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  if (days > 366) throw new Error("El rango no puede superar 366 días.");
  return { period, days, ...dateRange(from, to, timezone), previous: dateRange(addDaysToDay(from, -days, timezone), addDaysToDay(from, -1, timezone), timezone) };
}
export function percentage(value: number, total: number) { return total > 0 ? `${Math.round(value / total * 100)}%` : "—"; }
export function occupancy(minutes: number, available: number) { return available > 0 ? minutes / available * 100 : null; }
export function comparison(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) return "—";
  const change = (current - previous) / previous * 100;
  return `${change < 0 ? "▼" : "▲"} ${Math.round(Math.abs(change))}%`;
}
export function bucketDay(day: string, days: number, timezone: string) {
  return days > 62 ? addDaysToDay(day, -((weekdayOf(day, timezone) + 6) % 7), timezone) : day;
}
type Hours = { barberId: string; weekday: number; startMin: number; endMin: number };
type Off = { barberId: string; startsAt: Date; endsAt: Date };
export function workingMinutes(from: string, to: string, timezone: string, hours: Hours[], off: Off[]) {
  let minutes = 0;
  for (let day = from; day <= to; day = addDaysToDay(day, 1, timezone)) {
    for (const h of hours.filter(h => h.weekday === weekdayOf(day, timezone))) {
      const start = localToUtc(day, h.startMin, timezone).getTime();
      const end = localToUtc(day, h.endMin, timezone).getTime();
      const absences = off.filter(o => o.barberId === h.barberId).map(o => [Math.max(start, o.startsAt.getTime()), Math.min(end, o.endsAt.getTime())]).filter(([a, b]) => a < b).sort((a, b) => a[0] - b[0]);
      let removed = 0, cursor = start;
      // Unimos ausencias solapadas para no descontarlas dos veces.
      for (const [a, b] of absences) { removed += Math.max(0, b - Math.max(a, cursor)); cursor = Math.max(cursor, b); }
      minutes += (end - start - removed) / 60000;
    }
  }
  return minutes;
}
type Summary = { reservations: number; online: number; manual: number; completed: number; booked: number; noShow: number; cancelled: number; total: number; revenue: number; expected: number; minutes: number; customers: number; newCustomers: number };
type Daily = { day: string; completed: number; booked: number; noShow: number };
export async function getMetrics(context: Context, params: MetricsParams, period: ReturnType<typeof resolvePeriod>) {
  const barberId = metricsBarber(context, params.barbero);
  if (barberId === "") throw new Error("Tu cuenta no está vinculada a ningún profesional. Pídeselo al dueño.");
  const scope = Prisma.sql`a."shopId" = ${context.shop.id} ${barberId === null ? Prisma.empty : Prisma.sql`AND a."barberId" = ${barberId}`}`;
  const selected = { shopId: context.shop.id, ...(barberId === null ? {} : { id: barberId }) };
  const barbers = await db.barber.findMany({ where: selected, select: { id: true, name: true, active: true, workingHours: true }, orderBy: { name: "asc" } });
  const off = await db.timeOff.findMany({ where: { barber: { ...selected, active: true }, startsAt: { lt: period.end }, endsAt: { gt: period.previous.start } }, select: { barberId: true, startsAt: true, endsAt: true } });
  const hours = barbers.filter(b => b.active).flatMap(b => b.workingHours);
  async function summarize(range: ReturnType<typeof dateRange>) {
    const [row] = await db.$queryRaw<Summary[]>(Prisma.sql`
      WITH scoped AS (SELECT a.* FROM "Appointment" a WHERE ${scope}),
      first_visits AS (SELECT "customerId", MIN("startsAt") AS first FROM scoped WHERE status <> 'CANCELLED' GROUP BY "customerId")
      SELECT COUNT(*) FILTER (WHERE status <> 'CANCELLED')::int AS reservations,
        COUNT(*) FILTER (WHERE status <> 'CANCELLED' AND source = 'ONLINE')::int AS online,
        COUNT(*) FILTER (WHERE status <> 'CANCELLED' AND source = 'MANUAL')::int AS manual,
        COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
        COUNT(*) FILTER (WHERE status = 'BOOKED')::int AS booked,
        COUNT(*) FILTER (WHERE status = 'NO_SHOW')::int AS "noShow",
        COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled, COUNT(*)::int AS total,
        COALESCE(SUM("priceCents") FILTER (WHERE status = 'COMPLETED'), 0)::float8 AS revenue,
        COALESCE(SUM("priceCents") FILTER (WHERE status = 'BOOKED'), 0)::float8 AS expected,
        COALESCE(SUM(EXTRACT(EPOCH FROM ("endsAt" - "startsAt")) / 60) FILTER (WHERE status IN ('BOOKED', 'COMPLETED')), 0)::float8 AS minutes,
        COUNT(DISTINCT a."customerId") FILTER (WHERE status <> 'CANCELLED')::int AS customers,
        COUNT(DISTINCT a."customerId") FILTER (WHERE status <> 'CANCELLED' AND f.first >= ${range.start} AND f.first < ${range.end})::int AS "newCustomers"
      FROM scoped a LEFT JOIN first_visits f ON f."customerId" = a."customerId"
      WHERE a."startsAt" >= ${range.start} AND a."startsAt" < ${range.end}
    `);
    const available = workingMinutes(range.from, range.to, context.shop.timezone, hours, off);
    return { ...row, available, occupancy: occupancy(row.minutes, available) };
  }
  // Consultas secuenciales: PGlite local dispone de una única conexión.
  const current = await summarize(period);
  const previous = await summarize(period.previous);
  const inPeriod = Prisma.sql`${scope} AND a."startsAt" >= ${period.start} AND a."startsAt" < ${period.end}`;
  // Prisma guarda timestamp sin zona en UTC; primero lo interpretamos como UTC.
  const localStart = Prisma.sql`(a."startsAt" AT TIME ZONE 'UTC' AT TIME ZONE ${context.shop.timezone})`;
  const daily = await db.$queryRaw<Daily[]>(Prisma.sql`
    SELECT to_char(date_trunc(${period.days > 62 ? "week" : "day"}, ${localStart}), 'YYYY-MM-DD') AS day,
      COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
      COUNT(*) FILTER (WHERE status = 'BOOKED')::int AS booked,
      COUNT(*) FILTER (WHERE status = 'NO_SHOW')::int AS "noShow"
    FROM "Appointment" a WHERE ${inPeriod} AND status <> 'CANCELLED' GROUP BY 1 ORDER BY 1
  `);
  const buckets = new Map(daily.map(row => [row.day, row]));
  for (let day = period.from; day <= period.to; day = addDaysToDay(day, 1, context.shop.timezone)) {
    const key = bucketDay(day, period.days, context.shop.timezone);
    if (!buckets.has(key)) buckets.set(key, { day: key, completed: 0, booked: 0, noShow: 0 });
  }
  const revenue = await db.$queryRaw<{ id: string; revenue: number }[]>(Prisma.sql`
    SELECT a."barberId" AS id, COALESCE(SUM(a."priceCents") FILTER (WHERE status = 'COMPLETED'), 0)::float8 AS revenue
    FROM "Appointment" a WHERE ${inPeriod} GROUP BY a."barberId"
  `);
  const services = await db.$queryRaw<{ id: string; name: string; count: number; revenue: number }[]>(Prisma.sql`
    SELECT s.id, s.name, COUNT(*)::int AS count,
      COALESCE(SUM(a."priceCents") FILTER (WHERE a.status = 'COMPLETED'), 0)::float8 AS revenue
    FROM "Appointment" a JOIN "Service" s ON s.id = a."serviceId" AND s."shopId" = a."shopId"
    WHERE ${inPeriod} AND a.status <> 'CANCELLED' GROUP BY s.id, s.name ORDER BY count DESC, s.name, s.id LIMIT 5
  `);
  const hourly = await db.$queryRaw<{ hour: number; count: number }[]>(Prisma.sql`
    SELECT EXTRACT(HOUR FROM ${localStart})::int AS hour, COUNT(*)::int AS count
    FROM "Appointment" a WHERE ${inPeriod} AND a.status <> 'CANCELLED' GROUP BY 1 ORDER BY 1
  `);
  return { current, previous, daily: [...buckets.values()].sort((a, b) => a.day.localeCompare(b.day)),
    revenue: barbers.map(b => ({ id: b.id, name: b.name, revenue: revenue.find(r => r.id === b.id)?.revenue ?? 0 })).sort((a, b) => b.revenue - a.revenue), services, hourly };
}
