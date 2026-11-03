"use client";

import { useTransition } from "react";
import { buttonClass } from "@/components/ui";
import { cancelByToken } from "./actions";

export function CancelButton({ token }: { token: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm("¿Seguro que quieres cancelar la cita?")) start(() => cancelByToken(token));
      }}
      className={buttonClass("danger", "h-12")}
    >
      {pending ? "Cancelando…" : "Cancelar cita"}
    </button>
  );
}
