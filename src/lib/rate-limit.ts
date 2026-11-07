import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db";

export const RATE_LIMIT_MESSAGE = "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";

export async function clientIp(): Promise<string> {
  const requestHeaders = await headers();
  return requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    || requestHeaders.get("x-real-ip")?.trim() || "desconocida";
}

export async function isLimited(key: string, limit: number, windowMs: number): Promise<boolean> {
  const count = await db.rateLimitHit.count({ where: { key, createdAt: { gte: new Date(Date.now() - windowMs) } } });
  return count >= limit;
}

export async function recordHit(key: string): Promise<void> {
  await db.rateLimitHit.create({ data: { key } });
  // Limpieza oportunista; un fallo de limpieza no altera el resultado del formulario.
  if (Math.random() < 0.01) {
    await db.rateLimitHit.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
      .catch(() => console.error("No se pudieron limpiar los intentos antiguos."));
  }
}
