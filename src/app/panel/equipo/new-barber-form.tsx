"use client";

import { useActionState, useEffect, useRef } from "react";
import { createBarber } from "@/app/actions/panel";
import { Button, Field, Notice, inputClass } from "@/components/ui";

export function NewBarberForm() {
  const [state, action, pending] = useActionState(createBarber, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-3">
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      <Field label="Nombre" error={state?.errors?.name}>
        <input name="name" required className={inputClass} aria-invalid={!!state?.errors?.name} />
      </Field>
      <Field label="WhatsApp" hint="Aquí recibirá los avisos de reservas." error={state?.errors?.phone}>
        <input name="phone" type="tel" required autoComplete="tel" className={inputClass} aria-invalid={!!state?.errors?.phone} />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Añadiendo…" : "Añadir"}
      </Button>
    </form>
  );
}
