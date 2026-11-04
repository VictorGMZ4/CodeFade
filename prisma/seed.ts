// Datos de ejemplo: barbería "demo" con dos barberos, servicios y algunas citas.
// Cuentas: demo@codefade.test y camilo@codefade.test / demo1234
import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { TZDate } from "@date-fns/tz";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const TZ = "America/Bogota";

const HOURS = [1, 2, 3, 4, 5, 6].flatMap((weekday) => [
  { weekday, startMin: 9 * 60, endMin: 13 * 60 },
  { weekday, startMin: 14 * 60, endMin: 19 * 60 },
]);

async function main() {
  await db.shop.deleteMany({ where: { slug: "demo" } });
  await db.user.deleteMany({ where: { email: { in: ["demo@codefade.test", "camilo@codefade.test"] } } });

  const user = await db.user.create({
    data: { email: "demo@codefade.test", name: "Andrés", passwordHash: await bcrypt.hash("demo1234", 12) },
  });

  const staff = await db.user.create({
    data: { email: "camilo@codefade.test", name: "Camilo", passwordHash: await bcrypt.hash("demo1234", 12), mustChangePassword: false },
  });

  const shop = await db.shop.create({
    data: {
      slug: "demo",
      name: "Barbería El Bigote",
      timezone: TZ,
      currency: "COP",
      countryCode: "57",
      phone: "+57 300 123 4567",
      address: "Cra. 7 #45-12, Bogotá",
      memberships: { create: [{ userId: user.id, role: "OWNER" }, { userId: staff.id, role: "STAFF" }] },
      services: {
        create: [
          { name: "Corte clásico", durationMin: 30, priceCents: 2500000 },
          { name: "Corte + barba", durationMin: 50, priceCents: 4000000 },
          { name: "Arreglo de barba", durationMin: 20, priceCents: 1800000 },
          { name: "Corte niño", durationMin: 25, priceCents: 2000000 },
        ],
      },
    },
    include: { services: true },
  });

  const barbers = await Promise.all(
    [{ name: "Andrés", userId: user.id, phone: "+573001234567" }, { name: "Camilo", userId: staff.id, phone: "+573007654321" }].map((profile) =>
      db.barber.create({ data: { shopId: shop.id, ...profile, workingHours: { create: HOURS } } }),
    ),
  );

  // Unas citas para hoy y mañana (en horario laboral, saltando el domingo).
  const now = new TZDate(new Date(), TZ);
  const customers = [
    { name: "Julián Pérez", phone: "+573001112233" },
    { name: "Mateo Rojas", phone: "+573004445566" },
    { name: "Santiago Díaz", phone: "+573007778899" },
  ];
  let i = 0;
  for (const offset of [0, 1]) {
    const day = new TZDate(now.getFullYear(), now.getMonth(), now.getDate() + offset, 0, 0, 0, TZ);
    if (day.getDay() === 0) continue;
    for (const [hour, barberIdx] of [[10, 0], [11, 1], [15, 0], [16, 1]] as const) {
      const c = customers[i++ % customers.length];
      const service = shop.services[i % shop.services.length];
      const customer = await db.customer.upsert({
        where: { shopId_phone: { shopId: shop.id, phone: c.phone } },
        create: { shopId: shop.id, ...c },
        update: {},
      });
      const startsAt = new Date(new TZDate(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0, TZ).getTime());
      await db.appointment.create({
        data: {
          shopId: shop.id,
          barberId: barbers[barberIdx].id,
          serviceId: service.id,
          customerId: customer.id,
          startsAt,
          endsAt: new Date(startsAt.getTime() + service.durationMin * 60_000),
          priceCents: service.priceCents,
          manageToken: randomBytes(18).toString("base64url"),
        },
      });
    }
  }

  console.log("Seed listo → /b/demo · demo@codefade.test y camilo@codefade.test / demo1234");
}

main().finally(() => db.$disconnect());
