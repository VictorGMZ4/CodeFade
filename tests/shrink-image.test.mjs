import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(file, globals = {}, imports = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { exports, File, Blob, Error, FormData, ...globals, require: id => {
    assert.ok(id in imports, `Import no registrado: ${id}`);
    return imports[id];
  } });
  return exports;
}

const fileOfSize = size => new File([new Uint8Array(size)], "mi.foto.png", { type: "image/png" });
function imageHarness({ width = 4000, height = 3000, decodeFails = false, encodeFails = false, dom = false, sizes = [] } = {}) {
  const events = [];
  let closed = false;
  const bitmap = { width, height, close() { closed = true; } };
  const context = {
    fillStyle: "",
    fillRect(...args) { events.push(["fill", this.fillStyle, ...args]); },
    drawImage(image, ...args) { assert.equal(image, bitmap); events.push(["draw", ...args]); },
  };
  // Cada codificación puede devolver un tamaño distinto para simular fotos con mucho detalle.
  const nextBlob = () => { const size = sizes.shift(); return size ? new Blob([new Uint8Array(size)], { type: "image/jpeg" }) : new Blob(["jpeg"], { type: "image/jpeg" }); };
  class Canvas {
    constructor(w, h) { this.width = w; this.height = h; }
    getContext(type) { assert.equal(type, "2d"); return context; }
    async convertToBlob(options) {
      events.push(["encode", this.width, this.height, options.type, options.quality]);
      if (encodeFails) throw new Error("encoder");
      return nextBlob();
    }
    toBlob(callback, type, quality) {
      events.push(["encode", this.width, this.height, type, quality]);
      callback(encodeFails ? null : nextBlob());
    }
  }
  const api = load("src/components/shrink-image.ts", {
    createImageBitmap: async (_file, options) => {
      assert.equal(options.imageOrientation, "from-image");
      if (decodeFails) throw new Error("decoder");
      return bitmap;
    },
    OffscreenCanvas: dom ? undefined : Canvas,
    document: { createElement(tag) { assert.equal(tag, "canvas"); return new Canvas(); } },
  });
  return { ...api, events, closed: () => closed };
}

test("rechaza originales mayores de 25 MB antes de decodificar", async () => {
  const h = imageHarness();
  await assert.rejects(h.shrinkImage(fileOfSize(25 * 1024 * 1024 + 1)), { message: "La foto pesa más de 25 MB." });
  assert.equal(h.closed(), false);
});

for (const [width, height, expectedWidth, expectedHeight] of [[4000, 3000, 2400, 1800], [3000, 6000, 1200, 2400], [640, 480, 640, 480]]) {
  test(`reencode ${width}x${height} sin ampliar, con fondo blanco y nombre JPEG`, async () => {
    const h = imageHarness({ width, height });
    const original = fileOfSize(100);
    const result = await h.shrinkImage(original);
    assert.notEqual(result, original);
    assert.equal(result.type, "image/jpeg");
    assert.equal(result.name, "mi.foto.jpg");
    assert.deepEqual(h.events, [
      ["fill", "white", 0, 0, expectedWidth, expectedHeight],
      ["draw", 0, 0, expectedWidth, expectedHeight],
      ["encode", expectedWidth, expectedHeight, "image/jpeg", 0.88],
    ]);
    assert.equal(h.closed(), true);
  });
}

for (const options of [{ decodeFails: true }, { encodeFails: true }, { encodeFails: true, dom: true }]) {
  test(`fallo de preparación permite solo originales de hasta 4 MB: ${JSON.stringify(options)}`, async () => {
    const h = imageHarness(options);
    const small = fileOfSize(4 * 1024 * 1024);
    assert.equal(await h.shrinkImage(small), small);
    await assert.rejects(h.shrinkImage(fileOfSize(4 * 1024 * 1024 + 1)), { message: "No se pudo preparar la foto. Prueba con otra en JPG o PNG." });
    assert.equal(h.closed(), !options.decodeFails);
  });
}

test("usa canvas del documento cuando OffscreenCanvas no existe", async () => {
  const h = imageHarness({ dom: true });
  assert.equal((await h.shrinkImage(fileOfSize(25 * 1024 * 1024))).type, "image/jpeg");
  assert.deepEqual(h.events.at(-1), ["encode", 2400, 1800, "image/jpeg", 0.88]);
  assert.equal(h.closed(), true);
});

test("si la foto reducida pasa de 4 MB se codifica otra vez con menos calidad", async () => {
  const big = 4 * 1024 * 1024 + 1;
  const h = imageHarness({ sizes: [big, 1000] });
  const result = await h.shrinkImage(fileOfSize(100));
  assert.equal(result.size, 1000);
  assert.deepEqual(h.events.filter(e => e[0] === "encode").map(e => e[4]), [0.88, 0.7]);
  const heavy = imageHarness({ sizes: [big, big] });
  await assert.rejects(heavy.shrinkImage(fileOfSize(4 * 1024 * 1024 + 1)), { message: "No se pudo preparar la foto. Prueba con otra en JPG o PNG." });
});

function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}

const shrinkModule = load("src/components/shrink-image.ts");

function uiHarness(gallery, shrink, upload) {
  const cells = [], jobs = [], previews = [], revoked = [];
  let index = 0, pending = false;
  const state = initial => {
    const i = index++;
    if (!(i in cells)) cells[i] = initial;
    return [cells[i], value => { cells[i] = value; }];
  };
  const jsx = (type, props) => ({ type, props });
  const api = load(gallery ? "src/app/panel/galeria/gallery-manager.tsx" : "src/components/photo.tsx", {
    URL: { createObjectURL(file) { previews.push(file); return "blob:preview"; }, revokeObjectURL(url) { revoked.push(url); } },
  }, {
    react: {
      useState: state, useRef: value => state({ current: value })[0], useEffect() {},
      useTransition: () => [pending, action => {
        pending = true;
        jobs.push(action().finally(() => { pending = false; }));
      }],
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "@/components/ui": { cx: () => "" },
    "@/components/photo": { Img: "img" },
    "@/components/shrink-image": { ...shrinkModule, shrinkImage: shrink },
    "@/app/actions/photos": { addGalleryPhoto: upload },
  });
  const render = () => {
    index = 0;
    return gallery ? api.GalleryManager({ photos: [], max: 12 }) : api.PhotoPicker({ label: "Foto", hint: "", url: null, fallback: "F", shape: "square", fields: { barberId: "mine" }, upload });
  };
  const input = nodes(render()).find(n => n.props?.type === "file");
  const element = { value: "foto.png" };
  input.props.ref.current = element;
  return { render, input, element, jobs, previews, revoked };
}

for (const gallery of [false, true]) {
  test(`${gallery ? "GalleryManager" : "PhotoPicker"} espera la compresión antes de subir y mantiene pending`, async () => {
    let finish;
    const prepared = new Promise(resolve => { finish = resolve; });
    const uploads = [];
    const original = fileOfSize(100), jpeg = new File(["jpeg"], "foto.jpg", { type: "image/jpeg" });
    const h = uiHarness(gallery, file => { assert.equal(file, original); return prepared; }, async data => { uploads.push(data); return { ok: true }; });
    h.input.props.onChange({ target: { files: [original] } });
    assert.equal(uploads.length, 0);
    assert.equal(nodes(h.render()).find(n => n.props?.type === "file").props.disabled, true);
    if (!gallery) assert.deepEqual(h.previews, [original]);
    finish(jpeg);
    await Promise.all(h.jobs);
    assert.equal(uploads[0].get("photo"), jpeg);
    if (!gallery) {
      assert.equal(uploads[0].get("barberId"), "mine");
      assert.deepEqual(h.revoked, ["blob:preview"]);
    }
    assert.equal(h.element.value, "");
    assert.equal(nodes(h.render()).find(n => n.props?.type === "file").props.disabled, false);
  });

  for (const message of ["La foto pesa más de 25 MB.", "No se pudo preparar la foto. Prueba con otra en JPG o PNG.", "network failure"]) {
    test(`${gallery ? "GalleryManager" : "PhotoPicker"} muestra error seguro y limpia estado: ${message}`, async () => {
      const network = message === "network failure";
      const h = uiHarness(gallery, async file => {
        if (!network) throw new shrinkModule.ShrinkImageError(message);
        return file;
      }, async () => { assert.ok(network); throw new Error(message); });
      h.input.props.onChange({ target: { files: [fileOfSize(100)] } });
      await Promise.all(h.jobs);
      const tree = h.render();
      assert.equal(nodes(tree).find(n => n.props?.role === "alert").props.children, network ? "No se pudo guardar la foto. Inténtalo de nuevo." : message);
      assert.equal(h.element.value, "");
      assert.equal(nodes(tree).find(n => n.props?.type === "file").props.disabled, false);
      assert.ok(!nodes(tree).some(n => n.props?.children === "Subiendo…"));
    });
  }
}
