import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
const require = createRequire(import.meta.url);
function loadModule(file, mocks = {}) {
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, Buffer, console, process: { env: { APP_URL: "https://app.test" } }, require: id => id === "server-only" ? {} : mocks[id] ?? require(id) });
  return exports;
}
const form = values => { const f = new FormData(); for (const [k, v] of Object.entries(values)) f.set(k, v); return f; };
const limited = "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
const generic = "Si el correo está registrado, te enviamos un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.";
function harness({ missing = false, valid = false, blocked = "" } = {}) {
  const hits = [], checks = [], tokens = [], sent = [], updates = [], comparisons = [];
  const user = { id: "u1", email: "ana@test.com", name: "Ana", passwordHash: "stored", mustChangePassword: true };
  const db = {
    user: { findUnique: async () => missing ? null : user, update: async q => { updates.push(q); return user; } },
    passwordResetToken: {
      findUnique: async ({ where }) => tokens.find(t => t.tokenHash === where.tokenHash) ?? null,
      updateMany: async ({ where, data }) => { let count = 0; for (const t of tokens) if ((!where.id || t.id === where.id) && (!where.userId || t.userId === where.userId) && t.usedAt === null && (!where.expiresAt || t.expiresAt > where.expiresAt.gt)) { Object.assign(t, data); count++; } return { count }; },
      create: async ({ data }) => { const t = { id: `t${tokens.length}`, usedAt: null, ...data }; tokens.push(t); return t; },
    },
    shop: { findUnique: async () => ({ id: "shop", countryCode: "57" }) },
    appointment: { count: async () => 0 },
    $queryRaw: async () => [{ id: "u1" }],
  };
  let tail = Promise.resolve();
  db.$transaction = fn => { const result = tail.then(() => fn(db)); tail = result.catch(() => {}); return result; };
  const mocks = {
    "@/lib/db": { db }, "@/lib/auth": { getUser: async () => null },
    "@/lib/session": { createSession: async () => {}, deleteSession: async () => {} },
    "@/lib/format": { slugify: x => x, normalizePhone: x => x },
    "@/lib/business-types": loadModule("src/lib/business-types.ts"),
    "@/lib/rate-limit": { RATE_LIMIT_MESSAGE: limited, clientIp: async () => "ip", consume: async (key, limit, window) => { checks.push([key, limit, window]); hits.push(key); return { limited: key === blocked, id: key }; }, release: async (...ids) => { for (const id of ids) hits.splice(hits.indexOf(id), 1); } },
    "@/lib/notify": { sendPasswordReset: async data => sent.push(data) },
    "next/navigation": { redirect: path => { throw new Error(`REDIRECT:${path}`); } },
    "bcryptjs": { compare: async (password, hash) => { comparisons.push(hash); return valid; }, hash: require("bcryptjs").hash },
    "@/lib/availability": {}, "@/lib/time": {}, "@/lib/booking": { bookAppointment: async () => ({ ok: false, error: "Sin cupo" }) },
  };
  return { api: loadModule("src/app/actions/auth.ts", mocks), booking: loadModule("src/app/b/[slug]/actions.ts", mocks), mocks, db, hits, checks, tokens, sent, updates, comparisons };
}
const loginForm = () => form({ email: "ana@test.com", password: "incorrecta" });
for (const blocked of ["login:email:ana@test.com", "login:ip:ip"]) test(`Login bloquea ${blocked} antes de comparar`, async () => {
  const h = harness({ blocked }); assert.equal((await h.api.login(undefined, loginForm())).message, limited); assert.equal(h.comparisons.length, 0); assert.deepEqual(h.hits, ["login:email:ana@test.com", "login:ip:ip"]);
});
test("Login solo cuenta fallos y usa hash ficticio para cuentas inexistentes", async () => {
  for (const missing of [false, true]) { const h = harness({ missing }); await h.api.login(undefined, loginForm()); assert.deepEqual(h.hits, ["login:email:ana@test.com", "login:ip:ip"]); assert.equal(h.comparisons.length, 1); if (missing) assert.notEqual(h.comparisons[0], "stored"); assert.deepEqual(h.checks, [["login:email:ana@test.com", 5, 900000], ["login:ip:ip", 20, 900000]]); }
  const h = harness({ valid: true }); await assert.rejects(h.api.login(undefined, loginForm()), /REDIRECT/); assert.equal(h.hits.length, 0);
});
test("Registro limita los envíos válidos por IP", async () => {
  const values = { businessType: "SPA", shopName: "Spa", name: "Ana", email: "ana@test.com", password: "password123", timezone: "America/Bogota", currency: "COP", countryCode: "57", privacy: "on" };
  const h = harness({ blocked: "signup:ip:ip" }); assert.equal((await h.api.signup(undefined, form(values))).message, limited); assert.deepEqual(h.checks[0], ["signup:ip:ip", 5, 3600000]); assert.deepEqual(h.hits, ["signup:ip:ip"]);
  const allowed = harness(); await allowed.api.signup(undefined, form(values)); assert.deepEqual(allowed.hits, ["signup:ip:ip"]);
});
test("Reservas cuentan cada envío validado y bloquean por IP", async () => {
  const values = { serviceId: "s", start: "2026-12-01T12:00:00Z", name: "Ana", phone: "3001234567", privacy: "on" };
  const h = harness({ blocked: "book:ip:ip" }); assert.equal((await h.booking.book("shop", undefined, form(values))).error, limited); assert.deepEqual(h.checks[0], ["book:ip:ip", 10, 3600000]); assert.deepEqual(h.hits, ["book:ip:ip"]);
  const allowed = harness(); await allowed.booking.book("shop", undefined, form({})); assert.equal(allowed.hits.length, 0); await allowed.booking.book("shop", undefined, form(values)); assert.deepEqual(allowed.hits, ["book:ip:ip"]);
});
test("Recuperación responde igual, limita correo/IP y guarda solo hash con una hora de vida", async () => {
  for (const options of [{}, { missing: true }, { blocked: "reset:email:ana@test.com" }, { blocked: "reset:ip:ip" }]) {
    const h = harness(options); const before = Date.now();
    assert.equal((await h.api.requestPasswordReset(undefined, form({ email: "ana@test.com" }))).message, generic);
    if (options.missing || options.blocked) { assert.equal(h.sent.length, 0); assert.equal(h.tokens.length, 0); } else {
      const token = h.sent[0].url.split("/").at(-1); assert.equal(Buffer.from(token, "base64url").length, 32); assert.equal(h.tokens[0].tokenHash, createHash("sha256").update(token).digest("hex")); assert.ok(!JSON.stringify(h.tokens).includes(token)); assert.ok(+h.tokens[0].expiresAt >= before + 3600000 && +h.tokens[0].expiresAt <= Date.now() + 3600000);
    }
    assert.deepEqual(h.checks, [["reset:email:ana@test.com", 3, 3600000], ["reset:ip:ip", 10, 3600000]]);
  }
});
test("Nuevo enlace invalida anteriores; consumo concurrente es único y actualiza contraseña", async () => {
  const h = harness(); const data = form({ email: "ana@test.com" }); await h.api.requestPasswordReset(undefined, data); await h.api.requestPasswordReset(undefined, data);
  assert.ok(h.tokens[0].usedAt); assert.equal(h.tokens[1].usedAt, null);
  const token = h.sent[1].url.split("/").at(-1); const passwords = () => form({ password: "nueva1234", confirmation: "nueva1234" });
  const results = await Promise.allSettled([h.api.resetPassword(token, undefined, passwords()), h.api.resetPassword(token, undefined, passwords())]);
  assert.equal(results.filter(r => r.status === "rejected" && /REDIRECT:\/ingresar\?restablecida=1/.test(r.reason.message)).length, 1);
  assert.equal(h.updates.length, 1); assert.equal(h.updates[0].data.mustChangePassword, false); assert.equal(require("bcryptjs").getRounds(h.updates[0].data.passwordHash), 12); assert.ok(await require("bcryptjs").compare("nueva1234", h.updates[0].data.passwordHash));
});
test("Restablecer rechaza enlaces ausentes, caducados, usados y contraseñas inválidas", async () => {
  const h = harness(); await h.api.requestPasswordReset(undefined, form({ email: "ana@test.com" })); const token = h.sent[0].url.split("/").at(-1);
  for (const [password, confirmation] of [["short", "short"], ["x".repeat(101), "x".repeat(101)], ["valida123", "distinta123"]]) assert.ok((await h.api.resetPassword(token, undefined, form({ password, confirmation }))).errors);
  h.tokens[0].expiresAt = new Date(0);
  for (const value of [token, "inexistente"]) assert.equal((await h.api.resetPassword(value, undefined, form({ password: "nueva1234", confirmation: "nueva1234" }))).message, "Este enlace ya no es válido. Pide uno nuevo.");
  assert.equal(h.updates.length, 0);
});

test("clientIp prioriza la primera IP reenviada y aplica las alternativas", async () => {
  for (const [values, expected] of [[{ "x-forwarded-for": " 1.2.3.4, 5.6.7.8", "x-real-ip": "9.9.9.9" }, "1.2.3.4"], [{ "x-real-ip": "9.9.9.9" }, "9.9.9.9"], [{}, "desconocida"]]) {
    const api = loadModule("src/lib/rate-limit.ts", { "next/headers": { headers: async () => new Headers(values) }, "@/lib/db": { db: {} } });
    assert.equal(await api.clientIp(), expected);
  }
});
test("El límite gasta el intento antes de contar, respeta clave y ventana, y release lo devuelve", async () => {
  const now = Date.now();
  let seq = 0;
  const rows = [0, 1, 2, 3].map(() => ({ id: `r${seq++}`, key: "login:a", createdAt: new Date(now) }));
  rows.push({ id: `r${seq++}`, key: "login:a", createdAt: new Date(now - 3600000) }, { id: `r${seq++}`, key: "login:b", createdAt: new Date(now) });
  const api = loadModule("src/lib/rate-limit.ts", {
    "next/headers": {}, "@/lib/db": { db: { rateLimitHit: {
      count: async ({ where }) => rows.filter(r => r.key === where.key && r.createdAt >= where.createdAt.gte).length,
      create: async ({ data }) => { const row = { id: `r${seq++}`, ...data, createdAt: new Date() }; rows.push(row); return { id: row.id }; },
      deleteMany: async ({ where }) => { for (const id of where.id?.in ?? []) rows.splice(rows.findIndex(r => r.id === id), 1); },
    } } },
  });
  const fifth = await api.consume("login:a", 5, 900000);
  assert.equal(fifth.limited, false);
  assert.equal((await api.consume("login:a", 5, 900000)).limited, true);
  await api.release(fifth.id);
  assert.equal(rows.filter(r => r.key === "login:a" && r.createdAt >= new Date(now - 900000)).length, 5);
  assert.equal((await api.consume("login:b", 2, 900000)).limited, false);
});

test("Peticiones simultáneas no superan el límite", async () => {
  let seq = 0;
  const rows = [];
  const api = loadModule("src/lib/rate-limit.ts", {
    "next/headers": {}, "@/lib/db": { db: { rateLimitHit: {
      count: async ({ where }) => { await new Promise(r => setTimeout(r, 1)); return rows.filter(r => r.key === where.key).length; },
      create: async ({ data }) => { const row = { id: `r${seq++}`, ...data }; rows.push(row); return { id: row.id }; },
      deleteMany: async () => {},
    } } },
  });
  const results = await Promise.all(Array.from({ length: 12 }, () => api.consume("book:ip:x", 10, 3600000)));
  assert.ok(results.filter(r => !r.limited).length <= 10);
});
test("Un fallo de correo mantiene la respuesta genérica", async () => {
  const h = harness(); h.mocks["@/lib/notify"].sendPasswordReset = async () => { throw new Error("Proveedor"); };
  assert.equal((await h.api.requestPasswordReset(undefined, form({ email: "ana@test.com" }))).message, generic);
});

test("Reservar y registrarse exigen aceptar el aviso de privacidad", async () => {
  const h = harness();
  const booking = await h.booking.book("shop", undefined, form({ serviceId: "s", start: "2026-12-01T12:00:00Z", name: "Ana", phone: "3001234567" }));
  assert.equal(booking.errors?.privacy?.[0], "Acepta el aviso de privacidad para reservar.");
  const signup = await h.api.signup(undefined, form({ businessType: "SPA", shopName: "Spa", name: "Ana", email: "ana@test.com", password: "password123", timezone: "America/Bogota", currency: "COP", countryCode: "57" }));
  assert.equal(signup.errors?.privacy?.[0], "Acepta el aviso de privacidad para crear la cuenta.");
});
