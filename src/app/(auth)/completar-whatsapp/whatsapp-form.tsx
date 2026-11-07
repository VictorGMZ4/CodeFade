"use client";

import { useActionState } from "react";
import { saveMyWhatsApp } from "@/app/actions/panel";
import { Button, Field, Notice, inputClass } from "@/components/ui";

export function WhatsAppForm({ countryCode }: { countryCode: string }) {
  const [state, action, pending] = useActionState(saveMyWhatsApp, undefined);
  return (
    <form action={action} className="grid gap-4">
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      <Field label="Tu WhatsApp" hint={`Si no empieza por +, se usará el prefijo +${countryCode}.`} error={state?.errors?.phone}>
        <input
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          placeholder={`+${countryCode} …`}
          className={inputClass}
          aria-invalid={!!state?.errors?.phone}
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar y continuar"}
      </Button>
    </form>
  );
}
