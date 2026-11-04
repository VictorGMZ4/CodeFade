"use client";

import { useActionState } from "react";
import { createBarberAccount, linkOwnerAccount, removeBarberAccess } from "@/app/actions/barber-access";
import { Button, Field, Notice, inputClass } from "@/components/ui";

type Props = {
  barberId: string;
  account: { id: string; email: string } | null;
  isSelf: boolean;
  canLinkSelf: boolean;
};

export function AccessForm({ barberId, account, isSelf, canLinkSelf }: Props) {
  const [created, create, creating] = useActionState(createBarberAccount, undefined);
  const [linked, link, linking] = useActionState(linkOwnerAccount, undefined);
  const [removed, remove, removing] = useActionState(removeBarberAccess, undefined);
  if (account) return <div className="grid gap-3">
    <p className="text-sm break-all">{account.email}</p>
    <form action={remove} onSubmit={(event) => {
      if (!confirm(isSelf ? "¿Desvincular tu cuenta de este barbero?" : "¿Quitar a este barbero el acceso al panel?")) event.preventDefault();
    }} className="grid gap-3 justify-items-start">
      <input type="hidden" name="id" value={barberId} />
      {removed?.error && <Notice tone="error">{removed.error}</Notice>}
      <Button type="submit" variant="danger" disabled={removing}>{removing ? "Quitando…" : isSelf ? "Desvincular mi cuenta" : "Quitar acceso"}</Button>
    </form>
  </div>;

  return <div className="grid gap-5">
    <form action={create} className="grid gap-3 max-w-md">
      <input type="hidden" name="id" value={barberId} />
      {created?.error && <Notice tone="error">{created.error}</Notice>}
      <Field label="Correo" error={created?.errors?.email}>
        <input name="email" type="email" required autoComplete="off" autoCapitalize="none" className={inputClass} aria-invalid={!!created?.errors?.email} />
      </Field>
      <Field label="Contraseña temporal" hint="Mínimo 8 caracteres." error={created?.errors?.password}>
        <input name="password" type="password" required minLength={8} maxLength={100} autoComplete="new-password" className={inputClass} aria-invalid={!!created?.errors?.password} />
      </Field>
      <p className="text-sm text-muted">Pásale estos datos al barbero; tendrá que cambiar la contraseña al entrar.</p>
      <Button type="submit" disabled={creating || linking}>{creating ? "Creando…" : "Crear cuenta"}</Button>
    </form>
    {canLinkSelf && <form action={link} className="grid gap-3 justify-items-start border-t border-line pt-5">
      <input type="hidden" name="id" value={barberId} />
      {linked?.error && <Notice tone="error">{linked.error}</Notice>}
      <Button type="submit" variant="secondary" disabled={linking || creating}>{linking ? "Vinculando…" : "Soy yo: vincular mi cuenta"}</Button>
    </form>}
  </div>;
}
