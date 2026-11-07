// Cada país escribe el precio a su manera: "$ 25.000" en Colombia, "$25,000" en México.
const LOCALE_BY_CURRENCY: Record<string, string> = {
  COP: "es-CO",
  MXN: "es-MX",
  ARS: "es-AR",
  CLP: "es-CL",
  PEN: "es-PE",
  DOP: "es-DO",
  EUR: "es-ES",
};

/** Formatea un precio guardado en unidad mínima (centavos). */
export function formatPrice(cents: number, currency: string) {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat(LOCALE_BY_CURRENCY[currency] ?? "es-419", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}

/** "25.000" o "25000,50" → 2500000 / 2500050. null si no es un número válido. */
export function parsePrice(value: string): number | null {
  const clean = value.replace(/[^\d.,]/g, "");
  if (!clean) return null;
  // Último separador con 1-2 dígitos detrás = decimales; el resto son miles.
  const match = /^(.*?)[.,](\d{1,2})$/.exec(clean);
  const integer = (match ? match[1] : clean).replace(/[.,]/g, "");
  const decimals = match ? match[2].padEnd(2, "0") : "00";
  const cents = Number(integer || "0") * 100 + Number(decimals);
  return Number.isSafeInteger(cents) ? cents : null;
}

/**
 * Normaliza un teléfono a E.164 sin espacios. Si el número no trae prefijo
 * internacional se usa el del país de la barbería.
 */
export function normalizePhone(raw: string, countryCode: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  let full: string;
  if (trimmed.startsWith("+")) full = digits;
  else if (digits.startsWith("00")) full = digits.slice(2);
  else if (digits.startsWith(countryCode) && digits.length > 10) full = digits;
  else full = countryCode + digits.replace(/^0+/, "");
  return full.length >= 8 && full.length <= 15 ? `+${full}` : null;
}

export function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * WhatsApp obligatorio de un profesional: ahí recibe los avisos de reservas.
 * Devuelve el número en E.164 o el mensaje de error para el formulario.
 */
export function parseWhatsApp(raw: unknown, countryCode: string): { phone: string } | { error: string } {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return { error: "Escribe el WhatsApp donde recibirá los avisos de reservas." };
  const phone = normalizePhone(value, countryCode);
  return phone ? { phone } : { error: "Número no válido." };
}
