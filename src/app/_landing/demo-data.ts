// Datos del negocio de ejemplo que muestran los fragmentos de la portada.
// No consultan la base de datos: la portada es estática.

export const DEMO_SHOP = "Barbería El Bigote";

export type DemoService = { id: string; name: string; minutes: number; price: number };
export type DemoPro = { id: string; name: string };

export const DEMO_SERVICES: DemoService[] = [
  { id: "corte", name: "Corte clásico", minutes: 30, price: 25000 },
  { id: "barba", name: "Corte + barba", minutes: 50, price: 40000 },
  { id: "arreglo", name: "Arreglo de barba", minutes: 20, price: 18000 },
];

export const DEMO_PROS: DemoPro[] = [
  { id: "andres", name: "Andrés" },
  { id: "camilo", name: "Camilo" },
];

/** Bogotá no cambia de hora: siempre UTC−5. */
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Antelación mínima para reservar, como en un negocio real. */
const LEAD_MINUTES = 60;
/** Franjas de trabajo en minutos desde medianoche: mañana y tarde, con almuerzo de 13:00 a 14:00. */
const SHIFTS: [number, number][] = [[9 * 60, 13 * 60], [14 * 60, 19 * 60]];
const STEP_MINUTES = 30;
const DAYS_SHOWN = 5;

/** `pros[i]` es el profesional libre a la hora `slots[i]` (el primero que lo esté). */
export type DemoDay = { key: string; label: string; long: string; slots: number[]; pros: number[] };

const priceFormat = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
export const formatPrice = (pesos: number) => priceFormat.format(pesos);

export const formatTime = (minutes: number) =>
  `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;

const weekday = new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", timeZone: "UTC" });
const longDate = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** Algunas horas ya ocupadas, siempre las mismas para el mismo día y profesional. */
function isTaken(dayNumber: number, slotIndex: number, proIndex: number) {
  return (dayNumber * 7 + slotIndex * 3 + proIndex * 5) % 5 === 0;
}

function slotsFor(dayNumber: number, minutesNow: number | null, proIndexes: number[], length: number) {
  const slots: number[] = [];
  const pros: number[] = [];
  let index = 0;
  for (const [start, end] of SHIFTS) {
    for (let t = start; t + length <= end; t += STEP_MINUTES, index++) {
      if (minutesNow !== null && t < minutesNow + LEAD_MINUTES) continue;
      const pro = proIndexes.find((p) => !isTaken(dayNumber, index, p));
      if (pro === undefined) continue;
      slots.push(t);
      pros.push(pro);
    }
  }
  return { slots, pros };
}

/**
 * Los próximos días con horas libres, contados desde la hora real de Bogotá
 * del visitante: el domingo está cerrado y hoy solo muestra horas futuras.
 */
export function openDays(nowMs: number, proId: string | null, minutes: number): DemoDay[] {
  const local = new Date(nowMs - BOGOTA_OFFSET_MS);
  const today = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const minutesNow = local.getUTCHours() * 60 + local.getUTCMinutes();
  const pros = proId ? [DEMO_PROS.findIndex((p) => p.id === proId)] : DEMO_PROS.map((_, i) => i);
  const days: DemoDay[] = [];
  for (let offset = 0; days.length < DAYS_SHOWN && offset < 14; offset++) {
    const date = new Date(today + offset * DAY_MS);
    if (date.getUTCDay() === 0) continue;
    const dayNumber = Math.floor(date.getTime() / DAY_MS);
    const free = slotsFor(dayNumber, offset === 0 ? minutesNow : null, pros, minutes);
    if (free.slots.length === 0) continue;
    days.push({ key: date.toISOString().slice(0, 10), label: weekday.format(date), long: longDate.format(date), ...free });
  }
  return days;
}

/** Línea de servicios que escribe el dueño: «Corte clásico, 30 min, 25000». */
export function parseServiceLine(line: string): DemoService | null {
  const parts = line.split(",").map((p) => p.trim());
  const name = parts[0];
  if (!name) return null;
  const minutes = Number((parts[1] ?? "").replace(/\D/g, ""));
  const price = Number((parts[2] ?? "").replace(/\D/g, ""));
  return {
    id: name,
    name: name.slice(0, 40),
    minutes: minutes > 0 && minutes <= 480 ? minutes : 30,
    price: price > 0 && price < 100_000_000 ? price : 0,
  };
}
