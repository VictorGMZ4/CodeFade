import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load() {
  const exports = {};
  const source = fs.readFileSync("src/lib/search-text.ts", "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(output, { exports });
  return exports;
}

test("Normaliza acentos, mayúsculas y espacios sin alterar el nombre original", () => {
  const { searchText, customerNameFields } = load();
  for (const [input, expected] of [["Julián", "julian"], ["  NÚÑEZ  García ", "nunez garcia"], ["Çé", "ce"], ["Ju\u0301lia\t\n Pérez", "julia perez"], ["", ""]]) {
    assert.equal(searchText(input), expected);
    const fields = customerNameFields(input);
    assert.equal(fields.name, input);
    assert.equal(fields.searchName, expected);
  }
});

test("La búsqueda de teléfono conserva solo dígitos", () => {
  const { searchDigits } = load();
  assert.equal(searchDigits("+57 (300) 123-4567"), "573001234567");
  assert.equal(searchDigits("Ana"), "");
});

test("La migración alinea los caracteres de translate con la normalización", () => {
  const sql = fs.readFileSync("prisma/migrations/20261110090000_customer_search_name/migration.sql", "utf8");
  const mapping = sql.match(/translate\(\s*normalize\("name", NFC\)\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/i);
  assert.ok(mapping);
  const [, accents, bases] = mapping;
  assert.equal([...accents].length, [...bases].length);
  // Simula el SQL: NFC, translate, lower y espacios colapsados.
  const translate = value => [...value.normalize("NFC")].map(char => accents.includes(char) ? bases[accents.indexOf(char)] : char)
    .join("").toLowerCase().replace(/\s+/g, " ").trim();
  const { searchText } = load();
  assert.equal(translate("ÁÉÍÓÚÜÑáéíóúüñ"), searchText("ÁÉÍÓÚÜÑáéíóúüñ"));
  assert.equal(translate(accents), searchText(accents));
  // Nombres reales con letras fuera del español y escritos en forma NFD.
  for (const name of ["João", "Antônio", "Zoë Ýñiguez", "Dvořák", "Júlia  Pérez"]) {
    assert.equal(translate(name), searchText(name), name);
  }
  // Toda letra latina con diacrítico (U+00C0–U+017F) que JS reduce a una base ASCII está cubierta.
  for (let code = 0xc0; code <= 0x17f; code++) {
    const char = String.fromCodePoint(code);
    if (/^[a-z]$/i.test(char.normalize("NFD").replace(/\p{M}/gu, "")) && char.normalize("NFD") !== char) {
      assert.equal(translate(char), searchText(char), `U+${code.toString(16)}`);
    }
  }
});
