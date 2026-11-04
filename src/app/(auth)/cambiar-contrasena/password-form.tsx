"use client";

import { useActionState } from "react";
import { changePassword } from "@/app/actions/auth";
import { Button, Field, inputClass } from "@/components/ui";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return <form action={action} className="grid gap-4">
    <Field label="Contraseña nueva" error={state?.errors?.password} hint="Mínimo 8 caracteres.">
      <input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={100} className={inputClass} aria-invalid={!!state?.errors?.password} />
    </Field>
    <Field label="Confirmar contraseña" error={state?.errors?.confirmation}>
      <input name="confirmation" type="password" autoComplete="new-password" required minLength={8} maxLength={100} className={inputClass} aria-invalid={!!state?.errors?.confirmation} />
    </Field>
    <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar contraseña"}</Button>
  </form>;
}
