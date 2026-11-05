import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

function load(file, mocks = {}, globals = {}) {
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, console: { error() {}, info() {} }, ...globals, require: (id) => id in mocks ? mocks[id] : require(id) });
  return exports;
}
const time = load("src/lib/time.ts");
const shop = { id: "shop", timezone: "America/Bogota" };
for (const role of ["STAFF", "OWNER"]) {
  test(`${role}: consulta y lectura solo afectan a su barbero y barbería`, async () => {
    const rows = [
      { id: "own", shopId: "shop", barberId: "mine", readAt: null },
      { id: "other", shopId: "shop", barberId: "other", readAt: null },
      { id: "foreign", shopId: "foreign", barberId: "mine", readAt: null },
    ].map((r) => ({ ...r, type: "NEW_BOOKING", createdAt: new Date(), appointment: { startsAt: new Date("2026-11-05T02:00:00Z"), customer: { name: "Cliente" }, service: { name: "Corte" } } }));
    const match = (row, where) => Object.entries(where).every(([key, value]) => row[key] === value);
    const api = load("src/app/actions/notifications.ts", {
      "@/lib/auth": { requireShop: async () => ({ shop, role, isOwner: role === "OWNER", barberId: "mine" }) },
      "@/lib/time": time,
      "@/lib/db": { db: { notification: {
        findMany: async ({ where, take, orderBy }) => { assert.equal(take, 20); assert.ok(orderBy); return rows.filter((r) => match(r, where)); },
        count: async ({ where }) => rows.filter((r) => match(r, where)).length,
        updateMany: async ({ where, data }) => { const selected = rows.filter((r) => match(r, where)); selected.forEach((r) => Object.assign(r, data)); return { count: selected.length }; },
      } } },
    });
    const result = await api.getNotifications();
    assert.equal(result.unread, 1);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].day, "2026-11-04");
    await api.markNotificationRead("other");
    await api.markNotificationRead("foreign");
    assert.equal(rows[1].readAt, null);
    assert.equal(rows[2].readAt, null);
    await api.markNotificationRead("own");
    assert.ok(rows[0].readAt);
    rows[0].readAt = null;
    await api.markAllNotificationsRead();
    assert.ok(rows[0].readAt);
    assert.equal(rows[1].readAt, null);
    assert.equal(rows[2].readAt, null);
  });
}

test("Sin barbero vinculado no se consulta ni se modifica ningún aviso", async () => {
  const api = load("src/app/actions/notifications.ts", { "@/lib/auth": { requireShop: async () => ({ shop, barberId: null }) }, "@/lib/db": { db: {} }, "@/lib/time": time });
  assert.equal((await api.getNotifications()).unread, 0);
  await api.markNotificationRead("other");
  await api.markAllNotificationsRead();
});

test("WhatsApp usa plantilla, destinatario y cinco parámetros en hora local", async () => {
  for (const type of ["NEW_BOOKING", "CLIENT_CANCELLED"]) {
    let payload;
    const api = load("src/lib/notify.ts", { "server-only": {}, "@/lib/time": time }, {
      process: { env: { WHATSAPP_TOKEN: "test", WHATSAPP_PHONE_NUMBER_ID: "phone", WHATSAPP_TEMPLATE_BARBER_NEW: "nueva", WHATSAPP_TEMPLATE_BARBER_CANCEL: "cancelada" } },
      fetch: async (_url, request) => { payload = JSON.parse(request.body); return { ok: true }; },
    });
    await api.sendBarberNotice({ type, barberPhone: "+573001234567", barberName: "Andrés", customerName: "Cliente", serviceName: "Corte", startsAt: new Date("2026-11-05T02:00:00Z"), timezone: shop.timezone });
    assert.equal(payload.to, "573001234567");
    assert.equal(payload.template.name, type === "NEW_BOOKING" ? "nueva" : "cancelada");
    assert.deepEqual(payload.template.components[0].parameters.map((p) => p.text), ["Andrés", "Cliente", "Corte", "miércoles 4 de noviembre", "21:00"]);
  }
});

test("El aviso se guarda sin cuenta vinculada y el fallo de WhatsApp queda contenido", async () => {
  let saved;
  let callback;
  const api = load("src/lib/barber-notifications.ts", {
    "server-only": {}, "next/server": { after: (fn) => { callback = fn; } },
    "@/lib/notify": { sendBarberNotice: async () => { throw new Error("red caída"); } },
    "@/lib/db": { db: {
      notification: { create: async ({ data }) => { saved = data; } },
      appointment: { findUnique: async () => ({ barber: { phone: "+573001234567", name: "Andrés", userId: null }, customer: { name: "Cliente" }, service: { name: "Corte" }, shop, startsAt: new Date() }) },
    } },
  });
  await api.notifyBarber({ id: "appointment", shopId: "shop", barberId: "assigned" }, "NEW_BOOKING");
  assert.equal(saved.barberId, "assigned");
  assert.equal(saved.appointmentId, "appointment");
  await assert.doesNotReject(callback);
});

for (const count of [0, 1]) {
  test(`Cancelar crea aviso solo si cambió una cita: count=${count}`, async () => {
    let notices = 0;
    const api = load("src/app/cita/[token]/actions.ts", {
      "next/cache": { revalidatePath() {} },
      "@/lib/db": { db: { appointment: { updateMany: async () => ({ count }), findUnique: async () => ({ id: "appointment", shopId: "shop", barberId: "mine" }) } } },
      "@/lib/barber-notifications": { notifyBarber: async () => { notices++; } },
    });
    await api.cancelByToken("a-long-random-token");
    assert.equal(notices, count);
  });
}

test("Un fallo al guardar el aviso no falla la reserva y WhatsApp se difiere", async () => {
  const deferred = [];
  let sent = 0;
  const db = {
    notification: { create: async () => { throw new Error("BD de avisos no disponible"); } },
    appointment: { create: async () => ({ id: "appointment", shopId: shop.id, barberId: "assigned", manageToken: "token" }), findUnique: async () => ({ startsAt: new Date(), shop, barber: { name: "Andrés", phone: "+573001234567" }, customer: { name: "Cliente" }, service: { name: "Corte" } }) },
    service: { findFirst: async () => ({ id: "service", durationMin: 30, priceCents: 100 }) },
    barber: { findMany: async () => [{ id: "assigned" }] },
    customer: { upsert: async () => ({ id: "customer" }) },
  };
  const helper = load("src/lib/barber-notifications.ts", { "server-only": {}, "@/lib/db": { db }, "next/server": { after: (fn) => deferred.push(fn) }, "@/lib/notify": { sendBarberNotice: async () => { sent++; } } });
  const start = new Date("2026-11-05T15:00:00Z");
  const api = load("src/lib/booking.ts", { "server-only": {}, "@/lib/db": { db, isOverlapError: () => false }, "@/lib/time": time, "@/lib/availability": { getDaySlots: async () => [{ start: start.toISOString(), barberIds: ["assigned"] }] }, "@/lib/barber-notifications": helper });
  assert.equal((await api.bookAppointment(shop, { serviceId: "service", barberId: null, start, name: "Cliente", phone: "+573001234567" })).ok, true);
  assert.equal(sent, 0);
  assert.equal(deferred.length, 1);
  await deferred[0]();
  assert.equal(sent, 1);
});
