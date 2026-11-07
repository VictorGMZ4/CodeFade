// Negocio de ejemplo para producción: /b/demo ("Estudio Lumen").
// Sin cuentas de acceso ni teléfonos de profesionales, y marcado como demo
// para que sus reservas no envíen recordatorios ni avisos reales.
// Uso: npm run db:seed-demo  (con DATABASE_URL apuntando a la base de producción)
// Es idempotente: si el negocio ya existe, no lo toca.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: Number(process.env.DATABASE_POOL_MAX ?? 2) }),
});

const HOURS = [1, 2, 3, 4, 5, 6].flatMap((weekday) => [
  { weekday, startMin: 9 * 60, endMin: 13 * 60 },
  { weekday, startMin: 14 * 60, endMin: 19 * 60 },
]);

async function main() {
  const existing = await db.shop.findUnique({ where: { slug: "demo" }, select: { id: true, isDemo: true } });
  if (existing) {
    console.log(existing.isDemo ? "El negocio demo ya existe; no se cambia nada." : "Ya existe un negocio con el enlace /b/demo que NO es demo; no se toca.");
    return;
  }

  await db.shop.create({
    data: {
      slug: "demo",
      name: "Estudio Lumen",
      businessType: "OTRO",
      isDemo: true,
      timezone: "America/Bogota",
      currency: "COP",
      countryCode: "57",
      address: "Negocio de ejemplo",
      services: {
        create: [
          { name: "Corte y peinado", durationMin: 45, priceCents: 3500000 },
          { name: "Manicure", durationMin: 40, priceCents: 2500000 },
          { name: "Arreglo de barba", durationMin: 20, priceCents: 1800000 },
          { name: "Limpieza facial", durationMin: 60, priceCents: 6000000 },
        ],
      },
      barbers: {
        create: ["Ana", "Sofía", "Andrés"].map((name) => ({ name, workingHours: { create: HOURS } })),
      },
    },
  });
  console.log("Negocio demo creado en /b/demo.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
