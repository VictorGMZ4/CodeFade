import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function load(file, db = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports, Date, process: { env: { DATABASE_POOL_MAX: "1" } }, require: id => {
    if (id === "server-only") return {};
    if (id === "@/lib/db") return { db };
    if (id === "@/lib/time") return load("src/lib/time.ts");
    if (id === "@/generated/prisma/client") {
      const runtime = require("@prisma/client/runtime/client");
      return { Prisma: { sql: runtime.sqltag, empty: runtime.empty } };
    }
    return require(id);
  } });
  return exports;
}
const api = () => load("src/lib/metrics.ts");
const zone = "America/Bogota";
test("Periodos locales completos y anteriores de igual duración", () => {
  const { resolvePeriod } = api();
  const now = new Date("2026-11-05T02:00:00Z");
  const today = resolvePeriod({ periodo: "hoy" }, zone, now);
  assert.equal(today.from, "2026-11-04");
  assert.equal(today.previous.from, "2026-11-03");
  assert.equal(today.start.toISOString(), "2026-11-04T05:00:00.000Z");
  const week = resolvePeriod({ periodo: "semana" }, zone, now);
  assert.equal(week.from, "2026-11-02"); assert.equal(week.to, "2026-11-08");
  assert.equal(week.previous.from, "2026-10-26"); assert.equal(week.previous.to, "2026-11-01");
  const month = resolvePeriod({ periodo: "mes" }, zone, now);
  assert.equal(month.from, "2026-11-01"); assert.equal(month.to, "2026-11-30");
  assert.equal(month.previous.from, "2026-10-02"); assert.equal(month.previous.to, "2026-10-31");
  const range = resolvePeriod({ periodo: "rango", desde: "2024-02-28", hasta: "2024-03-01" }, zone, now);
  assert.equal(range.days, 3); assert.equal(range.previous.from, "2024-02-25");
  assert.equal(range.previous.to, "2024-02-27");
});
test("Rangos inválidos y máximo inclusivo de 366 días", () => {
  const { resolvePeriod } = api();
  for (const [desde, hasta] of [["2026-03-01", "2026-02-01"], ["2026-02-30", "2026-03-01"], ["2025-01-01", "2026-01-02"], ["", ""]]) {
    assert.throws(() => resolvePeriod({ periodo: "rango", desde, hasta }, zone));
  }
  assert.equal(resolvePeriod({ periodo: "rango", desde: "2024-01-01", hasta: "2024-12-31" }, zone).days, 366);
});
test("Porcentajes, comparación y divisor cero", () => {
  const m = api();
  assert.equal(m.percentage(1, 3), "33%"); assert.equal(m.percentage(0, 0), "—");
  assert.equal(m.comparison(20, 10), "▲ 100%"); assert.equal(m.comparison(5, 10), "▼ 50%");
  assert.equal(m.comparison(1, 0), "—"); assert.equal(m.comparison(null, 10), "—");
  assert.equal(m.occupancy(90, 180), 50); assert.equal(m.occupancy(1, 0), null);
});
test("Trabajo con almuerzo y ausencias parciales solapadas sin doble resta", () => {
  const m = api();
  const hours = [{ barberId: "a", weekday: 1, startMin: 540, endMin: 720 }, { barberId: "a", weekday: 1, startMin: 780, endMin: 1020 }];
  const off = [{ barberId: "a", startsAt: new Date("2026-11-02T16:30Z"), endsAt: new Date("2026-11-02T18:30Z") }, { barberId: "a", startsAt: new Date("2026-11-02T18:00Z"), endsAt: new Date("2026-11-02T19:00Z") }];
  assert.equal(m.workingMinutes("2026-11-02", "2026-11-02", zone, hours, off), 330);
});
test("Agrupación semanal solo por encima de 62 días", () => {
  const m = api();
  assert.equal(m.bucketDay("2026-11-05", 62, zone), "2026-11-05");
  assert.equal(m.bucketDay("2026-11-05", 63, zone), "2026-11-02");
  assert.equal(m.bucketDay("2026-11-08", 63, zone), "2026-11-02");
});
test("STAFF no puede ampliar el ámbito mediante barbero", () => {
  const m = api();
  assert.equal(m.metricsBarber({ isOwner: false, barberId: "mine" }, "other"), "mine");
  assert.equal(m.metricsBarber({ isOwner: false, barberId: null }, "other"), "");
  assert.equal(m.metricsBarber({ isOwner: true, barberId: null }, "other"), "other");
  assert.equal(m.metricsBarber({ isOwner: true, barberId: null }, ""), null);
});

test("Todos los agregados SQL parametrizan barbería y barbero STAFF; sin vínculo no consultan", async () => {
  const queries = [];
  const db = {
    barber: { findMany: async ({ where }) => { assert.equal(where.shopId, "shop"); assert.equal(where.id, "mine"); return []; } },
    timeOff: { findMany: async ({ where }) => { assert.equal(where.barber.shopId, "shop"); assert.equal(where.barber.id, "mine"); assert.equal(where.barber.active, true); return []; } },
    $queryRaw: async q => {
      queries.push(q);
      return q.text.includes("\"newCustomers\"") ? [{ minutes: 0 }] : [];
    },
  };
  const m = load("src/lib/metrics.ts", db);
  const period = m.resolvePeriod({ periodo: "hoy" }, zone, new Date("2026-11-05T12:00Z"));
  const staff = { shop: { id: "shop", timezone: zone }, isOwner: false, barberId: "mine" };
  await m.getMetrics(staff, { barbero: "other' OR true --" }, period);
  assert.equal(queries.length, 6);
  for (const q of queries) {
    assert.match(q.text, /a\."shopId" = \$\d+/);
    assert.match(q.text, /a\."barberId" = \$\d+/);
    assert.ok(q.values.includes("shop")); assert.ok(q.values.includes("mine"));
    assert.ok(!q.values.includes("other' OR true --"));
  }
  await assert.rejects(m.getMetrics({ ...staff, barberId: null }, {}, period), /no está vinculada/);
  assert.equal(queries.length, 6);
});
