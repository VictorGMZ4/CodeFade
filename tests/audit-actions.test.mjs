import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

function load(file, dependencies = {}) {
  const exports = {};
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(output, { exports, Date, Intl, console, require: (id) => {
    if (id in dependencies) return dependencies[id];
    if (id.startsWith("@/lib/")) return load(`src/lib/${id.slice(6)}.ts`, dependencies);
    return require(id);
  } });
  return exports;
}
const owner = { shop: { id: "shop", slug: "negocio", timezone: "America/Bogota", countryCode: "57" }, isOwner: true, barberId: "barber" };
const redirect = (path) => { throw new Error(`REDIRECT:${path}`); };
function panel(db = {}, extra = {}) {
  return load("src/app/actions/panel.ts", {
    "@/lib/auth": { requireShop: async () => owner },
    "@/lib/db": { db, isOverlapError: (error) => error.code === "23P01" },
    "next/cache": { revalidatePath() {} }, "next/navigation": { redirect }, ...extra,
  });
}
function form(values) { const result = new FormData(); for (const [key, value] of Object.entries(values)) result.set(key, value); return result; }
const password = () => form({ password: "personal123", confirmation: "personal123", current: "actual123" });
test("Cambiar y restablecer liberan intentos solo al guardar", async () => {
  for (const operation of ["changePassword", "resetPassword"]) {
    for (const success of [true, false]) {
      const released = [];
      const db = {
        user: { findUnique: async () => ({ passwordHash: "hash" }), update: async () => ({ sessionVersion: 2 }) },
        passwordResetToken: { findUnique: async () => ({ id: "reset", userId: "user", expiresAt: new Date(Date.now() + 3600000) }), updateMany: async () => ({ count: success ? 1 : 0 }) },
        $transaction: async fn => fn(db),
      };
      const api = auth(db, {
        "bcryptjs": { compare: async () => success, hash: async () => "hash" },
        "@/lib/rate-limit": { clientIp: async () => "ip", consume: async () => ({ id: "attempt", limited: false }), release: async (...ids) => released.push(...ids) },
      });
      const run = () => operation === "changePassword" ? api.changePassword(undefined, password()) : api.resetPassword("token", undefined, password());
      if (success) await assert.rejects(run(), /REDIRECT/);
      else assert.ok(await run());
      assert.deepEqual(released, success ? ["attempt"] : []);
    }
  }
});
function auth(db = {}, extra = {}) {
  return load("src/app/actions/auth.ts", {
    "@/lib/auth": { getUser: async () => ({ id: "user" }) }, "@/lib/db": { db },
    "@/lib/notify": { sendPasswordReset() {} },
    "@/lib/session": { createSession() {}, deleteSession() {} },
    "@/lib/rate-limit": { clientIp: async () => "ip", consume: async () => ({ limited: false, id: "hit" }), release() {}, RATE_LIMIT_MESSAGE: "limitado" },
    "next/navigation": { redirect }, "bcryptjs": { hash: async () => "hash", compare: async () => false }, ...extra,
  });
}

test("Las acciones rechazan objetos como id y tipos incorrectos antes de consultar Prisma", async () => {
  const api = panel();
  assert.ok((await api.setServiceActive({ not: "" }, true)).error);
  assert.ok((await api.setServiceActive("service", { not: false })).error);
  assert.ok((await api.setAppointmentStatus({ not: "" }, "CANCELLED")).error);
  assert.ok((await api.setAppointmentStatus("appointment", { not: "" })).error);
  assert.ok((await api.deleteTimeOff({ not: "" })).error);
  assert.ok((await auth().resetPassword({ not: "" }, undefined, password())).message);
});

for (const current of ["BOOKED", "CANCELLED", "COMPLETED", "NO_SHOW"]) {
  for (const target of ["BOOKED", "CANCELLED", "COMPLETED", "NO_SHOW"]) {
    for (const future of [false, true]) test(`Transición ${current} a ${target}, futura=${future}`, async () => {
      const allowed = target === "CANCELLED" ? current === "BOOKED"
        : target === "BOOKED" ? current !== "BOOKED" && (future || current !== "CANCELLED")
        : current !== "CANCELLED" && !future;
      let writes = 0;
      const api = panel({ appointment: {
        findFirst: async ({ where }) => {
          assert.equal(where.id, "appointment"); assert.equal(where.shopId, "shop");
          return { status: current, startsAt: new Date(Date.now() + (future ? 3600000 : -3600000)) };
        },
        updateMany: async ({ where, data }) => {
          writes++; assert.equal(where.status, current); assert.equal(data.status, target); return { count: 1 };
        },
      } });
      const result = await api.setAppointmentStatus("appointment", target);
      assert.equal(Boolean(result.ok), allowed);
      assert.equal(writes, allowed ? 1 : 0);
      if (current === "CANCELLED" && target === "BOOKED" && !future) assert.equal(result.error, "Esa cita ya pasó.");
      if (current !== "CANCELLED" && ["COMPLETED", "NO_SHOW"].includes(target) && future) assert.equal(result.error, "No se puede marcar así una cita futura.");
    });
  }
}

test("Permiso, carreras y errores de transición se distinguen", async () => {
  assert.match((await panel({ appointment: { findFirst: async () => null } }).setAppointmentStatus("appointment", "COMPLETED")).error, /permiso|encontrada/);
  const appointment = { findFirst: async () => ({ status: "COMPLETED", startsAt: new Date(0) }), updateMany: async () => ({ count: 0 }) };
  assert.ok((await panel({ appointment }).setAppointmentStatus("appointment", "BOOKED")).error);
  const failure = new Error("conexión caída");
  appointment.updateMany = async () => { throw failure; };
  await assert.rejects(panel({ appointment }).setAppointmentStatus("appointment", "BOOKED"), e => e === failure);
  appointment.updateMany = async () => { throw { code: "23P01" }; };
  assert.match((await panel({ appointment }).setAppointmentStatus("appointment", "BOOKED")).error, /ocupado/);
});

test("Ausencias rechaza fechas imposibles, inválidas y más de 366 días sin escribir", async () => {
  let writes = 0;
  const api = panel({ barber: { findFirst: async () => ({ id: "barber" }) }, timeOff: { create: async () => { writes++; } } });
  for (const [fromDay, toDay] of [["2026-02-30", "2026-03-01"], ["2026-99-01", "2026-99-01"], ["2026-01-01", "2027-01-03"]]) {
    assert.ok((await api.addTimeOff(undefined, form({ barberId: "barber", fromDay, toDay, allDay: "on" }))).error);
  }
  assert.equal(writes, 0);
  assert.equal((await api.addTimeOff(undefined, form({ barberId: "barber", fromDay: "2026-01-01", toDay: "2027-01-01", allDay: "on" }))).ok, true);
  assert.equal(writes, 1);
});

test("Precio admite el máximo Int de Postgres y comunica su desbordamiento", async () => {
  const { parsePrice } = load("src/lib/format.ts");
  assert.equal(parsePrice("21474836,47"), 2147483647);
  assert.equal(parsePrice("21474836,48").error, "Precio demasiado alto.");
  assert.equal((await panel().saveService(undefined, form({ name: "Corte", durationMin: "30", price: "21474836,48" }))).errors.price[0], "Precio demasiado alto.");
});

test("El profesional inactivo pierde el vínculo, el dueño lo conserva", async () => {
  for (const role of ["STAFF", "OWNER"]) {
    const api = load("src/lib/auth.ts", {
      "server-only": {}, "react": { cache: (fn) => fn }, "next/navigation": { redirect },
      "@/lib/session": { readSession: async () => ({ userId: "user", version: 1 }) },
      "@/lib/db": { db: {
        user: { findUnique: async () => ({ id: "user", sessionVersion: 1 }) },
        membership: { findFirst: async () => ({ role, shopId: "shop", shop: owner.shop }) },
        barber: { findFirst: async () => ({ id: "barber", phone: "", active: false }) },
      } },
    });
    assert.equal((await api.requireShop()).barberId, role === "OWNER" ? "barber" : null);
  }
});

const settings = { businessType: "BARBERIA", name: "Negocio", slug: "negocio", slotMinutes: "15", leadTimeMinutes: "60", bookingWindowDays: "15", reminderHours: "24" };
const registration = { businessType: "BARBERIA", shopName: "Demo", name: "Ana", email: "ana@example.com", password: "personal123", timezone: "America/Bogota", currency: "COP", countryCode: "57", privacy: "on", phone: "3001234567" };
test("Los enlaces reservados se rechazan en ajustes y reciben sufijo al registrar", async () => {
  for (const slug of ["demo", "privacidad", "recuperar", "restablecer", "completar-whatsapp", "cambiar-contrasena"]) {
    assert.ok((await panel().saveSettings(undefined, form({ ...settings, slug }))).errors.slug);
    let saved;
    const api = auth({ shop: { findUnique: async () => null }, user: { findUnique: async () => null, create: async ({ data }) => { saved = data.memberships.create.shop.create.slug; return { id: "user" }; } } });
    await assert.rejects(api.signup(undefined, form({ ...registration, shopName: slug })), /REDIRECT/);
    assert.equal(saved, `${slug}-2`);
  }
});

test("Registro rechaza monedas no soportadas y ajustes convierte la carrera P2002 en mensaje", async () => {
  for (const currency of ["cop", "ZZZ", "123"]) assert.ok((await auth().signup(undefined, form({ ...registration, currency }))).errors.currency);
  const api = panel({ shop: { update: async () => { throw { code: "P2002" }; } } });
  assert.equal((await api.saveSettings(undefined, form(settings))).errors.slug[0], "Ese enlace ya lo usa otro negocio.");
});

test("Ingreso limita correo+IP a 5, correo a 30 e IP a 20 y libera los tres al acertar", async () => {
  const calls = [], released = [];
  const api = auth({ user: { findUnique: async () => ({ id: "user", passwordHash: "hash" }) } }, {
    "bcryptjs": { compare: async () => true },
    "@/lib/rate-limit": { clientIp: async () => "203.0.113.1", consume: async (...args) => { calls.push(args); return { limited: false, id: String(calls.length) }; }, release: async (...ids) => released.push(...ids) },
  });
  await assert.rejects(api.login(undefined, form({ email: "ana@example.com", password: "correcta" })), /REDIRECT/);
  assert.equal(calls.length, 3);
  assert.ok(calls.some(([key, limit, window]) => key.includes("ana@example.com") && key.includes("203.0.113.1") && limit === 5 && window === 900000));
  assert.ok(calls.some(([key, limit]) => key === "login:email:ana@example.com" && limit === 30));
  assert.ok(calls.some(([key, limit]) => key === "login:ip:203.0.113.1" && limit === 20));
  assert.deepEqual(released, ["1", "2", "3"]);
});

test("Cambiar y restablecer contraseña aplican su límite antes de bcrypt", async () => {
  const calls = [];
  const api = auth({}, { "@/lib/rate-limit": { clientIp: async () => "ip", consume: async (...args) => { calls.push(args); return { limited: true, id: "hit" }; }, RATE_LIMIT_MESSAGE: "limitado" }, "bcryptjs": { compare() { assert.fail("No debe comparar"); }, hash() { assert.fail("No debe cifrar"); } } });
  assert.equal((await api.changePassword(undefined, password())).message, "limitado");
  assert.equal((await api.resetPassword("valid-token-123456", undefined, password())).message, "limitado");
  assert.ok(calls.some(([key, limit, window]) => key.includes("user") && limit === 5 && window === 900000));
  assert.ok(calls.some(([key, limit, window]) => key.includes("ip") && limit === 10 && window === 3600000));
});

test("Cinco fallos de una IP no bloquean otra; se mantienen los topes por correo e IP", async () => {
  function attempts() {
    const counts = new Map();
    let ip = "ip-1";
    const api = auth({ user: { findUnique: async () => null } }, {
      "@/lib/rate-limit": {
        clientIp: async () => ip,
        consume: async (key, limit) => {
          const count = (counts.get(key) ?? 0) + 1;
          counts.set(key, count);
          return { limited: count > limit, id: key };
        },
        release: async (...keys) => { for (const key of keys) counts.set(key, counts.get(key) - 1); },
        RATE_LIMIT_MESSAGE: "limitado",
      },
    });
    return async (email, address) => {
      ip = address;
      return (await api.login(undefined, form({ email, password: "incorrecta" }))).message;
    };
  }
  const pair = attempts();
  for (let i = 0; i < 5; i++) assert.notEqual(await pair("ana@example.com", "ip-1"), "limitado");
  assert.equal(await pair("ana@example.com", "ip-1"), "limitado");
  assert.notEqual(await pair("ana@example.com", "ip-2"), "limitado");
  const email = attempts();
  for (let i = 0; i < 30; i++) assert.notEqual(await email("ana@example.com", `ip-${i}`), "limitado");
  assert.equal(await email("ana@example.com", "ip-31"), "limitado");
  const address = attempts();
  for (let i = 0; i < 20; i++) assert.notEqual(await address(`user${i}@example.com`, "ip-1"), "limitado");
  assert.equal(await address("otra@example.com", "ip-1"), "limitado");
});

test("Las solicitudes ya limitadas no bloquean a quien ingresa desde otra IP", async () => {
  const hits = new Map();
  let nextId = 0;
  let ip = "ip-atacante";
  let comparisons = 0;
  const api = auth({ user: { findUnique: async () => ({ id: "user", passwordHash: "hash" }) } }, {
    "bcryptjs": { compare: async (password) => { comparisons++; return password === "correcta"; } },
    "@/lib/rate-limit": {
      clientIp: async () => ip,
      consume: async (key, limit) => {
        const id = String(++nextId);
        hits.set(id, key);
        return { id, limited: [...hits.values()].filter((value) => value === key).length > limit };
      },
      release: async (...ids) => { for (const id of ids) hits.delete(id); },
      RATE_LIMIT_MESSAGE: "limitado",
    },
  });
  for (let i = 0; i < 30; i++) {
    const result = await api.login(undefined, form({ email: "ana@example.com", password: "incorrecta" }));
    assert.equal(result.message, i < 5 ? "Correo o contraseña incorrectos." : "limitado");
  }
  assert.equal(comparisons, 5);
  ip = "ip-cliente";
  await assert.rejects(api.login(undefined, form({ email: "ana@example.com", password: "correcta" })), /REDIRECT:\/panel/);
  assert.equal(comparisons, 6);
  assert.equal([...hits.values()].filter((key) => key === "login:email:ana@example.com").length, 5);
});

test("Ausencias no intenta guardar un instante inválido tras convertir la zona horaria", async () => {
  const time = load("src/lib/time.ts");
  const api = panel({ barber: { findFirst: async () => ({ id: "barber" }) } }, {
    "@/lib/time": { ...time, localToUtc: () => new Date(NaN) },
  });
  assert.ok((await api.addTimeOff(undefined, form({ barberId: "barber", fromDay: "2026-01-01", allDay: "on" }))).error);
});
