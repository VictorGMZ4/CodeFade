"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPassword } from "@/app/actions/auth";
import { Button, Field, Notice, inputClass } from "@/components/ui";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword.bind(null, token), undefined);
  if (state?.message) return <>
    <Notice tone="error">{state.message}</Notice>
    <Link href="/recuperar" className="inline-block mt-6 text-accent-ink underline underline-offset-4">Pedir un enlace nuevo</Link>
  </>;
  return <form action={action} className="grid gap-4">
    <Field label="Contraseña nueva" error={state?.errors?.password} hint="Entre 8 y 100 caracteres.">
      <input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={100} className={inputClass} aria-invalid={!!state?.errors?.password} />
    </Field>
    <Field label="Confirmar contraseña" error={state?.errors?.confirmation}>
      <input name="confirmation" type="password" autoComplete="new-password" required minLength={8} maxLength={100} className={inputClass} aria-invalid={!!state?.errors?.confirmation} />
    </Field>
    <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar contraseña"}</Button>
  </form>;
}
