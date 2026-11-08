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
  vm.runInNewContext(output, { exports, Date, console: { error() {} }, require: (id) => dependencies[id] ?? require(id) });
  return exports;
}
const time = load("src/lib/time.ts");
const format = load("src/lib/format.ts");
const day = time.addDaysToDay(time.localDay(new Date(), "America/Bogota"), 1, "America/Bogota");
const start = time.localToUtc(day, 600, "America/Bogota").toISOString();
function setup({ owner = false, own = "mine", slots = true, overlap = false, noticeFails = false, missing = false } = {}) {
  const calls = { notices: [], customers: [], appointments: [], filters: [] };
  const db = {
    barber: { findFirst: async ({ where }) => { calls.filters.push(where); return missing ? null : { id: where.id }; } },
    service: { findFirst: async ({ where }) => { calls.filters.push(where); return { id: "service", durationMin: 30, priceCents: 2500000 }; } },
    customer: {
      create: async ({ data }) => { calls.customers.push(data); return { id: "customer" }; },
      upsert: async (query) => { calls.upsert = query; return { id: "customer" }; },
    },
    appointment: { create: async ({ data }) => { if (overlap) throw new Error("overlap"); calls.appointments.push(data); return { id: "appointment", ...data }; } },
  };
  db.$transaction = async (fn) => fn(db);
  const api = load("src/app/actions/manual-appointments.ts", {
    "@/lib/auth": { requireShop: async () => ({ shop: { id: "shop", timezone: "America/Bogota", countryCode: "57" }, isOwner: owner, barberId: own }) },
    "@/lib/db": { db, isOverlapError: (e) => e.message === "overlap" },
    "@/lib/time": time,
    "@/lib/format": format,
    "@/lib/availability": { getDaySlots: async (...args) => { calls.slots = args; return slots ? [{ start, barberIds: ["mine", "other"] }] : []; } },
    "@/lib/barber-notifications": { notifyBarber: async (...args) => { calls.notices.push(args); if (noticeFails) throw new Error("aviso fallido"); } },
    "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect: (path) => { throw new Error(`REDIRECT:${path}`); } },
  });
  const form = new FormData();
  for (const [key, value] of Object.entries({ barberId: "mine", serviceId: "service", day, start, name: "Cliente de paso", phone: "", notes: "" })) form.set(key, value);
  return { api, calls, form };
}
async function save(h) { await assert.rejects(h.api.createManualAppointment(undefined, h.form), new RegExp(`REDIRECT:/panel\\?dia=${day}`)); }

test("STAFF no puede crear para otro barbero ni consultar sus huecos", async () => {
  const h = setup(); h.form.set("barberId", "other");
  assert.ok((await h.api.createManualAppointment(undefined, h.form)).error);
  assert.ok((await h.api.getManualSlots({ barberId: "other", serviceId: "service", day })).error);
  assert.equal(h.calls.appointments.length, 0);
});
test("OWNER crea MANUAL para otro barbero, copia precio y duración y avisa", async () => {
  const h = setup({ owner: true }); h.form.set("barberId", "other"); await save(h);
  const a = h.calls.appointments[0];
  assert.equal(a.source, "MANUAL"); assert.equal(a.barberId, "other");
  assert.equal(a.priceCents, 2500000); assert.equal(a.endsAt - a.startsAt, 1800000);
  assert.ok(a.manageToken.length >= 24); assert.equal(h.calls.notices[0][1], "MANUAL_BY_OWNER");
  assert.ok(h.calls.filters.every((q) => q.shopId === "shop" && q.active === true));
  assert.equal(h.calls.slots[5].ignoreLeadTime, true); assert.equal(h.calls.slots[5].windowDays, 60);
});
test("Teléfono vacío crea siempre cliente con phone null", async () => {
  const h = setup(); await save(h); await save(h);
  assert.equal(h.calls.customers.length, 2); assert.equal(h.calls.customers[0].phone, null); assert.equal(h.calls.upsert, undefined);
});
test("Teléfono inválido devuelve error de campo sin escribir", async () => {
  const h = setup(); h.form.set("phone", "123");
  assert.equal((await h.api.createManualAppointment(undefined, h.form)).errors.phone[0], "Número no válido.");
  assert.equal(h.calls.appointments.length, 0);
});
test("Teléfono válido se normaliza y reutiliza cliente sin cambiar su nombre", async () => {
  const h = setup(); h.form.set("phone", "300 111 2233"); await save(h);
  assert.equal(h.calls.upsert.where.shopId_phone.phone, "+573001112233");
  assert.equal(h.calls.upsert.where.shopId_phone.shopId, "shop");
  assert.equal(Object.keys(h.calls.upsert.update).length, 0);
});
for (const owner of [true, false]) test(`Sin aviso al crear en agenda propia (owner=${owner})`, async () => {
  const h = setup({ owner }); await save(h); assert.equal(h.calls.notices.length, 0);
});
test("Un fallo del aviso no impide guardar", async () => {
  const h = setup({ owner: true, own: null, noticeFails: true }); await save(h); assert.equal(h.calls.appointments.length, 1);
});
for (const options of [{ slots: false }, { overlap: true }]) test(`Hueco ocupado devuelve error general ${JSON.stringify(options)}`, async () => {
  const h = setup(options);
  assert.equal((await h.api.createManualAppointment(undefined, h.form)).error, "Ese horario se acaba de ocupar. Elige otro.");
  assert.equal(h.calls.notices.length, 0);
});
test("Rechaza barbero inactivo o ajeno y STAFF sin vínculo", async () => {
  for (const options of [{ missing: true }, { own: null }]) {
    const h = setup(options); assert.ok(await h.api.createManualAppointment(undefined, h.form)); assert.equal(h.calls.appointments.length, 0);
  }
});

test("Rechaza días fuera de plazo, fechas imposibles, hora de otro día y campos demasiado largos", async () => {
  for (const [field, value] of [["day", "2026-02-30"], ["day", "2000-01-01"], ["day", "2099-01-01"], ["start", "2026-01-01T15:00:00.000Z"], ["name", "a"], ["name", "a".repeat(61)], ["notes", "a".repeat(201)]]) {
    const h = setup(); h.form.set(field, value);
    assert.ok((await h.api.createManualAppointment(undefined, h.form)).errors[field]);
    assert.equal(h.calls.appointments.length, 0);
  }
});

test("Disponibilidad manual ignora antelación, respeta pasado, ausencias, citas e intervalo y llega al día 60", async () => {
  const now = new Date("2026-11-05T14:10:00Z"); // Jueves, 09:10 en Bogotá.
  const shop = { id: "shop", timezone: "America/Bogota", slotMinutes: 15, leadTimeMinutes: 120, bookingWindowDays: 15 };
  const api = load("src/lib/availability.ts", {
    "server-only": {}, "@/lib/time": time,
    "@/lib/db": { db: {
      workingHours: { findMany: async () => [1, 4].map((weekday) => ({ barberId: "mine", weekday, startMin: 540, endMin: 720 })) },
      appointment: { findMany: async () => [{ barberId: "mine", startsAt: new Date("2026-11-05T15:00:00Z"), endsAt: new Date("2026-11-05T15:30:00Z") }] },
      timeOff: { findMany: async () => [{ barberId: "mine", startsAt: new Date("2026-11-05T16:00:00Z"), endsAt: new Date("2026-11-05T16:30:00Z") }] },
    } },
  });
  const manual = await api.getDaySlots(shop, "2026-11-05", 30, ["mine"], now, { ignoreLeadTime: true, windowDays: 60 });
  assert.deepEqual(Array.from(manual, (s) => s.start), ["2026-11-05T14:15:00.000Z", "2026-11-05T14:30:00.000Z", "2026-11-05T15:30:00.000Z", "2026-11-05T16:30:00.000Z"]);
  const online = await api.getDaySlots(shop, "2026-11-05", 30, ["mine"], now);
  assert.deepEqual(Array.from(online, (s) => s.start), ["2026-11-05T16:30:00.000Z"]);
  assert.equal((await api.getDaySlots(shop, "2027-01-04", 30, ["mine"], now)).length, 0);
  assert.ok((await api.getDaySlots(shop, "2027-01-04", 30, ["mine"], now, { ignoreLeadTime: true, windowDays: 60 })).length > 0);
  assert.equal((await api.getDaySlots(shop, "2027-01-05", 30, ["mine"], now, { ignoreLeadTime: true, windowDays: 60 })).length, 0);
});
