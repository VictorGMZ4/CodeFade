"use client";

import { startTransition, useActionState, useState, useSyncExternalStore } from "react";
import { signup } from "@/app/actions/auth";
import { BUSINESS_TYPES, businessTypeLabel } from "@/lib/business-types";
import { Button, Field, Notice, inputClass } from "@/components/ui";

// País → zona horaria, moneda y prefijo. "Otro" deja usar la zona del navegador.
const COUNTRIES = [
  { id: "CO", name: "Colombia", timezone: "America/Bogota", currency: "COP", code: "57" },
  { id: "MX", name: "México", timezone: "America/Mexico_City", currency: "MXN", code: "52" },
  { id: "AR", name: "Argentina", timezone: "America/Argentina/Buenos_Aires", currency: "ARS", code: "54" },
  { id: "CL", name: "Chile", timezone: "America/Santiago", currency: "CLP", code: "56" },
  { id: "PE", name: "Perú", timezone: "America/Lima", currency: "PEN", code: "51" },
  { id: "EC", name: "Ecuador", timezone: "America/Guayaquil", currency: "USD", code: "593" },
  { id: "VE", name: "Venezuela", timezone: "America/Caracas", currency: "USD", code: "58" },
  { id: "DO", name: "República Dominicana", timezone: "America/Santo_Domingo", currency: "DOP", code: "1" },
  { id: "ES", name: "España", timezone: "Europe/Madrid", currency: "EUR", code: "34" },
  { id: "US", name: "Estados Unidos", timezone: "America/New_York", currency: "USD", code: "1" },
];

const noop = () => () => {};

function detectCountry() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return COUNTRIES.find((c) => c.timezone === tz)?.id ?? "CO";
}

export function SignupForm({ defaultShopName }: { defaultShopName?: string }) {
  const [state, action, pending] = useActionState(signup, undefined);
  // Preseleccionamos el país cuya zona coincide con la del navegador (en el servidor, Colombia).
  const detected = useSyncExternalStore(noop, detectCountry, () => "CO");
  const [chosen, setCountryId] = useState<string | null>(null);
  const countryId = chosen ?? detected;
  const country = COUNTRIES.find((c) => c.id === countryId) ?? COUNTRIES[0];

  const e = state?.errors ?? {};

  return (
    <form onSubmit={(ev) => {
        ev.preventDefault();
        const data = new FormData(ev.currentTarget);
        startTransition(() => action(data));
      }} className="grid gap-4">
      {state?.message && <Notice tone="error">{state.message}</Notice>}
      <Field label="Nombre del negocio" error={e.shopName}>
        <input
          name="shopName"
          required
          defaultValue={defaultShopName}
          autoComplete="organization"
          className={inputClass}
          aria-invalid={!!e.shopName}
        />
      </Field>
      <Field label="Tipo de negocio" error={e.businessType}>
        <select name="businessType" required defaultValue="" className={inputClass} aria-invalid={!!e.businessType}>
          <option value="" disabled>Elige una opción</option>
          {BUSINESS_TYPES.map(({ value }) => <option key={value} value={value}>{businessTypeLabel(value)}</option>)}
        </select>
      </Field>
      <Field label="Tu nombre" error={e.name}>
        <input name="name" required autoComplete="name" className={inputClass} aria-invalid={!!e.name} />
      </Field>
      <Field label="Tu WhatsApp" hint="Aquí te avisaremos de cada reserva nueva." error={e.phone}>
        <input
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          placeholder={`+${country.code} …`}
          className={inputClass}
          aria-invalid={!!e.phone}
        />
      </Field>
      <Field label="País" error={e.timezone}>
        <select value={countryId} onChange={(ev) => setCountryId(ev.target.value)} className={inputClass}>
          {COUNTRIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <input type="hidden" name="timezone" value={country.timezone} />
      <input type="hidden" name="currency" value={country.currency} />
      <input type="hidden" name="countryCode" value={country.code} />
      <Field label="Correo" error={e.email}>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          autoCapitalize="none"
          className={inputClass}
          aria-invalid={!!e.email}
        />
      </Field>
      <Field label="Contraseña" hint="Mínimo 8 caracteres." error={e.password}>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
          aria-invalid={!!e.password}
        />
      </Field>
      <label className="flex items-start gap-3 text-[15px] cursor-pointer">
        <input type="checkbox" name="privacy" required className="mt-1 size-5 shrink-0 accent-[var(--brand)]" aria-invalid={!!e.privacy} />
        <span>
          Acepto el{" "}
          <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-ink underline underline-offset-4">
            aviso de privacidad
          </a>
          .{e.privacy && <span className="block text-[14px] text-danger mt-1">{e.privacy[0]}</span>}
        </span>
      </label>
      <Button type="submit" disabled={pending} className="mt-2 h-12">
        {pending ? "Creando…" : "Crear negocio"}
      </Button>
    </form>
  );
}
