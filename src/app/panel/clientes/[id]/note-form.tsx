"use client";

import { startTransition, useActionState, useState } from "react";
import { saveCustomerNote } from "@/app/actions/customers";
import { Button, Field, Notice, inputClass } from "@/components/ui";

export function NoteForm({ id, notes }: { id: string; notes: string | null }) {
  const [value, setValue] = useState(notes ?? "");
  const [edited, setEdited] = useState(false);
  const [state, action, pending] = useActionState(saveCustomerNote, undefined);
  return <form className="grid gap-3" onSubmit={ev => {
    ev.preventDefault();
    const data = new FormData(ev.currentTarget);
    setEdited(false);
    startTransition(() => action(data));
  }}>
    <input type="hidden" name="id" value={id} />
    <Field label="Nota interna" hint={`${value.length}/500 caracteres`} error={state?.errors?.notes}>
      <textarea name="notes" maxLength={500} value={value} disabled={pending} onChange={ev => { setValue(ev.target.value); setEdited(true); }} className={`${inputClass} h-32! py-3 resize-y`} />
    </Field>
    {state?.error && <Notice tone="error">{state.error}</Notice>}
    {state?.ok && !pending && !edited && <Notice tone="ok">Guardado</Notice>}
    <Button type="submit" disabled={pending} className="justify-self-start">{pending ? "Guardando…" : "Guardar nota"}</Button>
  </form>;
}
