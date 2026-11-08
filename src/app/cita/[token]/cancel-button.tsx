"use client";

import { useState, useTransition } from "react";
import { buttonClass } from "@/components/ui";
import { cancelByToken } from "./actions";

export function CancelButton({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm("¿Seguro que quieres cancelar la cita?")) start(async () => {
          setError(null);
          try {
            const result = await cancelByToken(token);
            if ("error" in result) setError(result.error);
          } catch {
            setError("No se pudo cancelar la cita. Inténtalo de nuevo.");
          }
        });
      }}
      className={buttonClass("danger", "h-12")}
    >
      {pending ? "Cancelando…" : "Cancelar cita"}
    </button>
    {error && <p role="alert" className="text-danger">{error}</p>}
    </>
  );
}
