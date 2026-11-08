import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const forms = [
  ["(auth)/registro/signup-form", "SignupForm", {}],
  ["(auth)/ingresar/login-form", "LoginForm", {}],
  ["(auth)/recuperar/recovery-form", "RecoveryForm", {}],
  ["(auth)/restablecer/[token]/reset-form", "ResetForm", { token: "token" }],
  ["(auth)/cambiar-contrasena/password-form", "PasswordForm", { requireCurrent: true }],
  ["(auth)/completar-whatsapp/whatsapp-form", "WhatsAppForm", { countryCode: "57" }],
  ["panel/servicios/service-form", "ServiceForm", { currency: "COP" }],
  ["panel/equipo/new-barber-form", "NewBarberForm", {}],
  ["panel/equipo/[id]/barber-form", "BarberForm", { barber: { id: "barber", hours: [] }, isOwner: true }],
  ["panel/equipo/[id]/time-off-form", "TimeOffForm", { barberId: "barber", today: "2026-11-08" }],
  ["panel/equipo/[id]/access-form", "AccessForm", { barberId: "barber", account: null, canLinkSelf: true }],
];

// Comprobamos el contrato del envío sin montar un servidor ni usar acciones reales.
function render(file, name, props, state = { error: "Revisa los datos.", message: "Revisa los datos." }, redirect = false) {
  const calls = [], effects = [], refs = [];
  let transitioning = false;
  const react = {
    useActionState: () => [state, (data) => {
      assert.equal(transitioning, true);
      calls.push(data);
      if (redirect) throw new Error("NEXT_REDIRECT");
    }, false],
    startTransition: (fn) => { transitioning = true; try { fn(); } finally { transitioning = false; } },
    useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}],
    useRef: (initial) => { const ref = { current: initial }; refs.push(ref); return ref; },
    useEffect: (effect) => effects.push(effect),
    useSyncExternalStore: (_, snapshot) => snapshot(),
  };
  const exports = {};
  const output = ts.transpileModule(fs.readFileSync(`src/app/${file}.tsx`, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(output, { exports, Intl, confirm: () => true,
    FormData: class { constructor(form) { this.values = { ...form.values }; } },
    require: (id) => {
      if (id === "react") return react;
      if (id.startsWith("@/app/actions/")) return new Proxy({}, { get: () => () => {} });
      if (id === "@/components/ui") return { Button: "button", Field: "fieldset", Notice: "aside" };
      if (id === "@/lib/business-types") return { BUSINESS_TYPES: [], businessTypeLabel: (value) => value };
      if (id === "@/lib/time") return { WEEKDAYS: ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"], minutesToHHMM: () => "09:00" };
      if (id === "next/link") return "a";
      return require(id);
    },
  });
  const tree = exports[name](props);
  function findForms(node) {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(findForms);
    return [...(node.type === "form" ? [node] : []), ...findForms(node.props?.children)];
  }
  return { forms: findForms(tree), calls, effects, refs };
}

for (const [file, name, props] of forms) test(`${name} conserva los campos al enviar y mantiene el contexto de transición`, () => {
  const h = render(file, name, props);
  assert.ok(h.forms.length > 0, "El error no debe desmontar el formulario");
  for (const element of h.forms) {
    const form = { values: { name: "Nombre escrito", password: "Contraseña escrita" }, reset() { assert.fail("No debe limpiar al enviar"); } };
    let prevented = false;
    assert.equal(element.props.action, undefined);
    element.props.onSubmit({ currentTarget: form, preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.deepEqual(h.calls.at(-1).values, form.values);
  }
});

test("Nuevo profesional solo reinicia tras guardar correctamente", () => {
  const [file, name, props] = forms.find(([, name]) => name === "NewBarberForm");
  for (const ok of [false, true]) {
    const h = render(file, name, props, ok ? { ok: true } : { error: "No guardado" });
    let resets = 0;
    h.refs[0].current = { reset() { resets++; } };
    for (const effect of h.effects) effect();
    assert.equal(resets, ok ? 1 : 0);
  }
});

test("El envío no absorbe la redirección de la acción", () => {
  const h = render(...forms[1], undefined, true);
  assert.throws(() => h.forms[0].props.onSubmit({ currentTarget: { values: {} }, preventDefault() {} }), /NEXT_REDIRECT/);
});
