"use client";

import { startTransition, useActionState, useState, type ChangeEvent } from "react";
import { saveSettings } from "@/app/actions/panel";
import { Button, Field, Notice, inputClass } from "@/components/ui";
import { RuleField } from "./rule-field";

type Shop = {
  name: string;
  slug: string;
  phone: string;
  address: string;
  slotMinutes: number;
  leadTimeMinutes: number;
  bookingWindowDays: number;
  reminderHours: number;
};

type Values = { [K in keyof Shop]: string };

export function SettingsForm({ shop, base }: { shop: Shop; base: string }) {
  const [state, action, pending] = useActionState(saveSettings, undefined);
  // React 19 reinicia los formularios enviados con `action={...}` y los <select>
  // vuelven a la opción con la que se cargó la página, aunque ya se haya
  // guardado otra. Enviamos desde onSubmit para que no haya reinicio y los
  // campos sigan mostrando lo que el usuario acaba de guardar.
  const [values, setValues] = useState<Values>(() => ({
    name: shop.name,
    slug: shop.slug,
    phone: shop.phone,
    address: shop.address,
    slotMinutes: String(shop.slotMinutes),
    leadTimeMinutes: String(shop.leadTimeMinutes),
    bookingWindowDays: String(shop.bookingWindowDays),
    reminderHours: String(shop.reminderHours),
  }));
  const bind = (name: keyof Values) => ({
    name,
    value: values[name],
    onChange: (ev: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setValues((v) => ({ ...v, [name]: ev.target.value })),
  });
  const rule = (name: keyof Values) => ({
    name,
    value: values[name],
    onChange: (value: string) => setValues((v) => ({ ...v, [name]: value })),
  });
  const e = state?.errors ?? {};

  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        const data = new FormData(ev.currentTarget);
        startTransition(() => action(data));
      }}
      className="grid gap-4 max-w-xl"
    >
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      <Field label="Nombre de la barbería" error={e.name}>
        <input {...bind("name")} required className={inputClass} />
      </Field>
      <Field label="Enlace" hint={`${base.replace(/^https?:\/\//, "")}/b/…`} error={e.slug}>
        <input {...bind("slug")} required autoCapitalize="none" className={inputClass} />
      </Field>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Teléfono" error={e.phone}>
          <input {...bind("phone")} type="tel" className={inputClass} />
        </Field>
        <Field label="Dirección" error={e.address}>
          <input {...bind("address")} autoComplete="street-address" className={inputClass} />
        </Field>
      </div>

      <h2 className="font-medium mt-4">Reglas de reserva</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        <RuleField
          label="Turnos cada"
          {...rule("slotMinutes")}
          presets={[5, 10, 15, 20, 30, 60].map((n) => ({ value: n, label: `${n} minutos` }))}
          units={[{ label: "minutos", factor: 1 }]}
          limits="Entre 5 y 120 minutos."
          error={e.slotMinutes}
        />
        <RuleField
          label="Antelación mínima"
          {...rule("leadTimeMinutes")}
          presets={[
            { value: 0, label: "Sin mínimo" },
            { value: 30, label: "30 minutos" },
            { value: 60, label: "1 hora" },
            { value: 120, label: "2 horas" },
            { value: 240, label: "4 horas" },
            { value: 720, label: "12 horas" },
            { value: 1440, label: "1 día" },
          ]}
          units={[
            { label: "minutos", factor: 1 },
            { label: "horas", factor: 60 },
            { label: "días", factor: 1440 },
          ]}
          limits="Entre 0 minutos y 7 días."
          error={e.leadTimeMinutes}
        />
        <RuleField
          label="Reservas hasta"
          {...rule("bookingWindowDays")}
          presets={[3, 7, 10, 14, 15].map((n) => ({ value: n, label: `${n} días adelante` }))}
          units={[{ label: "días", factor: 1 }]}
          limits="Entre 1 y 15 días."
          error={e.bookingWindowDays}
        />
        <RuleField
          label="Recordatorio"
          {...rule("reminderHours")}
          presets={[2, 3, 6, 12, 24, 48].map((n) => ({ value: n, label: `${n} horas antes` }))}
          units={[{ label: "horas", factor: 1 }]}
          limits="Entre 1 y 72 horas antes."
          error={e.reminderHours}
        />
      </div>
      <div className="flex items-center gap-3 mt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
        {state?.ok && !pending && <span className="text-sm text-ok">Guardado</span>}
      </div>
    </form>
  );
}
