import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

function load(file, context, db) {
  const exports = {};
  const source = fs.readFileSync(file, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { exports, require: (id) => {
    if (id === "server-only") return {};
    if (id === "@/lib/auth") return { requireShop: async () => context };
    if (id === "@/lib/db") return { db };
    if (id === "@/lib/customers") return load("src/lib/customers.ts", context, db);
    if (id === "@/generated/prisma/client") {
      const runtime = require("@prisma/client/runtime/client");
      return { Prisma: { sql: runtime.sqltag, empty: runtime.empty } };
    }
    if (id === "next/cache") return { revalidatePath() {} };
    if (id === "next/navigation") return { notFound() { throw new Error("NOT_FOUND"); } };
    return require(id);
  } });
  return exports;
}
const staff = { shop: { id: "shop" }, isOwner: false, barberId: "mine" };
const owner = { ...staff, isOwner: true, barberId: null };
const customers = [
  { id: "shared", shopId: "shop", appointments: [{ barberId: "mine" }, { barberId: "other" }] },
  { id: "other", shopId: "shop", appointments: [{ barberId: "other" }] },
  { id: "empty", shopId: "shop", appointments: [] },
  { id: "foreign", shopId: "elsewhere", appointments: [{ barberId: "mine" }] },
];
function matches(c, where) {
  return c.shopId === where.shopId && (!where.id || c.id === where.id) &&
    (!where.appointments || c.appointments.some(a => a.barberId === where.appointments.some.barberId));
}
const db = { customer: {
  findFirst: async ({ where }) => customers.find(c => matches(c, where)) ?? null,
  updateMany: async ({ where }) => ({ count: customers.filter(c => matches(c, where)).length }),
} };
test("STAFF solo ve clientes con citas propias; OWNER incluye clientes sin citas", () => {
  const api = load("src/lib/customers.ts", staff, db);
  assert.deepEqual(customers.filter(c => matches(c, api.customerWhere(staff))).map(c => c.id), ["shared"]);
  assert.deepEqual(customers.filter(c => matches(c, api.customerWhere(owner))).map(c => c.id), ["shared", "other", "empty"]);
});
test("La ficha rechaza clientes ajenos a STAFF y permite al OWNER", async () => {
  const api = load("src/lib/customers.ts", staff, db);
  await assert.rejects(api.requireCustomer(staff, "other"), /NOT_FOUND/);
  await assert.rejects(api.requireCustomer(owner, "foreign"), /NOT_FOUND/);
  await assert.rejects(api.requireCustomer({ ...staff, barberId: null }, "shared"), /NOT_FOUND/);
  assert.equal((await api.requireCustomer(owner, "other")).id, "other");
});
test("La nota comprueba permisos, permite OWNER y STAFF propio y limita a 500 caracteres", async () => {
  const form = new FormData(); form.set("id", "other"); form.set("notes", "Nota");
  const action = (ctx) => load("src/app/actions/customers.ts", ctx, db).saveCustomerNote(undefined, form);
  assert.ok((await action(staff)).error);
  assert.equal((await action(owner)).ok, true);
  form.set("id", "shared");
  assert.equal((await action(staff)).ok, true);
  form.set("notes", "a".repeat(501));
  assert.ok((await action(owner)).errors.notes);
  form.set("notes", "a".repeat(500));
  assert.equal((await action(owner)).ok, true);
  assert.ok((await action({ ...staff, barberId: null })).error);
});
test("Todas las consultas de cifras e historial STAFF solo incluyen sus citas", async () => {
  const queries = [];
  const scoped = { ...db, appointment: {
    groupBy: async q => { queries.push(q); return []; },
    aggregate: async q => { queries.push(q); return { _min: { startsAt: null }, _count: 0 }; },
    findMany: async q => { queries.push(q); return []; },
  } };
  await load("src/lib/customers.ts", staff, scoped).customerDetails(staff, "shared");
  assert.ok(queries.length >= 4);
  for (const q of queries) {
    assert.equal(q.where.barberId, "mine");
    assert.equal(q.where.shopId, "shop");
    assert.equal(q.where.customerId, "shared");
  }
});

test("Lista SQL parametrizada: ámbito STAFF, búsqueda literal, orden y paginación en BD", async () => {
  let query;
  const api = load("src/lib/customers.ts", staff, { $queryRaw: async value => { query = value; return []; } });
  await api.listCustomers(staff, "O'Neil_%", 2);
  assert.match(query.text, /a\."barberId" = \$\d+/);
  assert.match(query.text, /a\.id IS NOT NULL/);
  assert.match(query.text, /ORDER BY MAX\(a\."startsAt"\) DESC NULLS LAST/);
  assert.match(query.text, /LIMIT 51 OFFSET \$\d+/);
  assert.ok(query.values.includes("mine"));
  assert.ok(query.values.includes("shop"));
  assert.ok(query.values.includes("%O'Neil\\_\\%%"));
  assert.equal(query.values.at(-1), 50);
  assert.ok(!query.text.includes("O'Neil"));
  await api.listCustomers(owner, "", 1);
  assert.doesNotMatch(query.text, /a\.id IS NOT NULL|a\."barberId" =/);
});

test("Las cifras no suman precios ni estados de otro barbero", async () => {
  const rows = [
    { shopId: "shop", customerId: "shared", barberId: "mine", status: "COMPLETED", priceCents: 100 },
    { shopId: "shop", customerId: "shared", barberId: "other", status: "COMPLETED", priceCents: 900 },
    { shopId: "shop", customerId: "shared", barberId: "other", status: "NO_SHOW", priceCents: 200 },
    { shopId: "shop", customerId: "shared", barberId: "mine", status: "CANCELLED", priceCents: 300 },
  ];
  const filter = where => rows.filter(a => Object.entries(where).every(([k, v]) => a[k] === v));
  const scoped = { ...db, barber: { findFirst: async () => ({ name: "Mi barbero" }) }, appointment: {
    groupBy: async ({ where, by }) => {
      const selected = filter(where);
      return [...new Set(selected.map(a => a[by[0]]))].map(value => {
        const group = selected.filter(a => a[by[0]] === value);
        return { [by[0]]: value, _count: { _all: group.length }, _sum: { priceCents: group.reduce((sum, a) => sum + a.priceCents, 0) } };
      });
    },
    aggregate: async ({ where }) => ({ _min: { startsAt: null }, _count: filter(where).length }),
    findMany: async ({ where }) => filter(where),
  } };
  const result = await load("src/lib/customers.ts", staff, scoped).customerDetails(staff, "shared");
  assert.equal(result.statuses.find(s => s.status === "COMPLETED")._sum.priceCents, 100);
  assert.equal(result.statuses.find(s => s.status === "COMPLETED")._count._all, 1);
  assert.equal(result.statuses.some(s => s.status === "NO_SHOW"), false);
  assert.equal(result.dates._count, 2);
  assert.ok(result.appointments.every(a => a.barberId === "mine"));
});
