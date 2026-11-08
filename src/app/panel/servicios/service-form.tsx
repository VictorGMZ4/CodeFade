"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { saveService } from "@/app/actions/panel";
import { Button, Field, Notice, inputClass } from "@/components/ui";

type Service = { id: string; name: string; durationMin: number; priceCents: number };

export function ServiceForm({ service, currency }: { service?: Service; currency: string }) {
  const [state, action, pending] = useActionState(saveService, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const e = state?.errors ?? {};

  // Al crear, dejamos el formulario limpio para añadir el siguiente.
  useEffect(() => {
    if (state?.ok && !service) formRef.current?.reset();
  }, [state, service]);

  return (
    <form ref={formRef} onSubmit={(ev) => {
        ev.preventDefault();
        const data = new FormData(ev.currentTarget);
        startTransition(() => action(data));
      }} className="grid gap-3">
      {service && <input type="hidden" name="id" value={service.id} />}
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      <Field label="Nombre" error={e.name}>
        <input
          name="name"
          required
          defaultValue={service?.name}
          placeholder="Corte clásico"
          className={inputClass}
          aria-invalid={!!e.name}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Duración (min)" error={e.durationMin}>
          <input
            name="durationMin"
            type="number"
            inputMode="numeric"
            min={5}
            max={480}
            step={5}
            required
            defaultValue={service?.durationMin ?? 30}
            className={inputClass}
            aria-invalid={!!e.durationMin}
          />
        </Field>
        <Field label={`Precio (${currency})`} error={e.price}>
          <input
            name="price"
            inputMode="decimal"
            required
            defaultValue={service ? String(service.priceCents / 100) : ""}
            placeholder="25000"
            className={inputClass}
            aria-invalid={!!e.price}
          />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} variant={service ? "secondary" : "primary"}>
          {pending ? "Guardando…" : service ? "Guardar cambios" : "Añadir servicio"}
        </Button>
        {state?.ok && !pending && <span className="text-sm text-ok">Guardado</span>}
      </div>
    </form>
  );
}
