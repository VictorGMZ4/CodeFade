import "server-only";
import { db } from "@/lib/db";
import { addDaysToDay, localDay, localToUtc, weekdayOf } from "@/lib/time";

type ShopRules = {
  id: string;
  timezone: string;
  slotMinutes: number;
  leadTimeMinutes: number;
  bookingWindowDays: number;
};

export type Slot = {
  /** Instante UTC en ISO */
  start: string;
  /** Barberos libres a esa hora */
  barberIds: string[];
};

/** Duración máxima de un servicio (igual que la validación de servicios del panel). */
export const MAX_SERVICE_MINUTES = 480;
/** Duración máxima de una ausencia (igual que la validación de ausencias del panel). */
export const MAX_TIME_OFF_DAYS = 366;

export type SlotOptions = { ignoreLeadTime?: boolean; windowDays?: number };

/** Primer y último día local reservables según las reglas de la barbería. */
export function bookableRange(shop: ShopRules, now = new Date()) {
  const first = localDay(new Date(now.getTime() + shop.leadTimeMinutes * 60_000), shop.timezone);
  const last = addDaysToDay(localDay(now, shop.timezone), shop.bookingWindowDays, shop.timezone);
  return { first, last };
}

/** Días reservables a partir de hoy, como mucho `limit`. */
export function bookableDays(shop: ShopRules, limit: number, now = new Date()) {
  const { first, last } = bookableRange(shop, now);
  const days: string[] = [];
  for (let d = first; d <= last && days.length < limit; d = addDaysToDay(d, 1, shop.timezone)) days.push(d);
  return days;
}

/**
 * Turnos libres de varios días para un servicio de `durationMin` minutos.
 * Un turno es válido si cabe entero dentro de una franja de trabajo del
 * barbero y no se cruza con citas activas ni ausencias. Hace tres consultas
 * en total, sin importar cuántos días se pidan.
 */
export async function getSlots(
  shop: ShopRules,
  days: string[],
  durationMin: number,
  barberIds: string[],
  now = new Date(),
  options: SlotOptions = {},
): Promise<Map<string, Slot[]>> {
  const result = new Map<string, Slot[]>();
  const rules = { ...shop, leadTimeMinutes: options.ignoreLeadTime ? 0 : shop.leadTimeMinutes, bookingWindowDays: options.windowDays ?? shop.bookingWindowDays };
  const { first, last } = bookableRange(rules, now);
  const valid = [...new Set(days)].filter((d) => d >= first && d <= last).sort();
  if (barberIds.length === 0 || valid.length === 0) return result;

  const rangeStart = localToUtc(valid[0], 0, shop.timezone);
  const rangeEnd = localToUtc(addDaysToDay(valid.at(-1)!, 1, shop.timezone), 0, shop.timezone);

  const [hours, appointments, timeOff] = await Promise.all([
    db.workingHours.findMany({ where: { barberId: { in: barberIds } }, orderBy: { startMin: "asc" } }),
    db.appointment.findMany({
      where: {
        barberId: { in: barberIds },
        status: "BOOKED",
        // Ninguna cita dura más que el servicio más largo permitido: con esta
        // cota el índice (barberId, startsAt) no recorre todo el historial.
        startsAt: { gte: new Date(rangeStart.getTime() - MAX_SERVICE_MINUTES * 60_000), lt: rangeEnd },
        endsAt: { gt: rangeStart },
      },
      select: { barberId: true, startsAt: true, endsAt: true },
    }),
    db.timeOff.findMany({
      where: {
        barberId: { in: barberIds },
        startsAt: { gte: new Date(rangeStart.getTime() - MAX_TIME_OFF_DAYS * 86_400_000), lt: rangeEnd },
        endsAt: { gt: rangeStart },
      },
      select: { barberId: true, startsAt: true, endsAt: true },
    }),
  ]);

  const busy = new Map<string, { start: number; end: number }[]>();
  for (const b of [...appointments, ...timeOff]) {
    const list = busy.get(b.barberId) ?? [];
    list.push({ start: b.startsAt.getTime(), end: b.endsAt.getTime() });
    busy.set(b.barberId, list);
  }

  const earliest = now.getTime() + rules.leadTimeMinutes * 60_000;
  const durationMs = durationMin * 60_000;

  for (const day of valid) {
    const weekday = weekdayOf(day, shop.timezone);
    const byStart = new Map<number, string[]>();

    for (const h of hours) {
      if (h.weekday !== weekday) continue;
      for (let m = h.startMin; m + durationMin <= h.endMin; m += shop.slotMinutes) {
        const start = localToUtc(day, m, shop.timezone).getTime();
        const end = start + durationMs;
        if (start < earliest) continue;
        if (busy.get(h.barberId)?.some((b) => b.start < end && b.end > start)) continue;
        const list = byStart.get(start) ?? [];
        if (!list.includes(h.barberId)) list.push(h.barberId);
        byStart.set(start, list);
      }
    }

    result.set(
      day,
      [...byStart.entries()]
        .sort(([a], [b]) => a - b)
        .map(([start, ids]) => ({ start: new Date(start).toISOString(), barberIds: ids })),
    );
  }
  return result;
}

export async function getDaySlots(
  shop: ShopRules,
  day: string,
  durationMin: number,
  barberIds: string[],
  now = new Date(),
  options: SlotOptions = {},
): Promise<Slot[]> {
  return (await getSlots(shop, [day], durationMin, barberIds, now, options)).get(day) ?? [];
}
