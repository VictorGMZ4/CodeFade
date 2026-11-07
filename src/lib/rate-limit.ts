import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db";

export const RATE_LIMIT_MESSAGE = "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";

/**
 * IP del visitante. En Vercel `x-forwarded-for` la fija la plataforma (no se
 * puede falsificar desde el navegador); fuera de Vercel hay que asegurarse de
 * que el proxy de delante la sobrescriba.
 */
export async function clientIp(): Promise<string> {
  const requestHeaders = await headers();
  return requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    || requestHeaders.get("x-real-ip")?.trim() || "desconocida";
}

/**
 * Gasta un intento: primero lo registra y después cuenta. Como cada petición
 * cuenta después de registrar el suyo, peticiones simultáneas no pueden pasar
 * todas a la vez: como mucho `limit` dentro de la ventana.
 * Devuelve el id del intento para poder devolverlo con `release` (p. ej. si el
 * ingreso fue correcto y solo deben contar los fallos).
 */
export async function consume(key: string, limit: number, windowMs: number): Promise<{ limited: boolean; id: string }> {
  const hit = await db.rateLimitHit.create({ data: { key }, select: { id: true } });
  const count = await db.rateLimitHit.count({ where: { key, createdAt: { gte: new Date(Date.now() - windowMs) } } });
  // Limpieza oportunista; un fallo de limpieza no altera el resultado del formulario.
  if (Math.random() < 0.01) {
    await db.rateLimitHit.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
      .catch(() => console.error("No se pudieron limpiar los intentos antiguos."));
  }
  return { limited: count > limit, id: hit.id };
}

/** Devuelve intentos gastados con `consume` (no cuentan para el límite). */
export async function release(...ids: string[]): Promise<void> {
  await db.rateLimitHit.deleteMany({ where: { id: { in: ids } } });
}
