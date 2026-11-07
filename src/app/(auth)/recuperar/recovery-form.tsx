"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/app/actions/auth";
import { Button, Field, Notice, inputClass } from "@/components/ui";

export function RecoveryForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);
  return <form action={action} className="grid gap-4">
    {state?.message && <Notice tone="ok">{state.message}</Notice>}
    <Field label="Correo" error={state?.errors?.email}>
      <input name="email" type="email" autoComplete="email" autoCapitalize="none" required className={inputClass} aria-invalid={!!state?.errors?.email} />
    </Field>
    <Button type="submit" disabled={pending}>{pending ? "Enviando…" : "Enviar enlace"}</Button>
  </form>;
}
