import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
import sharp from "sharp";

const require = createRequire(import.meta.url);
function loadModule(file, mocks = {}, globals = {}) {
  const output = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, Buffer, File, console, process,
    require: (id) => id === "server-only" ? {} : mocks[id] ?? require(id), ...globals });
  return exports;
}
const staff = { shop: { id: "shop", slug: "negocio" }, isOwner: false, barberId: "mine" };
const owner = { ...staff, isOwner: true, barberId: null };
const denied = "No tienes permiso para esta acción.";
function form(barberId = "mine", photo = new File(["photo"], "photo.png")) {
  const data = new FormData(); data.set("barberId", barberId); data.set("photo", photo); return data;
}
function harness(context = owner, count = 0) {
  const events = [], paths = [], rows = [], errors = [];
  let tail = Promise.resolve();
  const tx = {
    $queryRaw: async (parts, id) => { assert.match(parts.join("?"), /SELECT.*FOR UPDATE/s); assert.equal(id, "shop"); events.push("lock"); return [{ id }]; },
    shop: {
      findUnique: async () => ({ logoUrl: "old-logo", coverUrl: "old-cover" }),
      update: async ({ data }) => { events.push("update"); return data; },
    },
    barber: {
      findFirst: async ({ where }) => { assert.equal(where.shopId, "shop"); return where.id === "foreign" ? null : { id: where.id, photoUrl: "old-avatar" }; },
      update: async ({ where }) => { assert.equal(where.shopId, "shop"); events.push("update"); },
    },
    shopPhoto: {
      count: async () => { assert.equal(events.at(-1), "lock"); return count + rows.length; },
      create: async ({ data }) => { rows.push(data); events.push("create"); return data; },
      findFirst: async ({ where }) => { assert.equal(where.shopId, "shop"); return where.id === "foreign" ? null : { id: where.id, barberId: where.id, url: "old-gallery" }; },
      delete: async () => { events.push("delete-row"); },
    },
  };
  const db = { ...tx, $transaction: async (fn) => {
    const previous = tail; let unlock; tail = new Promise((resolve) => { unlock = resolve; });
    await previous;
    try { const result = await fn(tx); events.push("commit"); return result; } finally { unlock(); }
  } };
  const images = loadModule("src/lib/images.ts");
  const api = loadModule("src/app/actions/photos.ts", {
    "@/lib/auth": { requireShop: async () => context }, "@/lib/db": { db },
    "next/cache": { revalidatePath: (...args) => paths.push(args) },
    "@/lib/images": { ...images, processImage: async () => Buffer.from("webp") },
    "@/lib/storage": {
      savePublicImage: async (key) => { events.push("save"); return `/uploads/${key}`; },
      deletePublicImage: async (url) => { events.push(`remove:${url}`); },
    },
  }, { console: { error: (...args) => errors.push(args) } });
  return { api, tx, events, paths, rows, errors };
}

test("STAFF no puede cambiar logo/portada ni la foto de otro profesional", async () => {
  const { api, events } = harness(staff);
  for (const method of ["saveShopLogo", "removeShopLogo", "saveShopCover", "removeShopCover"]) {
    assert.equal((await api[method](form())).error, denied);
  }
  assert.equal((await api.saveBarberPhoto(form("other"))).error, denied);
  assert.equal((await api.removeBarberPhoto("other")).error, denied);
  assert.equal(events.length, 0);
});
test("OWNER reemplaza y quita fotos; el archivo anterior se borra después del commit", async () => {
  for (const [method, arg, old] of [
    ["saveShopLogo", form(), "old-logo"], ["removeShopLogo", undefined, "old-logo"],
    ["saveShopCover", form(), "old-cover"], ["removeShopCover", undefined, "old-cover"],
    ["saveBarberPhoto", form("other"), "old-avatar"], ["removeBarberPhoto", "other", "old-avatar"],
  ]) {
    const { api, events, paths } = harness();
    assert.equal((await api[method](arg)).ok, true);
    assert.ok(events.indexOf(`remove:${old}`) > events.indexOf("commit"));
    assert.deepEqual(paths, [["/panel", "layout"], ["/b/negocio"]]);
  }
});
test("Foto del profesional: STAFF propio permitido y otro negocio rechazado incluso al dueño", async () => {
  assert.equal((await harness(staff).api.saveBarberPhoto(form())).ok, true);
  assert.equal((await harness(staff).api.removeBarberPhoto("mine")).ok, true);
  for (const method of ["saveBarberPhoto", "removeBarberPhoto"]) {
    const { api, events } = harness();
    assert.equal((await api[method](method.startsWith("save") ? form("foreign") : "foreign")).error, "Profesional no encontrado.");
    assert.ok(!events.includes("update"));
  }
});
test("Galería: STAFF solo borra sus fotos, OWNER cualquiera de su negocio", async () => {
  assert.equal((await harness(staff).api.deleteGalleryPhoto("other")).error, denied);
  assert.equal((await harness(staff).api.deleteGalleryPhoto("mine")).ok, true);
  assert.equal((await harness().api.deleteGalleryPhoto("other")).ok, true);
  assert.equal((await harness().api.deleteGalleryPhoto("foreign")).error, "Foto no encontrada.");
  assert.equal((await harness({ ...staff, barberId: null }).api.addGalleryPhoto(form())).error, denied);
});
test("Galería guarda autor y limita a 12 incluso con subidas concurrentes", async () => {
  for (const context of [owner, staff]) {
    const { api, rows } = harness(context);
    assert.equal((await api.addGalleryPhoto(form())).ok, true);
    assert.equal(rows[0].barberId, context.barberId);
  }
  const { api, rows, events } = harness(owner, 11);
  const results = await Promise.all([api.addGalleryPhoto(form()), api.addGalleryPhoto(form())]);
  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.equal(results.find((r) => r.error).error, "La galería ya tiene 12 fotos. Borra alguna para añadir otra.");
  assert.equal(rows.length, 1);
  assert.equal(events.filter((e) => e.startsWith("remove:/uploads/")).length, 1);
});
test("Un fallo de persistencia limpia la subida nueva y conserva la anterior", async () => {
  const { api, tx, events, errors } = harness();
  tx.shop.update = async () => { throw new Error("DB"); };
  assert.ok((await api.saveShopLogo(form())).error);
  assert.ok(events.some((e) => e.startsWith("remove:/uploads/")));
  assert.ok(!events.includes("remove:old-logo"));
  assert.equal(errors.length, 1);
});

test("Storage local limita rutas, bloquea producción sin token y tolera fallos de borrado", async () => {
  const writes = [], deleted = [], errors = [];
  const env = { NODE_ENV: "development" };
  const api = loadModule("src/lib/storage.ts", {
    "@vercel/blob": { put: () => assert.fail("No debe subir a Blob"), del: () => assert.fail("No debe borrar en Blob") },
    "node:fs/promises": {
      mkdir: async () => {}, writeFile: async (...args) => writes.push(args),
      realpath: async (value) => value,
      unlink: async (value) => { deleted.push(value); throw new Error("archivo bloqueado"); },
    },
  }, { process: { env, cwd: () => process.cwd() }, console: { error: (...args) => errors.push(args) } });
  const url = await api.savePublicImage("shops/shop/logo-id.webp", Buffer.from("webp"), "image/webp");
  assert.equal(url, "/uploads/shops/shop/logo-id.webp");
  assert.equal(writes.length, 1);
  for (const url of ["/uploads/../../secret", "/uploads/..\\secret", "/uploads/C:/secret", "/private/file", "https://example.com/file"]) await api.deletePublicImage(url);
  assert.equal(deleted.length, 0);
  await assert.rejects(api.savePublicImage("../../secret", Buffer.alloc(1), "image/webp"), /Ruta/);
  await api.deletePublicImage(url);
  assert.equal(deleted.length, 1);
  assert.ok(errors.length > 0);
  env.NODE_ENV = "production";
  await assert.rejects(api.savePublicImage("valid.webp", Buffer.alloc(1), "image/webp"), /BLOB_READ_WRITE_TOKEN/);
  env.ALLOW_LOCAL_UPLOADS = "1";
  assert.equal(await api.savePublicImage("valid.webp", Buffer.alloc(1), "image/webp"), "/uploads/valid.webp");
});
test("Storage usa Blob público con sufijo aleatorio y no propaga errores al borrar", async () => {
  let options, removed, logged = 0;
  const api = loadModule("src/lib/storage.ts", {
    "@vercel/blob": {
      put: async (key, data, value) => { options = value; return { url: "https://blob.test/image.webp" }; },
      del: async (url) => { removed = url; throw new Error("Blob offline"); },
    },
  }, { process: { env: { BLOB_READ_WRITE_TOKEN: "test" }, cwd: () => process.cwd() }, console: { error: () => logged++ } });
  const url = await api.savePublicImage("shops/shop/logo-id.webp", Buffer.alloc(1), "image/webp");
  assert.equal(url, "https://blob.test/image.webp");
  assert.equal(options.access, "public"); assert.equal(options.addRandomSuffix, true); assert.equal(options.contentType, "image/webp");
  await api.deletePublicImage(url); assert.equal(removed, url); assert.equal(logged, 1);
});
test("Consulta de galería filtra negocio, ordena por fecha y solo incluye nombre del autor", async () => {
  let query;
  const api = loadModule("src/lib/photos.ts", { "@/lib/db": { db: { shopPhoto: { findMany: async (q) => { query = q; return []; } } } } });
  await api.getShopGallery("shop");
  assert.equal(query.where.shopId, "shop");
  assert.equal(query.orderBy[0].createdAt, "desc");
  assert.equal(query.include.barber.select.name, true);
});
test("processImage convierte PNG real, ignora MIME y produce las dimensiones requeridas sin metadatos", async () => {
  const { processImage } = loadModule("src/lib/images.ts");
  const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: "red" } }).png().toBuffer();
  for (const [kind, width, height] of [["logo", 512, 512], ["avatar", 512, 512], ["cover", 1600, 600], ["gallery", 1200, 1200]]) {
    const result = await processImage(new File([png], "fake.txt", { type: "text/plain" }), kind);
    const metadata = await sharp(result).metadata();
    assert.equal(metadata.format, "webp"); assert.equal(metadata.width, width); assert.equal(metadata.height, height);
    assert.equal(metadata.exif, undefined);
  }
});
test("processImage rechaza vacío, más de 8 MB y formatos no permitidos aunque declaren MIME PNG", async () => {
  const { processImage, ImageError } = loadModule("src/lib/images.ts");
  await assert.rejects(processImage(new File([Buffer.alloc(0)], "photo.png"), "logo"), (e) => e instanceof ImageError && e.message === "Selecciona una foto.");
  await assert.rejects(processImage(new File([Buffer.alloc(8 * 1024 * 1024 + 1)], "photo.png"), "logo"), (e) => e instanceof ImageError && e.message === "La foto pesa más de 8 MB.");
  await assert.rejects(processImage(new File(['<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'], "photo.png", { type: "image/png" }), "logo"), (e) => e instanceof ImageError && e.message === "Sube una foto JPG, PNG o WebP.");
  await assert.rejects(processImage(new File(["broken"], "photo.png"), "logo"), /No se pudo procesar la foto/);
});
