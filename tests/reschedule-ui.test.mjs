import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const root = "src/app/cita/[token]/reprogramar/";
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function harness(actions) {
  const cells = [], effects = [], jobs = [], paths = [];
  let index = 0;
  const state = initial => {
    const i = index++;
    if (!(i in cells)) cells[i] = initial;
    return [cells[i], next => { cells[i] = typeof next === "function" ? next(cells[i]) : next; }];
  };
  const transition = fn => { const job = fn(); if (job?.then) jobs.push(job); };
  const react = { useState: state, useRef: value => state({ current: value })[0], useTransition: () => [false, transition],
    useEffect: fn => { const i = index++; if (!(i in cells)) { cells[i] = true; effects.push(fn); } } };
  const jsx = (type, props) => ({ type, props });
  const mocks = { react, "react/jsx-runtime": { jsx, jsxs: jsx }, "next/navigation": { useRouter: () => ({ replace: path => paths.push(path) }) },
    "../actions": actions, "@/app/b/[slug]/month-calendar": {}, "@/components/photo": {},
    "@/components/ui": { Card: "Card", Notice: "Notice", buttonClass: () => "", cx: () => "" } };
  const load = file => {
    const exports = {};
    const output = ts.transpileModule(fs.readFileSync(root + file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    vm.runInNewContext(output, { exports, Intl, require: id => { assert.ok(id in mocks, id); return mocks[id]; } });
    return exports;
  };
  mocks["./use-reschedule-availability"] = load("use-reschedule-availability.ts");
  mocks["./reschedule-choices"] = load("reschedule-choices.tsx");
  const flow = load("reschedule-flow.tsx");
  const render = fn => { index = 0; const result = fn(); while (effects.length) effects.shift()(); return result; };
  return { jobs, paths,
    availability: () => render(() => mocks["./use-reschedule-availability"].useRescheduleAvailability("token", "old")),
    flow: () => render(() => flow.RescheduleFlow({ token: "token", currentBarberId: "old", timezone: "UTC", barbers: [] })),
  };
}
const nodes = tree => !tree || typeof tree !== "object" ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const open = day => ({ days: [day], firstSlots: [`${day}T12:00:00Z`] });

test("Reprogramación ignora días y horarios del profesional anterior", async () => {
  const old = deferred(), next = deferred(), staleSlots = deferred();
  const h = harness({ fetchRescheduleDays: (_token, id) => id === "old" ? old.promise : next.promise, fetchRescheduleSlots: () => staleSlots.promise });
  let a = h.availability();
  a.loadSlots("2027-01-01");
  a.loadDays("new");
  next.resolve(open("2027-02-01")); await Promise.resolve();
  old.resolve(open("2027-01-01")); staleSlots.resolve(["2027-01-01T13:00:00Z"]);
  await Promise.all(h.jobs);
  a = h.availability();
  assert.equal(a.barberId, "new");
  assert.equal(a.day, "2027-02-01");
  assert.equal(a.slots[0], "2027-02-01T12:00:00Z");
});

test("Reprogramación conserva el día elegido ante respuesta inicial tardía", async () => {
  const days = deferred();
  const h = harness({ fetchRescheduleDays: () => days.promise, fetchRescheduleSlots: async () => ["2027-01-02T15:00:00Z"] });
  h.availability().loadSlots("2027-01-02");
  days.resolve(open("2027-01-01")); await Promise.all(h.jobs);
  assert.equal(h.availability().day, "2027-01-02");
  assert.equal(h.availability().slots[0], "2027-01-02T15:00:00Z");
});

test("Formulario mantiene la selección ante error y solo recarga horarios con SLOT_TAKEN", async () => {
  for (const code of [undefined, "SLOT_TAKEN"]) {
    let reads = 0, submitted;
    const h = harness({ fetchRescheduleDays: async () => open("2027-01-01"),
      fetchRescheduleSlots: async () => { reads++; return []; },
      rescheduleByToken: async (...args) => { submitted = args; return { ok: false, error: "Error de prueba", code }; } });
    h.flow(); await Promise.all(h.jobs);
    let tree = h.flow();
    nodes(tree).find(n => n.props?.availability).props.onSelect("2027-01-01T12:00:00Z");
    tree = h.flow();
    let prevented = false;
    tree.props.onSubmit({ preventDefault() { prevented = true; } });
    await Promise.all(h.jobs);
    tree = h.flow();
    assert.equal(prevented, true);
    assert.equal(submitted[1], "old");
    assert.equal(reads, code ? 1 : 0);
    assert.ok(nodes(tree).some(n => n.type === "Notice" && n.props.tone === "error" && n.props.children === "Error de prueba"));
    assert.equal(nodes(tree).find(n => n.props?.availability).props.availability.start, code ? null : "2027-01-01T12:00:00Z");
  }
});

test("Formulario reemplaza la ruta al confirmar el cambio", async () => {
  const h = harness({ fetchRescheduleDays: async () => open("2027-01-01"), rescheduleByToken: async () => ({ ok: true }) });
  h.flow(); await Promise.all(h.jobs);
  nodes(h.flow()).find(n => n.props?.availability).props.onSelect("2027-01-01T12:00:00Z");
  h.flow().props.onSubmit({ preventDefault() {} }); await Promise.all(h.jobs);
  assert.deepEqual(h.paths, ["/cita/token?cambiada=1"]);
});
