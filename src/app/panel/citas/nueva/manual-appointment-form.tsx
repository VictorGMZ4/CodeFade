"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { createManualAppointment, getManualSlots } from "@/app/actions/manual-appointments";
import { Button, Field, Notice, buttonClass, cx, inputClass } from "@/components/ui";
import { formatTime } from "@/lib/time";

type Option = { id: string; name: string };
type Selection = { barberId: string; serviceId: string; day: string };

export function ManualAppointmentForm({ barbers, services, isOwner, day, today, lastDay, timezone }: {
  barbers: Option[]; services: Option[]; isOwner: boolean; day: string; today: string; lastDay: string; timezone: string;
}) {
  const [state, action, pending] = useActionState(createManualAppointment, undefined);
  const [selection, setSelection] = useState<Selection>({ barberId: barbers[0].id, serviceId: services[0].id, day });
  const [start, setStart] = useState("");
  const [retry, setRetry] = useState(0);
  const key = JSON.stringify([selection, retry]);
  const [availability, setAvailability] = useState<{ key: string; slots: string[]; error?: string }>({ key: "", slots: [] });
  const loading = availability.key !== key;
  const e = state?.errors ?? {};

  useEffect(() => {
    let current = true;
    getManualSlots(selection).then((result) => {
      if (current) setAvailability({ key, slots: result.slots.map((slot) => slot.start), error: result.error });
    }).catch(() => {
      if (current) setAvailability({ key, slots: [], error: "No se pudieron cargar las horas. Vuelve a intentarlo." });
    });
    // Una respuesta antigua nunca reemplaza los huecos de la selección actual.
    return () => { current = false; };
  }, [selection, key]);

  function change(field: keyof Selection, value: string) {
    setStart("");
    setSelection((previous) => ({ ...previous, [field]: value }));
  }

  return <form className="grid gap-5" onSubmit={(event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  }}>
    <fieldset disabled={pending} className="contents">
      <Field label="Barbero" error={e.barberId}>
        {isOwner ? <select name="barberId" value={selection.barberId} onChange={(event) => change("barberId", event.target.value)} className={inputClass} aria-invalid={!!e.barberId}>
          {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select> : <><input type="hidden" name="barberId" value={selection.barberId} /><input readOnly value={barbers[0].name} className={inputClass} /></>}
      </Field>
      <Field label="Servicio" error={e.serviceId}>
        <select name="serviceId" value={selection.serviceId} onChange={(event) => change("serviceId", event.target.value)} className={inputClass} aria-invalid={!!e.serviceId}>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <Field label="Día" error={e.day}>
        <input type="date" name="day" required min={today} max={lastDay} value={selection.day} onChange={(event) => change("day", event.target.value)} className={inputClass} aria-invalid={!!e.day} />
      </Field>
      <fieldset className="grid gap-2" aria-busy={loading} aria-describedby={e.start ? "hora-error" : undefined}>
        <legend className="text-[15px] font-semibold mb-2">Hora</legend>
        <input type="hidden" name="start" value={start} />
        {loading ? <div role="status" className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          <span className="sr-only">Cargando horas libres…</span>
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="h-12 rounded-lg bg-raised motion-safe:animate-pulse" />)}
        </div> : availability.error ? <><Notice tone="error">{availability.error}</Notice><Button type="button" variant="secondary" onClick={() => setRetry((n) => n + 1)}>Reintentar</Button></> : availability.slots.length === 0 ? <Notice>No hay horas libres ese día.</Notice> :
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {availability.slots.map((slot) => <button key={slot} type="button" aria-pressed={start === slot} onClick={() => setStart(slot)} className={cx(buttonClass(start === slot ? "primary" : "secondary"), "px-2 tabular-nums")}>
              {formatTime(new Date(slot), timezone)}
            </button>)}
          </div>}
        {e.start && <p id="hora-error" className="text-sm text-danger">{e.start[0]}</p>}
      </fieldset>
      <Field label="Nombre del cliente" error={e.name}>
        <input name="name" required minLength={2} maxLength={60} autoComplete="name" className={inputClass} aria-invalid={!!e.name} />
      </Field>
      <Field label="Teléfono (opcional)" error={e.phone}>
        <input name="phone" type="tel" autoComplete="tel" maxLength={50} className={inputClass} aria-invalid={!!e.phone} />
      </Field>
      <Field label="Notas (opcional)" error={e.notes}>
        <textarea name="notes" maxLength={200} rows={3} className={cx(inputClass, "h-auto py-3 resize-y")} aria-invalid={!!e.notes} />
      </Field>
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      {state?.error && <Button type="button" variant="secondary" onClick={() => { setStart(""); setRetry((n) => n + 1); }}>Actualizar horas</Button>}
      <Button type="submit" disabled={pending || loading || !availability.slots.includes(start)}>{pending ? "Guardando…" : "Guardar cita"}</Button>
    </fieldset>
  </form>;
}
