import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

// Ejecutamos las acciones reales con sesión y persistencia controladas.
function actions(context, db = {}, file = "panel", extra = {}) {
  const source = fs.readFileSync(`src/app/actions/${file}.ts`, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    exports,
    require: (id) => {
      if (extra[id]) return extra[id];
      if (id === "@/lib/auth") return { requireShop: async () => context };
      if (id === "@/lib/db") return { db };
      if (id === "next/cache") return { revalidatePath() {} };
      if (id === "@/lib/format") return { normalizePhone: () => null };
      if (id === "@/lib/time") return { hhmmToMinutes: (value) => { const [h, m] = value.split(":").map(Number); return h * 60 + m; } };
      return require(id);
    },
  });
  return exports;
}

const staff = { shop: { id: "shop" }, user: { id: "staff" }, role: "STAFF", isOwner: false, barberId: "mine" };
const denied = "No tienes permiso para esta acción.";

test("STAFF no puede administrar servicios, ajustes ni crear barberos", async () => {
  const api = actions(staff);
  for (const name of ["saveService", "saveSettings", "createBarber"]) {
    assert.equal((await api[name](undefined, new FormData())).error, denied);
  }
  assert.equal((await api.setServiceActive("service", true)).error, denied);
});

test("STAFF no puede editar el horario ni las ausencias de otro barbero", async () => {
  const api = actions(staff, { timeOff: { findFirst: async () => ({ id: "off", barberId: "other" }) } });
  const form = new FormData();
  form.set("id", "other");
  form.set("barberId", "other");
  assert.equal((await api.updateBarber(undefined, form)).error, denied);
  assert.equal((await api.addTimeOff(undefined, form)).error, denied);
  assert.equal((await api.deleteTimeOff("off")).error, denied);
});

test("STAFF sin vínculo no puede cambiar citas", async () => {
  assert.equal((await actions({ ...staff, barberId: null }).setAppointmentStatus("cita", "COMPLETED")).error, denied);
});

test("Los cambios de citas STAFF filtran por su barbero y barbería", async () => {
  let query;
  const api = actions(staff, { appointment: { updateMany: async (value) => { query = value; return { count: 1 }; } } });
  assert.equal((await api.setAppointmentStatus("cita", "COMPLETED")).ok, true);
  assert.equal(query.where.barberId, "mine");
  assert.equal(query.where.shopId, "shop");
});

test("STAFF solo actualiza horario aunque envíe nombre, teléfono y estado", async () => {
  let profile;
  let hours;
  const api = actions(staff, {
    barber: { findFirst: async () => ({ id: "mine" }), update: (q) => { profile = q.data; } },
    workingHours: { deleteMany() {}, createMany: (q) => { hours = q.data; } },
    $transaction: async () => {},
  });
  const form = new FormData();
  for (const [key, value] of Object.entries({ id: "mine", name: "Intruso", phone: "inválido", active: "on", "on-1": "on", "start-1": "09:00", "end-1": "12:00" })) form.set(key, value);
  assert.equal((await api.updateBarber(undefined, form)).ok, true);
  assert.equal(Object.keys(profile).length, 0);
  assert.equal(hours[0].barberId, "mine");
  assert.equal(hours[0].startMin, 540);
  assert.equal(hours[0].endMin, 720);
});

const owner = { ...staff, isOwner: true, role: "OWNER", barberId: null };
const accessExtra = { "@/generated/prisma/client": { Prisma: {} } };

test("Crear acceso guarda STAFF, contraseña temporal cifrada y vínculo dentro de una transacción", async () => {
  let account;
  let link;
  const api = actions(owner, {
    barber: { findFirst: async () => ({ name: "Camilo", userId: null }) },
    user: { findUnique: async () => null },
    $transaction: async (fn) => fn({
      user: { create: async ({ data }) => { account = data; return { id: "new-user" }; } },
      barber: { update: async (q) => { link = q; } },
    }),
  }, "barber-access", accessExtra);
  const form = new FormData();
  form.set("id", "barber"); form.set("email", "new@codefade.test"); form.set("password", "temporal123");
  assert.equal((await api.createBarberAccount(undefined, form)).ok, true);
  assert.equal(account.mustChangePassword, true);
  assert.equal(account.memberships.create.role, "STAFF");
  assert.equal(account.memberships.create.shopId, "shop");
  assert.equal(account.name, "Camilo");
  assert.equal(require("bcryptjs").getRounds(account.passwordHash), 12);
  assert.equal(await require("bcryptjs").compare("temporal123", account.passwordHash), true);
  assert.equal(link.where.shopId, "shop");
  assert.equal(link.data.userId, "new-user");
});

test("STAFF no puede gestionar accesos", async () => {
  const api = actions(staff, {}, "barber-access", accessExtra);
  for (const name of ["createBarberAccount", "linkOwnerAccount", "removeBarberAccess"]) {
    assert.equal((await api[name](undefined, new FormData())).error, denied);
  }
});

test("Crear acceso rechaza un correo existente y comprueba la barbería", async () => {
  let where;
  const api = actions(owner, {
    barber: { findFirst: async (q) => { where = q.where; return { name: "Camilo", userId: null }; } },
    user: { findUnique: async () => ({ id: "existing" }) },
  }, "barber-access", accessExtra);
  const form = new FormData();
  form.set("id", "barber"); form.set("email", "  CAMILO@codefade.test  "); form.set("password", "temporal123");
  const result = await api.createBarberAccount(undefined, form);
  assert.equal(result.errors.email[0], "Ya existe una cuenta con este correo.");
  assert.equal(where.shopId, "shop");
});

test("Quitar acceso solo elimina la membresía STAFF de la barbería actual", async () => {
  let removed;
  let unlinked;
  const tx = {
    barber: {
      findFirst: async () => ({ userId: "linked" }),
      updateMany: async (q) => { unlinked = q; return { count: 1 }; },
    },
    membership: { deleteMany: async (q) => { removed = q.where; } },
  };
  const api = actions(owner, { $transaction: (fn) => fn(tx) }, "barber-access", accessExtra);
  const form = new FormData(); form.set("id", "barber");
  assert.equal((await api.removeBarberAccess(undefined, form)).ok, true);
  assert.equal(unlinked.data.userId, null);
  assert.equal(unlinked.where.shopId, "shop");
  assert.equal(removed.userId, "linked");
  assert.equal(removed.shopId, "shop");
  assert.equal(removed.role, "STAFF");
});

function authActions(user, db = {}) {
  return actions({}, db, "auth", {
    "@/lib/auth": { getUser: async () => user },
    "@/lib/session": { createSession: async () => {}, deleteSession: async () => {} },
    "next/navigation": { redirect: (path) => { throw new Error(`REDIRECT:${path}`); } },
  });
}

test("Cambiar contraseña requiere sesión y valida longitud y confirmación", async () => {
  await assert.rejects(authActions(null).changePassword(undefined, new FormData()), /REDIRECT:\/ingresar/);
  const api = authActions({ id: "user" });
  const form = new FormData(); form.set("password", "short"); form.set("confirmation", "other");
  const result = await api.changePassword(undefined, form);
  assert.equal(result.errors.password[0], "Mínimo 8 caracteres.");
  assert.equal(result.errors.confirmation[0], "Las contraseñas deben coincidir.");
});

test("Cambiar contraseña elimina la obligación, cifra con coste 12 y redirige al panel", async () => {
  let updated;
  const api = authActions({ id: "user" }, { user: { update: async (q) => { updated = q; } } });
  const form = new FormData(); form.set("password", "personal123"); form.set("confirmation", "personal123");
  await assert.rejects(api.changePassword(undefined, form), /REDIRECT:\/panel/);
  assert.equal(updated.where.id, "user");
  assert.equal(updated.data.mustChangePassword, false);
  assert.equal(require("bcryptjs").getRounds(updated.data.passwordHash), 12);
  assert.equal(await require("bcryptjs").compare("personal123", updated.data.passwordHash), true);
});

test("Login con contraseña temporal redirige a cambiar contraseña", async () => {
  const passwordHash = await require("bcryptjs").hash("temporal123", 12);
  const api = authActions(null, { user: { findUnique: async () => ({ id: "user", passwordHash, mustChangePassword: true }) } });
  const form = new FormData(); form.set("email", "new@codefade.test"); form.set("password", "temporal123");
  await assert.rejects(api.login(undefined, form), /REDIRECT:\/cambiar-contrasena/);
});
