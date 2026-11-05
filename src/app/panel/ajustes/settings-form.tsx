"use client";

import { startTransition, useActionState, useState, type ChangeEvent } from "react";
import { saveSettings } from "@/app/actions/panel";
import { Button, Field, Notice, inputClass } from "@/components/ui";

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
        <Field label="Turnos cada" error={e.slotMinutes}>
          <select {...bind("slotMinutes")} className={inputClass}>
            {[5, 10, 15, 20, 30, 60].map((n) => (
              <option key={n} value={n}>
                {n} minutos
              </option>
            ))}
          </select>
        </Field>
        <Field label="Antelación mínima" error={e.leadTimeMinutes}>
          <select {...bind("leadTimeMinutes")} className={inputClass}>
            {[
              [0, "Sin mínimo"],
              [30, "30 minutos"],
              [60, "1 hora"],
              [120, "2 horas"],
              [240, "4 horas"],
              [720, "12 horas"],
              [1440, "1 día"],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Reservas hasta" error={e.bookingWindowDays}>
          <select {...bind("bookingWindowDays")} className={inputClass}>
            {[7, 14, 30, 60, 90].map((n) => (
              <option key={n} value={n}>
                {n} días adelante
              </option>
            ))}
          </select>
        </Field>
        <Field label="Recordatorio" error={e.reminderHours}>
          <select {...bind("reminderHours")} className={inputClass}>
            {[2, 3, 6, 12, 24, 48].map((n) => (
              <option key={n} value={n}>
                {n} horas antes
              </option>
            ))}
          </select>
        </Field>
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
