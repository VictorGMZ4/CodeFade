import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const runtime = require("@prisma/client/runtime/client");
function load(file, mocks = {}, globals = {}) {
  const exports = {};
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { exports, console, Buffer, Request, Response, URL, AbortSignal,
    process: { env: { CRON_SECRET: "test-secret-123456789" } }, ...globals,
    require: id => id === "server-only" ? {} : mocks[id] ?? require(id) });
  return exports;
}
const input = { serviceId: "service", barberId: "barber", start: new Date("2027-01-01T12:00:00Z"), name: "Nuevo", phone: "+573001234567", email: "new@test.com", notes: null, privacyAccepted: true };

test("La reserva guarda el nombre original y su búsqueda normalizada", async () => {
  const h = bookingHarness();
  assert.equal((await h.api.bookAppointment({ id: "shop", timezone: "UTC" }, { ...input, name: "Julián Núñez" })).ok, true);
  assert.equal(h.customer().name, "Julián Núñez");
  assert.equal(h.customer().searchName, "julian nunez");
});
test("IP desconocida no comparte contador de disponibilidad", async () => {
  let reads = 0;
  const api = load("src/app/b/[slug]/actions.ts", {
    "next/navigation": {}, "@/lib/booking": {}, "@/lib/availability": {}, "@/lib/format": {},
    "@/lib/time": { isValidDay: () => true },
    "@/lib/db": { db: { shop: { findUnique: async () => { reads++; return null; } } } },
    "@/lib/rate-limit": { clientIp: async () => "desconocida", consume: async () => assert.fail("Contador compartido") },
  });
  await api.fetchSlots("shop", "s", null, "2027-01-01");
  await api.fetchOpenDays("shop", "s", null);
  assert.equal(reads, 2);
});

test("Cancelación repetida es idempotente sin repetir avisos", async () => {
  const api = load("src/app/cita/[token]/actions.ts", {
    "@/lib/availability": {}, "@/lib/reschedule": {}, "@/lib/rate-limit": {}, "@/lib/time": {},
    "next/cache": { revalidatePath() {} },
    "@/lib/barber-notifications": { notifyBarber: async () => assert.fail("Aviso duplicado") },
    "@/lib/db": { db: { appointment: { updateMany: async () => ({ count: 0 }), findUnique: async () => ({ status: "CANCELLED", startsAt: new Date(Date.now() + 3600000) }) } } },
  });
  assert.equal((await api.cancelByToken("a".repeat(20))).ok, true);
});
function bookingHarness(existing, overlap = false, available = true, upcoming = 0) {
  let customer = existing && { ...existing };
  let inTransaction = false;
  const db = {
    service: { findFirst: async () => ({ id: "service", durationMin: 30, priceCents: 100 }) },
    barber: { findMany: async () => [{ id: "barber" }] },
    customer: {
      upsert: async ({ create, update }) => {
        assert.ok(inTransaction, "El cliente debe crearse dentro de la transacción");
        assert.equal(Object.keys(update).length, 0);
        customer ??= { id: "customer", ...create };
        return customer;
      },
      updateMany: async ({ where, data }) => {
        assert.ok(inTransaction);
        assert.equal(where.id, customer.id);
        assert.equal(where.privacyAcceptedAt, null);
        if (customer.privacyAcceptedAt === null) Object.assign(customer, data);
        return { count: 1 };
      },
    },
    appointment: { count: async () => upcoming, create: async () => {
      if (overlap) throw new Error("overlap");
      return { id: "appointment", manageToken: "token" };
    } },
    $queryRaw: async () => [],
    $transaction: async fn => {
      const before = customer && { ...customer };
      inTransaction = true;
      try { return await fn(db); } catch (error) { customer = before; throw error; }
      finally { inTransaction = false; }
    },
  };
  const api = load("src/lib/booking.ts", {
    "@/lib/search-text": load("src/lib/search-text.ts"),
    "@/lib/db": { db, isOverlapError: e => e.message === "overlap" },
    "@/lib/availability": { getDaySlots: async () => available ? [{ start: input.start.toISOString(), barberIds: ["barber"] }] : [] },
    "@/lib/barber-notifications": { notifyBarber: async () => {} },
    "@/lib/time": { localDay: () => "2027-01-01" },
  });
  return { api, customer: () => customer };
}
for (const consent of [undefined, null, new Date("2020-01-01")]) {
  test(`Consentimiento se crea o completa sin sobrescribir: ${consent}`, async () => {
    const h = bookingHarness(consent === undefined ? undefined : { id: "customer", name: "Original", email: "old@test.com", privacyAcceptedAt: consent });
    assert.equal((await h.api.bookAppointment({ id: "shop", timezone: "UTC" }, input)).ok, true);
    assert.ok(h.customer().privacyAcceptedAt);
    if (consent) assert.equal(+h.customer().privacyAcceptedAt, +consent);
    if (consent !== undefined) { assert.equal(h.customer().name, "Original"); assert.equal(h.customer().email, "old@test.com"); }
  });
}
test("Reserva fallida revierte el cliente y devuelve SLOT_TAKEN", async () => {
  const h = bookingHarness(undefined, true);
  assert.equal((await h.api.bookAppointment({ id: "shop" }, input)).code, "SLOT_TAKEN");
  assert.equal(h.customer(), undefined);
  const noSlot = bookingHarness(undefined, false, false);
  assert.equal((await noSlot.api.bookAppointment({ id: "shop" }, input)).code, "SLOT_TAKEN");
});
test("El límite de citas revierte el consentimiento y no crea clientes", async () => {
  for (const existing of [undefined, { id: "customer", privacyAcceptedAt: null }]) {
    const h = bookingHarness(existing, false, true, 3);
    const result = await h.api.bookAppointment({ id: "shop" }, input);
    assert.equal(result.ok, false);
    assert.equal(result.code, undefined);
    assert.equal(h.customer()?.privacyAcceptedAt, existing?.privacyAcceptedAt);
  }
});
test("Consultas públicas rechazan objetos y limitan las consultas válidas por IP", async () => {
  let reads = 0;
  const limits = [];
  const api = load("src/app/b/[slug]/actions.ts", {
    "next/navigation": {}, "@/lib/booking": {}, "@/lib/availability": {}, "@/lib/format": {},
    "@/lib/time": { isValidDay: () => true },
    "@/lib/db": { db: { shop: { findUnique: async () => { reads++; return null; } } } },
    "@/lib/rate-limit": { clientIp: async () => "ip", consume: async (...args) => { limits.push(args); return { limited: true }; } },
  });
  for (const args of [[{ not: "" }, "s", null], ["shop", { not: "" }, null], ["shop", "s", { not: "" }]]) {
    assert.equal((await api.fetchSlots(...args, "2027-01-01")).length, 0);
    assert.equal((await api.fetchOpenDays(...args)).days.length, 0);
  }
  assert.equal((await api.fetchSlots("shop", "s", null, { not: "" })).length, 0);
  await api.fetchSlots("shop", "s", null, "2027-01-01");
  await api.fetchOpenDays("shop", "s", null);
  assert.equal(reads, 0);
  assert.equal(limits.length, 2);
  for (const [key, limit, window] of limits) { assert.match(key, /ip/); assert.equal(limit, 120); assert.equal(window, 300000); }
});
test("Cron continúa tras excepción de envío y revierte la marca", async () => {
  const rows = ["a", "b"].map(id => ({ id, reminderSentAt: null, startsAt: new Date(Date.now() + 1000), shop: { name: "Shop", reminderHours: 1 }, customer: { name: "Ana" }, service: {}, barber: {} }));
  let query;
  const db = { $queryRaw: async q => { query = q; return rows.map(({ id }) => ({ id })); }, appointment: {
    findMany: async () => rows,
    updateMany: async ({ where, data }) => { Object.assign(rows.find(r => r.id === where.id), data); return { count: 1 }; },
    update: async ({ where, data }) => { Object.assign(rows.find(r => r.id === where.id), data); },
  } };
  let calls = 0;
  const api = load("src/app/api/cron/reminders/route.ts", {
    "@/lib/db": { db }, "@/generated/prisma/client": { Prisma: { sql: runtime.sqltag } },
    "@/lib/notify": { sendReminder: async () => { if (++calls === 1) throw new Error("red caída"); return [{ ok: true }]; } },
  });
  const result = await (await api.GET(new Request("https://app.test/api/cron/reminders", { headers: { authorization: "Bearer test-secret-123456789" } }))).json();
  assert.equal(result.sent, 1);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].id, "a");
  assert.equal(rows[0].reminderSentAt, null);
  assert.ok(rows[1].reminderSentAt);
  assert.match(query.text, /JOIN "Shop"/);
  assert.match(query.text, /s\."reminderHours"/);
  assert.match(query.text, /LIMIT 200/);
  assert.doesNotMatch(query.text, /now\(\)/i);
  assert.equal(query.values.length, 2);
  assert.equal(+query.values[0], +query.values[1]);
});
test("Cancelar devuelve error controlado y solo revalida cuando cancela", async () => {
  let writes = 0, revalidations = 0, count = 0;
  const api = load("src/app/cita/[token]/actions.ts", {
    "@/lib/availability": {}, "@/lib/reschedule": {}, "@/lib/rate-limit": {}, "@/lib/time": {},
    "next/cache": { revalidatePath: () => revalidations++ },
    "@/lib/barber-notifications": { notifyBarber: async () => {} },
    "@/lib/db": { db: { appointment: { updateMany: async () => { writes++; return { count }; }, findUnique: async () => null } } },
  });
  for (const token of [{ not: "" }, "short", "a".repeat(65), "/".repeat(20)]) assert.ok((await api.cancelByToken(token)).error);
  assert.equal(writes, 0);
  assert.ok((await api.cancelByToken("a".repeat(20))).error);
  assert.equal(revalidations, 0);
  count = 1;
  assert.equal((await api.cancelByToken("a".repeat(20))).ok, true);
  assert.equal(revalidations, 1);
});
test("Red fallida en WhatsApp no impide enviar correo y todos los envíos tienen timeout", async () => {
  const requests = [];
  const api = load("src/lib/notify.ts", { "@/lib/time": { formatDayLong: () => "día", formatTime: () => "hora" } }, {
    process: { env: { WHATSAPP_TOKEN: "token", WHATSAPP_PHONE_NUMBER_ID: "id", RESEND_API_KEY: "key" } },
    fetch: async (url, options) => { requests.push(options); if (url.includes("facebook")) throw new Error("red caída"); return { ok: true }; },
  });
  const result = await api.sendReminder({ customerPhone: "+57300", customerEmail: "a@test.com", customerName: "Ana", shopName: "Shop", serviceName: "Corte", barberName: "Luis", manageUrl: "https://app.test" });
  assert.equal(result[0].ok, false);
  assert.equal(result[1].ok, true);
  assert.equal(requests.length, 2);
  for (const request of requests) assert.ok(request.signal instanceof AbortSignal);
});

test("Todos los proveedores tienen diez segundos y ambos canales devuelven fallos de red", async () => {
  const timeouts = [];
  const api = load("src/lib/notify.ts", { "@/lib/time": { formatDayLong: () => "día", formatTime: () => "hora" } }, {
    AbortSignal: { timeout: ms => { timeouts.push(ms); return AbortSignal.timeout(ms); } },
    process: { env: { WHATSAPP_TOKEN: "token", WHATSAPP_PHONE_NUMBER_ID: "id", RESEND_API_KEY: "key" } },
    fetch: async () => { throw new Error("Sin red"); },
  });
  const result = await api.sendReminder({ customerPhone: "+57300", customerEmail: "a@test.com", customerName: "Ana", shopName: "Shop", serviceName: "Corte", barberName: "Luis", manageUrl: "https://app.test" });
  assert.equal(result.length, 2);
  for (const channel of result) { assert.equal(channel.ok, false); assert.match(channel.detail, /Sin red/); }
  await assert.rejects(api.sendBarberNotice({ barberPhone: "+57300" }), /Sin red/);
  await assert.rejects(api.sendPasswordReset({ to: "a@test.com", name: "Ana", url: "https://app.test" }), /Sin red/);
  assert.deepEqual(timeouts, [10000, 10000, 10000, 10000]);
});

test("El cron contiene también fallos al reclamar o liberar una cita", async () => {
  for (const failure of ["claim", "release"]) {
    let calls = 0;
    const rows = ["a", "b"].map(id => ({ id, shop: {}, customer: {}, service: {}, barber: {} }));
    const api = load("src/app/api/cron/reminders/route.ts", {
      "@/generated/prisma/client": { Prisma: { sql: runtime.sqltag } },
      "@/lib/db": { db: { $queryRaw: async () => rows, appointment: {
        findMany: async () => rows,
        updateMany: async ({ where, data }) => {
          if (where.id === "a" && (failure === "claim" || data.reminderSentAt === null)) throw new Error("BD no disponible");
          return { count: 1 };
        },
      } } },
      "@/lib/notify": { sendReminder: async () => { calls++; if (failure === "release" && calls === 1) throw new Error("Sin red"); return [{ ok: true }]; } },
    });
    const result = await (await api.GET(new Request("https://app.test", { headers: { authorization: "Bearer test-secret-123456789" } }))).json();
    assert.equal(result.sent, 1);
    assert.equal(result.failures.length, 1);
    assert.match(result.failures[0].detail, /No se pudo liberar/);
  }
});
