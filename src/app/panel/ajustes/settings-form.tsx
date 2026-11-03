"use client";

import { useActionState } from "react";
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

export function SettingsForm({ shop, base }: { shop: Shop; base: string }) {
  const [state, action, pending] = useActionState(saveSettings, undefined);
  const e = state?.errors ?? {};

  return (
    <form action={action} className="grid gap-4 max-w-xl">
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      <Field label="Nombre de la barbería" error={e.name}>
        <input name="name" defaultValue={shop.name} required className={inputClass} />
      </Field>
      <Field label="Enlace" hint={`${base.replace(/^https?:\/\//, "")}/b/…`} error={e.slug}>
        <input name="slug" defaultValue={shop.slug} required autoCapitalize="none" className={inputClass} />
      </Field>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Teléfono" error={e.phone}>
          <input name="phone" type="tel" defaultValue={shop.phone} className={inputClass} />
        </Field>
        <Field label="Dirección" error={e.address}>
          <input name="address" defaultValue={shop.address} autoComplete="street-address" className={inputClass} />
        </Field>
      </div>

      <h2 className="font-medium mt-4">Reglas de reserva</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Turnos cada" error={e.slotMinutes}>
          <select name="slotMinutes" defaultValue={shop.slotMinutes} className={inputClass}>
            {[5, 10, 15, 20, 30, 60].map((n) => (
              <option key={n} value={n}>
                {n} minutos
              </option>
            ))}
          </select>
        </Field>
        <Field label="Antelación mínima" error={e.leadTimeMinutes}>
          <select name="leadTimeMinutes" defaultValue={shop.leadTimeMinutes} className={inputClass}>
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
          <select name="bookingWindowDays" defaultValue={shop.bookingWindowDays} className={inputClass}>
            {[7, 14, 30, 60, 90].map((n) => (
              <option key={n} value={n}>
                {n} días adelante
              </option>
            ))}
          </select>
        </Field>
        <Field label="Recordatorio" error={e.reminderHours}>
          <select name="reminderHours" defaultValue={shop.reminderHours} className={inputClass}>
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
