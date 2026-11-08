import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

// Carga un módulo TS del proyecto sin dependencias (p. ej. constantes compartidas).
function loadModule(file) {
  const source = fs.readFileSync(file, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, require });
  return exports;
}

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
      if (id === "@/lib/format") return { normalizePhone: () => null, parseWhatsApp: loadModule("src/lib/format.ts").parseWhatsApp, slugify: (value) => value.toLowerCase().replace(/[^a-z0-9-]/g, "") };
      if (id === "@/lib/business-types") return loadModule("src/lib/business-types.ts");
      if (id === "@/lib/booking-rules") return loadModule("src/lib/booking-rules.ts");
      if (id === "@/lib/reserved-slugs") return loadModule("src/lib/reserved-slugs.ts");
      if (id === "@/lib/time") return { hhmmToMinutes: (value) => { const [h, m] = value.split(":").map(Number); return h * 60 + m; } };
      return require(id);
    },
  });
  return exports;
}

const staff = { shop: { id: "shop", countryCode: "57" }, user: { id: "staff" }, role: "STAFF", isOwner: false, barberId: "mine" };
const denied = "No tienes permiso para esta acción.";

function formData(values) {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

const settings = { name: "Mi negocio", slug: "mi-negocio", slotMinutes: "15", leadTimeMinutes: "60", bookingWindowDays: "15", reminderHours: "24" };
const registration = { shopName: "Mi negocio", name: "Ana", email: "ana@codefade.test", password: "personal123", timezone: "America/Bogota", currency: "COP", countryCode: "57", privacy: "on", phone: "3001234567" };

for (const businessType of ["INVALIDO", "", undefined]) {
  test(`Registro rechaza tipo de negocio ${String(businessType)}`, async () => {
    const api = authActions(null, { user: { findUnique: async () => ({ id: "existing" }) } });
    const result = await api.signup(undefined, formData({ ...registration, ...(businessType === undefined ? {} : { businessType }) }));
    assert.equal(result.errors.businessType?.[0], "Elige el tipo de negocio.");
  });

  test(`Ajustes rechaza tipo de negocio ${String(businessType)} sin guardar`, async () => {
    let writes = 0;
    const api = actions({ ...staff, isOwner: true, shop: { id: "shop", slug: "mi-negocio" } }, { shop: { update: async () => { writes++; } } });
    const result = await api.saveSettings(undefined, formData({ ...settings, ...(businessType === undefined ? {} : { businessType }) }));
    assert.equal(result.errors?.businessType?.[0], "Elige el tipo de negocio.");
    assert.equal(writes, 0);
  });
}

test("OWNER guarda cada tipo válido en su negocio", async () => {
  for (const businessType of ["BARBERIA", "PELUQUERIA", "UNAS", "ESTETICA", "SPA", "OTRO"]) {
    let updated;
    const api = actions({ ...staff, isOwner: true, shop: { id: "shop", slug: "mi-negocio" } }, { shop: { update: async (query) => { updated = query; } } });
    assert.equal((await api.saveSettings(undefined, formData({ ...settings, businessType }))).ok, true);
    assert.equal(updated.where.id, "shop");
    assert.equal(updated.data.businessType, businessType);
  }
});

test("STAFF no puede cambiar el tipo de negocio", async () => {
  let writes = 0;
  const api = actions(staff, { shop: { update: async () => { writes++; } } });
  assert.equal((await api.saveSettings(undefined, formData({ ...settings, businessType: "SPA" }))).error, denied);
  assert.equal(writes, 0);
});

test("Registro guarda el tipo elegido al crear el negocio", async () => {
  let created;
  const api = authActions(null, {
    user: { findUnique: async () => null, create: async (query) => { created = query.data; return { id: "new-user" }; } },
    shop: { findUnique: async () => null },
  });
  await assert.rejects(api.signup(undefined, formData({ ...registration, businessType: "UNAS" })), /REDIRECT:\/panel\/servicios/);
  assert.equal(created.memberships.create.shop.create.businessType, "UNAS");
});

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
  const api = actions(staff, { appointment: { findFirst: async ({ where }) => { assert.equal(where.barberId, "mine"); assert.equal(where.shopId, "shop"); return { status: "BOOKED", startsAt: new Date(0) }; }, updateMany: async (value) => { query = value; return { count: 1 }; } } });
  assert.equal((await api.setAppointmentStatus("cita", "COMPLETED")).ok, true);
  assert.equal(query.where.barberId, "mine");
  assert.equal(query.where.shopId, "shop");
});

test("STAFF solo actualiza su WhatsApp y su horario aunque envíe nombre y estado", async () => {
  let profile;
  let hours;
  const api = actions(staff, {
    barber: { findFirst: async () => ({ id: "mine" }), update: (q) => { profile = q.data; } },
    workingHours: { deleteMany() {}, createMany: (q) => { hours = q.data; } },
    $transaction: async () => {},
  });
  const form = new FormData();
  for (const [key, value] of Object.entries({ id: "mine", name: "Intruso", phone: "300 123 4567", active: "on", "on-1": "on", "start-1": "09:00", "end-1": "12:00" })) form.set(key, value);
  assert.equal((await api.updateBarber(undefined, form)).ok, true);
  assert.deepEqual(Object.keys(profile), ["phone"]);
  assert.equal(profile.phone, "+573001234567");
  form.set("phone", "");
  assert.equal((await api.updateBarber(undefined, form)).errors.phone[0], "Escribe el WhatsApp donde recibirá los avisos de reservas.");
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
    "@/lib/rate-limit": { clientIp: async () => "ip", consume: async () => ({ limited: false, id: "hit" }), release: async () => {} },
    "@/lib/notify": { sendPasswordReset: async () => {} },
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

test("Cambiar contraseña elimina la obligación, cifra con coste 12, cierra otras sesiones y redirige al panel", async () => {
  let updated, invalidated;
  const db = {
    user: { update: async (q) => { updated = q; return { sessionVersion: 3 }; } },
    passwordResetToken: { updateMany: async (q) => { invalidated = q; return { count: 1 }; } },
  };
  db.$transaction = (fn) => fn(db);
  const api = authActions({ id: "user", mustChangePassword: true }, db);
  const form = new FormData(); form.set("password", "personal123"); form.set("confirmation", "personal123");
  await assert.rejects(api.changePassword(undefined, form), /REDIRECT:\/panel/);
  assert.equal(updated.where.id, "user");
  assert.equal(updated.data.mustChangePassword, false);
  assert.equal(require("bcryptjs").getRounds(updated.data.passwordHash), 12);
  assert.equal(await require("bcryptjs").compare("personal123", updated.data.passwordHash), true);
  assert.equal(updated.data.sessionVersion.increment, 1);
  assert.equal(invalidated.where.userId, "user");
});

test("Cambiar contraseña sin ser obligatorio exige la contraseña actual", async () => {
  const passwordHash = await require("bcryptjs").hash("actual1234", 4);
  let updated = false;
  const db = {
    user: { findUnique: async () => ({ passwordHash }), update: async () => { updated = true; return { sessionVersion: 1 }; } },
    passwordResetToken: { updateMany: async () => ({ count: 0 }) },
  };
  db.$transaction = (fn) => fn(db);
  const api = authActions({ id: "user", mustChangePassword: false }, db);
  for (const current of [undefined, "", "incorrecta"]) {
    const form = new FormData(); form.set("password", "personal123"); form.set("confirmation", "personal123");
    if (current !== undefined) form.set("current", current);
    assert.equal((await api.changePassword(undefined, form)).errors.current[0], "La contraseña actual no es correcta.");
  }
  assert.equal(updated, false);
  const form = new FormData(); form.set("password", "personal123"); form.set("confirmation", "personal123"); form.set("current", "actual1234");
  await assert.rejects(api.changePassword(undefined, form), /REDIRECT:\/panel/);
  assert.equal(updated, true);
});

test("Login con contraseña temporal redirige a cambiar contraseña", async () => {
  const passwordHash = await require("bcryptjs").hash("temporal123", 12);
  const api = authActions(null, { user: { findUnique: async () => ({ id: "user", passwordHash, mustChangePassword: true }) } });
  const form = new FormData(); form.set("email", "new@codefade.test"); form.set("password", "temporal123");
  await assert.rejects(api.login(undefined, form), /REDIRECT:\/cambiar-contrasena/);
});
