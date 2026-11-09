import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function load(file, mocks = {}, globals = {}) {
  const exports = {};
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { exports, Date, console, AbortSignal, ...globals, require: id => id === "server-only" ? {} : mocks[id] ?? require(id) });
  return exports;
}
const time = load("src/lib/time.ts");
const start = new Date("2099-11-10T15:15:00Z");
const oldStart = new Date("2099-11-10T15:00:00Z");
const shop = { id: "shop", timezone: "America/Bogota", leadTimeMinutes: 60, bookingWindowDays: 15, slotMinutes: 15 };
const appointment = { id: "a", shopId: "shop", shop, customer: {}, barberId: "old", status: "BOOKED", rescheduleCount: 0, startsAt: oldStart, endsAt: new Date("2099-11-10T15:30:00Z"), priceCents: 100, manageToken: "a".repeat(24) };
function harness({ update, ids = ["old", "new"], slots = true, notice } = {}) {
  const writes = [], notices = [], options = [];
  const db = { appointment: { findUnique: async () => appointment, updateMany: async args => { writes.push(args); return update ? update(args) : { count: 1 }; } }, barber: { findMany: async () => ids.map(id => ({ id })) } };
  const api = load("src/lib/reschedule.ts", {
    "@/lib/db": { db, isOverlapError: e => e.message === "overlap" },
    "@/lib/time": time,
    "@/lib/booking": { byLoad: async ids => [...ids].reverse() },
    "@/lib/availability": { getDaySlots: async (_shop, _day, duration, _ids, _now, opts) => { assert.equal(duration, 30); options.push(opts); return slots ? [{ start: start.toISOString(), barberIds: ids }, { start: oldStart.toISOString(), barberIds: ids }] : []; } },
    "@/lib/barber-notifications": { notifyBarber: async (...args) => { notices.push(args); if (notice) throw new Error("avisos caídos"); } },
  });
  return { api, writes, notices, options };
}
test("Solo citas activas, con antelación y menos de dos cambios", () => {
  const { canReschedule } = harness().api;
  const now = new Date("2099-11-10T14:00:00Z");
  assert.equal(canReschedule(appointment, shop, now).reason, "TOO_LATE");
  assert.equal(canReschedule(appointment, shop, new Date(+now - 1)).ok, true);
  assert.equal(canReschedule({ ...appointment, rescheduleCount: 2 }, shop, new Date(0)).reason, "LIMIT");
  assert.equal(canReschedule({ ...appointment, status: "CANCELLED" }, shop, new Date(0)).reason, "NOT_ACTIVE");
});
test("Mismo horario y profesional no consume un cambio", async () => {
  const h = harness();
  assert.equal((await h.api.rescheduleAppointment(appointment.manageToken, "old", oldStart)).error, "Elige una hora distinta a la actual.");
  assert.equal(h.writes.length, 0);
});
test("Primero libre prefiere al actual, conserva duración y reinicia recordatorio", async () => {
  const h = harness();
  assert.equal((await h.api.rescheduleAppointment(appointment.manageToken, null, start)).ok, true);
  const { where, data } = h.writes[0];
  assert.equal(data.barberId, "old");
  assert.equal(data.reminderSentAt, null);
  assert.equal(data.rescheduleCount.increment, 1);
  assert.equal(+data.endsAt - +data.startsAt, 1800000);
  assert.equal(where.rescheduleCount, 0);
  assert.equal(+where.startsAt, +oldStart);
  assert.equal(where.status, "BOOKED");
  assert.equal(data.priceCents, undefined);
  assert.equal(data.manageToken, undefined);
  assert.equal(h.options[0].excludeAppointmentId, "a");
  assert.equal(h.notices[0][1], "CLIENT_RESCHEDULED");
  assert.equal(+h.notices[0][2].previousStartsAt, +oldStart);
  assert.equal(+h.notices[0][0].startsAt, +start);
});
test("Bloqueo optimista evita sobrescribir una cita modificada", async () => {
  const h = harness({ update: () => ({ count: 0 }) });
  assert.equal((await h.api.rescheduleAppointment(appointment.manageToken, null, start)).error, "Tu cita cambió mientras elegías. Recarga la página.");
  assert.equal(h.writes.length, 1);
  assert.equal(h.notices.length, 0);
});
test("Solapamiento intenta otro profesional y avisa al anterior con la hora anterior", async () => {
  const h = harness({ update: ({ data }) => { if (data.barberId === "old") throw new Error("overlap"); return { count: 1 }; } });
  assert.equal((await h.api.rescheduleAppointment(appointment.manageToken, null, start)).ok, true);
  assert.deepEqual(h.writes.map(w => w.data.barberId), ["old", "new"]);
  assert.equal(h.notices[0][1], "CLIENT_CANCELLED");
  assert.equal(h.notices[0][2].barberId, "old");
  assert.equal(+h.notices[0][2].previousStartsAt, +oldStart);
  assert.equal(h.notices[1][1], "NEW_BOOKING");
  assert.equal(h.notices[1][0].barberId, "new");
});
test("Todos los candidatos ocupados devuelve SLOT_TAKEN", async () => {
  const h = harness({ update: () => { throw new Error("overlap"); } });
  assert.equal((await h.api.rescheduleAppointment(appointment.manageToken, null, start)).code, "SLOT_TAKEN");
  assert.equal(h.writes.length, 2);
});
test("Horario ausente devuelve SLOT_TAKEN sin escribir", async () => {
  const h = harness({ slots: false });
  assert.equal((await h.api.rescheduleAppointment(appointment.manageToken, null, start)).code, "SLOT_TAKEN");
  assert.equal(h.writes.length, 0);
});
test("Disponibilidad excluye su cita y permite moverla quince minutos", async () => {
  let query;
  const api = load("src/lib/availability.ts", { "@/lib/time": time, "@/lib/db": { db: {
    workingHours: { findMany: async () => [{ barberId: "old", weekday: time.weekdayOf("2099-11-10", shop.timezone), startMin: 600, endMin: 660 }] },
    appointment: { findMany: async ({ where }) => { query = where; return where.id?.not === "a" ? [] : [appointment]; } },
    timeOff: { findMany: async () => [] },
  } } });
  const slots = await api.getDaySlots(shop, "2099-11-10", 30, ["old"], new Date("2099-11-09T12:00:00Z"), { excludeAppointmentId: "a" });
  assert.equal(query.id.not, "a");
  assert.ok(slots.some(s => s.start === start.toISOString()));
});

test("WhatsApp reprogramado usa siete parámetros ordenados y plantilla configurable", async () => {
  for (const template of [undefined, "personalizada"]) {
    let payload;
    const api = load("src/lib/notify.ts", { "@/lib/time": time }, {
      process: { env: { WHATSAPP_TOKEN: "test", WHATSAPP_PHONE_NUMBER_ID: "phone", WHATSAPP_TEMPLATE_BARBER_RESCHEDULE: template } },
      fetch: async (_url, request) => { payload = JSON.parse(request.body); return { ok: true }; },
    });
    await api.sendBarberNotice({ type: "CLIENT_RESCHEDULED", barberPhone: "+573001234567", barberName: "Andrés", customerName: "Ana", serviceName: "Corte", startsAt: new Date("2026-11-11T16:00:00Z"), previousStartsAt: new Date("2026-11-10T15:00:00Z"), timezone: shop.timezone });
    assert.equal(payload.template.name, template ?? "aviso_reprogramacion_barbero");
    assert.deepEqual(payload.template.components[0].parameters.map(p => p.text), ["Andrés", "Ana", "Corte", "martes 10 de noviembre", "10:00", "miércoles 11 de noviembre", "11:00"]);
  }
});

test("Aviso cancelado por cambio muestra el día y la hora anteriores", async () => {
  const previousStartsAt = new Date("2026-11-10T15:00:00Z");
  const api = load("src/app/actions/notifications.ts", {
    "@/lib/auth": { requireShop: async () => ({ shop, barberId: "old" }) }, "@/lib/time": time,
    "@/lib/db": { db: { notification: { count: async () => 1, findMany: async () => [{ id: "n", type: "CLIENT_CANCELLED", previousStartsAt, createdAt: new Date(), readAt: null, appointment: { startsAt: new Date("2026-11-11T16:00:00Z"), customer: { name: "Ana" }, service: { name: "Corte" } } }] } } },
  });
  const { items } = await api.getNotifications();
  assert.equal(items[0].day, "2026-11-10");
  assert.equal(items[0].appointmentDay, "martes 10 de noviembre");
  assert.equal(items[0].appointmentTime, "10:00");
  assert.equal(items[0].previousDay, "martes 10 de noviembre");
  assert.equal(items[0].previousTime, "10:00");
});

test("WhatsApp diferido usa el destinatario anterior y una instantánea de la hora", async () => {
  let callback, saved, sent, requested;
  const api = load("src/lib/barber-notifications.ts", {
    "next/server": { after: fn => { callback = fn; } },
    "@/lib/notify": { sendBarberNotice: async data => { sent = data; } },
    "@/lib/db": { db: {
      notification: { create: async ({ data }) => { saved = data; } },
      barber: { findUnique: async ({ where }) => { requested = where.id; return { name: "Anterior", phone: "+573001234567" }; } },
      appointment: { findUnique: async () => ({ ...appointment, startsAt: new Date("2100-01-01"), customer: { name: "Ana" }, service: { name: "Corte" } }) },
    } },
  });
  await api.notifyBarber({ ...appointment, barberId: "new", startsAt: start }, "CLIENT_CANCELLED", { barberId: "old", previousStartsAt: oldStart });
  await callback();
  assert.equal(saved.barberId, "old");
  assert.equal(+saved.previousStartsAt, +oldStart);
  // El aviso guarda la hora a la que se refiere (la anterior, en esta cancelación).
  assert.equal(+saved.startsAt, +oldStart);
  assert.equal(requested, "old");
  assert.equal(+sent.startsAt, +oldStart);
});

function actionsHarness({ limited = false, fail = false, active = true } = {}) {
  const limits = [], writes = [], paths = [], queries = [];
  const api = load("src/app/cita/[token]/actions.ts", {
    "next/cache": { revalidatePath: path => paths.push(path) }, "@/lib/barber-notifications": {},
    "@/lib/time": time, "@/lib/rate-limit": { clientIp: async () => "ip", consume: async (...args) => { limits.push(args); return { limited }; }, RATE_LIMIT_MESSAGE: "Espera" },
    "@/lib/db": { db: { appointment: { findUnique: async () => ({ ...appointment, shop: { ...shop, barbers: [{ id: "old" }] } }) } } },
    "@/lib/reschedule": { canReschedule: () => ({ ok: active }), rescheduleAppointment: async (...args) => { writes.push(args); if (fail) throw new Error("BD"); return { ok: true }; } },
    "@/lib/availability": { bookableDays: () => ["2099-11-10"], getSlots: async (...args) => { queries.push(args); return new Map([["2099-11-10", [{ start: start.toISOString() }]]]); } },
  }, { console: { error() {} } });
  return { api, limits, writes, paths, queries };
}
test("Acciones rechazan token, profesional, fecha y día inválidos antes de consultar", async () => {
  const h = actionsHarness();
  for (const [token, barber, iso] of [["bad", null, start.toISOString()], [appointment.manageToken, "", start.toISOString()], [appointment.manageToken, "b".repeat(65), start.toISOString()], [appointment.manageToken, 5, start.toISOString()], [appointment.manageToken, null, "mañana"]]) {
    assert.equal((await h.api.rescheduleByToken(token, barber, iso)).ok, false);
    assert.equal((await h.api.fetchRescheduleDays(token, barber)).days.length, iso === "mañana" ? 1 : 0);
  }
  assert.equal((await h.api.fetchRescheduleSlots(appointment.manageToken, null, "2099-02-30")).length, 0);
  assert.equal(h.writes.length, 0);
});
test("Acciones limitan intentos, excluyen cita y revalidan su enlace", async () => {
  const h = actionsHarness();
  const days = await h.api.fetchRescheduleDays(appointment.manageToken, null);
  assert.equal(days.firstSlots[0], start.toISOString());
  assert.deepEqual(h.limits[0], ["availability:ip:ip", 120, 300000]);
  assert.equal(h.queries[0][2], 30);
  assert.equal(h.queries[0][5].excludeAppointmentId, "a");
  assert.equal((await h.api.rescheduleByToken(appointment.manageToken, "old", start.toISOString())).ok, true);
  assert.deepEqual(h.limits[1], ["reschedule:ip:ip", 30, 3600000]);
  assert.deepEqual(h.limits[2], [`reschedule:token:${appointment.manageToken}`, 10, 3600000]);
  assert.equal(h.paths[0], `/cita/${appointment.manageToken}`);
  assert.equal(+h.writes[0][2], +start);
});
test("Acciones contienen fallos y no permiten citas inactivas ni intentos excesivos", async () => {
  const h = actionsHarness({ limited: true });
  assert.equal((await h.api.fetchRescheduleDays(appointment.manageToken, null)).days.length, 0);
  assert.equal((await h.api.rescheduleByToken(appointment.manageToken, null, start.toISOString())).ok, false);
  assert.equal(h.writes.length, 0);
  const inactive = actionsHarness({ active: false });
  assert.equal((await inactive.api.fetchRescheduleDays(appointment.manageToken, null)).days.length, 0);
  assert.equal(inactive.queries.length, 0);
  const failed = actionsHarness({ fail: true });
  assert.equal((await failed.api.rescheduleByToken(appointment.manageToken, null, start.toISOString())).error, "No se pudo cambiar la cita. Inténtalo de nuevo.");
});

test("El cron no reclama la versión anterior de una cita reprogramada", async () => {
  for (const changedTime of [true, false]) {
    let marked = false, sent = 0;
    const read = { ...appointment, startsAt: new Date(Date.now() + 3600000), shop: { ...shop, reminderHours: 24 }, service: {}, barber: {} };
    const updated = { ...read, rescheduleCount: 1, startsAt: changedTime ? new Date(Date.now() + 7200000) : read.startsAt };
    const api = load("src/app/api/cron/reminders/route.ts", {
      "@/generated/prisma/client": { Prisma: { sql: require("@prisma/client/runtime/client").sqltag } },
      "@/lib/notify": { sendReminder: async () => { sent++; return [{ ok: true }]; } },
      "@/lib/db": { db: { $queryRaw: async () => [{ id: "a" }], $executeRaw: async () => 0, appointment: {
        findMany: async () => [read],
        updateMany: async ({ where }) => {
          if ((where.startsAt && +where.startsAt !== +updated.startsAt) || (where.rescheduleCount !== undefined && where.rescheduleCount !== updated.rescheduleCount)) return { count: 0 };
          marked = true; return { count: 1 };
        },
      } } },
    }, { Buffer, Response, URL, process: { env: { CRON_SECRET: "test-secret-123456789" } } });
    await api.GET(new Request("https://app.test/api/cron/reminders", { headers: { authorization: "Bearer test-secret-123456789" } }));
    assert.equal(sent, 0);
    assert.equal(marked, false);
  }
});

test("Cada aviso muestra la hora que tenía al crearse, aunque la cita cambie después", async () => {
  const api = load("src/app/actions/notifications.ts", {
    "@/lib/auth": { requireShop: async () => ({ shop, barberId: "old" }) }, "@/lib/time": time,
    "@/lib/db": { db: { notification: { count: async () => 1, findMany: async () => [{ id: "n", type: "NEW_BOOKING", previousStartsAt: null, startsAt: new Date("2026-11-10T15:00:00Z"), createdAt: new Date(), readAt: null, appointment: { startsAt: new Date("2026-11-11T16:00:00Z"), customer: { name: "Ana" }, service: { name: "Corte" } } }] } } },
  });
  const { items } = await api.getNotifications();
  assert.equal(items[0].day, "2026-11-10");
  assert.equal(items[0].appointmentTime, "10:00");
});
