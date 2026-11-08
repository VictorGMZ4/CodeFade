"use client";

import { startTransition, useActionState } from "react";
import { changePassword } from "@/app/actions/auth";
import { Button, Field, Notice, inputClass } from "@/components/ui";

export function PasswordForm({ requireCurrent }: { requireCurrent: boolean }) {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return <form onSubmit={(ev) => {
        ev.preventDefault();
        const data = new FormData(ev.currentTarget);
        startTransition(() => action(data));
      }} className="grid gap-4">
    {state?.message && <Notice tone="error">{state.message}</Notice>}
    {requireCurrent && <Field label="Contraseña actual" error={state?.errors?.current}>
      <input name="current" type="password" autoComplete="current-password" required className={inputClass} aria-invalid={!!state?.errors?.current} />
    </Field>}
    <Field label="Contraseña nueva" error={state?.errors?.password} hint="Mínimo 8 caracteres.">
      <input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={100} className={inputClass} aria-invalid={!!state?.errors?.password} />
    </Field>
    <Field label="Confirmar contraseña" error={state?.errors?.confirmation}>
      <input name="confirmation" type="password" autoComplete="new-password" required minLength={8} maxLength={100} className={inputClass} aria-invalid={!!state?.errors?.confirmation} />
    </Field>
    <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar contraseña"}</Button>
  </form>;
}
