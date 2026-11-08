"use client";

import { startTransition, useActionState } from "react";
import Link from "next/link";
import { resetPassword } from "@/app/actions/auth";
import { Button, Field, Notice, inputClass } from "@/components/ui";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword.bind(null, token), undefined);
  // Con el enlace caducado o usado no tiene sentido volver a intentarlo.
  const locked = pending || !!state?.invalidToken;
  return <form onSubmit={(ev) => {
        ev.preventDefault();
        const data = new FormData(ev.currentTarget);
        startTransition(() => action(data));
      }} className="grid gap-4">
    {state?.message && <>
      <Notice tone="error">{state.message}</Notice>
      <Link href="/recuperar" className="inline-block text-accent-ink underline underline-offset-4">Pedir un enlace nuevo</Link>
    </>}
    <Field label="Contraseña nueva" error={state?.errors?.password} hint="Entre 8 y 100 caracteres.">
      <input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={100} disabled={locked} className={inputClass} aria-invalid={!!state?.errors?.password} />
    </Field>
    <Field label="Confirmar contraseña" error={state?.errors?.confirmation}>
      <input name="confirmation" type="password" autoComplete="new-password" required minLength={8} maxLength={100} disabled={locked} className={inputClass} aria-invalid={!!state?.errors?.confirmation} />
    </Field>
    <Button type="submit" disabled={locked}>{pending ? "Guardando…" : "Guardar contraseña"}</Button>
  </form>;
}
