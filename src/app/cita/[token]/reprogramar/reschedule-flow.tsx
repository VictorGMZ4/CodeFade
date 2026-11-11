"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Notice, buttonClass } from "@/components/ui";
import { MonthCalendar, SkeletonGrid } from "@/app/b/[slug]/month-calendar";
import { rescheduleByToken } from "../actions";
import { useRescheduleAvailability } from "./use-reschedule-availability";
import { ProfessionalChoices, TimeChoices, dayLabel, timeLabel, type Barber } from "./reschedule-choices";

export function RescheduleFlow({ token, timezone, currentBarberId, barbers }: {
  token: string; timezone: string; currentBarberId: string; barbers: Barber[];
}) {
  const router = useRouter();
  const a = useRescheduleAvailability(token, currentBarberId);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const busy = pending || a.pending;
  async function submit() {
    if (!a.start || busy) return;
    setError("");
    try {
      const result = await rescheduleByToken(token, a.barberId || null, a.start);
      if (result.ok) { router.replace(`/cita/${token}?cambiada=1`); return; }
      setError(result.error);
      if (result.code === "SLOT_TAKEN" && a.day) a.loadSlots(a.day);
    } catch { setError("No se pudo cambiar la cita. Inténtalo de nuevo."); }
  }
  return <form onSubmit={event => { event.preventDefault(); startTransition(submit); }} className="grid gap-4">
    {/* Solo se bloquea al guardar: mientras cargan los horarios se puede cambiar
        de profesional o de día (las respuestas viejas se descartan) sin perder el foco. */}
    <fieldset disabled={pending} className="grid gap-4 min-w-0" aria-busy={busy}>
      <div className="brand-card p-5 sm:p-7"><ProfessionalChoices barbers={barbers} currentBarberId={currentBarberId} value={a.barberId}
        onChange={id => { setError(""); a.loadDays(id); }} /></div>
      <div className="brand-card p-5 sm:p-7 grid gap-4">
        <h2 className="brand-display brand-display-sm">Fecha y hora</h2>
        <AvailabilityChoices availability={a} timezone={timezone} onSelect={start => { a.patch({ start }); setError(""); }} />
      </div>
      <button type="submit" disabled={busy || !a.start} className={buttonClass("primary", "w-full h-auto min-h-12 py-3")}>
        {pending ? "Cambiando tu cita…" : a.day && a.start ? `Cambiar a ${dayLabel(a.day)}, ${timeLabel(a.start, timezone)}` : "Elige fecha y hora"}
      </button>
    </fieldset>
    {(error || a.error) && <Notice tone="error">{error || a.error}</Notice>}
    {a.error && <button type="button" disabled={busy} className={buttonClass("secondary")} onClick={() => a.loadDays(a.barberId)}>Reintentar</button>}
  </form>;
}

function AvailabilityChoices({ availability: a, timezone, onSelect }: {
  availability: ReturnType<typeof useRescheduleAvailability>; timezone: string; onSelect: (iso: string) => void;
}) {
  if (a.days === null) return a.error ? null : <SkeletonGrid count={14} />;
  if (!a.days.length) return <p className="text-muted">No hay horarios disponibles con este profesional. Puedes elegir otro.</p>;
  return <>
    {a.month && <MonthCalendar month={a.month} openDays={a.days} selected={a.day}
      onMonth={month => a.patch({ month })} onSelect={a.loadSlots} label={dayLabel} />}
    {a.slots === null ? <SkeletonGrid count={6} cols="grid-cols-3" />
      : <TimeChoices slots={a.slots} start={a.start} timezone={timezone} onSelect={onSelect} />}
  </>;
}
