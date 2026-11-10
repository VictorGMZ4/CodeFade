import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load() {
  const exports = {};
  const source = fs.readFileSync("src/app/_landing/demo-data.ts", "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { exports, Intl, Date, Math, Number, String });
  return exports;
}

// Martes 10 de noviembre de 2026, 9:35 en Bogotá (14:35 UTC).
const TUESDAY_0935 = Date.UTC(2026, 10, 10, 14, 35);

test("Los días del ejemplo empiezan hoy, saltan el domingo y solo muestran horas futuras", () => {
  const { openDays } = load();
  const days = openDays(TUESDAY_0935, null, 30);
  assert.equal(days.length, 5);
  assert.equal(days[0].key, "2026-11-10");
  assert.ok(!days.some((d) => d.key === "2026-11-15"), "el domingo está cerrado");
  // Antelación de una hora: nada antes de las 10:35.
  assert.ok(days[0].slots.every((t) => t >= 10 * 60 + 35));
});

test("Ninguna hora cae en el almuerzo ni se pasa del cierre según la duración", () => {
  const { openDays } = load();
  for (const day of openDays(TUESDAY_0935, null, 50)) {
    for (const t of day.slots) {
      const end = t + 50;
      assert.ok((t >= 9 * 60 && end <= 13 * 60) || (t >= 14 * 60 && end <= 19 * 60), `${day.key} ${t}`);
    }
  }
});

test("Un profesional concreto tiene menos horas libres que «el primero libre»", () => {
  const { openDays } = load();
  const any = openDays(TUESDAY_0935, null, 30)[1].slots.length;
  const one = openDays(TUESDAY_0935, "andres", 30)[1].slots.length;
  assert.ok(one <= any);
});

test("Las líneas de servicios aceptan formatos sueltos y tienen valores por defecto", () => {
  const { parseServiceLine, formatTime } = load();
  assert.deepEqual({ ...parseServiceLine("Uñas, 60 min, $55.000") }, { id: "Uñas", name: "Uñas", minutes: 60, price: 55000 });
  assert.deepEqual({ ...parseServiceLine("Masaje") }, { id: "Masaje", name: "Masaje", minutes: 30, price: 0 });
  assert.equal(parseServiceLine("  "), null);
  assert.equal(parseServiceLine("Corte, 9999 min, 1").minutes, 30);
  assert.equal(formatTime(9 * 60 + 5), "9:05");
});
