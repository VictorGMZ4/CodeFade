import { TZDate } from "@date-fns/tz";
import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";

// Todas las fechas se guardan en UTC y se interpretan en la zona de la barbería.

export const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/** "2026-11-03" + 570 minutos → instante UTC de las 9:30 locales de ese día. */
export function localToUtc(day: string, minutes: number, timezone: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(new TZDate(y, m - 1, d, 0, minutes, 0, timezone).getTime());
}

export function inZone(date: Date, timezone: string) {
  return new TZDate(date, timezone);
}

/** Día local ("yyyy-MM-dd") de un instante. */
export function localDay(date: Date, timezone: string) {
  return format(inZone(date, timezone), "yyyy-MM-dd");
}

export function weekdayOf(day: string, timezone: string) {
  return inZone(localToUtc(day, 0, timezone), timezone).getDay();
}

export function addDaysToDay(day: string, n: number, timezone: string) {
  return format(addDays(inZone(localToUtc(day, 0, timezone), timezone), n), "yyyy-MM-dd");
}

export function isValidDay(day: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(day));
}

export function formatTime(date: Date, timezone: string) {
  return format(inZone(date, timezone), "HH:mm");
}

export function formatDayLong(date: Date, timezone: string) {
  return format(inZone(date, timezone), "EEEE d 'de' MMMM", { locale: es });
}

export function formatDayShort(date: Date, timezone: string) {
  return format(inZone(date, timezone), "EEE d MMM", { locale: es });
}

/** 570 → "09:30" */
export function minutesToHHMM(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "09:30" → 570. Devuelve null si el formato no es válido. */
export function hhmmToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 24 || m > 59 || (h === 24 && m > 0)) return null;
  return h * 60 + m;
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
