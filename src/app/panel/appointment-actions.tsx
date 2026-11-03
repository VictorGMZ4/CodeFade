"use client";

import { useState, useTransition } from "react";
import { setAppointmentStatus } from "@/app/actions/panel";

type Status = "BOOKED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

export function AppointmentActions({ id, status, isPast }: { id: string; status: Status; isPast: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const set = (next: Status, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setError(null);
    startTransition(async () => {
      const result = await setAppointmentStatus(id, next);
      if (result?.error) setError(result.error);
    });
  };

  const button = "press font-medium disabled:opacity-50";

  return (
    <>
      {status === "BOOKED" && isPast && (
        <>
          <button disabled={pending} onClick={() => set("COMPLETED")} className={`${button} text-ink`}>
            Atendida
          </button>
          <button disabled={pending} onClick={() => set("NO_SHOW")} className={`${button} text-muted`}>
            No vino
          </button>
        </>
      )}
      {status === "BOOKED" && (
        <button
          disabled={pending}
          onClick={() => set("CANCELLED", "¿Cancelar esta cita? El horario quedará libre.")}
          className={`${button} text-danger`}
        >
          Cancelar
        </button>
      )}
      {status !== "BOOKED" && (
        <button disabled={pending} onClick={() => set("BOOKED")} className={`${button} text-muted`}>
          Deshacer
        </button>
      )}
      {error && (
        <span role="alert" className="basis-full text-danger">
          {error}
        </span>
      )}
    </>
  );
}
