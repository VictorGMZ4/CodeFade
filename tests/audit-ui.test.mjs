import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Ejecuta los manejadores del componente con estado persistente entre renders.
// Las peticiones se controlan para reproducir respuestas fuera de orden.
function harness(actions, props, file = "src/app/b/[slug]/booking-flow.tsx", component = "BookingFlow") {
  const cells = [], effects = [], jobs = [];
  let index = 0;
  const state = initial => {
    const i = index++;
    if (!(i in cells)) cells[i] = typeof initial === "function" ? initial() : initial;
    return [cells[i], next => { cells[i] = typeof next === "function" ? next(cells[i]) : next; }];
  };
  const transition = fn => { const job = fn(); if (job?.then) jobs.push(job); };
  const react = {
    useState: state,
    useRef: value => state(() => ({ current: value }))[0],
    useId: () => state(() => `id-${index}`)[0],
    useEffect: (fn, deps) => { const i = index++; if (!(i in cells) || deps.some((v, j) => v !== cells[i][j])) { cells[i] = deps; effects.push(fn); } },
    useTransition: () => [false, transition], startTransition: transition,
    useSyncExternalStore: () => "https://example.com",
    useActionState: (fn, initial) => { const [value, set] = state(initial); return [value, async data => { set(await fn(value, data)); }, false]; },
  };
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const jsx = (type, props) => ({ type, props });
  vm.runInNewContext(source, { exports, Intl, requestAnimationFrame: fn => fn(), FormData: class { constructor(form) { this.values = form.values; } }, require: id => {
    if (id === "react") return react;
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (id === "./actions") return actions;
    if (id.startsWith("@/app/actions/")) return actions;
    return new Proxy({}, { get: (_, key) => key === "cx" || key === "buttonClass" ? () => "" : key });
  } });
  return { render: () => { index = 0; const tree = exports[component](props); while (effects.length) effects.shift()(); return tree; }, jobs };
}
function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const props = { slug: "shop", services: [{ id: "s", name: "Corte", price: "$1", duration: "30 min" }], barbers: [{ id: "b", name: "Luis" }], timezone: "UTC" };

test("Regla vacía sigue vacía al inicializar y elegir personalizado", () => {
  const changes = [];
  const h = harness({}, { label: "Antelación", name: "lead", value: "", presets: [], units: [{ label: "minutos", factor: 1 }], onChange: value => changes.push(value) }, "src/app/panel/ajustes/rule-field.tsx", "RuleField");
  let tree = h.render();
  assert.equal(nodes(tree).find(n => n.props?.type === "number").props.value, "");
  nodes(tree).find(n => n.type === "select").props.onChange({ target: { value: "custom" } });
  tree = h.render();
  assert.equal(nodes(tree).find(n => n.props?.type === "number").props.value, "");
  assert.deepEqual(changes, [""]);
});

test("Ausencia guardada restaura todo el día", async () => {
  const h = harness({ addTimeOff: async () => ({ ok: true }) }, { barberId: "b", today: "2027-01-01" }, "src/app/panel/equipo/[id]/time-off-form.tsx", "TimeOffForm");
  let tree = h.render();
  nodes(tree).find(n => n.props?.name === "allDay").props.onChange({ target: { checked: false } });
  tree = h.render();
  tree.props.onSubmit({ preventDefault() {}, currentTarget: { values: {} } });
  await Promise.all(h.jobs); h.render(); tree = h.render();
  assert.equal(nodes(tree).find(n => n.props?.name === "allDay").props.checked, true);
  assert.ok(!nodes(tree).some(n => n.props?.name === "fromTime"));
});

test("Enlace inválido bloquea los campos y permite pedir otro", async () => {
  const h = harness({ resetPassword: async () => ({ message: "Este enlace ya no es válido. Pide uno nuevo.", invalidToken: true }) }, { token: "token" }, "src/app/(auth)/restablecer/[token]/reset-form.tsx", "ResetForm");
  h.render().props.onSubmit({ preventDefault() {}, currentTarget: { values: {} } });
  await Promise.all(h.jobs);
  const tree = h.render();
  for (const field of nodes(tree).filter(n => n.props?.type === "password" || n.props?.type === "submit")) assert.equal(field.props.disabled, true);
  assert.ok(nodes(tree).some(n => n.props?.href === "/recuperar"));
});

test("Anuncio de copiar es hermano del botón", () => {
  const h = harness({}, { url: "/b/shop" }, "src/app/panel/copy-link.tsx", "CopyLink");
  const tree = h.render();
  const button = nodes(tree).find(n => n.props?.onClick);
  assert.ok(!nodes(button).some(n => n.props?.["aria-live"]));
  assert.ok(tree.props.children.some(n => n?.props?.["aria-live"] === "polite"));
});
test("Reserva conserva formulario ante error general y solo recarga con SLOT_TAKEN", async () => {
  for (const code of [undefined, "SLOT_TAKEN"]) {
    let reads = 0;
    const h = harness({ fetchOpenDays: async () => ["2027-01-01"], fetchSlots: async () => { reads++; return ["2027-01-01T12:00:00Z"]; }, book: async () => ({ error: "Mensaje de error", code }) }, props);
    h.render(); await Promise.all(h.jobs);
    let tree = h.render();
    nodes(tree).find(n => n.type === "button" && n.props.children === "12:00").props.onClick();
    tree = h.render();
    const values = { name: "Ana", phone: "+573001234567", email: "ana@example.com", notes: "Nota personal" };
    for (const [name, value] of Object.entries(values)) {
      const field = nodes(tree).find(n => n.props?.name === name);
      assert.equal(typeof field.props.onChange, "function");
      field.props.onChange({ target: { value } });
    }
    tree = h.render();
    const form = nodes(tree).find(n => n.type === "form");
    let prevented = false;
    assert.equal(typeof form.props.onSubmit, "function");
    form.props.onSubmit({ preventDefault: () => { prevented = true; }, currentTarget: { values: { name: "Ana" } } });
    await Promise.all(h.jobs);
    tree = h.render();
    assert.equal(prevented, true);
    assert.equal(reads, code ? 2 : 1);
    assert.equal(nodes(tree).some(n => n.type === "form"), !code);
    assert.ok(nodes(tree).some(n => n.props?.children === "Mensaje de error"));
    nodes(tree).find(n => n.type === "button" && n.props.children === "12:00").props.onClick();
    tree = h.render();
    for (const [name, value] of Object.entries(values)) assert.equal(nodes(tree).find(n => n.props?.name === name).props.value, value);
    assert.ok(!nodes(tree).some(n => n.props?.children === "Mensaje de error"));
  }
});
test("Respuesta antigua de días no cambia el servicio más reciente", async () => {
  const old = deferred(), latest = deferred();
  const reads = [];
  // Las acciones reciben slug primero.
  const actions = { fetchOpenDays: (_slug, service) => service === "s" ? old.promise : latest.promise, fetchSlots: async (_slug, service) => { reads.push(service); return []; } };
  const flow = harness(actions, { ...props, services: [...props.services, { id: "s2", name: "Otro" }] });
  let tree = flow.render();
  nodes(tree).filter(n => n.props?.name === "service")[0].props.onChange();
  tree = flow.render();
  nodes(tree).filter(n => n.props?.name === "service")[1].props.onChange();
  latest.resolve(["2027-02-02"]); await Promise.resolve(); await Promise.resolve();
  old.resolve(["2027-01-01"]); await Promise.all(flow.jobs);
  assert.deepEqual(reads, ["s2"]);
  assert.ok(nodes(flow.render()).some(n => n.props?.selected === "2027-02-02"));
});
test("Respuesta antigua de horarios no reemplaza el día seleccionado", async () => {
  const old = deferred(), latest = deferred();
  const h = harness({ fetchOpenDays: async () => ["2027-01-01", "2027-01-02"], fetchSlots: (_slug, _service, _barber, day) => day === "2027-01-01" ? old.promise : latest.promise }, props);
  h.render(); await h.jobs[0];
  const calendar = nodes(h.render()).find(n => n.props?.onSelect);
  calendar.props.onSelect("2027-01-02");
  latest.resolve(["2027-01-02T14:00:00Z"]); await Promise.resolve(); await Promise.resolve();
  old.resolve(["2027-01-01T12:00:00Z"]); await Promise.all(h.jobs);
  const tree = h.render();
  assert.ok(nodes(tree).some(n => n.type === "button" && n.props.children === "14:00"));
  assert.ok(!nodes(tree).some(n => n.type === "button" && n.props.children === "12:00"));
});
