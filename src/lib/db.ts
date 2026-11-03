import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  // `prisma dev` (PGlite) solo admite una conexión: en local DATABASE_POOL_MAX=1.
  const max = Number(process.env.DATABASE_POOL_MAX) || undefined;
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, max });
  return new PrismaClient({ adapter });
}

// En desarrollo el hot reload recrea los módulos; reutilizamos el cliente
// para no abrir una conexión nueva en cada recarga.
export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/** true si Postgres rechazó la cita por solaparse con otra (restricción de exclusión). */
export function isOverlapError(error: unknown): boolean {
  const text = JSON.stringify(error, Object.getOwnPropertyNames(error ?? {})) + String(error);
  return text.includes("23P01") || text.includes("Appointment_no_overlap");
}
