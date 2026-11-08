"use client";

import { startTransition, useActionState } from "react";
import { login } from "@/app/actions/auth";
import { Button, Field, Notice, inputClass } from "@/components/ui";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  const e = state?.errors ?? {};

  return (
    <form onSubmit={(ev) => {
        ev.preventDefault();
        const data = new FormData(ev.currentTarget);
        startTransition(() => action(data));
      }} className="grid gap-4">
      {state?.message && <Notice tone="error">{state.message}</Notice>}
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
      <Field label="Contraseña" error={e.password}>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
          aria-invalid={!!e.password}
        />
      </Field>
      <Button type="submit" disabled={pending} className="mt-2 h-12">
        {pending ? "Entrando…" : "Ingresar"}
      </Button>
    </form>
  );
}
