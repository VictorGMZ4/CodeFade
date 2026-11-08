"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { addTimeOff } from "@/app/actions/panel";
import { Button, Field, Notice, inputClass } from "@/components/ui";

export function TimeOffForm({ barberId, today }: { barberId: string; today: string }) {
  const [state, action, pending] = useActionState(addTimeOff, undefined);
  const [allDay, setAllDay] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);

  // reset() no toca el estado de React: tras guardar bien, el checkbox controlado
  // vuelve a su valor inicial durante el render (patrón de React para estado previo).
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state?.ok) setAllDay(true);
  }

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} onSubmit={(ev) => {
        ev.preventDefault();
        const data = new FormData(ev.currentTarget);
        startTransition(() => action(data));
      }} className="grid gap-3">
      <input type="hidden" name="barberId" value={barberId} />
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Desde">
          <input type="date" name="fromDay" min={today} defaultValue={today} required className={inputClass} />
        </Field>
        <Field label="Hasta">
          <input type="date" name="toDay" min={today} defaultValue={today} required className={inputClass} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="allDay"
          checked={allDay}
          onChange={(e) => setAllDay(e.target.checked)}
          className="size-5 accent-[var(--accent-ink)]"
        />
        Todo el día
      </label>
      {!allDay && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Hora inicio">
            <input type="time" name="fromTime" defaultValue="09:00" required className={inputClass} />
          </Field>
          <Field label="Hora fin">
            <input type="time" name="toTime" defaultValue="13:00" required className={inputClass} />
          </Field>
        </div>
      )}
      <Field label="Motivo (opcional)">
        <input name="reason" maxLength={100} className={inputClass} />
      </Field>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Guardando…" : "Añadir ausencia"}
      </Button>
    </form>
  );
}
